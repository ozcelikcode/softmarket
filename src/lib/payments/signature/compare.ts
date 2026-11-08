import { createHmac, timingSafeEqual } from 'node:crypto'

export function hmacSha256Hex(key: string, message: string): string {
  return createHmac('sha256', key).update(message, 'utf8').digest('hex')
}

/**
 * Timing-safe comparison of two hex digests. Length mismatch or non-hex input → false
 * (lengths are public: always 64 hex chars for SHA-256).
 */
export function safeEqualHex(expectedHex: string, receivedHex: string): boolean {
  if (typeof receivedHex !== 'string' || !/^[0-9a-f]+$/i.test(receivedHex)) return false
  if (expectedHex.length !== receivedHex.length || expectedHex.length % 2 !== 0) return false
  const a = Buffer.from(expectedHex.toLowerCase(), 'hex')
  const b = Buffer.from(receivedHex.toLowerCase(), 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}
