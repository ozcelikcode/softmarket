// Public metadata path. This module does not load signing secrets or read the vault.
import type { Payload } from 'payload'

import { respond } from './api/respond'
import { clientNetwork, runtimeFor, trafficRejection } from './api/runtime'

import { canVerifyWithKey, validSigningKeyRows, type SigningKeyMetadata } from './crypto/keys'

export function publicSigningKeys(rows: readonly SigningKeyMetadata[], now: number) {
  const keys: { kid: string; alg: 'EdDSA'; x: string }[] = []
  if (!validSigningKeyRows(rows)) throw new Error('invalid_signing_metadata')
  const revokedKids: string[] = []
  for (const row of rows) {
    if (row.revokedAt != null) revokedKids.push(row.kid)
    else if (canVerifyWithKey(row, now)) keys.push({ kid: row.kid, alg: 'EdDSA', x: row.publicKey })
  }
  return { keys, revokedKids }
}

export async function licensingKeysResponse(loadPayload: () => Promise<Payload>, now = new Date(), request?: Request): Promise<Response> {
  const headers = { 'X-Robots-Tag': 'noindex', Date: now.toUTCString() }
  try {
    const payload = await loadPayload()
    const settings = await payload.findGlobal({
      slug: 'licensing-settings',
      depth: 0,
      overrideAccess: true,
      select: { apiEnabled: true, signingKeys: true, limits: true },
    })
    if (settings.apiEnabled === true) {
      if (request) {
        const rejected = await trafficRejection(runtimeFor(payload), settings.limits, clientNetwork(request.headers, now), now)
        if (rejected) return respond(rejected, now)
      }
      const body = publicSigningKeys(settings.signingKeys ?? [], now.getTime())
      // Keep publishing revocation notices even if the last key was revoked.
      if (body.keys.length || body.revokedKids.length) {
        return Response.json(body, { headers: { ...headers, 'Cache-Control': 'public, max-age=3600' } })
      }
    }
  } catch {
    // Configuration and storage failures share the same sanitized response.
  }
  const body = { error: { code: 'unavailable' }, serverTime: Math.floor(now.getTime() / 1000) }
  return Response.json(body, { status: 503, headers: { ...headers, 'Cache-Control': 'no-store' } })
}
