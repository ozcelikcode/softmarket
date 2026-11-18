import { describe, expect, it } from 'vitest'

import { buildCustomerNotice } from '../../src/lib/email/licensing'
import { LICENSING_RULE_KEYS, RETENTION_FLOORS, RULE_STATUS_REASONS } from '../../src/lib/licensing/constants'
import { decide, observationOver, type DecisionInput } from '../../src/lib/licensing/rules/decide'
import { pendingMessages } from '../../src/lib/licensing/rules/notify'
import {
  RULE_META,
  TRAVEL_LOOKBACK_HOURS,
  activationBurst,
  activationChurn,
  cloneSuspected,
  evaluateRule,
  geoSpread,
  impossibleTravel,
  ipSpread,
} from '../../src/lib/licensing/rules/rules'
import { normalizeSweepSettings } from '../../src/lib/licensing/rules/settings'
import { collectHits } from '../../src/lib/licensing/rules/sweep'

/* L5 pure parts: each rule's boundaries, the decision matrix, settings normalisation, queue message selection. */

const NOW = new Date('2026-11-18T12:00:00.000Z')
const H = 3_600_000
const at = (hoursAgo: number) => new Date(NOW.getTime() - hoursAgo * H).toISOString()

describe('rules (pure)', () => {
  it('ipSpread hits only ABOVE the threshold, inside the window, distinct prefixes', () => {
    const cfg = { threshold: 3, windowHours: 24 }
    const obs = (n: number, hoursAgo = 1) => Array.from({ length: n }, (_, i) => ({ at: at(hoursAgo), prefix: `10.0.${i}.0/24` }))
    expect(ipSpread(obs(3), cfg, NOW)).toEqual({ hit: false, metric: 3, threshold: 3 })
    expect(ipSpread(obs(4), cfg, NOW)).toEqual({ hit: true, metric: 4, threshold: 3 })
    // Duplicates and null prefixes do not count.
    expect(ipSpread([...obs(3), ...obs(3), { at: at(1), prefix: null }], cfg, NOW).metric).toBe(3)
    // Exactly windowHours old is outside; just inside counts.
    expect(ipSpread(obs(4, 24), cfg, NOW).metric).toBe(0)
    expect(ipSpread(obs(4, 23.99), cfg, NOW).hit).toBe(true)
    expect(ipSpread([{ at: 'garbage', prefix: '1.2.3.0/24' }], { threshold: 0, windowHours: 1 }, NOW).hit).toBe(false)
  })

  it('geoSpread counts distinct valid country codes (>= threshold)', () => {
    const cfg = { threshold: 3, windowHours: 24 }
    const c = (country: string | null, h = 1) => ({ at: at(h), country })
    expect(geoSpread([c('TR'), c('DE')], cfg, NOW).hit).toBe(false)
    expect(geoSpread([c('TR'), c('DE'), c('US')], cfg, NOW)).toEqual({ hit: true, metric: 3, threshold: 3 })
    expect(geoSpread([c('TR'), c('DE'), c('xx'), c(null), c('TR')], cfg, NOW).metric).toBe(2)
    expect(geoSpread([c('TR'), c('DE'), c('US', 25)], cfg, NOW).hit).toBe(false)
  })

  it('impossibleTravel counts per-device country changes within the gap, over the look-back', () => {
    const cfg = { threshold: 1, windowHours: 2 }
    const o = (activation: number, country: string, h: number) => ({ activation, country, at: at(h) })
    expect(impossibleTravel([o(1, 'TR', 3), o(1, 'TR', 1)], cfg, NOW).hit).toBe(false)
    expect(impossibleTravel([o(1, 'TR', 3), o(1, 'US', 1)], cfg, NOW)).toEqual({ hit: true, metric: 1, threshold: 1 })
    // Gap exactly windowHours still counts; just above does not.
    expect(impossibleTravel([o(1, 'TR', 3), o(1, 'US', 1.0001)], cfg, NOW).metric).toBe(1)
    expect(impossibleTravel([o(1, 'TR', 3.01), o(1, 'US', 1)], cfg, NOW).metric).toBe(0)
    // Two devices in two countries are not travel.
    expect(impossibleTravel([o(1, 'TR', 1), o(2, 'US', 1)], cfg, NOW).metric).toBe(0)
    // Outside the look-back nothing counts.
    expect(impossibleTravel([o(1, 'TR', TRAVEL_LOOKBACK_HOURS + 1), o(1, 'US', TRAVEL_LOOKBACK_HOURS + 0.5)], cfg, NOW).metric).toBe(0)
    expect(impossibleTravel([o(1, 'TR', 3), o(1, 'US', 2), o(1, 'TR', 1)], { threshold: 2, windowHours: 2 }, NOW).hit).toBe(true)
    // Equal-timestamp observations tie-break deterministically regardless of input order.
    expect(impossibleTravel([o(1, 'TR', 1), o(1, 'US', 1), o(1, 'TR', 1)], cfg, NOW).metric).toBe(1)
    expect(impossibleTravel([o(1, 'US', 1), o(1, 'TR', 1), o(1, 'TR', 1)], cfg, NOW).metric).toBe(1)
  })

  it('activationBurst counts activations in the window (>= threshold)', () => {
    const cfg = { threshold: 5, windowHours: 1 }
    const a = (n: number, h = 0.5) => Array.from({ length: n }, () => ({ activatedAt: at(h) }))
    expect(activationBurst(a(4), cfg, NOW).hit).toBe(false)
    expect(activationBurst(a(5), cfg, NOW)).toEqual({ hit: true, metric: 5, threshold: 5 })
    expect(activationBurst([...a(4), ...a(3, 1)], cfg, NOW).metric).toBe(4)
  })

  it('activationChurn counts client/customer ends only', () => {
    const cfg = { threshold: 3, windowHours: 720 }
    const e = (endReason: string | null, h = 10) => ({ endedAt: at(h), endReason })
    expect(activationChurn([e('user'), e('rebind'), e('customer_portal')], cfg, NOW).hit).toBe(true)
    expect(activationChurn([e('user'), e('rebind'), e('admin'), e('license_revoked'), e('rule'), e(null)], cfg, NOW)).toEqual({ hit: false, metric: 2, threshold: 3 })
    expect(activationChurn([e('user'), e('user'), e('user', 720)], cfg, NOW).hit).toBe(false)
    expect(activationChurn([{ endedAt: null, endReason: 'user' }], { threshold: 1, windowHours: 1 }, NOW).hit).toBe(false)
  })

  it('cloneSuspected sums aggregated clone signals (>= threshold)', () => {
    const cfg = { threshold: 3, windowHours: 24 }
    expect(cloneSuspected([{ at: at(1), count: 2 }], cfg, NOW).hit).toBe(false)
    expect(cloneSuspected([{ at: at(1), count: 2 }, { at: at(5), count: 1 }], cfg, NOW)).toEqual({ hit: true, metric: 3, threshold: 3 })
    expect(cloneSuspected([{ at: at(1), count: 2 }, { at: at(24), count: 5 }, { at: at(1), count: -4 }], cfg, NOW).metric).toBe(2)
  })

  it('invalid configs never hit (fail safe)', () => {
    const window = { license: 1, prefixes: [], countries: [], travel: [], starts: Array.from({ length: 50 }, () => ({ activatedAt: at(0.1) })), ends: [], clones: [] }
    for (const bad of [{ threshold: 0, windowHours: 1 }, { threshold: 1.5, windowHours: 1 }, { threshold: 1, windowHours: 0 }, { threshold: Number.NaN, windowHours: 1 }]) {
      expect(evaluateRule('activationBurst', window, bad, NOW).hit).toBe(false)
    }
  })

  it('rule metadata maps every rule to its event and rule_* reason; no rule can revoke', () => {
    for (const [i, key] of LICENSING_RULE_KEYS.entries()) {
      expect(RULE_META[key].reason).toBe(RULE_STATUS_REASONS[i])
      expect(RULE_META[key].event).toMatch(/^(license|activation)\./)
    }
  })
})

