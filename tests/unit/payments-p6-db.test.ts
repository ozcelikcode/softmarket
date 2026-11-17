import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { readPaymentsEnv } from '../../src/lib/payments/env'
import type { PaymentsDeps } from '../../src/lib/payments/runtime'
import { iyzicoResponseSignature, iyzicoSignaturePrice } from '../../src/lib/payments/signature/iyzico'
import type { FetchLike } from '../../src/lib/payments/types'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_noStore: vi.fn() }))

/*
 * P6 admin operations on a temporary SQLite database (all migrations), real Payload Local API + REST handler, a FAKE
 * provider HTTP layer (no network). Access matrix of the admin-only order endpoints (anonymous / customer / editor /
 * API key / cookie variants), refund (success, already refunded at the provider, timeout → review without retry,
 * concurrent requests, rejection), cancel, Stripe dispute / charge.refunded, notification resend, PII-free logs.
 */

const IYZ_KEY = 'sandbox-ApiKey-P6test0001'
const IYZ_SECRET = 'sandbox-SecretKey-P6test0001'
const STRIPE_SECRET = 'sk_test_P6testStripeKey0001'
const STRIPE_WHSEC = 'whsec_P6testWebhookSecret0001'
const BUYER_EMAIL = 'buyer.p6@example.test'
const TCKN = '10000000146'
const ADMIN = { email: 'admin.p6@example.test', password: 'Admin-p6-password-123' }
const EDITOR = { email: 'editor.p6@example.test', password: 'Editor-p6-password-123' }
const API_KEY = 'p6-admin-api-key-0123456789abcdef'
const ORIGIN = 'http://127.0.0.1:3100'

let payload: Payload
let dir: string
let editionId: number
let customerId: number
const savedEnv = { ...process.env }
const run = (q: string) => payload.db.drizzle.$client.execute(q)

