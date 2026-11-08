import { describe, expect, it } from 'vitest'

import {
  isWebhookProcessingAllowed,
  providerForCurrency,
  readEditionSaleMode,
  readSiteMode,
  resolveCommerceGate,
  resolveEditionMode,
  resolveEditionOffer,
  WEBHOOK_DRAIN_MS,
} from '../../src/lib/payments/mode'

const ON = { PAYMENTS_ENABLED: 'true' }
const payments = { commerce: { mode: 'payments' } }
const buyEdition = { saleMode: 'buy' }

describe('three-layer mode matrix', () => {
  const envs = [
    { env: {}, cap: false },
    { env: { PAYMENTS_ENABLED: 'false' }, cap: false },
    { env: { PAYMENTS_ENABLED: '1' }, cap: false },
    { env: { PAYMENTS_ENABLED: 'TRUE' }, cap: false },
    { env: ON, cap: true },
  ]
  const sites: [unknown, boolean][] = [
    [undefined, false],
    [null, false],
    [{}, false],
    [{ commerce: {} }, false],
    [{ commerce: { mode: 'quote-only' } }, false],
    [{ commerce: { mode: 'bogus' } }, false],
    [payments, true],
  ]
  const editions: [unknown, boolean][] = [
    [undefined, false],
    [{}, false],
    [{ saleMode: 'quote' }, false],
    [{ saleMode: 'BUY' }, false],
    [buyEdition, true],
  ]

  for (const e of envs) {
    for (const [site, siteOpen] of sites) {
      for (const [edition, editionBuy] of editions) {
        const expected = e.cap && siteOpen && editionBuy
        it(`env=${JSON.stringify(e.env)} site=${JSON.stringify(site)} edition=${JSON.stringify(edition)} → ${expected ? 'buy' : 'quote'}`, () => {
          const gate = resolveCommerceGate({ env: e.env, siteSettings: site })
          expect(gate.checkoutOpen).toBe(e.cap && siteOpen)
          expect(resolveEditionMode(gate, edition).action).toBe(expected ? 'buy' : 'quote')
        })
      }
    }
  }

  it('reports the outermost closed layer as reason', () => {
    expect(resolveEditionMode(resolveCommerceGate({ env: {}, siteSettings: payments }), buyEdition)).toEqual({ action: 'quote', reason: 'capability_off' })
    expect(resolveEditionMode(resolveCommerceGate({ env: ON, siteSettings: {} }), buyEdition)).toEqual({ action: 'quote', reason: 'site_quote_only' })
    expect(resolveEditionMode(resolveCommerceGate({ env: ON, siteSettings: payments }), {})).toEqual({ action: 'quote', reason: 'edition_quote' })
  })

  it('accepts legacy plan spellings as aliases', () => {
    expect(readSiteMode({ commerce: { mode: 'payment' } })).toBe('payments')
    expect(readEditionSaleMode({ saleMode: 'purchase' })).toBe('buy')
  })
})

describe('S3 webhook drain window (72 h)', () => {
  const since = new Date('2026-11-08T00:00:00Z')
  const at = (ms: number) => new Date(since.getTime() + ms)

  it('always processes in payments mode with capability', () => {
    expect(isWebhookProcessingAllowed({ capability: true, siteMode: 'payments', quoteSince: undefined, now: since })).toBe(true)
  })

  it('processes in quote-only only within [quoteSince, +72h)', () => {
    const base = { capability: true, siteMode: 'quote-only' as const, quoteSince: since.toISOString() }
    expect(isWebhookProcessingAllowed({ ...base, now: at(0) })).toBe(true)
    expect(isWebhookProcessingAllowed({ ...base, now: at(WEBHOOK_DRAIN_MS - 1) })).toBe(true)
    expect(isWebhookProcessingAllowed({ ...base, now: at(WEBHOOK_DRAIN_MS) })).toBe(false)
    expect(isWebhookProcessingAllowed({ ...base, now: at(-1) })).toBe(false)
    expect(isWebhookProcessingAllowed({ ...base, quoteSince: since, now: at(1000) })).toBe(true)
  })

  it('fails closed without capability or valid quoteSince', () => {
    expect(isWebhookProcessingAllowed({ capability: false, siteMode: 'payments', quoteSince: since, now: since })).toBe(false)
    expect(isWebhookProcessingAllowed({ capability: false, siteMode: 'quote-only', quoteSince: since, now: since })).toBe(false)
    for (const quoteSince of [undefined, null, '', 'not-a-date', 123, new Date('invalid')]) {
      expect(isWebhookProcessingAllowed({ capability: true, siteMode: 'quote-only', quoteSince, now: since })).toBe(false)
    }
  })
})

