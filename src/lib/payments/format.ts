import { minorToDecimal } from './money'
import type { PriceOffer } from './mode'
import { CURRENCIES, type Currency } from './types'

/*
 * Visitor-facing price formatting (server side, Intl). Amounts stay integer minor units until here; the Intl input
 * is the exact decimal STRING (`minorToDecimal`), so no floating point value is ever formatted.
 */

const INTL_LOCALE = { tr: 'tr-TR', en: 'en-US' } as const
type Locale = keyof typeof INTL_LOCALE

/** Currency order preferred per locale for the headline price. */
const PREFERRED: Record<Locale, readonly Currency[]> = { tr: ['TRY', 'USD', 'EUR'], en: ['USD', 'EUR', 'TRY'] }

export function formatMoney(minor: number, currency: Currency, locale: string): string {
  const intl = INTL_LOCALE[locale === 'en' ? 'en' : 'tr']
  const formatter = new Intl.NumberFormat(intl, { style: 'currency', currency })
  // Intl.NumberFormat accepts exact decimal strings (ES2023); the cast only satisfies older lib typings.
  return formatter.format(minorToDecimal(minor, currency) as unknown as number)
}

/** Amount shown to the visitor: gross for inclusive/exempt, net for "VAT excluded" prices. */
export function displayMinor(price: PriceOffer, taxMode: 'inclusive' | 'exclusive'): number {
  return taxMode === 'exclusive' && !price.exempt ? price.netMinor : price.totalMinor
}

export type TaxLabelKey = 'vatIncluded' | 'vatExcluded' | 'vatExempt'
export function taxLabelKey(price: PriceOffer, taxMode: 'inclusive' | 'exclusive'): TaxLabelKey {
  if (price.exempt) return 'vatExempt'
  return taxMode === 'exclusive' ? 'vatExcluded' : 'vatIncluded'
}

/** Headline price by locale preference; the remaining currencies follow in a fixed order. */
export function splitPrices(prices: readonly PriceOffer[], locale: string): { primary: PriceOffer; others: PriceOffer[] } | null {
  if (!prices.length) return null
  const order = PREFERRED[locale === 'en' ? 'en' : 'tr']
  const sorted = [...prices].sort((a, b) => order.indexOf(a.currency) - order.indexOf(b.currency))
  const [primary, ...others] = sorted
  return primary ? { primary, others } : null
}

export const isCurrency = (value: unknown): value is Currency => (CURRENCIES as readonly unknown[]).includes(value)

/** Locale-neutral checkout target (P5 route; only rendered when the checkout flag is on). */
export const checkoutHref = (sku: string) => `/hesap/satin-al/${encodeURIComponent(sku)}`
