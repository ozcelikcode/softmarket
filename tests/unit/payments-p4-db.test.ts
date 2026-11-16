import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { readPaymentsEnv } from '../../src/lib/payments/env'
import type { PaymentsDeps } from '../../src/lib/payments/runtime'
import { iyzicoResponseSignature, iyzicoWebhookSignature, type IyzicoWebhookPayload } from '../../src/lib/payments/signature/iyzico'
import { computeStripeSignature } from '../../src/lib/payments/signature/stripe'
import type { FetchLike } from '../../src/lib/payments/types'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_noStore: vi.fn() }))
// next/server after(): queued here so the manual-assignment licence hook can be observed (request context present).
const afterQueue = vi.hoisted(() => [] as (() => Promise<void>)[])
vi.mock('next/server', async (importOriginal) => ({ ...(await importOriginal<object>()), after: (fn: () => Promise<void>) => void afterQueue.push(fn) }))

/*
 * P4 end to end on a temporary SQLite database (all migrations), real Payload Local API, real store transactions and
 * a FAKE provider HTTP layer (injected fetch; no network). Covers plan §6 DB/signature rows and P4 acceptance:
 * webhook → one licence, replay → one licence, concurrent webhooks + callback → one licence, amount mismatch →
 * review without licence, drain window, retrieve failure → error + redelivery, SQLITE_BUSY → 500, callback errors,
 * reconcile (dry run, idempotent), post-commit e-mail, and a PII scan over every captured log line.
 */

const IYZ_KEY = 'sandbox-ApiKey-P4test0001'
const IYZ_SECRET = 'sandbox-SecretKey-P4test0001'
const STRIPE_SECRET = 'sk_test_P4testStripeKey0001'
const STRIPE_WHSEC = 'whsec_P4testWebhookSecret0001'
const BUYER_EMAIL = 'buyer.p4@example.test'
const TCKN = '10000000146'

let payload: Payload
let dir: string
let editionId: number
let customerId: number
const savedEnv = { ...process.env }
const run = (q: string) => payload.db.drizzle.$client.execute(q)

