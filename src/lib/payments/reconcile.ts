import { sql } from '@payloadcms/db-sqlite'

import { PaymentError } from './errors'
import { fulfilPaidOrder } from './fulfill'
import { deliverOrderNotifications, findUndeliveredOrders } from './notify'
import { errorCode, type PaymentsDeps } from './runtime'
import { decideFromProvider } from './state'
import { withPaymentTransaction } from './store/transaction'
import { loadOrderRow, syncOrderFromProvider, type OrderRow } from './sync'

/*
 * Reconcile job (plan §3 "Zaman aşımı", §1.5): `pnpm payments:reconcile [--dry-run]`, systemd timer every 15 min.
 *   - pending orders older than `minAgeMs` → syncOrderFromProvider (same path as webhooks; fulfils when paid);
 *     verified pending after `expireAfterMs` (60 min) → `cancelled` (failureReason `expired`). Provider errors
 *     do not prove that payment was not made and never cause cancellation.
 *     A pending order that never reached the provider (no providerRef) is cancelled after expiry.
 *   - `paid` orders not under review (an earlier fulfilment crashed) → fulfilPaidOrder.
 *   - notify phase: fulfilled / under-review orders whose durable notification markers are still empty (process died
 *     after commit, SMTP error) → deliverOrderNotifications (lease, at most NOTIFY_POLICY.maxAttempts with backoff;
 *     missing SMTP = skipped, not counted). Runs last so deliveries started by this run usually hold the lease.
 * Idempotent: every write is conditional (status = from) inside BEGIN IMMEDIATE; a rerun finds nothing to do.
 * Runs regardless of the site mode while the env capability is on (server-initiated provider truth, so pending
 * orders are completed or cancelled after a switch to quote-only). Never touches the Next cache.
 * Dry run: provider reads only (retrieve is side-effect free), no DB writes, no e-mail.
 */

// limit is the pending/paid scan's page size and the notify phase's existing delivery limit.
export type ReconcileOptions = { dryRun?: boolean; minAgeMs?: number; expireAfterMs?: number; limit?: number }
export type ReconcileAction = { orderNumber: string; action: 'synced' | 'cancel' | 'fulfil' | 'notify' | 'none' | 'error'; detail: string }
export type ReconcileReport = { skipped?: 'capability_off'; dryRun: boolean; actions: ReconcileAction[]; errors: number }

export const RECONCILE_DEFAULTS = { minAgeMs: 5 * 60 * 1000, expireAfterMs: 60 * 60 * 1000, limit: 200 } as const

async function cancelPending(deps: PaymentsDeps, order: OrderRow, reason: string): Promise<boolean> {
  return withPaymentTransaction(deps.payload, async (tx) => {
    const now = deps.now().toISOString()
    const affected = await tx.run(sql`UPDATE orders SET status = 'cancelled', cancelled_at = ${now},
      failure_reason = COALESCE(failure_reason, ${reason}), updated_at = ${now} WHERE id = ${order.id} AND status = 'pending'
      AND COALESCE(requires_review, 0) = 0 AND provider_ref IS ${order.providerRef ?? null}`)
    return affected === 1
  }, { confirm: async (changed) => !changed || (await loadOrderRow(deps.payload, order.id))?.status === 'cancelled' })
}

