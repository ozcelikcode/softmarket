import { sql } from '@payloadcms/db-sqlite'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Payload } from 'payload'

import type { PaymentTx } from '@/lib/payments/store/transaction'
import type { Endpoint, SignedHeaders } from './guard'

export function equalText(left: string, right: string | null): boolean {
  if (right === null || left.length !== right.length) return false
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export const requestDigest = (headers: SignedHeaders) => createHash('sha256').update(headers.canonical).digest('hex')

/** An independent receipt distinguishes this specific commit from a concurrent retry of the same nonce. */
export const nonceReceipt = () => randomBytes(16).toString('base64url')

export async function claimNonce(tx: PaymentTx, args: {
  endpoint: Endpoint; nonce: string; receipt: string; at: string; deactivationDigest?: string
}): Promise<boolean> {
  const { endpoint, nonce, receipt, at, deactivationDigest } = args
  const reason = deactivationDigest ?? null
  return (await tx.run(sql`INSERT INTO security_audit (action, actor_kind, reason, note, at, result, nonce)
    VALUES (${`api.${endpoint}`}, 'system', ${reason}, ${receipt}, ${at}, 'ok', ${nonce})
    ON CONFLICT (nonce) DO NOTHING`)) === 1
}

export async function isDeactivationRetry(tx: PaymentTx, headers: SignedHeaders): Promise<boolean> {
  const [row] = await tx.all<{ reason: string | null }>(sql`SELECT reason FROM security_audit
    WHERE nonce = ${headers.nonce} AND action = 'api.deactivate'`)
  return Boolean(row && equalText(requestDigest(headers), row.reason))
}

export type NonceReceipt = { nonce: string; receipt: string }

export async function confirmedNonces(payload: Payload, receipts: readonly NonceReceipt[]): Promise<boolean> {
  if (receipts.length === 0) return true
  const rows = await payload.db.drizzle.all<{ nonce: string; note: string }>(sql`
    SELECT nonce, note FROM security_audit WHERE nonce IN (${sql.join(receipts.map(({ nonce }) => sql`${nonce}`), sql`, `)})
  `)
  const confirmed = new Map(rows.map(({ nonce, note }) => [nonce, note]))
  return receipts.every(({ nonce, receipt }) => equalText(receipt, confirmed.get(nonce) ?? null))
}
