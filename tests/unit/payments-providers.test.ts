import { inspect } from 'node:util'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { describePaymentsEnv, readPaymentsEnv, type IyzicoConfig, type StripeConfig } from '../../src/lib/payments/env'
import { PaymentError } from '../../src/lib/payments/errors'
import { createConfiguredProviders } from '../../src/lib/payments/providers'
import { createIyzicoProvider, IYZICO_PATHS } from '../../src/lib/payments/providers/iyzico'
import { createStripeProvider } from '../../src/lib/payments/providers/stripe'
import { SecretValue } from '../../src/lib/payments/secret'
import { iyzicoRequestSignature, iyzicoResponseSignature, iyzicoWebhookSignature } from '../../src/lib/payments/signature/iyzico'
import { computeStripeSignature } from '../../src/lib/payments/signature/stripe'
import type { CheckoutInput, FetchLike } from '../../src/lib/payments/types'

const IYZ_API = 'sandbox-API-KEY-abcdef0123456789'
const IYZ_SECRET = 'sandbox-SECRET-KEY-fedcba9876543210'
const STRIPE_SK = 'sk_test_SECRETKEY0123456789abcdef'
const STRIPE_WHSEC = 'whsec_WEBHOOKSECRET0123456789'
const SECRETS = [IYZ_API, IYZ_SECRET, STRIPE_SK, STRIPE_WHSEC]

const iyzConfig: IyzicoConfig = {
  apiKey: new SecretValue(IYZ_API),
  secretKey: new SecretValue(IYZ_SECRET),
  baseUrl: 'https://sandbox-api.iyzipay.com',
  env: 'sandbox',
}
const stripeConfig: StripeConfig = {
  secretKey: new SecretValue(STRIPE_SK),
  webhookSecret: new SecretValue(STRIPE_WHSEC),
  apiBase: 'https://api.stripe.com',
  env: 'sandbox',
}

type Call = { url: string; method: string; headers: Record<string, string>; body?: string }

function fakeFetch(respond: (call: Call) => { status?: number; json: unknown }) {
  const calls: Call[] = []
  const fetch: FetchLike = async (url, init) => {
    const call = { url, method: init.method, headers: init.headers, body: init.body }
    calls.push(call)
    const { status = 200, json } = respond(call)
    return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(json) }
  }
  return { fetch, calls }
}

const checkoutInput = (over: Partial<CheckoutInput> = {}): CheckoutInput => ({
  orderNumber: 'SM-261108-ABCDEF',
  idempotencyKey: 'a'.repeat(64),
  currency: 'TRY',
  totalMinor: 120_050,
  locale: 'tr',
  item: { sku: 'PRO-1Y', title: 'Pro 1 yıl' },
  buyer: {
    id: '7', name: 'Ada', surname: 'Yılmaz', email: 'ada@example.com', identityNumber: '11111111111', gsmNumber: '+905551112233',
    address: 'Adres 1', city: 'Istanbul', country: 'Turkey', ip: '203.0.113.5',
  },
  urls: { callbackUrl: 'https://example.com/api/payments/iyzico/callback', successUrl: 'https://example.com/ok', cancelUrl: 'https://example.com/no' },
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  ...over,
})

afterEach(() => vi.restoreAllMocks())

