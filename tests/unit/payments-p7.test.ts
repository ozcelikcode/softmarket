import { describe, expect, it } from 'vitest'

import { Pages } from '../../src/collections/Pages'
import { flatFields } from '../../src/lib/content-import/model'
import { computeCommerceState } from '../../src/lib/payments/commerce-state'
import {
  COMMERCE_LEGAL_KINDS, evaluateLegal, isCommerceLegalPage, isCommerceLegalSlug, type LegalFact,
} from '../../src/lib/payments/legal'
import { buildReadiness } from '../../src/lib/payments/readiness'

/* P7 pure checks: commerceLegal field shape, strict legal evaluation, legalReady inside `open`, readiness. */

const ENV = { PAYMENTS_ENABLED: 'true', IYZICO_API_KEY: 'k', IYZICO_SECRET_KEY: 's', IYZICO_BASE_URL: 'https://sandbox-api.iyzipay.com', SMTP_HOST: 'smtp.example.com', SMTP_FROM: 'a@b.c' }
const SITE = { commerce: { mode: 'payments', providers: { iyzico: { enabled: true } }, vat: { try: { rule: 'exempt' } } } }
const facts = (over: Partial<LegalFact> = {}, skip?: (f: LegalFact) => boolean): LegalFact[] =>
  COMMERCE_LEGAL_KINDS.flatMap((kind) => (['tr', 'en'] as const).map((locale) => ({ kind, locale, published: true, draft: false, approved: true, ...over })))
    .filter((f) => !skip?.(f))

describe('pages.commerceLegal field', () => {
  const field = flatFields(Pages.fields).find((f) => 'name' in f && f.name === 'commerceLegal') as unknown as {
    type: string; localized?: boolean; unique?: boolean; options: { value: string; label: { tr: string; en: string } }[]
    admin: { position: string; condition: (data: unknown) => boolean }; label: { tr: string; en: string }
  }
  it('is a non-localized sidebar select with the three kinds, TR/EN labels, shown only for legal pages', () => {
    expect(field.type).toBe('select')
    expect(field.localized).toBeFalsy()
    expect(field.unique).toBe(true)
    expect(field.admin.position).toBe('sidebar')
    expect(field.options.map((o) => o.value)).toEqual([...COMMERCE_LEGAL_KINDS])
    for (const o of field.options) { expect(o.label.tr).toBeTruthy(); expect(o.label.en).toBeTruthy() }
    expect(field.label.tr).toBeTruthy()
    expect(field.admin.condition({ pageType: 'legal' })).toBe(true)
    for (const pageType of ['standard', 'landing', 'template', undefined]) expect(field.admin.condition({ pageType })).toBe(false)
    expect(field.admin.condition(undefined)).toBe(false)
  })
})

describe('isCommerceLegalPage (field first, slug list only as a fallback)', () => {
  it('trusts the field; the slug list applies only while it is empty', () => {
    expect(isCommerceLegalPage({ commerceLegal: 'refund', slug: 'anything' })).toBe(true)
    expect(isCommerceLegalPage({ commerceLegal: null, slug: 'iade-ve-cayma' })).toBe(true)
    expect(isCommerceLegalPage({ slug: 'mesafeli-satis-sozlesmesi' })).toBe(true)
    expect(isCommerceLegalPage({ commerceLegal: null, slug: 'eula' })).toBe(false)
    expect(isCommerceLegalPage({ commerceLegal: 'bogus', slug: 'iade-ve-cayma' })).toBe(false)
    expect(isCommerceLegalPage(null)).toBe(false)
    expect(isCommerceLegalSlug('eula')).toBe(false)
  })
})

