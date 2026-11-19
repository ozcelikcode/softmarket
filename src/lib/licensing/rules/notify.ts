import { sql } from '@payloadcms/db-sqlite'
import type { Payload } from 'payload'

import { isEmailConfigured } from '@/lib/email/adapter'
import {
  adminAlertRecipients,
  sendCustomerLicenseNotice,
  sendDeviceReleasedNotice,
  sendLicensingAdminAlert,
  sendLicensingDigest,
  type AlertRow,
  type DigestSummary,
} from '@/lib/email/licensing'
import { maskLicenseKey } from '@/lib/licenses/state'
import { withPaymentTransaction } from '@/lib/payments/store/transaction'
import { SECURITY_SEVERITIES } from '../constants'
import { severityRank, type SweepSettings } from './settings'

/*
 * Durable licensing notification queue (plan §7), the P4 `orders.notifications` lease pattern on the existing
 * `security-events` columns (no schema change):
 *   notify_state      NULL = not queued, `pending`, `sent`, `failed` (attempt budget spent), `skipped` (not to send / too old)
 *   notify_next_at    lease while a sender holds the row, otherwise the backoff deadline
 *   notify_attempts   failed delivery attempts (budget NOTIFY_POLICY.maxAttempts = 5)
 *   notify_last_error short code only
 *   detail.notify*    per-message "sent" markers, so a re-run sends only what is still missing:
 *                     notifyAdminWant / notifyAdminDone (admin alert level: notified|suspended|<severity>|critical),
 *                     notifyDigestDone, notifyCustomerSuspendedAt, notifyCustomerRestoredAt (ISO time or `skipped`),
 *                     restoredAt (set by restore.ts)
 *
 * Delivery: (1) one conditional UPDATE … RETURNING claims up to `limit` due rows by moving notify_next_at to a lease
 * (a concurrent sweep claims different rows or none); (2) the claimed rows' admin alerts go out as ONE message, digests
 * and customer messages one by one; each success writes its marker immediately; (3) each row is released with its
 * lease as guard: done -> `sent`; transport error -> attempts+1, exponential backoff 15/30/60/120 min, `failed` at the
 * budget; no alert recipient -> stays pending (not counted). No SMTP -> nothing is claimed (not counted); a row still
 * pending 7 days after its last change is `skipped`. Guarantee: at least once; a duplicate is possible only when the
 * process dies between a send and its marker (or a lease expires mid-send). Logs: event ids and kinds only.
 */

export const NOTIFY_POLICY = {
  maxAttempts: 5,
  leaseMs: 5 * 60_000,
  backoffMs: 15 * 60_000,
  maxAgeMs: 7 * 24 * 3_600_000,
  batch: 50,
} as const

export type NotifyKind = 'admin' | 'digest' | 'customerSuspended' | 'customerRestored' | 'customerDeviceReleased'

export type QueueRow = {
  id: number
  type: string
  severity: string
  count: number
  license_id: number | null
  customer_id: number | null
  activation_id: number | null
  action_taken: string | null
  rule_key: string | null
  detail: string | null
  notify_attempts: number | null
}

export type NotifyReport = {
  smtp: boolean
  expired: number
  claimed: number
  sent: Record<NotifyKind, number>
  failed: number
  deferred: number
}

type Log = { info(msg: string): void; warn(msg: string): void; error(msg: string): void }

export const parseDetail = (raw: unknown): Record<string, unknown> => {
  if (typeof raw !== 'string') return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
  try {
    const value = JSON.parse(raw) as unknown
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

const isTime = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value))

/** Messages a queued event still needs (pure). */
export function pendingMessages(
  row: Pick<QueueRow, 'type' | 'action_taken' | 'customer_id' | 'detail'>,
  settings: Pick<SweepSettings, 'customerSuspensionEmail'>,
): NotifyKind[] {
  const d = parseDetail(row.detail)
  if (row.type === 'system.daily_digest') return d.notifyDigestDone ? [] : ['digest']
  const kinds: NotifyKind[] = []
  if (typeof d.notifyAdminWant === 'string' && d.notifyAdminWant !== d.notifyAdminDone) kinds.push('admin')
  if (row.action_taken === 'suspended' && settings.customerSuspensionEmail && row.customer_id !== null
    && !d.restoredAt && !d.notifyCustomerSuspendedAt) kinds.push('customerSuspended')
  if (d.restoredAt && isTime(d.notifyCustomerSuspendedAt) && !d.notifyCustomerRestoredAt) kinds.push('customerRestored')
  // Portal release confirmations are independent of the customer suspension e-mail setting.
  if (row.type === 'activation.ended' && d.notifyDeviceReleased === true && row.customer_id !== null
    && !d.notifyCustomerDeviceReleasedAt) kinds.push('customerDeviceReleased')
  return kinds
}

