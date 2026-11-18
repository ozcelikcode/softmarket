import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { runRetention } from '../../src/lib/licensing/rules/retention'
import { normalizeSweepSettings } from '../../src/lib/licensing/rules/settings'
import { createLicense, setupLicensingDb, type Ctx } from './helpers/licensing-db'
import { HOUR, ago, insertActivation, insertEvent, resetLicensingRows } from './helpers/licensing-sweep'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

/* L5 retention (plan §6) on a temporary SQLite: only what is past its cutoff is cleared or deleted. */

let ctx: Ctx
const DAY = 24 * HOUR
const settings = normalizeSweepSettings({})
const count = async (sql: string) => Number((await ctx.run(sql)).rows[0]!.n)

beforeAll(async () => { ctx = await setupLicensingDb('l5-retention') }, 240000)
afterAll(async () => { await ctx?.destroy() })
beforeEach(async () => { await resetLicensingRows(ctx) })

describe('licensing retention', () => {
  it('clears event IP fields after 30 days and deletes events after 180 days (never pending notifications)', async () => {
    const fresh = await insertEvent(ctx, { type: 'api.replay', prefix: '203.0.113.0/24', ipHash: 'h1', country: 'TR', lastSeenAt: ago(29 * DAY) })
    const stale = await insertEvent(ctx, { type: 'api.replay', prefix: '203.0.113.0/24', ipHash: 'h2', country: 'TR', lastSeenAt: ago(31 * DAY) })
    const old = await insertEvent(ctx, { type: 'api.replay', lastSeenAt: ago(181 * DAY) })
    const oldPending = await insertEvent(ctx, { type: 'api.replay', lastSeenAt: ago(181 * DAY), notifyState: 'pending' })
    const report = await runRetention(ctx.payload, settings, new Date())
    expect(report).toMatchObject({ eventIp: 1, events: 1 })
    const rows = (await ctx.run(`SELECT id, ip_prefix AS p, ip_hash AS h, country AS c FROM security_events ORDER BY id`)).rows
    expect(rows).toEqual([
      { id: fresh, p: '203.0.113.0/24', h: 'h1', c: 'TR' },
      { id: stale, p: null, h: null, c: null },
      { id: oldPending, p: null, h: null, c: null },
    ])
    expect(rows.find((r) => r.id === old)).toBeUndefined()
    // Idempotent.
    expect(await runRetention(ctx.payload, settings, new Date())).toMatchObject({ eventIp: 0, events: 0 })
  })

  it('clears activation IP data after 90 days of inactivity or after the end', async () => {
    const { id } = await createLicense(ctx)
    const ip = { prefix: '198.51.100.0/24', ipHash: 'hash', country: 'TR' }
    const recent = await insertActivation(ctx, id, { ...ip, lastSeenAt: ago(89 * DAY) })
    const idle = await insertActivation(ctx, id, { ...ip, lastSeenAt: ago(91 * DAY) })
    const endedRecently = await insertActivation(ctx, id, { ...ip, status: 'deactivated', endReason: 'user', lastSeenAt: ago(100 * DAY), endedAt: ago(10 * DAY) })
    const endedLongAgo = await insertActivation(ctx, id, { ...ip, status: 'deactivated', endReason: 'user', endedAt: ago(91 * DAY) })
    expect((await runRetention(ctx.payload, settings, new Date())).activationIp).toBe(2)
    const kept = (await ctx.run(`SELECT id FROM license_activations WHERE last_ip_prefix IS NOT NULL ORDER BY id`)).rows.map((r) => r.id)
    expect(kept).toEqual([recent, endedRecently])
    expect(await count(`SELECT count(*) AS n FROM license_activations WHERE id IN (${idle}, ${endedLongAgo}) AND last_ip_hash IS NULL AND last_country IS NULL`)).toBe(2)
  })

  it('deletes ended activations and status history only after the license ended long enough ago', async () => {
    const { id: running } = await createLicense(ctx)
    const { id: expired } = await createLicense(ctx)
    const { id: revoked } = await createLicense(ctx)
    const longAgo = new Date(Date.now() - 11 * 365 * DAY).toISOString()
    const threeYears = new Date(Date.now() - 3 * 365 * DAY).toISOString()
    await ctx.run(`UPDATE licenses SET expires_at = '${threeYears}' WHERE id = ${expired}`)
    await ctx.run(`UPDATE licenses SET status = 'revoked', status_changed_at = '${longAgo}' WHERE id = ${revoked}`)
    for (const license of [running, expired, revoked]) {
      await insertActivation(ctx, license, { status: 'deactivated', endReason: 'user', endedAt: longAgo })
      await insertActivation(ctx, license, { status: 'active' })
      await ctx.run(`INSERT INTO license_status_log (license_id, "from", "to", source, at) VALUES (${license}, 'active', 'suspended', 'admin', '${longAgo}')`)
    }
    const report = await runRetention(ctx.payload, settings, new Date())
    // Ended activations of the expired (3 y > 2 y) and revoked licenses; active devices and running licenses are kept.
    expect(report.activations).toBe(2)
    expect(await count(`SELECT count(*) AS n FROM license_activations WHERE license_id = ${running}`)).toBe(2)
    expect(await count(`SELECT count(*) AS n FROM license_activations WHERE status = 'active'`)).toBe(3)
    // Status history: only the license that ended more than 10 years ago.
    expect(report.statusLog).toBe(1)
    expect(await count(`SELECT count(*) AS n FROM license_status_log WHERE license_id = ${revoked}`)).toBe(0)
    expect(await count(`SELECT count(*) AS n FROM license_status_log WHERE license_id IN (${running}, ${expired})`)).toBe(2)
  })

  it('deletes blocks expired or lifted more than 90 days ago and audit rows older than 2 years', async () => {
    const block = (expires: string | null, lifted: string | null) => ctx.run(`INSERT INTO security_blocks (kind, value, scope, active, expires_at, source, lifted_at)
      VALUES ('ip_prefix', '203.0.113.0/24', 'api', 0, ${expires ? `'${expires}'` : 'NULL'}, 'admin', ${lifted ? `'${lifted}'` : 'NULL'})`)
    await block(ago(91 * DAY), null)
    await block(null, ago(91 * DAY))
    await block(ago(89 * DAY), null)
    await block(null, null)
    const audit = (at: string) => ctx.run(`INSERT INTO security_audit (action, actor_kind, at, result) VALUES ('block.add', 'admin', '${at}', 'ok')`)
    await audit(new Date(Date.now() - 2 * 365 * DAY - DAY).toISOString())
    await audit(new Date(Date.now() - 365 * DAY).toISOString())
    const report = await runRetention(ctx.payload, settings, new Date())
    expect(report).toMatchObject({ blocks: 2, audit: 1 })
    expect(await count(`SELECT count(*) AS n FROM security_blocks`)).toBe(2)
    expect(await count(`SELECT count(*) AS n FROM security_audit`)).toBe(1)
  })

  it('settings below the code floors are clamped (never deletes earlier than the floor)', async () => {
    const low = normalizeSweepSettings({ retention: { eventIpDays: 1, eventDays: 1 } })
    expect(low.retention).toMatchObject({ eventIpDays: 7, eventDays: 30 })
    await insertEvent(ctx, { type: 'api.replay', prefix: '203.0.113.0/24', lastSeenAt: ago(6 * DAY) })
    await insertEvent(ctx, { type: 'api.replay', lastSeenAt: ago(29 * DAY) })
    expect(await runRetention(ctx.payload, low, new Date())).toMatchObject({ eventIp: 0, events: 0 })
  })

  it('spares open high/critical events, active false-positive suppressions, block-linked events, recently lifted blocks, newer logs and leap-day audit rows', async () => {
    const openHigh = await insertEvent(ctx, { type: 'system.rule_circuit_open', severity: 'critical', triage: 'open', lastSeenAt: ago(200 * DAY) })
    const fpSuppressed = await insertEvent(ctx, { type: 'license.ip_spread', source: 'rule', severity: 'medium', triage: 'false_positive', lastSeenAt: ago(200 * DAY) })
    await ctx.run(`UPDATE security_events SET triaged_at = '${ago(10 * DAY)}' WHERE id = ${fpSuppressed}`)
    const blockedEvent = await insertEvent(ctx, { type: 'api.replay', severity: 'low', triage: 'resolved', lastSeenAt: ago(200 * DAY) })
    await ctx.run(`INSERT INTO security_blocks (kind, value, scope, active, source, event_id) VALUES ('ip_prefix', '203.0.113.0/24', 'api', 1, 'admin', ${blockedEvent})`)

    // A block that expired 100 days ago but was lifted only 10 days ago must respect blockDays from lifted_at.
    await ctx.run(`INSERT INTO security_blocks (kind, value, scope, active, expires_at, source, lifted_at)
      VALUES ('ip_prefix', '198.51.100.0/24', 'api', 0, '${ago(100 * DAY)}', 'admin', '${ago(10 * DAY)}')`)

    // A license that expired 11 years ago with a status transition recorded 1 year ago keeps the newer status log row.
    const { id: lic } = await createLicense(ctx)
    const elevenYearsAgo = new Date(Date.now() - 11 * 365 * DAY).toISOString()
    await ctx.run(`UPDATE licenses SET expires_at = '${elevenYearsAgo}' WHERE id = ${lic}`)
    await ctx.run(`INSERT INTO license_status_log (license_id, "from", "to", source, at) VALUES (${lic}, 'active', 'suspended', 'admin', '${ago(365 * DAY)}')`)

    const report = await runRetention(ctx.payload, settings, new Date())
    expect(report).toMatchObject({ events: 0, blocks: 0, statusLog: 0 })
    expect(await count(`SELECT count(*) AS n FROM security_events WHERE id IN (${openHigh}, ${fpSuppressed}, ${blockedEvent})`)).toBe(3)

    // Leap-day math: on 2028-02-29, a 2-year audit retention must NOT delete an audit row from 2026-02-28T12:00:00.000Z.
    const leapNow = new Date('2028-02-29T04:00:00.000Z')
    await ctx.run(`INSERT INTO security_audit (action, actor_kind, at, result) VALUES ('block.add', 'admin', '2026-02-28T12:00:00.000Z', 'ok')`)
    await ctx.run(`INSERT INTO security_audit (action, actor_kind, at, result) VALUES ('block.add', 'admin', '2026-02-27T12:00:00.000Z', 'ok')`)
    const leapReport = await runRetention(ctx.payload, settings, leapNow)
    expect(leapReport.audit).toBe(1)
    expect(await count(`SELECT count(*) AS n FROM security_audit WHERE at = '2026-02-28T12:00:00.000Z'`)).toBe(1)
  })
})
