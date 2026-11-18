import { sql } from '@payloadcms/db-sqlite'

import { recordLicenseTransition, type LicenseStatus } from '@/lib/licensing/transitions'

import { operationIdempotencyKey } from './idempotency'
import { deliverOrderNotifications, scheduleOrderNotifications } from './notify'
import { errorCode, type PaymentsDeps } from './runtime'
import type { OrderStatus } from './state'
import { claimJournal, journalKey, setJournal } from './store/journal'
import { withPaymentTransaction, type PaymentTx } from './store/transaction'
import { applyProviderState, loadOrderRow, type OrderRow } from './sync'
import type { ProviderPaymentState, ProviderRefundState } from './types'

/*
 * P6 admin operations (plan §2.4, §4.6). Callers: the admin-only order endpoints (admin-endpoints.ts), the provider
 * notification handler (dispute / refund events) and the reconcile job. Pure server code; no request objects here.
 *
 * REFUND (full amount only, v1):
 *   1. provider.refundStatus() — server-side read OUTSIDE any transaction: already refunded at the provider → the order
 *      is finalised WITHOUT a refund call; partially refunded → review; no captured payment → refused.
 *   2. lock: ONE journal row per order (`<provider>:admin-refund:<no>`, unique index, BEGIN IMMEDIATE). A concurrent or
 *      repeated request finds it and never calls refund() again.
 *   3. provider.refund() (iyzico has no idempotency key; Stripe gets a stable per-order key).
 *        succeeded             → finalise (below)
 *        rejected (ok:false)   → nothing was refunded: lock `error`, order unchanged, a later admin request may retry
 *        pending (Stripe)      → lock stays `received`; the charge.refunded webhook / reconcile finalise it
 *        timeout / bad answer  → outcome UNKNOWN: lock stays `received`, order `requiresReview` (`refund_uncertain`,
 *                                staff alert); NO blind retry — reconcileRefund() reads the provider again
 *   4. finalise = ONE transaction: conditional `paid|fulfilled → refunded`, the order's licences → `revoked`
 *      (conditional, notes), lock `processed`, refund-notice journal row (durable e-mail marker); after the confirmed
 *      commit the notification queue sends the buyer e-mail at least once (notify.ts kind `refund`).
 * CANCEL (unpaid `pending` only): provider read first (a paid order is synced, never cancelled), then Stripe expires
 *   the session / iyzico closes locally (no void API), then conditional `pending → cancelled` (`admin_cancelled`).
 *   A late payment still lands as `paid + requiresReview` through the normal sync path.
 * DISPUTE (Stripe charge.dispute.created): licences active → suspended, order review (`dispute_open`), staff alert.
 * RESEND: resets the notification attempt counter of an order whose queue gave up (or is in backoff) and delivers now.
 * Logs: order number + short codes only.
 */

type Id = number | string

export type AdminActionCode =
  | 'refunded' | 'already_refunded' | 'refund_pending' | 'refund_uncertain' | 'refund_in_progress' | 'refund_rejected'
  | 'partially_refunded' | 'not_refundable' | 'provider_unavailable' | 'provider_not_paid' | 'no_payment_id'
  | 'cancelled' | 'already_cancelled' | 'not_cancellable' | 'already_paid' | 'provider_review'
  | 'resent' | 'nothing_to_resend' | 'notify_busy' | 'notify_failed' | 'not_found'

export type AdminActionResult = { http: number; code: AdminActionCode; status?: OrderStatus; detail?: string; sent?: string[] }

export type Actor = { id: Id }

const REFUNDABLE: OrderStatus[] = ['paid', 'fulfilled']
const short = (code: string) => (/^[A-Za-z0-9_.-]{1,64}$/.test(code) ? code : 'internal')

const noteLine = (now: string, text: string) => `[${now.slice(0, 16).replace('T', ' ')}Z] ${text}`

