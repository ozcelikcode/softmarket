import { randomBytes } from 'node:crypto'
import type { Payload } from 'payload'

import { hmacSha256, verifyHmacSha256 } from '../crypto/hmac'
import type { DownloadRecord } from './download-catalog'
import { LICENSING_API_PATH } from './guard'
import { unixSeconds } from './respond'

const TTL_SECONDS = 300
const MAX_USES = 5
const CAPACITY = 65_536

type Binding = {
  activation: string; license: string; product: number; file: DownloadRecord; etag: string
}
export type DownloadGrant = Binding & { expiresAt: number; uses: number }

function createGrants() {
  const grants = new Map<string, Binding & { expiresAt: number; uses: number }>()
  let nextCleanup = 0

  function issue(key: Buffer, binding: Binding, now: Date) {
    const at = unixSeconds(now)
    if (at >= nextCleanup) {
      for (const [token, grant] of grants) if (grant.expiresAt <= at) grants.delete(token)
      nextCleanup = at + 1
    }
    if (grants.size >= CAPACITY) return null
    const expiresAt = at + TTL_SECONDS
    const encoded = Buffer.from(JSON.stringify({
      d: binding.file.id, a: binding.activation, e: expiresAt, n: randomBytes(16).toString('base64url'),
    })).toString('base64url')
    if (grants.has(encoded)) return null
    grants.set(encoded, { ...binding, expiresAt, uses: 0 })
    return { url: `${LICENSING_API_PATH}/dl/${encoded}.${hmacSha256(key, encoded)}`, expiresAt }
  }

  function find(key: Buffer, token: string, now: Date): DownloadGrant | null {
    const match = /^([A-Za-z0-9_-]{1,200})\.([A-Za-z0-9_-]{43})$/.exec(token)
    if (!match || match[0] !== token || !verifyHmacSha256(key, match[1]!, match[2]!)) return null
    const grant = grants.get(match[1]!)
    return grant && grant.expiresAt > unixSeconds(now) && grant.uses < MAX_USES ? grant : null
  }

  function admit(grant: DownloadGrant, now: Date, consume: boolean): boolean {
    if (grant.expiresAt <= unixSeconds(now) || grant.uses >= MAX_USES) return false
    if (consume) {
      // This synchronous increment is the admission point for all concurrent file responses.
      grant.uses++
    }
    return true
  }

  return { issue, find, admit }
}

const shared = globalThis as typeof globalThis & { smLicensingDownloadGrants?: WeakMap<Payload, ReturnType<typeof createGrants>> }
const registries = shared.smLicensingDownloadGrants ??= new WeakMap<Payload, ReturnType<typeof createGrants>>()

export function downloadGrants(payload: Payload) {
  let registry = registries.get(payload)
  if (!registry) {
    registry = createGrants()
    registries.set(payload, registry)
  }
  return registry
}
