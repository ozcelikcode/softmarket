import { generateKeyPairSync, randomBytes, sign, verify } from 'node:crypto'

import { canonicalRequest, canonicalResponse } from '@/lib/licensing/crypto/canonical'
import { importEd25519PublicKey } from '@/lib/licensing/crypto/keys'
import type { LeaseClaims } from '@/lib/licensing/crypto/jws'

export const DEVICE_IP = '203.0.113.73'
export const PROXY_SECRET = 'licensing-test-proxy-secret-32-bytes'
export const ISSUER = 'https://licensing.example.test'
export const PRODUCT = 'studio-pro'

export const randomToken = (size = 16) => randomBytes(size).toString('base64url')

export function makeDevice(fingerprint = randomToken(32)) {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  return { privateKey, fingerprint, publicKey: publicKey.export({ format: 'jwk' }).x! }
}
export type TestDevice = ReturnType<typeof makeDevice>
export const activateBody = (licenseKey: string, device: TestDevice) => ({
  licenseKey, productCode: PRODUCT, fingerprint: device.fingerprint, devicePublicKey: device.publicKey,
  platform: 'linux', arch: 'x86_64', appVersion: '1.0.0',
})
export const validateBody = (ctr: string, device: TestDevice) => ({ ctr, fingerprint: device.fingerprint, appVersion: '1.0.1' })

export function signedRequest(
  endpoint: string, body: object | string, device: TestDevice,
  options: { activation?: string; nonce?: string; timestamp?: number; ip?: string; origin?: string; headers?: Record<string, string> } = {},
) {
  const nonce = options.nonce ?? randomToken()
  const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000)
  const activation = options.activation ?? '-'
  const raw = typeof body === 'string' ? body : JSON.stringify(body)
  const path = `/api/v1/licensing/${endpoint}`
  const canonical = canonicalRequest({ method: 'POST', path, timestamp, nonce, activation, body: Buffer.from(raw) })
  return {
    nonce,
    request: new Request(`${options.origin ?? ISSUER}${path}`, {
      method: 'POST',
      body: raw,
      headers: {
        'Content-Type': 'application/json',
        'SM-Activation': activation, 'SM-Timestamp': String(timestamp), 'SM-Nonce': nonce,
        'SM-Signature': sign(null, canonical, device.privateKey).toString('base64url'),
        'X-Softmarket-Proxy-Secret': PROXY_SECRET, 'X-Softmarket-Client-IP': options.ip ?? DEVICE_IP,
        ...options.headers,
      },
    }),
  }
}

export function verifyResponse(status: number, body: string, signature: string, nonce: string, key: string): boolean {
  return verify(null, canonicalResponse({ status, nonce, body: Buffer.from(body) }),
    importEd25519PublicKey(key)!, Buffer.from(signature, 'base64url'))
}

export const leasePayload = (token: string): LeaseClaims =>
  JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as LeaseClaims

export async function enableLicensingFixture(payload: import('payload').Payload, product: number) {
  const { sql } = await import('@payloadcms/db-sqlite')
  await payload.db.drizzle.run(sql`UPDATE products SET licensing_enabled = 1, licensing_code = ${PRODUCT} WHERE id = ${product}`)
  const settings = await payload.updateGlobal({ slug: 'licensing-settings', data: {
    apiEnabled: true, publicHost: new URL(ISSUER).hostname, countrySource: 'cloudflare_header',
    limits: { ipPrefixPerMinute: 1000, globalPerSecond: 10000, activationsPerLicensePerDay: 100, requestsPerActivationPerHour: 100 },
  } })
  return settings
}
