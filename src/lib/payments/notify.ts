import { sql } from '@payloadcms/db-sqlite'
import type { Where } from 'payload'

import { sendOrderConfirmation, sendOrderLicenses, type NotifyOrder } from '@/lib/email/order-confirmation'
import { alertRecipient, sendOrderReviewAlert } from '@/lib/email/order-review'
import { isSmtpConfigured } from '@/lib/email/template'
import type { PaymentsDeps } from './runtime'
import { withPaymentTransaction } from './store/transaction'

/*
 * Durable order notifications (P4). Three messages per order, each sent at most once per successful delivery:
 *   confirmation  (buyer, order fulfilled)   → orders.notifications.confirmationSentAt
 *   license       (buyer, licence key(s))    → orders.notifications.licenseSentAt
 *   reviewAlert   (staff, requiresReview)    → orders.notifications.reviewAlertSentAt
 *
 * Triggers: right after the committing transaction (webhook/callback via `deps.defer` = next/server after();
 * reconcile CLI: started at once and awaited) and the reconcile job's notify phase, which retries every order whose
 * markers are still empty (process died after commit, SMTP error). Delivery:
 *   1. claim a per-order lease with ONE conditional UPDATE (lease free/expired, attempts < max, backoff elapsed);
 *      a concurrent sender gets 0 rows and stops → no double send,
 *   2. read the committed order, send each pending message, and after each success write its marker with
 *      `WHERE <marker> IS NULL`,
 *   3. release the lease; on failure attempts+1, lastError = short code, nextAttemptAt = exponential backoff.
 * SMTP (or PAYMENTS_ALERT_EMAIL for the staff alert) missing → skipped, not counted (no console adapter: it would log
 * the recipient and the licence key). Guarantee: at-least-once with a duplicate only if the process dies between a
 * successful send and its marker write (or the lease expires mid-send). Logs: order number + short codes only.
 */

type Id = number | string
export type NotifyKind = 'confirmation' | 'license' | 'reviewAlert'
export type NotifyResult =
  | { kind: 'busy' }
  | { kind: 'done'; sent: NotifyKind[]; skipped: NotifyKind[]; failed: string | null; pending: NotifyKind[] }

export const NOTIFY_POLICY = {
  maxAttempts: 5,
  leaseMs: 5 * 60_000,
  /** 15, 30, 60, 120 min (the reconcile timer runs every 15 min). */
  backoffMs: 15 * 60_000,
  /** The reconcile phase ignores orders older than this (no surprise e-mails weeks later, e.g. after enabling SMTP). */
  maxAgeMs: 7 * 24 * 3600_000,
} as const

type NotifyDoc = NotifyOrder & {
  status: string
  requiresReview?: boolean | null
  failureReason?: string | null
  notifications?: {
    confirmationSentAt?: string | null
    licenseSentAt?: string | null
    reviewAlertSentAt?: string | null
    attempts?: number | null
  } | null
}

const MARKER: Record<NotifyKind, string> = {
  confirmation: 'notifications_confirmation_sent_at',
  license: 'notifications_license_sent_at',
  reviewAlert: 'notifications_review_alert_sent_at',
}

export function pendingKinds(doc: Pick<NotifyDoc, 'status' | 'requiresReview' | 'notifications'>): NotifyKind[] {
  const n = doc.notifications ?? {}
  const kinds: NotifyKind[] = []
  if (doc.status === 'fulfilled' && !n.confirmationSentAt) kinds.push('confirmation')
  if (doc.status === 'fulfilled' && !n.licenseSentAt) kinds.push('license')
  if (doc.requiresReview === true && !n.reviewAlertSentAt) kinds.push('reviewAlert')
  return kinds
}

const shortReason = (value: unknown) => (typeof value === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(value) ? value : 'review')

async function write(deps: PaymentsDeps, query: ReturnType<typeof sql>): Promise<number> {
  return withPaymentTransaction(deps.payload, (tx) => tx.run(query))
}

