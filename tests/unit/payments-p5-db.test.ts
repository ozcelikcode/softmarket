import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { readPaymentsEnv } from '../../src/lib/payments/env'
import { iyzicoResponseSignature } from '../../src/lib/payments/signature/iyzico'

const hdrs = vi.hoisted(() => ({ current: new Headers() }))
const session = vi.hoisted(() => ({ customer: null as unknown }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn, unstable_noStore: vi.fn() }))
vi.mock('next/headers', () => ({ headers: async () => hdrs.current, cookies: async () => ({ get: () => undefined }), draftMode: async () => ({ isEnabled: false }) }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw new Error(`NEXT_REDIRECT ${url}`) },
  notFound: () => { throw new Error('NEXT_NOT_FOUND') },
  unstable_rethrow: (error: unknown) => { throw error },
}))
vi.mock('@/lib/portal/session', () => ({ getCustomer: async () => session.customer }))

/*
 * P5 on a temporary SQLite database (all migrations), real Payload Local API and a FAKE iyzico HTTP layer (injected
 * fetch / stubbed global fetch; no network). Covers: server-side price/VAT, single order per form token (also
 * concurrent), closed modes create no order, legal digest/draft guards, provider failure, IDOR on order reads and the
 * Server Action itself (origin guard, anonymous, validation, success redirect, fail-to-quote).
 */
const IYZ_SECRET = 'sandbox-SecretKey-P5test0001'
const ENV = { PAYMENTS_ENABLED: 'true', IYZICO_API_KEY: 'sandbox-ApiKey-P5test0001', IYZICO_SECRET_KEY: IYZ_SECRET, IYZICO_BASE_URL: 'https://sandbox-api.iyzipay.com' }
const TCKN = '10000000146'
const saved = { ...process.env }
let payload: Payload
let dir: string
let customerA: { id: number; email: string; _verified: boolean; collection: 'customers' }
let customerB: { id: number; email: string; _verified: boolean; collection: 'customers' }
let unverified: { id: number; email: string; _verified: boolean; collection: 'customers' }
const run = (q: string) => payload.db.drizzle.$client.execute(q)

// ---- fake iyzico --------------------------------------------------------------------------------------------------
const provider = { calls: [] as Record<string, unknown>[], mode: 'ok' as 'ok' | 'failure' | 'network', seq: 0 }
const fakeFetch = async (_url: string, init: { body?: string }) => {
  const body = JSON.parse(init.body ?? '{}') as Record<string, unknown>
  provider.calls.push(body)
  if (provider.mode === 'network') throw new TypeError('fetch failed')
  const reply = (json: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(json) })
  if (provider.mode === 'failure') return reply({ status: 'failure', errorCode: '10051' })
  const token = `tokP5${String(++provider.seq).padStart(8, '0')}Zz`
  const conversationId = String(body.conversationId)
  await new Promise((resolve) => setTimeout(resolve, 5)) // let concurrent submits interleave
  return reply({ status: 'success', conversationId, token, paymentPageUrl: `https://sandbox-cpp.iyzipay.com?token=${token}&lang=tr`, tokenExpireTime: 1800, signature: iyzicoResponseSignature(IYZ_SECRET, [conversationId, token]) })
}

const paragraph = (text: string) => ({ type: 'paragraph', format: '', indent: 0, version: 1, direction: null, children: [{ type: 'text', text, format: 0, mode: 'normal', style: '', detail: 0, version: 1 }] })
const richLayout = (...paragraphs: string[]) => [{ blockType: 'richText', content: { root: { type: 'root', format: '', indent: 0, version: 1, direction: null, children: paragraphs.map(paragraph) } } }]
/** Same block ids with new localized text (re-creating the array would drop the other locale's content). */
const withText = (layout: unknown, ...paragraphs: string[]) => (layout as Record<string, unknown>[]).map((block) => ({ ...block, content: richLayout(...paragraphs)[0]!.content }))
const KINDS = { 'mesafeli-satis-sozlesmesi': 'distanceSales', 'on-bilgilendirme-formu': 'preInformation', 'iade-ve-cayma': 'refund' } as const
const legalIds: Record<string, number> = {}
/** Rewrites a sales page in BOTH locales (updating one locale of an array block would drop the other's content). */
async function setLegal(kind: keyof typeof legalIds, tr: string) {
  const id = legalIds[kind]!
  await payload.update({ collection: 'pages', id, overrideAccess: true, locale: 'tr', data: { layout: withText(await layoutOf(id), tr), _status: 'published' } as never })
  await payload.update({ collection: 'pages', id, overrideAccess: true, locale: 'en', data: { layout: withText(await layoutOf(id), `Reviewed ${kind} text EN.`), _status: 'published' } as never })
}
const layoutOf = async (id: number) => (await payload.findByID({ collection: 'pages', id, locale: 'tr', overrideAccess: true, depth: 0 })).layout
const PAYMENTS = { mode: 'payments', providers: { iyzico: { enabled: true } }, vat: { try: { rule: 'rate', ratePercent: 20 }, usd: { rule: 'exempt' } } }
const setSite = (commerce: Record<string, unknown>) => payload.updateGlobal({ slug: 'site-settings', overrideAccess: true, data: { commerce } as never })

