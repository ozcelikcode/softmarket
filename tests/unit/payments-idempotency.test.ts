import { describe, expect, it } from 'vitest'

import {
  createCheckoutNonce,
  generateOrderNumber,
  iyzicoEventId,
  operationIdempotencyKey,
  ORDER_NUMBER_RE,
  orderIdempotencyKey,
  paymentEventKey,
  planFulfillment,
} from '../../src/lib/payments/idempotency'
import { canTransition, decideFromProvider, type OrderExpectation, type OrderStatus } from '../../src/lib/payments/state'

describe('idempotency keys', () => {
  it('order key is stable per (customer, nonce) and distinct otherwise', () => {
    const nonce = createCheckoutNonce()
    expect(nonce).toMatch(/^[A-Za-z0-9_-]{24}$/)
    const a = orderIdempotencyKey(7, nonce)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(orderIdempotencyKey('7', nonce)).toBe(a)
    expect(orderIdempotencyKey(8, nonce)).not.toBe(a)
    expect(orderIdempotencyKey(7, createCheckoutNonce())).not.toBe(a)
  })

  it('rejects malformed nonce/customer', () => {
    expect(orderIdempotencyKey(7, 'short')).toBeNull()
    expect(orderIdempotencyKey(7, 'x'.repeat(30) + '!')).toBeNull()
    expect(orderIdempotencyKey('a b', createCheckoutNonce())).toBeNull()
  })

  it('operation and event keys', () => {
    expect(operationIdempotencyKey('refund', 'SM-261108-ABCDEF')).toBe(operationIdempotencyKey('refund', 'SM-261108-ABCDEF'))
    expect(operationIdempotencyKey('refund', 'SM-261108-ABCDEF')).not.toBe(operationIdempotencyKey('cancel', 'SM-261108-ABCDEF'))
    expect(paymentEventKey('stripe', 'evt_123')).toBe('stripe:evt_123')
    expect(paymentEventKey('stripe', '')).toBeNull()
    expect(paymentEventKey('stripe', 'evt 1; drop')).toBeNull()
    const id = iyzicoEventId({ eventType: 'CHECKOUT_FORM_AUTH', paymentRef: 'tok', status: 'SUCCESS' })
    expect(id).toBe(iyzicoEventId({ eventType: 'CHECKOUT_FORM_AUTH', paymentRef: 'tok', status: 'SUCCESS' }))
    expect(id).not.toBe(iyzicoEventId({ eventType: 'CHECKOUT_FORM_AUTH', paymentRef: 'tok', status: 'FAILURE' }))
    expect(paymentEventKey('iyzico', id)).not.toBeNull()
  })
})

describe('order number', () => {
  it('has the SM-YYMMDD-XXXXXX format with unambiguous base32', () => {
    const n = generateOrderNumber(new Date('2026-11-08T23:59:00Z'))
    expect(n).toMatch(ORDER_NUMBER_RE)
    expect(n.startsWith('SM-261108-')).toBe(true)
    expect(generateOrderNumber(new Date('2026-01-02T00:00:00Z'), () => Buffer.alloc(6, 31))).toBe('SM-260102-ZZZZZZ')
    expect(generateOrderNumber(new Date('2026-01-02T00:00:00Z'), () => Buffer.alloc(6, 0))).toBe('SM-260102-000000')
  })

  it('is random (no collisions in a small sample)', () => {
    const set = new Set(Array.from({ length: 500 }, () => generateOrderNumber(new Date())))
    expect(set.size).toBe(500)
  })
})

