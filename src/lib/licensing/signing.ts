// Server only. The runtime exposes a signing operation while keeping the private KeyObject in a closure.
import { generateKeyPairSync } from 'node:crypto'
import type { Payload, PayloadRequest } from 'payload'

import {
  LICENSING_SIGNING_SECRET_ID, openSecret, parseVault, persistVault, readIntegrationsDoc, type VaultEntry,
} from '@/lib/integrations/vault'
import { withPaymentTransaction, type PaymentTx } from '@/lib/payments/store/transaction'
import { encryptSecret, readSecretsKey } from '@/lib/secrets/crypto'
import type { LicensingSetting } from '@/payload-types'
import {
  ed25519PublicMetadata, ed25519Signer, importEd25519PrivateKey, validSigningKeyRows, type Ed25519Signer, type SigningKeyMetadata,
} from './crypto/keys'
import type { LicensingEnv } from './crypto/hmac'

const SIGNING_KEY_ENV = 'SOFTMARKET_LICENSE_SIGNING_KEY'
type KeyRow = NonNullable<LicensingSetting['signingKeys']>[number]
type PublicKey = Pick<SigningKeyMetadata, 'kid' | 'publicKey'>

export class LicensingKeyError extends Error {
  constructor(readonly code: 'active_key_exists' | 'environment_key_configured' | 'invalid_environment_key'
    | 'key_already_registered' | 'unknown_signing_key' | 'vault_key_required' | 'vault_key_unreadable') {
    super(code)
    this.name = 'LicensingKeyError'
  }
}

function configuredEnvironmentKey(env: LicensingEnv): string | undefined {
  const value = env[SIGNING_KEY_ENV]?.trim()
  return value && !value.startsWith('CHANGE_') ? value : undefined
}

const isActive = (key: KeyRow) => key.retiredAt == null && key.revokedAt == null

async function readKeyRows(payload: Payload, req?: PayloadRequest): Promise<KeyRow[]> {
  const settings = await payload.findGlobal({
    slug: 'licensing-settings', depth: 0, overrideAccess: true, select: { signingKeys: true }, req,
  })
  return settings.signingKeys ?? []
}

export async function loadLicensingSigner(
  payload: Payload, env: LicensingEnv = process.env, keyRows?: readonly KeyRow[],
): Promise<Ed25519Signer | null> {
  try {
    const rows = keyRows ?? await readKeyRows(payload)
    if (!validSigningKeyRows(rows)) return null
    const active = rows.filter(isActive)
    if (active.length !== 1) return null
    const fromEnv = configuredEnvironmentKey(env)
    const value = fromEnv ?? openSecret(await readIntegrationsDoc(payload), LICENSING_SIGNING_SECRET_ID, readSecretsKey(env))?.reveal()
    const privateKey = value && importEd25519PrivateKey(value)
    if (!privateKey) return null
    const { kid, publicKey } = ed25519PublicMetadata(privateKey)
    return kid === active[0]!.kid && publicKey === active[0]!.publicKey ? ed25519Signer(kid, privateKey) : null
  } catch {
    return null
  }
}

type ProvisionOptions = { rotate?: boolean; registerEnv?: boolean; env?: LicensingEnv; now?: Date }

/** Bootstrap or rotate the key. The env registration path records public metadata for an externally managed key. */
export async function provisionSigningKey(payload: Payload, options: ProvisionOptions = {}): Promise<PublicKey> {
  return withPaymentTransaction(payload, (tx) => provisionSigningKeyTx(payload, tx, options), {
    // The metadata row and vault update commit together. A subsequent rotation still preserves this row.
    confirm: ({ kid, publicKey }) => isSigningKeyRegistered(payload, { kid, publicKey }),
  })
}

/** Post-commit check used by callers that run provisionSigningKeyTx in their own transaction. */
export async function isSigningKeyRegistered(payload: Payload, { kid, publicKey }: PublicKey): Promise<boolean> {
  return (await readKeyRows(payload)).some((row) => row.kid === kid && row.publicKey === publicKey)
}

/**
 * Same as provisionSigningKey inside a caller's BEGIN IMMEDIATE transaction (L6b admin rotation endpoint, which adds
 * its audit row and event to the same commit). Only public metadata is returned; the private key never leaves here.
 */
export async function provisionSigningKeyTx(payload: Payload, { req }: Pick<PaymentTx, 'req'>, {
  rotate = false, registerEnv = false, env = process.env, now = new Date(),
}: ProvisionOptions = {}): Promise<PublicKey> {
  const fromEnv = configuredEnvironmentKey(env)
  if (!registerEnv && fromEnv) throw new LicensingKeyError('environment_key_configured')
  const master = registerEnv ? null : readSecretsKey(env)
  if (!registerEnv && !master) throw new LicensingKeyError('vault_key_required')
  const createdAt = now.toISOString()

  {
    const rows = await readKeyRows(payload, req)
    if (!rotate && rows.some(isActive)) throw new LicensingKeyError('active_key_exists')
    const privateKey = registerEnv
      ? importEd25519PrivateKey(fromEnv ?? '')
      : generateKeyPairSync('ed25519').privateKey
    if (!privateKey) throw new LicensingKeyError('invalid_environment_key')
    const metadata = ed25519PublicMetadata(privateKey)
    if (rows.some(({ kid }) => kid === metadata.kid)) throw new LicensingKeyError('key_already_registered')

    const integrations = await readIntegrationsDoc(payload, req)
    const vault = parseVault(integrations.secrets)
    const previous = vault[LICENSING_SIGNING_SECRET_ID]
    if (master) {
      // A mistyped master must not overwrite the last recoverable signing record.
      if (previous && !openSecret(integrations, LICENSING_SIGNING_SECRET_ID, master)) {
        throw new LicensingKeyError('vault_key_unreadable')
      }
      const der = privateKey.export({ format: 'der', type: 'pkcs8' })
      try {
        const record: VaultEntry = {
          enc: encryptSecret(der.toString('base64url'), LICENSING_SIGNING_SECRET_ID, master),
          kid: master.kid,
          updatedAt: createdAt,
          last4: null,
        }
        vault[LICENSING_SIGNING_SECRET_ID] = record
      } finally {
        der.fill(0)
      }
    } else {
      // An environment key replaces the vault signer, so retain only the previous public metadata.
      delete vault[LICENSING_SIGNING_SECRET_ID]
    }
    if (master || previous) await persistVault(req, vault)

    await payload.updateGlobal({
      slug: 'licensing-settings', depth: 0, overrideAccess: true, req,
      data: { signingKeys: [
        { ...metadata, createdAt },
        ...rows.map((row) => isActive(row) ? { ...row, retiredAt: createdAt } : row),
      ] },
    })
    return { kid: metadata.kid, publicKey: metadata.publicKey }
  }
}

/** Idempotent administrative revocation. The public kid remains available for clients' deny lists. */
export async function revokeSigningKey(payload: Payload, kid: string, now = new Date()): Promise<void> {
  await withPaymentTransaction(payload, async ({ req }) => {
    const rows = await readKeyRows(payload, req)
    const key = rows.find((row) => row.kid === kid)
    if (!key) throw new LicensingKeyError('unknown_signing_key')
    if (key.revokedAt != null) return
    const revokedAt = now.toISOString()
    await payload.updateGlobal({
      slug: 'licensing-settings', depth: 0, overrideAccess: true, req,
      data: { signingKeys: rows.map((row) => row.kid === kid ? { ...row, revokedAt } : row) },
    })
  }, {
    confirm: async () => (await readKeyRows(payload)).some((row) => row.kid === kid && row.revokedAt != null),
  })
}