describe('decision matrix', () => {
  const base: DecisionInput = {
    mode: 'suspend', licenseActive: true, suppressed: false, observeUntil: '2026-01-01T00:00:00.000Z', now: NOW,
    circuitOpen: false, suspensionsLastHour: 0, maxAutoSuspendsPerHour: 5,
  }

  it('observeUntil must be a canonical ISO date strictly in the past', () => {
    expect(observationOver('2026-01-01T00:00:00.000Z', NOW)).toBe(true)
    expect(observationOver(NOW.toISOString(), NOW)).toBe(false)
    for (const bad of [null, undefined, '', 'not-a-date', '2026-01-01', '2026-01-01T00:00:00Z', '2099-01-01T00:00:00.000Z']) {
      expect(observationOver(bad, NOW)).toBe(false)
    }
  })

  it('monitor-only: never suspends without suspend mode and an elapsed, valid observeUntil', () => {
    for (const observeUntil of [null, '', 'garbage', '2099-01-01T00:00:00.000Z', NOW.toISOString()]) {
      expect(decide({ ...base, observeUntil })).toMatchObject({ outcome: 'monitor_only', suspend: false, record: true, notifyAdmin: true })
    }
    expect(decide({ ...base, mode: 'notify' })).toMatchObject({ outcome: 'notified', suspend: false, notifyAdmin: true })
    expect(decide({ ...base, mode: 'observe' })).toMatchObject({ outcome: 'observed', suspend: false, notifyAdmin: false, record: true })
    expect(decide({ ...base, mode: 'off' })).toMatchObject({ outcome: 'off', record: false })
  })

  it('suspends only for an active, unsuppressed license with the breaker closed', () => {
    expect(decide(base)).toMatchObject({ outcome: 'suspended', suspend: true })
    expect(decide({ ...base, licenseActive: false })).toMatchObject({ outcome: 'inactive', record: false, suspend: false })
    expect(decide({ ...base, suppressed: true })).toMatchObject({ outcome: 'suppressed', record: false, suspend: false })
    expect(decide({ ...base, maxAutoSuspendsPerHour: 0 })).toMatchObject({ outcome: 'auto_suspend_disabled', suspend: false, trip: false })
    expect(decide({ ...base, circuitOpen: true })).toMatchObject({ outcome: 'circuit_open', suspend: false, trip: false })
    expect(decide({ ...base, suspensionsLastHour: 4 })).toMatchObject({ outcome: 'suspended', suspend: true })
    // The N+1th suspension within the hour trips the breaker instead.
    expect(decide({ ...base, suspensionsLastHour: 5 })).toMatchObject({ outcome: 'circuit_tripped', suspend: false, trip: true, notifyAdmin: true })
  })

  it('no input combination yields anything stronger than a suspension', () => {
    const outcomes = new Set<string>()
    for (const mode of ['off', 'observe', 'notify', 'suspend'] as const) {
      for (const licenseActive of [true, false]) for (const suppressed of [true, false]) for (const circuitOpen of [true, false]) {
        for (const n of [0, 5, 6]) {
          const d = decide({ ...base, mode, licenseActive, suppressed, circuitOpen, suspensionsLastHour: n })
          outcomes.add(d.outcome)
          expect(Object.keys(d).sort()).toEqual(['notifyAdmin', 'outcome', 'record', 'suspend', 'trip'])
          if (d.suspend) expect(mode === 'suspend' && licenseActive && !suppressed && !circuitOpen && n < 5).toBe(true)
        }
      }
    }
    expect([...outcomes].some((o) => /revok/.test(o))).toBe(false)
  })
})

