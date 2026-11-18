import { randomUUID } from 'node:crypto'
import { sql } from '@payloadcms/db-sqlite'
import { after } from 'next/server'
import { AuthenticationError, LockedAuth, type Payload } from 'payload'

import { requestIP } from '@/lib/forms/security'
import { withPaymentTransaction, type PaymentTx } from '@/lib/payments/store/transaction'
import type { ProviderId } from '@/lib/payments/types'
import { ipPrivacy } from '../crypto/ip'
import type { SecurityEventType } from '../constants'

const HOUR_MS = 3_600_000
const NETWORK_HISTORY_MS = 7 * 24 * HOUR_MS
const MAX_PENDING = 64
const MAX_QUEUE_MS = 5_000
/** Distinct network rows per type and hour before further networks fold into one overflow row. */
const MAX_PREFIX_ROWS = 20

type AuthCollection = 'users' | 'customers'
type EventIP = ReturnType<typeof ipPrivacy>
type Subject = { id: number; collection: AuthCollection }
type Account = { id: number; lock_until: string | null }

const authEvents = {
  users: { source: 'admin', login: 'auth.admin_login_failed', locked: 'auth.admin_locked' },
  customers: { source: 'portal', login: 'auth.portal_login_failed', locked: 'auth.portal_locked' },
} as const

type Event = {
  type: SecurityEventType
  source: 'admin' | 'portal' | 'webhook'
  severity: 'info' | 'low' | 'medium' | 'high'
  subject?: Subject
  ip: EventIP
  at: string
  key: string
  detail: { outcome: 'success' | 'failure' | 'locked' } | { provider: ProviderId }
  alert?: boolean
  coalesce?: 'key' | 'prefix'
}

const writers = new WeakMap<Payload, { pending: number; tail: Promise<void> }>()

/** At most one short telemetry transaction can contend with normal writes per Payload instance. */
function defer(payload: Payload, work: (tx: PaymentTx) => Promise<void>) {
  let writer = writers.get(payload)
  if (!writer) {
    writer = { pending: 0, tail: Promise.resolve() }
    writers.set(payload, writer)
  }
  if (writer.pending >= MAX_PENDING) return
  writer.pending++
  const queue = writer
  const run = () => {
    const deadline = performance.now() + MAX_QUEUE_MS
    const job = queue.tail.then(async () => {
      if (performance.now() >= deadline) return
      await withPaymentTransaction(payload, async (tx) => {
        if (performance.now() < deadline) await work(tx)
      })
    }).catch(() => {
      // Adapter errors can include SQL parameters. Never log them.
    }).finally(() => { queue.pending-- })
    queue.tail = job
    return job
  }
  try {
    after(run)
  } catch {
    // Direct invocations outside Next still run asynchronously.
    setImmediate(() => { void run() })
  }
}

function capture(
  payload: Payload,
  headers: Pick<Headers, 'get'>,
  now: Date,
  work: (tx: PaymentTx, ip: EventIP, at: string) => Promise<void>,
) {
  try {
    const ip = ipPrivacy(requestIP(headers), process.env, now)
    const at = now.toISOString()
    defer(payload, (tx) => work(tx, ip, at))
  } catch {
    // Observation setup must leave authentication and webhook responses alone.
  }
}

async function persist(tx: PaymentTx, event: Event) {
  const { subject, at } = event
  let { ip } = event
  // Match the prefix inside the write transaction, keeping it out of the dedupe key so retention can erase it.
  let key = event.key
  if (event.coalesce === 'prefix') {
    // Unauthenticated sources choose their own network. Bound the rows they can create per hour, since open high events are never purged.
    const known = await tx.all<{ dedupe_key: string; ip_prefix: string | null }>(sql`SELECT dedupe_key, ip_prefix FROM security_events
      WHERE dedupe_key GLOB ${`${event.key}|*`} LIMIT ${MAX_PREFIX_ROWS + 1}`)
    const match = known.find((row) => row.ip_prefix === (ip?.prefix ?? null))
    if (match) key = match.dedupe_key
    else if (known.length >= MAX_PREFIX_ROWS) {
      key = `${event.key}|overflow`
      ip = null
    } else key = `${event.key}|${randomUUID()}`
  }
  const detail = JSON.stringify({ ...event.detail, ...(event.alert ? { notifyAdminWant: 'high' } : {}) })
  await tx.run(sql`INSERT INTO security_events
    (type, source, severity, actor_user_id, customer_id, ip_prefix, ip_hash, first_seen_at, last_seen_at,
     dedupe_key, detail, notify_state, created_at, updated_at)
    VALUES (${event.type}, ${event.source}, ${event.severity}, ${subject?.collection === 'users' ? subject.id : null},
      ${subject?.collection === 'customers' ? subject.id : null}, ${ip?.prefix ?? null}, ${ip?.hash ?? null}, ${at},
      ${at}, ${key}, ${detail}, ${event.alert ? 'pending' : null}, ${at}, ${at})
    ON CONFLICT (dedupe_key) ${event.coalesce ? sql`DO UPDATE SET count = count + 1,
      first_seen_at = MIN(first_seen_at, excluded.first_seen_at), last_seen_at = MAX(last_seen_at, excluded.last_seen_at),
      updated_at = MAX(updated_at, excluded.updated_at)` : sql`DO NOTHING`}`)
}

