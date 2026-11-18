import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { restoreRuleSuspension } from '../../src/lib/licensing/rules/restore'
import { normalizeSweepSettings } from '../../src/lib/licensing/rules/settings'
import { runLicensingSweep, type SweepOptions } from '../../src/lib/licensing/rules/sweep'
import { CUSTOMER, createLicense, setupLicensingDb, type Ctx } from './helpers/licensing-db'
import { HOUR, ago, captureLog, insertActivation, insertEvent, resetLicensingRows, rulesOnly, setSettings, stubMail, transition } from './helpers/licensing-sweep'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

/*
 * L5 sweep on a temporary migrated SQLite: monitor-only never suspends, suspend mode after observeUntil suspends ONCE
 * and logs ONCE (source rule), rules never revoke, the circuit breaker, episodes/dedup, suppression and restore,
 * concurrent sweeps, dry run, expiry events and a privacy scan. Never touches data/softmarket.db, never sends e-mail.
 */

let ctx: Ctx
const PAST = '2026-01-01T00:00:00.000Z'
const logs = async (license: number) => (await ctx.run(
  `SELECT "from", "to", reason, source, rule_key AS rule, event_id AS event, revert_of_id AS revertOf FROM license_status_log WHERE license_id = ${license} ORDER BY id`,
)).rows
const status = async (license: number) => (await ctx.run(`SELECT status FROM licenses WHERE id = ${license}`)).rows[0]!.status
const events = async (where = '1=1') => (await ctx.run(
  `SELECT id, type, severity, source, rule_key AS rule, license_id AS license, action_taken AS action, triage, notify_state AS notify, detail FROM security_events WHERE ${where} ORDER BY id`,
)).rows
const sweep = (options: SweepOptions = {}) => runLicensingSweep(ctx.payload, { retention: false, log: captureLog().log, ...options })

/** A license with `n` activations created within the last hour (activationBurst threshold 5). */
async function burstLicense(n = 6) {
  const { id } = await createLicense(ctx)
  for (let i = 0; i < n; i++) await insertActivation(ctx, id, { activatedAt: ago(10 * 60_000), status: i < 2 ? 'active' : 'deactivated', endReason: i < 2 ? null : 'user', endedAt: i < 2 ? null : ago(5 * 60_000) })
  return id
}

beforeAll(async () => { ctx = await setupLicensingDb('l5-sweep') }, 240000)
afterAll(async () => { await ctx?.destroy() })
beforeEach(async () => {
  await resetLicensingRows(ctx)
  await ctx.run(`UPDATE licenses SET status = 'revoked'`)
  await setSettings(ctx.payload, { rules: { observeUntil: null, maxAutoSuspendsPerHour: 5, ...rulesOnly({ activationBurst: 'notify' }) } })
})

