import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { closedCommerceState, computeCommerceState } from '../../src/lib/payments/commerce-state'
import { QUOTE_ACTION, resolveProductActions } from '../../src/lib/payments/actions'
import { displayMinor, formatMoney, splitPrices, taxLabelKey } from '../../src/lib/payments/format'
import { productOffersJsonLd } from '../../src/lib/payments/json-ld'
import { COMMERCE_LEGAL_KINDS, COMMERCE_LEGAL_SLUGS, isCommerceLegalHref, isCommerceLegalSlug } from '../../src/lib/payments/legal'
import { formatMinorForInput, parsePriceInput } from '../../src/lib/payments/price-input'
import { buildReadiness } from '../../src/lib/payments/readiness'

/* P3 pure checks: getCommerceState matrix, fail-to-quote, product actions, money display, JSON-LD, legal slugs, readiness, price entry. */

const ENV_OK = { PAYMENTS_ENABLED: 'true', IYZICO_API_KEY: 'k', IYZICO_SECRET_KEY: 's', IYZICO_BASE_URL: 'https://sandbox-api.iyzipay.com' }
const settings = (over: Record<string, unknown> = {}) => ({
  commerce: {
    mode: 'payments',
    providers: { iyzico: { enabled: true }, stripe: { enabled: false } },
    vat: { try: { rule: 'rate', ratePercent: 20, rateBasisPoints: 2000 }, usd: { rule: 'exempt' } },
    ...over,
  },
})
const edition = (over: Record<string, unknown> = {}) => ({
  sku: 'PRO', saleMode: 'buy', pricing: { taxMode: 'inclusive', tryMinor: 125000, usdMinor: 4000 }, ...over,
})

describe('computeCommerceState (env × site mode × provider × VAT)', () => {
  it('is open only when every layer agrees', () => {
    const s = computeCommerceState({ legalReady: true, env: ENV_OK, siteSettings: settings() })
    expect(s).toMatchObject({ capability: true, siteMode: 'payments', open: true, availableProviders: ['iyzico'], checkoutReady: true, checkoutOpen: true })
  })

  const closed: [string, Record<string, string | undefined>, unknown][] = [
    ['env capability missing', { ...ENV_OK, PAYMENTS_ENABLED: undefined }, settings()],
    ['env capability "1" (not "true")', { ...ENV_OK, PAYMENTS_ENABLED: '1' }, settings()],
    ['env capability uppercase', { ...ENV_OK, PAYMENTS_ENABLED: 'TRUE' }, settings()],
    ['env capability padded', { ...ENV_OK, PAYMENTS_ENABLED: ' true' }, settings()],
    ['site mode quote-only', ENV_OK, settings({ mode: 'quote-only' })],
    ['site mode unknown spelling', ENV_OK, settings({ mode: 'payment' })],
    ['no site settings', ENV_OK, null],
    ['provider disabled in settings', ENV_OK, settings({ providers: { iyzico: { enabled: false } } })],
    ['provider keys missing in env', { PAYMENTS_ENABLED: 'true' }, settings()],
    ['bad iyzico base url', { ...ENV_OK, IYZICO_BASE_URL: 'https://evil.example' }, settings()],
    ['stripe enabled in settings but off in env', ENV_OK, settings({ providers: { stripe: { enabled: true } } })],
    ['no VAT rule', ENV_OK, settings({ vat: {} })],
    ['VAT basis points disagree with percent', ENV_OK, settings({ vat: { try: { rule: 'rate', ratePercent: 20, rateBasisPoints: 1800 } } })],
  ]
  it.each(closed)('is closed: %s', (_, env, site) => {
    expect(computeCommerceState({ env, siteSettings: site }).open).toBe(false)
  })

  it('checkoutOpen needs the checkoutReady flag in addition to open', () => {
    expect(computeCommerceState({ legalReady: true, env: ENV_OK, siteSettings: settings(), checkoutReady: true }).checkoutOpen).toBe(true)
    expect(computeCommerceState({ legalReady: true, env: ENV_OK, siteSettings: settings(), checkoutReady: false }).checkoutOpen).toBe(false)
    expect(computeCommerceState({ env: {}, siteSettings: settings(), checkoutReady: true }).checkoutOpen).toBe(false)
  })

  it('the shipped flag is on (P5 checkout exists); `open` still gates everything', () => {
    expect(computeCommerceState({ legalReady: true, env: ENV_OK, siteSettings: settings() }).checkoutReady).toBe(true)
    expect(computeCommerceState({ legalReady: true, env: {}, siteSettings: settings() }).checkoutOpen).toBe(false)
    expect(computeCommerceState({ legalReady: false, env: ENV_OK, siteSettings: settings() }).checkoutOpen).toBe(false)
  })

  it('closedCommerceState is fully closed', () => {
    expect(closedCommerceState()).toMatchObject({ open: false, checkoutOpen: false, availableProviders: [], siteMode: 'quote-only' })
  })
})

