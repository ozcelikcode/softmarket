import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { safeEqualHex } from '../../src/lib/payments/signature/compare'
import {
  encodeIyzicoAuthorization,
  iyzicoAuthorizationHeader,
  iyzicoRequestSignature,
  iyzicoResponseSignature,
  iyzicoSignaturePrice,
  iyzicoWebhookSignature,
  verifyIyzicoResponseSignature,
  verifyIyzicoWebhookSignature,
} from '../../src/lib/payments/signature/iyzico'
import {
  computeStripeSignature,
  parseStripeSignatureHeader,
  verifyStripeSignature,
} from '../../src/lib/payments/signature/stripe'

describe('iyzico response signature (official vector)', () => {
  // https://docs.iyzico.com/en/advanced/response-signature-validation — /payment/auth sample.
  const secretKey = 'sandbox-qaIiLIxhjMgx3LSKIVvp6j17NunHOFtD'
  const params = ['22416032', 'TRY', 'basketId', 'conversationId', '10.5', '10.5']
  const expected = '836c3a6c8db86c81043f2ca74edb13518b54a813f454f8dd762f0dd658610173'

  it('reproduces the documented signature', () => {
    expect(iyzicoResponseSignature(secretKey, params)).toBe(expected)
    expect(verifyIyzicoResponseSignature(secretKey, params, expected)).toBe(true)
    expect(verifyIyzicoResponseSignature(secretKey, params, expected.toUpperCase())).toBe(true)
  })

  it('rejects tampered params, wrong key, missing or malformed signature', () => {
    expect(verifyIyzicoResponseSignature(secretKey, ['22416032', 'TRY', 'basketId', 'conversationId', '10.5', '1.5'], expected)).toBe(false)
    expect(verifyIyzicoResponseSignature('sandbox-other', params, expected)).toBe(false)
    expect(verifyIyzicoResponseSignature(secretKey, params, undefined)).toBe(false)
    expect(verifyIyzicoResponseSignature(secretKey, params, '')).toBe(false)
    expect(verifyIyzicoResponseSignature(secretKey, params, 'zz' + expected.slice(2))).toBe(false)
    expect(verifyIyzicoResponseSignature(secretKey, params, expected.slice(0, 62))).toBe(false)
  })

  it('applies the documented trailing-zero rule', () => {
    expect(iyzicoSignaturePrice('10')).toBe('10')
    expect(iyzicoSignaturePrice('10.0')).toBe('10')
    expect(iyzicoSignaturePrice('10.5')).toBe('10.5')
    expect(iyzicoSignaturePrice('10.50')).toBe('10.5')
    expect(iyzicoSignaturePrice('10.510')).toBe('10.51')
    expect(iyzicoSignaturePrice('10.5105')).toBe('10.5105')
    expect(iyzicoSignaturePrice('10.51050')).toBe('10.5105')
    expect(iyzicoSignaturePrice(10.5)).toBe('10.5')
    expect(iyzicoSignaturePrice('100')).toBe('100')
  })
})

describe('iyzico IYZWSv2 authorization', () => {
  it('matches the documented base64 header assembly (Postman sample)', () => {
    // https://docs.iyzico.com/en/getting-started/preliminaries/authentication/hmacsha256-auth
    const header = encodeIyzicoAuthorization(
      'sandbox-3uHv0LccjcWDyFHTvJpiACKPcJwbczmZ',
      '1722246017090123456789',
      '91e491486d3aa951b4f387cc93d67fc754c4729af95344b694435f56447819e9',
    )
    expect(header).toBe(
      'IYZWSv2 YXBpS2V5OnNhbmRib3gtM3VIdjBMY2NqY1dEeUZIVHZKcGlBQ0tQY0p3YmN6bVomcmFuZG9tS2V5OjE3MjIyNDYwMTcwOTAxMjM0NTY3ODkmc2lnbmF0dXJlOjkxZTQ5MTQ4NmQzYWE5NTFiNGYzODdjYzkzZDY3ZmM3NTRjNDcyOWFmOTUzNDRiNjk0NDM1ZjU2NDQ3ODE5ZTk=',
    )
  })

  it('signs randomKey + uri path + body with HMAC-SHA256 hex', () => {
    const body = '{"binNumber":"589004"}'
    const expected = createHmac('sha256', 'secret').update(`123/payment/bin/check${body}`).digest('hex')
    expect(iyzicoRequestSignature('secret', '123', '/payment/bin/check', body)).toBe(expected)
    const header = iyzicoAuthorizationHeader({ apiKey: 'api', secretKey: 'secret', randomKey: '123', uriPath: '/payment/bin/check', body })
    const decoded = Buffer.from(header.replace(/^IYZWSv2 /, ''), 'base64').toString('utf8')
    expect(decoded).toBe(`apiKey:api&randomKey:123&signature:${expected}`)
    expect(decoded).not.toContain('secret')
  })
})

