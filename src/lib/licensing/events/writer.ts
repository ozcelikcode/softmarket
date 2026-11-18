import { sql } from '@payloadcms/db-sqlite'
import type { Payload } from 'payload'
import { after } from 'next/server'

import { withPaymentTransaction, type PaymentTx } from '@/lib/payments/store/transaction'

const severities = {
  'activation.created': 'info', 'activation.rebind': 'info', 'activation.ended': 'info',
  'activation.seat_limit': 'low', 'activation.burst': 'medium', 'activation.clone_suspected': 'low',
  'api.invalid_license': 'low', 'api.bad_signature': 'medium', 'api.replay': 'high',
  'api.clock_skew': 'info', 'api.rate_limited': 'low', 'api.blocked_request': 'info',
  'system.events_dropped': 'high',
} as const

type EventType = keyof typeof severities
type Severity = typeof severities[EventType] | 'critical'
const severityOrder: Severity[] = ['info', 'low', 'medium', 'high', 'critical']
export type Observation = {
  type: EventType
  severity?: Severity
  now: Date
  license?: number
  customer?: number
  activation?: number
  ip?: { prefix: string; hash: string | null } | null
  action?: 'throttled' | 'blocked'
}
type Aggregate = Observation & { key: string; first: string; last: string; count: number; rank: number }
type Seen = {
  id: number; at: string; ip: Observation['ip']; country: string | null; version: string | null; intervalMs: number
}

const FLUSH_MS = 10_000
const CAPACITY = 500

function aggregate(event: Observation): Aggregate {
  const at = event.now.toISOString()
  const subject = event.activation ? `activation/${event.activation}`
    : event.license ? `license/${event.license}` : event.ip?.prefix ?? 'unknown'
  const scope = event.severity === 'critical' ? 'global' : subject
  const key = `${event.type}|${scope}|${at.slice(0, 13)}`
  return { ...event, key, first: at, last: at, count: 1, rank: severityOrder.indexOf(event.severity ?? severities[event.type]) }
}

async function persist(tx: PaymentTx, event: Aggregate) {
  const ranks = sql`CASE severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END`
  await tx.run(sql`INSERT INTO security_events
      (type, severity, source, first_seen_at, last_seen_at, count, dedupe_key, license_id, customer_id, activation_id,
       ip_prefix, ip_hash, action_taken)
    VALUES (${event.type}, ${severityOrder[event.rank]}, ${event.type.startsWith('system.') ? 'system' : 'api'},
      ${event.first}, ${event.last}, ${event.count}, ${event.key}, ${event.license ?? null}, ${event.customer ?? null},
      ${event.activation ?? null}, ${event.ip?.prefix ?? null}, ${event.ip?.hash ?? null}, ${event.action ?? 'none'})
    ON CONFLICT (dedupe_key) DO UPDATE SET count = count + excluded.count,
      first_seen_at = MIN(first_seen_at, excluded.first_seen_at), last_seen_at = MAX(last_seen_at, excluded.last_seen_at),
      severity = CASE WHEN ${event.rank} > (${ranks}) THEN excluded.severity ELSE severity END,
      action_taken = CASE WHEN excluded.action_taken IN ('blocked', 'throttled') THEN excluded.action_taken ELSE action_taken END,
      updated_at = MAX(last_seen_at, excluded.last_seen_at)`)
}

/** One short coalesced write pass for observations. A failed pass is counted and never affects licensing decisions. */
export function createObservationWriter(payload: Payload) {
  const events = new Map<string, Aggregate>()
  const seen = new Map<number, Seen>()
  const urgent = new Map<string, number>()
  let dropped = 0
  let scheduled: { timer: ReturnType<typeof setTimeout>; finish: () => void } | undefined
  let nextUrgentCleanup = 0
  let pending: Promise<void> | undefined

  function schedule() {
    if (scheduled) return
    let finish!: () => void
    const completion = new Promise<void>((resolve) => { finish = resolve })
    scheduled = { timer: setTimeout(() => { void flush() }, FLUSH_MS).unref(), finish }
    try {
      // Next's graceful close waits for after() work. Only one wait is registered per batch.
      after(() => completion)
    } catch {
      // Direct route invocations and CLI work have no Next request context.
    }
  }

  function flush(): Promise<void> {
    if (pending) return pending.then(flush)
    const waiting = scheduled
    clearTimeout(waiting?.timer)
    scheduled = undefined
    const batch = [...events.values()]
    const touches = [...seen.values()]
    events.clear()
    seen.clear()
    if (dropped) batch.push({ ...aggregate({ type: 'system.events_dropped', now: new Date() }), count: dropped })
    dropped = 0
    if (!batch.length && !touches.length) {
      waiting?.finish()
      return Promise.resolve()
    }
    pending = withPaymentTransaction(payload, async (tx) => {
      for (const event of batch) await persist(tx, event)
      for (const { id, at, intervalMs, ip, country, version } of touches) {
        const cutoff = new Date(Date.parse(at) - intervalMs).toISOString()
        await tx.run(sql`UPDATE license_activations
          SET last_seen_at = ${at}, last_ip_prefix = ${ip?.prefix ?? null}, last_ip_hash = ${ip?.hash ?? null},
              last_country = ${country}, app_version = ${version}, updated_at = MAX(updated_at, ${at})
          WHERE id = ${id} AND status = 'active' AND (last_seen_at IS NULL OR last_seen_at <= ${cutoff})`)
      }
    }).catch(() => {
      dropped += batch.reduce((sum, event) => sum + event.count, touches.length)
      payload.logger.warn('licensing: observation flush failed')
    }).finally(() => {
      pending = undefined
      waiting?.finish()
      if (events.size || seen.size) schedule()
    })
    return pending
  }

  function emit(input: Observation) {
    const event = aggregate(input)
    const prior = events.get(event.key)
    if (prior) {
      prior.count++
      prior.first = prior.first < event.first ? prior.first : event.first
      prior.last = prior.last > event.last ? prior.last : event.last
      prior.rank = Math.max(prior.rank, event.rank)
      prior.action = event.action ?? prior.action
    } else if (events.size >= CAPACITY) dropped++
    else events.set(event.key, event)
    schedule()
    // Flush the first high-severity observation per key promptly. Repeats stay aggregated.
    const at = input.now.getTime()
    if (at >= nextUrgentCleanup) {
      for (const [key, until] of urgent) if (until <= at) urgent.delete(key)
      nextUrgentCleanup = at + 1000
    }
    if (event.rank >= 3 && !urgent.has(event.key) && urgent.size < CAPACITY && events.has(event.key)) {
      urgent.set(event.key, at + 3_600_000)
      if (!pending) void flush()
    } else if (events.size >= 200 && !pending) void flush()
  }

  function touch(input: Seen) {
    const previous = seen.get(input.id)
    if (!previous && seen.size >= CAPACITY) dropped++
    else if (!previous || previous.at < input.at) seen.set(input.id, input)
    schedule()
  }

  return { emit, touch, flush }
}
