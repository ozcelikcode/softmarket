import { createHash, createPublicKey, verify } from 'node:crypto'

export type Pin = { kid: string; publicKey: string; retiredAt?: string | null; revokedAt?: string | null }
export type Trust = { keys: readonly Pin[]; revokedKids?: readonly string[] }
type Identity = { iss: string; aud: string; sub: string; lid?: string; fp: string; dkt: string }
export type LeaseClaims = Required<Identity> & {
  sku: string; seats: number; iat: number; nbf: number; exp: number; rfa: number
  lexp: string | null; ctr: string; st: 'active'; v: 1
}

const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
const day = 86400
const requestPaths = new Set(['activate', 'validate', 'deactivate', 'updates', 'downloads/link']
  .map((operation) => '/api/v1/licensing/' + operation))
const kidPattern = /^[A-Za-z0-9_-]{1,64}$/
const activationPattern = /^act_[0-9a-f]{24}$/
const licensePattern = /^lic_[0-9a-f]{24}$/
const coordinateMask = (1n << 255n) - 1n
const prime = coordinateMask - 18n
const smallOrderY = new Set([
  0n, 1n, prime - 1n,
  2707385501144840649318225287225658788936804267575313519463743609750303402022n,
  55188659117513257062467267217118295137698188065244968500265048394206261417927n,
])
const time = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 253402300799
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes)

function decode(value: unknown, length?: number): Buffer | null {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) return null
  const bytes = Buffer.from(value, 'base64url')
  return (length === undefined || bytes.length === length) && bytes.toString('base64url') === value ? bytes : null
}

export function thumbprint(rawPublicKey: Uint8Array): string {
  if (rawPublicKey.length !== 32) throw new Error('Expected a raw 32-byte public key')
  return sha256(rawPublicKey).digest('base64url')
}

export function requestSigningBytes(path: string, timestamp: number, nonce: string, activation: string, body: Uint8Array) {
  if (!requestPaths.has(path)
    || !Number.isSafeInteger(timestamp) || timestamp < 0 || Object.is(timestamp, -0) || !decode(nonce, 16)
    || (path.endsWith('/activate') ? activation !== '-' : !activationPattern.test(activation) || activation.length !== 28)
    || body.byteLength > 8192) throw new Error('Invalid licensing request signing input')
  return Buffer.from(['SM1-REQ', 'POST', path, timestamp, nonce, activation, sha256(body).digest('hex')].join('\n'))
}

function pinFor(trust: Trust, kid: string, now: number): Pin | undefined {
  if (!time(now) || !kidPattern.test(kid) || trust.revokedKids?.includes(kid)) return
  const matches = trust.keys.filter((key) => key.kid === kid)
  if (matches.length !== 1) return
  const pin = matches[0]!
  const publicKey = decode(pin.publicKey, 32)
  if (!publicKey || thumbprint(publicKey) !== kid || pin.revokedAt != null) return
  // Ed25519 stores the y-coordinate as little-endian with the x sign in the top bit.
  const y = BigInt('0x' + Buffer.from(publicKey).reverse().toString('hex')) & coordinateMask
  if (y >= prime || smallOrderY.has(y)) return
  if (pin.retiredAt != null && !(now * 1000 < Date.parse(pin.retiredAt) + 90 * day * 1000)) return
  return pin
}

function verifyPinned(pin: Pin, input: Uint8Array, signature: Buffer): boolean {
  try {
    const key = createPublicKey({ format: 'jwk', key: { kty: 'OKP', crv: 'Ed25519', x: pin.publicKey } })
    return verify(null, input, key, signature)
  } catch {
    return false
  }
}

// Capture body bytes after HTTP decompression and before JSON parsing.
export function verifyResponse(input: {
  status: number; nonce: string; keyId: string | null; signature: string | null; body: Uint8Array
}, trust: Trust, now: number): boolean {
  const { status, nonce, keyId, signature, body } = input
  if (!Number.isInteger(status) || status < 100 || status > 599 || !decode(nonce, 16) || !keyId) return false
  const pin = pinFor(trust, keyId, now)
  const sig = decode(signature, 64)
  const canonical = Buffer.from(['SM1-RES', status, nonce, sha256(body).digest('hex')].join('\n'))
  return !!pin && !!sig && verifyPinned(pin, canonical, sig)
}

function compactObject(bytes: Buffer): Record<string, unknown> | null {
  const source = utf8.decode(bytes)
  const value: unknown = JSON.parse(source)
  if (!value || typeof value !== 'object' || Array.isArray(value) || JSON.stringify(value) !== source) return null
  return value as Record<string, unknown>
}

function validClaims(value: Record<string, unknown>): value is LeaseClaims {
  const { iss, aud, sub, lid, sku, seats, fp, dkt, iat, nbf, exp, rfa, lexp, ctr, st, v } = value
  if (Object.keys(value).length !== 16 || v !== 1 || st !== 'active'
    || typeof iss !== 'string' || new URL(iss).protocol !== 'https:' || new URL(iss).origin !== iss
    || typeof aud !== 'string' || !/^[a-z0-9][a-z0-9-]{2,40}$(?![\s\S])/.test(aud)
    || typeof sub !== 'string' || sub.length !== 28 || !activationPattern.test(sub)
    || typeof lid !== 'string' || lid.length !== 28 || !licensePattern.test(lid)
    || typeof sku !== 'string' || !sku || typeof seats !== 'number' || !Number.isSafeInteger(seats) || seats < 1
    || !decode(fp, 32) || !decode(dkt, 32) || !decode(ctr, 16)
    || !time(iat) || !time(nbf) || !time(exp) || !time(rfa) || nbf !== iat
    || exp <= iat || exp - iat > 30 * day || rfa - iat < 3600 || rfa - iat > 168 * 3600 || (rfa - iat) % 3600 !== 0) return false
  return lexp === null || (typeof lexp === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(lexp)
    && exp <= Math.floor(Date.parse(lexp) / 1000))
}

// Omit expected.lid only when enrolling from an already authenticated activation response.
export function verifyLease(token: string, trust: Trust, expected: Identity, now: number): LeaseClaims | null {
  if (typeof token !== 'string' || token.length > 4096 || !time(now)) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, payload, signature] = parts.map((part) => decode(part))
  if (!header || !payload || !signature || signature.length !== 64) return null
  try {
    const protectedHeader = compactObject(header)
    if (!protectedHeader || Object.keys(protectedHeader).length !== 3
      || protectedHeader.alg !== 'EdDSA' || protectedHeader.typ !== 'sm-lease+jwt'
      || typeof protectedHeader.kid !== 'string') return null
    const pin = pinFor(trust, protectedHeader.kid, now)
    if (!pin || !verifyPinned(pin, Buffer.from(parts.slice(0, 2).join('.'), 'ascii'), signature)) return null
    const claims = compactObject(payload)
    if (!claims || !validClaims(claims) || now < claims.nbf || now >= claims.exp
      || (pin.retiredAt != null && claims.iat * 1000 > Date.parse(pin.retiredAt))) return null
    if (claims.iss !== expected.iss || claims.aud !== expected.aud || claims.sub !== expected.sub
      || (expected.lid !== undefined && claims.lid !== expected.lid) || claims.fp !== expected.fp || claims.dkt !== expected.dkt) return null
    return claims
  } catch {
    return null
  }
}