// ---- fake providers ----------------------------------------------------------------------------------------------
type Pay = { paymentStatus: string; price: string; currency: string; conversationId: string; paymentId: string; refund: 'NOT_REFUNDED' | 'PARTIALLY_REFUNDED' | 'TOTALLY_REFUNDED' }
const fake = {
  byToken: new Map<string, Pay>(),
  refundCalls: 0,
  retrieveCalls: 0,
  refundMode: 'ok' as 'ok' | 'timeout' | 'reject' | 'network',
  /** Applied by the provider even when the HTTP answer is lost (timeout). */
  refundLands: false,
  stripe: new Map<string, { orderNumber: string; amount: number; refunded: number }>(),
}
const byPaymentId = (id: string | null) => [...fake.byToken.values()].find((p) => p.paymentId === id)
const reply = (json: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(json) })
const fakeFetch: FetchLike = async (url, init) => {
  await new Promise((resolve) => setTimeout(resolve, 5))
  const u = new URL(url)
  if (u.pathname === '/payment/iyzipos/checkoutform/auth/ecom/detail') {
    fake.retrieveCalls++
    const body = JSON.parse(init.body ?? '{}') as { token: string }
    const s = fake.byToken.get(body.token)
    if (!s) return reply({ status: 'failure', errorCode: '5004' })
    const price = iyzicoSignaturePrice(s.price)
    return reply({
      status: 'success', paymentStatus: s.paymentStatus, paymentId: s.paymentId, currency: s.currency, basketId: s.conversationId,
      conversationId: s.conversationId, paidPrice: s.price, price: s.price, token: body.token, fraudStatus: 1, installment: 1,
      signature: iyzicoResponseSignature(IYZ_SECRET, [s.paymentStatus, s.paymentId, s.currency, s.conversationId, s.conversationId, price, price, body.token]),
    })
  }
  if (u.pathname === '/v2/reporting/payment/details') {
    const s = byPaymentId(u.searchParams.get('paymentId'))
    if (!s) return reply({ status: 'failure', errorCode: '5115' })
    return reply({ status: 'success', payments: [{ paymentId: s.paymentId, paymentConversationId: s.conversationId, paymentStatus: s.paymentStatus === 'SUCCESS' ? 1 : 2, paymentRefundStatus: s.refund, cancels: [] }] })
  }
  if (u.pathname === '/v2/payment/refund') {
    fake.refundCalls++
    const body = JSON.parse(init.body ?? '{}') as { paymentId: string; price: string; currency: string; conversationId: string }
    const s = byPaymentId(body.paymentId)
    if (fake.refundMode === 'network') throw new TypeError('fetch failed')
    if (fake.refundMode === 'timeout') {
      if (s && fake.refundLands) s.refund = 'TOTALLY_REFUNDED'
      await new Promise((resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted'))))
    }
    if (fake.refundMode === 'reject' || !s || s.refund !== 'NOT_REFUNDED') return reply({ status: 'failure', errorCode: '10215' })
    s.refund = 'TOTALLY_REFUNDED'
    return reply({ status: 'success', paymentId: s.paymentId, price: body.price, currency: body.currency, conversationId: body.conversationId, paymentTransactionId: '777',
      signature: iyzicoResponseSignature(IYZ_SECRET, [s.paymentId, iyzicoSignaturePrice(body.price), body.currency, body.conversationId]) })
  }
  const pi = /^\/v1\/payment_intents\/(pi_[A-Za-z0-9]+)$/.exec(u.pathname)
  if (pi) {
    const s = fake.stripe.get(pi[1]!)
    if (!s) return { ok: false, status: 404, text: async () => '{"error":{}}' }
    return reply({ id: pi[1], status: 'succeeded', metadata: { order_number: s.orderNumber }, latest_charge: { amount: s.amount, amount_refunded: s.refunded, refunded: s.refunded >= s.amount } })
  }
  return { ok: false, status: 404, text: async () => '{}' }
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
const makeDeps = async (): Promise<PaymentsDeps> => {
  const { createPaymentsDeps } = await import('../../src/lib/payments/runtime')
  return createPaymentsDeps(payload, {
    env: readPaymentsEnv(ENV), fetch: fakeFetch, now: () => clock ?? new Date(), origin: 'https://shop.example',
    defer: (task) => void tasks.push(task()),
  })
}
const settle = async () => { while (tasks.length) await Promise.allSettled(tasks.splice(0)) }
const sent: { to: string; subject: string }[] = []

// ---- fixtures ----------------------------------------------------------------------------------------------------
let seq = 0
async function paidOrder(opts: { provider?: 'iyzico' | 'stripe' } = {}) {
  const n = ++seq
  const token = `tokp6${String(n).padStart(6, '0')}abcd`
  const total = 1200_00
  const order = await payload.create({
    collection: 'orders', overrideAccess: true, depth: 0,
    data: {
      customer: customerId, status: 'pending',
      items: [{ edition: editionId, sku: 'P6-PRO', title: 'Pro', licenseType: 'subscription', durationMonths: 12, seats: 3, taxMode: 'inclusive', unitNetMinor: total - 200_00, vatRateBasisPoints: 2000, vatMinor: 200_00, lineTotalMinor: total }],
      currency: 'TRY', subtotalMinor: total - 200_00, vatMinor: 200_00, totalMinor: total,
      provider: opts.provider ?? 'iyzico', providerEnv: 'sandbox', providerRef: opts.provider === 'stripe' ? `cs_test_P6${n}` : token,
      idempotencyKey: `idem-p6-${n}-${Date.now()}`, locale: 'tr',
      billing: { type: 'individual', name: 'Ali Veli', identityNumber: TCKN, email: BUYER_EMAIL, city: 'İstanbul' },
    } as never,
  })
  const orderNumber = (order as { orderNumber: string }).orderNumber
  const id = order.id as number
  if (opts.provider === 'stripe') {
    // Fulfil directly (no Stripe session fake needed): paid → fulfilled through the real fulfilment store.
    const pi = `pi_P6${n}x`
    await run(`UPDATE orders SET status = 'paid', paid_at = '${new Date().toISOString()}', provider_payment_id = '${pi}' WHERE id = ${id}`)
    const { fulfilPaidOrder } = await import('../../src/lib/payments/fulfill')
    await fulfilPaidOrder(deps, id)
    fake.stripe.set(pi, { orderNumber, amount: total, refunded: 0 })
    await settle()
    return { id, orderNumber, token, paymentId: pi }
  }
  const paymentId = `9${String(n).padStart(7, '0')}`
  fake.byToken.set(token, { paymentStatus: 'SUCCESS', price: '1200.00', currency: 'TRY', conversationId: orderNumber, paymentId, refund: 'NOT_REFUNDED' })
  const { syncOrderFromProvider } = await import('../../src/lib/payments/sync')
  await syncOrderFromProvider(deps, id)
  await settle()
  return { id, orderNumber, token, paymentId }
}
async function pendingOrder(paymentStatus: 'INIT_THREEDS' | 'SUCCESS' = 'INIT_THREEDS') {
  const n = ++seq
  const token = `tokp6${String(n).padStart(6, '0')}wxyz`
  const order = await payload.create({
    collection: 'orders', overrideAccess: true, depth: 0,
    data: {
      customer: customerId, status: 'pending',
      items: [{ edition: editionId, sku: 'P6-PRO', title: 'Pro', licenseType: 'subscription', durationMonths: 12, seats: 3, taxMode: 'inclusive', unitNetMinor: 1000_00, vatRateBasisPoints: 2000, vatMinor: 200_00, lineTotalMinor: 1200_00 }],
      currency: 'TRY', subtotalMinor: 1000_00, vatMinor: 200_00, totalMinor: 1200_00, provider: 'iyzico', providerEnv: 'sandbox', providerRef: token,
      idempotencyKey: `idem-p6-${n}-${Date.now()}`, locale: 'tr',
      billing: { type: 'individual', name: 'Ali Veli', identityNumber: TCKN, email: BUYER_EMAIL, city: 'İstanbul' },
    } as never,
  })
  const orderNumber = (order as { orderNumber: string }).orderNumber
  fake.byToken.set(token, { paymentStatus, price: '1200.00', currency: 'TRY', conversationId: orderNumber, paymentId: `8${String(n).padStart(7, '0')}`, refund: 'NOT_REFUNDED' })
  return { id: order.id as number, orderNumber }
}
type OrderView = { status: string; requiresReview: boolean; failureReason?: string | null; notes?: string | null; items: { license?: number | null }[]; refundedAt?: string | null }
const orderOf = async (id: number) => payload.findByID({ collection: 'orders', id, depth: 0, overrideAccess: true }) as unknown as Promise<OrderView>
const licenseOf = async (order: { id: number }) => {
  const licenseId = (await orderOf(order.id)).items[0]!.license!
  return payload.findByID({ collection: 'licenses', id: licenseId, depth: 0, overrideAccess: true }) as unknown as Promise<{ status: string; notes?: string }>
}
const journal = async (key: string) => (await payload.find({ collection: 'payment-events', where: { eventKey: { equals: key } }, overrideAccess: true, depth: 0 })).docs[0] as unknown as { status: string; failureCode?: string } | undefined
const refundMails = () => sent.filter((m) => /iade edildi|refunded/i.test(m.subject))

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'softmarket-p6-'))
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
  await run(`UPDATE site_settings SET commerce_mode = 'payments'`)
  editionId = (await payload.create({ collection: 'editions', overrideAccess: true, data: { title: 'Pro', sku: 'P6-PRO', product: 1, licenseType: 'subscription', durationMonths: 12, seats: 3 } as never })).id as number
  customerId = (await payload.create({ collection: 'customers', overrideAccess: true, disableVerificationEmail: true, data: { email: BUYER_EMAIL, password: 'p6-test-password-123', name: 'Ali', _verified: true } as never })).id as number
  await payload.create({ collection: 'users', overrideAccess: true, data: { ...ADMIN, name: 'Admin', roles: ['admin'], enableAPIKey: true, apiKey: API_KEY } as never })
  await payload.create({ collection: 'users', overrideAccess: true, data: { ...EDITOR, name: 'Editor', roles: ['editor'] } as never })

  payload.sendEmail = (async (message: { to: string; subject: string }) => { sent.push({ to: message.to, subject: message.subject }) }) as never
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
  vi.unstubAllGlobals()
  await payload?.destroy()
  if (dir) rmSync(dir, { recursive: true, force: true })
  process.env = savedEnv
})