/** Change each linked license once and keep its summary, history and device state atomic with the order. */
async function transitionOrderLicenses(
  tx: PaymentTx, orderId: Id, to: 'revoked' | 'suspended', now: string, line: string, actor?: Actor,
): Promise<number> {
  const reason = to === 'revoked' ? 'payment_refund' : 'payment_dispute'
  const licenses = await tx.all<{ id: number; status: LicenseStatus }>(sql`
    SELECT id, status FROM licenses
    WHERE id IN (SELECT license_id FROM orders_items WHERE _parent_id = ${orderId} AND license_id IS NOT NULL)
      AND ${to === 'revoked' ? sql`status <> 'revoked'` : sql`status = 'active'`}
  `)
  for (const { id, status: from } of licenses) {
    const changed = await tx.run(sql`UPDATE licenses SET status = ${to}, updated_at = ${now},
        status_reason = ${reason}, status_source = 'payment', status_changed_at = ${now},
        notes = TRIM(COALESCE(notes, '') || char(10) || ${line})
      WHERE id = ${id} AND status = ${from}`)
    if (changed !== 1) throw new Error('payments:license_transition_conflict')
    await recordLicenseTransition(tx.req, {
      license: id, from, to, source: 'payment', reason, at: now, order: Number(orderId),
      actorUser: actor ? Number(actor.id) : undefined,
    })
  }
  if (to === 'revoked') {
    await tx.run(sql`UPDATE license_activations SET status = 'revoked', end_reason = 'license_revoked',
        ended_at = ${now}, updated_at = ${now}
      WHERE status = 'active' AND license_id IN
        (SELECT license_id FROM orders_items WHERE _parent_id = ${orderId} AND license_id IS NOT NULL)`)
  }
  return licenses.length
}

async function appendOrderNote(tx: PaymentTx, orderId: Id, line: string) {
  await tx.run(sql`UPDATE orders SET notes = TRIM(COALESCE(notes, '') || char(10) || ${line}) WHERE id = ${orderId}`)
}

/** Flags review once per episode (a new episode resets the staff-alert marker, like sync.ts). */
async function flagReview(tx: PaymentTx, order: { id: Id; requiresReview?: boolean | null }, code: string, now: string): Promise<boolean> {
  const fresh = order.requiresReview !== true
  await tx.run(sql`UPDATE orders SET requires_review = 1, failure_reason = ${code},
      notifications_review_alert_sent_at = CASE WHEN ${fresh ? 1 : 0} = 1 THEN NULL ELSE notifications_review_alert_sent_at END,
      notifications_attempts = CASE WHEN ${fresh ? 1 : 0} = 1 THEN NULL ELSE notifications_attempts END,
      notifications_next_attempt_at = CASE WHEN ${fresh ? 1 : 0} = 1 THEN NULL ELSE notifications_next_attempt_at END,
      notifications_last_error = CASE WHEN ${fresh ? 1 : 0} = 1 THEN NULL ELSE notifications_last_error END,
      updated_at = ${now} WHERE id = ${order.id}`)
  return fresh
}

type RefundLock = { status: 'received' | 'processed' | 'ignored' | 'error'; receivedAt: string } | null

async function readRefundLock(deps: PaymentsDeps, order: OrderRow): Promise<RefundLock> {
  const { docs } = await deps.payload.find({
    collection: 'payment-events', where: { eventKey: { equals: journalKey(order.provider, 'admin-refund', order.orderNumber) } },
    limit: 1, depth: 0, overrideAccess: true, select: { status: true, receivedAt: true },
  })
  const doc = docs[0] as { status: NonNullable<RefundLock>['status']; receivedAt: string } | undefined
  return doc ? { status: doc.status, receivedAt: doc.receivedAt } : null
}

const refundInput = (order: OrderRow) => ({
  orderNumber: order.orderNumber,
  providerRef: order.providerRef ?? '',
  providerPaymentId: order.providerPaymentId ?? '',
  currency: order.currency,
  amountMinor: Number(order.totalMinor),
})

