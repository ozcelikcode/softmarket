import type { sqliteAdapter } from '@payloadcms/db-sqlite'

/*
 * SQLite allows one writer. With `transactionOptions.behavior = 'immediate'`, libsql opens every Payload
 * transaction on a fresh connection that has no busy timeout, so a second transaction started while another is open
 * in the same process fails at BEGIN with SQLITE_BUSY — and afterwards writes of this process could land on a
 * connection whose changes were not visible to later reads (lost update; reproduced in
 * tests/unit/visual-editor-db.test.ts). Payload transactions of this process are therefore queued: the next one
 * begins only after the previous commit/rollback. Concurrent writers then run one after the other, so a
 * read-compare-write inside a transaction (V5 `editorVersion` guard) is atomic and its loser gets a clean 409.
 *
 * A transaction that waits longer than `timeoutMs` fails like a busy database did before (no silent hang). Code
 * inside a transaction must pass `req` to nested Local API calls (as before: otherwise it would deadlock with
 * itself, previously it failed with SQLITE_BUSY).
 */
type Adapter = ReturnType<typeof sqliteAdapter>
type Id = number | string
type Tx = {
  beginTransaction: (options?: unknown) => Promise<Id | null>
  commitTransaction: (id: Id | Promise<Id | null>) => Promise<void>
  rollbackTransaction: (id: Id | Promise<Id | null>) => Promise<void>
}

export function serializeTransactions(db: Tx, { timeoutMs = 5000 } = {}): Tx {
  const begin = db.beginTransaction
  const commit = db.commitTransaction
  const rollback = db.rollbackTransaction
  let tail: Promise<void> = Promise.resolve()
  const held = new Map<Id, () => void>()

  db.beginTransaction = async function (this: Tx, options?: unknown) {
    let release!: () => void
    const turn = new Promise<void>((resolve) => { release = resolve })
    const previous = tail
    tail = previous.then(() => turn)
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        previous,
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Error: cannot begin transaction: write queue timeout')), timeoutMs) }),
      ])
    } catch (error) {
      release()
      throw error
    } finally {
      clearTimeout(timer)
    }
    try {
      const id = await begin.call(this, options)
      if (id === null || id === undefined) release()
      else held.set(id, release)
      return id
    } catch (error) {
      release()
      throw error
    }
  }
  const end = (original: Tx['commitTransaction']) => async function (this: Tx, incoming: Id | Promise<Id | null>) {
    const id = await Promise.resolve(incoming).catch(() => null)
    try {
      await original.call(this, incoming)
    } finally {
      if (id !== null && id !== undefined) {
        held.get(id)?.()
        held.delete(id)
      }
    }
  }
  db.commitTransaction = end(commit)
  db.rollbackTransaction = end(rollback)
  return db
}

/** Wrap the adapter factory so the initialised adapter queues its transactions. */
export function withSerialTransactions(adapter: Adapter, options?: { timeoutMs?: number }): Adapter {
  const init = adapter.init
  return { ...adapter, init: (args) => serializeTransactions(init(args) as unknown as Tx, options) as unknown as ReturnType<typeof init> }
}