/** Queue admin alerts for events at or above `minSeverityImmediate` that nothing queued yet (L3/API events). */
export async function enqueueSeverityAlerts(payload: Payload, settings: SweepSettings, now: Date): Promise<number> {
  const rank = severityRank(settings.minSeverityImmediate)
  const minimum = rank >= 0 ? rank : severityRank('high')
  const levels = SECURITY_SEVERITIES.filter((_, i) => i >= minimum)
  if (!levels.length) return 0
  const since = new Date(now.getTime() - 24 * 3_600_000).toISOString()
  const at = now.toISOString()
  return withPaymentTransaction(payload, (tx) => tx.run(sql`UPDATE security_events
    SET notify_state = 'pending', notify_attempts = 0, notify_next_at = NULL,
        detail = json_set(CASE WHEN json_valid(detail) THEN detail ELSE '{}' END, '$.notifyAdminWant', severity), updated_at = ${at}
    WHERE notify_state IS NULL AND source <> 'rule' AND type <> 'system.daily_digest' AND triage = 'open'
      AND last_seen_at > ${since} AND severity IN (${sql.join(levels.map((l) => sql`${l}`), sql`, `)})`))
}

const ISTANBUL = 'Europe/Istanbul'
export const istanbulHour = (now: Date) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: ISTANBUL, hour: '2-digit', hourCycle: 'h23' }).format(now))
export const istanbulDate = (now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: ISTANBUL, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)

/** One digest row per local (Europe/Istanbul) day at `digestHour`; idempotent through its dedupe key. */
export async function enqueueDigest(payload: Payload, settings: SweepSettings, now: Date): Promise<boolean> {
  if (!settings.dailyDigest || istanbulHour(now) !== settings.digestHour) return false
  const at = now.toISOString()
  const inserted = await withPaymentTransaction(payload, (tx) => tx.run(sql`INSERT INTO security_events
      (type, severity, source, first_seen_at, last_seen_at, count, dedupe_key, detail, action_taken, triage, notify_state,
       notify_attempts, updated_at, created_at)
    VALUES ('system.daily_digest', 'info', 'system', ${at}, ${at}, 1, ${`system.daily_digest|global|${istanbulDate(now)}`},
      '{}', 'none', 'resolved', 'pending', 0, ${at}, ${at})
    ON CONFLICT (dedupe_key) DO NOTHING`))
  return inserted === 1
}

async function digestSummary(payload: Payload, now: Date): Promise<DigestSummary> {
  const since = new Date(now.getTime() - 24 * 3_600_000).toISOString()
  const db = payload.db.drizzle
  const rows = await db.all<{ severity: string; n: number }>(sql`SELECT severity, count(*) AS n FROM security_events
    WHERE last_seen_at > ${since} AND type <> 'system.daily_digest' GROUP BY severity`)
  const [open] = await db.all<{ n: number }>(sql`SELECT count(*) AS n FROM security_events
    WHERE triage = 'open' AND severity IN ('high', 'critical')`)
  const [suspensions] = await db.all<{ n: number }>(sql`SELECT count(*) AS n FROM license_status_log
    WHERE source = 'rule' AND "to" = 'suspended' AND at > ${since}`)
  const circuit = await db.all(sql`SELECT 1 FROM security_events WHERE type = 'system.rule_circuit_open' AND triage = 'open'
    AND last_seen_at > ${since} LIMIT 1`)
  const bySeverity = Object.fromEntries(SECURITY_SEVERITIES.map((s) => [s, Number(rows.find((r) => r.severity === s)?.n ?? 0)]))
  return { since, bySeverity, openHigh: Number(open?.n ?? 0), ruleSuspensions: Number(suspensions?.n ?? 0), circuitOpen: circuit.length > 0 }
}

const MARKER: Record<Exclude<NotifyKind, 'admin'>, string> = {
  digest: '$.notifyDigestDone',
  customerSuspended: '$.notifyCustomerSuspendedAt',
  customerRestored: '$.notifyCustomerRestoredAt',
  customerDeviceReleased: '$.notifyCustomerDeviceReleasedAt',
}

async function mark(payload: Payload, id: number, path: string, value: string) {
  await withPaymentTransaction(payload, (tx) => tx.run(sql`UPDATE security_events
    SET detail = json_set(CASE WHEN json_valid(detail) THEN detail ELSE '{}' END, ${path}, ${value}) WHERE id = ${id}`))
}

type CustomerTarget = { to: string; locale: 'tr' | 'en'; product: string; maskedKey: string }

