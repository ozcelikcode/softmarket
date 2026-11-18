// Server only. This module works with Node KeyObjects and does not read configuration or storage.
import { createHash, createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto'

export const SIGNING_KEY_OVERLAP_MS = 90 * 24 * 60 * 60 * 1000
export const KEY_ID_RE = /^[A-Za-z0-9_-]{1,64}$/

export type SigningKeyMetadata = {
  kid: string
  publicKey: string
  retiredAt?: string | null
  revokedAt?: string | null
}

export type Ed25519Signer = { readonly kid: string; sign(input: Uint8Array): Buffer }

export function decodeBase64Url(value: string, bytes?: number): Buffer | null {
  if (typeof value !== 'string' || (bytes !== undefined && value.length !== Math.ceil(bytes * 4 / 3))) return null
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null
  const decoded = Buffer.from(value, 'base64url')
  return decoded.toString('base64url') === value ? decoded : null
}

// The compressed Edwards y-coordinate is little-endian. Ignore the x sign for the
// small-order check (libsodium ref10 ge25519_has_small_order, including both order-8 y's).
const fieldPrime = (1n << 255n) - 19n
const smallOrderY = new Set([0n, 1n, fieldPrime - 1n,
  2707385501144840649318225287225658788936804267575313519463743609750303402022n,
  55188659117513257062467267217118295137698188065244968500265048394206261417927n])

function publicKeyBytes(x: string): Buffer | null {
  const bytes = decodeBase64Url(x, 32)
  if (!bytes) return null
  const y = BigInt('0x' + Buffer.from(bytes).reverse().toString('hex')) & ((1n << 255n) - 1n)
  return y < fieldPrime && !smallOrderY.has(y) ? bytes : null
}

export function importEd25519PublicKey(x: string): KeyObject | null {
  if (!publicKeyBytes(x)) return null
  return createPublicKey({ format: 'jwk', key: { kty: 'OKP', crv: 'Ed25519', x } })
}

/** PKCS#8 PEM or unpadded base64url PKCS#8 DER. The DER round-trip rejects trailing or alternate encodings. */
export function importEd25519PrivateKey(value: string): KeyObject | null {
  if (value.length > 512) return null
  const input = value.replace(/\r\n/g, '\n').replace(/\\n/g, '\n').trim()
  const pem = /^-----BEGIN PRIVATE KEY-----\n([A-Za-z0-9+/=\n]+)\n-----END PRIVATE KEY-----$/.exec(input)
  const der = pem ? Buffer.from(pem[1]!.replaceAll('\n', ''), 'base64') : decodeBase64Url(input)
  if (!der || (pem && der.toString('base64') !== pem[1]!.replaceAll('\n', ''))) return null
  try {
    const key = createPrivateKey({ format: 'der', type: 'pkcs8', key: der })
    return key.asymmetricKeyType === 'ed25519' && der.equals(key.export({ format: 'der', type: 'pkcs8' })) ? key : null
  } catch {
    return null
  } finally {
    der.fill(0)
  }
}

export function deviceKeyThumbprint(publicKey: string): string | null {
  const bytes = publicKeyBytes(publicKey)
  return bytes && createHash('sha256').update(bytes).digest('base64url')
}

/** Validate persisted public metadata before storing, publishing or selecting a signer. */
export function validSigningKeyRows(rows: readonly unknown[]): boolean {
  const kids = new Set<string>()
  let active = 0
  for (const value of rows) {
    if (!value || typeof value !== 'object') return false
    const row = value as Partial<SigningKeyMetadata>
    if (typeof row.kid !== 'string' || typeof row.publicKey !== 'string'
      || row.kid !== deviceKeyThumbprint(row.publicKey) || kids.has(row.kid)) return false
    if (row.retiredAt == null && row.revokedAt == null) active++
    kids.add(row.kid)
  }
  return active <= 1
}

export function ed25519PublicMetadata(privateKey: KeyObject): SigningKeyMetadata {
  if (privateKey.type !== 'private' || privateKey.asymmetricKeyType !== 'ed25519') throw new Error('invalid_signing_key')
  const publicKey = createPublicKey(privateKey).export({ format: 'jwk' }).x!
  return { kid: deviceKeyThumbprint(publicKey)!, publicKey }
}

export function ed25519Signer(kid: string, privateKey: KeyObject): Ed25519Signer {
  if (kid !== ed25519PublicMetadata(privateKey).kid) {
    throw new Error('invalid_signing_key')
  }
  return { kid, sign: (input) => sign(null, input, privateKey) }
}

export function verifyEd25519(key: KeyObject, input: Uint8Array, signature: Uint8Array): boolean {
  return key.type === 'public' && key.asymmetricKeyType === 'ed25519' && signature.byteLength === 64
    && publicKeyBytes(key.export({ format: 'jwk' }).x!) !== null
    && verify(null, input, key, signature)
}

/** A retired key stops verifying at the end of the overlap. A revoked key stops immediately. */
export function canVerifyWithKey(key: SigningKeyMetadata, now: number): boolean {
  if (key.revokedAt != null) return false
  if (key.retiredAt == null) return true
  const retired = Date.parse(key.retiredAt)
  return Number.isFinite(retired) && now < retired + SIGNING_KEY_OVERLAP_MS
}
