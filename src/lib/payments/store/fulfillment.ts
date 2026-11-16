import { sql } from '@payloadcms/db-sqlite'
import type { Payload } from 'payload'

import { planFulfillment, type FulfillmentOrderView, type FulfillmentStore } from '../idempotency'
import { canTransition, type OrderStatus } from '../state'
import { withPaymentTransaction, type PaymentTx } from './transaction'

/*
 * FulfillmentStore (P1 contract, idempotency.ts) over Payload + SQLite, and `fulfillOrder` (plan §2.4):
 *   BEGIN IMMEDIATE → load order → planFulfillment → per item: licenses.create (overrideAccess; the existing
 *   prepareLicense hook generates the CSPRNG key, product, seats and subscription end) → conditional
 *   `orders_items.license_id IS NULL` link → conditional `paid → fulfilled` → COMMIT.
 * Any conditional write that does not affect exactly one row rolls everything back (no licence survives).
 * Customers never write licences: issuance is server code only. The licence e-mail stays in the licenses
 * afterChange hook, which already defers to after() and re-reads the committed licence.
 */

type Id = number | string
type OrderDoc = {
  id: Id
  status: OrderStatus
  requiresReview?: boolean | null
  customer?: Id | { id: Id } | null
  paidAt?: string | null
  items?: { id?: string | null; edition?: Id | { id: Id } | null; license?: Id | { id: Id } | null }[] | null
}

const relId = (value: unknown): Id | null => {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) return (value as { id: Id }).id
  return null
}

/** Timestamp column written together with a status transition. */
const STAMP: Partial<Record<OrderStatus, string>> = { paid: 'paid_at', fulfilled: 'fulfilled_at', refunded: 'refunded_at', cancelled: 'cancelled_at' }

export class FulfillmentConflict extends Error {
  constructor(readonly reason: 'item_already_licensed' | 'status_changed' | 'order_incomplete') {
    super(`payments:fulfillment_conflict ${reason}`)
    this.name = 'FulfillmentConflict'
  }
}

export function createFulfillmentStore(payload: Payload, tx: PaymentTx): FulfillmentStore {
  const orders = new Map<string, OrderDoc>()
  return {
    async loadForUpdate(orderId) {
      const doc = (await payload.findByID({
        collection: 'orders', id: orderId, depth: 0, overrideAccess: true, req: tx.req, disableErrors: true,
      })) as OrderDoc | null
      if (!doc) return null
      orders.set(String(orderId), doc)
      return {
        status: doc.status,
        requiresReview: doc.requiresReview === true,
        items: (doc.items ?? []).map((item) => ({ id: String(item.id), licenseId: relId(item.license) })),
      } satisfies FulfillmentOrderView
    },

    async issueLicense(orderId, itemId) {
      const order = orders.get(String(orderId))
      const item = order?.items?.find((i) => String(i.id) === itemId)
      const customer = relId(order?.customer)
      const edition = relId(item?.edition)
      if (!order || customer === null || edition === null) throw new FulfillmentConflict('order_incomplete')
      const license = await payload.create({
        collection: 'licenses',
        overrideAccess: true,
        req: tx.req,
        depth: 0,
        data: { customer: Number(customer), edition: Number(edition), startsAt: order.paidAt ?? new Date().toISOString(), status: 'active' } as never,
      })
      return license.id
    },

    async setItemLicense(orderId, itemId, licenseId) {
      const affected = await tx.run(sql`UPDATE orders_items SET license_id = ${licenseId}
        WHERE _parent_id = ${orderId} AND id = ${itemId} AND license_id IS NULL`)
      return affected === 1
    },

    async transitionStatus(orderId, from, to) {
      if (!canTransition(from, to)) return 0
      const now = new Date().toISOString()
      const stamp = STAMP[to]
      return tx.run(stamp
        ? sql`UPDATE orders SET status = ${to}, ${sql.raw(stamp)} = ${now}, updated_at = ${now} WHERE id = ${orderId} AND status = ${from}`
        : sql`UPDATE orders SET status = ${to}, updated_at = ${now} WHERE id = ${orderId} AND status = ${from}`)
    },
  }
}

export type FulfillResult =
  | { kind: 'fulfilled'; licenseIds: Id[] }
  | { kind: 'noop'; reason: 'not_found' | 'not_paid' | 'requires_review' | 'already_fulfilled' }
  /** A conditional write failed; the transaction was rolled back and nothing (no licence) was written. */
  | { kind: 'conflict'; reason: FulfillmentConflict['reason'] }

export type FulfillOptions = {
  /** Runs once, only after a confirmed commit (e.g. order confirmation e-mail in P4/P5). */
  afterCommit?: (result: Extract<FulfillResult, { kind: 'fulfilled' }>) => void | Promise<void>
  /** Test seam: wrap the store to inject failures. */
  wrapStore?: (store: FulfillmentStore) => FulfillmentStore
}

/** Idempotent: a second call (sequential or concurrent) sees the fulfilled order and is a no-op. */
export async function fulfillOrder(payload: Payload, orderId: Id, options: FulfillOptions = {}): Promise<FulfillResult> {
  try {
    return await withPaymentTransaction<FulfillResult>(payload, async (tx) => {
      const base = createFulfillmentStore(payload, tx)
      const store = options.wrapStore ? options.wrapStore(base) : base
      const view = await store.loadForUpdate(String(orderId))
      if (!view) return { kind: 'noop', reason: 'not_found' }
      const plan = planFulfillment(view)
      if (plan.action === 'none') return { kind: 'noop', reason: plan.reason }
      const licenseIds: Id[] = []
      if (plan.action === 'issue') {
        for (const itemId of plan.itemIds) {
          const licenseId = await store.issueLicense(String(orderId), itemId)
          if (!(await store.setItemLicense(String(orderId), itemId, licenseId))) throw new FulfillmentConflict('item_already_licensed')
          licenseIds.push(licenseId)
        }
      }
      if ((await store.transitionStatus(String(orderId), 'paid', 'fulfilled')) !== 1) throw new FulfillmentConflict('status_changed')
      const result = { kind: 'fulfilled' as const, licenseIds }
      if (options.afterCommit) tx.afterCommit(() => options.afterCommit!(result))
      return result
    }, {
      confirm: async (result) => {
        if (result.kind !== 'fulfilled') return true
        const order = (await payload.findByID({ collection: 'orders', id: orderId, depth: 0, overrideAccess: true, disableErrors: true })) as OrderDoc | null
        const linked = new Set((order?.items ?? []).map((item) => String(relId(item.license))))
        return order?.status === 'fulfilled' && result.licenseIds.every((id) => linked.has(String(id)))
      },
    })
  } catch (error) {
    if (error instanceof FulfillmentConflict) return { kind: 'conflict', reason: error.reason }
    throw error
  }
}