beforeEach(() => {
  fake.refundMode = 'ok'
  fake.refundLands = false
  clock = null
  process.env.SMTP_HOST = 'smtp.p6.test'
  process.env.SMTP_FROM = 'shop@p6.test'
})

describe('admin endpoint access matrix (REST, real Payload auth)', () => {
  const post = async (orderId: number, action: string, headers: Record<string, string>) => {
    const { REST_POST } = await import('@payloadcms/next/routes')
    const config = (await import('../../src/payload.config')).default
    const res = await REST_POST(config)(new Request(`${ORIGIN}/api/orders/${orderId}/${action}`, { method: 'POST', headers: { host: '127.0.0.1:3100', ...headers } }), { params: Promise.resolve({ slug: ['orders', String(orderId), action] }) })
    await settle()
    return res
  }
  const token = async (collection: 'users' | 'customers', data: { email: string; password: string }) =>
    (await payload.login({ collection, data })).token!

  it('anonymous 401; customer, editor, API key (MCP), header JWT, missing/foreign origin 403; nothing changes', async () => {
    const order = await paidOrder()
    const adminJwt = await token('users', ADMIN)
    const editorJwt = await token('users', EDITOR)
    const customerJwt = await token('customers', { email: BUYER_EMAIL, password: 'p6-test-password-123' })
    for (const action of ['refund', 'cancel', 'resend-notifications']) {
      expect((await post(order.id, action, { origin: ORIGIN })).status).toBe(401)
      expect((await post(order.id, action, { origin: ORIGIN, cookie: `payload-token=${customerJwt}` })).status).toBe(403)
      expect((await post(order.id, action, { origin: ORIGIN, cookie: `payload-token=${editorJwt}` })).status).toBe(403)
      expect((await post(order.id, action, { origin: ORIGIN, authorization: `users API-Key ${API_KEY}` })).status).toBe(403)
      expect((await post(order.id, action, { origin: ORIGIN, authorization: `JWT ${adminJwt}` })).status).toBe(403)
      expect((await post(order.id, action, { cookie: `payload-token=${adminJwt}` })).status).toBe(403)
      expect((await post(order.id, action, { origin: 'https://evil.example', cookie: `payload-token=${adminJwt}` })).status).toBe(403)
      expect((await post(order.id, action, { origin: ORIGIN, 'sec-fetch-site': 'cross-site', cookie: `payload-token=${adminJwt}` })).status).toBe(403)
    }
    expect(fake.refundCalls).toBe(0)
    expect((await orderOf(order.id)).status).toBe('fulfilled')
  })

  it('admin panel session (cookie + same origin) → 200 refunded; the endpoint answers short codes only', async () => {
    const order = await paidOrder()
    const adminJwt = await token('users', ADMIN)
    vi.stubGlobal('fetch', fakeFetch)
    const before = { ...process.env }
    Object.assign(process.env, ENV)
    try {
      const res = await post(order.id, 'refund', { origin: ORIGIN, 'sec-fetch-site': 'same-origin', cookie: `payload-token=${adminJwt}` })
      expect(res.status).toBe(200)
      expect(res.headers.get('cache-control')).toBe('no-store')
      expect(await res.json()).toEqual({ code: 'refunded', status: 'refunded' })
      expect((await orderOf(order.id)).status).toBe('refunded')
      expect((await post(999999, 'refund', { origin: ORIGIN, cookie: `payload-token=${adminJwt}` })).status).toBe(404)
    } finally {
      process.env = before
      vi.unstubAllGlobals()
    }
  })
})