let seq = 0
const nonce = () => `nonceP5${String(++seq).padStart(6, '0')}abcdefghijklmnop`
async function legalDigestNow(locale: 'tr' | 'en' = 'tr') {
  const { legalDigest, loadCommerceLegalSet } = await import('../../src/lib/payments/contract')
  const set = await loadCommerceLegalSet(payload, locale)
  return set ? legalDigest(set) : 'f'.repeat(64)
}
async function formInput(over: Record<string, string | undefined> = {}) {
  return {
    sku: 'BUY-1', currency: 'TRY', locale: 'tr', nonce: nonce(), legal: await legalDigestNow(), type: 'individual', name: 'Ali Veli', company: '', identityNumber: TCKN, taxNumber: '', taxOffice: '',
    phone: '+90 532 000 00 00', addressLine: 'Atatürk Cad. 1', district: '', city: 'İstanbul', postalCode: '', country: 'TR', consentPre: 'on', consentSales: 'on', consentWaiver: 'on', ...over,
  } as Record<string, string>
}
async function checkout(input: Record<string, string>, customer: { id: number; email: string; _verified: boolean } = customerA) {
  const { parseCheckoutForm } = await import('../../src/lib/payments/checkout-schema')
  const { createCheckoutOrder } = await import('../../src/lib/payments/checkout')
  const { createPaymentsDeps } = await import('../../src/lib/payments/runtime')
  const { getCommerceState } = await import('../../src/lib/commerce/state')
  const parsed = parseCheckoutForm(input)
  if (!parsed.ok) throw new Error(`form invalid ${JSON.stringify(parsed.errors)}`)
  const deps = createPaymentsDeps(payload, { env: readPaymentsEnv(ENV), fetch: fakeFetch as never })
  return createCheckoutOrder(
    { payload, providers: deps.providers, now: deps.now, log: deps.log, state: await getCommerceState() },
    { customer, form: parsed.data, ip: '203.0.113.9', userAgent: 'vitest-agent', origin: 'https://shop.example' },
  )
}
const orders = async () => (await payload.find({ collection: 'orders', overrideAccess: true, depth: 0, limit: 100, sort: 'createdAt' })).docs as unknown as Record<string, any>[] // eslint-disable-line @typescript-eslint/no-explicit-any
const orderCount = async () => (await payload.count({ collection: 'orders', overrideAccess: true })).totalDocs

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'softmarket-p5-'))
  process.env.UPLOADS_DIR = join(dir, 'uploads')
  process.env.DATABASE_URI = `file:${dir}/test.db`
  process.env.PAYLOAD_SECRET ||= 'test-secret-long-enough-for-payload'
  for (const key of ['SMTP_HOST', 'SMTP_FROM', 'PAYMENTS_ALERT_EMAIL', 'PAYMENTS_STRIPE_ENABLED']) delete process.env[key]
  Object.assign(process.env, ENV)
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: (await import('../../src/payload.config')).default })
  const { migrations } = (await import('../../src/migrations')) as unknown as { migrations: never[] }
  await payload.db.migrate({ migrations })
  const family = await payload.create({ collection: 'product-families', overrideAccess: true, locale: 'tr', data: { title: 'Aile', slug: 'aile', _status: 'published' } as never })
  const product = await payload.create({ collection: 'products', overrideAccess: true, locale: 'tr', data: { title: 'Ürün', slug: 'urun', family: family.id, _status: 'published' } as never })
  const make = (sku: string, extra: Record<string, unknown>) => payload.create({ collection: 'editions', overrideAccess: true, locale: 'tr', data: { title: sku, sku, product: product.id, licenseType: 'subscription', durationMonths: 12, seats: 3, ...extra } as never })
  await make('BUY-1', { saleMode: 'buy', pricing: { taxMode: 'inclusive', tryMinor: 125000, usdMinor: 4000 } })
  await make('BUY-EXCL', { saleMode: 'buy', pricing: { taxMode: 'exclusive', tryMinor: 100000 } })
  await make('QUOTE-1', {})
  for (const [slug, kind] of Object.entries(KINDS)) {
    const page = await payload.create({ collection: 'pages', overrideAccess: true, locale: 'tr', data: { title: slug, slug, pageType: 'legal', layout: richLayout(`Reviewed ${kind} text TR.`, 'Second paragraph.'), _status: 'published', commerceLegal: kind } as never })
    await payload.update({ collection: 'pages', id: page.id, overrideAccess: true, locale: 'en', data: { title: `${slug}-en`, slug: `${slug}-en`, layout: withText(page.layout, `Reviewed ${kind} text EN.`), _status: 'published' } as never })
    legalIds[kind] = page.id as number
  }
  await payload.updateGlobal({ slug: 'site-settings', overrideAccess: true, locale: 'tr', data: { company: { legalName: 'Örnek Yazılım A.Ş.', taxOffice: 'Kadıköy', taxNumber: '1234567890', mersisNo: '0123456789012345' }, contact: { email: 'info@example.test', phone: '+90 212 000 00 00', address: 'İstanbul' } } as never })
  const customer = (email: string, verified: boolean) => payload.create({ collection: 'customers', overrideAccess: true, disableVerificationEmail: true, data: { email, password: 'p5-test-password-123', name: 'Ali', _verified: verified } as never }).then((c) => ({ id: c.id as number, email, _verified: verified, collection: 'customers' as const }))
  customerA = await customer('a.p5@example.test', true)
  customerB = await customer('b.p5@example.test', true)
  unverified = await customer('u.p5@example.test', false)
  vi.spyOn(console, 'log').mockImplementation(() => {})
}, 240000)