async function customerTarget(payload: Payload, license: number | null,
  release?: Pick<QueueRow, 'customer_id' | 'activation_id'>,
): Promise<(CustomerTarget & { deviceLabel: string | null }) | null> {
  if (license === null) return null
  const device = release ? sql`a.device_label` : sql`NULL`
  const ownership = release ? sql`JOIN license_activations a ON a.id = ${release.activation_id} AND a.license_id = l.id
    AND a.customer_id = c.id AND a.end_reason = 'customer_portal' AND c.id = ${release.customer_id}` : sql``
  const [row] = await payload.db.drizzle.all<{
    key: string | null; product_id: number | null; email: string | null; locale: string | null; device_label: string | null
  }>(sql`SELECT l.key, l.product_id, c.email, c.preferred_locale AS locale, ${device} AS device_label
    FROM licenses l JOIN customers c ON c.id = l.customer_id ${ownership} WHERE l.id = ${license}`)
  const to = row?.email?.trim()
  if (!to) return null
  const locale = row.locale === 'en' ? 'en' : 'tr'
  let product = '-'
  if (row.product_id !== null) {
    const doc = await payload.findByID({ collection: 'products', id: row.product_id, locale, depth: 0, overrideAccess: true, disableErrors: true, select: { title: true } })
    product = (doc as { title?: string } | null)?.title ?? '-'
  }
  return { to, locale, product, maskedKey: maskLicenseKey(row.key) || '-', deviceLabel: row.device_label }
}

