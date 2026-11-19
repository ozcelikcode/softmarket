import { sql } from '@payloadcms/db-sqlite'
import type { Payload } from 'payload'

import { PaymentError } from './errors'
import { fulfilPaidOrder } from './fulfill'
import { scheduleOrderNotifications } from './notify'
import type { PaymentsDeps } from './runtime'
import { decideFromProvider, type OrderStatus, type SyncDecision } from './state'
import type { FulfillResult } from './store/fulfillment'
import { withPaymentTransaction } from './store/transaction'
import { CURRENCIES, PROVIDER_IDS, type Currency, type ProviderId, type ProviderPaymentState } from './types'

/*
 * syncOrderFromProvider (plan §2.3): "event = trigger, provider = truth". Webhooks, the iyzico callback and the
 * reconcile job all call this one function:
 *   1. read the order (no lock), 2. retrieve() the real payment state from the provider with server credentials
 *      (OUTSIDE any transaction: no write lock is held during HTTP),
 *   3. BEGIN IMMEDIATE → re-read the order → decideFromProvider (state.ts) → conditional `UPDATE … WHERE status = from`
 *      → COMMIT (+ independent confirm read),
 *   4. if the committed order is `paid` and not under review → fulfilPaidOrder (its own single transaction).
 * Amount/currency/reference mismatch → `requiresReview`, never a licence. A retrieve error leaves the order untouched
 * and propagates (the webhook answers 500 → the provider retries; reconcile tries again later).
 */

type Id = number | string

export type OrderRow = {
  id: Id
  orderNumber: string
  status: OrderStatus
  provider: ProviderId
  providerRef?: string | null
  providerPaymentId?: string | null
  currency: Currency
  totalMinor: number
  locale?: string | null
  requiresReview?: boolean | null
  createdAt?: string
}

const ORDER_SELECT = {
  orderNumber: true, status: true, provider: true, providerRef: true, providerPaymentId: true,
  currency: true, totalMinor: true, locale: true, requiresReview: true, createdAt: true,
} as const

export async function loadOrderRow(payload: Payload, id: Id, req?: Parameters<Payload['findByID']>[0]['req']): Promise<OrderRow | null> {
  const doc = await payload.findByID({ collection: 'orders', id, depth: 0, overrideAccess: true, disableErrors: true, select: ORDER_SELECT, ...(req ? { req } : {}) })
  return (doc as unknown as OrderRow | null) ?? null
}

export class SyncConflict extends Error {
  constructor() {
    super('payments:sync_conflict')
    this.name = 'SyncConflict'
  }
}

const STAMP: Partial<Record<OrderStatus, string>> = { paid: 'paid_at', fulfilled: 'fulfilled_at', refunded: 'refunded_at', cancelled: 'cancelled_at' }
const shortCode = (code: string | undefined) => (code && /^[A-Za-z0-9_.-]{1,64}$/.test(code) ? code : null)

export type ApplyResult = { decision: SyncDecision; status: OrderStatus; requiresReview: boolean }