describe('resolveProductActions (fail-to-quote matrix)', () => {
  const open = (checkoutReady = false) => computeCommerceState({ legalReady: true, env: ENV_OK, siteSettings: settings(), checkoutReady })
  const run = (editions: unknown[], state = open()) => resolveProductActions({ editions, state })

  it('quote-only / closed: every edition is quote and the hero stays on "Teklif İste"', () => {
    const r = resolveProductActions({ editions: [edition(), edition({ sku: 'B' })], state: closedCommerceState() })
    expect(r.editions).toEqual([QUOTE_ACTION, QUOTE_ACTION])
    expect(r.heroPrimary).toBe('quote')
  })

  it('open: a priced buy edition resolves to buy with prices, others stay quote', () => {
    const r = run([edition(), edition({ sku: 'Q', saleMode: 'quote' }), edition({ sku: 'N', pricing: { taxMode: 'inclusive' } })])
    expect(r.editions[0]).toMatchObject({ kind: 'buy', taxMode: 'inclusive', checkout: false })
    expect(r.editions[0]!.kind === 'buy' && r.editions[0]!.prices.map((p) => p.currency)).toEqual(['TRY', 'USD'])
    expect(r.editions[1]).toEqual(QUOTE_ACTION)
    expect(r.editions[2]).toEqual(QUOTE_ACTION)
  })

  it('currencies without VAT or without price are dropped (USD without a VAT rule is not sold)', () => {
    const state = computeCommerceState({ legalReady: true, env: ENV_OK, siteSettings: settings({ vat: { try: { rule: 'rate', ratePercent: 20, rateBasisPoints: 2000 } } }) })
    const a = run([edition()], state).editions[0]!
    expect(a.kind === 'buy' && a.prices.map((p) => p.currency)).toEqual(['TRY'])
    expect(run([edition({ pricing: { taxMode: 'inclusive', usdMinor: 5000 } })], state).editions[0]).toEqual(QUOTE_ACTION)
  })

  it.each([
    ['zero price', { taxMode: 'inclusive', tryMinor: 0 }],
    ['negative price', { taxMode: 'inclusive', tryMinor: -5 }],
    ['float price', { taxMode: 'inclusive', tryMinor: 12.5 }],
    ['string price', { taxMode: 'inclusive', tryMinor: '1250' }],
    ['missing tax mode', { tryMinor: 125000 }],
    ['unknown tax mode', { taxMode: 'net', tryMinor: 125000 }],
  ])('invalid pricing falls back to quote: %s', (_, pricing) => {
    expect(run([edition({ pricing })]).editions[0]).toEqual(QUOTE_ACTION)
  })

  it('a missing/odd saleMode is quote', () => {
    expect(run([edition({ saleMode: undefined }), edition({ saleMode: 'purchase' })]).editions).toEqual([QUOTE_ACTION, QUOTE_ACTION])
  })

  it('hero primary becomes "buy" only when checkout is reachable', () => {
    expect(run([edition()], open(false)).heroPrimary).toBe('quote')
    expect(run([edition()], open(true)).heroPrimary).toBe('buy')
    expect(run([edition({ saleMode: 'quote' })], open(true)).heroPrimary).toBe('quote')
    // checkout flag without open state never opens anything
    expect(run([edition()], computeCommerceState({ env: {}, siteSettings: settings(), checkoutReady: true })).heroPrimary).toBe('quote')
  })

  it('checkout flag is carried per action', () => {
    expect(run([edition()], open(true)).editions[0]).toMatchObject({ kind: 'buy', checkout: true })
    expect(run([edition()], open(false)).editions[0]).toMatchObject({ kind: 'buy', checkout: false })
  })
})

