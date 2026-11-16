import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => '/tr' }))

import { CheckoutForm, type CheckoutLabels } from '../../src/components/portal/checkout-form'
import { canonicalPortalPath, sanitizeNext } from '../../src/lib/portal/redirect'
import { checkoutFormActionSources, contentSecurityPolicy, isCheckoutPath } from '../../src/lib/csp'
import { CANONICAL_PATHS, languageSwitchPath, localizedHref, LINK_ROUTES } from '../../src/i18n/paths'
import { isReservedSlug } from '../../src/lib/system-pages'
import { checkoutFormInput, parseCheckoutForm, providerPhone, splitName } from '../../src/lib/payments/checkout-schema'
import { buildContractSnapshot, layoutToPlainText, legalDigest, maskIdentity, snapshotSha256, type CommerceLegalSet } from '../../src/lib/payments/contract'
import { computeCommerceState } from '../../src/lib/payments/commerce-state'
import { resolveCheckoutOffer } from '../../src/lib/payments/checkout'
import { createCheckoutNonce, orderIdempotencyKey } from '../../src/lib/payments/idempotency'
import { orderPagePath, orderReturnPath } from '../../src/lib/payments/runtime'
import { isValidTckn, isValidVkn } from '../../src/lib/payments/identity'
import { computeAmounts } from '../../src/lib/payments/tax'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const TCKN = '10000000146'

const valid = (over: Record<string, unknown> = {}) => ({
  sku: 'ERP-PRO-1Y', currency: 'TRY', locale: 'tr', nonce: createCheckoutNonce(), legal: 'a'.repeat(64), type: 'individual', name: 'Ali Veli', identityNumber: TCKN,
  phone: '+90 532 000 00 00', addressLine: 'Atatürk Cad. 1', city: 'İstanbul', country: 'tr', consentPre: 'on', consentSales: 'on', consentWaiver: 'on', ...over,
})

