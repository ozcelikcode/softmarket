import { randomBytes } from 'node:crypto'

import type { IyzicoConfig } from '../env'
import { PaymentError } from '../errors'
import { iyzicoEventId } from '../idempotency'
import { decimalToMinor, isValidMinor, minorToDecimal } from '../money'
import {
  iyzicoAuthorizationHeader,
  iyzicoSignaturePrice,
  verifyIyzicoResponseSignature,
  verifyIyzicoWebhookSignature,
  type IyzicoWebhookPayload,
} from '../signature/iyzico'
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
 * iyzico adapter (thin fetch client instead of the callback-based `iyzipay` SDK).
 * - Checkout Form initialize → `paymentPageUrl` (hosted page, full redirect; the embeddable
 *   `checkoutFormContent` script is NOT used: CSP + SAQ-A).
 * - Retrieve → server-side truth, response `signature` verified (fail-closed when missing).
 * - Webhook → X-IYZ-SIGNATURE-V3 (HPP/Checkout Form and Direct formats); only a trigger for retrieve.
 * Docs: https://docs.iyzico.com/en/payment-methods/checkoutform/cf-implementation/cf-initialize
 *       https://docs.iyzico.com/en/payment-methods/checkoutform/cf-implementation/cf-retrieve
 *       https://docs.iyzico.com/en/advanced/refund-and-cancel
 */

export const IYZICO_PATHS = {
  initialize: '/payment/iyzipos/checkoutform/initialize/auth/ecom',
  retrieve: '/payment/iyzipos/checkoutform/auth/ecom/detail',
  refund: '/v2/payment/refund',
} as const

const PROVIDER = 'iyzico' as const
const TOKEN_RE = /^[A-Za-z0-9_-]{8,128}$/

export type IyzicoProviderDeps = {
  config: IyzicoConfig
  fetch: FetchLike
  /** Defaults to time + CSPRNG digits (iyzico sample: Date.now() + random). */
  randomKey?: () => string
  timeoutMs?: number
}

const defaultRandomKey = () => `${Date.now()}${randomBytes(6).readUIntBE(0, 6) % 1_000_000_000}`

function assertCheckoutInput(input: CheckoutInput) {
  if (!isValidMinor(input.totalMinor) || input.totalMinor === 0) throw new PaymentError('invalid_input', { provider: PROVIDER, detail: 'totalMinor' })
  if (!(CURRENCIES as readonly string[]).includes(input.currency)) throw new PaymentError('invalid_input', { provider: PROVIDER, detail: 'currency' })
  for (const key of ['orderNumber', 'idempotencyKey'] as const) {
    if (!input[key]) throw new PaymentError('invalid_input', { provider: PROVIDER, detail: key })
  }
  const b = input.buyer
  for (const key of ['id', 'name', 'surname', 'email', 'identityNumber', 'gsmNumber', 'address', 'city', 'country', 'ip'] as const) {
    if (!b[key]?.trim()) throw new PaymentError('invalid_input', { provider: PROVIDER, detail: `buyer.${key}` })
  }
}