describe('iyzico adapter', () => {
  const token = 'tok-ABCDEF123456'

  it('initializes Checkout Form with IYZWSv2 auth, server amounts and returns paymentPageUrl', async () => {
    const { fetch, calls } = fakeFetch(() => ({
      json: {
        status: 'success', conversationId: 'SM-261108-ABCDEF', token, tokenExpireTime: 1800,
        paymentPageUrl: 'https://sandbox-cpp.iyzipay.com?token=' + token + '&lang=tr',
        checkoutFormContent: '<script>…</script>',
        signature: iyzicoResponseSignature(IYZ_SECRET, ['SM-261108-ABCDEF', token]),
      },
    }))
    const provider = createIyzicoProvider({ config: iyzConfig, fetch, randomKey: () => '123456789' })
    const session = await provider.createCheckout(checkoutInput())
    expect(session).toMatchObject({ provider: 'iyzico', providerEnv: 'sandbox', providerRef: token })
    expect(session.redirectUrl).toContain('sandbox-cpp.iyzipay.com')

    const call = calls[0]!
    expect(call.url).toBe(`https://sandbox-api.iyzipay.com${IYZICO_PATHS.initialize}`)
    const body = JSON.parse(call.body!)
    expect(body).toMatchObject({ price: '1200.50', paidPrice: '1200.50', currency: 'TRY', conversationId: 'SM-261108-ABCDEF', enabledInstallments: [1] })
    expect(body.basketItems).toEqual([{ id: 'PRO-1Y', name: 'Pro 1 yıl', category1: 'Software', itemType: 'VIRTUAL', price: '1200.50' }])
    const decoded = Buffer.from(call.headers.Authorization!.replace(/^IYZWSv2 /, ''), 'base64').toString()
    expect(decoded).toBe(`apiKey:${IYZ_API}&randomKey:123456789&signature:${iyzicoRequestSignature(IYZ_SECRET, '123456789', IYZICO_PATHS.initialize, call.body!)}`)
    expect(call.headers['x-iyzi-rnd']).toBe('123456789')
  })

  it('rejects unsigned/forged initialize responses and foreign redirect hosts', async () => {
    const make = (json: Record<string, unknown>) =>
      createIyzicoProvider({ config: iyzConfig, fetch: fakeFetch(() => ({ json })).fetch, randomKey: () => '1' })
    const ok = { status: 'success', conversationId: 'SM-261108-ABCDEF', token, paymentPageUrl: 'https://sandbox-cpp.iyzipay.com?token=x' }
    await expect(make({ ...ok }).createCheckout(checkoutInput())).rejects.toMatchObject({ code: 'signature_mismatch' })
    const sig = iyzicoResponseSignature(IYZ_SECRET, ['SM-261108-ABCDEF', token])
    await expect(make({ ...ok, signature: sig, paymentPageUrl: 'https://evil.example/pay' }).createCheckout(checkoutInput())).rejects.toMatchObject({ code: 'bad_response' })
    await expect(make({ ...ok, signature: sig, conversationId: 'other' }).createCheckout(checkoutInput())).rejects.toMatchObject({ code: 'bad_response' })
    await expect(make({ status: 'failure', errorCode: '1000', errorMessage: 'Geçersiz imza' }).createCheckout(checkoutInput())).rejects.toMatchObject({ code: 'provider_error' })
  })

  it('validates input before any network call', async () => {
    const { fetch, calls } = fakeFetch(() => ({ json: {} }))
    const provider = createIyzicoProvider({ config: iyzConfig, fetch })
    await expect(provider.createCheckout(checkoutInput({ totalMinor: 0 }))).rejects.toBeInstanceOf(PaymentError)
    await expect(provider.createCheckout(checkoutInput({ totalMinor: 10.5 }))).rejects.toBeInstanceOf(PaymentError)
    await expect(provider.retrieve('../../etc')).rejects.toMatchObject({ code: 'invalid_input' })
    expect(calls).toHaveLength(0)
  })

  const retrieveJson = (over: Record<string, unknown> = {}) => {
    const base: Record<string, unknown> = {
      status: 'success', paymentStatus: 'SUCCESS', fraudStatus: 1, paymentId: '22416032', currency: 'TRY',
      basketId: 'SM-261108-ABCDEF', conversationId: 'SM-261108-ABCDEF', price: 1200.5, paidPrice: 1200.5, token, ...over,
    }
    base.signature ??= iyzicoResponseSignature(IYZ_SECRET, [
      String(base.paymentStatus), String(base.paymentId), String(base.currency), String(base.basketId),
      String(base.conversationId), String(base.paidPrice), String(base.price), token,
    ])
    return base
  }
  const retrieveWith = (json: Record<string, unknown>) =>
    createIyzicoProvider({ config: iyzConfig, fetch: fakeFetch(() => ({ json })).fetch }).retrieve(token, { orderNumber: 'SM-261108-ABCDEF' })

  it('retrieve: verified SUCCESS + fraudStatus 1 → paid with minor amount', async () => {
    await expect(retrieveWith(retrieveJson())).resolves.toEqual({
      provider: 'iyzico', providerRef: token, status: 'paid', orderNumber: 'SM-261108-ABCDEF',
      providerPaymentId: '22416032', amountMinor: 120_050, currency: 'TRY',
    })
  })

  it('retrieve: fraud review / reject, failure, pending', async () => {
    await expect(retrieveWith(retrieveJson({ fraudStatus: 0 }))).resolves.toMatchObject({ status: 'review' })
    await expect(retrieveWith(retrieveJson({ fraudStatus: -1 }))).resolves.toMatchObject({ status: 'failed', failureCode: 'fraud_rejected' })
    await expect(retrieveWith(retrieveJson({ paymentStatus: 'INIT_THREEDS' }))).resolves.toMatchObject({ status: 'pending' })
    await expect(retrieveWith({ status: 'failure', paymentStatus: 'FAILURE', errorCode: '10051', errorMessage: 'Kart limiti yetersiz' }))
      .rejects.toMatchObject({ code: 'provider_error' })
    await expect(retrieveWith({ status: 'failure', errorCode: '5', errorMessage: 'x y z' })).rejects.toMatchObject({ code: 'provider_error' })
  })

  it('retrieve: tampered response (amount changed after signing) is rejected', async () => {
    const json = retrieveJson()
    await expect(retrieveWith({ ...json, price: 1.0, paidPrice: 1.0 })).rejects.toMatchObject({ code: 'signature_mismatch' })
    await expect(retrieveWith({ ...json, signature: undefined })).rejects.toMatchObject({ code: 'signature_mismatch' })
  })

  it('retrieve: paidPrice ≠ price → amount unknown (state machine flags mismatch)', async () => {
    const res = await retrieveWith(retrieveJson({ paidPrice: 1300 }))
    expect(res.status).toBe('paid')
    expect(res.amountMinor).toBeUndefined()
  })

  it('webhook: valid HPP signature → event; tampered/missing → rejected', () => {
    const provider = createIyzicoProvider({ config: iyzConfig, fetch: fakeFetch(() => ({ json: {} })).fetch })
    const payload = {
      paymentConversationId: 'SM-261108-ABCDEF', merchantId: '1', token, status: 'SUCCESS',
      iyziReferenceCode: 'r', iyziEventType: 'CHECKOUT_FORM_AUTH', iyziEventTime: 1, iyziPaymentId: 22416032,
    }
    const sig = iyzicoWebhookSignature(IYZ_SECRET, { ...payload, iyziPaymentId: '22416032' })
    const raw = JSON.stringify(payload)
    const ok = provider.verifyWebhook(raw, { 'X-IYZ-SIGNATURE-V3': sig })
    expect(ok).toMatchObject({ ok: true, event: { provider: 'iyzico', type: 'CHECKOUT_FORM_AUTH', providerRef: token, orderNumber: 'SM-261108-ABCDEF', providerPaymentId: '22416032' } })
    expect(provider.verifyWebhook(raw.replace('SUCCESS', 'FAILURE'), { 'x-iyz-signature-v3': sig })).toEqual({ ok: false, reason: 'invalid_signature' })
    expect(provider.verifyWebhook(raw, {})).toEqual({ ok: false, reason: 'missing_signature' })
    expect(provider.verifyWebhook('not json', new Headers({ 'x-iyz-signature-v3': sig }))).toEqual({ ok: false, reason: 'malformed' })
    expect(provider.verifyWebhook('x'.repeat(256 * 1024 + 1), { 'x-iyz-signature-v3': sig })).toEqual({ ok: false, reason: 'too_large' })
  })

  it('refund: v2 refund by paymentId with verified response', async () => {
    const { fetch, calls } = fakeFetch(() => ({
      json: { status: 'success', paymentId: '22416032', price: 1200.5, currency: 'TRY', conversationId: 'SM-261108-ABCDEF',
        signature: iyzicoResponseSignature(IYZ_SECRET, ['22416032', '1200.5', 'TRY', 'SM-261108-ABCDEF']) },
    }))
    const provider = createIyzicoProvider({ config: iyzConfig, fetch })
    await expect(provider.refund({ orderNumber: 'SM-261108-ABCDEF', idempotencyKey: 'k', providerPaymentId: '22416032', currency: 'TRY', amountMinor: 120_050 }))
      .resolves.toMatchObject({ ok: true, status: 'succeeded' })
    expect(calls[0]!.url.endsWith(IYZICO_PATHS.refund)).toBe(true)
    expect(JSON.parse(calls[0]!.body!)).toMatchObject({ paymentId: '22416032', price: '1200.50', currency: 'TRY' })
  })
})