describe('form validation (TCKN / VKN / consents)', () => {
  it('accepts a valid individual form and normalises the country', () => {
    const r = parseCheckoutForm(valid())
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data).toMatchObject({ country: 'TR', type: 'individual', identityNumber: TCKN })
  })

  it('TCKN checksum is enforced for individuals', () => {
    expect(isValidTckn(TCKN)).toBe(true)
    for (const bad of ['12345678901', '1000000014', '00000000000', 'abcdefghijk', '']) {
      const r = parseCheckoutForm(valid({ identityNumber: bad }))
      expect(r).toMatchObject({ ok: false, errors: { identityNumber: 'invalid' } })
    }
  })

  it('corporate needs company, 10-digit VKN and tax office; the waiver is optional', () => {
    const corp = { type: 'corporate', company: 'Örnek A.Ş.', taxNumber: '1234567890', taxOffice: 'Kadıköy', identityNumber: '', consentWaiver: undefined }
    expect(parseCheckoutForm(valid(corp)).ok).toBe(true)
    expect(isValidVkn('1234567890')).toBe(true)
    expect(parseCheckoutForm(valid({ ...corp, taxNumber: '12345' }))).toMatchObject({ ok: false, errors: { taxNumber: 'invalid' } })
    expect(parseCheckoutForm(valid({ ...corp, company: '', taxOffice: '' }))).toMatchObject({ ok: false, errors: { company: 'invalid', taxOffice: 'invalid' } })
  })

  it('individual buyers must give the waiver; both agreement boxes are always required', () => {
    expect(parseCheckoutForm(valid({ consentWaiver: undefined }))).toMatchObject({ ok: false, errors: { consentWaiver: 'invalid' } })
    for (const key of ['consentPre', 'consentSales'] as const) {
      expect(parseCheckoutForm(valid({ [key]: undefined }))).toMatchObject({ ok: false, errors: { [key]: 'invalid' } })
      expect(parseCheckoutForm(valid({ [key]: 'yes' }))).toMatchObject({ ok: false })
    }
  })

  it('reports every problem together (type rules are not hidden behind other errors)', () => {
    const r = parseCheckoutForm(valid({ identityNumber: '1', consentSales: undefined, phone: 'x' }))
    expect(r).toMatchObject({ ok: false, errors: { identityNumber: 'invalid', consentSales: 'invalid', phone: 'invalid' } })
  })

  it('malformed SKU / currency / nonce / digest / one-word name are rejected; amounts in the form are not a thing', () => {
    for (const over of [{ sku: 'bad sku' }, { currency: 'GBP' }, { nonce: 'short' }, { legal: 'zz' }, { name: 'Ali' }, { locale: 'de' }]) {
      expect(parseCheckoutForm(valid(over)).ok).toBe(false)
    }
    const r = parseCheckoutForm(valid({ totalMinor: '1', price: '0.01', amount: '1', provider: 'stripe' }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(Object.keys(r.data)).not.toEqual(expect.arrayContaining(['totalMinor']))
    expect(Object.keys((r as { data: object }).data)).not.toContain('provider')
    const data = new FormData()
    data.set('sku', 'A-B'); data.set('totalMinor', '1'); data.append('name', 'a'); data.append('name', 'b')
    expect(checkoutFormInput(data)).toMatchObject({ sku: 'A-B', name: null })
    expect(checkoutFormInput(data)).not.toHaveProperty('totalMinor')
  })

  it('phone and name helpers for the provider', () => {
    expect(providerPhone('0532 000 00 00', 'TR')).toBe('+905320000000')
    expect(providerPhone('+90 (532) 000-00-00', 'TR')).toBe('+905320000000')
    expect(providerPhone('+1 415 555 0100', 'US')).toBe('+14155550100')
    expect(splitName('Ali Veli')).toEqual({ name: 'Ali', surname: 'Veli' })
    expect(splitName('Ayşe Nur Kaya')).toEqual({ name: 'Ayşe Nur', surname: 'Kaya' })
  })
})

describe('server-side price and VAT (the browser supplies none of it)', () => {
  const settings = (vat: Record<string, unknown> = { try: { rule: 'rate', ratePercent: 20, rateBasisPoints: 2000 }, usd: { rule: 'exempt' } }) => ({ commerce: { mode: 'payments', providers: { iyzico: { enabled: true } }, vat } })
  const ENV = { PAYMENTS_ENABLED: 'true', IYZICO_API_KEY: 'k', IYZICO_SECRET_KEY: 's', IYZICO_BASE_URL: 'https://sandbox-api.iyzipay.com' }
  const edition = (pricing: Record<string, unknown>, saleMode = 'buy') => ({ id: 1, sku: 'X-1', title: 'X', saleMode, pricing, licenseType: 'perpetual' as const })

  it('inclusive: net/VAT split of the gross price with half-up rounding; exclusive adds VAT; exempt is zero', () => {
    expect(computeAmounts({ currency: 'TRY', priceMinor: 125000, taxMode: 'inclusive', rule: { kind: 'rate', rateBasisPoints: 2000 } })).toMatchObject({ netMinor: 104167, vatMinor: 20833, totalMinor: 125000 })
    expect(computeAmounts({ currency: 'TRY', priceMinor: 100000, taxMode: 'exclusive', rule: { kind: 'rate', rateBasisPoints: 2000 } })).toMatchObject({ netMinor: 100000, vatMinor: 20000, totalMinor: 120000 })
    expect(computeAmounts({ currency: 'USD', priceMinor: 4000, taxMode: 'inclusive', rule: { kind: 'exempt' } })).toMatchObject({ vatMinor: 0, totalMinor: 4000 })
  })

  it('offer exists only when checkout is open; closed gate, quote edition or missing price → null (fail to quote)', () => {
    const open = computeCommerceState({ legalReady: true, env: ENV, siteSettings: settings() })
    const pricing = { taxMode: 'inclusive', tryMinor: 125000, usdMinor: 4000 }
    expect(resolveCheckoutOffer(open, edition(pricing) as never)).toMatchObject({ taxMode: 'inclusive', prices: [{ currency: 'TRY', totalMinor: 125000 }, { currency: 'USD', totalMinor: 4000 }] })
    expect(resolveCheckoutOffer(open, edition(pricing, 'quote') as never)).toBeNull()
    expect(resolveCheckoutOffer(open, edition({ taxMode: 'inclusive' }) as never)).toBeNull()
    expect(resolveCheckoutOffer(computeCommerceState({ legalReady: false, env: ENV, siteSettings: settings() }), edition(pricing) as never)).toBeNull()
    expect(resolveCheckoutOffer(computeCommerceState({ legalReady: true, env: ENV, siteSettings: settings(), checkoutReady: false }), edition(pricing) as never)).toBeNull()
    expect(resolveCheckoutOffer(computeCommerceState({ legalReady: true, env: {}, siteSettings: settings() }), edition(pricing) as never)).toBeNull()
    // No VAT rule for a currency → no sale in it.
    expect(resolveCheckoutOffer(computeCommerceState({ legalReady: true, env: ENV, siteSettings: settings({ try: { rule: 'rate', ratePercent: 20, rateBasisPoints: 2000 } }) }), edition(pricing) as never)?.prices.map((p) => p.currency)).toEqual(['TRY'])
  })
})

describe('idempotent form token', () => {
  it('same customer + token = same key; another customer or token differs; malformed input is refused', () => {
    const nonce = createCheckoutNonce()
    expect(nonce).toMatch(/^[A-Za-z0-9_-]{22,64}$/)
    expect(createCheckoutNonce()).not.toBe(nonce)
    const key = orderIdempotencyKey(7, nonce)
    expect(key).toMatch(/^[0-9a-f]{64}$/)
    expect(orderIdempotencyKey(7, nonce)).toBe(key)
    expect(orderIdempotencyKey(8, nonce)).not.toBe(key)
    expect(orderIdempotencyKey(7, createCheckoutNonce())).not.toBe(key)
    expect(orderIdempotencyKey(7, 'short')).toBeNull()
    expect(orderIdempotencyKey('7;drop', nonce)).toBeNull()
  })
})

describe('contract copy and consent snapshot', () => {
  const rich = (text: string) => [{ blockType: 'richText', content: { root: { type: 'root', children: [
    { type: 'heading', children: [{ type: 'text', text: 'Başlık' }] },
    { type: 'paragraph', children: [{ type: 'text', text }, { type: 'linebreak' }, { type: 'text', text: 'devam' }] },
    { type: 'list', listType: 'bullet', children: [{ type: 'listitem', children: [{ type: 'text', text: 'bir' }] }, { type: 'listitem', children: [{ type: 'text', text: 'iki' }] }] },
  ] } } }, { blockType: 'richText', appearance: { hidden: true }, content: { root: { children: [{ type: 'paragraph', children: [{ type: 'text', text: 'GİZLİ' }] }] } } }]
  const legal = (v = '') => Object.fromEntries((['distanceSales', 'preInformation', 'refund'] as const).map((k) => [k, { kind: k, title: k, slug: k, text: `Metin ${k}${v}`, updatedAt: `2026-11-16T10:00:00.000Z${v}` }])) as unknown as CommerceLegalSet
  const base = (over = {}) => ({
    locale: 'tr' as const, orderNumber: 'SM-261116-ABCDEF', acceptedAt: new Date('2026-11-16T12:00:00Z'), seller: { legalName: 'Örnek A.Ş.', taxNumber: '1234567890' }, legal: legal(), waiverAccepted: true,
    buyer: { type: 'individual' as const, name: 'Ali Veli', identityNumber: TCKN, email: 'a@example.test', phone: '+90', addressLine: 'X', city: 'İstanbul', country: 'TR' },
    item: { title: 'Pro', sku: 'P-1', licenseType: 'subscription' as const, durationMonths: 12, seats: 3 },
    amounts: { currency: 'TRY' as const, netMinor: 104167, vatMinor: 20833, totalMinor: 125000, vatRateBasisPoints: 2000, exempt: false }, taxMode: 'inclusive' as const, ...over,
  })

  it('Lexical → plain text: headings, line breaks and lists survive; hidden blocks never enter the contract', () => {
    const text = layoutToPlainText(rich('Madde'))
    expect(text).toBe('Başlık\n\nMadde\ndevam\n\n- bir\n- iki')
    expect(text).not.toContain('GİZLİ')
    expect(layoutToPlainText(null)).toBe('')
  })

  it('snapshot: order facts, masked identity, legal texts verbatim; SHA is stable and sensitive to every change', () => {
    const s = buildContractSnapshot(base())
    expect(s).toContain('SM-261116-ABCDEF')
    expect(s).toContain('Metin distanceSales')
    expect(s).toContain('Metin preInformation')
    expect(s).toContain('Metin refund')
    expect(s).toContain('Genel toplam: ₺1.250,00')
    expect(s).toContain('KDV (%20)')
    expect(s).toContain('anında ifasına onay verildi')
    expect(s).not.toContain(TCKN)
    expect(s).toContain(maskIdentity(TCKN))
    expect(snapshotSha256(s)).toBe(snapshotSha256(buildContractSnapshot(base())))
    expect(snapshotSha256(s)).toMatch(/^[0-9a-f]{64}$/)
    expect(snapshotSha256(buildContractSnapshot(base({ legal: legal('v2') })))).not.toBe(snapshotSha256(s))
    expect(snapshotSha256(buildContractSnapshot(base({ waiverAccepted: false })))).not.toBe(snapshotSha256(s))
    expect(buildContractSnapshot(base({ locale: 'en' }))).toContain('ORDER CONTRACT COPY')
    expect(buildContractSnapshot(base({ amounts: { currency: 'USD', netMinor: 4000, vatMinor: 0, totalMinor: 4000, vatRateBasisPoints: 0, exempt: true } }))).toContain('KDV istisnası')
  })

  it('the legal digest changes when any text or version changes', () => {
    expect(legalDigest(legal())).toBe(legalDigest(legal()))
    expect(legalDigest(legal())).not.toBe(legalDigest(legal('x')))
    expect(maskIdentity('12345678901')).toBe('••••••••901')
  })
})

describe('routes, redirects and paths', () => {
  it('TR/EN segments for checkout and orders; reserved landing slugs follow', () => {
    expect(localizedHref('/hesap/satin-al/ERP-PRO', 'en')).toBe('/en/account/checkout/ERP-PRO')
    expect(localizedHref('/hesap/siparisler/SM-261116-ABCDEF', 'en')).toBe('/en/account/orders/SM-261116-ABCDEF')
    expect(localizedHref('/hesap/siparisler', 'tr')).toBe('/tr/hesap/siparisler')
    expect(CANONICAL_PATHS).toEqual(expect.arrayContaining(['/hesap/satin-al/[sku]', '/hesap/siparisler', '/hesap/siparisler/[no]']))
    for (const slug of ['satin-al', 'siparisler', 'checkout', 'orders']) expect(isReservedSlug(slug)).toBe(true)
    expect(LINK_ROUTES).not.toContain('/hesap/satin-al/[sku]')
    expect(LINK_ROUTES).not.toContain('/hesap/siparisler/[no]')
    expect(languageSwitchPath('/hesap/siparisler')).toBe('/hesap/siparisler')
    expect(orderPagePath('en', 'SM-261116-ABCDEF')).toBe('/en/account/orders/SM-261116-ABCDEF')
    expect(orderPagePath('tr', 'SM-261116-ABCDEF')).toBe('/tr/hesap/siparisler/SM-261116-ABCDEF')
    expect(orderReturnPath('en')).toBe('/en/account/orders?donus=1')
    expect(orderReturnPath(undefined)).toBe('/tr/hesap/siparisler?donus=1')
    expect(orderReturnPath('tr')).not.toMatch(/SM-/)
  })

  it('login `next` may return to checkout and orders, nowhere else', () => {
    expect(sanitizeNext('/tr/hesap/satin-al/ERP-PRO-1Y?c=USD')).toBe('/hesap/satin-al/ERP-PRO-1Y?c=USD')
    expect(sanitizeNext('/en/account/checkout/ERP-PRO-1Y')).toBe('/hesap/satin-al/ERP-PRO-1Y')
    expect(sanitizeNext('/en/account/orders/SM-261116-ABCDEF')).toBe('/hesap/siparisler/SM-261116-ABCDEF')
    expect(sanitizeNext('/tr/hesap/siparisler?donus=1')).toBe('/hesap/siparisler?donus=1')
    for (const bad of ['/hesap/satin-al/erp pro', '/hesap/satin-al/../x', '/hesap/satin-al//evil.example', '/hesap/siparisler/other', '/hesap/satin-al']) expect(sanitizeNext(bad)).toBe('/hesap')
    expect(canonicalPortalPath('/en/account/orders/SM-1')).toBe('/hesap/siparisler/SM-1')
  })
})

describe('CSP: form-action only on the checkout path, only with the env capability', () => {
  const ENV = { PAYMENTS_ENABLED: 'true', IYZICO_BASE_URL: 'https://sandbox-api.iyzipay.com', NODE_ENV: 'production' }
  it('checkout path detection', () => {
    for (const p of ['/tr/hesap/satin-al/ERP', '/en/account/checkout/ERP', '/tr/hesap/satin-al']) expect(isCheckoutPath(p)).toBe(true)
    for (const p of ['/tr/hesap', '/tr/hesap/siparisler', '/en/account/orders/SM-1', '/tr/urunler', '/tr/hesap/satin-alim']) expect(isCheckoutPath(p)).toBe(false)
  })

  it('capability off → no extra source; on → iyzico hosts only (Stripe only when enabled); nothing else loosened', () => {
    expect(checkoutFormActionSources({ ...ENV, PAYMENTS_ENABLED: 'false' })).toEqual([])
    expect(checkoutFormActionSources({})).toEqual([])
    const sources = checkoutFormActionSources(ENV)
    expect(sources).toEqual(['https://iyzipay.com', 'https://*.iyzipay.com', 'https://iyzico.com', 'https://*.iyzico.com'])
    expect(checkoutFormActionSources({ ...ENV, PAYMENTS_STRIPE_ENABLED: 'true' })).toContain('https://checkout.stripe.com')
    const base = contentSecurityPolicy({ nonce: 'n' })
    const checkout = contentSecurityPolicy({ nonce: 'n', formActionExtra: sources })
    expect(base).toContain("form-action 'self';")
    expect(checkout).toContain("form-action 'self' https://iyzipay.com https://*.iyzipay.com https://iyzico.com https://*.iyzico.com;")
    // Identical apart from form-action.
    expect(checkout.replace(/form-action[^;]*;/, '')).toBe(base.replace(/form-action[^;]*;/, ''))
    expect(contentSecurityPolicy({ nonce: 'n', formActionExtra: [] })).toBe(base)
  })

  it('the loopback fake provider is only accepted outside production or inside the isolated e2e harness', () => {
    const local = { ...ENV, IYZICO_BASE_URL: 'http://127.0.0.1:3500' }
    expect(checkoutFormActionSources(local)).not.toContain('http://127.0.0.1:3500')
    expect(checkoutFormActionSources({ ...local, NODE_ENV: 'development' })).toContain('http://127.0.0.1:3500')
    expect(checkoutFormActionSources({ ...local, E2E_ISOLATED: '1', SOFTMARKET_E2E_BUILD: '1' })).not.toContain('http://127.0.0.1:3500')
    expect(checkoutFormActionSources({ ...local, NODE_ENV: undefined, E2E_ISOLATED: '1' })).not.toContain('http://127.0.0.1:3500')
    expect(checkoutFormActionSources({ ...local, IYZICO_BASE_URL: 'http://evil.example:3500', NODE_ENV: 'development' })).not.toContain('http://evil.example:3500')
  })

  it('the middleware passes the extra sources on the checkout path only', () => {
    const src = read('src/middleware.ts')
    expect(src).toMatch(/formActionExtra: isCheckoutPath\(pathname\) \? checkoutFormActionSources\(process\.env\) : \[\]/)
  })
})

describe('source guards', () => {
  it('the Server Action never reads an amount, provider, VAT or legal text from the form', () => {
    const src = read('src/lib/portal/checkout-actions.ts')
    expect(src).not.toMatch(/get\(['"](price|amount|total|provider|vat)/i)
    expect(src).toMatch(/sameOrigin\(h\)\.ok/)
    expect(src).toMatch(/allowAuthAttempt/)
    expect(src.indexOf('sameOrigin(h)')).toBeLessThan(src.indexOf('await getCustomer()'))
    expect(src.indexOf('await getCustomer()')).toBeLessThan(src.indexOf('await createCheckoutOrder('))
    // redirect() throws; it is never inside a try/catch.
    expect(src).not.toMatch(/try\s*{[^}]*redirect\(/)
  })

  it('checkout and order pages are dynamic per request (no force-static / ISR) and noindex', () => {
    for (const p of ['satin-al/[sku]', 'siparisler', 'siparisler/[no]']) {
      const src = read(`src/app/(frontend)/[locale]/hesap/(portal)/${p}/page.tsx`)
      expect(src).not.toMatch(/dynamic\s*=\s*['"](error|force-static)['"]|revalidate\s*=/)
      expect(src).toMatch(/noindex: true/)
    }
  })

  it('the client form uses no next-intl, no payments server module and passes the action straight to useActionState', () => {
    const src = read('src/components/portal/checkout-form.tsx')
    expect(src).not.toMatch(/next-intl|lib\/payments|lib\/commerce/)
    expect(src).toMatch(/useActionState\(action,/)
  })

  it('the Server Action and the portal checkout modules are the only portal importers of P4 runtime code', () => {
    expect(read('src/lib/portal/checkout-actions.ts')).toMatch(/from '@\/lib\/payments\/runtime'/)
    expect(read('src/lib/portal/orders.ts')).not.toMatch(/payments\/(runtime|sync|events)/)
  })
})

describe('CheckoutForm markup (works without JavaScript, accessible)', () => {
  const labels = new Proxy({ status: {} }, { get: (t, k) => (k === 'status' ? {} : String(k)) }) as unknown as CheckoutLabels
  const html = renderToStaticMarkup(createElement(CheckoutForm, {
    action: (async () => ({ status: 'idle' })) as never, hidden: { sku: 'S-1', currency: 'TRY', locale: 'tr', nonce: 'n'.repeat(24), legal: 'a'.repeat(64) },
    defaults: { name: 'Ali Veli', city: 'İstanbul', country: 'TR' }, email: 'a@example.test', labels, legalKey: 'k',
  } as never, createElement('div', { id: 'legal-slot' }, 'legal')))

  it('hidden inputs, native required only on always-needed fields, labelled controls and hints', () => {
    for (const name of ['sku', 'currency', 'locale', 'nonce', 'legal']) expect(html).toContain(`name="${name}"`)
    expect(html).not.toMatch(/name="(price|amount|total|provider)"/)
    for (const name of ['name', 'phone', 'addressLine', 'city', 'country', 'consentPre', 'consentSales']) expect(html).toMatch(new RegExp(`id="co-${name}"[^>]*required|required=""[^>]*id="co-${name}"|<[^>]*id="co-${name}"[^>]*required`))
    for (const name of ['identityNumber', 'taxNumber', 'company', 'taxOffice', 'consentWaiver']) expect(html).not.toMatch(new RegExp(`<[^>]*id="co-${name}"[^>]*required`))
    for (const id of ['co-name', 'co-phone', 'co-city', 'co-consentPre', 'co-consentWaiver', 'co-email']) expect(html).toMatch(new RegExp(`<label[^>]*for="${id}"`))
    expect(html).toContain('aria-describedby="co-name-hint"')
    expect(html).toContain('legal-slot')
    // Buyer-type switch is CSS-only (:has on the radio), so the corporate fields work without JS.
    expect(html).toContain('group-has-[#co-type-corporate:checked]/form:hidden')
    expect(html).toMatch(/<input[^>]*id="co-type-individual"[^>]*checked/)
    expect(html).toContain('value="Ali Veli"')
  })
})
