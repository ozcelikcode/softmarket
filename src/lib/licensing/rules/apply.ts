import { sql } from '@payloadcms/db-sqlite'
import { randomBytes } from 'node:crypto'
import type { Payload } from 'payload'

import { withPaymentTransaction } from '@/lib/payments/store/transaction'
import type { LicensingRuleKey } from '../constants'
import { LICENSE_TRANSITION_CONTEXT, type LicenseTransitionContext } from '../transitions'
import { decide, type Decision, type DecisionOutcome } from './decide'
import { RULE_META, type RuleResult } from './rules'
import type { SweepSettings } from './settings'

/*
 * Acting on one rule hit (one license, one rule) in ONE short BEGIN IMMEDIATE transaction (the shared serial writer
 * queue, src/lib/db-serial-transactions.ts). Everything the decision depends on is re-read inside that transaction,
 * so two sweeps running at the same time (or the same sweep twice) cannot double-suspend, double-record or exceed the
 * circuit breaker:
 *   - the license must still be `active` (a second sweep sees `suspended` and does nothing);
 *   - suppression, the per-hour suspension count and the breaker state are counted under the write lock;
 *   - the rule event is an EPISODE: an open/acknowledged event of the same rule and license seen within
 *     max(windowHours, 24 h) is extended instead of inserting a new one, so a persisting condition yields one event
 *     and one admin e-mail; a stronger outcome (notified -> suspended) re-arms the notification once.
 * The suspension itself goes through the Payload Local API with the transaction's `req`, so the L1 hooks stamp the
 * license and append exactly one `license-status-log` row (source `rule`, reason `rule_*`, ruleKey, event) in the same
 * transaction, and re-check suspend mode + elapsed observeUntil. If that guard refuses (409) the whole transaction
 * rolls back and the hit is recorded again without the suspension.
 */

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS
/** A tripped breaker stays open this long unless an admin triages its event (L6b) earlier. */
export const CIRCUIT_COOLDOWN_HOURS = 24

export type RuleHit = { license: number; rule: LicensingRuleKey; result: RuleResult }
export type ApplyResult = { license: number; rule: LicensingRuleKey; outcome: DecisionOutcome; event: number | null }

type Reader = { all<T>(query: ReturnType<typeof sql>): Promise<T[]> }

const ACTION_RANK = { none: 0, notified: 1, suspended: 2 } as const
type Action = keyof typeof ACTION_RANK

async function guardState(db: Reader, settings: SweepSettings, hit: RuleHit, now: Date) {
  const rule = settings.rules[hit.rule]
  const [license] = await db.all<{ status: string; customer_id: number | null; expires_at: string | null }>(
    sql`SELECT status, customer_id, expires_at FROM licenses WHERE id = ${hit.license}`,
  )
  const licenseActive = license?.status === 'active'
    && (!license.expires_at || Date.parse(license.expires_at) > now.getTime())
  const suppressSince = new Date(now.getTime() - rule.suppressDays * DAY_MS).toISOString()
  const suppressed = rule.suppressDays > 0 && (await db.all(sql`
    SELECT 1 FROM license_status_log WHERE license_id = ${hit.license} AND reason = 'restore' AND rule_key = ${hit.rule} AND at > ${suppressSince}
    UNION ALL
    SELECT 1 FROM security_events WHERE license_id = ${hit.license} AND source = 'rule' AND rule_key = ${hit.rule}
      AND triage = 'false_positive' AND triaged_at > ${suppressSince}
    LIMIT 1`)).length > 0
  const hourAgo = new Date(now.getTime() - HOUR_MS).toISOString()
  const [{ n }] = await db.all<{ n: number }>(sql`SELECT count(*) AS n FROM license_status_log
    WHERE source = 'rule' AND "to" = 'suspended' AND at > ${hourAgo}`) as [{ n: number }]
  const cooldown = new Date(now.getTime() - CIRCUIT_COOLDOWN_HOURS * HOUR_MS).toISOString()
  const circuitOpen = (await db.all(sql`SELECT 1 FROM security_events
    WHERE type = 'system.rule_circuit_open' AND triage = 'open' AND last_seen_at > ${cooldown} LIMIT 1`)).length > 0
  return {
    customer: license?.customer_id ?? null,
    decision: (allowSuspend: boolean): Decision => {
      const decision = decide({
        mode: rule.mode,
        licenseActive,
        suppressed,
        observeUntil: settings.observeUntil,
        now,
        circuitOpen,
        suspensionsLastHour: Number(n),
        maxAutoSuspendsPerHour: settings.maxAutoSuspendsPerHour,
      })
      return decision.suspend && !allowSuspend ? { ...decision, outcome: 'monitor_only', suspend: false } : decision
    },
  }
}

