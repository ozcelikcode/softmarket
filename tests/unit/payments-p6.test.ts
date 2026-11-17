import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { readPaymentsEnv } from '../../src/lib/payments/env'
import { PaymentError } from '../../src/lib/payments/errors'
import { classifyProviderEvent } from '../../src/lib/payments/events'
import { createIyzicoProvider } from '../../src/lib/payments/providers/iyzico'
import { createStripeProvider } from '../../src/lib/payments/providers/stripe'
import { hmacSha256Hex } from '../../src/lib/payments/signature/compare'
import type { FetchLike } from '../../src/lib/payments/types'

const noStore = vi.hoisted(() => vi.fn())
vi.mock('next/cache', () => ({ unstable_noStore: noStore, revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

/*
 * P6 pure checks: refund-status / abandon adapters (iyzico Transaction Detail Reporting, Stripe PaymentIntent +
 * Checkout Session expire), provider event classification, the commerce render boundary that fixes
 * "Page changed from static to dynamic at runtime", and the admin bundle boundary.
 */

const ENV = {
  PAYMENTS_ENABLED: 'true', IYZICO_API_KEY: 'sandbox-key-p6', IYZICO_SECRET_KEY: 'sandbox-secret-p6', IYZICO_BASE_URL: 'https://sandbox-api.iyzipay.com',
  PAYMENTS_STRIPE_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_test_p6', STRIPE_WEBHOOK_SECRET: 'whsec_p6',
}
const cfg = readPaymentsEnv(ENV)
const INPUT = { orderNumber: 'SM-261117-ABCDEF', providerRef: 'tok12345678', providerPaymentId: '22416032', currency: 'TRY' as const, amountMinor: 1200_00 }

function recordingFetch(json: unknown, status = 200) {
  const calls: { url: string; method: string; headers: Record<string, string>; body?: string }[] = []
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body })
    return { ok: status < 400, status, text: async () => JSON.stringify(json) }
  }
  return { fetch, calls }
}
const details = (payment: Record<string, unknown>) => ({ status: 'success', payments: [{ paymentId: '22416032', paymentConversationId: INPUT.orderNumber, paymentStatus: 1, ...payment }] })

describe('iyzico refundStatus (GET /v2/reporting/payment/details)', () => {
  it('maps paymentRefundStatus / cancels; signs path without query; never guesses', async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ paymentRefundStatus: 'NOT_REFUNDED' }, 'not_refunded'],
      [{ paymentRefundStatus: 'PARTIALLY_REFUNDED' }, 'partially_refunded'],
      [{ paymentRefundStatus: 'TOTALLY_REFUNDED' }, 'refunded'],
      [{ paymentRefundStatus: 'NOT_REFUNDED', cancels: [{ refundPrice: 1200, refundStatus: 1, currencyCode: 'TRY' }] }, 'refunded'],
      [{ paymentRefundStatus: 'NOT_REFUNDED', cancels: [{ refundPrice: 1200, refundStatus: 0, currencyCode: 'TRY' }] }, 'not_refunded'],
      [{ paymentStatus: 2, paymentRefundStatus: 'NOT_REFUNDED' }, 'not_paid'],
    ]
    for (const [payment, expected] of cases) {
      const { fetch, calls } = recordingFetch(details(payment))
      const provider = createIyzicoProvider({ config: cfg.iyzico!, fetch, randomKey: () => '123456789' })
      expect((await provider.refundStatus(INPUT)).status).toBe(expected)
      expect(calls[0]!.method).toBe('GET')
      expect(calls[0]!.url).toBe('https://sandbox-api.iyzipay.com/v2/reporting/payment/details?paymentId=22416032&locale=tr')
      const auth = Buffer.from(calls[0]!.headers.Authorization!.replace('IYZWSv2 ', ''), 'base64').toString('utf8')
      expect(auth).toContain(`signature:${hmacSha256Hex('sandbox-secret-p6', '123456789/v2/reporting/payment/details')}`)
    }
    for (const bad of [
      details({ paymentRefundStatus: 'SOMETHING_NEW' }),
      details({ paymentConversationId: 'SM-261117-ZZZZZZ', paymentRefundStatus: 'NOT_REFUNDED' }),
      { status: 'success', payments: [] },
    ]) {
      const provider = createIyzicoProvider({ config: cfg.iyzico!, fetch: recordingFetch(bad).fetch })
      await expect(provider.refundStatus(INPUT)).rejects.toBeInstanceOf(PaymentError)
    }
    const failure = createIyzicoProvider({ config: cfg.iyzico!, fetch: recordingFetch({ status: 'failure', errorCode: '5115' }, 400).fetch })
    await expect(failure.refundStatus(INPUT)).rejects.toMatchObject({ code: 'provider_error' })
  })

  it('abandonCheckout is local only (no void API for an unused Checkout Form token): no HTTP call', async () => {
    const { fetch, calls } = recordingFetch({})
    const provider = createIyzicoProvider({ config: cfg.iyzico!, fetch })
    expect(await provider.abandonCheckout('tok12345678')).toEqual({ ok: true, mode: 'local_only' })
    expect(calls).toHaveLength(0)
  })

  it('keeps a refund outcome uncertain on an HTTP server failure even with a failure body', async () => {
    const provider = createIyzicoProvider({ config: cfg.iyzico!, fetch: recordingFetch({ status: 'failure', errorCode: '123' }, 500).fetch })
    await expect(provider.refund({ ...INPUT, idempotencyKey: 'refund-key' })).rejects.toMatchObject({ code: 'http_error' })
  })
})

