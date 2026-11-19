import { describe, expect, it } from 'vitest'

import schema from '../../content/seed/schema.json'
import { Editions } from '../../src/collections/Editions'
import { Orders } from '../../src/collections/Orders'
import { PaymentEvents } from '../../src/collections/PaymentEvents'
import { SiteSettings } from '../../src/globals/SiteSettings'
import { isPanelAdmin, nobody } from '../../src/access'
import { flatFields } from '../../src/lib/content-import/model'
import { seedSchema, validateSeed } from '../../src/lib/content-import/schema'
import { mcpCollections } from '../../src/lib/mcp'
import { isValidTckn, isValidVkn } from '../../src/lib/payments/identity'
import { readEditionSaleMode, readSiteMode, resolveCommerceGate, resolveEditionOffer } from '../../src/lib/payments/mode'
import { percentToBasisPoints, readVatSettings } from '../../src/lib/payments/settings'
import { ORDER_STATUSES } from '../../src/lib/payments/state'
import { EDITION_SALE_MODES, SITE_COMMERCE_MODES } from '../../src/lib/payments/types'
import type { Field } from 'payload'

/* P2-S pure checks: stored spellings, VAT percent → basis points, buyer identity, seed schema rejection, MCP scope. */

type Named = { name: string; defaultValue?: unknown; options?: { value: string }[]; fields?: Field[] }
const named = (fields: Field[], name: string) => flatFields(fields).find((f) => 'name' in f && f.name === name) as Named
const commerce = () => {
  const tabs = SiteSettings.fields[0] as Extract<Field, { type: 'tabs' }>
  return named(tabs.tabs.flatMap((t) => t.fields), 'commerce')
}

describe('P2-S stored spellings = core spellings', () => {
  it('schema options come from the core constants and round-trip through the readers', () => {
    expect(named(Editions.fields, 'saleMode').options!.map((o) => o.value)).toEqual([...EDITION_SALE_MODES])
    expect(named(commerce().fields!, 'mode').options!.map((o) => o.value)).toEqual([...SITE_COMMERCE_MODES])
    expect(named(Orders.fields, 'status').options!.map((o) => o.value)).toEqual([...ORDER_STATUSES])
    for (const mode of SITE_COMMERCE_MODES) expect(readSiteMode({ commerce: { mode } })).toBe(mode)
    for (const mode of EDITION_SALE_MODES) expect(readEditionSaleMode({ saleMode: mode })).toBe(mode)
  })

  it('defaults are fail-closed: quote-only site, quote edition, no VAT rule, providers off', () => {
    const fields = commerce().fields!
    expect(named(fields, 'mode').defaultValue).toBe('quote-only')
    expect(named(Editions.fields, 'saleMode').defaultValue).toBe('quote')
    for (const c of ['try', 'usd', 'eur']) expect(named(named(named(fields, 'vat').fields!, c).fields!, 'rule').defaultValue).toBeUndefined()
    const providers = named(fields, 'providers').fields!
    for (const p of ['iyzico', 'stripe']) expect(named(named(providers, p).fields!, 'enabled').defaultValue).toBe(false)
  })

  it('an edition priced through the stored field names is offered only when every layer is open', () => {
    const gate = resolveCommerceGate({ env: { PAYMENTS_ENABLED: 'true' }, siteSettings: { commerce: { mode: 'payments' } } })
    const vatSettings = readVatSettings({ commerce: { vat: { try: { rule: 'rate', ratePercent: 20, rateBasisPoints: 2000 } } } })
    const edition = { saleMode: 'buy', pricing: { taxMode: 'inclusive', tryMinor: 1200_00, usdMinor: null, eurMinor: null } }
    const offer = resolveEditionOffer({ gate, edition, vatSettings, availableProviders: ['iyzico'], stripeEnabled: false, stripeCurrencies: [] })
    expect(offer).toMatchObject({ kind: 'buy', prices: [{ currency: 'TRY', netMinor: 1000_00, vatMinor: 200_00, totalMinor: 1200_00 }] })
    // Former uppercase keys are not read.
    expect(resolveEditionOffer({ gate, edition: { saleMode: 'buy', pricing: { taxMode: 'inclusive', TRY: 100 } }, vatSettings, availableProviders: ['iyzico'], stripeEnabled: false, stripeCurrencies: [] }).kind).toBe('quote')
  })
})

