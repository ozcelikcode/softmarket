import { sql } from '@payloadcms/db-sqlite'
import type { Payload } from 'payload'

import { LICENSING_RULE_KEYS } from '../constants'
import { TRAVEL_LOOKBACK_HOURS, type LicenseWindow } from './rules'
import type { SweepSettings } from './settings'

/*
 * Read-only window loader for the sweep: two indexed scans (activations and non-rule security events touched since
 * the longest enabled window), grouped per ACTIVE license in memory. Only prefixes, countries, timestamps, end reasons
 * and aggregate counts are read: no key, fingerprint, device key or IP hash. Rule events (`source = 'rule'`) are not
 * rule input, so a rule never feeds on its own output.
 */

const HOUR_MS = 3_600_000

type ActivationRow = {
  id: number; license_id: number; activated_at: string; ended_at: string | null; end_reason: string | null
  last_seen_at: string | null; last_ip_prefix: string | null; last_country: string | null
}
type EventRow = {
  license_id: number; activation_id: number | null; type: string; ip_prefix: string | null; country: string | null
  first_seen_at: string; last_seen_at: string; count: number
}

export function lookbackHours(settings: SweepSettings): number {
  let hours = 0
  for (const key of LICENSING_RULE_KEYS) {
    const rule = settings.rules[key]
    if (rule.mode === 'off') continue
    hours = Math.max(hours, key === 'impossibleTravel' ? TRAVEL_LOOKBACK_HOURS : rule.windowHours)
  }
  return hours
}

const empty = (license: number): LicenseWindow => ({ license, prefixes: [], countries: [], travel: [], starts: [], ends: [], clones: [] })

export async function loadLicenseWindows(payload: Payload, settings: SweepSettings, now: Date): Promise<LicenseWindow[]> {
  const hours = lookbackHours(settings)
  if (hours === 0) return []
  const nowIso = now.toISOString()
  const since = new Date(now.getTime() - hours * HOUR_MS).toISOString()
  const db = payload.db.drizzle
  const activations = await db.all<ActivationRow>(sql`SELECT a.id, a.license_id, a.activated_at, a.ended_at, a.end_reason,
      a.last_seen_at, a.last_ip_prefix, a.last_country
    FROM license_activations a JOIN licenses l ON l.id = a.license_id
    WHERE l.status = 'active' AND (l.expires_at IS NULL OR l.expires_at > ${nowIso})
      AND (a.activated_at > ${since} OR a.ended_at > ${since} OR a.last_seen_at > ${since})`)
  const events = await db.all<EventRow>(sql`SELECT e.license_id, e.activation_id, e.type, e.ip_prefix, e.country,
      e.first_seen_at, e.last_seen_at, e.count
    FROM security_events e JOIN licenses l ON l.id = e.license_id
    WHERE l.status = 'active' AND (l.expires_at IS NULL OR l.expires_at > ${nowIso})
      AND e.source <> 'rule' AND e.last_seen_at > ${since}`)
  const windows = new Map<number, LicenseWindow>()
  const of = (license: number) => {
    let w = windows.get(license)
    if (!w) windows.set(license, (w = empty(license)))
    return w
  }
  for (const a of activations) {
    const w = of(Number(a.license_id))
    w.starts.push({ activatedAt: a.activated_at })
    if (a.ended_at) w.ends.push({ endedAt: a.ended_at, endReason: a.end_reason })
    if (a.last_seen_at) {
      w.prefixes.push({ at: a.last_seen_at, prefix: a.last_ip_prefix })
      w.countries.push({ at: a.last_seen_at, country: a.last_country })
      w.travel.push({ at: a.last_seen_at, country: a.last_country, activation: Number(a.id) })
    }
  }
  for (const e of events) {
    const w = of(Number(e.license_id))
    w.prefixes.push({ at: e.last_seen_at, prefix: e.ip_prefix })
    w.countries.push({ at: e.last_seen_at, country: e.country })
    if (e.activation_id !== null) {
      // An hourly aggregate row: the first and last observation of that device in that country.
      w.travel.push({ at: e.first_seen_at, country: e.country, activation: Number(e.activation_id) })
      if (e.last_seen_at !== e.first_seen_at) w.travel.push({ at: e.last_seen_at, country: e.country, activation: Number(e.activation_id) })
    }
    if (e.type === 'activation.clone_suspected') w.clones.push({ at: e.last_seen_at, count: Number(e.count) })
  }
  return [...windows.values()].sort((a, b) => a.license - b.license)
}