describe('price display', () => {
  const state = computeCommerceState({ legalReady: true, env: ENV_OK, siteSettings: settings({ vat: { try: { rule: 'rate', ratePercent: 20, rateBasisPoints: 2000 }, usd: { rule: 'exempt' } } }) })
  const prices = (e: unknown) => {
    const a = resolveProductActions({ editions: [e], state }).editions[0]!
    if (a.kind !== 'buy') throw new Error('expected buy')
    return a
  }

  it('formats TR/EN with Intl from the exact decimal string', () => {
    expect(formatMoney(125000, 'TRY', 'tr')).toMatch(/^₺1\.250,00$/)
    expect(formatMoney(125000, 'TRY', 'en')).toMatch(/^TRY\s1,250\.00$/)
    expect(formatMoney(4000, 'USD', 'en')).toBe('$40.00')
    expect(formatMoney(4000, 'USD', 'tr')).toMatch(/^\$40,00$/)
    expect(formatMoney(1, 'EUR', 'en')).toBe('€0.01')
    expect(formatMoney(100_000_001, 'EUR', 'en')).toBe('€1,000,000.01')
    expect(formatMoney(0, 'TRY', 'tr')).toBe('₺0,00')
    expect(formatMoney(1_000_000_000, 'USD', 'en')).toBe('$10,000,000.00')
    for (const value of [-1, Number.MAX_SAFE_INTEGER, NaN, Infinity]) expect(() => formatMoney(value, 'USD', 'en')).toThrow(RangeError)
  })

  it('inclusive shows gross + "VAT included"; exclusive shows net + "VAT excluded"; exempt says exempt', () => {
    const incl = prices(edition())
    expect(displayMinor(incl.prices[0]!, 'inclusive')).toBe(125000)
    expect(taxLabelKey(incl.prices[0]!, 'inclusive')).toBe('vatIncluded')
    const excl = prices(edition({ pricing: { taxMode: 'exclusive', tryMinor: 100000, usdMinor: 4000 } }))
    expect(displayMinor(excl.prices[0]!, 'exclusive')).toBe(100000)
    expect(taxLabelKey(excl.prices[0]!, 'exclusive')).toBe('vatExcluded')
    expect(taxLabelKey(excl.prices[1]!, 'exclusive')).toBe('vatExempt')
    expect(displayMinor(excl.prices[1]!, 'exclusive')).toBe(4000)
  })

  it('headline currency follows the locale', () => {
    const { prices: p } = prices(edition())
    expect(splitPrices(p, 'tr')!.primary.currency).toBe('TRY')
    expect(splitPrices(p, 'en')!.primary.currency).toBe('USD')
    expect(splitPrices(p, 'en')!.others.map((o) => o.currency)).toEqual(['TRY'])
    expect(splitPrices([], 'tr')).toBeNull()
  })
})

describe('JSON-LD offers', () => {
  const state = computeCommerceState({ legalReady: true, env: ENV_OK, siteSettings: settings() })
  const editions = [{ sku: 'PRO', title: 'Pro' }, { sku: 'Q', title: 'Quote' }]

  it('quote-only: no `offers` key at all', () => {
    const r = resolveProductActions({ editions: [edition(), edition({ sku: 'Q' })], state: closedCommerceState() })
    expect(productOffersJsonLd(editions, r.editions, 'https://x/y')).toEqual({})
    expect(productOffersJsonLd(editions, undefined, 'https://x/y')).toEqual({})
    expect(productOffersJsonLd([], [], 'https://x/y')).toEqual({})
  })

  it('payments mode: one Offer per priced edition and currency, none for quote editions', () => {
    const r = resolveProductActions({ editions: [edition(), edition({ sku: 'Q', saleMode: 'quote' })], state })
    const { offers } = productOffersJsonLd(editions, r.editions, 'https://x/y')
    expect(offers!.map((o) => o.priceCurrency)).toEqual(['TRY', 'USD'])
    expect(offers![0]).toMatchObject({ '@type': 'Offer', sku: 'PRO', price: '1250.00', priceCurrency: 'TRY', availability: 'https://schema.org/InStock', url: 'https://x/y', priceSpecification: { valueAddedTaxIncluded: true } })
  })

  it('exclusive price uses the net amount and says VAT is not included', () => {
    const r = resolveProductActions({ editions: [edition({ pricing: { taxMode: 'exclusive', tryMinor: 100000 } })], state })
    const { offers } = productOffersJsonLd([editions[0]!], r.editions, 'https://x/y')
    expect(offers![0]).toMatchObject({ price: '1000.00', priceSpecification: { valueAddedTaxIncluded: false } })
  })
})