describe('Stripe adapter (off by default)', () => {
  const sessionId = 'cs_test_a1B2c3'

  it('creates a Checkout Session with server amount, idempotency key and pinned API version', async () => {
    const { fetch, calls } = fakeFetch(() => ({
      json: { id: sessionId, url: 'https://checkout.stripe.com/c/pay/' + sessionId, client_reference_id: 'SM-261108-ABCDEF', expires_at: 1_900_000_000 },
    }))
    const provider = createStripeProvider({ config: stripeConfig, fetch })
    const session = await provider.createCheckout(checkoutInput({ currency: 'USD', totalMinor: 5000 }))
    expect(session).toMatchObject({ provider: 'stripe', providerRef: sessionId })
    const call = calls[0]!
    expect(call.url).toBe('https://api.stripe.com/v1/checkout/sessions')
    expect(call.headers['Idempotency-Key']).toBe('a'.repeat(64))
    expect(call.headers['Stripe-Version']).toMatch(/^\d{4}-\d{2}-\d{2}/)
    const params = new URLSearchParams(call.body)
    expect(params.get('mode')).toBe('payment')
    expect(params.get('line_items[0][price_data][unit_amount]')).toBe('5000')
    expect(params.get('line_items[0][price_data][currency]')).toBe('usd')
    expect(params.get('client_reference_id')).toBe('SM-261108-ABCDEF')
  })

  it('refuses TRY, bad expiry and foreign redirect URLs', async () => {
    const { fetch } = fakeFetch(() => ({ json: { id: sessionId, url: 'https://evil.example/', client_reference_id: 'SM-261108-ABCDEF' } }))
    const provider = createStripeProvider({ config: stripeConfig, fetch })
    await expect(provider.createCheckout(checkoutInput({ currency: 'TRY' }))).rejects.toMatchObject({ code: 'invalid_input' })
    await expect(provider.createCheckout(checkoutInput({ currency: 'USD', expiresAt: new Date(Date.now() + 60_000) }))).rejects.toMatchObject({ code: 'invalid_input' })
    await expect(provider.createCheckout(checkoutInput({ currency: 'USD' }))).rejects.toMatchObject({ code: 'bad_response' })
  })

  it('retrieve maps session state; rejects path injection', async () => {
    const make = (json: Record<string, unknown>) => createStripeProvider({ config: stripeConfig, fetch: fakeFetch(() => ({ json })).fetch })
    const base = { id: sessionId, client_reference_id: 'SM-261108-ABCDEF', amount_total: 5000, currency: 'usd', payment_intent: 'pi_1' }
    await expect(make({ ...base, status: 'complete', payment_status: 'paid' }).retrieve(sessionId))
      .resolves.toMatchObject({ status: 'paid', amountMinor: 5000, currency: 'USD', providerPaymentId: 'pi_1' })
    await expect(make({ ...base, status: 'complete', payment_status: 'unpaid' }).retrieve(sessionId)).resolves.toMatchObject({ status: 'pending' })
    await expect(make({ ...base, status: 'expired', payment_status: 'unpaid' }).retrieve(sessionId)).resolves.toMatchObject({ status: 'expired' })
    await expect(make(base).retrieve('cs_test_x/../../v1/charges')).rejects.toMatchObject({ code: 'invalid_input' })
  })

  it('webhook: valid / tampered / expired signature', () => {
    const provider = createStripeProvider({ config: stripeConfig, fetch: fakeFetch(() => ({ json: {} })).fetch })
    const raw = JSON.stringify({
      id: 'evt_123', type: 'checkout.session.completed',
      data: { object: { object: 'checkout.session', id: sessionId, client_reference_id: 'SM-261108-ABCDEF', payment_intent: 'pi_1' } },
    })
    const t = 1_762_600_000
    const now = new Date(t * 1000)
    const header = `t=${t},v1=${computeStripeSignature(raw, STRIPE_WHSEC, t)}`
    expect(provider.verifyWebhook(raw, { 'stripe-signature': header }, now)).toEqual({
      ok: true,
      event: { provider: 'stripe', eventId: 'evt_123', type: 'checkout.session.completed', providerRef: sessionId, providerPaymentId: 'pi_1', orderNumber: 'SM-261108-ABCDEF' },
    })
    expect(provider.verifyWebhook(raw.replace('completed', 'expired'), { 'stripe-signature': header }, now)).toEqual({ ok: false, reason: 'invalid_signature' })
    expect(provider.verifyWebhook(raw, { 'stripe-signature': header }, new Date((t + 301) * 1000))).toEqual({ ok: false, reason: 'timestamp_out_of_tolerance' })
    expect(provider.verifyWebhook(raw, {}, now)).toEqual({ ok: false, reason: 'missing_signature' })
  })
})

