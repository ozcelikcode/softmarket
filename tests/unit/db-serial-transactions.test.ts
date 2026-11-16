import { describe, expect, it } from 'vitest'

import { serializeTransactions } from '@/lib/db-serial-transactions'

/* One SQLite writer: Payload transactions of the process run one after the other (see the module comment). */

function fakeDb(opts: { failBegin?: boolean } = {}) {
  let next = 1
  const open = new Set<number>()
  const log: string[] = []
  const db = {
    beginTransaction: async () => {
      if (opts.failBegin) throw new Error('SQLITE_BUSY')
      if (open.size) throw new Error('overlap')
      const id = next++
      open.add(id)
      log.push(`begin ${id}`)
      return id
    },
    commitTransaction: async (id: number | string | Promise<number | string | null>) => { const t = await id as number; open.delete(t); log.push(`commit ${t}`) },
    rollbackTransaction: async (id: number | string | Promise<number | string | null>) => { const t = await id as number; open.delete(t); log.push(`rollback ${t}`) },
  }
  return { db: serializeTransactions(db, { timeoutMs: 200 }), log }
}

describe('serialised transactions', () => {
  it('concurrent end calls share cleanup and do not unlock before the physical commit finishes', async () => {
    let finish!: () => void
    let begins = 0
    const db = serializeTransactions({
      beginTransaction: async () => ++begins,
      commitTransaction: async () => { await new Promise<void>((r) => { finish = r }) },
      rollbackTransaction: async () => {},
    })
    const a = (await db.beginTransaction())!
    const commit = db.commitTransaction(a)
    await new Promise((r) => setTimeout(r, 10)) // commit reaches the adapter after a few microtask hops
    const duplicate = db.rollbackTransaction(a)
    const next = db.beginTransaction()
    await new Promise((r) => setTimeout(r, 10))
    expect(begins).toBe(1)
    finish()
    await Promise.all([commit, duplicate])
    await db.rollbackTransaction((await next)!)
    expect(begins).toBe(2)
  })

  it('a failed commit rolls back before releasing the next writer', async () => {
    const events: string[] = []
    const db = serializeTransactions({
      beginTransaction: async () => { events.push('begin'); return events.length },
      commitTransaction: async () => { throw new Error('disk failure') },
      rollbackTransaction: async () => { await new Promise((r) => setTimeout(r, 10)); events.push('rollback') },
    })
    const a = (await db.beginTransaction())!
    const committing = db.commitTransaction(a)
    const next = db.beginTransaction()
    await expect(committing).rejects.toThrow('disk failure')
    const b = (await next)!
    expect(events).toEqual(['begin', 'rollback', 'begin'])
    await db.rollbackTransaction(b)
  })

  it('a failed commit keeps its own error when cleanup fails too, and still releases the writer', async () => {
    let begins = 0
    const db = serializeTransactions({
      beginTransaction: async () => ++begins,
      commitTransaction: async () => { throw new Error('disk failure') },
      rollbackTransaction: async () => { throw new Error('cleanup failure') },
    }, { timeoutMs: 200 })
    await expect(db.commitTransaction((await db.beginTransaction())!)).rejects.toThrow('disk failure')
    expect(await db.beginTransaction()).toBe(2)
  })

  it('a duplicate end call waits for a failing commit without rejecting itself', async () => {
    let fail!: (error: Error) => void
    let begins = 0
    const db = serializeTransactions({
      beginTransaction: async () => ++begins,
      commitTransaction: () => new Promise<void>((_, reject) => { fail = reject }),
      rollbackTransaction: async () => {},
    }, { timeoutMs: 200 })
    const a = (await db.beginTransaction())!
    const commit = db.commitTransaction(a)
    await new Promise((r) => setTimeout(r, 10)) // commit reaches the adapter after a few microtask hops
    const duplicate = db.rollbackTransaction(a)
    fail(new Error('disk failure'))
    await expect(commit).rejects.toThrow('disk failure')
    await expect(duplicate).resolves.toBeUndefined()
    expect(await db.beginTransaction()).toBe(2)
  })

  it('a second transaction begins only after the first ends (commit or rollback)', async () => {
    const { db, log } = fakeDb()
    const a = await db.beginTransaction()
    const bPromise = db.beginTransaction()
    const cPromise = db.beginTransaction()
    await new Promise((r) => setTimeout(r, 20))
    expect(log).toEqual(['begin 1'])
    await db.rollbackTransaction(a!)
    const b = await bPromise
    await db.commitTransaction(Promise.resolve(b))
    await db.commitTransaction((await cPromise)!)
    expect(log).toEqual(['begin 1', 'rollback 1', 'begin 2', 'commit 2', 'begin 3', 'commit 3'])
  })

  it('times out instead of hanging and keeps the queue moving', async () => {
    const { db, log } = fakeDb()
    const a = await db.beginTransaction()
    await expect(db.beginTransaction()).rejects.toThrow(/cannot begin transaction/)
    await db.commitTransaction(a!)
    const c = await db.beginTransaction()
    await db.commitTransaction(c!)
    expect(log).toEqual(['begin 1', 'commit 1', 'begin 2', 'commit 2'])
  })

  it('many timed-out waiters never begin later; a new waiter still runs after the owner exits', async () => {
    const { db, log } = fakeDb()
    const owner = (await db.beginTransaction())!
    const waiting = await Promise.allSettled(Array.from({ length: 25 }, () => db.beginTransaction()))
    expect(waiting.every((result) => result.status === 'rejected')).toBe(true)
    expect(log).toEqual(['begin 1'])
    await db.rollbackTransaction(owner)
    await db.commitTransaction((await db.beginTransaction())!)
    expect(log).toEqual(['begin 1', 'rollback 1', 'begin 2', 'commit 2'])
  })

  it('a disabled/null transaction does not retain the writer slot', async () => {
    let count = 0
    const db = serializeTransactions({ beginTransaction: async () => { count++; return null }, commitTransaction: async () => {}, rollbackTransaction: async () => {} })
    expect(await Promise.all(Array.from({ length: 20 }, () => db.beginTransaction()))).toEqual(Array(20).fill(null))
    expect(count).toBe(20)
  })

  it('a failed BEGIN releases its turn; ending a rejected transaction id is harmless', async () => {
    const { db } = fakeDb({ failBegin: true })
    const failed = db.beginTransaction()
    await expect(failed).rejects.toThrow('SQLITE_BUSY')
    await expect(db.beginTransaction()).rejects.toThrow('SQLITE_BUSY')
  })
})
