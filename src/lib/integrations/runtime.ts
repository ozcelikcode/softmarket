import type { Payload } from 'payload'

import { envDefinesProvider, readPaymentsConfig, readPaymentsEnv, type PaymentsEnvConfig, type PanelPaymentCredentials } from '@/lib/payments/env'
import { SecretValue } from '@/lib/payments/secret'
import { readSecretsKey, type SecretsKey } from '@/lib/secrets/crypto'
import type { IntegrationEnv, SecretId } from './ids'
import { openSecret, parseVault, readIntegrationsDoc, type Vault } from './vault'

/*
 * SERVER ONLY. Effective runtime settings: env first (per provider / for SMTP as a whole), then the admin panel
 * (`integrations` global, decrypted here), else "not configured". Any read or decrypt failure degrades to the env-only
 * result (fail-closed: a panel value that cannot be read is simply absent). Nothing here logs a value.
 */

type Env = Record<string, string | undefined>
type Doc = Record<string, unknown> | null | undefined

const prop = (obj: unknown, key: string): unknown => (obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[key] : undefined)
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined)
const envOf = (doc: Doc, provider: 'iyzico' | 'stripe'): IntegrationEnv => (prop(prop(doc, provider), 'environment') === 'live' ? 'live' : 'sandbox')

export type DecryptIssue = { id: SecretId; code: string }

/** Decrypted panel credentials for the SELECTED environment of each provider (undefined when none are stored). */
export function panelPaymentCredentials(doc: Doc, key: SecretsKey | null, issues: DecryptIssue[] = []): PanelPaymentCredentials {
  const vault = parseVault(prop(doc, 'secrets'))
  const open = (id: SecretId) => openSecret(doc, id, key, (i, code) => issues.push({ id: i, code }))
  const out: PanelPaymentCredentials = {}
  const iyzicoEnv = envOf(doc, 'iyzico')
  if (vault[`iyzico.${iyzicoEnv}.apiKey`] || vault[`iyzico.${iyzicoEnv}.secretKey`]) {
    out.iyzico = { env: iyzicoEnv, apiKey: open(`iyzico.${iyzicoEnv}.apiKey`), secretKey: open(`iyzico.${iyzicoEnv}.secretKey`) }
  }
  const stripeEnv = envOf(doc, 'stripe')
  if (vault[`stripe.${stripeEnv}.secretKey`] || vault[`stripe.${stripeEnv}.webhookSecret`]) {
    out.stripe = { env: stripeEnv, secretKey: open(`stripe.${stripeEnv}.secretKey`), webhookSecret: open(`stripe.${stripeEnv}.webhookSecret`) }
  }
  return out
}

export function resolvePaymentsConfig(env: Env, doc: Doc, key: SecretsKey | null = readSecretsKey(env)): PaymentsEnvConfig {
  const issues: DecryptIssue[] = []
  const cfg = readPaymentsConfig({ env, panel: panelPaymentCredentials(doc, key, issues) })
  // Decrypt failures are reported by id + code only (wrong key, tampered).
  for (const issue of issues) cfg.issues.push(`panel:${issue.id} (${issue.code})`)
  return cfg
}

/**
 * Effective payment config for the server runtime. Without the env capability the DB is not touched (quote-only
 * installs keep zero extra queries); when env already defines every provider that could be used, neither.
 */
export async function loadPaymentsConfig(payload: Payload, env: Env = process.env): Promise<PaymentsEnvConfig> {
  const fromEnv = readPaymentsEnv(env)
  if (!fromEnv.capability) return fromEnv
  if (envDefinesProvider('iyzico', env) && (env.PAYMENTS_STRIPE_ENABLED !== 'true' || envDefinesProvider('stripe', env))) return fromEnv
  try {
    return resolvePaymentsConfig(env, await readIntegrationsDoc(payload))
  } catch {
    return fromEnv
  }
}

// SMTP ------------------------------------------------------------------------------------------------------------

export type SmtpSource = 'env' | 'panel' | 'none'
export type SmtpConfig = {
  source: Exclude<SmtpSource, 'none'>
  host: string
  port: number
  secure: boolean
  user?: string
  password?: SecretValue
  fromAddress: string
  fromName: string
  /** Changes whenever any setting (or the stored password record) changes: transport cache key. */
  version: string
}

export const DEFAULT_FROM_NAME = 'SoftMarket'

/** Same rule as before for env: a host that is empty or starts with `CHANGE_` means "not set". */
export function envDefinesSmtp(env: Env = process.env): boolean {
  const host = env.SMTP_HOST?.trim()
  return Boolean(host && !host.startsWith('CHANGE_'))
}

const validPort = (value: unknown) => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : null
}

export function resolveSmtpConfig(env: Env, doc: Doc, key: SecretsKey | null = readSecretsKey(env), issues: DecryptIssue[] = []): SmtpConfig | null {
  if (envDefinesSmtp(env)) {
    const fromAddress = text(env.SMTP_FROM)
    if (!fromAddress) return null
    const user = text(env.SMTP_USER)
    const pass = text(env.SMTP_PASSWORD)
    return {
      source: 'env', host: env.SMTP_HOST!.trim(), port: validPort(env.SMTP_PORT || 587) ?? 587, secure: env.SMTP_SECURE === 'true',
      ...(user && pass ? { user, password: new SecretValue(pass) } : {}),
      fromAddress, fromName: DEFAULT_FROM_NAME, version: 'env',
    }
  }
  const smtp = prop(doc, 'smtp')
  const host = text(prop(smtp, 'host'))
  const fromAddress = text(prop(smtp, 'fromAddress'))
  const port = validPort(prop(smtp, 'port') ?? 587)
  if (!host || host.startsWith('CHANGE_') || !fromAddress || !port) return null
  const vault: Vault = parseVault(prop(doc, 'secrets'))
  const user = text(prop(smtp, 'user'))
  const password = openSecret(doc, 'smtp.password', key, (id, code) => issues.push({ id, code }))
  // A stored but unreadable password must not silently fall back to an unauthenticated send.
  if (vault['smtp.password'] && !password) return null
  const secure = prop(smtp, 'secure') === true
  const fromName = text(prop(smtp, 'fromName')) ?? DEFAULT_FROM_NAME
  return {
    source: 'panel', host, port, secure, ...(user && password ? { user, password } : {}), fromAddress, fromName,
    version: JSON.stringify([host, port, secure, user ?? '', fromAddress, fromName, vault['smtp.password']?.updatedAt ?? '', vault['smtp.password']?.enc.slice(-24) ?? '']),
  }
}

export async function loadSmtpConfig(payload: Payload, env: Env = process.env): Promise<SmtpConfig | null> {
  if (envDefinesSmtp(env)) return resolveSmtpConfig(env, null)
  try {
    return resolveSmtpConfig(env, await readIntegrationsDoc(payload))
  } catch {
    return null
  }
}

/** Panel/env source of SMTP for status displays (no secrets). */
export async function smtpSource(payload: Payload, env: Env = process.env): Promise<SmtpSource> {
  return (await loadSmtpConfig(payload, env))?.source ?? 'none'
}
