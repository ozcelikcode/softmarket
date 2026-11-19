import { sql } from '@payloadcms/db-sqlite'
import type { Payload } from 'payload'

import { withPaymentTransaction } from '@/lib/payments/store/transaction'
import type { SweepSettings } from './settings'

/*
 * Retention cleanup (plan §6), run by the sweep once a night (or with `--retention`). Each step works in batches of
 * RETENTION_BATCH rows, every batch in its own short BEGIN IMMEDIATE transaction, so the API writer queue never waits
 * long. Durations come from licensing-settings and are already clamped to the code floors (settings.ts).
 *
 *   eventIp        security-events: ip_prefix, ip_hash, country -> NULL when last seen before eventIpDays
 *   events         security-events: rows last seen before eventDays (never a row whose notification is pending)
 *   activationIp   license-activations: last_ip_prefix, last_ip_hash, last_country -> NULL when an active device was
 *                  last seen (or an ended one ended) before activationIpDays
 *   activations    ended license-activations whose license ended (expiry, or revocation time) activationRowYears ago
 *   blocks         security-blocks expired or lifted before blockDays
 *   statusLog      license-status-log rows of licenses that ended statusLogYears ago
 *   audit          security-audit rows older than auditYears; client nonce receipts of read-only calls (validate,
 *                  updates, downloads/link) after one day, far beyond the signed-timestamp window (<= 900 s)
 * A license that never ends (perpetual, not revoked) keeps its activation rows and status history.
 */

export const RETENTION_BATCH = 1000
const MAX_BATCHES = 100
const DAY_MS = 86_400_000

export type RetentionReport = Record<'eventIp' | 'events' | 'activationIp' | 'activations' | 'blocks' | 'statusLog' | 'audit', number>

const daysAgo = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS).toISOString()
const yearsAgo = (now: Date, years: number) => {
  const d = new Date(now)
  const month = d.getUTCMonth()
  d.setUTCFullYear(d.getUTCFullYear() - years)
  // On Feb 29, JS overflows non-leap target years to Mar 1; clamp back to Feb 28 so we never under-retain.
  if (d.getUTCMonth() !== month) d.setUTCDate(0)
  return d.toISOString()
}

async function batched(payload: Payload, statement: () => ReturnType<typeof sql>): Promise<number> {
  let total = 0
  for (let i = 0; i < MAX_BATCHES; i++) {
    const n = await withPaymentTransaction(payload, (tx) => tx.run(statement()))
    total += n
    if (n < RETENTION_BATCH) break
  }
  return total
}

/** License end: expiry, or the time of a revocation. NULL = still running (kept). */
const licenseEnded = sql`(CASE WHEN l.status = 'revoked' THEN l.status_changed_at ELSE l.expires_at END)`

export async function runRetention(payload: Payload, settings: SweepSettings, now: Date): Promise<RetentionReport> {
  const r = settings.retention
  const eventIpCutoff = daysAgo(now, r.eventIpDays)
  const eventCutoff = daysAgo(now, r.eventDays)
  const activationIpCutoff = daysAgo(now, r.activationIpDays)
  const activationRowCutoff = yearsAgo(now, r.activationRowYears)
  const blockCutoff = daysAgo(now, r.blockDays)
  const statusLogCutoff = yearsAgo(now, r.statusLogYears)
  const auditCutoff = yearsAgo(now, r.auditYears)
  // Read-operation receipts only need to outlive the maximum signed timestamp span (2 x 900 seconds).
  const readReceiptCutoff = daysAgo(now, 1)
  const maxSuppressDays = Math.max(0, ...Object.values(settings.rules).map((rule) => rule.suppressDays))
  const suppressCutoff = daysAgo(now, maxSuppressDays)
  const limit = RETENTION_BATCH

  return {
    eventIp: await batched(payload, () => sql`UPDATE security_events SET ip_prefix = NULL, ip_hash = NULL, country = NULL
      WHERE id IN (SELECT id FROM security_events WHERE last_seen_at < ${eventIpCutoff}
        AND (ip_prefix IS NOT NULL OR ip_hash IS NOT NULL OR country IS NOT NULL) LIMIT ${limit})`),
    events: await batched(payload, () => sql`DELETE FROM security_events WHERE id IN (SELECT id FROM security_events
      WHERE last_seen_at < ${eventCutoff}
        AND COALESCE(notify_state, '') <> 'pending'
        AND NOT (triage IN ('open', 'acknowledged') AND severity IN ('high', 'critical'))
        AND NOT (triage = 'false_positive' AND triaged_at IS NOT NULL AND triaged_at >= ${suppressCutoff})
        AND NOT EXISTS (SELECT 1 FROM security_blocks b WHERE b.event_id = security_events.id)
      LIMIT ${limit})`),
    activationIp: await batched(payload, () => sql`UPDATE license_activations SET last_ip_prefix = NULL, last_ip_hash = NULL, last_country = NULL
      WHERE id IN (SELECT id FROM license_activations
        WHERE (last_ip_prefix IS NOT NULL OR last_ip_hash IS NOT NULL OR last_country IS NOT NULL)
          AND CASE WHEN status = 'active' THEN COALESCE(last_seen_at, activated_at)
                   ELSE COALESCE(ended_at, last_seen_at, activated_at) END < ${activationIpCutoff}
        LIMIT ${limit})`),
    activations: await batched(payload, () => sql`DELETE FROM license_activations WHERE id IN (
      SELECT a.id FROM license_activations a JOIN licenses l ON l.id = a.license_id
      WHERE a.status <> 'active' AND ${licenseEnded} IS NOT NULL AND ${licenseEnded} < ${activationRowCutoff}
        AND COALESCE(a.ended_at, a.last_seen_at, a.activated_at) < ${activationRowCutoff}
      LIMIT ${limit})`),
    blocks: await batched(payload, () => sql`DELETE FROM security_blocks WHERE id IN (SELECT id FROM security_blocks
      WHERE (lifted_at IS NOT NULL AND lifted_at < ${blockCutoff})
         OR (lifted_at IS NULL AND expires_at IS NOT NULL AND expires_at < ${blockCutoff})
      LIMIT ${limit})`),
    statusLog: await batched(payload, () => sql`DELETE FROM license_status_log WHERE id IN (
      SELECT s.id FROM license_status_log s JOIN licenses l ON l.id = s.license_id
      WHERE ${licenseEnded} IS NOT NULL AND ${licenseEnded} < ${statusLogCutoff} AND s.at < ${statusLogCutoff}
      LIMIT ${limit})`),
    audit: await batched(payload, () => sql`DELETE FROM security_audit WHERE id IN (SELECT id FROM security_audit
      WHERE at < ${readReceiptCutoff} AND (at < ${auditCutoff} OR (result = 'ok' AND nonce IS NOT NULL
        AND action IN ('api.validate', 'api.updates', 'api.downloads/link'))) LIMIT ${limit})`),
  }
}