describe('env and secrets', () => {
  const env = {
    PAYMENTS_ENABLED: 'true',
    IYZICO_API_KEY: IYZ_API,
    IYZICO_SECRET_KEY: IYZ_SECRET,
    IYZICO_BASE_URL: 'https://sandbox-api.iyzipay.com/',
    PAYMENTS_STRIPE_ENABLED: 'true',
    STRIPE_SECRET_KEY: STRIPE_SK,
    STRIPE_WEBHOOK_SECRET: STRIPE_WHSEC,
  }

  it('reads config; Stripe stays off unless PAYMENTS_STRIPE_ENABLED=true', () => {
    const cfg = readPaymentsEnv(env)
    expect(cfg.capability).toBe(true)
    expect(cfg.iyzico?.env).toBe('sandbox')
    expect(cfg.stripe?.env).toBe('sandbox')
    expect(cfg.stripeCurrencies).toEqual(['USD', 'EUR'])
    expect(readPaymentsEnv({ ...env, PAYMENTS_STRIPE_ENABLED: undefined }).stripe).toBeUndefined()
    expect(readPaymentsEnv({ ...env, IYZICO_BASE_URL: IYZICO_LIVE }).iyzico?.env).toBe('live')
  })

  it('treats empty/CHANGE_ values and unknown base URLs as not configured', () => {
    expect(readPaymentsEnv({}).capability).toBe(false)
    expect(readPaymentsEnv({ ...env, IYZICO_SECRET_KEY: 'CHANGE_ME' }).iyzico).toBeUndefined()
    expect(readPaymentsEnv({ ...env, IYZICO_BASE_URL: 'https://evil.example' }).issues).toContain('IYZICO_BASE_URL')
    expect(readPaymentsEnv({ ...env, IYZICO_BASE_URL: 'http://127.0.0.1:3999' }).iyzico?.env).toBe('sandbox')
    expect(readPaymentsEnv({ ...env, NODE_ENV: 'production', IYZICO_BASE_URL: 'http://127.0.0.1:3999' }).iyzico).toBeUndefined()
    expect(readPaymentsEnv({ ...env, STRIPE_SECRET_KEY: 'pk_test_x' }).stripe).toBeUndefined()
    expect(readPaymentsEnv({ ...env, PAYMENTS_STRIPE_CURRENCIES: 'TRY,usd,GBP' }).stripeCurrencies).toEqual(['USD'])
  })

  it('no provider is built when capability is off', () => {
    const { fetch } = fakeFetch(() => ({ json: {} }))
    expect(createConfiguredProviders(readPaymentsEnv({ ...env, PAYMENTS_ENABLED: 'false' }), fetch)).toEqual({})
    expect(Object.keys(createConfiguredProviders(readPaymentsEnv(env), fetch)).sort()).toEqual(['iyzico', 'stripe'])
  })

  it('never exposes secrets via String/JSON/inspect/describe', () => {
    const cfg = readPaymentsEnv(env)
    const dumps = [
      JSON.stringify(cfg),
      inspect(cfg, { depth: 10 }),
      String(cfg.iyzico?.secretKey),
      `${cfg.stripe?.secretKey}`,
      JSON.stringify(describePaymentsEnv(cfg)),
    ]
    for (const dump of dumps) for (const secret of SECRETS) expect(dump).not.toContain(secret)
    expect(cfg.iyzico?.secretKey.reveal()).toBe(IYZ_SECRET)
  })

  it('errors and logs never contain secrets, request bodies or buyer data', async () => {
    const logged: string[] = []
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => void logged.push(args.map((a) => inspect(a, { depth: 10 })).join(' ')))
    }
    const failing: FetchLike = async () => {
      throw new Error(`connect failed Authorization: Bearer ${STRIPE_SK}`)
    }
    const errors: unknown[] = []
    const iyz = createIyzicoProvider({ config: iyzConfig, fetch: failing })
    const str = createStripeProvider({ config: stripeConfig, fetch: failing })
    for (const p of [iyz.createCheckout(checkoutInput()), iyz.retrieve('tok-ABCDEF123456'), str.createCheckout(checkoutInput({ currency: 'EUR' }))]) {
      await p.catch((e: unknown) => errors.push(e))
    }
    const html = createIyzicoProvider({ config: iyzConfig, fetch: fakeFetch(() => ({ status: 500, json: { secret: IYZ_SECRET } })).fetch })
    await html.createCheckout(checkoutInput()).catch((e: unknown) => errors.push(e))
    const failure = createIyzicoProvider({ config: iyzConfig, fetch: fakeFetch(() => ({ json: { status: 'failure', errorCode: 'Bad code with spaces ada@example.com' } })).fetch })
    await failure.createCheckout(checkoutInput()).catch((e: unknown) => errors.push(e))

    expect(errors).toHaveLength(5)
    for (const error of errors) {
      expect(error).toBeInstanceOf(PaymentError)
      const dump = `${String(error)} ${inspect(error, { depth: 10 })} ${JSON.stringify(error)}`
      for (const needle of [...SECRETS, 'ada@example.com', '11111111111', '203.0.113.5', 'Bearer']) expect(dump).not.toContain(needle)
      expect((error as Error).cause).toBeUndefined()
    }
    expect(logged).toEqual([])
  })
})