describe('settings and queue selection', () => {
  it('normalises unsaved settings to the safe defaults and clamps retention floors', () => {
    const s = normalizeSweepSettings(null)
    expect(s.observeUntil).toBeNull()
    expect(s.maxAutoSuspendsPerHour).toBe(5)
    for (const key of LICENSING_RULE_KEYS) expect(s.rules[key].mode).toBe('notify')
    expect(s.rules.ipSpread).toMatchObject({ threshold: 10, windowHours: 24, suppressDays: 30 })
    const t = normalizeSweepSettings({
      rules: { ipSpread: { mode: 'revoke', threshold: -1 } },
      retention: Object.fromEntries(Object.keys(RETENTION_FLOORS).map((k) => [k, 0])),
      notifications: { alertEmails: [{ email: 'ops@example.test' }, { email: 'bad' }], minSeverityImmediate: 'nope' },
    })
    expect(t.rules.ipSpread).toMatchObject({ mode: 'notify', threshold: 10 })
    expect(t.retention).toEqual(RETENTION_FLOORS)
    expect(t.alertEmails).toEqual(['ops@example.test'])
    expect(t.minSeverityImmediate).toBe('high')
    const huge = normalizeSweepSettings({
      retention: { eventDays: 1e30, auditYears: 1e30 },
      notifications: { alertEmails: [{ email: 'CHANGE_ME@example.test' }, { email: 'ops@example.test' }] },
    })
    expect(huge.retention.eventDays).toBe(10_000)
    expect(huge.retention.auditYears).toBe(10_000)
    expect(huge.alertEmails).toEqual(['ops@example.test'])
  })

  it('collectHits skips off rules and country rules without a country source', () => {
    const settings = normalizeSweepSettings({ rules: { geoSpread: { mode: 'suspend', threshold: 1 }, activationBurst: { mode: 'off', threshold: 1 } } })
    const window = {
      license: 7, prefixes: [], countries: [{ at: at(1), country: 'TR' }], travel: [],
      starts: [{ activatedAt: at(0.1) }], ends: [], clones: [],
    }
    expect(collectHits([window], settings, NOW)).toEqual([])
    expect(collectHits([window], { ...settings, countrySource: 'cloudflare_header' }, NOW).map((h) => h.rule)).toEqual(['geoSpread'])
  })

  it('pendingMessages: admin by want/done, customer suspension once, restore only after a suspension e-mail', () => {
    const on = { customerSuspensionEmail: true }
    const row = (detail: Record<string, unknown>, action = 'notified', customer: number | null = 1) =>
      ({ type: 'license.ip_spread', action_taken: action, customer_id: customer, detail: JSON.stringify(detail) })
    expect(pendingMessages(row({ notifyAdminWant: 'notified' }), on)).toEqual(['admin'])
    expect(pendingMessages(row({ notifyAdminWant: 'notified', notifyAdminDone: 'notified' }), on)).toEqual([])
    expect(pendingMessages(row({ notifyAdminWant: 'suspended', notifyAdminDone: 'notified' }, 'suspended'), on)).toEqual(['admin', 'customerSuspended'])
    expect(pendingMessages(row({}, 'suspended'), { customerSuspensionEmail: false })).toEqual([])
    expect(pendingMessages(row({}, 'suspended', null), on)).toEqual([])
    expect(pendingMessages(row({ restoredAt: at(0) }, 'suspended'), on)).toEqual([])
    expect(pendingMessages(row({ restoredAt: at(0), notifyCustomerSuspendedAt: 'skipped' }, 'suspended'), on)).toEqual([])
    expect(pendingMessages(row({ restoredAt: at(0), notifyCustomerSuspendedAt: at(1) }, 'suspended'), on)).toEqual(['customerRestored'])
    expect(pendingMessages({ type: 'system.daily_digest', action_taken: 'none', customer_id: null, detail: '{}' }, on)).toEqual(['digest'])
    expect(pendingMessages({ type: 'api.replay', action_taken: 'none', customer_id: null, detail: 'not json' }, on)).toEqual([])
  })

  it('customer e-mails exist in Turkish and English and carry only the masked key', () => {
    for (const kind of ['suspended', 'restored'] as const) {
      const tr = buildCustomerNotice({ kind, to: 'c@example.test', locale: 'tr', product: 'Ürün', maskedKey: '•••••-ABCDE' }, 'https://site.test')
      const en = buildCustomerNotice({ kind, to: 'c@example.test', locale: 'en', product: 'Product', maskedKey: '•••••-ABCDE' }, 'https://site.test')
      expect(tr.subject).toMatch(/Lisansınız/)
      expect(tr.text).toContain('https://site.test/tr/hesap/lisanslar')
      expect(en.subject).toMatch(/Your license/)
      expect(en.text).toContain('https://site.test/en/account/licenses')
      expect(tr.html).toContain('lang="tr"')
      expect(en.html).toContain('lang="en"')
    }
    const injected = buildCustomerNotice(
      { kind: 'suspended', to: 'c@example.test', locale: 'en', product: '<script>alert(1)</script><img src=x onerror="x">', maskedKey: '<b>•••••-ABCDE</b>' },
      'https://site.test',
    )
    expect(injected.html).not.toContain('<script>')
    expect(injected.html).not.toContain('<img ')
    expect(injected.html).not.toContain('<b>')
    expect(injected.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })
})
