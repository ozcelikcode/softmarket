import { renderToReadableStream } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ layout: [] as unknown[], editions: [] as unknown[], commerce: undefined as unknown }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key),
  setRequestLocale: () => {},
}))
vi.mock('@/components/sections/json-ld', () => ({ JsonLd: ({ data }: { data: unknown }) => <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} /> }))
vi.mock('@/components/layout/set-alternates', () => ({ SetAlternates: () => null }))
vi.mock('@/lib/content', () => ({
  mediaOf: () => null,
  getProductVariants: async () => ({}),
  getProductDetail: async () => ({
    family: { title: 'Family' },
    product: { id: 1, title: 'Product', summary: 'Overview', layout: state.layout, features: [], specs: [], systemRequirements: [] },
    editions: state.editions, downloads: [], docSlug: null,
    ...(state.commerce ? { commerce: state.commerce } : {}),
  }),
}))

import ProductPage from '@/app/(frontend)/[locale]/urunler/[family]/[product]/page'
import { EditionCard } from '@/components/product/edition-card'
import { closedCommerceState, computeCommerceState } from '@/lib/payments/commerce-state'
import { resolveProductActions } from '@/lib/payments/actions'
import type { Edition } from '@/payload-types'
import { LegacyEditionCard } from '../fixtures/legacy-edition-card'

const html = async (node: unknown) => new Response(await renderToReadableStream(node as never)).text()
const ENV = { PAYMENTS_ENABLED: 'true', IYZICO_API_KEY: 'k', IYZICO_SECRET_KEY: 's', IYZICO_BASE_URL: 'https://sandbox-api.iyzipay.com' }
const SITE = { commerce: { mode: 'payments', providers: { iyzico: { enabled: true } }, vat: { try: { rule: 'rate', ratePercent: 20, rateBasisPoints: 2000 }, usd: { rule: 'exempt' } } } }
const edition = {
  id: 7, sku: 'PRO-1Y', title: 'Pro', description: 'Desc', licenseType: 'subscription', durationMonths: 12, seats: 5,
  highlights: [{ id: 'h1', text: 'One' }, { id: 'h2', text: 'Two' }],
} as unknown as Edition
const priced = { ...edition, saleMode: 'buy', pricing: { taxMode: 'inclusive', tryMinor: 125000, usdMinor: 4000 } }
const actionsFor = (editions: unknown[], checkoutReady: boolean, env = ENV) =>
  resolveProductActions({ editions, state: computeCommerceState({ env, siteSettings: SITE, checkoutReady }) })

describe('quote-only: byte-identical to the pre-P3 markup', () => {
  it.each(['tr', 'en'])('EditionCard (%s) default action equals the frozen legacy component', async (locale) => {
    const args = { edition, productSlug: 'urun', locale }
    expect(await html(await EditionCard(args))).toBe(await html(await LegacyEditionCard(args)))
  })

  it('EditionCard with an explicit quote action (closed state) equals the legacy component', async () => {
    const { editions: [action] } = resolveProductActions({ editions: [priced], state: closedCommerceState() })
    expect(await html(await EditionCard({ edition, productSlug: 'urun', locale: 'tr', action }))).toBe(await html(await LegacyEditionCard({ edition, productSlug: 'urun', locale: 'tr' })))
  })

  it('a product page with quote-only commerce data equals one without any commerce data; no price/buy/offers trace', async () => {
    state.layout = []
    state.editions = [edition, { ...edition, id: 8, sku: 'ENT', title: 'Enterprise' }]
    state.commerce = undefined
    const plain = await html(await ProductPage({ params: Promise.resolve({ locale: 'tr', family: 'f', product: 'p' }) }))
    state.commerce = resolveProductActions({ editions: [priced, priced], state: closedCommerceState() })
    const quoteOnly = await html(await ProductPage({ params: Promise.resolve({ locale: 'tr', family: 'f', product: 'p' }) }))
    expect(quoteOnly).toBe(plain)
    expect(quoteOnly).not.toMatch(/data-edition-price|"buy"|>buy<|corporateQuote|vatIncluded|"offers"|checkout|satin-al|₺/)
    expect(quoteOnly).toContain('/tr/teklif-iste?urun=p&amp;surum=PRO-1Y')
  })
})

describe('payments mode (checkout flag off): price, disabled buy, corporate quote link, no checkout link', () => {
  const render = async (locale: string, commerce = actionsFor([priced], false)) => {
    state.editions = [edition]
    state.commerce = commerce
    state.layout = []
    return html(await ProductPage({ params: Promise.resolve({ locale, family: 'f', product: 'p' }) }))
  }

  it('TR: price with Intl format and VAT label, disabled buy button, S2 link, quote kept', async () => {
    const out = await render('tr')
    expect(out).toContain('data-edition-price')
    expect(out).toMatch(/₺1\.250,00/)
    expect(out).toContain('vatIncluded')
    expect(out).toMatch(/<button[^>]*disabled[^>]*aria-disabled="true"[^>]*>buy<\/button>/)
    expect(out).toContain('buySoon')
    expect(out).toContain('corporateQuote')
    expect(out).toContain('/tr/teklif-iste?urun=p&amp;surum=PRO-1Y')
    expect(out).not.toMatch(/satin-al|checkout/)
    // hero primary stays "Teklif İste" while checkout does not exist
    expect(out.indexOf('/tr/teklif-iste?urun=p"')).toBeGreaterThan(-1)
  })

  it('EN: dollar headline first, TRY listed as the other currency', async () => {
    const out = await render('en')
    expect(out).toMatch(/\$40\.00/)
    expect(out).toMatch(/TRY\s1,250\.00/)
    expect(out).not.toMatch(/satin-al|checkout/)
  })

  it('JSON-LD carries offers only here', async () => {
    const out = await render('tr')
    const ld = [...out.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].map((m) => JSON.parse(m[1]!.replace(/&quot;/g, '"').replace(/&amp;/g, '&')))
    const product = ld.find((d) => d['@type'] === 'Product')
    expect(product.offers).toEqual(expect.arrayContaining([expect.objectContaining({ sku: 'PRO-1Y', price: '1250.00', priceCurrency: 'TRY' })]))
  })

  it('an unpriced buy edition renders exactly the quote card', async () => {
    const out = await render('tr', actionsFor([{ ...edition, saleMode: 'buy', pricing: { taxMode: 'inclusive' } }], false))
    expect(out).not.toContain('data-edition-price')
    expect(out).not.toContain('corporateQuote')
  })
})

describe('payments mode with the checkout flag on (P5 behaviour, flag forced in the test)', () => {
  it('buy links to the checkout, hero primary is "buy", quote stays available', async () => {
    state.editions = [edition]
    state.commerce = actionsFor([priced], true)
    state.layout = []
    const out = await html(await ProductPage({ params: Promise.resolve({ locale: 'tr', family: 'f', product: 'p' }) }))
    expect(out).toContain('/tr/hesap/satin-al/PRO-1Y')
    expect(out).not.toMatch(/<button[^>]*disabled/)
    expect(out).toContain('corporateQuote')
    expect(out.indexOf('>buy<')).toBeLessThan(out.indexOf('>quote<'))
  })
})