const IYZICO_LIVE = 'https://api.iyzipay.com'

describe('payment audit regressions', () => {
  const token = 'tok-ABCDEF123456'
  const order = 'SM-261108-ABCDEF'
  const signature = iyzicoResponseSignature(IYZ_SECRET, [order, token])
  const initialized = { status: 'success', conversationId: order, token, signature }
  const iyz = (json: Record<string, unknown>, status = 200) => createIyzicoProvider({ config: iyzConfig, fetch: fakeFetch(() => ({ json, status })).fetch })

  it('rejects deceptive redirect hosts, userinfo and localhost with a real provider base', async () => {
    for (const paymentPageUrl of ['https://iyzico.com.evil.test/', 'https://user@iyzico.com/', 'http://localhost:3000/', 'https://iyzico.com@evil.test/']) {
      await expect(iyz({ ...initialized, paymentPageUrl }).createCheckout(checkoutInput())).rejects.toMatchObject({ code: 'bad_response' })
    }
  })

  it('rejects non-success HTTP status and missing buyer phone', async () => {
    await expect(iyz({ ...initialized, paymentPageUrl: 'https://iyzico.com/' }, 500).createCheckout(checkoutInput())).rejects.toMatchObject({ code: 'http_error' })
    const input = checkoutInput()
    input.buyer.gsmNumber = ''
    await expect(iyz({}).createCheckout(input)).rejects.toMatchObject({ code: 'invalid_input' })
  })

  it('rejects a signed retrieve response for a different basket', async () => {
    const values = ['SUCCESS', '123', 'TRY', 'other-order', order, '1200.5', '1200.5', token]
    const json = { status: 'success', paymentStatus: values[0], paymentId: values[1], currency: values[2], basketId: values[3], conversationId: values[4], paidPrice: values[5], price: values[6], fraudStatus: 1, signature: iyzicoResponseSignature(IYZ_SECRET, values) }
    await expect(iyz(json).retrieve(token, { orderNumber: order })).rejects.toMatchObject({ code: 'bad_response' })
  })

  it('rejects signed refunds for a different payment', async () => {
    const values = ['other', '1200.5', 'TRY', order]
    const json = { status: 'success', paymentId: values[0], price: values[1], currency: values[2], conversationId: values[3], signature: iyzicoResponseSignature(IYZ_SECRET, values) }
    await expect(iyz(json).refund({ orderNumber: order, idempotencyKey: 'key', providerPaymentId: '123', currency: 'TRY', amountMinor: 120050 })).rejects.toMatchObject({ code: 'bad_response' })
  })
})