// ---- fake iyzico -------------------------------------------------------------------------------------------------
type FakeState = { paymentStatus: string; price: string; currency: string; conversationId: string; fraudStatus?: number }
const provider = {
  states: new Map<string, FakeState>(),
  calls: 0,
  mode: 'ok' as 'ok' | 'network' | 'timeout' | 'failure',
}
const fakeFetch: FetchLike = async (url, init) => {
  provider.calls++
  if (provider.mode === 'network') throw new TypeError('fetch failed')
  if (provider.mode === 'timeout') {
    await new Promise((resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted'))))
  }
  const body = JSON.parse(init.body ?? '{}') as { token: string }
  const s = provider.states.get(body.token)
  const reply = (json: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(json) })
  if (!url.endsWith('/payment/iyzipos/checkoutform/auth/ecom/detail')) return { ok: false, status: 404, text: async () => '{}' }
  if (provider.mode === 'failure' || !s) return reply({ status: 'failure', errorCode: '5004' })
  // Concurrency: let other handlers interleave while this "network" call is in flight.
  await new Promise((resolve) => setTimeout(resolve, 5))
  const paymentId = '22416032'
  const values = [s.paymentStatus, paymentId, s.currency, s.conversationId, s.conversationId, s.price.replace(/0+$/, '').replace(/\.$/, ''), s.price.replace(/0+$/, '').replace(/\.$/, ''), body.token]
  return reply({
    status: 'success', paymentStatus: s.paymentStatus, paymentId, currency: s.currency, basketId: s.conversationId,
    conversationId: s.conversationId, paidPrice: s.price, price: s.price, token: body.token, fraudStatus: s.fraudStatus ?? 1,
    installment: 1, signature: iyzicoResponseSignature(IYZ_SECRET, values),
  })
}

// ---- deps / logs -------------------------------------------------------------------------------------------------
const logs: string[] = []
const tasks: Promise<void>[] = []
let clock: Date | null = null
const ENV = {
  PAYMENTS_ENABLED: 'true', IYZICO_API_KEY: IYZ_KEY, IYZICO_SECRET_KEY: IYZ_SECRET, IYZICO_BASE_URL: 'https://sandbox-api.iyzipay.com',
  PAYMENTS_STRIPE_ENABLED: 'true', STRIPE_SECRET_KEY: STRIPE_SECRET, STRIPE_WEBHOOK_SECRET: STRIPE_WHSEC,
}
let deps: PaymentsDeps
const makeDeps = async (env: Record<string, string> = ENV): Promise<PaymentsDeps> => {
  const { createPaymentsDeps } = await import('../../src/lib/payments/runtime')
  return createPaymentsDeps(payload, {
    env: readPaymentsEnv(env), fetch: fakeFetch, now: () => clock ?? new Date(), origin: 'https://shop.example',
    defer: (task) => void tasks.push(task()),
  })
}
const settle = async () => { while (tasks.length) await Promise.allSettled(tasks.splice(0)) }

// ---- helpers -----------------------------------------------------------------------------------------------------
let seq = 0
async function createOrder(opts: { status?: string; total?: number; currency?: string; provider?: string; providerRef?: string | null } = {}) {
  const n = ++seq
  const token = opts.providerRef === undefined ? `tok${String(n).padStart(6, '0')}abcdefgh` : opts.providerRef
  const total = opts.total ?? 1200_00
  const order = await payload.create({
    collection: 'orders', overrideAccess: true, depth: 0,
    data: {
      customer: customerId, status: opts.status ?? 'pending',
      items: [{ edition: editionId, sku: 'P4-PRO', title: 'Pro', licenseType: 'subscription', durationMonths: 12, seats: 3, taxMode: 'inclusive', unitNetMinor: total - 200_00, vatRateBasisPoints: 2000, vatMinor: 200_00, lineTotalMinor: total }],
      currency: opts.currency ?? 'TRY', subtotalMinor: total - 200_00, vatMinor: 200_00, totalMinor: total,
      provider: opts.provider ?? 'iyzico', providerEnv: 'sandbox', ...(token ? { providerRef: token } : {}),
      idempotencyKey: `idem-p4-${n}-${Date.now()}`, locale: 'tr',
      billing: { type: 'individual', name: 'Ali Veli', identityNumber: TCKN, email: BUYER_EMAIL, city: 'İstanbul' },
    } as never,
  })
  return { id: order.id as number, orderNumber: (order as { orderNumber: string }).orderNumber, token: token ?? '' }
}
const paidAt = (order: { orderNumber: string; token: string }, price = '1200.00', currency = 'TRY') =>
  provider.states.set(order.token, { paymentStatus: 'SUCCESS', price, currency, conversationId: order.orderNumber })
const orderOf = async (id: number) => payload.findByID({ collection: 'orders', id, depth: 0, overrideAccess: true }) as unknown as Promise<{ status: string; requiresReview: boolean; failureReason?: string; items: { license?: number | null }[]; paidAt?: string; providerPaymentId?: string }>
const licenseCount = async () => (await payload.count({ collection: 'licenses', overrideAccess: true })).totalDocs
const eventsOf = async (orderId?: number) => (await payload.find({ collection: 'payment-events', overrideAccess: true, depth: 0, limit: 100, ...(orderId ? { where: { order: { equals: orderId } } } : {}) })).docs as unknown as { status: string; failureCode?: string; eventKey: string }[]

function iyzicoWebhook(order: { orderNumber: string; token: string }, extra: Partial<IyzicoWebhookPayload> & { tamper?: Record<string, unknown>; signature?: string; pad?: number } = {}) {
  const body: IyzicoWebhookPayload & Record<string, unknown> = {
    iyziEventType: extra.iyziEventType ?? 'CHECKOUT_FORM_AUTH', iyziPaymentId: 22416032, token: order.token,
    paymentConversationId: order.orderNumber, status: extra.status ?? 'SUCCESS',
  }
  const signature = extra.signature ?? iyzicoWebhookSignature(IYZ_SECRET, body)
  const raw = JSON.stringify({ ...body, ...extra.tamper, ...(extra.pad ? { pad: 'x'.repeat(extra.pad) } : {}) })
  return new Request('https://shop.example/api/payments/iyzico/webhook', { method: 'POST', body: raw, headers: { 'content-type': 'application/json', 'x-iyz-signature-v3': signature } })
}
const callback = (body: string) => new Request('https://shop.example/api/payments/iyzico/callback', {
  method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://sandbox-api.iyzipay.com' },
})
async function webhook(req: Request, d = deps) {
  const { handleProviderWebhook } = await import('../../src/lib/payments/events')
  const res = await handleProviderWebhook(d, req.url.includes('/stripe/') ? 'stripe' : 'iyzico', req)
  await settle()
  return res
}
async function setMode(mode: 'payments' | 'quote-only', quoteSince: Date | null = null) {
  await run(`UPDATE site_settings SET commerce_mode = '${mode}', commerce_quote_since = ${quoteSince ? `'${quoteSince.toISOString()}'` : 'NULL'}`)
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'softmarket-p4-'))
  process.env.UPLOADS_DIR = join(dir, 'uploads')
  process.env.DATABASE_URI = `file:${dir}/test.db`
  process.env.PAYLOAD_SECRET ||= 'test-secret-long-enough-for-payload'
  for (const key of ['PAYMENTS_ENABLED', 'PAYMENTS_STRIPE_ENABLED', 'SMTP_HOST', 'SMTP_FROM', 'PAYMENTS_ALERT_EMAIL']) delete process.env[key]
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: (await import('../../src/payload.config')).default })
  const { migrations } = (await import('../../src/migrations')) as unknown as { migrations: never[] }
  await payload.db.migrate({ migrations })
  for (const q of [
    `INSERT INTO product_families(id) VALUES(1)`,
    `INSERT INTO product_families_locales(title,slug,_locale,_parent_id) VALUES('Aile','aile','tr',1)`,
    `INSERT INTO products(id,family_id,_status) VALUES(1,1,'published')`,
    `INSERT INTO products_locales(title,slug,_locale,_parent_id) VALUES('Ürün','urun','tr',1)`,
  ]) await run(q)
  if ((await run('SELECT COUNT(*) AS n FROM site_settings')).rows[0]!.n === 0) await run('INSERT INTO site_settings(id) VALUES(1)')
  editionId = (await payload.create({ collection: 'editions', overrideAccess: true, data: { title: 'Pro', sku: 'P4-PRO', product: 1, licenseType: 'subscription', durationMonths: 12, seats: 3 } as never })).id as number
  customerId = (await payload.create({ collection: 'customers', overrideAccess: true, disableVerificationEmail: true, data: { email: BUYER_EMAIL, password: 'p4-test-password-123', name: 'Ali', _verified: true } as never })).id as number

  // Capture every log line written from here on (Payload logger + console).
  for (const level of ['info', 'warn', 'error', 'debug'] as const) {
    const original = payload.logger[level].bind(payload.logger)
    vi.spyOn(payload.logger, level).mockImplementation(((...args: unknown[]) => { logs.push(args.map((a) => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')); return original(...(args as [string])) }) as never)
  }
  for (const level of ['log', 'info', 'warn', 'error'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => void logs.push(args.map(String).join(' ')))
  }
  deps = await makeDeps()
}, 240000)

afterAll(async () => {
  vi.restoreAllMocks()
  await payload?.destroy()
  if (dir) rmSync(dir, { recursive: true, force: true })
  process.env = savedEnv
})

beforeEach(async () => {
  provider.mode = 'ok'
  clock = null
  await setMode('payments')
})

describe('webhook signatures through the handler', () => {
  it('valid → 200, processed, one licence; invalid / tampered / oversized → rejected without any write', async () => {
    const order = await createOrder()
    paidAt(order)
    const before = await licenseCount()

    const forged = await webhook(iyzicoWebhook(order, { signature: 'f'.repeat(64) }))
    expect(forged.status).toBe(400)
    expect(await forged.text()).toBe('')
    const tampered = await webhook(iyzicoWebhook(order, { tamper: { status: 'FAILURE' } }))
    expect(tampered.status).toBe(400)
    const missing = await webhook(new Request('https://shop.example/api/payments/iyzico/webhook', { method: 'POST', body: '{}' }))
    expect(missing.status).toBe(400)
    const huge = await webhook(iyzicoWebhook(order, { pad: 300 * 1024 }))
    expect(huge.status).toBe(413)
    expect(provider.calls).toBe(0)
    expect(await eventsOf()).toHaveLength(0)
    expect((await orderOf(order.id)).status).toBe('pending')

    const ok = await webhook(iyzicoWebhook(order))
    expect(ok.status).toBe(200)
    const stored = await orderOf(order.id)
    expect(stored.status).toBe('fulfilled')
    expect(stored.paidAt).toBeTruthy()
    expect(stored.providerPaymentId).toBe('22416032')
    expect(stored.items[0]!.license).toBeTruthy()
    expect(await licenseCount()).toBe(before + 1)
    expect((await eventsOf(order.id)).map((e) => e.status)).toEqual(['processed'])
  })

  it('stripe: adapter off → 404; on: replayed timestamp (>300 s) → 400; valid signature, unknown session → 200 ignored', async () => {
    const offDeps = await makeDeps({ ...ENV, PAYMENTS_STRIPE_ENABLED: 'false' })
    const body = JSON.stringify({ id: 'evt_P4unknown', type: 'checkout.session.completed', data: { object: { object: 'checkout.session', id: 'cs_test_P4unknown', client_reference_id: 'SM-261116-ABCDEF' } } })
    const sign = (t: number) => `t=${t},v1=${computeStripeSignature(body, STRIPE_WHSEC, t)}`
    const req = (sig: string) => new Request('https://shop.example/api/payments/stripe/webhook', { method: 'POST', body, headers: { 'stripe-signature': sig } })
    expect((await webhook(req(sign(Math.floor(Date.now() / 1000))), offDeps)).status).toBe(404)
    expect((await webhook(req(sign(Math.floor(Date.now() / 1000) - 301)))).status).toBe(400)
    expect((await webhook(req(`t=${Math.floor(Date.now() / 1000)},v1=${'ab'.repeat(32)}`))).status).toBe(400)
    expect((await webhook(req(sign(Math.floor(Date.now() / 1000))))).status).toBe(200)
    const [event] = (await payload.find({ collection: 'payment-events', where: { eventKey: { equals: 'stripe:evt_P4unknown' } }, overrideAccess: true })).docs as unknown as { status: string; failureCode: string }[]
    expect(event).toMatchObject({ status: 'ignored', failureCode: 'unknown_order' })
  })
})

describe('exactly one licence', () => {
  it('the same event twice → one licence; the second delivery is a 200 duplicate without a provider call', async () => {
    const order = await createOrder()
    paidAt(order)
    const before = await licenseCount()
    expect((await webhook(iyzicoWebhook(order))).status).toBe(200)
    const calls = provider.calls
    expect((await webhook(iyzicoWebhook(order))).status).toBe(200)
    expect(provider.calls).toBe(calls)
    expect(await licenseCount()).toBe(before + 1)
    expect(await eventsOf(order.id)).toHaveLength(1)
  })

  it('two concurrent webhooks (same event + another event) and the callback at once → one licence', async () => {
    const order = await createOrder()
    paidAt(order)
    const before = await licenseCount()
    const { handleIyzicoCallback } = await import('../../src/lib/payments/events')
    const results = await Promise.all([
      webhook(iyzicoWebhook(order)),
      webhook(iyzicoWebhook(order)),
      webhook(iyzicoWebhook(order, { iyziEventType: 'CHECKOUT_FORM_AUTH_RETRY' })),
      handleIyzicoCallback(deps, callback(`token=${order.token}`)),
      handleIyzicoCallback(deps, callback(`token=${order.token}`)),
    ])
    await settle()
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 303, 303])
    expect(await licenseCount()).toBe(before + 1)
    const stored = await orderOf(order.id)
    expect(stored.status).toBe('fulfilled')
    expect(stored.items[0]!.license).toBeTruthy()
    expect((await eventsOf(order.id)).every((e) => e.status === 'processed')).toBe(true)
  })

  it('amount or currency mismatch → paid + requiresReview, no licence, staff alert logged (no e-mail without config)', async () => {
    const before = await licenseCount()
    const cheap = await createOrder()
    paidAt(cheap, '1.00')
    expect((await webhook(iyzicoWebhook(cheap))).status).toBe(200)
    expect(await orderOf(cheap.id)).toMatchObject({ status: 'paid', requiresReview: true, failureReason: 'amount_mismatch' })
    const usd = await createOrder()
    paidAt(usd, '1200.00', 'USD')
    expect((await webhook(iyzicoWebhook(usd))).status).toBe(200)
    expect(await orderOf(usd.id)).toMatchObject({ status: 'paid', requiresReview: true })
    expect(await licenseCount()).toBe(before)
    expect(logs.some((l) => l.includes(`review alert not emailed`) && l.includes(cheap.orderNumber))).toBe(true)
    // Reconcile never fulfils a reviewed order either.
    const { reconcileOrders } = await import('../../src/lib/payments/reconcile')
    await reconcileOrders(deps)
    expect(await licenseCount()).toBe(before)
  })

  it('fraud review / declined at the provider → no licence', async () => {
    const before = await licenseCount()
    const review = await createOrder()
    provider.states.set(review.token, { paymentStatus: 'SUCCESS', price: '1200.00', currency: 'TRY', conversationId: review.orderNumber, fraudStatus: 0 })
    expect((await webhook(iyzicoWebhook(review))).status).toBe(200)
    expect((await orderOf(review.id)).status).toBe('pending')
    const declined = await createOrder()
    provider.states.set(declined.token, { paymentStatus: 'FAILURE', price: '1200.00', currency: 'TRY', conversationId: declined.orderNumber })
    expect((await webhook(iyzicoWebhook(declined, { status: 'FAILURE' }))).status).toBe(200)
    expect((await orderOf(declined.id)).status).toBe('failed')
    expect(await licenseCount()).toBe(before)
  })
})

describe('drain window (S3: 72 h after switching to quote-only)', () => {
  it('inside the window a signed event is processed; outside it is recorded `ignored` with 200; unsigned → 404', async () => {
    const before = await licenseCount()
    const inside = await createOrder()
    paidAt(inside)
    await setMode('quote-only', new Date(Date.now() - 71 * 3600_000))
    expect((await webhook(iyzicoWebhook(inside))).status).toBe(200)
    expect((await orderOf(inside.id)).status).toBe('fulfilled')
    expect(await licenseCount()).toBe(before + 1)

    const outside = await createOrder()
    paidAt(outside)
    await setMode('quote-only', new Date(Date.now() - 73 * 3600_000))
    expect((await webhook(iyzicoWebhook(outside, { signature: '0'.repeat(64) }))).status).toBe(404)
    expect((await webhook(iyzicoWebhook(outside, { pad: 300 * 1024 }))).status).toBe(404)
    const calls = provider.calls
    expect((await webhook(iyzicoWebhook(outside))).status).toBe(200)
    expect(provider.calls).toBe(calls)
    expect((await orderOf(outside.id)).status).toBe('pending')
    expect(await eventsOf(outside.id)).toEqual([expect.objectContaining({ status: 'ignored', failureCode: 'drain_closed' })])
    // Redelivery stays a duplicate; quote-only without quoteSince is closed too.
    expect((await webhook(iyzicoWebhook(outside))).status).toBe(200)
    await setMode('quote-only', null)
    const { handleIyzicoCallback } = await import('../../src/lib/payments/events')
    expect((await handleIyzicoCallback(deps, callback(`token=${outside.token}`))).status).toBe(404)
    expect(await licenseCount()).toBe(before + 1)
  })

  it('capability off → 404 even inside payments mode', async () => {
    const off = await makeDeps({ ...ENV, PAYMENTS_ENABLED: 'false' })
    const order = await createOrder()
    paidAt(order)
    expect((await webhook(iyzicoWebhook(order), off)).status).toBe(404)
    const { handleIyzicoCallback } = await import('../../src/lib/payments/events')
    expect((await handleIyzicoCallback(off, callback(`token=${order.token}`))).status).toBe(404)
    expect(await eventsOf(order.id)).toHaveLength(0)
  })
})

describe('failures leave the order untouched and are retried', () => {
  it.each(['network', 'timeout', 'failure'] as const)('retrieve %s → 500, event `error`, order unchanged; redelivery → processed + licence', async (mode) => {
    const order = await createOrder()
    paidAt(order)
    const before = await licenseCount()
    provider.mode = mode
    const timeoutDeps = mode === 'timeout' ? await (async () => {
      const { createIyzicoProvider } = await import('../../src/lib/payments/providers/iyzico')
      return { ...deps, providers: { ...deps.providers, iyzico: createIyzicoProvider({ config: readPaymentsEnv(ENV).iyzico!, fetch: fakeFetch, timeoutMs: 20 }) } }
    })() : deps
    expect((await webhook(iyzicoWebhook(order), timeoutDeps)).status).toBe(500)
    expect((await orderOf(order.id)).status).toBe('pending')
    expect(await eventsOf(order.id)).toEqual([expect.objectContaining({ status: 'error', failureCode: mode === 'failure' ? 'provider_error' : 'network_error' })])
    expect(await licenseCount()).toBe(before)
    provider.mode = 'ok'
    expect((await webhook(iyzicoWebhook(order))).status).toBe(200)
    expect((await orderOf(order.id)).status).toBe('fulfilled')
    expect(await licenseCount()).toBe(before + 1)
  })

  it('SQLITE_BUSY while writing → 500 (provider retries); the retry succeeds', async () => {
    const order = await createOrder()
    paidAt(order)
    const begin = payload.db.beginTransaction
    let fail = 1
    payload.db.beginTransaction = async (...args) => {
      if (fail-- > 0) throw Object.assign(new Error('SQLITE_BUSY: database is locked'), { code: 'SQLITE_BUSY' })
      return begin.apply(payload.db, args)
    }
    try {
      expect((await webhook(iyzicoWebhook(order))).status).toBe(500)
    } finally {
      payload.db.beginTransaction = begin
    }
    expect(logs.some((l) => l.includes('code=db_busy'))).toBe(true)
    expect((await webhook(iyzicoWebhook(order))).status).toBe(200)
    expect((await orderOf(order.id)).status).toBe('fulfilled')
  })
})

describe('iyzico callback', () => {
  it('missing / malformed / unknown token → static no-store error page, no echo, no provider call', async () => {
    const { handleIyzicoCallback } = await import('../../src/lib/payments/events')
    const calls = provider.calls
    for (const body of ['', 'status=success', 'token=%3Cscript%3E', 'token=' + 'a'.repeat(200)]) {
      const res = await handleIyzicoCallback(deps, callback(body))
      expect(res.status).toBe(400)
      expect(res.headers.get('cache-control')).toBe('no-store')
      expect(res.headers.get('x-robots-tag')).toContain('noindex')
      expect(res.headers.get('content-security-policy')).toContain("default-src 'none'")
      const html = await res.text()
      expect(html).not.toContain('<script')
      expect(html).not.toContain('unknownToken1234')
    }
    const unknown = await handleIyzicoCallback(deps, callback('token=unknownToken1234'))
    expect(unknown.status).toBe(303)
    expect(unknown.headers.get('location')).toBe('https://shop.example/tr/hesap')
    expect((await handleIyzicoCallback(deps, callback('token=' + 'x'.repeat(20 * 1024)))).status).toBe(400)
    expect(provider.calls).toBe(calls)
  })

  it('valid token → server retrieve (body status ignored) → 303 to the order page; unpaid stays pending', async () => {
    const { handleIyzicoCallback } = await import('../../src/lib/payments/events')
    const unpaid = await createOrder()
    provider.states.set(unpaid.token, { paymentStatus: 'INIT_THREEDS', price: '1200.00', currency: 'TRY', conversationId: unpaid.orderNumber })
    const res = await handleIyzicoCallback(deps, callback(`token=${unpaid.token}&status=success&paymentStatus=SUCCESS`))
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('https://shop.example/tr/hesap')
    expect((await orderOf(unpaid.id)).status).toBe('pending')

    provider.mode = 'network'
    const res2 = await handleIyzicoCallback(deps, callback(`token=${unpaid.token}`))
    expect(res2.status).toBe(303)
    expect((await orderOf(unpaid.id)).status).toBe('pending')
  })
})

describe('reconcile', () => {
  it.each(['pending', 'paid'] as const)('%s: a full page of persistently failing old orders does not starve a newer paid order', async (status) => {
    const { reconcileOrders } = await import('../../src/lib/payments/reconcile')
    await run(`UPDATE orders SET status = 'cancelled' WHERE status IN ('pending', 'paid') AND COALESCE(requires_review, 0) = 0`)
    const limit = 2
    const blocked = []
    for (let i = 0; i < limit; i++) {
      const order = await createOrder({ status })
      // Pending: unknown provider token always fails retrieval. Paid: incomplete item always fails fulfilment.
      if (status === 'paid') await run(`UPDATE orders_items SET edition_id = NULL WHERE _parent_id = ${order.id}`)
      blocked.push(order)
    }
    const healthy = await createOrder({ status })
    paidAt(healthy)
    clock = new Date(Date.now() + 2 * 3600_000)
    const before = await licenseCount()
    for (let attempt = 0; attempt < 2; attempt++) {
      const report = await reconcileOrders(deps, { limit })
      await settle()
      for (const order of blocked) {
        expect(report.actions.filter((a) => a.orderNumber === order.orderNumber)).toEqual([
          expect.objectContaining({ action: 'error' }),
        ])
        expect((await orderOf(order.id)).status).toBe(status)
      }
      expect(report.errors).toBe(limit)
      expect((await orderOf(healthy.id)).status).toBe('fulfilled')
      expect(await licenseCount()).toBe(before + 1)
    }
  })

  it('pages across status changes and equal timestamps; dry run traverses every page without writes', async () => {
    const { reconcileOrders } = await import('../../src/lib/payments/reconcile')
    await run(`UPDATE orders SET status = 'cancelled' WHERE status IN ('pending', 'paid') AND COALESCE(requires_review, 0) = 0`)
    const orders = []
    const created = new Date(Date.now() - 10 * 60_000).toISOString()
    for (let i = 0; i < 5; i++) {
      const order = await createOrder()
      paidAt(order)
      await run(`UPDATE orders SET created_at = '${created}' WHERE id = ${order.id}`)
      orders.push(order)
    }
    const snapshot = async () => Promise.all(['orders', 'orders_items', 'licenses', 'payment_events'].map(async (table) =>
      (await run(`SELECT * FROM ${table} ORDER BY id`)).rows))
    const before = await snapshot()
    const dry = await reconcileOrders(deps, { limit: 2, dryRun: true })
    expect(await snapshot()).toEqual(before)
    for (const order of orders) expect(dry.actions.filter((a) => a.orderNumber === order.orderNumber)).toEqual([
      expect.objectContaining({ action: 'synced', detail: 'pending->paid' }),
    ])
    const count = await licenseCount()
    await reconcileOrders(deps, { limit: 2 })
    await settle()
    for (const order of orders) expect((await orderOf(order.id)).status).toBe('fulfilled')
    expect(await licenseCount()).toBe(count + orders.length)
  })

  it('does not cancel a pending order flagged during retrieval', async () => {
    const { reconcileOrders } = await import('../../src/lib/payments/reconcile')
    const order = await createOrder()
    clock = new Date(Date.now() + 2 * 3600_000)
    const original = deps.providers.iyzico!
    const guarded = { ...deps, now: () => clock!, providers: { ...deps.providers, iyzico: { ...original, retrieve: async () => {
      await run(`UPDATE orders SET requires_review = 1 WHERE id = ${order.id}`)
      return { provider: 'iyzico' as const, providerRef: order.token, orderNumber: order.orderNumber, status: 'pending' as const }
    } } } }
    await reconcileOrders(guarded, { minAgeMs: 0 })
    expect(await orderOf(order.id)).toMatchObject({ status: 'pending', requiresReview: true })
  })

  it('dry run writes nothing; real run completes paid, cancels expired, retries crashed fulfilment; rerun is a no-op', async () => {
    const { reconcileOrders } = await import('../../src/lib/payments/reconcile')
    await run(`UPDATE orders SET status = 'cancelled' WHERE status = 'pending'`)
    const paid = await createOrder()
    paidAt(paid)
    const abandoned = await createOrder()
    provider.states.set(abandoned.token, { paymentStatus: 'INIT_THREEDS', price: '1200.00', currency: 'TRY', conversationId: abandoned.orderNumber })
    const unknownAtProvider = await createOrder()
    const neverStarted = await createOrder({ providerRef: null })
    const fresh = await createOrder()
    paidAt(fresh)
    // A paid order whose fulfilment never ran (crash between transactions).
    const crashed = await createOrder({ status: 'paid' })
    await run(`UPDATE orders SET created_at = '${new Date(Date.now() + 2 * 3600_000 - 60_000).toISOString()}' WHERE id = ${fresh.id}`)
    const before = await licenseCount()
    clock = new Date(Date.now() + 2 * 3600_000)
    const reconcileDeps = await makeDeps()

    const dry = await reconcileOrders(reconcileDeps, { dryRun: true, minAgeMs: 5 * 60_000 })
    expect(dry.dryRun).toBe(true)
    expect(await licenseCount()).toBe(before)
    for (const o of [paid, abandoned, unknownAtProvider, neverStarted]) expect((await orderOf(o.id)).status).toBe('pending')
    expect(dry.actions.find((a) => a.orderNumber === paid.orderNumber)).toMatchObject({ action: 'synced', detail: 'pending->paid' })
    expect(dry.actions.find((a) => a.orderNumber === abandoned.orderNumber)).toMatchObject({ action: 'cancel', detail: 'expired' })

    const report = await reconcileOrders(reconcileDeps, { minAgeMs: 5 * 60_000 })
    await settle()
    expect(report.errors).toBe(1)
    expect((await orderOf(paid.id)).status).toBe('fulfilled')
    expect(await orderOf(abandoned.id)).toMatchObject({ status: 'cancelled', failureReason: 'expired' })
    expect(await orderOf(unknownAtProvider.id)).toMatchObject({ status: 'pending' })
    expect(await orderOf(neverStarted.id)).toMatchObject({ status: 'cancelled', failureReason: 'checkout_not_started' })
    expect((await orderOf(fresh.id)).status).toBe('pending')
    expect((await orderOf(crashed.id)).status).toBe('fulfilled')
    expect(await licenseCount()).toBe(before + 2)

    const again = await reconcileOrders(reconcileDeps, { minAgeMs: 5 * 60_000 })
    expect(again.actions.filter((a) => a.action !== 'none')).toEqual([expect.objectContaining({ orderNumber: unknownAtProvider.orderNumber, action: 'error' })])
    expect(await licenseCount()).toBe(before + 2)

    // A late, provider-verified payment on the cancelled order → paid + review, never a licence.
    paidAt(abandoned)
    clock = null
    expect((await webhook(iyzicoWebhook(abandoned))).status).toBe(200)
    expect(await orderOf(abandoned.id)).toMatchObject({ status: 'paid', requiresReview: true, failureReason: 'late_payment' })
    expect(await licenseCount()).toBe(before + 2)

    const off = await reconcileOrders(await makeDeps({ PAYMENTS_ENABLED: 'false' }))
    expect(off.skipped).toBe('capability_off')
  })
})

describe('durable order notifications (confirmation, licence, staff alert)', () => {
  type Mail = { to: string; subject: string; text: string }
  let sent: Mail[] = []
  let fail = false
  let original: Payload['sendEmail']
  const notifOf = async (id: number) => (await run(`SELECT notifications_confirmation_sent_at AS c, notifications_license_sent_at AS l,
    notifications_review_alert_sent_at AS r, notifications_attempts AS a, notifications_last_error AS e, notifications_lease_until AS lease
    FROM orders WHERE id = ${id}`)).rows[0] as unknown as { c: string | null; l: string | null; r: string | null; a: number | null; e: string | null; lease: string | null }
  const keysOf = async (id: number) => (await orderOf(id)).items.map((i) => i.license).filter(Boolean) as number[]
  const keyText = async (id: number) => Promise.all((await keysOf(id)).map(async (lid) => ((await payload.findByID({ collection: 'licenses', id: lid, overrideAccess: true, depth: 0 })) as { key: string }).key))
  const licenseMails = async (id: number) => { const keys = await keyText(id); return sent.filter((m) => keys.some((k) => m.text.includes(k))) }
  const confirmMails = (o: { orderNumber: string }) => sent.filter((m) => m.subject.includes(o.orderNumber) && !m.subject.includes('incelemesi'))

  beforeAll(async () => {
    // Earlier tests left orders without markers (no SMTP then); mark them so they do not interfere.
    const t = new Date().toISOString()
    await run(`UPDATE orders SET status = 'cancelled' WHERE status = 'pending'`)
    await run(`UPDATE orders SET notifications_confirmation_sent_at = '${t}', notifications_license_sent_at = '${t}', notifications_review_alert_sent_at = '${t}'`)
    original = payload.sendEmail
    payload.sendEmail = (async (message: Mail) => {
      if (fail) throw new Error('SMTP 550 private-detail buyer.p4@example.test')
      sent.push(message)
    }) as never
  })
  afterAll(() => {
    payload.sendEmail = original
    delete process.env.SMTP_HOST
    delete process.env.SMTP_FROM
    delete process.env.PAYMENTS_ALERT_EMAIL
  })
  beforeEach(() => {
    sent = []
    fail = false
    process.env.SMTP_HOST = 'smtp.p4.test'
    process.env.SMTP_FROM = 'shop@p4.test'
  })

  it('CLI context (no after()): reconcile fulfils → licence e-mail and confirmation once; a second reconcile sends nothing', async () => {
    const { reconcileOrders } = await import('../../src/lib/payments/reconcile')
    const order = await createOrder({ status: 'paid' })
    const queued = afterQueue.length
    const report = await reconcileOrders(deps, { minAgeMs: 0 })
    await settle()
    expect(report.errors).toBe(0)
    expect((await orderOf(order.id)).status).toBe('fulfilled')
    expect(afterQueue.length).toBe(queued) // nothing depends on after(): the order licence is not e-mailed by the hook
    expect(await licenseMails(order.id)).toHaveLength(1)
    expect(confirmMails(order)).toHaveLength(1)
    expect((await licenseMails(order.id))[0]!.to).toBe(BUYER_EMAIL)
    expect(await notifOf(order.id)).toMatchObject({ c: expect.any(String), l: expect.any(String), a: null, e: null, lease: null })
    const total = sent.length
    const again = await reconcileOrders(deps, { minAgeMs: 0 })
    await settle()
    expect(sent.length).toBe(total)
    expect(again.actions.filter((a) => a.orderNumber === order.orderNumber && a.action !== 'none')).toEqual([])
  })

  it('webhook path (deferred after the response) → one licence e-mail; reconcile afterwards does not resend', async () => {
    const { reconcileOrders } = await import('../../src/lib/payments/reconcile')
    const order = await createOrder()
    paidAt(order)
    expect((await webhook(iyzicoWebhook(order))).status).toBe(200)
    expect((await webhook(iyzicoWebhook(order))).status).toBe(200)
    expect(await licenseMails(order.id)).toHaveLength(1)
    expect(confirmMails(order)).toHaveLength(1)
    const total = sent.length
    await reconcileOrders(deps, { minAgeMs: 0 })
    await settle()
    expect(sent.length).toBe(total)
  })

  it('send failure → no marker, retried with backoff by reconcile; succeeds later; gives up after maxAttempts', async () => {
    const { deliverOrderNotifications, findUndeliveredOrders, NOTIFY_POLICY } = await import('../../src/lib/payments/notify')
    const { reconcileOrders } = await import('../../src/lib/payments/reconcile')
    fail = true
    const flaky = await createOrder({ status: 'paid' })
    const doomed = await createOrder({ status: 'paid' })
    const report = await reconcileOrders(deps, { minAgeMs: 0 })
    await settle()
    expect(report.errors).toBe(0) // the deferred deliveries hold the lease or already failed; nothing else is wrong
    for (const o of [flaky, doomed]) expect(await notifOf(o.id)).toMatchObject({ c: null, l: null, a: 1, e: 'smtp_error', lease: null })
    expect(sent).toHaveLength(0)

    // Backoff: not due yet → not selected.
    expect((await findUndeliveredOrders(deps, 100)).map((r) => r.id)).not.toContain(flaky.id)
    let t = Date.now()
    clock = new Date(t + NOTIFY_POLICY.backoffMs + 1000)
    fail = false
    const retry = await reconcileOrders(deps, { minAgeMs: 0 })
    await settle()
    expect(retry.actions.find((a) => a.orderNumber === flaky.orderNumber)).toMatchObject({ action: 'notify', detail: 'sent:confirmation,license' })
    expect(await licenseMails(flaky.id)).toHaveLength(1)
    expect(await notifOf(flaky.id)).toMatchObject({ c: expect.any(String), l: expect.any(String), a: 1, e: null })
    expect(await licenseMails(doomed.id)).toHaveLength(1) // both recovered on the retry
    // Give-up path on a fresh order.
    clock = null
    fail = true
    const dead = await createOrder({ status: 'paid' })
    const { fulfilPaidOrder } = await import('../../src/lib/payments/fulfill')
    await fulfilPaidOrder(deps, dead.id)
    await settle()
    t = Date.now()
    for (let i = 1; i < NOTIFY_POLICY.maxAttempts; i++) {
      t += NOTIFY_POLICY.backoffMs * 2 ** (i - 1) + 1000
      clock = new Date(t)
      const r = await deliverOrderNotifications(deps, dead.id)
      expect(r).toMatchObject({ kind: 'done', failed: 'smtp_error' })
    }
    expect(await notifOf(dead.id)).toMatchObject({ a: NOTIFY_POLICY.maxAttempts, e: 'smtp_error', c: null, l: null })
    fail = false
    clock = new Date(t + 30 * 24 * 3600_000)
    expect(await deliverOrderNotifications(deps, dead.id)).toEqual({ kind: 'busy' })
    expect((await findUndeliveredOrders(deps, 100)).map((r) => r.id)).not.toContain(dead.id)
    expect(await licenseMails(dead.id)).toHaveLength(0)
    clock = null
  })

  it('two concurrent senders → one e-mail per kind (lease claim)', async () => {
    const { deliverOrderNotifications } = await import('../../src/lib/payments/notify')
    const order = await createOrder({ status: 'paid' })
    process.env.SMTP_HOST = '' // fulfil without sending, then deliver concurrently with SMTP on
    const { fulfilPaidOrder } = await import('../../src/lib/payments/fulfill')
    await fulfilPaidOrder(deps, order.id)
    await settle()
    process.env.SMTP_HOST = 'smtp.p4.test'
    const results = await Promise.all([deliverOrderNotifications(deps, order.id), deliverOrderNotifications(deps, order.id), deliverOrderNotifications(deps, order.id)])
    expect(results.filter((r) => r.kind === 'busy')).toHaveLength(2)
    expect(await licenseMails(order.id)).toHaveLength(1)
    expect(confirmMails(order)).toHaveLength(1)
  })

  it('unsendable review alerts and leased orders do not starve deliverable orders at the batch limit', async () => {
    const { findUndeliveredOrders } = await import('../../src/lib/payments/notify')
    delete process.env.PAYMENTS_ALERT_EMAIL
    const review = await createOrder()
    await run(`UPDATE orders SET requires_review = 1 WHERE id = ${review.id}`)
    const leased = await createOrder({ status: 'paid' })
    const ready = await createOrder({ status: 'paid' })
    const { fulfilPaidOrder } = await import('../../src/lib/payments/fulfill')
    delete process.env.SMTP_HOST
    await fulfilPaidOrder(deps, leased.id)
    await fulfilPaidOrder(deps, ready.id)
    await settle()
    await run(`UPDATE orders SET notifications_lease_until = '2999-01-01T00:00:00.000Z' WHERE id = ${leased.id}`)
    process.env.SMTP_HOST = 'smtp.p4.test'
    expect((await findUndeliveredOrders(deps, 1, true)).map((row) => row.id)).toEqual([ready.id])
    await run(`UPDATE orders SET notifications_lease_until = NULL, notifications_confirmation_sent_at = '2026-01-01T00:00:00.000Z', notifications_license_sent_at = '2026-01-01T00:00:00.000Z' WHERE id IN (${leased.id}, ${ready.id})`)
    await run(`UPDATE orders SET requires_review = 0 WHERE id = ${review.id}`)
  })

  it('a new review and later fulfilment each get a fresh notification retry budget', async () => {
    const { applyProviderState } = await import('../../src/lib/payments/sync')
    const order = await createOrder()
    await run(`UPDATE orders SET notifications_attempts = 5, notifications_next_attempt_at = '2999-01-01T00:00:00.000Z', notifications_last_error = 'smtp_error' WHERE id = ${order.id}`)
    paidAt(order, '1.00')
    const state = await deps.providers.iyzico!.retrieve(order.token, { orderNumber: order.orderNumber, locale: 'tr' })
    delete process.env.SMTP_HOST
    await applyProviderState(deps, order.id, state)
    await settle()
    expect(await notifOf(order.id)).toMatchObject({ a: null, e: null })
    await run(`UPDATE orders SET status = 'paid', requires_review = 0, notifications_attempts = 5, notifications_next_attempt_at = '2999-01-01T00:00:00.000Z', notifications_last_error = 'smtp_error' WHERE id = ${order.id}`)
    const { fulfilPaidOrder } = await import('../../src/lib/payments/fulfill')
    await fulfilPaidOrder(deps, order.id)
    await settle()
    expect(await notifOf(order.id)).toMatchObject({ a: null, e: null })
    await run(`UPDATE orders SET notifications_confirmation_sent_at = '2026-01-01T00:00:00.000Z', notifications_license_sent_at = '2026-01-01T00:00:00.000Z' WHERE id = ${order.id}`)
  })

  it('SMTP missing → skipped and not counted; delivered once SMTP is configured', async () => {
    const { deliverOrderNotifications, findUndeliveredOrders } = await import('../../src/lib/payments/notify')
    delete process.env.SMTP_HOST
    const order = await createOrder({ status: 'paid' })
    const { fulfilPaidOrder } = await import('../../src/lib/payments/fulfill')
    await fulfilPaidOrder(deps, order.id)
    await settle()
    expect(await deliverOrderNotifications(deps, order.id)).toMatchObject({ kind: 'done', sent: [], skipped: ['confirmation', 'license'], failed: null })
    expect(await notifOf(order.id)).toMatchObject({ c: null, l: null, a: null, e: null, lease: null })
    expect(sent).toHaveLength(0)
    expect(logs.some((l) => l.includes(`order email skipped (SMTP not configured) order=${order.orderNumber}`))).toBe(true)
    expect((await findUndeliveredOrders(deps, 100)).find((r) => r.id === order.id)?.kinds).toEqual(['confirmation', 'license'])
    process.env.SMTP_HOST = 'smtp.p4.test'
    expect(await deliverOrderNotifications(deps, order.id)).toMatchObject({ sent: ['confirmation', 'license'] })
    expect(await licenseMails(order.id)).toHaveLength(1)
  })

  it('staff review alert: sent once to PAYMENTS_ALERT_EMAIL (no buyer data), not repeated by reconcile', async () => {
    const { reconcileOrders } = await import('../../src/lib/payments/reconcile')
    process.env.PAYMENTS_ALERT_EMAIL = 'ops@p4.test'
    const cheap = await createOrder()
    paidAt(cheap, '1.00')
    expect((await webhook(iyzicoWebhook(cheap))).status).toBe(200)
    await reconcileOrders(deps, { minAgeMs: 0 })
    await settle()
    const alerts = sent.filter((m) => m.subject.includes(cheap.orderNumber))
    expect(alerts).toHaveLength(1)
    expect(alerts[0]!.to).toBe('ops@p4.test')
    expect(alerts[0]!.text).not.toContain(BUYER_EMAIL)
    expect(alerts[0]!.text).not.toContain(TCKN)
    expect((await notifOf(cheap.id)).r).toEqual(expect.any(String))
    delete process.env.PAYMENTS_ALERT_EMAIL
  })

  it('manual admin assignment keeps the hook e-mail (one, after the response); not part of the order queue', async () => {
    const queued = afterQueue.length
    const license = await payload.create({ collection: 'licenses', overrideAccess: true, depth: 0, data: { customer: customerId, edition: editionId } as never })
    expect(afterQueue.length).toBe(queued + 1)
    for (const fn of afterQueue.splice(queued)) await fn()
    const mails = sent.filter((m) => m.text.includes((license as { key: string }).key))
    expect(mails).toHaveLength(1)
    expect(mails[0]!.to).toBe(BUYER_EMAIL)
  })
})

describe('post-commit e-mail and log hygiene', () => {
  it('order confirmation is sent once, after commit, in the order language; skipped (logged) without SMTP', async () => {
    const sent: { to: string; subject: string; text: string }[] = []
    const sendEmail = payload.sendEmail
    payload.sendEmail = (async (message: { to: string; subject: string; text: string }) => { sent.push(message) }) as never
    try {
      const noSmtp = await createOrder()
      paidAt(noSmtp)
      expect((await webhook(iyzicoWebhook(noSmtp))).status).toBe(200)
      expect(sent).toHaveLength(0)
      expect(logs.some((l) => l.includes(`order email skipped (SMTP not configured) order=${noSmtp.orderNumber}`))).toBe(true)

      process.env.SMTP_HOST = 'smtp.p4.test'
      process.env.SMTP_FROM = 'shop@p4.test'
      const order = await createOrder()
      paidAt(order)
      expect((await webhook(iyzicoWebhook(order))).status).toBe(200)
      expect((await webhook(iyzicoWebhook(order))).status).toBe(200)
      const mine = sent.filter((m) => m.subject.includes(order.orderNumber))
      expect(mine).toHaveLength(1)
      expect(mine[0]!.to).toBe(BUYER_EMAIL)
      expect(mine[0]!.text).toContain('Ödemeniz alındı')
      expect(mine[0]!.text).toContain(`https://shop.example/tr/hesap/siparisler/${order.orderNumber}`)
    } finally {
      payload.sendEmail = sendEmail
      delete process.env.SMTP_HOST
      delete process.env.SMTP_FROM
    }
  })

  it('no captured log line contains an e-mail address, TCKN/VKN, licence key or provider secret', async () => {
    const keys = (await payload.find({ collection: 'licenses', overrideAccess: true, limit: 100, depth: 0 })).docs.map((l) => (l as { key: string }).key)
    expect(keys.length).toBeGreaterThan(5)
    expect(logs.length).toBeGreaterThan(20)
    const text = logs.join('\n')
    const findings = [
      ...text.matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+/g),
      ...text.matchAll(/(?<!\w)\d{10,11}(?!\w)/g),
      ...text.matchAll(/[A-Z2-9]{5}(?:-[A-Z2-9]{5}){4}/g),
    ].map((m) => m[0])
    expect(findings).toEqual([])
    for (const secret of [IYZ_KEY, IYZ_SECRET, STRIPE_SECRET, STRIPE_WHSEC, ...keys, TCKN, BUYER_EMAIL]) expect(text).not.toContain(secret)
  })
})
