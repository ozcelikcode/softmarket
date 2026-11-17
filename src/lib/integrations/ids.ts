/*
 * Write-only secrets of the `integrations` global (pure, no Node APIs: shared by the admin UI and the server).
 * Values are encrypted into `integrations.secrets` (src/lib/integrations/vault.ts); no API ever returns them.
 */
export const SECRET_IDS = [
  'iyzico.sandbox.apiKey',
  'iyzico.sandbox.secretKey',
  'iyzico.live.apiKey',
  'iyzico.live.secretKey',
  'stripe.sandbox.secretKey',
  'stripe.sandbox.webhookSecret',
  'stripe.live.secretKey',
  'stripe.live.webhookSecret',
  'smtp.password',
] as const
export type SecretId = (typeof SECRET_IDS)[number]
export const isSecretId = (value: unknown): value is SecretId =>
  typeof value === 'string' && (SECRET_IDS as readonly string[]).includes(value)

export const PROVIDER_ENVS = ['sandbox', 'live'] as const
export type IntegrationEnv = (typeof PROVIDER_ENVS)[number]

export const SECRET_LABELS: Record<SecretId, { tr: string; en: string }> = {
  'iyzico.sandbox.apiKey': { tr: 'iyzico test API anahtarı', en: 'iyzico sandbox API key' },
  'iyzico.sandbox.secretKey': { tr: 'iyzico test gizli anahtar', en: 'iyzico sandbox secret key' },
  'iyzico.live.apiKey': { tr: 'iyzico canlı API anahtarı', en: 'iyzico live API key' },
  'iyzico.live.secretKey': { tr: 'iyzico canlı gizli anahtar', en: 'iyzico live secret key' },
  'stripe.sandbox.secretKey': { tr: 'Stripe test gizli anahtarı (sk_test_)', en: 'Stripe test secret key (sk_test_)' },
  'stripe.sandbox.webhookSecret': { tr: 'Stripe test webhook imza sırrı (whsec_)', en: 'Stripe test webhook signing secret (whsec_)' },
  'stripe.live.secretKey': { tr: 'Stripe canlı gizli anahtarı (sk_live_)', en: 'Stripe live secret key (sk_live_)' },
  'stripe.live.webhookSecret': { tr: 'Stripe canlı webhook imza sırrı (whsec_)', en: 'Stripe live webhook signing secret (whsec_)' },
  'smtp.password': { tr: 'SMTP şifresi', en: 'SMTP password' },
}

export const MAX_SECRET_LENGTH = 512

/** Input check before encryption. Returns a short code (`ok` or the reason); never echoes the value. */
export function validateSecretInput(id: SecretId, raw: unknown): 'ok' | 'empty' | 'too_long' | 'invalid_chars' | 'invalid_format' {
  if (typeof raw !== 'string' || !raw.trim()) return 'empty'
  const value = raw.trim()
  if (value.length > MAX_SECRET_LENGTH) return 'too_long'
  // Printable ASCII without spaces for API keys; the SMTP password may contain any printable character.
  if (id === 'smtp.password' ? /[\u0000-\u001f\u007f]/.test(value) : !/^[\x21-\x7e]+$/.test(value)) return 'invalid_chars'
  if (value.startsWith('CHANGE_')) return 'invalid_format'
  const env = id.split('.')[1]
  if (id.endsWith('.secretKey') && id.startsWith('stripe.')) {
    const match = /^(sk|rk)_(test|live)_/.exec(value)
    if (!match || (match[2] === 'live') !== (env === 'live')) return 'invalid_format'
  }
  if (id.endsWith('.webhookSecret') && !value.startsWith('whsec_')) return 'invalid_format'
  return 'ok'
}

/** Public status of one secret (admin UI): never the value, never the ciphertext. */
export type SecretStatus = { defined: boolean; last4: string | null; updatedAt: string | null; unreadable?: boolean }