afterAll(async () => {
  vi.restoreAllMocks()
  await payload?.destroy()
  if (dir) rmSync(dir, { recursive: true, force: true })
  process.env = saved
})

beforeEach(async () => {
  Object.assign(process.env, ENV)
  provider.mode = 'ok'
  provider.calls.length = 0
  await setSite(PAYMENTS)
})
afterEach(() => { vi.unstubAllGlobals() })

describe('checkout core: server-side amounts and the order record', () => {
  it('creates one pending order with server-computed net/VAT/total, consents and a frozen contract copy', async () => {
    const before = await orderCount()
    const result = await checkout(await formInput())
    expect(result).toMatchObject({ ok: true, kind: 'redirect' })
    if (!result.ok || result.kind !== 'redirect') return
    expect(result.redirectUrl).toMatch(/^https:\/\/sandbox-cpp\.iyzipay\.com\/?\?token=/)
    expect(await orderCount()).toBe(before + 1)
    const order = (await orders()).find((o) => o.orderNumber === result.orderNumber)!
    // 1250.00 TRY, VAT included at 20 %: net = round(125000 / 1.2) = 104167, VAT = 20833.
    expect(order).toMatchObject({ status: 'pending', currency: 'TRY', subtotalMinor: 104167, vatMinor: 20833, totalMinor: 125000, provider: 'iyzico', providerEnv: 'sandbox', locale: 'tr' })
    expect(order.items[0]).toMatchObject({ sku: 'BUY-1', unitNetMinor: 104167, vatMinor: 20833, lineTotalMinor: 125000, vatRateBasisPoints: 2000, taxMode: 'inclusive', seats: 3 })
    expect(order.providerRef).toMatch(/^tokP5/)
    expect(order.billing).toMatchObject({ type: 'individual', name: 'Ali Veli', identityNumber: TCKN, email: customerA.email })
    expect(order.consents).toMatchObject({ digitalWaiverAccepted: true, ip: '203.0.113.9', userAgent: 'vitest-agent' })
    expect(order.consents.preInformationVersion).toBeTruthy()
    expect(order.consents.distanceSalesVersion).toBeTruthy()
    const { snapshotSha256 } = await import('../../src/lib/payments/contract')
    expect(order.consents.snapshotSha256).toBe(snapshotSha256(order.contractSnapshot))
    expect(order.contractSnapshot).toContain('Reviewed distanceSales text TR.')
    expect(order.contractSnapshot).toContain('Reviewed preInformation text TR.')
    expect(order.contractSnapshot).toContain(result.orderNumber)
    expect(order.contractSnapshot).toContain('Örnek Yazılım A.Ş.')
    expect(order.contractSnapshot).not.toContain(TCKN)
    expect(order.contractSnapshot).toContain('•••••••146')
    // The provider got the server's amount, order number and buyer snapshot (never anything the form could set).
    expect(provider.calls).toHaveLength(1)
    expect(provider.calls[0]).toMatchObject({ price: '1250.00', paidPrice: '1250.00', currency: 'TRY', conversationId: result.orderNumber })
    expect(provider.calls[0]!.callbackUrl).toBe('https://shop.example/api/payments/iyzico/callback')
    expect((provider.calls[0]!.buyer as Record<string, unknown>).gsmNumber).toBe('+905320000000')
  })

  it('exclusive and exempt prices: VAT added / zero, total matches the provider amount', async () => {
    const excl = await checkout(await formInput({ sku: 'BUY-EXCL' }))
    expect(excl.ok).toBe(true)
    const exclOrder = (await orders()).find((o) => o.orderNumber === (excl as { orderNumber: string }).orderNumber)!
    expect(exclOrder).toMatchObject({ subtotalMinor: 100000, vatMinor: 20000, totalMinor: 120000 })
    const usd = await checkout(await formInput({ currency: 'USD' }))
    expect(usd.ok).toBe(true)
    const usdOrder = (await orders()).find((o) => o.orderNumber === (usd as { orderNumber: string }).orderNumber)!
    expect(usdOrder).toMatchObject({ currency: 'USD', subtotalMinor: 4000, vatMinor: 0, totalMinor: 4000 })
    expect(provider.calls.at(-1)).toMatchObject({ price: '40.00', currency: 'USD' })
  })

  it('corporate buyers keep their tax identity; the waiver is optional for them', async () => {
    const r = await checkout(await formInput({ type: 'corporate', company: 'Örnek A.Ş.', taxNumber: '1234567890', taxOffice: 'Kadıköy', identityNumber: '', consentWaiver: undefined }))
    expect(r.ok).toBe(true)
    const order = (await orders()).find((o) => o.orderNumber === (r as { orderNumber: string }).orderNumber)!
    expect(order.billing).toMatchObject({ type: 'corporate', company: 'Örnek A.Ş.', taxNumber: '1234567890', taxOffice: 'Kadıköy' })
    const { getMyOrder } = await import('../../src/lib/portal/orders')
    const view = await getMyOrder(customerA as never, 'tr', order.orderNumber)
    expect(view?.billing?.taxNumber).toBe('•••••••890')
    expect(order.contractSnapshot).toContain('•••••••890')
    expect(order.consents.digitalWaiverAccepted).toBe(false)
    expect((provider.calls.at(-1)!.buyer as Record<string, unknown>).identityNumber).toBe('1234567890')
  })

  it('an English order freezes the English legal texts', async () => {
    const r = await checkout(await formInput({ locale: 'en', legal: await legalDigestNow('en') }))
    expect(r.ok).toBe(true)
    const order = (await orders()).find((o) => o.orderNumber === (r as { orderNumber: string }).orderNumber)!
    expect(order.locale).toBe('en')
    expect(order.contractSnapshot).toContain('Reviewed distanceSales text EN.')
    expect(order.contractSnapshot).not.toContain('text TR.')
  })
})