describe('evaluateLegal (three kinds, published, not draft, both locales; fail-closed)', () => {
  it('ready only with all kinds in both locales', () => {
    expect(evaluateLegal(facts())).toMatchObject({ ready: true, kinds: { distanceSales: true, preInformation: true, refund: true } })
  })
  it('a draft text, a missing kind, a missing locale or an unpublished page is not ready', () => {
    expect(evaluateLegal(facts({}, () => false).map((f) => (f.kind === 'refund' && f.locale === 'en' ? { ...f, draft: true } : f))).ready).toBe(false)
    expect(evaluateLegal(facts({}, (f) => f.kind === 'preInformation')).kinds).toMatchObject({ preInformation: false, distanceSales: true })
    expect(evaluateLegal(facts({}, (f) => f.locale === 'en')).ready).toBe(false)
    expect(evaluateLegal(facts({ published: false })).ready).toBe(false)
    expect(evaluateLegal([]).ready).toBe(false)
    expect(evaluateLegal([{ kind: null, locale: 'tr', published: true, draft: false }]).ready).toBe(false)
    // Entegrasyon ayarları: a clean text without the lawyer approval (or with it missing) is not ready.
    expect(evaluateLegal(facts({ approved: false })).ready).toBe(false)
    expect(evaluateLegal(facts({}).map((f) => (f.kind === 'refund' && f.locale === 'en' ? { ...f, approved: undefined } : f))).kinds).toMatchObject({ refund: false, distanceSales: true })
  })
})

describe('legalReady is part of open (plan P7: no payment with draft legal texts)', () => {
  it('every other layer open + legal ready = open; legal missing/omitted = closed', () => {
    expect(computeCommerceState({ env: ENV, siteSettings: SITE, legalReady: true })).toMatchObject({ open: true, legalReady: true })
    expect(computeCommerceState({ env: ENV, siteSettings: SITE, legalReady: false })).toMatchObject({ open: false, checkoutOpen: false, legalReady: false })
    expect(computeCommerceState({ env: ENV, siteSettings: SITE })).toMatchObject({ open: false, legalReady: false })
    expect(computeCommerceState({ env: ENV, siteSettings: SITE, legalReady: 'yes' as never }).open).toBe(false)
    expect(computeCommerceState({ env: ENV, siteSettings: SITE, legalReady: true, checkoutReady: true }).checkoutOpen).toBe(true)
  })
  it('legal ready alone never opens anything', () => {
    expect(computeCommerceState({ env: {}, siteSettings: SITE, legalReady: true }).open).toBe(false)
    expect(computeCommerceState({ env: ENV, siteSettings: { commerce: { mode: 'quote-only' } }, legalReady: true }).open).toBe(false)
  })
})

describe('readiness legal check', () => {
  const base = { env: ENV, siteSettings: SITE, editions: [{ sku: 'A', saleMode: 'buy', pricing: { taxMode: 'inclusive', tryMinor: 1000 } }] }
  const level = (r: ReturnType<typeof buildReadiness>, id: string) => r.items.find((i) => i.id === id)!.level
  it('is strict per kind and locale, and gates `ready`', () => {
    const ok = buildReadiness({ ...base, legalPages: facts() })
    expect(level(ok, 'legal')).toBe('ok')
    expect(ok.ready).toBe(true)
    const draft = buildReadiness({ ...base, legalPages: facts({ draft: true }) })
    expect(level(draft, 'legal')).toBe('missing')
    expect(draft.ready).toBe(false)
    const oneLocale = buildReadiness({ ...base, legalPages: facts({}, (f) => f.locale === 'en') })
    expect(oneLocale.items.find((i) => i.id === 'legal')!.detail!.en).toBe('0/3 ready · lawyer-approved versions: 3/6')
    expect(buildReadiness({ ...base, legalPages: facts({}, (f) => f.kind === 'refund') }).items.find((i) => i.id === 'legal')!.detail!.en).toBe('2/3 ready · lawyer-approved versions: 4/6')
    const unapproved = buildReadiness({ ...base, legalPages: facts({ approved: false }) })
    expect(level(unapproved, 'legal')).toBe('missing')
    expect(unapproved.ready).toBe(false)
  })
})
