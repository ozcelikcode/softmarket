import { createHash, randomBytes } from 'node:crypto'

import type { ProviderId } from './types'

/**
 * Idempotency helpers (pure). Real collections (`orders`, `payment-events`) arrive in P2-S;
 * the persistence contract is described by the interfaces at the bottom of this file.
 */

const sha256Hex = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex')

/** One-time checkout form nonce (≥128 bit, base64url). Generated server-side when rendering the form. */
export function createCheckoutNonce(): string {
  return randomBytes(18).toString('base64url')
}

const NONCE_RE = /^[A-Za-z0-9_-]{22,64}$/

/**
 * Order idempotency key = sha256(customer + nonce). A double submit of the same form yields the
 * same key → unique index returns the existing order. Also sent as Stripe `Idempotency-Key`.
 * Returns null for malformed input (caller rejects the submit).
 */
export function orderIdempotencyKey(customerId: string | number, nonce: string): string | null {
  const customer = String(customerId)
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(customer) || !NONCE_RE.test(nonce)) return null
  return sha256Hex(`order:v1:${customer}:${nonce}`)
}

/** Derived per-operation key, e.g. refund of an order (stable across retries of the same admin action). */
export function operationIdempotencyKey(operation: 'refund' | 'cancel', orderNumber: string): string {
  return sha256Hex(`${operation}:v1:${orderNumber}`)
}

/** Unique (provider, eventId) identity for the payment-events dedupe index. */
export function paymentEventKey(provider: ProviderId, eventId: string): string | null {
  if (!/^[A-Za-z0-9_.:-]{1,255}$/.test(eventId)) return null
  return `${provider}:${eventId}`
}

/**
 * iyzico notifications have no stable event id across retries; the plan dedupes on
 * (eventType, paymentId|token, status). Hashed to a fixed-length id.
 */
export function iyzicoEventId(fields: { eventType: string; paymentRef: string; status: string }): string {
  return `iyz_${sha256Hex(`${fields.eventType}|${fields.paymentRef}|${fields.status}`).slice(0, 40)}`
}

// Order number ----------------------------------------------------------------------------------

/** Crockford base32 without I, L, O, U — unambiguous when read aloud or typed. */
const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export const ORDER_NUMBER_RE = /^SM-\d{6}-[0-9A-HJKMNP-TV-Z]{6}$/

/** `SM-YYMMDD-XXXXXX` (UTC date + 30 bits CSPRNG). Not sequential, so volume is not leaked. Unique index catches collisions. */
export function generateOrderNumber(now: Date, random: (n: number) => Buffer = randomBytes): string {
  const yy = String(now.getUTCFullYear() % 100).padStart(2, '0')
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(now.getUTCDate()).padStart(2, '0')
  const bytes = random(6)
  let suffix = ''
  for (let i = 0; i < 6; i++) suffix += BASE32[bytes[i]! & 31]
  return `SM-${yy}${mm}${dd}-${suffix}`
}

// Licence issuance (exactly once) ---------------------------------------------------------------

export type FulfillmentOrderView = {
  status: 'pending' | 'paid' | 'fulfilled' | 'failed' | 'refunded' | 'cancelled'
  requiresReview: boolean
  items: { id: string; licenseId: string | number | null | undefined }[]
}

export type FulfillmentPlan =
  | { action: 'none'; reason: 'not_paid' | 'requires_review' | 'already_fulfilled' }
  | { action: 'issue'; itemIds: string[]; thenTransition: 'paid->fulfilled' }
  | { action: 'transition_only'; thenTransition: 'paid->fulfilled' }

/**
 * Pure decision for fulfillOrder(). Licences are issued only for a verified `paid` order not under
 * review, and only for items that do not already have a licence. A second call after commit sees
 * every item filled and becomes a pure state transition (or no-op once fulfilled).
 */
export function planFulfillment(order: FulfillmentOrderView): FulfillmentPlan {
  if (order.status === 'fulfilled') return { action: 'none', reason: 'already_fulfilled' }
  if (order.status !== 'paid') return { action: 'none', reason: 'not_paid' }
  if (order.requiresReview) return { action: 'none', reason: 'requires_review' }
  const itemIds = order.items.filter((item) => item.licenseId === null || item.licenseId === undefined).map((item) => item.id)
  if (itemIds.length === 0) return { action: 'transition_only', thenTransition: 'paid->fulfilled' }
  return { action: 'issue', itemIds, thenTransition: 'paid->fulfilled' }
}

/**
 * Persistence contract for P2-S/P4 (implemented over Payload + SQLite transactions).
 * planFulfillment alone is not a concurrency guarantee. All reads and writes MUST run on the
 * same connection inside ONE SQLite transaction acquired with BEGIN IMMEDIATE before reading:
 * Any error, false setItemLicense, or transitionStatus count other than 1 MUST roll back the
 * entire transaction, including issued licences. Side effects run only after commit.
 *   1. loadForUpdate → planFulfillment
 *   2. for each item: issueLicense (licenses.create, overrideAccess) then setItemLicense only if still empty
 *   3. transitionStatus(from 'paid' to 'fulfilled') — conditional update; 0 rows → rollback/no-op
 */
export interface FulfillmentStore {
  loadForUpdate(orderId: string): Promise<FulfillmentOrderView | null>
  issueLicense(orderId: string, itemId: string): Promise<string | number>
  /** Must only write when the item's licence is still empty; returns false otherwise. */
  setItemLicense(orderId: string, itemId: string, licenseId: string | number): Promise<boolean>
  /** Conditional `update where { id, status: { equals: from } }`; returns affected row count. */
  transitionStatus(orderId: string, from: FulfillmentOrderView['status'], to: FulfillmentOrderView['status']): Promise<number>
}

/** Dedupe contract for payment-events (unique provider+eventId). `record` returns false on duplicate. */
export interface PaymentEventStore {
  record(event: { key: string; provider: ProviderId; type: string; bodySha256: string; receivedAt: Date }): Promise<boolean>
}

export function bodySha256(rawBody: string): string {
  return sha256Hex(rawBody)
}