/** Step 3: applies an already retrieved provider state inside one write transaction. Exported for reconcile/tests. */
export async function applyProviderState(deps: PaymentsDeps, orderId: Id, state: ProviderPaymentState): Promise<ApplyResult> {
  const { payload } = deps
  return withPaymentTransaction<ApplyResult>(payload, async (tx) => {
    const order = await loadOrderRow(payload, orderId, tx.req)
    if (!order) throw new PaymentError('invalid_input', { detail: 'order_missing' })
    const reviewed = order.requiresReview === true
    if (!order.providerRef || !(PROVIDER_IDS as readonly string[]).includes(order.provider) || !(CURRENCIES as readonly string[]).includes(order.currency)) {
      return { decision: { kind: 'noop', reason: 'order_without_reference' }, status: order.status, requiresReview: reviewed }
    }
    const decision = decideFromProvider({
      orderNumber: order.orderNumber, status: order.status, provider: order.provider, providerRef: order.providerRef,
      currency: order.currency, totalMinor: Number(order.totalMinor),
    }, state)
    const now = deps.now().toISOString()
    // Staff alert via the durable notification queue (notify.ts); the reason is read from failure_reason.
    const alert = () => tx.afterCommit(() => scheduleOrderNotifications(deps, order.id))

    if (decision.kind === 'flag') {
      if (!reviewed) {
        // A new review episode gets a new staff alert (the marker of an earlier, cleared review is reset).
        await tx.run(sql`UPDATE orders SET requires_review = 1, failure_reason = ${decision.failureCode},
          notifications_review_alert_sent_at = NULL, notifications_attempts = NULL,
          notifications_next_attempt_at = NULL, notifications_last_error = NULL, updated_at = ${now} WHERE id = ${order.id}`)
        alert()
      }
      deps.log.warn(`order flagged order=${order.orderNumber} reason=${decision.failureCode}`)
      return { decision, status: order.status, requiresReview: true }
    }
    if (decision.kind === 'noop') return { decision, status: order.status, requiresReview: reviewed }

    const stamp = STAMP[decision.to]
    const review = decision.requiresReview ? 1 : 0
    const failure = shortCode(decision.failureCode)
    const paymentId = state.providerPaymentId && /^[A-Za-z0-9_.:-]{1,128}$/.test(state.providerPaymentId) ? state.providerPaymentId : null
    // `stamp` comes from the fixed STAMP map above (never from input).
    const affected = await tx.run(sql`UPDATE orders SET status = ${decision.to},
        ${stamp ? sql`${sql.raw(stamp)} = ${now},` : sql.raw('')}
        requires_review = CASE WHEN ${review} = 1 THEN 1 ELSE requires_review END,
        notifications_review_alert_sent_at = CASE WHEN ${review} = 1 AND ${reviewed ? 1 : 0} = 0 THEN NULL ELSE notifications_review_alert_sent_at END,
        notifications_attempts = CASE WHEN ${review} = 1 AND ${reviewed ? 1 : 0} = 0 THEN NULL ELSE notifications_attempts END,
        notifications_next_attempt_at = CASE WHEN ${review} = 1 AND ${reviewed ? 1 : 0} = 0 THEN NULL ELSE notifications_next_attempt_at END,
        notifications_last_error = CASE WHEN ${review} = 1 AND ${reviewed ? 1 : 0} = 0 THEN NULL ELSE notifications_last_error END,
        failure_reason = COALESCE(${failure}, failure_reason),
        provider_payment_id = COALESCE(provider_payment_id, ${paymentId}),
        updated_at = ${now}
      WHERE id = ${order.id} AND status = ${decision.from}`)
    // Impossible under BEGIN IMMEDIATE + fresh read; if it ever happens, roll back and let the trigger retry.
    if (affected !== 1) throw new SyncConflict()
    if (decision.requiresReview && !reviewed) alert()
    deps.log.info(`order ${decision.from}->${decision.to} order=${order.orderNumber}${decision.requiresReview ? ` review=${decision.failureCode ?? 'yes'}` : ''}`)
    return { decision, status: decision.to, requiresReview: reviewed || decision.requiresReview }
  }, {
    confirm: async (result) => {
      const committed = await loadOrderRow(payload, orderId)
      return committed?.status === result.status
    },
  })
}

export type SyncOutcome = {
  orderNumber?: string
  state?: ProviderPaymentState
  decision: SyncDecision
  status?: OrderStatus
  fulfil?: FulfillResult
}

export async function syncOrderFromProvider(deps: PaymentsDeps, orderId: Id, allowedStatuses?: readonly OrderStatus[]): Promise<SyncOutcome> {
  const order = await loadOrderRow(deps.payload, orderId)
  if (!order) return { decision: { kind: 'noop', reason: 'not_found' } }
  // Browser returns have a narrower scope than verified events and reconciliation.
  if (allowedStatuses && !allowedStatuses.includes(order.status)) {
    return { orderNumber: order.orderNumber, decision: { kind: 'noop', reason: 'return_status' }, status: order.status }
  }
  if (!order.providerRef) return { orderNumber: order.orderNumber, decision: { kind: 'noop', reason: 'no_provider_ref' }, status: order.status }
  const provider = deps.providers[order.provider]
  if (!provider) throw new PaymentError('not_configured', { provider: order.provider })
  const state = await provider.retrieve(order.providerRef, { orderNumber: order.orderNumber, locale: order.locale === 'en' ? 'en' : 'tr' })
  const applied = await applyProviderState(deps, order.id, state)
  // Retry-safe: fulfil whenever the committed order is paid and clean (also when an earlier fulfilment crashed).
  const fulfil = applied.status === 'paid' && !applied.requiresReview ? await fulfilPaidOrder(deps, order.id) : undefined
  return { orderNumber: order.orderNumber, state, decision: applied.decision, status: fulfil?.kind === 'fulfilled' ? 'fulfilled' : applied.status, fulfil }
}