describe('refund', () => {
  it('success → refunded, licence revoked, journal processed, exactly one buyer e-mail; repeat = no second refund', async () => {
    const { refundOrder } = await import('../../src/lib/payments/admin-actions')
    const order = await paidOrder()
    expect((await licenseOf(order)).status).toBe('active')
    const calls = fake.refundCalls
    const mails = refundMails().length
    const result = await refundOrder(deps, order.id, { id: 1 })
    await settle()
    expect(result).toMatchObject({ http: 200, code: 'refunded', status: 'refunded' })
    expect(fake.refundCalls).toBe(calls + 1)
    const stored = await orderOf(order.id)
    expect(stored.status).toBe('refunded')
    expect(stored.refundedAt).toBeTruthy()
    expect(stored.notes).toContain(order.orderNumber)
    const license = await licenseOf(order)
    expect(license.status).toBe('revoked')
    expect(license.notes).toContain('refund')
    expect((await journal(`iyzico:admin-refund:${order.orderNumber}`))?.status).toBe('processed')
    expect((await journal(`iyzico:refund-notice:${order.orderNumber}`))?.status).toBe('processed')
    expect(refundMails().length).toBe(mails + 1)
    expect(refundMails().at(-1)!.subject).toContain(order.orderNumber)

    const again = await refundOrder(deps, order.id, { id: 1 })
    await settle()
    expect(again).toMatchObject({ http: 200, code: 'already_refunded' })
    const { reconcileOrders } = await import('../../src/lib/payments/reconcile')
    await reconcileOrders(deps)
    await settle()
    expect(fake.refundCalls).toBe(calls + 1)
    expect(refundMails().length).toBe(mails + 1)
  })

  it('already refunded at the provider (refund status read first) → provider refund is NOT called; order finalised', async () => {
    const { refundOrder } = await import('../../src/lib/payments/admin-actions')
    const order = await paidOrder()
    fake.byToken.get(order.token)!.refund = 'TOTALLY_REFUNDED'
    const calls = fake.refundCalls
    const result = await refundOrder(deps, order.id, { id: 1 })
    await settle()
    expect(result).toMatchObject({ http: 200, code: 'already_refunded', status: 'refunded' })
    expect(fake.refundCalls).toBe(calls)
    expect((await orderOf(order.id)).status).toBe('refunded')
    expect((await licenseOf(order)).status).toBe('revoked')
  })

  it('provider timeout → requiresReview, licence untouched, NO retry (admin re-click and reconcile only read); later truth finalises', async () => {
    const { refundOrder } = await import('../../src/lib/payments/admin-actions')
    const { reconcileOrders } = await import('../../src/lib/payments/reconcile')
    const order = await paidOrder()
    const timeoutDeps = { ...deps, providers: { ...deps.providers } }
    const { createIyzicoProvider } = await import('../../src/lib/payments/providers/iyzico')
    timeoutDeps.providers.iyzico = createIyzicoProvider({ config: readPaymentsEnv(ENV).iyzico!, fetch: fakeFetch, timeoutMs: 50 })
    fake.refundMode = 'timeout'
    fake.refundLands = false
    const calls = fake.refundCalls
    const result = await refundOrder(timeoutDeps, order.id, { id: 1 })
    await settle()
    expect(result).toMatchObject({ http: 502, code: 'refund_uncertain' })
    expect(fake.refundCalls).toBe(calls + 1)
    let stored = await orderOf(order.id)
    expect(stored).toMatchObject({ status: 'fulfilled', requiresReview: true, failureReason: 'refund_uncertain' })
    expect((await licenseOf(order)).status).toBe('active')
    expect((await journal(`iyzico:admin-refund:${order.orderNumber}`))?.status).toBe('received')

    fake.refundMode = 'ok'
    expect(await refundOrder(deps, order.id, { id: 1 })).toMatchObject({ http: 409, code: 'refund_in_progress' })
    await reconcileOrders(deps)
    expect(fake.refundCalls).toBe(calls + 1)
    expect((await orderOf(order.id)).status).toBe('fulfilled')

    // The provider (dashboard / late processing) reports the refund: reconcile finalises without calling refund().
    fake.byToken.get(order.token)!.refund = 'TOTALLY_REFUNDED'
    await reconcileOrders(deps)
    await settle()
    stored = await orderOf(order.id)
    expect(stored).toMatchObject({ status: 'refunded', requiresReview: false })
    expect((await licenseOf(order)).status).toBe('revoked')
    expect(fake.refundCalls).toBe(calls + 1)
  })

  it('unknown attempt remains locked even after 15 minutes, including a delayed provider settlement', async () => {
    const { refundOrder } = await import('../../src/lib/payments/admin-actions')
    const order = await paidOrder()
    fake.refundMode = 'network'
    expect(await refundOrder(deps, order.id, { id: 1 })).toMatchObject({ code: 'refund_uncertain' })
    fake.refundMode = 'ok'
    clock = new Date(Date.now() + 16 * 60_000)
    expect(await refundOrder(deps, order.id, { id: 1 })).toMatchObject({ http: 409, code: 'refund_in_progress' })
    expect((await orderOf(order.id))).toMatchObject({ requiresReview: true, status: 'fulfilled' })
    const calls = fake.refundCalls
    expect(await refundOrder(deps, order.id, { id: 1 })).toMatchObject({ code: 'refund_in_progress' })
    expect(fake.refundCalls).toBe(calls)
    fake.byToken.get(order.token)!.refund = 'TOTALLY_REFUNDED'
    expect(await refundOrder(deps, order.id, { id: 1 })).toMatchObject({ code: 'refunded' })
    expect(fake.refundCalls).toBe(calls)
    await settle()
  })

  it('two concurrent refund requests → exactly one provider refund call', async () => {
    const { refundOrder } = await import('../../src/lib/payments/admin-actions')
    const order = await paidOrder()
    const calls = fake.refundCalls
    const mails = refundMails().length
    const results = await Promise.all([refundOrder(deps, order.id, { id: 1 }), refundOrder(deps, order.id, { id: 1 }), refundOrder(deps, order.id, { id: 1 })])
    await settle()
    expect(fake.refundCalls).toBe(calls + 1)
    expect(results.filter((r) => r.code === 'refunded')).toHaveLength(1)
    expect(results.every((r) => ['refunded', 'refund_in_progress', 'already_refunded'].includes(r.code))).toBe(true)
    expect((await orderOf(order.id)).status).toBe('refunded')
    expect(refundMails().length).toBe(mails + 1)
  })

  it('explicit provider rejection → nothing refunded, order unchanged, lock released for a later decision', async () => {
    const { refundOrder } = await import('../../src/lib/payments/admin-actions')
    const order = await paidOrder()
    fake.refundMode = 'reject'
    expect(await refundOrder(deps, order.id, { id: 1 })).toMatchObject({ http: 422, code: 'refund_rejected', detail: '10215' })
    expect((await orderOf(order.id)).status).toBe('fulfilled')
    expect((await journal(`iyzico:admin-refund:${order.orderNumber}`))).toMatchObject({ status: 'error', failureCode: '10215' })
    fake.refundMode = 'ok'
    expect(await refundOrder(deps, order.id, { id: 1 })).toMatchObject({ code: 'refunded' })
    await settle()
  })

  it('not refundable: pending order → 409 without any provider call', async () => {
    const { refundOrder } = await import('../../src/lib/payments/admin-actions')
    const order = await pendingOrder()
    const calls = fake.refundCalls
    expect(await refundOrder(deps, order.id, { id: 1 })).toMatchObject({ http: 409, code: 'not_refundable' })
    expect(fake.refundCalls).toBe(calls)
  })
})