describe('iyzico webhook X-IYZ-SIGNATURE-V3', () => {
  const secretKey = 'sandbox-secret-key'
  const hpp = {
    iyziEventType: 'CHECKOUT_FORM_AUTH',
    iyziPaymentId: '22416032',
    token: 'tok-1234567890',
    paymentConversationId: 'SM-261108-ABCDEF',
    status: 'SUCCESS',
  }

  it('HPP format: secretKey + eventType + iyziPaymentId + token + conversationId + status', () => {
    const msg = `${secretKey}CHECKOUT_FORM_AUTH22416032tok-1234567890SM-261108-ABCDEFSUCCESS`
    const expected = createHmac('sha256', secretKey).update(msg).digest('hex')
    expect(iyzicoWebhookSignature(secretKey, hpp)).toBe(expected)
    expect(verifyIyzicoWebhookSignature(secretKey, hpp, expected)).toBe(true)
  })

  it('Direct format: secretKey + eventType + paymentId + conversationId + status', () => {
    const direct = { iyziEventType: 'PAYMENT_API', paymentId: '99', paymentConversationId: 'c1', status: 'SUCCESS' }
    const expected = createHmac('sha256', secretKey).update(`${secretKey}PAYMENT_API99c1SUCCESS`).digest('hex')
    expect(verifyIyzicoWebhookSignature(secretKey, direct, expected)).toBe(true)
  })

  it('rejects tampered fields, wrong secret, missing header', () => {
    const sig = iyzicoWebhookSignature(secretKey, hpp)
    expect(verifyIyzicoWebhookSignature(secretKey, { ...hpp, status: 'FAILURE' }, sig)).toBe(false)
    expect(verifyIyzicoWebhookSignature(secretKey, { ...hpp, token: 'tok-other' }, sig)).toBe(false)
    expect(verifyIyzicoWebhookSignature(secretKey, { ...hpp, paymentConversationId: 'SM-261108-ZZZZZZ' }, sig)).toBe(false)
    expect(verifyIyzicoWebhookSignature('other', hpp, sig)).toBe(false)
    expect(verifyIyzicoWebhookSignature(secretKey, hpp, undefined)).toBe(false)
    expect(verifyIyzicoWebhookSignature(secretKey, hpp, '')).toBe(false)
  })
})

describe('Stripe-Signature', () => {
  const secret = 'whsec_test_secret'
  const body = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' })
  const t = 1_762_600_000
  const now = new Date(t * 1000)
  const sig = computeStripeSignature(body, secret, t)

  it('matches the documented scheme HMAC(secret, "t.body")', () => {
    expect(sig).toBe(createHmac('sha256', secret).update(`${t}.${body}`).digest('hex'))
  })

  it('accepts a valid signature (also among several v1 entries / with v0)', () => {
    expect(verifyStripeSignature({ rawBody: body, header: `t=${t},v1=${sig}`, secret, now })).toEqual({ ok: true, timestamp: t })
    expect(verifyStripeSignature({ rawBody: body, header: `t=${t},v1=${'0'.repeat(64)},v1=${sig},v0=abc`, secret, now }).ok).toBe(true)
  })

  it('rejects invalid, tampered and wrong-secret payloads', () => {
    expect(verifyStripeSignature({ rawBody: body + ' ', header: `t=${t},v1=${sig}`, secret, now })).toEqual({ ok: false, reason: 'invalid_signature' })
    expect(verifyStripeSignature({ rawBody: body, header: `t=${t + 1},v1=${sig}`, secret, now })).toEqual({ ok: false, reason: 'invalid_signature' })
    expect(verifyStripeSignature({ rawBody: body, header: `t=${t},v1=${sig}`, secret: 'whsec_other', now })).toEqual({ ok: false, reason: 'invalid_signature' })
    expect(verifyStripeSignature({ rawBody: body, header: `t=${t},v0=${sig}`, secret, now })).toEqual({ ok: false, reason: 'malformed' })
  })

  it('enforces the 300 s tolerance in both directions (replay)', () => {
    const at = (sec: number) => new Date((t + sec) * 1000)
    expect(verifyStripeSignature({ rawBody: body, header: `t=${t},v1=${sig}`, secret, now: at(300) }).ok).toBe(true)
    expect(verifyStripeSignature({ rawBody: body, header: `t=${t},v1=${sig}`, secret, now: at(301) })).toEqual({ ok: false, reason: 'timestamp_out_of_tolerance' })
    expect(verifyStripeSignature({ rawBody: body, header: `t=${t},v1=${sig}`, secret, now: at(-301) })).toEqual({ ok: false, reason: 'timestamp_out_of_tolerance' })
    expect(verifyStripeSignature({ rawBody: body, header: `t=${t},v1=${sig}`, secret, now: at(1000), toleranceSec: 2000 }).ok).toBe(true)
  })

  it('rejects missing and malformed headers', () => {
    expect(verifyStripeSignature({ rawBody: body, header: undefined, secret, now })).toEqual({ ok: false, reason: 'missing_signature' })
    expect(verifyStripeSignature({ rawBody: body, header: 'garbage', secret, now })).toEqual({ ok: false, reason: 'malformed' })
    expect(parseStripeSignatureHeader('t=abc,v1=ff')).toBeNull()
    expect(parseStripeSignatureHeader(`t=${t}`)).toBeNull()
  })
})

describe('safeEqualHex', () => {
  it('is false for length mismatch and non-hex input', () => {
    expect(safeEqualHex('abcd', 'abcd')).toBe(true)
    expect(safeEqualHex('abcd', 'abc')).toBe(false)
    expect(safeEqualHex('abcd', 'abcg')).toBe(false)
    expect(safeEqualHex('abcd', 123 as unknown as string)).toBe(false)
  })
})

describe('Stripe timestamp edge cases', () => {
  it('rejects duplicate timestamps and invalid clocks or tolerances', () => {
    const rawBody = '{}'
    const secret = 'secret'
    const t = 1700000000
    const sig = computeStripeSignature(rawBody, secret, t)
    const base = { rawBody, secret, header: `t=${t},v1=${sig}`, now: new Date(t * 1000) }
    expect(verifyStripeSignature({ ...base, header: `t=${t},t=${t},v1=${sig}` }).ok).toBe(false)
    expect(verifyStripeSignature({ ...base, now: new Date('invalid') }).ok).toBe(false)
    expect(verifyStripeSignature({ ...base, toleranceSec: NaN }).ok).toBe(false)
  })
})