describe('monitor-only and suspension', () => {
  it('never suspends in notify/observe mode or without a valid elapsed observeUntil', async () => {
    const cases: [string | null, string, string][] = [
      [null, 'suspend', 'monitor_only'],
      ['2099-01-01T00:00:00.000Z', 'suspend', 'monitor_only'],
      [PAST, 'notify', 'notified'],
      [PAST, 'observe', 'observed'],
    ]
    for (const [observeUntil, mode, outcome] of cases) {
      await resetLicensingRows(ctx)
      await ctx.run(`UPDATE licenses SET status = 'revoked'`)
      await setSettings(ctx.payload, { rules: { observeUntil, ...rulesOnly({ activationBurst: mode }) } })
      const id = await burstLicense()
      const report = await sweep()
      expect(report.outcomes).toEqual({ [outcome]: 1 })
      expect(await status(id)).toBe('active')
      expect(await logs(id)).toEqual([])
      const [event] = await events(`license_id = ${id}`)
      expect(event).toMatchObject({ type: 'activation.burst', source: 'rule', rule: 'activationBurst', notify: mode === 'observe' ? 'skipped' : 'pending' })
      expect(JSON.parse(String(event!.detail))).toMatchObject({ outcome, metric: 6, threshold: 5 })
    }
  })

  it('an unreadable stored observeUntil (raw column) fails closed: the sweep aborts, nothing is suspended', async () => {
    await setSettings(ctx.payload, { rules: rulesOnly({ activationBurst: 'suspend' }) })
    const id = await burstLicense()
    await ctx.run(`UPDATE licensing_settings SET rules_observe_until = 'garbage'`)
    try {
      await expect(sweep()).rejects.toThrow()
      expect(await status(id)).toBe('active')
      expect(await logs(id)).toEqual([])
    } finally {
      await ctx.run(`UPDATE licensing_settings SET rules_observe_until = NULL`)
    }
  })

  it('the L1 guard is authoritative: stale sweep settings cannot force a suspension', async () => {
    const id = await burstLicense()
    // DB says notify; the sweep is handed settings that claim suspend mode after the window.
    const forged = normalizeSweepSettings({ rules: { observeUntil: PAST, activationBurst: { mode: 'suspend' } } })
    const report = await sweep({ settings: forged })
    expect(report.outcomes).toEqual({ monitor_only: 1 })
    expect(await status(id)).toBe('active')
    expect(await logs(id)).toEqual([])
    expect(await events(`license_id = ${id}`)).toHaveLength(1)
  })

  it('suspend mode after observeUntil suspends once, logs once, never revokes; concurrent and repeated sweeps are idempotent', async () => {
    await setSettings(ctx.payload, { rules: { observeUntil: PAST, ...rulesOnly({ activationBurst: 'suspend' }) } })
    const id = await burstLicense()
    const [a, b] = await Promise.all([sweep(), sweep()])
    const third = await sweep()
    const outcomes = [a, b, third].map((r) => r.outcomes)
    expect(outcomes.filter((o) => o.suspended === 1)).toHaveLength(1)
    expect(await status(id)).toBe('suspended')
    const [event, ...more] = await events(`license_id = ${id}`)
    expect(more).toEqual([])
    expect(event).toMatchObject({ action: 'suspended', severity: 'high', notify: 'pending' })
    expect(await logs(id)).toEqual([{ from: 'active', to: 'suspended', reason: 'rule_activation_burst', source: 'rule', rule: 'activationBurst', event: event!.id, revertOf: null }])
    expect((await ctx.run(`SELECT statusReason FROM (SELECT status_reason AS statusReason, status_source AS s FROM licenses WHERE id = ${id})`)).rows[0]).toEqual({ statusReason: 'rule_activation_burst' })
    // Devices keep running until lease expiry; nothing is revoked anywhere.
    expect((await ctx.run(`SELECT count(*) AS n FROM license_activations WHERE license_id = ${id} AND status = 'revoked'`)).rows[0]!.n).toBe(0)
    expect((await ctx.run(`SELECT count(*) AS n FROM license_status_log WHERE "to" = 'revoked'`)).rows[0]!.n).toBe(0)
  })

  it('escalation re-arms the admin notification once (notified -> suspended)', async () => {
    const id = await burstLicense()
    await sweep()
    await ctx.run(`UPDATE security_events SET notify_state = 'sent', detail = json_set(detail, '$.notifyAdminDone', 'notified')`)
    await sweep()
    expect((await events(`license_id = ${id}`))[0]).toMatchObject({ notify: 'sent' })
    await setSettings(ctx.payload, { rules: { observeUntil: PAST, ...rulesOnly({ activationBurst: 'suspend' }) } })
    await sweep()
    const [event, ...more] = await events(`license_id = ${id}`)
    expect(more).toEqual([])
    expect(event).toMatchObject({ action: 'suspended', notify: 'pending' })
    expect(JSON.parse(String(event!.detail))).toMatchObject({ notifyAdminWant: 'suspended', notifyAdminDone: 'notified' })
  })
})