describe('licence issued exactly once (planFulfillment)', () => {
  const items = [
    { id: 'a', licenseId: null },
    { id: 'b', licenseId: 42 },
  ]

  it('issues only for paid, unreviewed orders and only missing items', () => {
    expect(planFulfillment({ status: 'paid', requiresReview: false, items })).toEqual({ action: 'issue', itemIds: ['a'], thenTransition: 'paid->fulfilled' })
  })

  it('second call after licences are written becomes a transition, then a no-op', () => {
    const filled = items.map((i) => ({ ...i, licenseId: i.licenseId ?? 99 }))
    expect(planFulfillment({ status: 'paid', requiresReview: false, items: filled })).toEqual({ action: 'transition_only', thenTransition: 'paid->fulfilled' })
    expect(planFulfillment({ status: 'fulfilled', requiresReview: false, items: filled })).toEqual({ action: 'none', reason: 'already_fulfilled' })
  })

  it('never issues for review, pending, failed, cancelled or refunded orders', () => {
    expect(planFulfillment({ status: 'paid', requiresReview: true, items })).toEqual({ action: 'none', reason: 'requires_review' })
    for (const status of ['pending', 'failed', 'cancelled', 'refunded'] as const) {
      expect(planFulfillment({ status, requiresReview: false, items }).action).toBe('none')
    }
  })
})

describe('state machine', () => {
  const all: OrderStatus[] = ['pending', 'paid', 'fulfilled', 'failed', 'refunded', 'cancelled']
  const allowed = new Set([
    'pending>paid', 'pending>failed', 'pending>cancelled', 'paid>fulfilled', 'paid>refunded',
    'fulfilled>refunded', 'failed>paid', 'cancelled>paid',
  ])

  it('canTransition matches the plan table for every pair', () => {
    for (const from of all) for (const to of all) expect(canTransition(from, to)).toBe(allowed.has(`${from}>${to}`))
  })

  const order: OrderExpectation = {
    orderNumber: 'SM-261108-ABCDEF', status: 'pending', provider: 'iyzico', providerRef: 'tok-123456789', currency: 'TRY', totalMinor: 12000,
  }
  const paid = { provider: 'iyzico' as const, providerRef: 'tok-123456789', orderNumber: order.orderNumber, status: 'paid' as const, amountMinor: 12000, currency: 'TRY' as const }

  it('paid with exact amount → paid', () => {
    expect(decideFromProvider(order, paid)).toEqual({ kind: 'transition', from: 'pending', to: 'paid', requiresReview: false, failureCode: undefined })
  })

  it('amount or currency mismatch → paid + review (no fulfillment)', () => {
    expect(decideFromProvider(order, { ...paid, amountMinor: 11999 })).toMatchObject({ to: 'paid', requiresReview: true, failureCode: 'amount_mismatch' })
    expect(decideFromProvider(order, { ...paid, currency: 'USD' })).toMatchObject({ requiresReview: true })
    expect(decideFromProvider(order, { ...paid, amountMinor: undefined })).toMatchObject({ requiresReview: true })
  })

  it('late payment on cancelled/failed → paid + review', () => {
    expect(decideFromProvider({ ...order, status: 'cancelled' }, paid)).toMatchObject({ to: 'paid', requiresReview: true, failureCode: 'late_payment' })
  })

  it('reference mismatch is flagged, never transitioned', () => {
    expect(decideFromProvider(order, { ...paid, orderNumber: 'SM-261108-OTHER0' })).toEqual({ kind: 'flag', failureCode: 'reference_mismatch' })
    expect(decideFromProvider(order, { ...paid, providerRef: 'tok-other00' })).toEqual({ kind: 'flag', failureCode: 'reference_mismatch' })
    expect(decideFromProvider(order, { ...paid, provider: 'stripe' })).toEqual({ kind: 'flag', failureCode: 'reference_mismatch' })
  })

  it('other provider states', () => {
    expect(decideFromProvider(order, { ...paid, status: 'failed', failureCode: '10051' })).toMatchObject({ to: 'failed', failureCode: '10051' })
    expect(decideFromProvider(order, { ...paid, status: 'expired' })).toMatchObject({ to: 'cancelled', failureCode: 'expired' })
    expect(decideFromProvider(order, { ...paid, status: 'review' })).toEqual({ kind: 'noop', reason: 'review' })
    expect(decideFromProvider({ ...order, status: 'fulfilled' }, { ...paid, status: 'refunded' })).toMatchObject({ to: 'refunded' })
    expect(decideFromProvider({ ...order, status: 'fulfilled' }, paid)).toEqual({ kind: 'noop', reason: 'no_fulfilled_to_paid' })
    expect(decideFromProvider({ ...order, status: 'refunded' }, paid).kind).toBe('noop')
  })
})
