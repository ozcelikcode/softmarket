import type { LicensingRuleKey, SecurityEventType } from '../constants'

/*
 * L5 asynchronous rules (docs/plan-licensing-security.md §5.3). Every rule is a PURE function: per-license window data
 * in, a decision out. No I/O, no clock: `now` is passed in. The sweep loads the data (window.ts) and decides what to do
 * with a hit (decide.ts); a rule never changes a license.
 *
 * Window semantics (all rules): an observation counts when `now - windowHours < at`, i.e. an observation exactly
 * `windowHours` old is outside. Timestamps that do not parse are ignored. An invalid config (threshold or window not a
 * positive integer) never hits (fail safe: a broken setting must not suspend anybody).
 *
 * Comparison: `ipSpread` hits when the distinct prefix count is GREATER than the threshold (plan §5.1 "> N"); every
 * other rule hits when its metric REACHES the threshold (`>=`).
 */

export type RuleConfig = { threshold: number; windowHours: number }
export type RuleResult = { hit: boolean; metric: number; threshold: number }

const HOUR_MS = 3_600_000
/** Look-back of the impossible-travel rule; its `windowHours` is the maximum gap between two countries. */
export const TRAVEL_LOOKBACK_HOURS = 24

export type PrefixObservation = { at: string; prefix: string | null }
export type CountryObservation = { at: string; country: string | null }
export type TravelObservation = { at: string; country: string | null; activation: number }
export type ActivationStart = { activatedAt: string }
export type ActivationEnd = { endedAt: string | null; endReason: string | null }
export type CloneSignal = { at: string; count: number }

export const validConfig = ({ threshold, windowHours }: RuleConfig) =>
  Number.isSafeInteger(threshold) && threshold >= 1 && Number.isSafeInteger(windowHours) && windowHours >= 1

const time = (at: string | null | undefined) => (typeof at === 'string' ? Date.parse(at) : NaN)

const within = (at: string | null | undefined, now: Date, hours: number) => {
  const t = time(at)
  return Number.isFinite(t) && t > now.getTime() - hours * HOUR_MS
}

const result = (config: RuleConfig, metric: number, hit: boolean): RuleResult =>
  ({ hit: validConfig(config) && hit, metric, threshold: config.threshold })

const isCountry = (value: string | null | undefined): value is string => typeof value === 'string' && /^[A-Z]{2}$/.test(value)

/** Distinct IPv4 /24 or IPv6 /48 prefixes that used the license in the window. */
export function ipSpread(observations: readonly PrefixObservation[], config: RuleConfig, now: Date): RuleResult {
  const prefixes = new Set<string>()
  for (const o of observations) if (o.prefix && within(o.at, now, config.windowHours)) prefixes.add(o.prefix)
  return result(config, prefixes.size, prefixes.size > config.threshold)
}

/** Distinct countries (country source required) that used the license in the window. */
export function geoSpread(observations: readonly CountryObservation[], config: RuleConfig, now: Date): RuleResult {
  const countries = new Set<string>()
  for (const o of observations) if (isCountry(o.country) && within(o.at, now, config.windowHours)) countries.add(o.country)
  return result(config, countries.size, countries.size >= config.threshold)
}

/**
 * Country changes of ONE device within `windowHours` (the travel gap), over the last TRAVEL_LOOKBACK_HOURS. Metric =
 * number of consecutive observation pairs of the same activation with different countries and a gap <= windowHours.
 * Different devices in different countries are geo spread, not travel.
 */
export function impossibleTravel(observations: readonly TravelObservation[], config: RuleConfig, now: Date): RuleResult {
  const byDevice = new Map<number, { t: number; country: string }[]>()
  for (const o of observations) {
    if (!isCountry(o.country) || !within(o.at, now, TRAVEL_LOOKBACK_HOURS)) continue
    const list = byDevice.get(o.activation) ?? []
    list.push({ t: time(o.at), country: o.country })
    byDevice.set(o.activation, list)
  }
  let changes = 0
  for (const list of byDevice.values()) {
    list.sort((a, b) => a.t - b.t || (a.country < b.country ? -1 : a.country > b.country ? 1 : 0))
    for (let i = 1; i < list.length; i++) {
      if (list[i]!.country !== list[i - 1]!.country && list[i]!.t - list[i - 1]!.t <= config.windowHours * HOUR_MS) changes++
    }
  }
  return result(config, changes, changes >= config.threshold)
}

/** New device activations (any later status) in the window. */
export function activationBurst(activations: readonly ActivationStart[], config: RuleConfig, now: Date): RuleResult {
  const count = activations.filter((a) => within(a.activatedAt, now, config.windowHours)).length
  return result(config, count, count >= config.threshold)
}

/** End reasons that a client or customer can cycle (admin, revocation and rule ends are not churn). */
export const CHURN_END_REASONS: readonly string[] = ['user', 'rebind', 'customer_portal']

/** Devices released by the client or customer in the window (activate/deactivate cycling). */
export function activationChurn(ends: readonly ActivationEnd[], config: RuleConfig, now: Date): RuleResult {
  const count = ends.filter((e) => e.endReason !== null && CHURN_END_REASONS.includes(e.endReason) && within(e.endedAt, now, config.windowHours)).length
  return result(config, count, count >= config.threshold)
}

/** Repeated clone suspicion: L3 `activation.clone_suspected` observations (aggregated counts) in the window. */
export function cloneSuspected(signals: readonly CloneSignal[], config: RuleConfig, now: Date): RuleResult {
  let total = 0
  for (const s of signals) if (within(s.at, now, config.windowHours) && Number.isFinite(s.count) && s.count > 0) total += s.count
  return result(config, total, total >= config.threshold)
}

/** Event type, severity and status reason that a rule hit records. */
export const RULE_META: Record<LicensingRuleKey, {
  event: SecurityEventType
  severity: 'medium' | 'high'
  reason: `rule_${string}`
  /** Needs `licensing-settings.countrySource` (no country data otherwise). */
  needsCountry: boolean
}> = {
  ipSpread: { event: 'license.ip_spread', severity: 'medium', reason: 'rule_ip_spread', needsCountry: false },
  geoSpread: { event: 'license.geo_spread', severity: 'medium', reason: 'rule_geo_spread', needsCountry: true },
  impossibleTravel: { event: 'license.impossible_travel', severity: 'high', reason: 'rule_impossible_travel', needsCountry: true },
  activationBurst: { event: 'activation.burst', severity: 'medium', reason: 'rule_activation_burst', needsCountry: false },
  activationChurn: { event: 'activation.churn', severity: 'medium', reason: 'rule_activation_churn', needsCountry: false },
  cloneSuspected: { event: 'activation.clone_suspected', severity: 'high', reason: 'rule_clone_suspected', needsCountry: false },
}

/** All window data of one license that the rules read. */
export type LicenseWindow = {
  license: number
  prefixes: PrefixObservation[]
  countries: CountryObservation[]
  travel: TravelObservation[]
  starts: ActivationStart[]
  ends: ActivationEnd[]
  clones: CloneSignal[]
}

export function evaluateRule(key: LicensingRuleKey, window: LicenseWindow, config: RuleConfig, now: Date): RuleResult {
  switch (key) {
    case 'ipSpread': return ipSpread(window.prefixes, config, now)
    case 'geoSpread': return geoSpread(window.countries, config, now)
    case 'impossibleTravel': return impossibleTravel(window.travel, config, now)
    case 'activationBurst': return activationBurst(window.starts, config, now)
    case 'activationChurn': return activationChurn(window.ends, config, now)
    case 'cloneSuspected': return cloneSuspected(window.clones, config, now)
  }
}
