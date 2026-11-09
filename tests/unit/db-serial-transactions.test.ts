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

  it('a failed BEGIN releases its turn; ending a rejected transaction id is harmless', async () => {
    const { db } = fakeDb({ failBegin: true })
    const failed = db.beginTransaction()
    await expect(failed).rejects.toThrow('SQLITE_BUSY')
    await expect(db.beginTransaction()).rejects.toThrow('SQLITE_BUSY')
  })
})