describe('idempotency: one order per form token', () => {
  it('the same token twice → one order, the second submit never reaches the provider', async () => {
    const input = await formInput()
    const first = await checkout(input)
    const calls = provider.calls.length
    const before = await orderCount()
    const second = await checkout(input)
    expect(first).toMatchObject({ ok: true, kind: 'redirect' })
    expect(second).toMatchObject({ ok: true, kind: 'duplicate', orderNumber: (first as { orderNumber: string }).orderNumber })
    expect(await orderCount()).toBe(before)
    expect(provider.calls.length).toBe(calls)
  })

  it('concurrent double submit → exactly one order and one provider call', async () => {
    const input = await formInput()
    const before = await orderCount()
    const results = await Promise.all([checkout(input), checkout(input)])
    expect(await orderCount()).toBe(before + 1)
    expect(provider.calls).toHaveLength(1)
    expect(results.filter((r) => r.ok && r.kind === 'redirect')).toHaveLength(1)
    const numbers = new Set(results.map((r) => (r.ok ? r.orderNumber : 'x')))
    expect(numbers.size).toBe(1)
  })

  it('the token is bound to the customer: another customer with the same token gets their own order', async () => {
    const input = await formInput()
    const a = await checkout(input, customerA)
    const b = await checkout(input, customerB)
    expect(a.ok && b.ok).toBe(true)
    expect((a as { orderNumber: string }).orderNumber).not.toBe((b as { orderNumber: string }).orderNumber)
  })
})

