/**
 * P1 payment core: shared types. Server-only by design (adapters import node:crypto).
 * No Payload schema exists yet; these types are hand-written and independent of payload-types.
 */

export const CURRENCIES = ['TRY', 'USD', 'EUR'] as const
export type Currency = (typeof CURRENCIES)[number]

export const PROVIDER_IDS = ['iyzico', 'stripe'] as const
export type ProviderId = (typeof PROVIDER_IDS)[number]

export type ProviderEnv = 'sandbox' | 'live'

/** Minimal fetch signature so adapters can be tested without network. */
export type FetchLike = (
  input: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal; redirect?: 'error' },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>

export type HeaderLike = Headers | Record<string, string | string[] | undefined>

/** Buyer snapshot copied from the order billing group (P2-S). iyzico requires these fields. */
export type BuyerSnapshot = {
  /** Stable customer id (never e-mail). */
  id: string
  name: string
  surname: string
  email: string
  /** TCKN (11) for individuals; iyzico also accepts VKN-bearing corporate buyers with a placeholder rule (P0/P4). */
  identityNumber: string
  gsmNumber: string
  address: string
  city: string
  country: string
  zipCode?: string
  /** Buyer IP as seen by Caddy (verified header). */
  ip: string
}

export type CheckoutInput = {
  /** Public order number (SM-YYMMDD-XXXXXX); used as conversationId / client_reference_id. */
  orderNumber: string
  /** Order idempotency key (stable across retries of the same checkout submit). */
  idempotencyKey: string
  currency: Currency
  /** Gross amount charged, integer minor units (kuruş/cent). Computed on the server only. */
  totalMinor: number
  locale: 'tr' | 'en'
  item: { sku: string; title: string }
  buyer: BuyerSnapshot
  urls: {
    /** iyzico POSTs the token here (cross-site). */
    callbackUrl: string
    /** Stripe success URL; may contain {CHECKOUT_SESSION_ID}. */
    successUrl: string
    cancelUrl: string
  }
  /** Absolute expiry (Stripe expires_at, min 30 min). */
  expiresAt: Date
}

export type CheckoutSession = {
  provider: ProviderId
  providerEnv: ProviderEnv
  /** iyzico token / Stripe Checkout Session id. Stored as order.providerRef. */
  providerRef: string
  /** Hosted page URL (full-page 303 redirect; SAQ-A: card data never touches our server). */
  redirectUrl: string
  expiresAt?: Date
}

/** Provider-side truth, read with server credentials. Webhooks are only triggers for this read. */
export type ProviderPaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'review' | 'refunded'

export type ProviderPaymentState = {
  provider: ProviderId
  providerRef: string
  status: ProviderPaymentStatus
  /** Order number echoed back by the provider (conversationId / client_reference_id). */
  orderNumber?: string
  providerPaymentId?: string
  /** Basket amount in minor units as reported by the provider. */
  amountMinor?: number
  currency?: Currency
  /** Short code only, never the raw provider message. */
  failureCode?: string
}

export type VerifiedWebhookEvent = {
  provider: ProviderId
  /** Dedupe identity for payment-events (provider + eventId unique). */
  eventId: string
  type: string
  /** Reference used to look up the order and call retrieve(). */
  providerRef?: string
  /** For refund/dispute events (Stripe payment_intent, iyzico paymentId). */
  providerPaymentId?: string
  orderNumber?: string
}

export type WebhookVerification =
  | { ok: true; event: VerifiedWebhookEvent }
  | { ok: false; reason: 'missing_signature' | 'malformed' | 'invalid_signature' | 'timestamp_out_of_tolerance' | 'too_large' }

export type RefundInput = {
  orderNumber: string
  idempotencyKey: string
  providerPaymentId: string
  currency: Currency
  /** v1: full refund only (amount = order total). */
  amountMinor: number
  ip?: string
}

export type RefundResult =
  | { ok: true; providerRefundId?: string; status: 'succeeded' | 'pending' }
  | { ok: false; failureCode: string }

export interface PaymentProvider {
  readonly id: ProviderId
  readonly env: ProviderEnv
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>
  /** Server-to-server read of the real payment state (with response signature checks where available). */
  retrieve(providerRef: string, opts?: { orderNumber?: string; locale?: 'tr' | 'en' }): Promise<ProviderPaymentState>
  /** Verifies the raw body before any trust is placed in it. Never throws on bad input. */
  verifyWebhook(rawBody: string, headers: HeaderLike, now?: Date): WebhookVerification
  refund(input: RefundInput): Promise<RefundResult>
}
