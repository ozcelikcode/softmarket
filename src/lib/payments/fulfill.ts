import { scheduleOrderNotifications } from './notify'
import type { PaymentsDeps } from './runtime'
import { fulfillOrder, type FulfillResult } from './store/fulfillment'

/*
 * fulfilPaidOrder (plan §2.4): ONE SQLite transaction (BEGIN IMMEDIATE via the process-wide queue) issues exactly one
 * licence per item, links it, and moves paid → fulfilled. Idempotent: a second call (sequential, concurrent or from
 * another trigger) sees `fulfilled` and is a no-op. Order confirmation and licence e-mail go through the durable
 * notification queue (notify.ts), scheduled only after the commit was confirmed; reconcile retries undelivered ones.
 */

export class FulfillmentFailed extends Error {
  constructor(readonly reason: string) {
    super(`payments:fulfillment_failed ${reason}`)
    this.name = 'FulfillmentFailed'
  }
}

export async function fulfilPaidOrder(deps: PaymentsDeps, orderId: number | string): Promise<FulfillResult> {
  const result = await fulfillOrder(deps.payload, orderId, {
    afterCommit: () => scheduleOrderNotifications(deps, orderId),
  })
  // A conditional write lost (should not happen under the serial queue): rolled back, retry via provider/reconcile.
  if (result.kind === 'conflict') throw new FulfillmentFailed(result.reason)
  return result
}