export async function reconcileOrders(deps: PaymentsDeps, options: ReconcileOptions = {}): Promise<ReconcileReport> {
  const dryRun = options.dryRun === true
  const report: ReconcileReport = { dryRun, actions: [], errors: 0 }
  if (!deps.env.capability) return { ...report, skipped: 'capability_off' }
  const minAgeMs = options.minAgeMs ?? RECONCILE_DEFAULTS.minAgeMs
  const expireAfterMs = options.expireAfterMs ?? RECONCILE_DEFAULTS.expireAfterMs
  const limit = options.limit ?? RECONCILE_DEFAULTS.limit
  const now = deps.now()
  const push = (order: Pick<OrderRow, 'orderNumber'>, action: ReconcileAction['action'], detail: string) => {
    report.actions.push({ orderNumber: order.orderNumber, action, detail })
    if (action === 'error') report.errors++
  }
  // Visit the entire finite ID range, once per phase. OFFSET would skip rows as earlier pages leave the status;
  // a fixed first page would starve later orders behind persistent retrieve/fulfilment errors. A high-water ID
  // keeps concurrent inserts from extending this run forever. No cursor/backoff writes, including in dry-run;
  // notifications.nextAttemptAt belongs solely to notification delivery and must not delay provider sync.
  const newest = await deps.payload.find({
    collection: 'orders', limit: 1, depth: 0, sort: '-id', overrideAccess: true, pagination: false, select: { orderNumber: true },
  })
  const throughId = newest.docs[0]?.id
  async function* scan(where: object): AsyncGenerator<OrderRow> {
    if (throughId === undefined) return
    let afterId: OrderRow['id'] | undefined
    while (true) {
      const { docs } = await deps.payload.find({
        collection: 'orders',
        where: { and: [where, { id: { less_than_equal: throughId } }, ...(afterId === undefined ? [] : [{ id: { greater_than: afterId } }])] } as never,
        limit, depth: 0, sort: 'id', overrideAccess: true, pagination: false,
        select: { orderNumber: true, status: true, provider: true, providerRef: true, providerPaymentId: true, currency: true, totalMinor: true, locale: true, requiresReview: true, createdAt: true },
      })
      if (!docs.length) return
      for (const order of docs as unknown as OrderRow[]) yield order
      afterId = docs[docs.length - 1]!.id
    }
  }

  const pending = scan({ and: [{ status: { equals: 'pending' } }, { createdAt: { less_than: new Date(now.getTime() - minAgeMs).toISOString() } }] })
  for await (const order of pending) {
    const expired = now.getTime() - new Date(order.createdAt ?? now).getTime() >= expireAfterMs
    try {
      if (!order.providerRef) {
        if (!expired) push(order, 'none', 'not_started')
        else if (dryRun) push(order, 'cancel', 'checkout_not_started')
        else push(order, (await cancelPending(deps, order, 'checkout_not_started')) ? 'cancel' : 'none', 'checkout_not_started')
        continue
      }
      const provider = deps.providers[order.provider]
      if (!provider) throw new PaymentError('not_configured', { provider: order.provider })
      let stillPending = false
      {
        if (dryRun) {
          const state = await provider.retrieve(order.providerRef, { orderNumber: order.orderNumber, locale: order.locale === 'en' ? 'en' : 'tr' })
          const decision = decideFromProvider({ ...order, providerRef: order.providerRef, totalMinor: Number(order.totalMinor) }, state)
          stillPending = state.status === 'pending' && decision.kind === 'noop' && decision.reason === 'pending' && !order.requiresReview
          if (!(stillPending && expired)) push(order, decision.kind === 'noop' ? 'none' : 'synced', decision.kind === 'transition' ? `${decision.from}->${decision.to}` : decision.kind === 'flag' ? decision.failureCode : decision.reason)
        } else {
          const outcome = await syncOrderFromProvider(deps, order.id)
          stillPending = outcome.state?.status === 'pending' && outcome.status === 'pending' && outcome.decision.kind === 'noop' && outcome.decision.reason === 'pending' && !order.requiresReview
          if (!(stillPending && expired)) push(order, outcome.decision.kind === 'noop' ? 'none' : 'synced', `status=${outcome.status ?? 'unknown'}`)
        }
      }
      if (stillPending && expired) {
        const reason = 'expired'
        if (dryRun) push(order, 'cancel', reason)
        else push(order, (await cancelPending(deps, order, reason)) ? 'cancel' : 'none', reason)
      }
    } catch (error) {
      push(order, 'error', errorCode(error))
    }
  }

  const paid = scan({ and: [{ status: { equals: 'paid' } }, { requiresReview: { not_equals: true } }] })
  for await (const order of paid) {
    if (dryRun) {
      push(order, 'fulfil', 'paid_unfulfilled')
      continue
    }
    try {
      const result = await fulfilPaidOrder(deps, order.id)
      push(order, result.kind === 'fulfilled' ? 'fulfil' : 'none', result.kind === 'fulfilled' ? 'licensed' : result.reason)
    } catch (error) {
      push(order, 'error', errorCode(error))
    }
  }
  const undelivered = await findUndeliveredOrders(deps, limit, !dryRun)
  for (const row of undelivered) {
    const order = { orderNumber: row.orderNumber }
    if (dryRun) {
      push(order, 'notify', `pending:${row.kinds.join(',')}`)
      continue
    }
    try {
      const result = await deliverOrderNotifications(deps, row.id)
      if (result.kind === 'busy') push(order, 'none', 'notify_busy')
      else if (result.failed) push(order, 'error', `notify_${result.failed}`)
      else if (result.sent.length) push(order, 'notify', `sent:${result.sent.join(',')}`)
      else push(order, 'none', result.skipped.length ? `notify_skipped:${result.skipped.join(',')}` : 'notify_nothing')
    } catch (error) {
      push(order, 'error', `notify_${errorCode(error)}`)
    }
  }

  for (const action of report.actions) {
    if (action.action !== 'none') deps.log.info(`reconcile${dryRun ? ' (dry run)' : ''} order=${action.orderNumber} action=${action.action} detail=${action.detail}`)
  }
  return report
}
