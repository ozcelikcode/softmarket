import { sql } from '@payloadcms/db-sqlite'

import { sha256Hex } from '../idempotency'
import type { ProviderId } from '../types'
import type { PaymentTx } from './transaction'

/*
 * P6 operation journal on the existing `payment-events` table (NO schema change). Server-written rows whose
 * `event_key` is `<provider>:<kind>:<orderNumber>`; the unique `event_key` index makes each one a per-order lock or
 * marker. `signature_verified` is false (these are not provider notifications) and `body_sha256` is the SHA-256 of
 * the key itself (no body exists). Staff see them read-only under "Satış → Ödeme olayları" as an audit trail.
 *
 *   admin-refund   lock of the ONE refund attempt per order:
 *                  received = in flight / outcome unknown (timeout) / provider answered `pending`  → never retried
 *                  processed = refund confirmed (order refunded)
 *                  error = the provider explicitly REJECTED the refund (nothing was refunded) → a new admin
 *                          request may take the lock again
 *   refund-notice  durable "refund e-mail" marker: received = to send, processed = sent (notify.ts, kind `refund`)
 */

export type JournalKind = 'admin-refund' | 'refund-notice'

const TYPE: Record<JournalKind, string> = { 'admin-refund': 'admin.refund', 'refund-notice': 'notify.refund' }

export const journalKey = (provider: ProviderId, kind: JournalKind, orderNumber: string) => `${provider}:${kind}:${orderNumber}`

type Row = { provider: ProviderId; kind: JournalKind; orderNumber: string; orderId: number | string; now: string }

/**
 * Inserts the row, or takes over a row left in `error` (only when `retakeError`). Returns true when THIS call now
 * holds the row in `received`. Atomic under the caller's BEGIN IMMEDIATE + the unique index.
 */
export async function claimJournal(tx: PaymentTx, row: Row, retakeError: boolean): Promise<boolean> {
  const key = journalKey(row.provider, row.kind, row.orderNumber)
  const eventId = key.slice(row.provider.length + 1)
  return (await tx.run(sql`INSERT INTO payment_events
      (provider, event_id, event_key, type, order_id, signature_verified, body_sha256, status, received_at, updated_at, created_at)
    VALUES (${row.provider}, ${eventId}, ${key}, ${TYPE[row.kind]}, ${row.orderId}, 0, ${sha256Hex(key)}, 'received', ${row.now}, ${row.now}, ${row.now})
    ON CONFLICT(event_key) DO UPDATE SET status = 'received', failure_code = NULL, processed_at = NULL,
      received_at = excluded.received_at, updated_at = excluded.updated_at
    WHERE ${retakeError ? 1 : 0} = 1 AND payment_events.status = 'error'`)) === 1
}

export async function setJournal(tx: PaymentTx, key: string, status: 'received' | 'processed' | 'error', now: string, failureCode: string | null): Promise<number> {
  return tx.run(sql`UPDATE payment_events SET status = ${status}, failure_code = ${failureCode},
      processed_at = ${status === 'received' ? null : now}, updated_at = ${now}
    WHERE event_key = ${key} AND status <> 'processed'`)
}