describe('gates: nothing is created when checkout is closed or unavailable', () => {
  const expectNoOrder = async (input: Record<string, string>, code: string, customer?: typeof customerA) => {
    const before = await orderCount()
    const calls = provider.calls.length
    expect(await checkout(input, customer)).toMatchObject({ ok: false, code })
    expect(await orderCount()).toBe(before)
    expect(provider.calls.length).toBe(calls)
  }

  it('site mode quote-only → closed', async () => {
    const input = await formInput()
    await setSite({ ...PAYMENTS, mode: 'quote-only' })
    await expectNoOrder(input, 'closed')
  })

  it('env capability off → closed (no DB-backed offer is read)', async () => {
    const input = await formInput()
    delete process.env.PAYMENTS_ENABLED
    await expectNoOrder(input, 'closed')
  })

  it('quote edition, unknown SKU and a currency without a price → unavailable', async () => {
    await expectNoOrder(await formInput({ sku: 'QUOTE-1' }), 'unavailable')
    await expectNoOrder(await formInput({ sku: 'NO-SUCH-SKU' }), 'unavailable')
    await expectNoOrder(await formInput({ currency: 'EUR' }), 'unavailable')
  })

  it('an unverified customer cannot buy', async () => {
    await expectNoOrder(await formInput(), 'unverified', unverified)
  })

  it('legal text changed after the form was shown → legal_changed; draft banner → closed', async () => {
    const input = await formInput()
    await setLegal('distanceSales', 'Reviewed distanceSales text TR v2.')
    await expectNoOrder(input, 'legal_changed')
    const fresh = await formInput()
    await expect(checkout(fresh)).resolves.toMatchObject({ ok: true })
    await setLegal('refund', 'TASLAK — taslak metin')
    // A draft/placeholder sales text closes the whole payments gate (`legalReady`, P7): fail to quote.
    await expectNoOrder(await formInput(), 'closed')
    await setLegal('refund', 'Reviewed refund text TR.')
  })

  it('provider failure → order failed with a short code, user-facing result without detail', async () => {
    provider.mode = 'failure'
    const before = await orderCount()
    const result = await checkout(await formInput())
    expect(result).toMatchObject({ ok: false, code: 'provider_failed' })
    expect(await orderCount()).toBe(before + 1)
    const order = (await orders()).find((o) => o.orderNumber === (result as { orderNumber: string }).orderNumber)!
    expect(order.status).toBe('failed')
    expect(order.failureReason).toMatch(/^checkout_/)
    expect(JSON.stringify(result)).not.toMatch(/10051|iyzico|sandbox/)
    provider.mode = 'network'
    expect(await checkout(await formInput())).toMatchObject({ ok: false, code: 'provider_failed' })
  })
})