export function createIyzicoProvider(deps: IyzicoProviderDeps): PaymentProvider {
  const { config } = deps
  const randomKey = deps.randomKey ?? defaultRandomKey

  async function call(path: string, payload: Record<string, unknown>) {
    const body = JSON.stringify(payload)
    const rnd = randomKey()
    const headers = {
      Authorization: iyzicoAuthorizationHeader({
        apiKey: config.apiKey.reveal(),
        secretKey: config.secretKey.reveal(),
        randomKey: rnd,
        uriPath: path,
        body,
      }),
      'x-iyzi-rnd': rnd,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
    // iyzico returns business failures with HTTP 200/4xx + status:"failure"; parse both.
    const { json } = await requestJson(deps.fetch, PROVIDER, `${config.baseUrl}${path}`, { method: 'POST', headers, body }, {
      timeoutMs: deps.timeoutMs,
      acceptErrorBody: true,
    })
    return json
  }

  function verifyRedirect(url: unknown): string {
    const text = str(url)
    if (!text) throw new PaymentError('bad_response', { provider: PROVIDER, detail: 'paymentPageUrl' })
    let parsed: URL
    try {
      parsed = new URL(text)
    } catch {
      throw new PaymentError('bad_response', { provider: PROVIDER, detail: 'paymentPageUrl' })
    }
    const local = process.env.NODE_ENV !== 'production' && config.env === 'sandbox' && /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(config.baseUrl) && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost')
    if (parsed.username || parsed.password || (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')) throw new PaymentError('bad_response', { provider: PROVIDER, detail: 'paymentPageUrl' })
    if (parsed.protocol !== 'https:' && !local) throw new PaymentError('bad_response', { provider: PROVIDER, detail: 'paymentPageUrl' })
    if (!local && !/(^|\.)iyzipay\.com$|(^|\.)iyzico\.com$/.test(parsed.hostname)) {
      throw new PaymentError('bad_response', { provider: PROVIDER, detail: 'paymentPageUrl_host' })
    }
    return parsed.toString()
  }

  return {
    id: PROVIDER,
    env: config.env,

    async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
      assertCheckoutInput(input)
      const price = minorToDecimal(input.totalMinor, input.currency)
      const b = input.buyer
      const address = { contactName: `${b.name} ${b.surname}`, city: b.city, country: b.country, address: b.address, zipCode: b.zipCode }
      const json = await call(IYZICO_PATHS.initialize, {
        locale: input.locale,
        conversationId: input.orderNumber,
        price,
        paidPrice: price,
        currency: input.currency,
        basketId: input.orderNumber,
        paymentGroup: 'PRODUCT',
        callbackUrl: input.urls.callbackUrl,
        // Single installment: paidPrice must equal our total (installment interest would change it).
        enabledInstallments: [1],
        buyer: {
          id: b.id,
          name: b.name,
          surname: b.surname,
          identityNumber: b.identityNumber,
          email: b.email,
          gsmNumber: b.gsmNumber,
          registrationAddress: b.address,
          city: b.city,
          country: b.country,
          zipCode: b.zipCode,
          ip: b.ip,
        },
        billingAddress: address,
        // All items VIRTUAL → shippingAddress not required.
        basketItems: [{ id: input.item.sku, name: input.item.title, category1: 'Software', itemType: 'VIRTUAL', price }],
      })
      if (json.status !== 'success') {
        throw new PaymentError('provider_error', { provider: PROVIDER, detail: `code=${safeCode(json.errorCode, 'unknown')}` })
      }
      const token = str(json.token)
      const conversationId = str(json.conversationId)
      if (!token || !TOKEN_RE.test(token)) throw new PaymentError('bad_response', { provider: PROVIDER, detail: 'token' })
      if (conversationId !== input.orderNumber) throw new PaymentError('bad_response', { provider: PROVIDER, detail: 'conversationId' })
      // Response signature for initialize: conversationId:token.
      if (!verifyIyzicoResponseSignature(config.secretKey.reveal(), [conversationId, token], json.signature)) {
        throw new PaymentError('signature_mismatch', { provider: PROVIDER })
      }
      const ttl = typeof json.tokenExpireTime === 'number' && json.tokenExpireTime > 0 ? json.tokenExpireTime : undefined
      return {
        provider: PROVIDER,
        providerEnv: config.env,
        providerRef: token,
        redirectUrl: verifyRedirect(json.paymentPageUrl),
        expiresAt: ttl ? new Date(Date.now() + ttl * 1000) : undefined,
      }
    },

    async retrieve(token: string, opts = {}): Promise<ProviderPaymentState> {
      if (!TOKEN_RE.test(token)) throw new PaymentError('invalid_input', { provider: PROVIDER, detail: 'token' })
      const json = await call(IYZICO_PATHS.retrieve, {
        locale: opts.locale ?? 'tr',
        ...(opts.orderNumber ? { conversationId: opts.orderNumber } : {}),
        token,
      })
      const paymentStatus = str(json.paymentStatus)
      if (json.status !== 'success') {
        // Error responses lack a verified payment signature; do not turn them into order state.
        throw new PaymentError('provider_error', { provider: PROVIDER, detail: `code=${safeCode(json.errorCode, 'unknown')}` })
      }

      const paymentId = str(json.paymentId) ?? ''
      const currency = str(json.currency) ?? ''
      const basketId = str(json.basketId) ?? ''
      const conversationId = str(json.conversationId) ?? ''
      const paidPrice = str(json.paidPrice) ?? ''
      const price = str(json.price) ?? ''
      // Order per docs: paymentStatus, paymentId, currency, basketId, conversationId, paidPrice, price, token.
      const signed = verifyIyzicoResponseSignature(
        config.secretKey.reveal(),
        [paymentStatus ?? '', paymentId, currency, basketId, conversationId, iyzicoSignaturePrice(paidPrice), iyzicoSignaturePrice(price), token],
        json.signature,
      )
      if (!signed) throw new PaymentError('signature_mismatch', { provider: PROVIDER })

      if (!basketId || !conversationId || (opts.orderNumber && (basketId !== opts.orderNumber || conversationId !== opts.orderNumber))) {
        throw new PaymentError('bad_response', { provider: PROVIDER, detail: 'order_reference' })
      }
      const knownCurrency = (CURRENCIES as readonly string[]).includes(currency) ? (currency as Currency) : undefined
      const amountMinor = knownCurrency ? decimalToMinor(price, knownCurrency) ?? undefined : undefined
      const paidMinor = knownCurrency ? decimalToMinor(paidPrice, knownCurrency) ?? undefined : undefined
      const base = {
        provider: PROVIDER,
        providerRef: token,
        orderNumber: conversationId || undefined,
        providerPaymentId: paymentId || undefined,
        // Our checkout never allows a different paidPrice; if it differs, report the mismatch to the state machine.
        amountMinor: amountMinor !== undefined && amountMinor === paidMinor ? amountMinor : undefined,
        currency: knownCurrency,
      }
      if (paymentStatus === 'SUCCESS') {
        if (json.fraudStatus === 1 && (json.installment === undefined || json.installment === 1)) return { ...base, status: 'paid' }
        if (json.fraudStatus === -1) return { ...base, status: 'failed', failureCode: 'fraud_rejected' }
        return { ...base, status: 'review' }
      }
      if (paymentStatus === 'FAILURE') return { ...base, status: 'failed', failureCode: safeCode(json.errorCode, 'payment_failed') }
      return { ...base, status: 'pending' }
    },

    verifyWebhook(rawBody: string, headers: HeaderLike): WebhookVerification {
      if (isTooLarge(rawBody)) return { ok: false, reason: 'too_large' }
      const signature = readHeader(headers, 'x-iyz-signature-v3')
      if (!signature) return { ok: false, reason: 'missing_signature' }
      let body: Record<string, unknown>
      try {
        const parsed: unknown = JSON.parse(rawBody)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, reason: 'malformed' }
        body = parsed as Record<string, unknown>
      } catch {
        return { ok: false, reason: 'malformed' }
      }
      const payload: IyzicoWebhookPayload = {
        iyziEventType: str(body.iyziEventType) ?? '',
        paymentConversationId: str(body.paymentConversationId) ?? '',
        status: str(body.status) ?? '',
        token: str(body.token),
        iyziPaymentId: str(body.iyziPaymentId),
        paymentId: str(body.paymentId),
      }
      if (!payload.iyziEventType || !payload.paymentConversationId || !payload.status ||
          (payload.token ? !payload.iyziPaymentId || !TOKEN_RE.test(payload.token) : !payload.paymentId)) return { ok: false, reason: 'malformed' }
      if (!verifyIyzicoWebhookSignature(config.secretKey.reveal(), payload, signature)) return { ok: false, reason: 'invalid_signature' }
      // Only signed fields are used below; other body fields are untrusted.
      const paymentRef = payload.token ?? String(payload.paymentId ?? payload.iyziPaymentId ?? '')
      return {
        ok: true,
        event: {
          provider: PROVIDER,
          eventId: iyzicoEventId({ eventType: payload.iyziEventType, paymentRef, status: payload.status }),
          type: payload.iyziEventType,
          providerRef: payload.token,
          providerPaymentId: str(payload.token ? payload.iyziPaymentId : payload.paymentId),
          orderNumber: payload.paymentConversationId,
        },
      }
    },

    async refund(input: RefundInput): Promise<RefundResult> {
      if (!isValidMinor(input.amountMinor) || input.amountMinor === 0 || !input.providerPaymentId) {
        throw new PaymentError('invalid_input', { provider: PROVIDER, detail: 'refund' })
      }
      const price = minorToDecimal(input.amountMinor, input.currency)
      const json = await call(IYZICO_PATHS.refund, {
        locale: 'tr',
        conversationId: input.orderNumber,
        paymentId: input.providerPaymentId,
        price,
        currency: input.currency,
        ...(input.ip ? { ip: input.ip } : {}),
      })
      if (json.status !== 'success') return { ok: false, failureCode: safeCode(json.errorCode, 'refund_failed') }
      // Refund response signature: paymentId, price, currency, conversationId.
      const signed = verifyIyzicoResponseSignature(
        config.secretKey.reveal(),
        [str(json.paymentId) ?? '', iyzicoSignaturePrice(str(json.price) ?? ''), str(json.currency) ?? '', str(json.conversationId) ?? ''],
        json.signature,
      )
      if (!signed) throw new PaymentError('signature_mismatch', { provider: PROVIDER })
      if (str(json.paymentId) !== input.providerPaymentId || str(json.conversationId) !== input.orderNumber ||
          str(json.currency) !== input.currency || decimalToMinor(str(json.price) ?? '', input.currency) !== input.amountMinor) {
        throw new PaymentError('bad_response', { provider: PROVIDER, detail: 'refund_mismatch' })
      }
      return { ok: true, status: 'succeeded', providerRefundId: str(json.paymentTransactionId) }
    },
  }
}
