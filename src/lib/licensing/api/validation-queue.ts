import { sql } from '@payloadcms/db-sqlite'
import { AsyncLocalStorage } from 'node:async_hooks'
import type { Payload } from 'payload'

import { withPaymentTransaction, type PaymentTx } from '@/lib/payments/store/transaction'
import { confirmedNonces, type NonceReceipt } from './nonce'
import { failure, type Result } from './respond'

type Job = {
  work: (tx: PaymentTx, confirm: (nonce: NonceReceipt) => void) => Promise<Result>
  runInRequest: ReturnType<typeof AsyncLocalStorage.snapshot>
  resolve: (result: Result) => void
  reject: (error: unknown) => void
}
type Queue = { queued: Job[]; draining: boolean }
const shared = globalThis as typeof globalThis & { smLicensingValidations?: WeakMap<Payload, Queue> }
const queues = shared.smLicensingValidations ??= new WeakMap<Payload, Queue>()
const COMMIT_SIZE = 16

/** Start immediately. Take only work that is already waiting when the serializer grants the write lock. */
export function enqueueValidation(payload: Payload, work: Job['work']): Promise<Result> {
  let queue = queues.get(payload)
  if (!queue) {
    queue = { queued: [], draining: false }
    queues.set(payload, queue)
  }
  if (queue.queued.length >= 512) return Promise.resolve(failure('unavailable', new Date(), { retryAfter: 1 }))
  const active = queue
  return new Promise((resolve, reject) => {
    active.queued.push({ work, resolve, reject, runInRequest: AsyncLocalStorage.snapshot() })
    if (!active.draining) void drain(payload, active)
  })
}

async function drain(payload: Payload, queue: Queue) {
  queue.draining = true
  try {
    while (queue.queued.length) {
      let batch: Job[] = []
      const receipts: NonceReceipt[] = []
      try {
        const results = await withPaymentTransaction(payload, async (tx) => {
          batch = queue.queued.splice(0, COMMIT_SIZE)
          const results: PromiseSettledResult<Result>[] = []
          for (const job of batch) {
            // Isolate request-specific failures while retaining one durable group commit.
            const effects: Parameters<PaymentTx['afterCommit']>[0][] = []
            const jobReceipts: NonceReceipt[] = []
            await tx.run(sql`SAVEPOINT license_validation`)
            try {
              const value = await job.work({ ...tx, afterCommit: (effect) => { effects.push(effect) } },
                (receipt) => { jobReceipts.push(receipt) })
              await tx.run(sql`RELEASE SAVEPOINT license_validation`)
              for (const effect of effects) tx.afterCommit(() => job.runInRequest(effect))
              receipts.push(...jobReceipts)
              results.push({ status: 'fulfilled', value })
            } catch (reason) {
              await tx.run(sql`ROLLBACK TO SAVEPOINT license_validation`)
              await tx.run(sql`RELEASE SAVEPOINT license_validation`)
              results.push({ status: 'rejected', reason })
            }
          }
          return results
        }, { confirm: () => confirmedNonces(payload, receipts) })
        for (const [index, job] of batch.entries()) {
          const result = results[index]!
          if (result.status === 'fulfilled') job.resolve(result.value)
          else job.reject(result.reason)
        }
      } catch (error) {
        for (const job of batch.length ? batch : queue.queued.splice(0, COMMIT_SIZE)) job.reject(error)
      }
    }
  } finally {
    queue.draining = false
  }
}