describe('provider routing (P0: iyzico primary)', () => {
  it('routes every currency to iyzico by default', () => {
    for (const c of ['TRY', 'USD', 'EUR'] as const) {
      expect(providerForCurrency(c, { stripeEnabled: false, stripeCurrencies: ['USD', 'EUR'] })).toBe('iyzico')
    }
  })

  it('routes USD/EUR to Stripe only when explicitly enabled; TRY never', () => {
    const opts = { stripeEnabled: true, stripeCurrencies: ['USD', 'EUR'] as const }
    expect(providerForCurrency('USD', opts)).toBe('stripe')
    expect(providerForCurrency('EUR', opts)).toBe('stripe')
    expect(providerForCurrency('TRY', { stripeEnabled: true, stripeCurrencies: ['TRY', 'USD'] as never })).toBe('iyzico')
    expect(providerForCurrency('EUR', { stripeEnabled: true, stripeCurrencies: ['USD'] })).toBe('iyzico')
  })
})

describe('resolveEditionOffer (fail-to-quote)', () => {
  const gate = resolveCommerceGate({ env: ON, siteSettings: payments })
  const vat = { TRY: { kind: 'rate', rateBasisPoints: 2000 }, USD: { kind: 'exempt' } }
  const edition = { saleMode: 'buy', pricing: { taxMode: 'inclusive', TRY: 120_00, USD: 50_00, EUR: 45_00 } }
  const base = { gate, edition, vatSettings: vat, availableProviders: ['iyzico'] as const, stripeEnabled: false, stripeCurrencies: [] }

  it('offers only currencies with price + VAT rule + available provider', () => {
    const offer = resolveEditionOffer(base)
    expect(offer.kind).toBe('buy')
    if (offer.kind !== 'buy') return
    expect(offer.prices.map((p) => [p.currency, p.provider, p.totalMinor, p.vatMinor])).toEqual([
      ['TRY', 'iyzico', 120_00, 20_00],
      ['USD', 'iyzico', 50_00, 0],
    ])
  })

  it('falls back to quote when anything is missing', () => {
    expect(resolveEditionOffer({ ...base, vatSettings: undefined }).kind).toBe('quote')
    expect(resolveEditionOffer({ ...base, availableProviders: [] }).kind).toBe('quote')
    expect(resolveEditionOffer({ ...base, edition: { saleMode: 'buy' } }).kind).toBe('quote')
    expect(resolveEditionOffer({ ...base, edition: { saleMode: 'buy', pricing: { TRY: 100 } } }).kind).toBe('quote')
    expect(resolveEditionOffer({ ...base, edition: { saleMode: 'buy', pricing: { taxMode: 'inclusive', TRY: 1.5 } } }).kind).toBe('quote')
    expect(resolveEditionOffer({ ...base, edition: { ...edition, saleMode: 'quote' } }).kind).toBe('quote')
    expect(resolveEditionOffer({ ...base, gate: resolveCommerceGate({ env: {}, siteSettings: payments }) }).kind).toBe('quote')
  })

  it('drops Stripe-routed currencies when Stripe is not available', () => {
    const offer = resolveEditionOffer({ ...base, stripeEnabled: true, stripeCurrencies: ['USD', 'EUR'] })
    expect(offer.kind === 'buy' && offer.prices.map((p) => p.currency)).toEqual(['TRY'])
  })
})
