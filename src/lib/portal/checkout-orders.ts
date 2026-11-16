import type { CustomerUser } from '@/access'
import { createPaymentsDeps } from '@/lib/payments/runtime'
import { syncOrderFromProvider } from '@/lib/payments/sync'
import { getPayloadClient } from '@/lib/site'

/**
 * Stripe return (`?s=<session id>`, GET with the customer's own session): a speed-up only. The order is synced from a
 * server-side provider read when it is the customer's pending Stripe order and the session id matches its reference;
 * the webhook stays the source of truth. Any failure is swallowed (the page then shows the stored state).
 */
export async function syncStripeReturn(customer: CustomerUser, orderId: number, orderNumber: string, sessionId: string): Promise<void> {
  if (!/^cs_[A-Za-z0-9_]{8,200}$/.test(sessionId)) return
  try {
    const payload = await getPayloadClient()
    const { docs } = await payload.find({
      collection: 'orders', overrideAccess: true, depth: 0, limit: 1, select: { providerRef: true, provider: true, status: true, customer: true },
      where: { and: [{ id: { equals: orderId } }, { orderNumber: { equals: orderNumber } }, { customer: { equals: customer.id } }, { status: { equals: 'pending' } }, { provider: { equals: 'stripe' } }, { providerRef: { equals: sessionId } }] },
    })
    if (!docs[0]) return
    await syncOrderFromProvider(createPaymentsDeps(payload), orderId)
  } catch {
    // The webhook completes the order.
  }
}