export async function deliverOrderNotifications(deps: PaymentsDeps, orderId: Id): Promise<NotifyResult> {
  const now = deps.now()
  const nowIso = now.toISOString()
  const lease = new Date(now.getTime() + NOTIFY_POLICY.leaseMs).toISOString()
  const claimed = await write(deps, sql`UPDATE orders SET notifications_lease_until = ${lease}
    WHERE id = ${orderId}
      AND (notifications_lease_until IS NULL OR notifications_lease_until <= ${nowIso})
      AND COALESCE(notifications_attempts, 0) < ${NOTIFY_POLICY.maxAttempts}
      AND (notifications_next_attempt_at IS NULL OR notifications_next_attempt_at <= ${nowIso})`)
  if (claimed !== 1) return { kind: 'busy' }

  const sent: NotifyKind[] = []
  const skipped: NotifyKind[] = []
  let failed: string | null = null
  let doc: NotifyDoc | null = null
  try {
    doc = (await deps.payload.findByID({ collection: 'orders', id: orderId, depth: 0, overrideAccess: true, disableErrors: true })) as NotifyDoc | null
    const kinds = doc ? pendingKinds(doc) : []
    for (const kind of kinds) {
      const order = doc!
      let outcome: string
      try {
        outcome = kind === 'reviewAlert'
          ? await sendOrderReviewAlert(deps.payload, { orderId: order.id, orderNumber: order.orderNumber, reason: shortReason(order.failureReason) }, { origin: deps.origin })
          : kind === 'confirmation'
            ? await sendOrderConfirmation(deps.payload, order, { origin: deps.origin })
            : await sendOrderLicenses(deps.payload, order)
      } catch {
        outcome = 'smtp_error'
      }
      if (outcome === 'sent') {
        await write(deps, sql`UPDATE orders SET ${sql.raw(MARKER[kind])} = ${deps.now().toISOString()}
          WHERE id = ${order.id} AND ${sql.raw(MARKER[kind])} IS NULL`)
        sent.push(kind)
        deps.log.info(`order notification sent order=${order.orderNumber} kind=${kind}`)
      } else if (outcome === 'no_smtp' || outcome === 'not_configured') {
        skipped.push(kind)
        deps.log.warn(kind === 'reviewAlert'
          ? `review alert not emailed (no PAYMENTS_ALERT_EMAIL/SMTP) order=${order.orderNumber} reason=${shortReason(order.failureReason)}`
          : `order email skipped (SMTP not configured) order=${order.orderNumber} kind=${kind}`)
      } else {
        failed ??= outcome
        deps.log.error(`order notification failed order=${order.orderNumber} kind=${kind} code=${outcome}`)
      }
    }
  } catch {
    failed ??= 'internal'
    deps.log.error(`order notification failed order=${doc?.orderNumber ?? '?'} code=internal`)
  } finally {
    const attempts = (doc?.notifications?.attempts ?? 0) + 1
    const next = new Date(deps.now().getTime() + NOTIFY_POLICY.backoffMs * 2 ** (attempts - 1)).toISOString()
    try {
      await write(deps, failed
        ? sql`UPDATE orders SET notifications_lease_until = NULL, notifications_attempts = COALESCE(notifications_attempts, 0) + 1,
            notifications_last_error = ${failed}, notifications_next_attempt_at = ${next}
            WHERE id = ${orderId} AND notifications_lease_until = ${lease}`
        : sql`UPDATE orders SET notifications_lease_until = NULL,
            notifications_last_error = CASE WHEN ${sent.length} > 0 THEN NULL ELSE notifications_last_error END
            WHERE id = ${orderId} AND notifications_lease_until = ${lease}`)
    } catch {
      // The lease expires on its own; the next run retries.
      deps.log.error(`order notification lease not released order=${doc?.orderNumber ?? '?'}`)
    }
  }
  const pending = doc ? pendingKinds(doc).filter((k) => !sent.includes(k)) : []
  return { kind: 'done', sent, skipped, failed, pending }
}

/** Schedules delivery after the response / commit (`deps.defer` never throws). */
export function scheduleOrderNotifications(deps: PaymentsDeps, orderId: Id): void {
  deps.defer(async () => {
    await deliverOrderNotifications(deps, orderId)
  })
}

/** Orders the reconcile notify phase should retry (oldest first). Read-only. */
export async function findUndeliveredOrders(deps: PaymentsDeps, limit: number, sendableOnly = false): Promise<{ id: Id; orderNumber: string; kinds: NotifyKind[] }[]> {
  const now = deps.now()
  const nowIso = now.toISOString()
  if (sendableOnly && !isSmtpConfigured()) return []
  const kinds: Where[] = [
    { and: [{ status: { equals: 'fulfilled' } }, { or: [{ 'notifications.confirmationSentAt': { exists: false } }, { 'notifications.licenseSentAt': { exists: false } }] }] },
    ...(!sendableOnly || alertRecipient() ? [{ and: [{ requiresReview: { equals: true } }, { 'notifications.reviewAlertSentAt': { exists: false } }] }] : []),
  ]
  const { docs } = await deps.payload.find({
    collection: 'orders', limit, depth: 0, sort: 'createdAt', overrideAccess: true, pagination: false,
    select: { orderNumber: true, status: true, requiresReview: true, notifications: true },
    where: {
      and: [
        { createdAt: { greater_than_equal: new Date(now.getTime() - NOTIFY_POLICY.maxAgeMs).toISOString() } },
        { or: [{ 'notifications.attempts': { exists: false } }, { 'notifications.attempts': { less_than: NOTIFY_POLICY.maxAttempts } }] },
        { or: [{ 'notifications.nextAttemptAt': { exists: false } }, { 'notifications.nextAttemptAt': { less_than_equal: nowIso } }] },
        ...(sendableOnly ? [{ or: [{ 'notifications.leaseUntil': { exists: false } }, { 'notifications.leaseUntil': { less_than_equal: nowIso } }] }] : []),
        { or: kinds },
      ],
    },
  })
  return (docs as unknown as (NotifyDoc & { id: Id })[])
    .map((doc) => ({ id: doc.id, orderNumber: doc.orderNumber, kinds: pendingKinds(doc) }))
    .filter((row) => row.kinds.length > 0)
}