describe('circuit breaker', () => {
  it('trips on the N+1th suspension within the hour, records one critical event and stops automatic actions', async () => {
    await setSettings(ctx.payload, { rules: { observeUntil: PAST, maxAutoSuspendsPerHour: 2, ...rulesOnly({ activationBurst: 'suspend' }) } })
    const ids = [await burstLicense(), await burstLicense(), await burstLicense(), await burstLicense()]
    const report = await sweep()
    expect(report.outcomes).toEqual({ suspended: 2, circuit_tripped: 1, circuit_open: 1 })
    expect(await Promise.all(ids.map(status))).toEqual(['suspended', 'suspended', 'active', 'active'])
    const circuit = await events(`type = 'system.rule_circuit_open'`)
    expect(circuit).toHaveLength(1)
    expect(circuit[0]).toMatchObject({ severity: 'critical', source: 'system', notify: 'pending', triage: 'open' })
    // Still open on the next run, even with fresh licenses and a high limit (cool-down until triaged).
    await setSettings(ctx.payload, { rules: { maxAutoSuspendsPerHour: 100 } })
    const fresh = await burstLicense()
    expect((await sweep()).outcomes).toMatchObject({ circuit_open: 3 })
    expect(await status(fresh)).toBe('active')
    // An admin triage (L6b) closes it.
    await ctx.run(`UPDATE security_events SET triage = 'acknowledged' WHERE type = 'system.rule_circuit_open'`)
    expect((await sweep()).outcomes).toMatchObject({ suspended: 3 })
  })

  it('maxAutoSuspendsPerHour = 0 disables automatic suspension', async () => {
    await setSettings(ctx.payload, { rules: { observeUntil: PAST, maxAutoSuspendsPerHour: 0, ...rulesOnly({ activationBurst: 'suspend' }) } })
    const id = await burstLicense()
    expect((await sweep()).outcomes).toEqual({ auto_suspend_disabled: 1 })
    expect(await status(id)).toBe('active')
    expect(await events(`type = 'system.rule_circuit_open'`)).toEqual([])
  })

  it('re-tripping the breaker in the same UTC hour after admin triage re-opens it and re-arms the alert', async () => {
    await setSettings(ctx.payload, { rules: { observeUntil: PAST, maxAutoSuspendsPerHour: 1, ...rulesOnly({ activationBurst: 'suspend' }) } })
    const a = await burstLicense()
    const b = await burstLicense()
    const first = await sweep()
    expect(first.outcomes).toEqual({ suspended: 1, circuit_tripped: 1 })
    expect(await status(a)).toBe('suspended')
    expect(await status(b)).toBe('active')

    // Admin triages the breaker event and sends/acknowledges the first alert without raising the limit.
    await ctx.run(`UPDATE security_events SET triage = 'acknowledged', notify_state = 'sent', detail = json_set(detail, '$.notifyAdminDone', 'critical') WHERE type = 'system.rule_circuit_open'`)
    const c = await burstLicense()
    const second = await sweep()
    expect(second.outcomes).toEqual({ circuit_tripped: 1, circuit_open: 1 })
    expect(await status(b)).toBe('active')
    expect(await status(c)).toBe('active')
    const [breaker] = await events(`type = 'system.rule_circuit_open'`)
    expect(breaker).toMatchObject({ triage: 'open', notify: 'pending' })
  })
})

