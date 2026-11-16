import { createLocalReq, type Payload, type PayloadRequest } from 'payload'
import type { sql } from '@payloadcms/db-sqlite'

type SQL = ReturnType<typeof sql>

/*
 * One payment write = one SQLite transaction on ONE connection.
 *
 * `payload.db.beginTransaction()` goes through the V5 process-wide queue (src/lib/db-serial-transactions.ts) and
 * the adapter's `transactionOptions.behavior = 'immediate'`, so the dedicated libsql connection holds the write
 * lock (BEGIN IMMEDIATE) BEFORE the first read: no other writer of this or another process can change the order
 * between our read and our conditional write. Payload Local API calls get the same connection through
 * `req.transactionID`; raw conditional statements use the same session (`run`).
 *
 * - Any thrown error rolls the whole transaction back (licences included).
 * - A Payload operation that fails inside the transaction kills it (Payload's own killTransaction); the commit then
 *   refuses instead of silently committing nothing.
 * - Payload's adapter swallows COMMIT failures, so side effects run only after commit AND `confirm()` (an
 *   independent read outside the transaction) proves the result is durable.
 */

type Session = { db: { run(query: SQL): Promise<{ rowsAffected: number }> } }

export type PaymentTx = {
  req: PayloadRequest
  /** Raw statement on the transaction's connection; returns the affected row count. */
  run(query: SQL): Promise<number>
  /** Registers a side effect (e-mail, log, revalidation) that runs only after a confirmed commit. */
  afterCommit(effect: () => void | Promise<void>): void
}

export class PaymentTransactionError extends Error {
  constructor(readonly code: 'transactions_unavailable' | 'transaction_aborted' | 'commit_unconfirmed') {
    super(`payments:${code}`)
    this.name = 'PaymentTransactionError'
  }
}

export async function withPaymentTransaction<T>(
  payload: Payload,
  work: (tx: PaymentTx) => Promise<T>,
  options: { confirm?: (result: T) => Promise<boolean> } = {},
): Promise<T> {
  const req = await createLocalReq({}, payload)
  const id = await payload.db.beginTransaction()
  if (id === null || id === undefined) throw new PaymentTransactionError('transactions_unavailable')
  req.transactionID = id
  const sessions = (payload.db as unknown as { sessions: Record<string, Session | undefined> }).sessions
  const effects: (() => void | Promise<void>)[] = []
  let result: T
  try {
    result = await work({
      req,
      run: async (query) => {
        const session = sessions[String(id)]
        if (!session || req.transactionID !== id) throw new PaymentTransactionError('transaction_aborted')
        return (await session.db.run(query)).rowsAffected
      },
      afterCommit: (effect) => void effects.push(effect),
    })
    if (req.transactionID !== id || !sessions[String(id)]) throw new PaymentTransactionError('transaction_aborted')
    await payload.db.commitTransaction(id)
  } catch (error) {
    try {
      await payload.db.rollbackTransaction(id)
    } catch {
      // The original error is the one the caller needs.
    }
    throw error
  } finally {
    delete req.transactionID
  }
  if (options.confirm && !(await options.confirm(result))) throw new PaymentTransactionError('commit_unconfirmed')
  for (const effect of effects) {
    try {
      await effect()
    } catch {
      payload.logger.error('payments: post-commit side effect failed')
    }
  }
  return result
}