describe('cancel', () => {
  it('unpaid pending → cancelled (admin_cancelled); paid at provider → not cancelled, synced; non-pending → 409', async () => {
    const { cancelOrder } = await import('../../src/lib/payments/admin-actions')
    const unpaid = await pendingOrder('INIT_THREEDS')
    expect(await cancelOrder(deps, unpaid.id, { id: 1 })).toMatchObject({ http: 200, code: 'cancelled' })
    expect(await orderOf(unpaid.id)).toMatchObject({ status: 'cancelled', failureReason: 'admin_cancelled' })
    expect(await cancelOrder(deps, unpaid.id, { id: 1 })).toMatchObject({ http: 200, code: 'already_cancelled' })

    const paid = await pendingOrder('SUCCESS')
    expect(await cancelOrder(deps, paid.id, { id: 1 })).toMatchObject({ http: 409, code: 'already_paid' })
    expect((await orderOf(paid.id)).status).toBe('paid')

    const fulfilled = await paidOrder()
    expect(await cancelOrder(deps, fulfilled.id, { id: 1 })).toMatchObject({ http: 409, code: 'not_cancellable' })
    await settle()
  })
})

describe('provider events (Stripe)', () => {
  it('retries a refund event until its payment is linked and the order has reached paid', async () => {
    const { processVerifiedEvent } = await import('../../src/lib/payments/events')
    const order = await paidOrder({ provider: 'stripe' })
    const event = { provider: 'stripe' as const, eventId: `evt_P6early${order.id}`, type: 'charge.refunded', providerPaymentId: order.paymentId }
    fake.stripe.get(order.paymentId)!.refunded = 1200_00
    await run(`UPDATE orders SET provider_payment_id = NULL WHERE id = ${order.id}`)
    expect(await processVerifiedEvent(deps, event, 'd'.repeat(64), true)).toBe(500)
    await run(`UPDATE orders SET provider_payment_id = '${order.paymentId}', status = 'pending' WHERE id = ${order.id}`)
    expect(await processVerifiedEvent(deps, event, 'd'.repeat(64), true)).toBe(500)
    await run(`UPDATE orders SET status = 'fulfilled' WHERE id = ${order.id}`)
    fake.stripe.get(order.paymentId)!.refunded = 0
    expect(await processVerifiedEvent(deps, event, 'd'.repeat(64), true)).toBe(500)
    fake.stripe.get(order.paymentId)!.refunded = 1200_00
    expect(await processVerifiedEvent(deps, event, 'd'.repeat(64), true)).toBe(200)
    expect((await orderOf(order.id)).status).toBe('refunded')
    expect((await licenseOf(order)).status).toBe('revoked')
  })

  it('charge.dispute.created → licences suspended + review; charge.dispute.closed → review stays, licence unchanged', async () => {
    const { processVerifiedEvent } = await import('../../src/lib/payments/events')
    const order = await paidOrder({ provider: 'stripe' })
    expect((await licenseOf(order)).status).toBe('active')
    expect(await processVerifiedEvent(deps, { provider: 'stripe', eventId: `evt_P6dispute${order.id}`, type: 'charge.dispute.created', providerPaymentId: order.paymentId }, 'a'.repeat(64), true)).toBe(200)
    await settle()
    expect((await licenseOf(order)).status).toBe('suspended')
    expect(await orderOf(order.id)).toMatchObject({ status: 'fulfilled', requiresReview: true, failureReason: 'dispute_open' })
    expect(await processVerifiedEvent(deps, { provider: 'stripe', eventId: `evt_P6closed${order.id}`, type: 'charge.dispute.closed', providerPaymentId: order.paymentId }, 'b'.repeat(64), true)).toBe(200)
    expect((await licenseOf(order)).status).toBe('suspended')
    expect((await orderOf(order.id)).failureReason).toBe('dispute_closed')
  })

  it('charge.refunded (refund made in the dashboard) → provider truth read → order refunded, licence revoked', async () => {
    const { processVerifiedEvent } = await import('../../src/lib/payments/events')
    const order = await paidOrder({ provider: 'stripe' })
    fake.stripe.get(order.paymentId)!.refunded = 1200_00
    expect(await processVerifiedEvent(deps, { provider: 'stripe', eventId: `evt_P6refund${order.id}`, type: 'charge.refunded', providerPaymentId: order.paymentId }, 'c'.repeat(64), true)).toBe(200)
    await settle()
    expect((await orderOf(order.id)).status).toBe('refunded')
    expect((await licenseOf(order)).status).toBe('revoked')
  })
})

