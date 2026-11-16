import type { EditionAction } from './actions'
import { displayMinor } from './format'
import { minorToDecimal } from './money'

/**
 * schema.org `offers` for the product JSON-LD. Returned as a spreadable fragment: `{}` unless at least one edition
 * has a `buy` action, so a quote-only site's JSON-LD is byte-identical to the pre-P3 one (no `offers` key).
 * One Offer per edition and currency; the price is what the page shows (gross for VAT-inclusive, net for
 * VAT-excluded) and `valueAddedTaxIncluded` says which.
 */
export function productOffersJsonLd(
  editions: readonly { sku: string; title?: string | null }[] | undefined,
  actions: readonly EditionAction[] | undefined,
  url: string,
): { offers?: Record<string, unknown>[] } {
  if (!editions?.length || !actions?.length) return {}
  const offers: Record<string, unknown>[] = []
  editions.forEach((edition, i) => {
    const action = actions[i]
    if (action?.kind !== 'buy') return
    for (const price of action.prices) {
      const amount = minorToDecimal(displayMinor(price, action.taxMode), price.currency)
      offers.push({
        '@type': 'Offer',
        sku: edition.sku,
        ...(edition.title ? { name: edition.title } : {}),
        price: amount,
        priceCurrency: price.currency,
        url,
        availability: 'https://schema.org/InStock',
        priceSpecification: {
          '@type': 'UnitPriceSpecification', price: amount, priceCurrency: price.currency,
          valueAddedTaxIncluded: action.taxMode === 'inclusive' || price.exempt,
        },
      })
    }
  })
  return offers.length ? { offers } : {}
}