describe('portal reads: customers only see their own orders (no IDOR)', () => {
  it("another customer's order number is indistinguishable from a missing one", async () => {
    const { getMyOrder, getMyOrders, getLatestOrderNumber, countMyOrders } = await import('../../src/lib/portal/orders')
    const mine = await checkout(await formInput(), customerA)
    const theirs = await checkout(await formInput(), customerB)
    const a = (mine as { orderNumber: string }).orderNumber
    const b = (theirs as { orderNumber: string }).orderNumber
    const asA = customerA as never
    const asB = customerB as never
    expect((await getMyOrder(asA, 'tr', a))?.orderNumber).toBe(a)
    expect(await getMyOrder(asA, 'tr', b)).toBeNull()
    expect(await getMyOrder(asB, 'tr', a)).toBeNull()
    expect(await getMyOrder(asA, 'tr', 'SM-000000-AAAAAA')).toBeNull()
    expect(await getMyOrder(asA, 'tr', "SM-1' OR 1=1")).toBeNull()
    expect((await getMyOrders(asA, 'tr')).every((o) => o.orderNumber !== b)).toBe(true)
    expect((await getMyOrders(asB, 'tr')).some((o) => o.orderNumber === b)).toBe(true)
    expect(await getLatestOrderNumber(asB)).toBe(b)
    expect(await countMyOrders(asB)).toBeGreaterThan(0)
    // The customer sees billing + contract copy of THEIR order but never staff-only or provider fields.
    const full = (await getMyOrder(asA, 'tr', a))!
    expect(full.contractSnapshot).toContain(a)
    expect(full.billing?.identityNumber).toBe('••••••••146')
    expect(JSON.stringify(full)).not.toMatch(/idempotency|providerRef|notifications|requiresReview/)
    // Staff-only/secret fields are stripped by field access for the customer principal.
    const raw = await payload.findByID({ collection: 'orders', id: full.id, user: asA, overrideAccess: false, depth: 0 }) as unknown as Record<string, unknown>
    expect(raw).not.toHaveProperty('idempotencyKey')
    expect(raw).not.toHaveProperty('notes')
    const editor = { id: 999, collection: 'users', roles: ['editor'] }
    const editorView = await payload.findByID({ collection: 'orders', id: full.id, user: editor as never, overrideAccess: false, depth: 0 }) as unknown as Record<string, unknown>
    expect(editorView).not.toHaveProperty('billing')
    expect(editorView).not.toHaveProperty('consents')
    expect(editorView).not.toHaveProperty('contractSnapshot')
    const admin = { id: 998, collection: 'users', roles: ['admin'] }
    const adminView = await payload.findByID({ collection: 'orders', id: full.id, user: admin as never, overrideAccess: false, depth: 0 }) as unknown as Record<string, unknown>
    expect(adminView.contractSnapshot).toContain(a)
  })

  it('history stays readable after the site returns to quote-only (S3)', async () => {
    const { getMyOrders } = await import('../../src/lib/portal/orders')
    await checkout(await formInput(), customerA)
    await setSite({ ...PAYMENTS, mode: 'quote-only' })
    expect((await getMyOrders(customerA as never, 'tr')).length).toBeGreaterThan(0)
  })

  it('customers cannot create or change orders through the Local API', async () => {
    const created = await checkout(await formInput(), customerA)
    const order = (await orders()).find((o) => o.orderNumber === (created as { orderNumber: string }).orderNumber)!
    await expect(payload.update({ collection: 'orders', id: order.id, user: customerA as never, overrideAccess: false, data: { status: 'paid' } as never })).rejects.toThrow()
    await expect(payload.delete({ collection: 'orders', id: order.id, user: customerA as never, overrideAccess: false })).rejects.toThrow()
  })
})

