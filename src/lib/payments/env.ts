import { readSecret, type SecretValue } from './secret'
import { CURRENCIES, type Currency, type ProviderEnv } from './types'

/**
 * Payment secrets and switches come ONLY from the process environment (systemd EnvironmentFile),
 * never from the DB or the admin panel. Secrets are wrapped in SecretValue and never logged.
 */

export const IYZICO_LIVE_BASE_URL = 'https://api.iyzipay.com'
export const IYZICO_SANDBOX_BASE_URL = 'https://sandbox-api.iyzipay.com'
export const STRIPE_API_BASE_URL = 'https://api.stripe.com'

export type IyzicoConfig = {
  apiKey: SecretValue
  secretKey: SecretValue
  baseUrl: string
  env: ProviderEnv
}

export type StripeConfig = {
  secretKey: SecretValue
  webhookSecret: SecretValue
  apiBase: string
  env: ProviderEnv
}

export type PaymentsEnvConfig = {
  /** Layer 1: PAYMENTS_ENABLED === 'true'. Anything else (missing, "1", "yes") = off. */
  capability: boolean
  iyzico?: IyzicoConfig
  /** Present only when PAYMENTS_STRIPE_ENABLED=true AND keys are set (Stripe is off by default: TR not supported). */
  stripe?: StripeConfig
  /** Currencies routed to Stripe when it is enabled. TRY is never routed to Stripe. */
  stripeCurrencies: Currency[]
  /** Names of env variables that are missing/invalid. Never contains values. */
  issues: string[]
}

type Env = Record<string, string | undefined>

const isProduction = (env: Env) => env.NODE_ENV === 'production'

/** Local fake-provider override (isolated e2e). Refused in production. */
function isLocalOverride(url: string, env: Env): boolean {
  if (isProduction(env)) return false
  try {
    const u = new URL(url)
    return (u.protocol === 'http:' || u.protocol === 'https:') && (u.hostname === '127.0.0.1' || u.hostname === 'localhost') && !u.username && !u.password && u.pathname === '/' && !u.search && !u.hash
  } catch {
    return false
  }
}

function normalizeBase(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

export function readPaymentsEnv(env: Env = process.env): PaymentsEnvConfig {
  const issues: string[] = []
  const capability = env.PAYMENTS_ENABLED === 'true'

  // iyzico — primary provider for TRY, USD and EUR.
  let iyzico: IyzicoConfig | undefined
  const iyzicoApiKey = readSecret(env.IYZICO_API_KEY)
  const iyzicoSecretKey = readSecret(env.IYZICO_SECRET_KEY)
  const rawBase = env.IYZICO_BASE_URL?.trim() ? normalizeBase(env.IYZICO_BASE_URL) : ''
  let iyzicoEnv: ProviderEnv | undefined
  if (rawBase === IYZICO_LIVE_BASE_URL) iyzicoEnv = 'live'
  else if (rawBase === IYZICO_SANDBOX_BASE_URL || (rawBase && isLocalOverride(rawBase, env))) iyzicoEnv = 'sandbox'
  if (!iyzicoApiKey) issues.push('IYZICO_API_KEY')
  if (!iyzicoSecretKey) issues.push('IYZICO_SECRET_KEY')
  if (!iyzicoEnv) issues.push('IYZICO_BASE_URL')
  if (iyzicoApiKey && iyzicoSecretKey && iyzicoEnv) {
    iyzico = { apiKey: iyzicoApiKey, secretKey: iyzicoSecretKey, baseUrl: rawBase, env: iyzicoEnv }
  }

  // Stripe — adapter ready but OFF unless explicitly enabled (non-TR legal entity only).
  let stripe: StripeConfig | undefined
  if (env.PAYMENTS_STRIPE_ENABLED === 'true') {
    const secretKey = readSecret(env.STRIPE_SECRET_KEY)
    const webhookSecret = readSecret(env.STRIPE_WEBHOOK_SECRET)
    const rawApiBase = env.STRIPE_API_BASE?.trim() ? normalizeBase(env.STRIPE_API_BASE) : STRIPE_API_BASE_URL
    const apiBaseOk = rawApiBase === STRIPE_API_BASE_URL || isLocalOverride(rawApiBase, env)
    const keyMatch = secretKey ? /^(sk|rk)_(test|live)_/.exec(secretKey.reveal()) : null
    if (!secretKey || !keyMatch) issues.push('STRIPE_SECRET_KEY')
    if (!webhookSecret || !webhookSecret.reveal().startsWith('whsec_')) issues.push('STRIPE_WEBHOOK_SECRET')
    if (!apiBaseOk) issues.push('STRIPE_API_BASE')
    if (secretKey && keyMatch && webhookSecret?.reveal().startsWith('whsec_') && apiBaseOk) {
      stripe = { secretKey, webhookSecret, apiBase: rawApiBase, env: keyMatch[2] === 'live' ? 'live' : 'sandbox' }
    }
  }

  const stripeCurrencies = parseStripeCurrencies(env.PAYMENTS_STRIPE_CURRENCIES)
  return { capability, iyzico, stripe, stripeCurrencies, issues }
}

function parseStripeCurrencies(raw: string | undefined): Currency[] {
  const list = (raw?.trim() ? raw : 'USD,EUR')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter((c): c is Currency => (CURRENCIES as readonly string[]).includes(c) && c !== 'TRY')
  return [...new Set(list)]
}

/** Admin "status" view: configured/missing only, never values. */
export function describePaymentsEnv(cfg: PaymentsEnvConfig) {
  return {
    capability: cfg.capability,
    iyzico: cfg.iyzico ? { configured: true, env: cfg.iyzico.env } : { configured: false as const },
    stripe: cfg.stripe ? { configured: true, env: cfg.stripe.env } : { configured: false as const },
    stripeCurrencies: cfg.stripeCurrencies,
    issues: [...cfg.issues],
  }
}