export async function deliverLicensingNotifications(
  payload: Payload,
  settings: SweepSettings,
  options: { now: () => Date; origin: string; log: Log; limit?: number; env?: Record<string, string | undefined> },
): Promise<NotifyReport> {
  const { log } = options
  const report: NotifyReport = { smtp: false, expired: 0, claimed: 0, sent: { admin: 0, digest: 0, customerSuspended: 0, customerRestored: 0, customerDeviceReleased: 0 }, failed: 0, deferred: 0 }
  const start = options.now()
  const maxAge = new Date(start.getTime() - NOTIFY_POLICY.maxAgeMs).toISOString()
  report.expired = await withPaymentTransaction(payload, (tx) => tx.run(sql`UPDATE security_events
    SET notify_state = 'skipped', notify_next_at = NULL WHERE notify_state = 'pending' AND updated_at < ${maxAge}`))
  if (!(await isEmailConfigured(payload, options.env ?? process.env))) return report
  report.smtp = true

  const nowIso = start.toISOString()
  const lease = new Date(start.getTime() + NOTIFY_POLICY.leaseMs).toISOString()
  const rows = await withPaymentTransaction(payload, (tx) => tx.all<QueueRow>(sql`UPDATE security_events SET notify_next_at = ${lease}
    WHERE id IN (SELECT id FROM security_events
      WHERE notify_state = 'pending' AND (notify_next_at IS NULL OR notify_next_at <= ${nowIso})
        AND COALESCE(notify_attempts, 0) < ${NOTIFY_POLICY.maxAttempts}
      ORDER BY id LIMIT ${options.limit ?? NOTIFY_POLICY.batch})
    RETURNING id, type, severity, count, license_id, customer_id, activation_id, action_taken, rule_key, detail, notify_attempts`))
  report.claimed = rows.length
  if (!rows.length) return report

  const errors = new Map<number, string>()
  const deferred = new Set<number>()
  const kinds = new Map(rows.map((row) => [row.id, pendingMessages(row, settings)]))
  const recipients = await adminAlertRecipients(payload, settings.alertEmails, options.env)
  const publicIds = new Map<number, string>()
  const licenseIds = [...new Set(rows.map((r) => r.license_id).filter((id): id is number => id !== null))]
  if (licenseIds.length) {
    for (const l of await payload.db.drizzle.all<{ id: number; public_id: string | null }>(sql`SELECT id, public_id FROM licenses
      WHERE id IN (${sql.join(licenseIds.map((id) => sql`${id}`), sql`, `)})`)) if (l.public_id) publicIds.set(Number(l.id), l.public_id)
  }

  // Admin alerts: one message for all claimed rows.
  const alertRows = rows.filter((row) => kinds.get(row.id)!.includes('admin'))
  if (alertRows.length) {
    let outcome: string
    try {
      outcome = await sendLicensingAdminAlert(payload, recipients, alertRows.map((row): AlertRow => {
        const d = parseDetail(row.detail)
        return {
          id: Number(row.id), type: row.type, severity: row.severity, count: Number(row.count),
          outcome: typeof d.outcome === 'string' ? d.outcome : null, rule: row.rule_key,
          license: row.license_id !== null ? publicIds.get(Number(row.license_id)) ?? null : null,
        }
      }), { origin: options.origin })
    } catch {
      outcome = 'smtp_error'
    }
    if (outcome === 'sent') {
      try {
        await withPaymentTransaction(payload, async (tx) => {
          for (const row of alertRows) {
            await tx.run(sql`UPDATE security_events
              SET detail = json_set(CASE WHEN json_valid(detail) THEN detail ELSE '{}' END, '$.notifyAdminDone', ${String(parseDetail(row.detail).notifyAdminWant)})
              WHERE id = ${row.id}`)
          }
        })
        report.sent.admin += alertRows.length
        log.info(`licensing alert sent events=${alertRows.map((r) => r.id).join(',')}`)
      } catch {
        for (const row of alertRows) errors.set(row.id, 'mark_failed')
        log.error('licensing alert marker failed code=mark_failed')
      }
    } else if (outcome === 'not_configured') {
      for (const row of alertRows) deferred.add(row.id)
      log.warn('licensing alert not sent: SMTP or alert recipient unavailable')
    } else {
      for (const row of alertRows) errors.set(row.id, outcome)
      log.error(`licensing alert failed code=${outcome}`)
    }
  }

  for (const row of rows) {
    for (const kind of kinds.get(row.id)!) {
      if (kind === 'admin') continue
      let outcome: string
      try {
        if (kind === 'digest') {
          outcome = await sendLicensingDigest(payload, recipients, await digestSummary(payload, options.now()), { origin: options.origin })
        } else {
          const target = await customerTarget(payload, row.license_id, kind === 'customerDeviceReleased' ? row : undefined)
          if (!target) outcome = 'no_recipient'
          else if (kind === 'customerDeviceReleased') outcome = await sendDeviceReleasedNotice(payload, target, { origin: options.origin })
          else outcome = await sendCustomerLicenseNotice(payload, { kind: kind === 'customerSuspended' ? 'suspended' : 'restored', ...target }, { origin: options.origin })
        }
      } catch {
        outcome = 'smtp_error'
      }
      if (outcome === 'sent') {
        try {
          await mark(payload, row.id, MARKER[kind], options.now().toISOString())
          report.sent[kind]++
          log.info(`licensing notification sent event=${row.id} kind=${kind}`)
        } catch {
          if (!errors.has(row.id)) errors.set(row.id, 'mark_failed')
          log.error(`licensing notification marker failed event=${row.id} kind=${kind} code=mark_failed`)
        }
      } else if (outcome === 'no_recipient') {
        try {
          await mark(payload, row.id, MARKER[kind], 'skipped')
          log.warn(`licensing notification skipped event=${row.id} kind=${kind} code=no_recipient`)
        } catch {
          if (!errors.has(row.id)) errors.set(row.id, 'mark_failed')
          log.error(`licensing notification marker failed event=${row.id} kind=${kind} code=mark_failed`)
        }
      } else if (outcome === 'not_configured') {
        deferred.add(row.id)
      } else {
        if (!errors.has(row.id)) errors.set(row.id, outcome)
        log.error(`licensing notification failed event=${row.id} kind=${kind} code=${outcome}`)
      }
    }
  }

  // Release every claimed row with its lease as guard (a sender whose lease expired changes nothing).
  const end = options.now()
  await withPaymentTransaction(payload, async (tx) => {
    for (const row of rows) {
      const error = errors.get(row.id)
      if (error) {
        const attempts = Number(row.notify_attempts ?? 0) + 1
        const next = new Date(end.getTime() + NOTIFY_POLICY.backoffMs * 2 ** (attempts - 1)).toISOString()
        await tx.run(sql`UPDATE security_events SET notify_attempts = ${attempts}, notify_last_error = ${error.slice(0, 64)},
            notify_next_at = ${next}, notify_state = ${attempts >= NOTIFY_POLICY.maxAttempts ? 'failed' : 'pending'}
          WHERE id = ${row.id} AND notify_next_at = ${lease}`)
        report.failed++
      } else if (deferred.has(row.id)) {
        await tx.run(sql`UPDATE security_events SET notify_next_at = ${new Date(end.getTime() + NOTIFY_POLICY.backoffMs).toISOString()}
          WHERE id = ${row.id} AND notify_next_at = ${lease}`)
        report.deferred++
      } else {
        await tx.run(sql`UPDATE security_events SET notify_state = 'sent', notify_next_at = NULL, notify_last_error = NULL
          WHERE id = ${row.id} AND notify_next_at = ${lease}`)
      }
    }
  })
  return report
}