describe('resend notifications', () => {
  it('an order whose queue gave up (5 attempts) is reset and delivered once', async () => {
    const { resendNotifications } = await import('../../src/lib/payments/admin-actions')
    process.env.SMTP_HOST = ''
    const order = await paidOrder()
    process.env.SMTP_HOST = 'smtp.p6.test'
    await run(`UPDATE orders SET notifications_attempts = 5, notifications_last_error = 'smtp_error', notifications_next_attempt_at = '2099-01-01T00:00:00.000Z' WHERE id = ${order.id}`)
    const { deliverOrderNotifications } = await import('../../src/lib/payments/notify')
    expect((await deliverOrderNotifications(deps, order.id)).kind).toBe('busy')
    const before = sent.length
    const result = await resendNotifications(deps, order.id)
    expect(result).toMatchObject({ http: 200, code: 'resent' })
    expect(result.sent).toEqual(['confirmation', 'license'])
    expect(sent.length).toBe(before + 2)
    expect(await resendNotifications(deps, order.id)).toMatchObject({ code: 'nothing_to_resend' })
    expect(sent.length).toBe(before + 2)
  })
})

describe('logs', () => {
  it('no buyer e-mail, TCKN, licence key or provider secret in any captured log line', async () => {
    const keys = (await payload.find({ collection: 'licenses', overrideAccess: true, limit: 100, depth: 0 })).docs.map((l) => (l as { key: string }).key)
    expect(logs.length).toBeGreaterThan(0)
    for (const line of logs) {
      expect(line).not.toContain(BUYER_EMAIL)
      expect(line).not.toMatch(/\b\d{10,11}\b(?!\d)/)
      for (const secret of [IYZ_KEY, IYZ_SECRET, STRIPE_SECRET, STRIPE_WHSEC, API_KEY, ...keys]) expect(line).not.toContain(secret)
    }
  })
})
