import type { Currency, ProviderId, ProviderPaymentState } from './types'

/**
 * Order state machine (plan §2.3), pure.
 *
 *   pending ─paid─▶ paid ─fulfill─▶ fulfilled
 *     ├─fail─▶ failed ─┐   └─refund─▶ refunded ◀─refund─┘
 *     └─expire─▶ cancelled ─┴─(provider-verified late payment)─▶ paid [requiresReview]
 *
 * "Event = trigger, provider = truth": transitions are derived ONLY from a server-side
 * retrieve() result, never from a webhook/callback body.
 */

export type OrderStatus = 'pending' | 'paid' | 'fulfilled' | 'failed' | 'refunded' | 'cancelled'

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['paid', 'failed', 'cancelled'],
  paid: ['fulfilled', 'refunded'],
  fulfilled: ['refunded'],
  failed: ['paid'],
  cancelled: ['paid'],
  refunded: [],
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export type OrderExpectation = {
  orderNumber: string
  status: OrderStatus
  provider: ProviderId
  providerRef: string
  currency: Currency
  totalMinor: number
}

export type SyncDecision =
  | { kind: 'noop'; reason: string }
  | { kind: 'transition'; from: OrderStatus; to: OrderStatus; requiresReview: boolean; failureCode?: string }
  /** Provider answer does not belong to this order: never transition, flag for admin. */
  | { kind: 'flag'; failureCode: 'reference_mismatch' }

export function decideFromProvider(order: OrderExpectation, state: ProviderPaymentState): SyncDecision {
  if (
    state.provider !== order.provider ||
    state.providerRef !== order.providerRef ||
    (state.status === 'paid' ? state.orderNumber !== order.orderNumber : state.orderNumber !== undefined && state.orderNumber !== order.orderNumber)
  ) {
    return { kind: 'flag', failureCode: 'reference_mismatch' }
  }

  const go = (to: OrderStatus, requiresReview = false, failureCode?: string): SyncDecision =>
    canTransition(order.status, to)
      ? { kind: 'transition', from: order.status, to, requiresReview, failureCode }
      : { kind: 'noop', reason: `no_${order.status}_to_${to}` }

  switch (state.status) {
    case 'paid': {
      const amountOk = state.amountMinor === order.totalMinor && state.currency === order.currency
      // Late payment on a failed/cancelled order is accepted only as "paid + review".
      const late = order.status === 'failed' || order.status === 'cancelled'
      if (!amountOk) return go('paid', true, 'amount_mismatch')
      return go('paid', late, late ? 'late_payment' : undefined)
    }
    case 'failed':
      return go('failed', false, state.failureCode ?? 'payment_failed')
    case 'expired':
      return go('cancelled', false, 'expired')
    case 'refunded':
      return go('refunded')
    case 'review':
    case 'pending':
      return { kind: 'noop', reason: state.status }
  }
}
