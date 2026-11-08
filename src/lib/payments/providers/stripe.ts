import type { StripeConfig } from '../env'
import { PaymentError } from '../errors'
import { isValidMinor } from '../money'
import { verifyStripeSignature } from '../signature/stripe'
import {
  CURRENCIES,
  type CheckoutInput,
  type CheckoutSession,
  type Currency,
  type FetchLike,
  type HeaderLike,
  type PaymentProvider,
  type ProviderPaymentState,
  type RefundInput,
  type RefundResult,
  type WebhookVerification,
} from '../types'
import { isTooLarge, readHeader, requestJson, safeCode, str } from './http'

/**
 * Stripe adapter — READY BUT OFF BY DEFAULT. P0: Türkiye is not on Stripe's supported-country
 * list (https://stripe.com/global), so a TR-based company cannot open an account. Enable only with a
 * foreign legal entity (PAYMENTS_STRIPE_ENABLED=true). No `stripe` npm package: a fetch client plus
 * our own signature check keeps the dependency surface (and bundle-guard risk) at zero.
 * Docs: https://docs.stripe.com/api/checkout/sessions/create , https://docs.stripe.com/webhooks/signature
 */

/** Pinned API version (P0/P4: confirm against the account's version before enabling). */
export const STRIPE_API_VERSION = '2025-03-31.basil'

const PROVIDER = 'stripe' as const
const SESSION_ID_RE = /^cs_(test|live)_[A-Za-z0-9]{1,250}$/
const MIN_EXPIRY_SEC = 30 * 60
const MAX_EXPIRY_SEC = 24 * 60 * 60

export type StripeProviderDeps = {
  config: StripeConfig
  fetch: FetchLike
  now?: () => Date
  timeoutMs?: number
}

/** application/x-www-form-urlencoded with Stripe's bracket notation for nested keys. */
export function formEncode(params: Record<string, string | number | undefined>): string {
  const out = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) out.append(key, String(value))
  }
  return out.toString()
}