describe('Server Action', () => {
  const post = (fields: Record<string, string | undefined>, origin: string | null = 'https://shop.example') => {
    hdrs.current = new Headers({ host: 'shop.example', 'user-agent': 'vitest-agent', ...(origin ? { origin } : {}) })
    const data = new FormData()
    for (const [k, v] of Object.entries(fields)) if (v !== undefined) data.set(k, v)
    return data
  }
  const act = async (data: FormData) => {
    const { startCheckoutAction } = await import('../../src/lib/portal/checkout-actions')
    return startCheckoutAction({ status: 'idle' }, data).then((state) => ({ state }), (error: Error) => ({ error: error.message }))
  }
  beforeEach(() => { session.customer = customerA; vi.stubGlobal('fetch', fakeFetch) })

  it('refuses a request without a matching Origin; creates nothing', async () => {
    const before = await orderCount()
    expect(await act(post(await formInput(), null))).toEqual({ state: { status: 'error' } })
    expect(await act(post(await formInput(), 'https://evil.example'))).toEqual({ state: { status: 'error' } })
    expect(await orderCount()).toBe(before)
  })

  it('anonymous visitors are sent to the login page', async () => {
    session.customer = null
    const r = await act(post(await formInput()))
    expect(r).toMatchObject({ error: expect.stringMatching(/^NEXT_REDIRECT \/tr\/hesap\/giris/) })
  })

  it('invalid form → field errors and echoed values, no order; amounts in the form are ignored', async () => {
    const before = await orderCount()
    const r = await act(post(await formInput({ identityNumber: '12345678901', consentSales: undefined })))
    expect(r).toMatchObject({ state: { status: 'invalid', errors: { identityNumber: 'invalid', consentSales: 'invalid' }, values: { name: 'Ali Veli' } } })
    expect(await orderCount()).toBe(before)
    // A forged price field is not part of the schema: the order total still comes from the edition.
    const ok = await act(post({ ...(await formInput()), totalMinor: '1', price: '0.01', amount: '1' }))
    expect(ok).toMatchObject({ error: expect.stringMatching(/^NEXT_REDIRECT https:\/\/sandbox-cpp\.iyzipay\.com\/?\?token=/) })
    expect((await orders()).at(-1)).toMatchObject({ totalMinor: 125000 })
    expect(provider.calls.at(-1)).toMatchObject({ price: '1250.00' })
  })

  it('success → redirect to the hosted page; the same form again → the order page (still one order)', async () => {
    const input = await formInput()
    const before = await orderCount()
    const first = await act(post(input))
    expect(first).toMatchObject({ error: expect.stringMatching(/^NEXT_REDIRECT https:\/\/sandbox-cpp\.iyzipay\.com/) })
    const second = await act(post(input))
    expect(second).toMatchObject({ error: expect.stringMatching(/^NEXT_REDIRECT \/tr\/hesap\/siparisler\/SM-\d{6}-[0-9A-Z]{6}$/) })
    expect(await orderCount()).toBe(before + 1)
  })

  it('closed mode → fail to quote (redirect to the quote form for this edition), no order', async () => {
    const input = await formInput()
    await setSite({ ...PAYMENTS, mode: 'quote-only' })
    const before = await orderCount()
    expect(await act(post(input))).toMatchObject({ error: 'NEXT_REDIRECT /tr/teklif-iste?urun=urun&surum=BUY-1' })
    expect(await orderCount()).toBe(before)
  })

  it('provider outage → generic message, order failed, no provider detail', async () => {
    provider.mode = 'failure'
    const r = await act(post(await formInput()))
    expect(r).toEqual({ state: { status: 'provider', values: expect.any(Object) } })
    expect((await orders()).at(-1)).toMatchObject({ status: 'failed' })
  })

  it('legal change between render and submit → status legal (form re-renders with fresh texts)', async () => {
    const input = await formInput()
    await setLegal('preInformation', 'Reviewed preInformation text TR v2.')
    const before = await orderCount()
    expect(await act(post(input))).toMatchObject({ state: { status: 'legal' } })
    expect(await orderCount()).toBe(before)
  })
})

describe('return path from the provider', () => {
  it('the iyzico callback resolves to the order list return URL, never to an order number', async () => {
    const { handleIyzicoCallback } = await import('../../src/lib/payments/events')
    const { createPaymentsDeps } = await import('../../src/lib/payments/runtime')
    const r = await checkout(await formInput({ locale: 'en', legal: await legalDigestNow('en') }), customerA)
    const order = (await orders()).find((o) => o.orderNumber === (r as { orderNumber: string }).orderNumber)!
    const deps = createPaymentsDeps(payload, { env: readPaymentsEnv(ENV), fetch: (async () => ({ ok: false, status: 500, text: async () => '{}' })) as never, origin: 'https://shop.example', defer: () => {} })
    const res = await handleIyzicoCallback(deps, new Request('https://shop.example/api/payments/iyzico/callback', { method: 'POST', body: `token=${order.providerRef}`, headers: { 'content-type': 'application/x-www-form-urlencoded' } }))
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/en/account/orders?donus=1')
    expect(res.headers.get('location')).not.toContain('SM-')
    await run('SELECT 1')
  })
})