describe('commerce legal slugs', () => {
  it('knows the six sales slugs and nothing else', () => {
    for (const slug of [...COMMERCE_LEGAL_SLUGS.tr, ...COMMERCE_LEGAL_SLUGS.en]) expect(isCommerceLegalSlug(slug)).toBe(true)
    for (const slug of ['kvkk-aydinlatma', 'eula', 'gizlilik-politikasi', 'kullanim-kosullari', 'cerez-politikasi', '', undefined]) expect(isCommerceLegalSlug(slug)).toBe(false)
  })
  it('recognizes normalized paths and same-origin absolute links without hiding other sites', () => {
    const origin = 'https://softmarket.example'
    for (const href of [
      '/tr/yasal/./iade-ve-cayma', '/tr/a/../yasal/iade-ve-cayma',
      '/tr/%79asal/iade-ve-cayma', '/tr/yasal//iade-ve-cayma',
      `${origin}/tr/yasal/iade-ve-cayma?x=1`,
    ]) expect(isCommerceLegalHref(href, origin)).toBe(true)
    expect(isCommerceLegalHref('https://elsewhere.example/tr/yasal/iade-ve-cayma', origin)).toBe(false)
  })
  it('matches hrefs with/without locale prefix, query, hash and encoding', () => {
    expect(isCommerceLegalHref('/yasal/mesafeli-satis-sozlesmesi')).toBe(true)
    expect(isCommerceLegalHref('/tr/yasal/iade-ve-cayma/')).toBe(true)
    expect(isCommerceLegalHref('/en/legal/refund-and-withdrawal#x')).toBe(true)
    expect(isCommerceLegalHref('/yasal/on-bilgilendirme-formu?a=1')).toBe(true)
    expect(isCommerceLegalHref('/yasal/%6Desafeli-satis-sozlesmesi')).toBe(true)
    expect(isCommerceLegalHref('/yasal/eula')).toBe(false)
    expect(isCommerceLegalHref('/urunler/iade-ve-cayma')).toBe(false)
    expect(isCommerceLegalHref('https://x.example/yasal/eula')).toBe(false)
    expect(isCommerceLegalHref('/yasal/%E0%A4%A')).toBe(false)
    expect(isCommerceLegalHref(null)).toBe(false)
  })
})

const ALL_LEGAL = COMMERCE_LEGAL_KINDS.flatMap((kind) => (['tr', 'en'] as const).map((locale) => ({ kind, locale, published: true, draft: false })))