describe('VAT per currency (S1): admin percent, internal basis points', () => {
  it('converts percent without floating point drift', () => {
    expect(percentToBasisPoints(20)).toBe(2000)
    expect(percentToBasisPoints(18.5)).toBe(1850)
    expect(percentToBasisPoints(0)).toBe(0)
    expect(percentToBasisPoints(100)).toBe(10_000)
    expect(percentToBasisPoints(0.01)).toBe(1)
    for (const bad of [100.01, -1, 1.005, Number.NaN, '', null, undefined, '20%']) expect(percentToBasisPoints(bad as never)).toBeNull()
  })

  it('reads only complete, consistent rules (empty = no sale in that currency)', () => {
    const vat = (v: unknown) => readVatSettings({ commerce: { vat: v } })
    expect(vat(undefined)).toEqual({})
    expect(vat({ try: { rule: null } })).toEqual({})
    expect(vat({ try: { rule: 'rate', ratePercent: 20, rateBasisPoints: 2000 }, usd: { rule: 'exempt' } }))
      .toEqual({ TRY: { kind: 'rate', rateBasisPoints: 2000 }, USD: { kind: 'exempt' } })
    // Stale or missing basis points fail closed.
    expect(vat({ try: { rule: 'rate', ratePercent: 20, rateBasisPoints: 1800 } })).toEqual({})
    expect(vat({ try: { rule: 'rate', ratePercent: 20 } })).toEqual({})
    expect(vat({ eur: { rule: 'rate', ratePercent: 0, rateBasisPoints: 0 } })).toEqual({ EUR: { kind: 'rate', rateBasisPoints: 0 } })
  })
})

describe('buyer identity (S4)', () => {
  it('validates TCKN checksums and VKN format', () => {
    expect(isValidTckn('10000000146')).toBe(true)
    for (const bad of ['10000000145', '00000000146', '1000000014', '1000000014a', 10000000146]) expect(isValidTckn(bad)).toBe(false)
    expect(isValidVkn('1234567890')).toBe(true)
    for (const bad of ['123456789', '12345678901', '12345abcde', 1234567890]) expect(isValidVkn(bad)).toBe(false)
  })
})

describe('content:import never accepts commerce values', () => {
  const record = (extra: Record<string, unknown>) => ({ title: 'Pro', sku: 'ERP-PRO-1Y', product: 'erp', licenseType: 'perpetual', seats: 1, ...extra })
  const seed = (extra: Record<string, unknown>) => ({ version: 1, editions: [{ tr: record(extra), en: record(extra) }] })

  it('the shipped schema is regenerated and has no commerce fields', () => {
    expect(schema).toEqual(seedSchema)
    const text = JSON.stringify(schema)
    for (const field of ['saleMode', 'pricing', 'tryMinor', 'quoteSince', 'rateBasisPoints', '"providers"', '"vat"']) expect(text).not.toContain(field)
  })

  it('rejects price, sale mode and the site payment switch', () => {
    expect(() => validateSeed(seed({}), 'ok.json')).not.toThrow()
    expect(() => validateSeed(seed({ saleMode: 'buy' }), 'x.json')).toThrow(/additional/)
    expect(() => validateSeed(seed({ pricing: { tryMinor: 100 } }), 'x.json')).toThrow(/additional/)
    const settings = (commerceData: Record<string, unknown>) => ({ version: 1, globals: { 'site-settings': { tr: { siteName: 'S', commerce: commerceData }, en: { siteName: 'S', commerce: commerceData } } } })
    expect(() => validateSeed(settings({}), 'ok.json')).not.toThrow()
    for (const extra of [{ mode: 'payments' }, { providers: { iyzico: { enabled: true } } }, { vat: { try: { rule: 'exempt' } } }, { quoteSince: '2026-01-01' }]) {
      expect(() => validateSeed(settings(extra), 'x.json')).toThrow(/additional/)
    }
  })
})

describe('collection access and MCP scope', () => {
  it('orders: panel staff and owners read, nobody creates or deletes; payment-events: panel admin read only', async () => {
    expect(Orders.access?.create).toBe(nobody)
    expect(Orders.access?.delete).toBe(nobody)
    expect(Orders.access?.update).toBe(isPanelAdmin)
    expect(PaymentEvents.access?.read).toBe(isPanelAdmin)
    const read = (user: object, headers = new Headers()) => Orders.access!.read!({ req: { user, headers } } as never)
    const editor = { id: 1, collection: 'users', roles: ['editor'], _strategy: 'local-jwt' }
    expect(await read(editor)).toBe(true)
    expect(await read(editor, new Headers({ authorization: 'JWT fixture' }))).toBe(false)
    expect(await read({ ...editor, roles: ['admin'], _strategy: 'api-key' })).toBe(false)
    expect(await read({ id: 2, collection: 'customers' })).toEqual({ customer: { equals: 2 } })
    for (const op of ['create', 'update', 'delete'] as const) expect(PaymentEvents.access?.[op]).toBe(nobody)
  })

  it('orders and payment-events are not in the MCP allowlist', () => {
    expect(mcpCollections).not.toHaveProperty('orders')
    expect(mcpCollections).not.toHaveProperty('payment-events')
  })
})
