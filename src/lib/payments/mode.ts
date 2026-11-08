import { isValidMinor } from './money'
import { computeAmounts, readVatRule, type AmountBreakdown, type TaxMode } from './tax'
import { CURRENCIES, type Currency, type ProviderId } from './types'

/**
 * Three-layer commerce mode (outermost wins), all pure and fail-closed:
 *   1. env PAYMENTS_ENABLED === 'true'            (operator capability)
 *   2. site-settings.commerce.mode                 ('quote-only' | 'payments')
 *   3. edition.saleMode                            ('quote' | 'buy')
 * The Payload schema does not exist yet (P2-S). Inputs are `unknown`; any missing or unknown
 * value is read as "quote only". The legacy plan spellings ('payment', 'purchase') are accepted
 * as aliases until P2-S fixes the stored values.
 */

export type SiteCommerceMode = 'quote-only' | 'payments'
export type EditionSaleMode = 'quote' | 'buy'

/** S3: after switching to quote-only, provider webhooks keep being processed for 72 hours. */
export const WEBHOOK_DRAIN_MS = 72 * 60 * 60 * 1000

export function readCapability(env: Record<string, string | undefined>): boolean {
  return env.PAYMENTS_ENABLED === 'true'
}

function prop(obj: unknown, key: string): unknown {
  return obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[key] : undefined
}

export function readSiteMode(siteSettings: unknown): SiteCommerceMode {
  const mode = prop(prop(siteSettings, 'commerce'), 'mode')
  return mode === 'payments' || mode === 'payment' ? 'payments' : 'quote-only'
}

export function readEditionSaleMode(edition: unknown): EditionSaleMode {
  const mode = prop(edition, 'saleMode')
  return mode === 'buy' || mode === 'purchase' ? 'buy' : 'quote'
}

export type CommerceGate = {
  capability: boolean
  siteMode: SiteCommerceMode
  /** New checkouts may start (capability AND site mode payments). S3: closes immediately on quote-only. */
  checkoutOpen: boolean
}

export function resolveCommerceGate(input: { env: Record<string, string | undefined>; siteSettings: unknown }): CommerceGate {
  const capability = readCapability(input.env)
  const siteMode = readSiteMode(input.siteSettings)
  return { capability, siteMode, checkoutOpen: capability && siteMode === 'payments' }
}

export type EditionMode =
  | { action: 'buy' }
  | { action: 'quote'; reason: 'capability_off' | 'site_quote_only' | 'edition_quote' }

export function resolveEditionMode(gate: CommerceGate, edition: unknown): EditionMode {
  if (!gate.capability) return { action: 'quote', reason: 'capability_off' }
  if (gate.siteMode !== 'payments') return { action: 'quote', reason: 'site_quote_only' }
  if (readEditionSaleMode(edition) !== 'buy') return { action: 'quote', reason: 'edition_quote' }
  return { action: 'buy' }
}

/**
 * S3 drain window. Webhooks/callbacks are processed when:
 *   - capability is on AND site mode is payments, or
 *   - capability is on AND mode is quote-only AND now ∈ [quoteSince, quoteSince + 72h).
 * Missing/invalid quoteSince or capability off → not processed (route returns 404).
 * The caller must additionally require a valid signature and an existing order during the drain.
 */
export function isWebhookProcessingAllowed(input: {
  capability: boolean
  siteMode: SiteCommerceMode
  quoteSince: unknown
  now: Date
}): boolean {
  if (!input.capability) return false
  if (input.siteMode === 'payments') return true
  const since = parseDate(input.quoteSince)
  if (!since) return false
  const elapsed = input.now.getTime() - since.getTime()
  return elapsed >= 0 && elapsed < WEBHOOK_DRAIN_MS
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'string' && value) {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

/**
 * Currency → provider routing. P0: Türkiye is not a Stripe-supported country, so iyzico is the
 * PRIMARY provider for TRY, USD and EUR. Stripe takes USD/EUR only when explicitly enabled
 * (PAYMENTS_STRIPE_ENABLED, e.g. a foreign legal entity). TRY never goes to Stripe.
 */
export function providerForCurrency(
  currency: Currency,
  opts: { stripeEnabled: boolean; stripeCurrencies: readonly Currency[] },
): ProviderId {
  if (currency !== 'TRY' && opts.stripeEnabled && opts.stripeCurrencies.includes(currency)) return 'stripe'
  return 'iyzico'
}

export type PriceOffer = AmountBreakdown & { provider: ProviderId }

export type EditionOffer = { kind: 'buy'; prices: PriceOffer[] } | { kind: 'quote' }

/**
 * Fail-to-quote: the edition is purchasable only if the mode says buy AND at least one currency has
 * a valid price, a VAT rule, and an available (enabled + configured) provider. A broken "Buy"
 * button can never appear.
 *
 * `edition.pricing` expected (P2-S): `{ taxMode: 'inclusive'|'exclusive', TRY?: minor, USD?: minor, EUR?: minor }`.
 */
export function resolveEditionOffer(input: {
  gate: CommerceGate
  edition: unknown
  vatSettings: unknown
  availableProviders: readonly ProviderId[]
  stripeEnabled: boolean
  stripeCurrencies: readonly Currency[]
}): EditionOffer {
  if (resolveEditionMode(input.gate, input.edition).action !== 'buy') return { kind: 'quote' }
  const pricing = prop(input.edition, 'pricing')
  const taxMode = prop(pricing, 'taxMode')
  if (taxMode !== 'inclusive' && taxMode !== 'exclusive') return { kind: 'quote' }

  const prices: PriceOffer[] = []
  for (const currency of CURRENCIES) {
    const priceMinor = prop(pricing, currency)
    if (!isValidMinor(priceMinor)) continue
    const provider = providerForCurrency(currency, input)
    if (!input.availableProviders.includes(provider)) continue
    const amounts = computeAmounts({
      currency,
      priceMinor,
      taxMode: taxMode as TaxMode,
      rule: readVatRule(input.vatSettings, currency),
    })
    if (amounts) prices.push({ ...amounts, provider })
  }
  return prices.length ? { kind: 'buy', prices } : { kind: 'quote' }
}