describe('readiness checklist', () => {
  const full = {
    env: { ...ENV_OK, SMTP_HOST: 'smtp.example.com', SMTP_FROM: 'a@b.c' },
    siteSettings: settings(),
    editions: [edition(), edition({ sku: 'NP', pricing: { taxMode: 'inclusive' } }), edition({ sku: 'Q', saleMode: 'quote' })],
    legalPages: ALL_LEGAL,
  }
  const level = (r: ReturnType<typeof buildReadiness>, id: string) => r.items.find((i) => i.id === id)!.level

  it('reports each prerequisite separately and the sandbox environment, never a secret', () => {
    const r = buildReadiness(full)
    expect(r.environment).toBe('sandbox')
    expect(r.ready).toBe(true)
    for (const id of ['capability', 'provider-env', 'provider-enabled', 'vat', 'buy-editions', 'legal', 'smtp']) expect(level(r, id)).toBe('ok')
    expect(level(r, 'checkout')).toBe('ok')
    expect(r.items.find((i) => i.id === 'buy-editions')!.detail!.en).toBe('1 ready, 1 without a usable price')
    expect(JSON.stringify(r)).not.toMatch(/"k"|"s"|IYZICO_SECRET/)
  })

  it('flags what is missing', () => {
    const r = buildReadiness({ env: {}, siteSettings: null, editions: [], legalPages: [{ kind: 'distanceSales', locale: 'tr', published: true, draft: true }] })
    expect(r.ready).toBe(false)
    expect(r.environment).toBeNull()
    for (const id of ['capability', 'provider-env', 'provider-enabled', 'vat', 'buy-editions', 'legal', 'smtp']) expect(level(r, id)).toBe('missing')
  })

  it('does not call a buy edition ready when its price has no usable VAT/provider route', () => {
    const r = buildReadiness({ ...full, editions: [edition({ pricing: { taxMode: 'inclusive', eurMinor: 5000 } })] })
    expect(level(r, 'buy-editions')).toBe('missing')
    expect(r.ready).toBe(false)
  })

  it('reports the environment of enabled providers, including mixed sandbox/live', () => {
    const env = { ...full.env, PAYMENTS_STRIPE_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_live_123', STRIPE_WEBHOOK_SECRET: 'whsec_123' }
    expect(buildReadiness({ ...full, env, siteSettings: settings({ providers: { stripe: { enabled: true } } }) }).environment).toBe('live')
    expect(buildReadiness({ ...full, env, siteSettings: settings({ providers: { iyzico: { enabled: true }, stripe: { enabled: true } } }) }).environment).toBe('mixed')
  })

  it('SMTP placeholders do not count', () => {
    expect(level(buildReadiness({ ...full, env: { ...full.env, SMTP_HOST: 'CHANGE_ME' } }), 'smtp')).toBe('missing')
  })
})

describe('admin price entry (decimal text ↔ integer minor units)', () => {
  it.each([
    ['1.250,00', 125000], ['1,250.00', 125000], ['1250', 125000], ['1250,5', 125050], ['1250.5', 125050],
    ['1.250', 125000], ['1,250', 125000], ['1.234.567,89', 123456789], ['0,01', 1], ['0.99', 99], ['  1 250,00 ', 125000],
    ['1.250,50', 125050], ['99,9', 9990], ['10', 1000],
  ])('parses %s → %d', (text, minor) => {
    expect(parsePriceInput(text, 'TRY')).toBe(minor)
  })

  it.each(['', ' ', 'abc', '1.2.3', '12,345,6', '1,250.00.00', '1.250,00,1', '1,2345', '1.', ',5', '-5', '1e3', '$12', '1.25a', '1,25,000', '1.250,000', '99999999999999', '١٢', '１２', '1e+3', '+5', '1.2.34'])(
    'rejects %j', (text) => {
      expect(parsePriceInput(text, 'TRY')).toBeNull()
    })

  it('has no floating point error', () => {
    // 0.1 + 0.2 style traps and large values stay exact integers.
    expect(parsePriceInput('0,29', 'TRY')).toBe(29)
    expect(parsePriceInput('1.005,10', 'TRY')).toBe(100510)
    expect(parsePriceInput('4.35', 'USD')).toBe(435)
    expect(parsePriceInput('9999999,99', 'EUR')).toBe(999999999)
  })

  it('formats back per locale and round-trips', () => {
    expect(formatMinorForInput(125000, 'TRY', 'tr')).toBe('1.250,00')
    expect(formatMinorForInput(125000, 'TRY', 'en')).toBe('1,250.00')
    expect(formatMinorForInput(5, 'USD', 'en')).toBe('0.05')
    expect(formatMinorForInput(-1, 'USD', 'en')).toBe('')
    for (const minor of [1, 99, 100, 125000, 999999999]) {
      for (const locale of ['tr', 'en']) expect(parsePriceInput(formatMinorForInput(minor, 'TRY', locale), 'TRY')).toBe(minor)
    }
  })
})

describe('payment code stays out of client bundles', () => {
  const SRC = join(process.cwd(), 'src')
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n)
      return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : []
    })
  const code = (p: string) => readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')

  it('only the admin price field (pure parsing modules) is a client component importing src/lib/payments', () => {
    const offenders = walk(SRC)
      .filter((p) => /^\s*['"]use client['"]/.test(readFileSync(p, 'utf8')))
      .filter((p) => /from ['"]@\/lib\/payments\//.test(code(p)))
      .map((p) => p.slice(SRC.length + 1))
    expect(offenders).toEqual(['admin/fields/price-minor-field.tsx'])
    const imports = [...code(join(SRC, 'admin/fields/price-minor-field.tsx')).matchAll(/from ['"]@\/lib\/payments\/([\w-]+)['"]/g)].map((m) => m[1])
    expect(imports.sort()).toEqual(['price-input', 'types'])
  })

  it.each(['price-input', 'money', 'types'])('%s (client-reachable) has no node: or secret/provider imports', (name) => {
    const imports = [...code(join(SRC, `lib/payments/${name}.ts`)).matchAll(/from ['"]([^'"]+)['"]/g)].map((m) => m[1]!)
    expect(imports.filter((i) => i.startsWith('node:') || /secret|env|providers|signature/.test(i))).toEqual([])
  })
})