const detailOf = (raw: unknown): Record<string, unknown> => {
  if (typeof raw !== 'string') return {}
  try {
    const value = JSON.parse(raw) as unknown
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

/** Evaluates the decision without writing anything (`--dry-run`). */
export async function previewRuleHit(payload: Payload, settings: SweepSettings, hit: RuleHit, now: Date): Promise<ApplyResult> {
  const state = await guardState(payload.db.drizzle, settings, hit, now)
  return { license: hit.license, rule: hit.rule, outcome: state.decision(true).outcome, event: null }
}

export async function applyRuleHit(payload: Payload, settings: SweepSettings, hit: RuleHit, now: Date): Promise<ApplyResult> {
  try {
    return await applyOnce(payload, settings, hit, now, true)
  } catch (error) {
    // The L1 transition guard refused the automatic suspension (or the suspension write failed): record the hit
    // without suspending. A second failure propagates to the sweep report.
    if ((error as { status?: number }).status !== 409) throw error
    return applyOnce(payload, settings, hit, now, false)
  }
}

function applyOnce(payload: Payload, settings: SweepSettings, hit: RuleHit, now: Date, allowSuspend: boolean): Promise<ApplyResult> {
  const at = now.toISOString()
  const rule = settings.rules[hit.rule]
  const meta = RULE_META[hit.rule]
  return withPaymentTransaction(payload, async (tx) => {
    const state = await guardState(tx, settings, hit, now)
    const decision = state.decision(allowSuspend)
    if (!decision.record) return { license: hit.license, rule: hit.rule, outcome: decision.outcome, event: null }

    const action: Action = decision.suspend ? 'suspended' : decision.notifyAdmin ? 'notified' : 'none'
    const severity = decision.suspend ? 'high' : meta.severity
    const facts = {
      rule: hit.rule, metric: hit.result.metric, threshold: hit.result.threshold, windowHours: rule.windowHours,
      mode: rule.mode, outcome: decision.outcome,
    }
    const gapSince = new Date(now.getTime() - Math.max(rule.windowHours, 24) * HOUR_MS).toISOString()
    const [episode] = await tx.all<{ id: number; action_taken: string | null; detail: string | null }>(sql`
      SELECT id, action_taken, detail FROM security_events
      WHERE source = 'rule' AND rule_key = ${hit.rule} AND license_id = ${hit.license}
        AND triage IN ('open', 'acknowledged') AND last_seen_at > ${gapSince}
      ORDER BY id DESC LIMIT 1`)
    let eventId: number
    if (episode) {
      eventId = Number(episode.id)
      const previous = detailOf(episode.detail)
      const oldAction = (episode.action_taken ?? 'none') as Action
      const nextAction: Action = ACTION_RANK[action] > (ACTION_RANK[oldAction] ?? 0) ? action : oldAction
      const oldWant = typeof previous.notifyAdminWant === 'string' ? previous.notifyAdminWant as Action : 'none'
      const rearm = action !== 'none' && ACTION_RANK[action] > (ACTION_RANK[oldWant] ?? 0)
      const detail = JSON.stringify({ ...previous, ...facts, ...(rearm ? { notifyAdminWant: action } : {}) })
      await tx.run(sql`UPDATE security_events SET last_seen_at = MAX(last_seen_at, ${at}), detail = ${detail},
          action_taken = ${nextAction},
          severity = CASE WHEN ${severity} = 'high' AND severity IN ('info', 'low', 'medium') THEN 'high' ELSE severity END,
          notify_state = CASE WHEN ${rearm ? 1 : 0} = 1 THEN 'pending' ELSE notify_state END,
          notify_attempts = CASE WHEN ${rearm ? 1 : 0} = 1 THEN 0 ELSE notify_attempts END,
          notify_next_at = CASE WHEN ${rearm ? 1 : 0} = 1 THEN NULL ELSE notify_next_at END,
          notify_last_error = CASE WHEN ${rearm ? 1 : 0} = 1 THEN NULL ELSE notify_last_error END,
          updated_at = ${at}
        WHERE id = ${eventId}`)
    } else {
      const detail = JSON.stringify({ ...facts, ...(action !== 'none' ? { notifyAdminWant: action } : {}) })
      const [row] = await tx.all<{ id: number }>(sql`INSERT INTO security_events
          (type, severity, source, first_seen_at, last_seen_at, count, dedupe_key, license_id, customer_id, detail, rule_key,
           action_taken, triage, notify_state, notify_attempts, updated_at, created_at)
        VALUES (${meta.event}, ${severity}, 'rule', ${at}, ${at}, 1, ${`rule|${hit.rule}|license/${hit.license}|${at}|${randomBytes(4).toString('hex')}`},
          ${hit.license}, ${state.customer}, ${detail}, ${hit.rule}, ${action}, 'open',
          ${action !== 'none' ? 'pending' : 'skipped'}, 0, ${at}, ${at})
        RETURNING id`)
      eventId = Number(row!.id)
    }

    if (decision.trip) {
      const detail = JSON.stringify({ rule: hit.rule, limit: settings.maxAutoSuspendsPerHour, notifyAdminWant: 'critical' })
      await tx.run(sql`INSERT INTO security_events
          (type, severity, source, first_seen_at, last_seen_at, count, dedupe_key, detail, rule_key, action_taken, triage,
           notify_state, notify_attempts, updated_at, created_at)
        VALUES ('system.rule_circuit_open', 'critical', 'system', ${at}, ${at}, 1, ${`system.rule_circuit_open|global|${at.slice(0, 13)}`},
          ${detail}, ${hit.rule}, 'none', 'open', 'pending', 0, ${at}, ${at})
        ON CONFLICT (dedupe_key) DO UPDATE SET count = count + 1, last_seen_at = MAX(last_seen_at, excluded.last_seen_at),
          detail = excluded.detail, rule_key = excluded.rule_key, triage = 'open',
          triaged_by_id = NULL, triaged_at = NULL, triage_note = NULL,
          notify_state = 'pending', notify_attempts = 0, notify_next_at = NULL, notify_last_error = NULL,
          updated_at = excluded.updated_at`)
    }

    if (decision.suspend) {
      const context: LicenseTransitionContext = {
        source: 'rule', reason: meta.reason as LicenseTransitionContext['reason'], ruleKey: hit.rule, event: eventId,
        note: `${hit.rule}: metric ${hit.result.metric}, threshold ${hit.result.threshold}`.slice(0, 500),
      }
      await payload.update({
        collection: 'licenses', id: hit.license, req: tx.req, overrideAccess: true, depth: 0,
        data: { status: 'suspended' } as never,
        context: { [LICENSE_TRANSITION_CONTEXT]: context },
      })
    }
    return { license: hit.license, rule: hit.rule, outcome: decision.outcome, event: eventId }
  })
}