export function createStripeProvider(deps: StripeProviderDeps): PaymentProvider {
  const { config } = deps
  const now = deps.now ?? (() => new Date())

  const headers = (idempotencyKey?: string): Record<string, string> => ({
    Authorization: `Bearer ${config.secretKey.reveal()}`,
    'Stripe-Version': STRIPE_API_VERSION,
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
  })

  async function call(method: 'GET' | 'POST', path: string, body?: string, idempotencyKey?: string) {
    const { json } = await requestJson(
      deps.fetch,
      PROVIDER,
      `${config.apiBase}${path}`,
      { method, headers: headers(idempotencyKey), body },
      { timeoutMs: deps.timeoutMs },
    )
    return json
  }

  function verifyRedirect(url: unknown): string {
    const text = str(url)
    let parsed: URL | null = null
    try {
      parsed = text ? new URL(text) : null
    } catch {
      parsed = null
    }
    const local = process.env.NODE_ENV !== 'production' && config.env === 'sandbox' && /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(config.apiBase) && !!parsed && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost')
    if (!parsed || parsed.username || parsed.password || !['http:', 'https:'].includes(parsed.protocol) || (!local && (parsed.protocol !== 'https:' || parsed.hostname !== 'checkout.stripe.com'))) {
      throw new PaymentError('bad_response', { provider: PROVIDER, detail: 'url' })
    }
    return parsed.toString()
  }

  return {
    id: PROVIDER,
    env: config.env,

    async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
      if (!isValidMinor(input.totalMinor) || input.totalMinor === 0) throw new PaymentError('invalid_input', { provider: PROVIDER, detail: 'totalMinor' })
      if (input.currency === 'TRY' || !(CURRENCIES as readonly string[]).includes(input.currency)) {
        throw new PaymentError('invalid_input', { provider: PROVIDER, detail: 'currency' })
      }
      if (!input.idempotencyKey) throw new PaymentError('invalid_input', { provider: PROVIDER, detail: 'idempotencyKey' })
      const nowSec = Math.floor(now().getTime() / 1000)
      const expiresAt = Math.floor(input.expiresAt.getTime() / 1000)
      if (!Number.isFinite(expiresAt) || !Number.isFinite(nowSec) || expiresAt - nowSec < MIN_EXPIRY_SEC || expiresAt - nowSec > MAX_EXPIRY_SEC) {
        throw new PaymentError('invalid_input', { provider: PROVIDER, detail: 'expiresAt' })
      }
      const body = formEncode({
        mode: 'payment',
        client_reference_id: input.orderNumber,
        success_url: input.urls.successUrl,
        cancel_url: input.urls.cancelUrl,
        customer_email: input.buyer.email,
        locale: input.locale,
        expires_at: expiresAt,
        'line_items[0][quantity]': 1,
        'line_items[0][price_data][currency]': input.currency.toLowerCase(),
        'line_items[0][price_data][unit_amount]': input.totalMinor,
        'line_items[0][price_data][product_data][name]': input.item.title,
        'metadata[order_number]': input.orderNumber,
        'payment_intent_data[metadata][order_number]': input.orderNumber,
      })
      const json = await call('POST', '/v1/checkout/sessions', body, input.idempotencyKey)
      const id = str(json.id)
      if (!id || !SESSION_ID_RE.test(id)) throw new PaymentError('bad_response', { provider: PROVIDER, detail: 'id' })
      if (str(json.client_reference_id) !== input.orderNumber) throw new PaymentError('bad_response', { provider: PROVIDER, detail: 'client_reference_id' })
      const exp = typeof json.expires_at === 'number' ? new Date(json.expires_at * 1000) : undefined
      return { provider: PROVIDER, providerEnv: config.env, providerRef: id, redirectUrl: verifyRedirect(json.url), expiresAt: exp }
    },

    async retrieve(sessionId: string): Promise<ProviderPaymentState> {
      if (!SESSION_ID_RE.test(sessionId)) throw new PaymentError('invalid_input', { provider: PROVIDER, detail: 'sessionId' })
      const json = await call('GET', `/v1/checkout/sessions/${sessionId}`)
      if (str(json.id) !== sessionId) throw new PaymentError('bad_response', { provider: PROVIDER, detail: 'id' })
      const currencyUpper = (str(json.currency) ?? '').toUpperCase()
      const currency = (CURRENCIES as readonly string[]).includes(currencyUpper) ? (currencyUpper as Currency) : undefined
      const base = {
        provider: PROVIDER,
        providerRef: sessionId,
        orderNumber: str(json.client_reference_id),
        providerPaymentId: str(json.payment_intent),
        amountMinor: isValidMinor(json.amount_total) ? json.amount_total : undefined,
        currency,
      }
      if (json.status === 'expired') return { ...base, status: 'expired' }
      if (json.status === 'complete' && json.payment_status === 'paid') return { ...base, status: 'paid' }
      // complete + unpaid = delayed (async) payment method still processing.
      return { ...base, status: 'pending' }
    },

    verifyWebhook(rawBody: string, hdrs: HeaderLike, at?: Date): WebhookVerification {
      if (isTooLarge(rawBody)) return { ok: false, reason: 'too_large' }
      const result = verifyStripeSignature({
        rawBody,
        header: readHeader(hdrs, 'stripe-signature'),
        secret: config.webhookSecret.reveal(),
        now: at ?? now(),
      })
      if (!result.ok) return { ok: false, reason: result.reason }
      let event: Record<string, unknown>
      try {
        const parsed: unknown = JSON.parse(rawBody)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, reason: 'malformed' }
        event = parsed as Record<string, unknown>
      } catch {
        return { ok: false, reason: 'malformed' }
      }
      const id = str(event.id)
      const type = str(event.type)
      if (!id || !/^evt_[A-Za-z0-9]+$/.test(id) || !type) return { ok: false, reason: 'malformed' }
      const data = event.data && typeof event.data === 'object' ? (event.data as Record<string, unknown>) : {}
      const object = data.object && typeof data.object === 'object' ? (data.object as Record<string, unknown>) : {}
      const isSession = object.object === 'checkout.session'
      return {
        ok: true,
        event: {
          provider: PROVIDER,
          eventId: id,
          type,
          providerRef: isSession ? str(object.id) : undefined,
          providerPaymentId: str(object.payment_intent),
          orderNumber: isSession ? str(object.client_reference_id) : undefined,
        },
      }
    },

    async refund(input: RefundInput): Promise<RefundResult> {
      if (!isValidMinor(input.amountMinor) || input.amountMinor === 0 || !input.idempotencyKey || !/^pi_[A-Za-z0-9]+$/.test(input.providerPaymentId)) {
        throw new PaymentError('invalid_input', { provider: PROVIDER, detail: 'refund' })
      }
      const body = formEncode({
        payment_intent: input.providerPaymentId,
        amount: input.amountMinor,
        'metadata[order_number]': input.orderNumber,
      })
      let json: Record<string, unknown>
      try {
        json = await call('POST', '/v1/refunds', body, input.idempotencyKey)
      } catch (error) {
        if (error instanceof PaymentError && error.code === 'http_error') return { ok: false, failureCode: 'refund_rejected' }
        throw error
      }
      const status = str(json.status)
      if (status === 'succeeded' || status === 'pending') return { ok: true, status, providerRefundId: str(json.id) }
      return { ok: false, failureCode: safeCode(json.failure_reason, 'refund_failed') }
    },
  }
}