describe('episodes, suppression and restore', () => {
  it('a persisting condition is one event; a resolved one starts a new episode', async () => {
    const id = await burstLicense()
    await sweep()
    await sweep()
    expect(await events(`license_id = ${id}`)).toHaveLength(1)
    await ctx.run(`UPDATE security_events SET triage = 'resolved'`)
    await sweep()
    expect(await events(`license_id = ${id}`)).toHaveLength(2)
  })

  it('restore reverts only a rule suspension, marks the false positive, and suppresses the rule for that license', async () => {
    await setSettings(ctx.payload, { rules: { observeUntil: PAST, ...rulesOnly({ activationBurst: 'suspend' }) } })
    const id = await burstLicense()
    await sweep()
    expect(await status(id)).toBe('suspended')
    const [suspension] = await logs(id)
    const result = await restoreRuleSuspension(ctx.payload, { license: id, actorUser: ctx.ids.admin, reason: 'false positive' })
    expect(await status(id)).toBe('active')
    expect((await logs(id))[1]).toMatchObject({ from: 'suspended', to: 'active', reason: 'restore', source: 'admin', rule: 'activationBurst', event: result.event })
    expect(result.logId).toBeGreaterThan(0)
    expect((await ctx.run(`SELECT revert_of_id AS r FROM license_status_log WHERE license_id = ${id} ORDER BY id DESC LIMIT 1`)).rows[0]!.r).toBe(result.logId)
    const [event] = await events(`license_id = ${id}`)
    expect(event).toMatchObject({ triage: 'false_positive', notify: 'pending' })
    expect(JSON.parse(String(event!.detail)).restoredAt).toBeTruthy()
    expect((await ctx.run(`SELECT action, actor_kind AS kind, result FROM security_audit`)).rows).toEqual([{ action: 'license.restore', kind: 'admin', result: 'ok' }])
    // Suppressed: the same rule cannot suspend (or alert on) this license again within suppressDays.
    expect((await sweep()).outcomes).toEqual({ suppressed: 1 })
    expect(await status(id)).toBe('active')
    expect(await logs(id)).toHaveLength(2)
    expect(suspension).toBeDefined()
    // A second restore is refused (the last transition is no longer the rule's suspension).
    await expect(restoreRuleSuspension(ctx.payload, { license: id, actorUser: ctx.ids.admin, reason: 'again' })).rejects.toMatchObject({ status: 409 })
  })

  it('restore cannot undo a payment suspension or a later admin change', async () => {
    await setSettings(ctx.payload, { rules: { observeUntil: PAST, ...rulesOnly({ activationBurst: 'suspend' }) } })
    const id = await burstLicense()
    await sweep()
    await transition(ctx.payload, id, 'active', { source: 'admin', reason: 'manual', actorUser: ctx.ids.admin })
    await transition(ctx.payload, id, 'suspended', { source: 'payment', reason: 'payment_dispute' })
    await expect(restoreRuleSuspension(ctx.payload, { license: id, actorUser: ctx.ids.admin, reason: 'x' })).rejects.toMatchObject({ status: 409, code: 'not_rule_suspension' })
    expect(await status(id)).toBe('suspended')
    expect((await logs(id)).at(-1)).toMatchObject({ source: 'payment', reason: 'payment_dispute' })
    // The rule engine never evaluates a non-active (payment-suspended) license.
    expect((await sweep()).hits).toBe(0)
    expect(await status(id)).toBe('suspended')
  })

  it('starts a new episode in the same millisecond after resolving and restores safely even with malformed detail JSON', async () => {
    await setSettings(ctx.payload, { rules: { observeUntil: PAST, ...rulesOnly({ activationBurst: 'suspend' }) } })
    const id = await burstLicense()
    const fixedNow = new Date()
    await sweep({ now: () => fixedNow })
    expect(await status(id)).toBe('suspended')
    await ctx.run(`UPDATE security_events SET detail = 'not-json' WHERE license_id = ${id}`)
    await restoreRuleSuspension(ctx.payload, { license: id, actorUser: ctx.ids.admin, reason: 'fp', now: fixedNow })
    expect(await status(id)).toBe('active')

    // With suppressDays=0 and a fixed clock, resolving and re-sweeping in the same ms starts a new episode without dedupe collision.
    await setSettings(ctx.payload, { rules: { observeUntil: PAST, ...rulesOnly({ activationBurst: 'notify' }), activationBurst: { mode: 'notify', threshold: 5, suppressDays: 0 } } })
    const { id: id2 } = await createLicense(ctx)
    for (let i = 0; i < 6; i++) await insertActivation(ctx, id2, { activatedAt: new Date(fixedNow.getTime() - 10 * 60_000).toISOString() })
    await sweep({ now: () => fixedNow })
    await ctx.run(`UPDATE security_events SET triage = 'resolved' WHERE license_id = ${id2}`)
    await sweep({ now: () => fixedNow })
    expect(await events(`license_id = ${id2}`)).toHaveLength(2)
  })
})

