import { Server } from 'node:http'
import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDbQueryStats, installDbRequestLogging, instrumentSqliteClient, withDbQueryContext, withDbQueryLogging } from '../../src/lib/db-query-log'

afterEach(() => vi.unstubAllEnvs())
describe('SQLite query diagnostics', () => {
  it('leaves client methods and adapter identity untouched when disabled', () => {
    vi.stubEnv('SM_DB_QUERY_LOG', '0')
    const emit = Server.prototype.emit
    installDbRequestLogging()
    expect(Server.prototype.emit).toBe(emit)
    const client = { execute: vi.fn() }
    const execute = client.execute
    expect(instrumentSqliteClient(client)).toBe(client)
    expect(client.execute).toBe(execute)
    const adapter = { init: vi.fn() } as unknown as Parameters<typeof withDbQueryLogging>[0]
    expect(withDbQueryLogging(adapter)).toBe(adapter)
  })

  it('counts completed, failed, batched and transaction statements with elapsed time', async () => {
    vi.stubEnv('SM_DB_QUERY_LOG', '1')
    const transaction = { execute: vi.fn(async () => 'row'), commit: vi.fn(async () => {}) }
    const client = instrumentSqliteClient({
      execute: vi.fn(async (fail = false) => { if (fail) throw new Error('SQL failed'); return 'row' }),
      batch: vi.fn(async (_statements: string[]) => []),
      transaction: vi.fn(async () => transaction),
    })
    instrumentSqliteClient(client) // no double wrapping
    await withDbQueryContext(async () => {
      await client.execute()
      await expect(client.execute(true)).rejects.toThrow('SQL failed')
      await client.batch(['select 1', 'select 2'])
      const tx = await client.transaction()
      await tx.execute()
      await tx.commit()
      expect(getDbQueryStats()?.queries).toBe(7)
      expect(getDbQueryStats()?.durationMs).toBeGreaterThan(0)
    })
    expect(getDbQueryStats()).toBeUndefined()
  })

  it('wraps a client assigned by adapter connect before Drizzle captures it', async () => {
    vi.stubEnv('SM_DB_QUERY_LOG', '1')
    const db = { client: undefined as object | undefined }
    const adapter = { init: vi.fn(() => db) } as unknown as Parameters<typeof withDbQueryLogging>[0]
    const wrapped = withDbQueryLogging(adapter)
    expect(wrapped).not.toBe(adapter)
    wrapped.init({} as Parameters<typeof wrapped.init>[0])
    const client = { value: 42, execute: async function () { return this.value } }
    const original = client.execute
    db.client = client
    expect(client.execute).not.toBe(original)
    await withDbQueryContext(async () => {
      expect(await client.execute()).toBe(42)
      expect(getDbQueryStats()?.queries).toBe(1)
    })
  })

  it('keeps overlapping request contexts isolated', async () => {
    vi.stubEnv('SM_DB_QUERY_LOG', '1')
    const client = instrumentSqliteClient({ execute: async () => { await new Promise(resolve => setTimeout(resolve, 5)) } })
    const counts = await Promise.all([1, 3].map(count => withDbQueryContext(async () => {
      for (let i = 0; i < count; i++) await client.execute()
      return getDbQueryStats()?.queries
    })))
    expect(counts).toEqual([1, 3])
  })

  it('does not log paths, query values, or arbitrary correlation headers', () => {
    vi.stubEnv('SM_DB_QUERY_LOG', '1')
    const originalEmit = Server.prototype.emit
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      installDbRequestLogging()
      const server = new Server()
      const response = new EventEmitter()
      server.emit('request', { url: '/reset/secret-token?email=private', headers: { 'x-sm-perf-id': 'private@example.com' } } as never, response as never)
      response.emit('finish')
      expect(log).toHaveBeenCalledWith(expect.stringContaining('"id":null'))
      expect(log.mock.calls[0][0]).not.toMatch(/secret-token|private|email|path/)
    } finally {
      Server.prototype.emit = originalEmit
      log.mockRestore()
    }
  })
})