/** Step 4: finalise a provider-confirmed full refund. Idempotent (conditional writes; second call is a no-op). */
export async function finalizeRefund(deps: PaymentsDeps, orderId: Id, source: 'admin' | 'provider' | 'reconcile', actor?: Actor): Promise<'refunded' | 'already_refunded' | 'not_refundable'> {
  const result = await withPaymentTransaction(deps.payload, async (tx) => {
    const order = await loadOrderRow(deps.payload, orderId, tx.req)
    if (!order) return 'not_refundable' as const
    if (order.status === 'refunded') return 'already_refunded' as const
    if (!REFUNDABLE.includes(order.status)) return 'not_refundable' as const
    const now = deps.now().toISOString()
    const affected = await tx.run(sql`UPDATE orders SET status = 'refunded', refunded_at = ${now},
        requires_review = CASE WHEN failure_reason IN ('refund_uncertain', 'refund_pending') THEN 0 ELSE requires_review END,
        failure_reason = CASE WHEN failure_reason IN ('refund_uncertain', 'refund_pending') THEN NULL ELSE failure_reason END,
        notifications_attempts = NULL, notifications_next_attempt_at = NULL, notifications_last_error = NULL,
        updated_at = ${now}
      WHERE id = ${order.id} AND status IN ('paid', 'fulfilled')`)
    if (affected !== 1) throw new Error('payments:refund_conflict')
    const line = noteLine(now, `İade / refund ${order.orderNumber} (${source}${actor ? ` admin #${actor.id}` : ''})`)
    await transitionOrderLicenses(tx, order.id, 'revoked', now, line, actor)
    await appendOrderNote(tx, order.id, line)
    await setJournal(tx, journalKey(order.provider, 'admin-refund', order.orderNumber), 'processed', now, null)
    await claimJournal(tx, { provider: order.provider, kind: 'refund-notice', orderNumber: order.orderNumber, orderId: order.id, now }, false)
    tx.afterCommit(() => scheduleOrderNotifications(deps, order.id))
    deps.log.info(`order refunded order=${order.orderNumber} source=${source}`)
    return 'refunded' as const
  }, { confirm: async (r) => r !== 'refunded' || (await loadOrderRow(deps.payload, orderId))?.status === 'refunded' })
  return result
}

async function markRefundOutcome(deps: PaymentsDeps, order: OrderRow, outcome: 'rejected' | 'pending' | 'uncertain', code: string) {
  await withPaymentTransaction(deps.payload, async (tx) => {
    const now = deps.now().toISOString()
    const key = journalKey(order.provider, 'admin-refund', order.orderNumber)
    if (outcome === 'rejected') {
      await setJournal(tx, key, 'error', now, short(code))
      await appendOrderNote(tx, order.id, noteLine(now, `İade reddedildi / refund rejected (${short(code)})`))
      return
    }
    await setJournal(tx, key, 'received', now, outcome === 'pending' ? 'refund_pending' : short(code))
    await appendOrderNote(tx, order.id, noteLine(now, outcome === 'pending' ? 'İade beklemede / refund pending' : `İade sonucu belirsiz / refund outcome unknown (${short(code)})`))
    if (outcome === 'uncertain') {
      const fresh = await flagReview(tx, order, 'refund_uncertain', now)
      if (fresh) tx.afterCommit(() => scheduleOrderNotifications(deps, order.id))
    }
  })
}

/**
 * Provider-truth reconciliation of a refund (admin re-click on a locked order, `charge.refunded` webhook, reconcile).
 * Never calls refund(). Absence from a provider read cannot prove an in-flight attempt will never settle.
 */
export async function reconcileRefund(deps: PaymentsDeps, orderId: Id, source: 'admin' | 'provider' | 'reconcile', actor?: Actor): Promise<AdminActionResult> {
  const order = await loadOrderRow(deps.payload, orderId)
  if (!order) return { http: 404, code: 'not_found' }
  if (order.status === 'refunded') return { http: 200, code: 'already_refunded', status: 'refunded' }
  if (!REFUNDABLE.includes(order.status)) return { http: 409, code: 'not_refundable', status: order.status }
  const provider = deps.providers[order.provider]
  if (!provider || !order.providerPaymentId) return { http: 409, code: provider ? 'no_payment_id' : 'provider_unavailable', status: order.status }
  let state: ProviderRefundState
  try {
    state = await provider.refundStatus(refundInput(order))
  } catch (error) {
    deps.log.warn(`refund status unavailable order=${order.orderNumber} code=${errorCode(error)}`)
    return { http: 502, code: 'provider_unavailable', status: order.status, detail: errorCode(error) }
  }
  if (state.status === 'refunded') {
    const done = await finalizeRefund(deps, order.id, source, actor)
    return { http: 200, code: done === 'refunded' ? 'refunded' : 'already_refunded', status: 'refunded' }
  }
  if (state.status === 'partially_refunded') {
    await withPaymentTransaction(deps.payload, async (tx) => {
      if (await flagReview(tx, order, 'partial_refund', deps.now().toISOString())) tx.afterCommit(() => scheduleOrderNotifications(deps, order.id))
    })
    deps.log.warn(`order partially refunded at provider order=${order.orderNumber}`)
    return { http: 409, code: 'partially_refunded', status: order.status }
  }
  const lock = await readRefundLock(deps, order)
  if (lock?.status === 'received') {
    return { http: 409, code: 'refund_in_progress', status: order.status }
  }
  return { http: 409, code: state.status === 'not_paid' ? 'provider_not_paid' : 'not_refundable', status: order.status }
}

/** Admin "İade et" (full refund). See the header for the protocol. */
export async function refundOrder(deps: PaymentsDeps, orderId: Id, actor: Actor): Promise<AdminActionResult> {
  const order = await loadOrderRow(deps.payload, orderId)
  if (!order) return { http: 404, code: 'not_found' }
  if (order.status === 'refunded') return { http: 200, code: 'already_refunded', status: 'refunded' }
  if (!REFUNDABLE.includes(order.status)) return { http: 409, code: 'not_refundable', status: order.status }
  const provider = deps.providers[order.provider]
  if (!provider) return { http: 409, code: 'provider_unavailable', status: order.status }
  if (!order.providerPaymentId) return { http: 409, code: 'no_payment_id', status: order.status }

  // An earlier attempt holds (or finished) the lock: reconcile with the provider, never refund again.
  const lock = await readRefundLock(deps, order)
  if (lock && lock.status !== 'error') return reconcileRefund(deps, order.id, 'admin', actor)

  // 1. Provider truth first.
  let pre: ProviderRefundState
  try {
    pre = await provider.refundStatus(refundInput(order))
  } catch (error) {
    deps.log.warn(`refund precheck failed order=${order.orderNumber} code=${errorCode(error)}`)
    return { http: 502, code: 'provider_unavailable', status: order.status, detail: errorCode(error) }
  }
  if (pre.status === 'refunded') {
    const done = await finalizeRefund(deps, order.id, 'admin', actor)
    deps.log.info(`refund skipped (already refunded at provider) order=${order.orderNumber}`)
    void done
    return { http: 200, code: 'already_refunded', status: 'refunded' }
  }
  if (pre.status === 'partially_refunded') return reconcileRefund(deps, order.id, 'admin', actor)
  if (pre.status === 'not_paid') return { http: 409, code: 'provider_not_paid', status: order.status }

  // 2. Lock.
  const claimed = await withPaymentTransaction(deps.payload, async (tx) => {
    const fresh = await loadOrderRow(deps.payload, order.id, tx.req)
    if (!fresh || !REFUNDABLE.includes(fresh.status)) return false
    return claimJournal(tx, { provider: order.provider, kind: 'admin-refund', orderNumber: order.orderNumber, orderId: order.id, now: deps.now().toISOString() }, true)
  })
  if (!claimed) return { http: 409, code: 'refund_in_progress', status: order.status }

  // 3. The one refund call.
  let result
  try {
    result = await provider.refund({
      orderNumber: order.orderNumber,
      idempotencyKey: operationIdempotencyKey('refund', order.orderNumber),
      providerPaymentId: order.providerPaymentId,
      currency: order.currency,
      amountMinor: Number(order.totalMinor),
    })
  } catch (error) {
    const code = errorCode(error)
    await markRefundOutcome(deps, order, 'uncertain', code)
    deps.log.error(`refund outcome unknown order=${order.orderNumber} code=${code}`)
    return { http: 502, code: 'refund_uncertain', status: order.status, detail: code }
  }
  if (!result.ok) {
    await markRefundOutcome(deps, order, 'rejected', result.failureCode)
    deps.log.warn(`refund rejected order=${order.orderNumber} code=${short(result.failureCode)}`)
    return { http: 422, code: 'refund_rejected', status: order.status, detail: short(result.failureCode) }
  }
  if (result.status === 'pending') {
    await markRefundOutcome(deps, order, 'pending', 'refund_pending')
    deps.log.info(`refund pending order=${order.orderNumber}`)
    return { http: 202, code: 'refund_pending', status: order.status }
  }
  // 4. Finalise.
  const done = await finalizeRefund(deps, order.id, 'admin', actor)
  return { http: 200, code: done === 'not_refundable' ? 'not_refundable' : 'refunded', status: done === 'not_refundable' ? order.status : 'refunded' }
}

/** Admin "İptal et": an unpaid pending order only. */
export async function cancelOrder(deps: PaymentsDeps, orderId: Id, actor: Actor): Promise<AdminActionResult> {
  const order = await loadOrderRow(deps.payload, orderId)
  if (!order) return { http: 404, code: 'not_found' }
  if (order.status === 'cancelled') return { http: 200, code: 'already_cancelled', status: 'cancelled' }
  if (order.status !== 'pending') return { http: 409, code: 'not_cancellable', status: order.status }
  if (order.providerRef) {
    const provider = deps.providers[order.provider]
    if (!provider) return { http: 409, code: 'provider_unavailable', status: order.status }
    let state: ProviderPaymentState
    try {
      state = await provider.retrieve(order.providerRef, { orderNumber: order.orderNumber, locale: order.locale === 'en' ? 'en' : 'tr' })
    } catch (error) {
      return { http: 502, code: 'provider_unavailable', status: order.status, detail: errorCode(error) }
    }
    if (state.status === 'paid' || state.status === 'failed' || state.status === 'expired' || state.status === 'refunded') {
      // Provider already decided: apply its truth (paid orders are fulfilled by the normal path, never cancelled here).
      const applied = await applyProviderState(deps, order.id, state)
      if (state.status === 'paid') return { http: 409, code: 'already_paid', status: applied.status }
      if (applied.status === 'cancelled') return { http: 200, code: 'cancelled', status: 'cancelled' }
      return { http: 409, code: 'not_cancellable', status: applied.status }
    }
    if (state.status === 'review') return { http: 409, code: 'provider_review', status: order.status }
    try {
      const abandoned = await provider.abandonCheckout(order.providerRef)
      if (!abandoned.ok) {
        // e.g. the Stripe session completed meanwhile: do not cancel; the next sync applies the real state.
        return { http: 409, code: 'not_cancellable', status: order.status, detail: short(abandoned.failureCode) }
      }
    } catch (error) {
      return { http: 502, code: 'provider_unavailable', status: order.status, detail: errorCode(error) }
    }
  }
  const changed = await withPaymentTransaction(deps.payload, async (tx) => {
    const now = deps.now().toISOString()
    const affected = await tx.run(sql`UPDATE orders SET status = 'cancelled', cancelled_at = ${now},
        failure_reason = 'admin_cancelled', updated_at = ${now}
      WHERE id = ${order.id} AND status = 'pending' AND provider_ref IS ${order.providerRef ?? null}`)
    if (affected === 1) await appendOrderNote(tx, order.id, noteLine(now, `İptal / cancelled ${order.orderNumber} (admin #${actor.id})`))
    return affected === 1
  }, { confirm: async (c) => !c || (await loadOrderRow(deps.payload, order.id))?.status === 'cancelled' })
  if (!changed) {
    const now = await loadOrderRow(deps.payload, order.id)
    return { http: 409, code: 'not_cancellable', status: now?.status }
  }
  deps.log.info(`order cancelled by admin order=${order.orderNumber}`)
  return { http: 200, code: 'cancelled', status: 'cancelled' }
}

/** Stripe `charge.dispute.created`: suspend the order's licences, flag the order for review (staff alert). */
export async function applyDispute(deps: PaymentsDeps, orderId: Id): Promise<number> {
  return withPaymentTransaction(deps.payload, async (tx) => {
    const order = await loadOrderRow(deps.payload, orderId, tx.req)
    if (!order) return 0
    const now = deps.now().toISOString()
    const line = noteLine(now, `İtiraz açıldı / dispute opened ${order.orderNumber}`)
    const suspended = await transitionOrderLicenses(tx, order.id, 'suspended', now, line)
    await appendOrderNote(tx, order.id, line)
    if (await flagReview(tx, order, 'dispute_open', now)) tx.afterCommit(() => scheduleOrderNotifications(deps, order.id))
    deps.log.warn(`order dispute opened order=${order.orderNumber} suspended=${suspended}`)
    return suspended
  })
}

/** Stripe `charge.dispute.closed`: licences stay as they are; staff decide (review flag + alert). */
export async function flagDisputeClosed(deps: PaymentsDeps, orderId: Id): Promise<void> {
  await withPaymentTransaction(deps.payload, async (tx) => {
    const order = await loadOrderRow(deps.payload, orderId, tx.req)
    if (!order) return
    const now = deps.now().toISOString()
    await appendOrderNote(tx, order.id, noteLine(now, `İtiraz kapandı / dispute closed ${order.orderNumber}`))
    if (await flagReview(tx, order, 'dispute_closed', now)) tx.afterCommit(() => scheduleOrderNotifications(deps, order.id))
  })
}

/** Admin "Bildirimi yeniden gönder": clears the attempt counter/backoff (not a held lease) and delivers now. */
export async function resendNotifications(deps: PaymentsDeps, orderId: Id): Promise<AdminActionResult> {
  const order = await loadOrderRow(deps.payload, orderId)
  if (!order) return { http: 404, code: 'not_found' }
  const nowIso = deps.now().toISOString()
  await withPaymentTransaction(deps.payload, (tx) => tx.run(sql`UPDATE orders SET notifications_attempts = NULL,
      notifications_next_attempt_at = NULL, notifications_last_error = NULL
    WHERE id = ${order.id} AND (notifications_lease_until IS NULL OR notifications_lease_until <= ${nowIso})`))
  const result = await deliverOrderNotifications(deps, order.id)
  if (result.kind === 'busy') return { http: 409, code: 'notify_busy', status: order.status }
  if (result.failed) return { http: 502, code: 'notify_failed', status: order.status, detail: result.failed, sent: result.sent }
  if (!result.sent.length) return { http: 200, code: 'nothing_to_resend', status: order.status, detail: result.skipped.length ? `skipped:${result.skipped.join(',')}` : undefined }
  return { http: 200, code: 'resent', status: order.status, sent: result.sent }
}

