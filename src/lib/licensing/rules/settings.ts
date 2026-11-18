import type { Payload } from 'payload'

import {
  LICENSING_RULE_KEYS,
  RETENTION_FLOORS,
  RULE_DEFAULTS,
  RULE_MODES,
  SECURITY_SEVERITIES,
  type LicensingRuleKey,
  type RuleMode,
} from '../constants'

/*
 * The sweep's view of `licensing-settings` (admin-editable). Unsaved or malformed values fall back to the global's
 * defaults; a malformed mode falls back to `notify` (the documented safe default: event + admin e-mail, never a
 * suspension). Retention values are clamped to the code floors (RETENTION_FLOORS, plan §6).
 */

export type RuleSettings = { mode: RuleMode; threshold: number; windowHours: number; suppressDays: number }
export type Severity = (typeof SECURITY_SEVERITIES)[number]

export type SweepSettings = {
  countrySource: 'none' | 'cloudflare_header'
  observeUntil: string | null
  maxAutoSuspendsPerHour: number
  rules: Record<LicensingRuleKey, RuleSettings>
  alertEmails: string[]
  minSeverityImmediate: Severity
  dailyDigest: boolean
  digestHour: number
  customerSuspensionEmail: boolean
  retention: { [K in keyof typeof RETENTION_FLOORS]: number }
}

type Raw = Record<string, unknown> | null | undefined

const obj = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? value as Record<string, unknown> : {})
const int = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max ? value : fallback
const oneOf = <T extends string>(values: readonly T[], value: unknown, fallback: T): T =>
  typeof value === 'string' && (values as readonly string[]).includes(value) ? value as T : fallback

const RETENTION_DEFAULTS = {
  eventIpDays: 30, eventDays: 180, activationIpDays: 90, activationRowYears: 2, blockDays: 90, statusLogYears: 10, auditYears: 2,
} as const

export function normalizeSweepSettings(raw: Raw): SweepSettings {
  const doc = obj(raw)
  const rules = obj(doc.rules)
  const notifications = obj(doc.notifications)
  const retention = obj(doc.retention)
  const ruleSettings = Object.fromEntries(LICENSING_RULE_KEYS.map((key) => {
    const r = obj(rules[key])
    return [key, {
      mode: oneOf(RULE_MODES, r.mode, 'notify'),
      threshold: int(r.threshold, RULE_DEFAULTS[key].threshold, 1, 10_000),
      windowHours: int(r.windowHours, RULE_DEFAULTS[key].windowHours, 1, 24 * 90),
      suppressDays: int(r.suppressDays, 30, 0, 365),
    }]
  })) as Record<LicensingRuleKey, RuleSettings>
  const emails = Array.isArray(notifications.alertEmails) ? notifications.alertEmails : []
  return {
    countrySource: oneOf(['none', 'cloudflare_header'] as const, doc.countrySource, 'none'),
    observeUntil: typeof rules.observeUntil === 'string' ? rules.observeUntil : null,
    maxAutoSuspendsPerHour: int(rules.maxAutoSuspendsPerHour, 5, 0, 100),
    rules: ruleSettings,
    alertEmails: emails.map((row) => obj(row).email)
      .filter((e): e is string => typeof e === 'string' && !e.startsWith('CHANGE_') && /^[^\s@]+@[^\s@]+$/.test(e))
      .slice(0, 10),
    minSeverityImmediate: oneOf(SECURITY_SEVERITIES, notifications.minSeverityImmediate, 'high'),
    dailyDigest: notifications.dailyDigest === true,
    digestHour: int(notifications.digestHour, 8, 0, 23),
    customerSuspensionEmail: notifications.customerSuspensionEmail !== false,
    retention: Object.fromEntries(Object.entries(RETENTION_FLOORS).map(([key, floor]) => {
      const value = retention[key]
      const fallback = RETENTION_DEFAULTS[key as keyof typeof RETENTION_DEFAULTS]
      return [key, typeof value === 'number' && Number.isFinite(value) ? Math.min(10_000, Math.max(floor, Math.floor(value))) : fallback]
    })) as SweepSettings['retention'],
  }
}

export async function loadSweepSettings(payload: Payload): Promise<SweepSettings> {
  const doc = await payload.findGlobal({ slug: 'licensing-settings', depth: 0, overrideAccess: true })
  return normalizeSweepSettings(doc as unknown as Raw)
}

export const severityRank = (value: unknown) => SECURITY_SEVERITIES.indexOf(value as Severity)
