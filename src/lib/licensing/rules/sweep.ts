import { sql } from '@payloadcms/db-sqlite'
import type { Payload } from 'payload'

import { serverUrl } from '@/lib/server-url'
import { withPaymentTransaction } from '@/lib/payments/store/transaction'
import { LICENSING_RULE_KEYS } from '../constants'
import { applyRuleHit, previewRuleHit, type ApplyResult, type RuleHit } from './apply'
import type { DecisionOutcome } from './decide'
import { deliverLicensingNotifications, enqueueDigest, enqueueSeverityAlerts, istanbulHour, type NotifyReport } from './notify'
import { runRetention, type RetentionReport } from './retention'
import { RULE_META, evaluateRule, validConfig } from './rules'
import { loadSweepSettings, type SweepSettings } from './settings'
import { loadLicenseWindows } from './window'

/*
 * `pnpm licensing:sweep` (plan §5.3, every 5 minutes): evaluate the asynchronous rules, act on hits, record expiry
 * events, queue and deliver notifications, and once a night clean up per retention settings.
 *
 * Idempotent and safe to run concurrently or twice: reads happen outside transactions, every write is a short
 * BEGIN IMMEDIATE transaction that re-checks its preconditions (apply.ts), notifications are claimed with a
 * conditional UPDATE (notify.ts), expiry events and digests use unique dedupe keys, retention deletes only what is past
 * its cutoff. `dryRun` performs NO write at all (no events, no suspensions, no queue changes, no e-mail, no cleanup) and
 * reports what the rules would decide now.
 * Output is counts, rule keys, outcomes and numeric ids only (no IP, e-mail, key or fingerprint).
 */

/** Retention runs in sweeps that start in this Europe/Istanbul hour (one 5-minute timer = ~12 idempotent passes). */
export const RETENTION_HOUR = 4
/** Expired licenses are reported once; licenses that expired longer ago than this are not back-filled. */
const EXPIRY_LOOKBACK_DAYS = 30

export type SweepReport = {
  dryRun: boolean
  licenses: number
  hits: number
  outcomes: Partial<Record<DecisionOutcome, number>>
  actions: ApplyResult[]
  errors: number
  expired: number
  queued: number
  digest: boolean
  notify: NotifyReport | null
  retention: RetentionReport | null
}

type Log = { info(msg: string): void; warn(msg: string): void; error(msg: string): void }

export type SweepOptions = {
  dryRun?: boolean
  retention?: boolean | 'auto'
  now?: () => Date
  origin?: string
  log?: Log
  env?: Record<string, string | undefined>
  settings?: SweepSettings
}

export function collectHits(windows: Awaited<ReturnType<typeof loadLicenseWindows>>, settings: SweepSettings, now: Date): RuleHit[] {
  const hits: RuleHit[] = []
  for (const window of windows) {
    for (const rule of LICENSING_RULE_KEYS) {
      const config = settings.rules[rule]
      if (config.mode === 'off' || !validConfig(config)) continue
      if (RULE_META[rule].needsCountry && settings.countrySource === 'none') continue
      const result = evaluateRule(rule, window, config, now)
      if (result.hit) hits.push({ license: window.license, rule, result })
    }
  }
  return hits
}

async function recordExpiries(payload: Payload, now: Date, dryRun: boolean): Promise<number> {
  const at = now.toISOString()
  const since = new Date(now.getTime() - EXPIRY_LOOKBACK_DAYS * 86_400_000).toISOString()
  if (dryRun) {
    const [row] = await payload.db.drizzle.all<{ n: number }>(sql`SELECT count(*) AS n FROM licenses l
      WHERE l.status <> 'revoked' AND l.expires_at IS NOT NULL AND l.expires_at <= ${at} AND l.expires_at > ${since}
        AND NOT EXISTS (SELECT 1 FROM security_events e WHERE e.dedupe_key = 'license.expired|license/' || l.id || '|' || l.expires_at)`)
    return Number(row?.n ?? 0)
  }
  // Status is never written for expiry (the date is the truth, plan §5.3): one info event per license and expiry date.
  return withPaymentTransaction(payload, (tx) => tx.run(sql`INSERT INTO security_events
      (type, severity, source, first_seen_at, last_seen_at, count, dedupe_key, license_id, customer_id, action_taken, triage,
       updated_at, created_at)
    SELECT 'license.expired', 'info', 'system', l.expires_at, l.expires_at, 1, 'license.expired|license/' || l.id || '|' || l.expires_at,
      l.id, l.customer_id, 'none', 'open', ${at}, ${at}
    FROM licenses l WHERE l.status <> 'revoked' AND l.expires_at IS NOT NULL AND l.expires_at <= ${at} AND l.expires_at > ${since}
    ON CONFLICT (dedupe_key) DO NOTHING`))
}

export async function runLicensingSweep(payload: Payload, options: SweepOptions = {}): Promise<SweepReport> {
  const clock = options.now ?? (() => new Date())
  const now = clock()
  const dryRun = options.dryRun === true
  const log: Log = options.log ?? { info: (m) => payload.logger.info(m), warn: (m) => payload.logger.warn(m), error: (m) => payload.logger.error(m) }
  const settings = options.settings ?? (await loadSweepSettings(payload))
  const report: SweepReport = {
    dryRun, licenses: 0, hits: 0, outcomes: {}, actions: [], errors: 0, expired: 0, queued: 0, digest: false, notify: null, retention: null,
  }

  const windows = await loadLicenseWindows(payload, settings, now)
  report.licenses = windows.length
  const hits = collectHits(windows, settings, now)
  report.hits = hits.length
  for (const hit of hits) {
    try {
      const result = dryRun ? await previewRuleHit(payload, settings, hit, now) : await applyRuleHit(payload, settings, hit, clock())
      report.outcomes[result.outcome] = (report.outcomes[result.outcome] ?? 0) + 1
      if (result.outcome !== 'off' && result.outcome !== 'inactive') report.actions.push(result)
    } catch {
      report.errors++
      log.error(`licensing sweep: rule ${hit.rule} failed license=${hit.license}`)
    }
  }

  report.expired = await recordExpiries(payload, now, dryRun)
  if (!dryRun) {
    report.queued = await enqueueSeverityAlerts(payload, settings, clock())
    report.digest = await enqueueDigest(payload, settings, clock())
    report.notify = await deliverLicensingNotifications(payload, settings, {
      now: clock, origin: options.origin ?? serverUrl(), log, env: options.env,
    })
    const retention = options.retention ?? 'auto'
    if (retention === true || (retention === 'auto' && istanbulHour(now) === RETENTION_HOUR)) {
      report.retention = await runRetention(payload, settings, clock())
    }
  }
  return report
}
