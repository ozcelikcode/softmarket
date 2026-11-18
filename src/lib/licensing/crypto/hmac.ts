// Server only. Derivation domains are part of the licensing protocol.
import { createHmac, timingSafeEqual } from 'node:crypto'

import { deriveLicensingKey } from '@/lib/secrets/crypto'
import { decodeBase64Url } from './keys'

export type LicensingEnv = Record<string, string | undefined>

export function licensingHmacKey(
  purpose: 'fingerprint' | 'ip' | 'download',
  env: LicensingEnv = process.env,
  now = new Date(),
): Buffer | null {
  switch (purpose) {
    case 'fingerprint': return deriveLicensingKey('licensing/fp/v1', env)
    case 'ip': return deriveLicensingKey(`licensing/ip/${now.toISOString().slice(0, 7)}`, env)
    case 'download': return deriveLicensingKey('licensing/dl/v1', env)
  }
}

const digest = (key: Uint8Array, data: string | Uint8Array): Buffer => createHmac('sha256', key).update(data).digest()

export const hmacSha256 = (key: Uint8Array, data: string | Uint8Array): string => digest(key, data).toString('base64url')

export function verifyHmacSha256(key: Uint8Array, data: string | Uint8Array, tag: string): boolean {
  const supplied = decodeBase64Url(tag, 32)
  const expected = digest(key, data)
  return supplied !== null && timingSafeEqual(expected, supplied)
}

/** Storage representation for an activation's fingerprintHash (plan §4.3). */
export function hashDeviceFingerprint(fingerprint: string, env: LicensingEnv = process.env): string | null {
  const bytes = decodeBase64Url(fingerprint, 32)
  if (!bytes) return null
  const key = licensingHmacKey('fingerprint', env)
  return key ? digest(key, bytes).toString('hex') : null
}
