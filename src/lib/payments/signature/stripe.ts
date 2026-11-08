import { hmacSha256Hex, safeEqualHex } from './compare'

/**
 * Stripe webhook signature (Stripe-Signature header): `t=<unix>,v1=<hex>[,v1=<hex>][,v0=...]`.
 * expected = HMAC-SHA256(secret, `${t}.${rawBody}`) as hex; any v1 entry may match (secret rotation).
 * Replay protection: |now − t| must be within the tolerance (default 300 s, Stripe's default).
 * Source: https://docs.stripe.com/webhooks/signature
 */

export const STRIPE_DEFAULT_TOLERANCE_SEC = 300

export type StripeSignatureResult =
  | { ok: true; timestamp: number }
  | { ok: false; reason: 'missing_signature' | 'malformed' | 'invalid_signature' | 'timestamp_out_of_tolerance' }

export function parseStripeSignatureHeader(header: string): { timestamp: number; v1: string[] } | null {
  let timestamp: number | null = null
  const v1: string[] = []
  for (const part of header.split(',')) {
    const eq = part.indexOf('=')
    if (eq <= 0) continue
    const key = part.slice(0, eq).trim()
    const value = part.slice(eq + 1).trim()
    if (key === 't') {
      if (timestamp !== null || !/^\d{1,12}$/.test(value)) return null
      timestamp = Number(value)
    } else if (key === 'v1' && value) {
      v1.push(value)
    }
  }
  if (timestamp === null || v1.length === 0) return null
  return { timestamp, v1 }
}

export function computeStripeSignature(rawBody: string, secret: string, timestamp: number): string {
  return hmacSha256Hex(secret, `${timestamp}.${rawBody}`)
}

export function verifyStripeSignature(input: {
  rawBody: string
  header: string | null | undefined
  secret: string
  now: Date
  toleranceSec?: number
}): StripeSignatureResult {
  if (!input.header) return { ok: false, reason: 'missing_signature' }
  const parsed = parseStripeSignatureHeader(input.header)
  if (!parsed) return { ok: false, reason: 'malformed' }
  const expected = computeStripeSignature(input.rawBody, input.secret, parsed.timestamp)
  // Check every v1 candidate without early exit on the comparison itself.
  let matched = false
  for (const candidate of parsed.v1) {
    if (safeEqualHex(expected, candidate)) matched = true
  }
  if (!matched) return { ok: false, reason: 'invalid_signature' }
  const tolerance = input.toleranceSec ?? STRIPE_DEFAULT_TOLERANCE_SEC
  const nowSec = Math.floor(input.now.getTime() / 1000)
  if (!Number.isFinite(nowSec) || !Number.isFinite(tolerance) || tolerance < 0 || Math.abs(nowSec - parsed.timestamp) > tolerance) return { ok: false, reason: 'timestamp_out_of_tolerance' }
  return { ok: true, timestamp: parsed.timestamp }
}
