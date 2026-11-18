import { canonicalResponse } from '../crypto/canonical'
import type { Ed25519Signer } from '../crypto/keys'

export const errorStatuses = {
  bad_request: 400, clock_skew: 400, invalid_signature: 401, invalid_license: 401,
  license_suspended: 403, license_revoked: 403, license_expired: 403, license_not_started: 403,
  activation_revoked: 403, blocked: 403, seat_limit: 409, rebind_limit: 409,
  rate_limited: 429, unavailable: 503, internal: 500,
  invalid_token: 401, download_unavailable: 403, range_not_satisfiable: 416,
} as const

export type ErrorCode = keyof typeof errorStatuses
export type Result = {
  status: number
  body: Record<string, unknown>
  retryAfter?: number
  /** Internal only: the presented key and product code matched no eligible license (§3.7 invalid-license rule). */
  unknownLicense?: true
}

export const unixSeconds = (now: Date) => Math.floor(now.getTime() / 1000)

export function failure(code: ErrorCode, now: Date, options: {
  retryAfter?: number; seats?: { used: number; max: number }
} = {}): Result {
  const { retryAfter, seats } = options
  return {
    status: errorStatuses[code],
    body: { error: { code, ...(retryAfter === undefined ? {} : { retryAfter }) }, serverTime: unixSeconds(now), ...seats },
    retryAfter,
  }
}

export function respond({ status, body, retryAfter }: Result, now: Date, nonce?: string, signer?: Ed25519Signer | null): Response {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex',
    Date: now.toUTCString(),
  })
  const json = JSON.stringify(body)
  if (signer) {
    headers.set('SM-Key-Id', signer.kid)
    headers.set('SM-Response-Signature', signer.sign(canonicalResponse({
      status, nonce, body: Buffer.from(json),
    })).toString('base64url'))
  }
  if (retryAfter !== undefined) headers.set('Retry-After', String(retryAfter))
  return new Response(json, { status, headers })
}