describe('Stripe refundStatus / abandonCheckout', () => {
  const pi = (charge: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ id: 'pi_123', status: 'succeeded', metadata: { order_number: INPUT.orderNumber }, latest_charge: { amount: 1200_00, ...charge }, ...extra })
  const input = { ...INPUT, providerPaymentId: 'pi_123', currency: 'USD' as const }
  it('does not classify server failures or unknown refund states as safe rejections', async () => {
    const request = { ...input, idempotencyKey: 'refund-key' }
    for (const status of [408, 409, 429, 500, 503]) {
      const provider = createStripeProvider({ config: cfg.stripe!, fetch: recordingFetch({ error: {} }, status).fetch })
      await expect(provider.refund(request)).rejects.toBeInstanceOf(PaymentError)
    }
    const unknown = createStripeProvider({ config: cfg.stripe!, fetch: recordingFetch({ status: 'new_status' }).fetch })
    await expect(unknown.refund(request)).rejects.toMatchObject({ code: 'bad_response' })
    const rejected = createStripeProvider({ config: cfg.stripe!, fetch: recordingFetch({ error: {} }, 400).fetch })
    await expect(rejected.refund(request)).resolves.toMatchObject({ ok: false })
  })
  it('reads amount_refunded of the latest charge; checks the order reference', async () => {
    for (const [body, expected] of [
      [pi({ amount_refunded: 0 }), 'not_refunded'],
      [pi({ amount_refunded: 500 }), 'partially_refunded'],
      [pi({ amount_refunded: 1200_00, refunded: true }), 'refunded'],
      [pi({ amount_refunded: 0 }, { status: 'requires_payment_method' }), 'not_paid'],
    ] as const) {
      const { fetch, calls } = recordingFetch(body)
      expect((await createStripeProvider({ config: cfg.stripe!, fetch }).refundStatus(input)).status).toBe(expected)
      expect(calls[0]!.url).toBe('https://api.stripe.com/v1/payment_intents/pi_123?expand[]=latest_charge')
    }
    await expect(createStripeProvider({ config: cfg.stripe!, fetch: recordingFetch(pi({ amount_refunded: 0 }, { metadata: { order_number: 'SM-000000-AAAAAA' } })).fetch }).refundStatus(input)).rejects.toMatchObject({ code: 'bad_response' })
  })
  it('abandonCheckout expires the session; a closed session is reported, not thrown', async () => {
    const ok = recordingFetch({ id: 'cs_test_1', status: 'expired' })
    expect(await createStripeProvider({ config: cfg.stripe!, fetch: ok.fetch }).abandonCheckout('cs_test_1')).toEqual({ ok: true, mode: 'expired' })
    expect(ok.calls[0]).toMatchObject({ method: 'POST', url: 'https://api.stripe.com/v1/checkout/sessions/cs_test_1/expire' })
    const closed = recordingFetch({ error: { code: 'checkout_session_not_open' } }, 400)
    expect(await createStripeProvider({ config: cfg.stripe!, fetch: closed.fetch }).abandonCheckout('cs_test_1')).toEqual({ ok: false, failureCode: 'not_open' })
  })
})

describe('provider event classification', () => {
  it('Stripe dispute/refund events are routed; iyzico and session events go to the payment sync', () => {
    expect(classifyProviderEvent({ provider: 'stripe', type: 'charge.dispute.created' })).toBe('dispute_opened')
    expect(classifyProviderEvent({ provider: 'stripe', type: 'charge.dispute.closed' })).toBe('dispute_closed')
    expect(classifyProviderEvent({ provider: 'stripe', type: 'charge.refunded' })).toBe('refunded')
    expect(classifyProviderEvent({ provider: 'stripe', type: 'checkout.session.completed' })).toBe('payment')
    expect(classifyProviderEvent({ provider: 'iyzico', type: 'charge.dispute.created' })).toBe('payment')
  })
})