export function observeLoginFailure(
  payload: Payload, collection: AuthCollection, headers: Pick<Headers, 'get'>, email: unknown, error: unknown,
) {
  if (!(error instanceof AuthenticationError || error instanceof LockedAuth)) return
  // The address is used only as an in-memory lookup parameter for Payload's account and lock state.
  const identity = typeof email === 'string' && email.length <= 320 ? email.trim().toLowerCase() : ''
  const { source, login, locked } = authEvents[collection]
  capture(payload, headers, new Date(), async (tx, ip, at) => {
    const table = collection === 'users' ? sql`users` : sql`customers`
    const [account] = identity ? await tx.all<Account>(sql`SELECT id, lock_until FROM ${table} WHERE email = ${identity} LIMIT 1`) : []
    const subject = account ? { id: Number(account.id), collection } : undefined
    const scope = `l8|${login}`
    await persist(tx, {
      type: login, source, subject, ip, at, detail: { outcome: 'failure' },
      severity: collection === 'users' ? 'medium' : 'low',
      key: `${scope}|${subject ? `account:${subject.id}` : 'prefix'}|${at.slice(0, 13)}`,
      coalesce: subject ? 'key' : 'prefix',
    })
    // The threshold-crossing request can throw AuthenticationError. Read Payload's actual lock state in both cases.
    const lockTime = payload.collections[collection].config.auth.lockTime
    const lockEnd = Date.parse(account?.lock_until ?? '')
    const attemptAt = Date.parse(at)
    if (subject && attemptAt >= lockEnd - lockTime && attemptAt < lockEnd) {
      await persist(tx, {
        type: locked, source, subject, ip, at, detail: { outcome: 'locked' },
        severity: collection === 'users' ? 'high' : 'medium',
        key: `l8|${locked}|${subject.id}|${lockEnd}`,
      })
    }
  })
}

export function observeLoginSuccess(
  payload: Payload, collection: AuthCollection, headers: Pick<Headers, 'get'>, id: number, admin = false,
) {
  const { source, login } = authEvents[collection]
  capture(payload, headers, new Date(), async (tx, ip, at) => {
    let newNetwork = false
    if (admin && collection === 'users' && ip) {
      const since = new Date(Date.parse(at) - NETWORK_HISTORY_MS).toISOString()
      const [known] = await tx.all<{ id: number }>(sql`SELECT id FROM security_events
        WHERE actor_user_id = ${id} AND type IN ('auth.admin_login_failed', 'auth.admin_new_network')
          AND last_seen_at >= ${since}
          AND (ip_prefix = ${ip.prefix} OR (last_seen_at >= ${at.slice(0, 7)} AND ip_hash = ${ip.hash}))
          AND json_extract(CASE WHEN json_valid(detail) THEN detail ELSE '{}' END, '$.outcome') = 'success' LIMIT 1`)
      newNetwork = !known
    }
    // The persisted catalog has no success types. The login family and outcome together identify the event.
    await persist(tx, {
      type: newNetwork ? 'auth.admin_new_network' : login, source, subject: { id, collection }, ip, at,
      detail: { outcome: 'success' }, severity: newNetwork ? 'high' : 'info', alert: newNetwork,
      key: `l8|login|${randomUUID()}`,
    })
  })
}

export function observeWebhookSignatureRejection(
  payload: Payload, provider: ProviderId, headers: Pick<Headers, 'get'>, now: Date,
) {
  capture(payload, headers, now, (tx, ip, at) => persist(tx, {
    type: 'webhook.bad_signature', source: 'webhook', severity: 'high', detail: { provider }, ip, at,
    key: `l8|webhook.bad_signature|${provider}|${at.slice(0, 13)}`, coalesce: 'prefix',
  }))
}
