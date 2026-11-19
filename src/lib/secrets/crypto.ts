import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto'

import { SecretValue } from '@/lib/payments/secret'

/*
 * At-rest encryption for secrets entered in the admin panel (integrations global). SERVER ONLY.
 *
 *   key material  SOFTMARKET_SECRETS_KEY (env, >= 32 random bytes as base64/base64url/hex; `openssl rand -base64 32`)
 *   AES key       HKDF-SHA256(ikm = key material, salt = "softmarket/secrets", info = "aes-256-gcm/v1") → 32 bytes
 *   key id (kid)  first 12 hex chars of HKDF(..., info = "kid/v1"): identifies the key without revealing it
 *   record        "sm1.<kid>.<iv b64url (12 B)>.<ciphertext b64url>.<tag b64url (16 B)>"
 *   AAD           "softmarket:integrations:<secret id>": a ciphertext cannot be moved to another field
 *
 * Deliberately NOT derived from PAYLOAD_SECRET: that value signs sessions and is rotated for session reasons; rotating
 * it must never make stored provider keys unreadable, and a leaked session secret must not also open the vault. No
 * key → encryption is refused (fail-closed). Errors carry fixed codes only, never key material or plaintext.
 * The kid allows a later rotation (decrypt with the old key, re-encrypt with the new one); v1 accepts one key.
 */

export const SECRETS_KEY_ENV = 'SOFTMARKET_SECRETS_KEY'
const FORMAT = 'sm1'
const IV_BYTES = 12
const TAG_BYTES = 16
const MIN_KEY_BYTES = 32

export type SecretsErrorCode = 'no_key' | 'wrong_key' | 'tampered' | 'malformed'
export class SecretsError extends Error {
  readonly code: SecretsErrorCode
  constructor(code: SecretsErrorCode) {
    super(`secrets: ${code}`)
    this.name = 'SecretsError'
    this.code = code
  }
}

export type SecretsKey = { readonly kid: string; readonly key: Buffer }

/** Decodes the env key material: 64 hex chars, or base64/base64url of at least 32 bytes. Anything else = no key. */
function decodeKeyMaterial(raw: string): Buffer | null {
  const value = raw.trim()
  if (!value || value.startsWith('CHANGE_')) return null
  if (/^[0-9a-fA-F]{64,}$/.test(value) && value.length % 2 === 0) return Buffer.from(value, 'hex')
  if (/^[A-Za-z0-9+/_-]+={0,2}$/.test(value)) {
    const bytes = Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '')
    if (bytes.length >= MIN_KEY_BYTES && bytes.toString('base64').replace(/=+$/, '') === normalized) return bytes
    bytes.fill(0)
  }
  return null
}

const hkdf = (ikm: Buffer, info: string) => Buffer.from(hkdfSync('sha256', ikm, 'softmarket/secrets', info, 32))

/** The configured key, or null (missing, placeholder, too short). Never throws, never logs. */
export function readSecretsKey(env: Record<string, string | undefined> = process.env): SecretsKey | null {
  const material = decodeKeyMaterial(env[SECRETS_KEY_ENV] ?? '')
  if (!material) return null
  try {
    return { key: hkdf(material, 'aes-256-gcm/v1'), kid: hkdf(material, 'kid/v1').toString('hex').slice(0, 12) }
  } finally {
    material.fill(0)
  }
}

/** Derive a licensing key from the master material using a purpose distinct from vault encryption. */
export function deriveLicensingKey(info: `licensing/${string}`, env: Record<string, string | undefined> = process.env): Buffer | null {
  const material = decodeKeyMaterial(env[SECRETS_KEY_ENV] ?? '')
  if (!material) return null
  try {
    return hkdf(material, info)
  } finally {
    material.fill(0)
  }
}

export const secretAad = (id: string) => Buffer.from(`softmarket:integrations:${id}`, 'utf8')

export function encryptSecret(plaintext: string, id: string, key: SecretsKey | null): string {
  if (!key) throw new SecretsError('no_key')
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key.key, iv, { authTagLength: TAG_BYTES })
  cipher.setAAD(secretAad(id))
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return [FORMAT, key.kid, iv.toString('base64url'), ciphertext.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.')
}

/** Key id of a stored record (or null when malformed). */
export function recordKid(record: unknown): string | null {
  if (typeof record !== 'string') return null
  const parts = record.split('.')
  return parts.length === 5 && parts[0] === FORMAT ? parts[1]! : null
}

export function decryptSecret(record: unknown, id: string, key: SecretsKey | null): SecretValue {
  if (!key) throw new SecretsError('no_key')
  if (typeof record !== 'string') throw new SecretsError('malformed')
  const parts = record.split('.')
  if (parts.length !== 5 || parts[0] !== FORMAT) throw new SecretsError('malformed')
  const [, kid, ivText, ctText, tagText] = parts as [string, string, string, string, string]
  const sameKid = /^[0-9a-f]{12}$/.test(kid) && timingSafeEqual(Buffer.from(kid), Buffer.from(key.kid))
  if (!sameKid) throw new SecretsError('wrong_key')
  const iv = Buffer.from(ivText, 'base64url')
  const tag = Buffer.from(tagText, 'base64url')
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw new SecretsError('malformed')
  try {
    const decipher = createDecipheriv('aes-256-gcm', key.key, iv, { authTagLength: TAG_BYTES })
    decipher.setAAD(secretAad(id))
    decipher.setAuthTag(tag)
    return new SecretValue(Buffer.concat([decipher.update(Buffer.from(ctText, 'base64url')), decipher.final()]).toString('utf8'))
  } catch {
    throw new SecretsError('tampered')
  }
}

/** Short non-reversible fingerprint (cache keys): never the secret itself. */
export const fingerprint = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 16)