describe('commerce render boundary (fix: "Page changed from static to dynamic at runtime")', () => {
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
    delete (globalThis as { __SOFTMARKET_BUILD_PAYMENTS__?: boolean }).__SOFTMARKET_BUILD_PAYMENTS__
    noStore.mockReset()
  })
  const load = async () => {
    vi.resetModules()
    return import('../../src/lib/commerce/state')
  }

  it('capability off: no-op (ISR untouched); on: opts the route out of the static cache', async () => {
    delete process.env.PAYMENTS_ENABLED
    expect((await load()).commerceRenderBoundary()).toBe(false)
    expect(noStore).not.toHaveBeenCalled()
    process.env.PAYMENTS_ENABLED = 'true'
    expect((await load()).commerceRenderBoundary()).toBe(true)
    expect(noStore).toHaveBeenCalledTimes(1)
  })

  it('built WITHOUT the capability but started with it: never calls noStore at runtime (would 500), stays closed', async () => {
    process.env.PAYMENTS_ENABLED = 'true'
    ;(globalThis as { __SOFTMARKET_BUILD_PAYMENTS__?: boolean }).__SOFTMARKET_BUILD_PAYMENTS__ = false
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const mod = await load()
    expect(mod.commerceRenderBoundary()).toBe(false)
    expect((await mod.getCommerceState()).open).toBe(false)
    expect(noStore).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('build phase: the bailout is rethrown so the route is marked dynamic', async () => {
    process.env.PAYMENTS_ENABLED = 'true'
    process.env.NEXT_PHASE = 'phase-production-build'
    noStore.mockImplementation(() => { throw Object.assign(new Error('Dynamic server usage'), { digest: 'DYNAMIC_SERVER_USAGE' }) })
    const mod = await load()
    expect(() => mod.commerceRenderBoundary()).toThrow('Dynamic server usage')
  })

  it('capability build: every content route gets ONE probe path (route marked dynamic even with zero real paths)', async () => {
    vi.doMock('../../src/lib/content', () => ({ getSitemapEntries: vi.fn(async () => { throw new Error('must not read content') }) }))
    vi.doMock('../../src/lib/support', () => ({ getSupportSitemapEntries: vi.fn(async () => []) }))
    process.env.PAYMENTS_ENABLED = 'true'
    vi.resetModules()
    const { contentStaticParams, DYNAMIC_PROBE } = await import('../../src/lib/static-params')
    expect(await contentStaticParams('/yasal/[slug]')).toEqual([{ locale: 'tr', slug: DYNAMIC_PROBE }])
    expect(await contentStaticParams('/urunler/[family]/[product]', { locale: 'en' })).toEqual([{ locale: 'en', family: DYNAMIC_PROBE, product: DYNAMIC_PROBE }])
    ;(globalThis as { __SOFTMARKET_BUILD_PAYMENTS__?: boolean }).__SOFTMARKET_BUILD_PAYMENTS__ = false
    vi.resetModules()
    const off = await import('../../src/lib/static-params')
    await expect(off.contentStaticParams('/yasal/[slug]')).rejects.toThrow('must not read content')
    vi.doUnmock('../../src/lib/content')
    vi.doUnmock('../../src/lib/support')
  })

  it('the locale layout calls the boundary unconditionally; next.config defines the build constant', () => {
    const layout = readFileSync('src/app/(frontend)/[locale]/layout.tsx', 'utf8')
    const body = layout.slice(layout.indexOf('export default async function LocaleLayout'))
    expect(body).toMatch(/setRequestLocale\(locale\)\s*\n(?:\s*\/\/.*\n)*\s*commerceRenderBoundary\(\)/)
    expect(readFileSync('next.config.ts', 'utf8')).toContain("__SOFTMARKET_BUILD_PAYMENTS__: JSON.stringify(process.env.PAYMENTS_ENABLED === 'true')")
  })

  it('every frontend file that reads the commerce state renders under the locale layout (or is the sitemap)', () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap((n) => statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)])
    const readers = walk('src/app').filter((f) => /\.(ts|tsx)$/.test(f) && /getCommerceState\(/.test(readFileSync(f, 'utf8')))
    for (const file of readers) expect(file).toMatch(/^src\/app\/(\(frontend\)\/\[locale\]\/|sitemap\.ts$)/)
  })
})

describe('admin order actions stay in the admin bundle', () => {
  it('the client half imports only react / next/navigation; no frontend module imports src/admin', () => {
    const client = readFileSync('src/admin/fields/order-actions-client.tsx', 'utf8')
    const imports = [...client.matchAll(/^import[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1])
    expect(imports.sort()).toEqual(['next/navigation', 'react'])
    const walk = (d: string): string[] => readdirSync(d).flatMap((n) => statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)])
    const frontend = [...walk('src/app/(frontend)'), ...walk('src/components')].filter((f) => /\.(ts|tsx)$/.test(f))
    for (const file of frontend) expect(readFileSync(file, 'utf8')).not.toMatch(/from ['"]@\/admin\//)
    // Registered only through the Payload import map (admin route), never imported directly by app code.
    expect(readFileSync('src/app/(payload)/admin/importMap.js', 'utf8')).toContain('@/admin/fields/order-actions#OrderActions')
  })
})