describe('other sweep duties', () => {
  it('dry run writes nothing and reports the decision', async () => {
    await setSettings(ctx.payload, { rules: { observeUntil: PAST, ...rulesOnly({ activationBurst: 'suspend' }) } })
    const id = await burstLicense()
    const { id: expired } = await createLicense(ctx)
    await ctx.run(`UPDATE licenses SET expires_at = '${ago(2 * HOUR)}' WHERE id = ${expired}`)
    const snapshot = async () => JSON.stringify([
      (await ctx.run('SELECT * FROM security_events')).rows, (await ctx.run('SELECT * FROM license_status_log')).rows,
      (await ctx.run('SELECT id, status, status_reason FROM licenses')).rows,
    ])
    const before = await snapshot()
    const report = await sweep({ dryRun: true, retention: true })
    expect(report).toMatchObject({ dryRun: true, outcomes: { suspended: 1 }, expired: 1, notify: null, retention: null })
    expect(await snapshot()).toBe(before)
    expect(await status(id)).toBe('active')
  })

  it('records license.expired once per license and expiry date (status unchanged) and never suspends expired or expires revoked licenses', async () => {
    const { id } = await createLicense(ctx)
    for (let i = 0; i < 6; i++) await insertActivation(ctx, id, { activatedAt: ago(10 * 60_000) })
    await setSettings(ctx.payload, { rules: { observeUntil: PAST, ...rulesOnly({ activationBurst: 'suspend' }) } })
    await ctx.run(`UPDATE licenses SET expires_at = '${ago(HOUR)}' WHERE id = ${id}`)

    const { id: revoked } = await createLicense(ctx)
    await ctx.run(`UPDATE licenses SET status = 'revoked', expires_at = '${ago(HOUR)}' WHERE id = ${revoked}`)

    const report = await sweep()
    expect(report.hits).toBe(0)
    expect((await sweep()).expired).toBe(0)
    expect(await events(`type = 'license.expired' AND license_id = ${id}`)).toMatchObject([{ license: id, severity: 'info' }])
    expect(await events(`type = 'license.expired' AND license_id = ${revoked}`)).toEqual([])
    expect(await status(id)).toBe('active')
    expect(await logs(id)).toEqual([])
  })

  it('evaluates ip spread, clone repeats and churn from window data', async () => {
    await setSettings(ctx.payload, { rules: { ...rulesOnly({ ipSpread: 'notify', cloneSuspected: 'observe', activationChurn: 'notify' }), ipSpread: { mode: 'notify', threshold: 2 }, activationChurn: { mode: 'notify', threshold: 2 } } })
    const { id } = await createLicense(ctx)
    const device = await insertActivation(ctx, id, { lastSeenAt: ago(HOUR), prefix: '198.51.100.0/24' })
    await insertEvent(ctx, { type: 'activation.created', license: id, prefix: '203.0.113.0/24' })
    await insertEvent(ctx, { type: 'download.started', license: id, prefix: '192.0.2.0/24' })
    await insertEvent(ctx, { type: 'activation.clone_suspected', license: id, activation: device, count: 3 })
    for (let i = 0; i < 2; i++) await insertActivation(ctx, id, { status: 'deactivated', endReason: 'user', endedAt: ago(HOUR) })
    const report = await sweep()
    expect(report.actions.map((a) => `${a.rule}:${a.outcome}`).sort()).toEqual(['activationChurn:notified', 'cloneSuspected:observed', 'ipSpread:notified'])
    // A rule's own events are not rule input (no feedback loop).
    expect((await sweep()).hits).toBe(3)
    expect(await events(`source = 'rule'`)).toHaveLength(3)
  })

  it('handles 10k activations within budget', async () => {
    const { id: template } = await createLicense(ctx)
    const columns = (await ctx.run(`PRAGMA table_info(licenses)`)).rows.map((r) => String(r.name)).filter((c) => !['id', 'key', 'public_id'].includes(c))
    const list = columns.map((c) => `"${c}"`).join(', ')
    await ctx.run(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 200)
      INSERT INTO licenses (key, public_id, ${list}) SELECT 'PERF-' || i || '-' || hex(randomblob(4)), lower(hex(randomblob(12))), ${list} FROM licenses, n WHERE licenses.id = ${template}`)
    await ctx.run(`WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i < 9999)
      INSERT INTO license_activations (public_id, license_id, customer_id, status, device_public_key, device_key_thumbprint, fingerprint_hash,
        activated_at, last_seen_at, last_ip_prefix)
      SELECT lower(hex(randomblob(12))), (SELECT min(id) FROM licenses WHERE key LIKE 'PERF-%') + (i % 200), ${ctx.ids.customer}, 'active',
        hex(randomblob(16)), hex(randomblob(16)), hex(randomblob(32)), '${ago(48 * HOUR)}', '${ago(HOUR)}', '10.' || (i % 250) || '.' || (i % 7) || '.0/24'
      FROM n`)
    await setSettings(ctx.payload, { rules: rulesOnly({ ipSpread: 'notify', activationBurst: 'notify', activationChurn: 'notify' }) })
    const started = performance.now()
    const report = await sweep()
    expect(performance.now() - started).toBeLessThan(30_000)
    expect(report.licenses).toBeGreaterThanOrEqual(200)
    expect(report.outcomes.notified).toBe(200)
  }, 120000)

  it('privacy: logs, events and admin e-mails carry no full IP, e-mail, license key or fingerprint', async () => {
    const mail = stubMail(ctx.payload)
    try {
      await setSettings(ctx.payload, {
        rules: { observeUntil: PAST, ...rulesOnly({ activationBurst: 'suspend' }) },
        notifications: { alertEmails: [{ email: 'ops@example.test' }] },
      })
      const id = await burstLicense()
      await ctx.run(`UPDATE license_activations SET last_ip_hash = 'SECRET-IP-HASH-VALUE', last_ip_prefix = '203.0.113.0/24' WHERE license_id = ${id}`)
      const { lines, log } = captureLog()
      const report = await sweep({ log, origin: 'https://site.test' })
      expect(report.notify).toMatchObject({ smtp: true, sent: { admin: 1, customerSuspended: 1 } })
      const key = String((await ctx.run(`SELECT key FROM licenses WHERE id = ${id}`)).rows[0]!.key)
      const fingerprints = (await ctx.run(`SELECT fingerprint_hash AS f FROM license_activations WHERE license_id = ${id}`)).rows.map((r) => String(r.f))
      const admin = mail.sent.find((m) => JSON.stringify(m.to).includes('ops@example.test'))!
      const customer = mail.sent.find((m) => JSON.stringify(m.to).includes(CUSTOMER.email))!
      expect(customer.text).not.toContain(key)
      const scanned = [JSON.stringify(report), lines.join('\n'), admin.subject, admin.text, admin.html, JSON.stringify(await events())]
      for (const text of scanned) {
        expect(text).not.toContain(CUSTOMER.email)
        expect(text).not.toContain(key)
        expect(text).not.toContain('SECRET-IP-HASH-VALUE')
        expect(text).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b(?!\/)/)
        for (const f of fingerprints) expect(text).not.toContain(f)
      }
    } finally {
      mail.restore()
    }
  })
})
