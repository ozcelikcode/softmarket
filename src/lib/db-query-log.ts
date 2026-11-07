import { AsyncLocalStorage } from 'node:async_hooks'
import { Server, type IncomingMessage, type ServerResponse } from 'node:http'
import type { sqliteAdapter } from '@payloadcms/db-sqlite'

type Stats = { queries: number; durationMs: number }
type State = { storage: AsyncLocalStorage<Stats>; installed: boolean; clients: WeakSet<object> }
// Next compiles instrumentation and page modules separately. Share their context.
const shared = globalThis as typeof globalThis & { __smDbQueryLog?: State }
function state(): State {
  return shared.__smDbQueryLog ??= { storage: new AsyncLocalStorage<Stats>(), installed: false, clients: new WeakSet() }
}

/** Read a snapshot during a server render, without reading headers/cookies. */
export function getDbQueryStats(): Stats | undefined {
  const stats = shared.__smDbQueryLog?.storage.getStore()
  return stats ? { ...stats } : undefined
}

export function withDbQueryContext<T>(callback: () => T): T {
  return state().storage.run({ queries: 0, durationMs: 0 }, callback)
}

// Mutate the client before Drizzle captures it; preserve native method receivers.
// Count SQL statements, including batches and transaction statements, not binds.
export function instrumentSqliteClient<T extends object>(client: T): T {
  if (process.env.SM_DB_QUERY_LOG !== '1') return client
  const current = state()
  if (current.clients.has(client)) return client
  current.clients.add(client)
  const target = client as Record<string, unknown>
  for (const method of ['execute', 'batch', 'migrate', 'transaction', 'commit', 'rollback']) {
    const original = target[method]
    if (typeof original !== 'function') continue
    target[method] = async (...args: unknown[]) => {
      const stats = current.storage.getStore()
      const start = performance.now()
      const count = method === 'batch' || method === 'migrate' ? (args[0] as unknown[]).length : 1
      if (stats) stats.queries += count
      try {
        const result = await original.apply(client, args)
        return method === 'transaction' ? instrumentSqliteClient(result) : result
      } finally {
        if (stats) stats.durationMs += performance.now() - start
      }
    }
  }
  return client
}

/** Only called by config when explicitly enabled; disabled adapter is untouched. */
export function withDbQueryLogging(adapter: ReturnType<typeof sqliteAdapter>): ReturnType<typeof sqliteAdapter> {
  if (process.env.SM_DB_QUERY_LOG !== '1') return adapter
  const init = adapter.init
  return { ...adapter, init: (args) => {
    const db = init(args)
    let client = db.client
    Object.defineProperty(db, 'client', {
      configurable: true,
      enumerable: true,
      get: () => client,
      set: (value: typeof client) => { client = instrumentSqliteClient(value) },
    })
    return db
  } }
}

/** Install once at Node startup, never in middleware (which cannot cover render). */
export function installDbRequestLogging(): void {
  if (process.env.SM_DB_QUERY_LOG !== '1' || state().installed) return
  state().installed = true
  const emit = Server.prototype.emit
  Server.prototype.emit = function (event: string, ...args: unknown[]): boolean {
    if (event !== 'request') return Reflect.apply(emit, this, [event, ...args])
    const [request, response] = args as [IncomingMessage, ServerResponse]
    return withDbQueryContext(() => {
      const stats = state().storage.getStore()!
      const id = request.headers['x-sm-perf-id']
      response.once('finish', () => {
        // Paths can contain tokens or personal data; accept only the benchmark's UUID correlation ID.
        console.log(`SM_DB_QUERY ${JSON.stringify({
          id: typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : null,
          queries: stats.queries,
          durationMs: Number(stats.durationMs.toFixed(3)),
        })}`)
      })
      return Reflect.apply(emit, this, [event, ...args])
    })
  }
}
