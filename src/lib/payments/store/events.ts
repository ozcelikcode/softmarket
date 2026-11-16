import type { Payload } from 'payload'

import type { PaymentEventStore } from '../idempotency'
import type { ProviderId } from '../types'
import { withPaymentTransaction, type PaymentTx } from './transaction'

/*
 * PaymentEventStore (P1 contract) over the `payment-events` collection. `record` runs inside BEGIN IMMEDIATE, so
 * the existence check and the insert are atomic across concurrent deliveries; the unique `event_key` index is the
 * last line of defence. Only already verified notifications are recorded (P4 verifies before calling this).
 *
 * Duplicate semantics: `record` returns false when the event is already `processed` or `ignored`. An event left
 * `received` or `error` (the processing transaction failed after the record committed) returns true again, so a
 * provider retry is processed instead of being lost. Processing itself (fulfillOrder) is idempotent.
 */

export type PaymentEventInput = Parameters<PaymentEventStore['record']>[0] & {
  /** Defaults to true: callers record only events whose signature already verified. */
  signatureVerified?: boolean
  orderId?: number | string | null
}

type EventDoc = { id: number | string; status: 'received' | 'processed' | 'ignored' | 'error' }

const eventIdOf = (key: string, provider: ProviderId) => (key.startsWith(`${provider}:`) ? key.slice(provider.length + 1) : key)

async function findEvent(payload: Payload, tx: PaymentTx, key: string): Promise<EventDoc | null> {
  const { docs } = await payload.find({
    collection: 'payment-events', where: { eventKey: { equals: key } }, limit: 1, depth: 0,
    overrideAccess: true, req: tx.req, select: { status: true },
  })
  return (docs[0] as EventDoc | undefined) ?? null
}

export function createPaymentEventStore(payload: Payload) {
  const findCommitted = async (key: string) => {
    const { docs } = await payload.find({ collection: 'payment-events', where: { eventKey: { equals: key } }, limit: 1, depth: 0, overrideAccess: true, select: { status: true } })
    return (docs[0] as EventDoc | undefined) ?? null
  }
  return {
    async record(event: PaymentEventInput): Promise<boolean> {
      return withPaymentTransaction(payload, async (tx) => {
        const existing = await findEvent(payload, tx, event.key)
        if (existing) return existing.status === 'received' || existing.status === 'error'
        await payload.create({
          collection: 'payment-events', overrideAccess: true, req: tx.req, depth: 0,
          data: {
            provider: event.provider,
            eventId: eventIdOf(event.key, event.provider),
            eventKey: event.key,
            type: event.type,
            bodySha256: event.bodySha256,
            receivedAt: event.receivedAt.toISOString(),
            signatureVerified: event.signatureVerified ?? true,
            status: 'received',
            ...(event.orderId !== undefined && event.orderId !== null ? { order: Number(event.orderId) } : {}),
          },
        })
        return true
      }, { confirm: async () => (await findCommitted(event.key)) !== null })
    },

    /** Final processing status of an event (after the order work committed or failed). */
    async mark(key: string, status: 'processed' | 'ignored' | 'error', extra: { orderId?: number | string | null; failureCode?: string } = {}): Promise<void> {
      await withPaymentTransaction(payload, async (tx) => {
        const existing = await findEvent(payload, tx, key)
        if (!existing) return false
        if (existing.status === 'processed' || existing.status === 'ignored') return true
        await payload.update({
          collection: 'payment-events', id: existing.id, overrideAccess: true, req: tx.req, depth: 0,
          data: {
            status,
            processedAt: new Date().toISOString(),
            ...(extra.orderId !== undefined && extra.orderId !== null ? { order: Number(extra.orderId) } : {}),
            ...(extra.failureCode ? { failureCode: extra.failureCode.slice(0, 64) } : {}),
          },
        })
        return true
      }, { confirm: async (existed) => {
        const committed = await findCommitted(key)
        return !existed || (committed !== null && (committed.status === status || committed.status === 'processed' || committed.status === 'ignored'))
      } })
    },
  } satisfies PaymentEventStore & Record<string, unknown>
}
