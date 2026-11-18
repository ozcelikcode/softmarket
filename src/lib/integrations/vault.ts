import { createLocalReq, type Payload, type PayloadRequest } from 'payload'

import type { SecretValue } from '@/lib/payments/secret'
import { decryptSecret, encryptSecret, readSecretsKey, recordKid, SecretsError, type SecretsKey } from '@/lib/secrets/crypto'
import { isSecretId, SECRET_IDS, type SecretId, type SecretStatus } from './ids'

/*
 * Server-only access to `integrations.secrets` (JSON column, field access read/create/update = nobody).
 * Records hold AES-GCM ciphertext and display metadata. SMTP and licensing keys have no last-four display.
 */

export const INTEGRATIONS_SLUG = 'integrations'
// This id is deliberately outside the integration form, status listing and HTTP write allowlist.
export const LICENSING_SIGNING_SECRET_ID = 'licensing-signing-ed25519'
type VaultId = SecretId | typeof LICENSING_SIGNING_SECRET_ID

export type VaultEntry = { enc: string; kid: string; last4: string | null; updatedAt: string }
export type Vault = Partial<Record<VaultId, VaultEntry>>

const isEntry = (value: unknown): value is VaultEntry =>
  !!value && typeof value === 'object' && typeof (value as VaultEntry).enc === 'string' && typeof (value as VaultEntry).updatedAt === 'string'

/** Normalises a stored vault: unknown ids and malformed entries are dropped (fail-closed). */
export function parseVault(raw: unknown): Vault {
  let value = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return {}
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Vault = {}
  for (const [id, entry] of Object.entries(value)) {
    if ((isSecretId(id) || id === LICENSING_SIGNING_SECRET_ID) && isEntry(entry)) out[id] = entry
  }
  return out
}

/**
 * Extra authenticated data per secret. The SMTP password is cryptographically bound to the saved SMTP host and user:
 * pointing the panel at another server (even with a hijacked admin session) makes the stored password undecryptable,
 * so it can never be sent to a server it was not entered for. It must be re-entered after such a change.
 */
export function secretBinding(id: VaultId, doc: unknown): string {
  if (id !== 'smtp.password') return id
  const smtp = doc && typeof doc === 'object' ? (doc as { smtp?: { host?: unknown; user?: unknown } }).smtp : undefined
  const host = typeof smtp?.host === 'string' ? smtp.host.trim().toLowerCase() : ''
  const user = typeof smtp?.user === 'string' ? smtp.user.trim() : ''
  return `${id}@${host}|${user}`
}

/** Raw integrations document (non-secret settings + vault). Throws on read errors; callers decide fail-closed. */
export async function readIntegrationsDoc(payload: Payload, req?: Partial<PayloadRequest>): Promise<Record<string, unknown>> {
  return (await payload.findGlobal({ slug: INTEGRATIONS_SLUG as never, depth: 0, overrideAccess: true, ...(req ? { req } : {}) })) as unknown as Record<string, unknown>
}

/** Display status. `unreadable`: wrong/missing key, tampered record or (SMTP) changed host/user. Never the value. */
export function secretStatus(doc: unknown, id: SecretId, key: SecretsKey | null = readSecretsKey()): SecretStatus {
  const vault = parseVault((doc as { secrets?: unknown } | null)?.secrets)
  const entry = vault[id]
  if (!entry) return { defined: false, last4: null, updatedAt: null }
  let readable = Boolean(key && recordKid(entry.enc) === key.kid)
  let last4: string | null = null
  if (readable) {
    try {
      const value = decryptSecret(entry.enc, secretBinding(id, doc), key).reveal()
      if (id !== 'smtp.password' && value.length >= 12) last4 = value.slice(-4)
    } catch {
      readable = false
    }
  }
  return { defined: true, last4, updatedAt: entry.updatedAt, ...(readable ? {} : { unreadable: true }) }
}

export function allSecretStatus(doc: unknown): Record<SecretId, SecretStatus> {
  const key = readSecretsKey()
  return Object.fromEntries(SECRET_IDS.map((id) => [id, secretStatus(doc, id, key)])) as Record<SecretId, SecretStatus>
}

/** Decrypts one secret of `doc`; undefined when absent. Wrong key / tampered / rebound → undefined + `onError(code)`. */
export function openSecret<Id extends VaultId>(doc: unknown, id: Id, key: SecretsKey | null, onError?: (id: Id, code: string) => void): SecretValue | undefined {
  const entry = parseVault((doc as { secrets?: unknown } | null)?.secrets)[id]
  if (!entry) return undefined
  try {
    return decryptSecret(entry.enc, secretBinding(id, doc), key)
  } catch (error) {
    onError?.(id, error instanceof SecretsError ? error.code : 'malformed')
    return undefined
  }
}

/** Replace the encrypted records using the caller's transaction. */
export async function persistVault(req: PayloadRequest, vault: Vault): Promise<void> {
  await req.payload.updateGlobal({ slug: INTEGRATIONS_SLUG, overrideAccess: true, depth: 0, req, data: { secrets: vault }, context: { integrationsSecretWrite: true } })
}

export type WriteSecretResult = { code: 'ok'; status: SecretStatus } | { code: 'no_key' | 'smtp_host_required' }

/**
 * Sets (value) or clears (null) one secret. The plaintext only exists in this call frame; the stored record is the
 * ciphertext. The read and update share a serialized transaction (admin-only, rare writes).
 */
export async function writeSecret(payload: Payload, id: SecretId, value: string | null, now = new Date()): Promise<WriteSecretResult> {
  const key = readSecretsKey()
  if (value !== null && !key) return { code: 'no_key' }
  const req = await createLocalReq({}, payload)
  const transactionID = await payload.db.beginTransaction()
  if (transactionID == null) throw new Error('integrations: transaction unavailable')
  req.transactionID = transactionID
  try {
    const doc = await readIntegrationsDoc(payload, req)
    const vault = parseVault(doc.secrets)
    if (value === null) delete vault[id]
    else {
      if (id === 'smtp.password' && !(doc.smtp as { host?: unknown } | undefined)?.host) {
        await payload.db.rollbackTransaction(transactionID)
        return { code: 'smtp_host_required' }
      }
      const plain = value.trim()
      vault[id] = { enc: encryptSecret(plain, secretBinding(id, doc), key), kid: key!.kid, last4: id === 'smtp.password' || plain.length < 12 ? null : plain.slice(-4), updatedAt: now.toISOString() }
    }
    await persistVault(req, vault)
    await payload.db.commitTransaction(transactionID)
    return { code: 'ok', status: secretStatus({ ...doc, secrets: vault }, id, key) }
  } catch (error) {
    await payload.db.rollbackTransaction(transactionID).catch(() => undefined)
    throw error
  }
}
