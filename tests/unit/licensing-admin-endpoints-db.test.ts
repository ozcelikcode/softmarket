import { randomBytes } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { runtimeFor } from '../../src/lib/licensing/api/runtime'
import { DENIED_WINDOW_MS } from '../../src/lib/licensing/admin/denied-audit'
import { summarizeSettingsChange } from '../../src/lib/licensing/admin/settings-audit'
import { ORIGIN, createLicense, setupLicensingDb, type Ctx, type Principal } from './helpers/licensing-db'
import { insertActivation, insertEvent, resetLicensingRows, transition } from './helpers/licensing-sweep'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

/*
 * L6b admin action endpoints on a temporary migrated SQLite (never data/softmarket.db, never real e-mail):
 * authorization matrix per endpoint, state transition + exactly one status-log row + exactly one audit row per action,
 * idempotent retry (same requestId), stale state 409, revoke confirmation + mandatory reason, restore only of the right
 * suspension, block cache invalidation, signing key rotation without private material, settings audit.
 */

let ctx: Ctx
const PROXY_SECRET = 'l6b-proxy-secret-0123456789abcdef0123456789'

type Extra = Record<string, string>
type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
async function requestPath(method: Method, path: string, principal: Principal, body: unknown = {}, extra: Extra = {}, raw?: string) {
  const routes = await import('@payloadcms/next/routes')
  const cfg = (await import('../../src/payload.config')).default
  const handler = {
    GET: routes.REST_GET,
    POST: routes.REST_POST,
    PATCH: routes.REST_PATCH,
    PUT: routes.REST_PUT,
    DELETE: routes.REST_DELETE,
  }[method](cfg)
  const slug = path.split('/').filter(Boolean)
  const trailing = path.endsWith('/') ? '/' : ''
  const res = await handler(new Request(`${ORIGIN}/api/${slug.join('/')}${trailing}`, {
    method,
    headers: { host: '127.0.0.1:3100', 'content-type': 'application/json', ...ctx.headers[principal], ...extra },
    ...(method === 'GET' ? {} : { body: raw ?? JSON.stringify(body) }),
  }), { params: Promise.resolve({ slug }) })
  const text = await res.text()
  let json: Record<string, unknown> = {}
  try { json = JSON.parse(text) as Record<string, unknown> } catch { json = { raw: text } }
  return { status: res.status, json, text }
}

const post = (path: string, principal: Principal, body: unknown = {}, extra: Extra = {}, raw?: string) =>
  requestPath('POST', path, principal, body, extra, raw)

const rid = () => randomBytes(12).toString('hex')
const one = async (sql: string) => (await ctx.run(sql)).rows[0] ?? null
const count = async (table: string, where = '1=1') => Number((await one(`SELECT count(*) AS n FROM ${table} WHERE ${where}`))!.n)
const license = async (id: number) => (await one(`SELECT status, status_changed_at AS changedAt, status_reason AS reason, status_source AS source FROM licenses WHERE id = ${id}`))!
const expectedOf = async (id: number) => {
  const row = await license(id)
  return { status: String(row.status), changedAt: (row.changedAt as string | null) ?? null }
}
const logs = async (id: number) => (await ctx.run(`SELECT "from", "to", reason, source, actor_user_id AS actor, note, event_id AS event, revert_of_id AS revertOf
  FROM license_status_log WHERE license_id = ${id} ORDER BY id`)).rows
const audits = async () => (await ctx.run(`SELECT a.action, a.actor_user_id AS actor, a.actor_kind AS kind, a.reason, a.note, a.ip_prefix AS ip, a.result, a.nonce,
  r.licenses_id AS license, r.license_activations_id AS activation, r.security_blocks_id AS block, r.security_events_id AS event
  FROM security_audit a LEFT JOIN security_audit_rels r ON r.parent_id = a.id WHERE a.result = 'ok' ORDER BY a.id`)).rows
const denied = async () => (await ctx.run(`SELECT a.action, a.actor_user_id AS actor, a.actor_kind AS kind, a.reason, a.note, a.ip_prefix AS ip, a.result, a.nonce, a.at,
  r.licenses_id AS license FROM security_audit a LEFT JOIN security_audit_rels r ON r.parent_id = a.id WHERE a.result = 'denied' ORDER BY a.id`)).rows

/** A rule suspension as the L5 sweep writes it (status, summary and one log row bound to its event). */
async function ruleSuspend(id: number) {
  const event = await insertEvent(ctx, { type: 'activation.burst', source: 'rule', license: id, severity: 'high' })
  await ctx.run(`UPDATE security_events SET rule_key = 'activationBurst', action_taken = 'suspended' WHERE id = ${event}`)
  const at = new Date().toISOString()
  await ctx.run(`UPDATE licenses SET status = 'suspended', status_changed_at = '${at}', status_reason = 'rule_activation_burst', status_source = 'rule' WHERE id = ${id}`)
  await ctx.run(`INSERT INTO license_status_log (license_id, "from", "to", reason, source, rule_key, event_id, at, revertible)
    VALUES (${id}, 'active', 'suspended', 'rule_activation_burst', 'rule', 'activationBurst', ${event}, '${at}', 1)`)
  return event
}

beforeAll(async () => {
  ctx = await setupLicensingDb('l6b-admin')
}, 240_000)
afterAll(async () => { await ctx?.destroy() })
let testTime = Date.now()
beforeEach(async () => {
  testTime += DENIED_WINDOW_MS
  vi.setSystemTime(testTime)
  await resetLicensingRows(ctx)
  delete process.env.FORM_PROXY_SECRET
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('authorization (P6 matrix on every L6b endpoint)', () => {
  it('admin panel session only: anonymous 401; customer, editor, API key, bearer, cross-site 403; JSON only', async () => {
    const { id } = await createLicense(ctx)
    const act = await insertActivation(ctx, id)
    const event = await insertEvent(ctx, { type: 'api.replay', license: id })
    const [{ id: block }] = (await ctx.run(`INSERT INTO security_blocks (kind, value, scope, active, source) VALUES ('ip_prefix', '198.51.100.0/24', 'api', 1, 'admin') RETURNING id`)).rows as [{ id: number }]
    const paths = [
      ...['suspend', 'revoke', 'restore', 'reactivate'].map((a) => `licenses/${id}/${a}`),
      `license-activations/${act}/deactivate`,
      ...['acknowledge', 'resolve', 'false-positive', 'block'].map((a) => `security-events/${event}/${a}`),
      'security-blocks/add', `security-blocks/${block}/lift`,
      'globals/licensing-settings/rotate-signing-key',
    ]
    const body = { requestId: rid(), reason: 'matrix test' }
    for (const path of paths) {
      expect((await post(path, 'anonymous', body)).status, path).toBe(401)
      for (const who of ['customer', 'editor', 'apiKey', 'adminBearer'] as const) {
        const res = await post(path, who, body)
        expect(res.status, `${path} ${who}`).toBe(403)
      }
      expect((await post(path, 'admin', body, { origin: 'https://evil.example' })).json, path).toEqual({ code: 'unauthorized' })
      expect((await post(path, 'admin', body, { 'sec-fetch-site': 'cross-site' })).status, path).toBe(403)
      expect((await post(path, 'admin', body, { 'content-type': 'text/plain' })).status, path).toBe(415)
    }
    // Nothing was written by any refused request.
    expect(await count('security_audit', "result = 'ok'")).toBe(0)
    expect(await count('license_status_log')).toBe(0)
    expect((await license(id)).status).toBe('active')
    expect(await count('security_blocks', 'active = 1')).toBe(1)
  })

  it('rejects malformed, oversized and incomplete bodies before touching data', async () => {
    const { id } = await createLicense(ctx)
    const expected = await expectedOf(id)
    expect((await post(`licenses/${id}/suspend`, 'admin', undefined, {}, '{')).json).toEqual({ code: 'malformed' })
    expect((await post(`licenses/${id}/suspend`, 'admin', { requestId: rid(), reason: 'x'.repeat(3000), expected })).status).toBe(413)
    expect((await post(`licenses/${id}/suspend`, 'admin', { requestId: 'short', reason: 'valid reason', expected })).json).toEqual({ code: 'invalid_requestId' })
    expect((await post(`licenses/${id}/suspend`, 'admin', { requestId: rid(), reason: '  ', expected })).json).toEqual({ code: 'reason_required' })
    expect((await post(`licenses/${id}/suspend`, 'admin', { requestId: rid(), reason: 'ok reason' })).json).toEqual({ code: 'expected_required' })
    expect((await post('licenses/abc/suspend', 'admin', { requestId: rid(), reason: 'ok reason', expected })).status).toBe(404)
    expect((await post('licenses/0/suspend', 'admin', { requestId: rid(), reason: 'ok reason', expected })).status).toBe(404)
    expect((await post('licenses/01/suspend', 'admin', { requestId: rid(), reason: 'ok reason', expected })).status).toBe(404)
    expect((await post('licenses/1%2F..%2F2/suspend', 'admin', { requestId: rid(), reason: 'ok reason', expected })).status).toBe(404)
    expect((await post('licenses/999999/suspend', 'admin', { requestId: rid(), reason: 'ok reason', expected })).json).toEqual({ code: 'not_found' })
    expect(await count('security_audit', "result = 'ok'")).toBe(0)
  })

  it('blocks GET/PATCH/PUT/DELETE, method-override, empty Authorization, and trailing-slash auth bypasses', async () => {
    const { id } = await createLicense(ctx)
    const expected = await expectedOf(id)
    const body = { requestId: rid(), reason: 'method check', expected }
    for (const method of ['GET', 'PATCH', 'PUT', 'DELETE'] as const) {
      expect((await requestPath(method, `licenses/${id}/suspend`, 'admin', body)).status, method).toBe(404)
    }
    expect((await post(`licenses/${id}/suspend`, 'admin', body, { 'x-http-method-override': 'GET' })).status).toBe(404)
    expect((await post(`licenses/${id}/suspend`, 'admin', body, { authorization: '' })).status).toBe(403)
    expect((await post(`licenses/${id}/suspend/`, 'anonymous', body)).status).toBe(401)
    expect((await post(`licenses/${id}/suspend/`, 'editor', body)).status).toBe(403)
    expect((await post('security-blocks', 'admin', { kind: 'ip_prefix', value: '198.51.100.0/24', scope: 'api', source: 'admin' })).status).toBe(403)
    expect((await license(id)).status).toBe('active')
    expect(await count('security_audit', "result = 'ok'")).toBe(0)
  })
})

describe('license actions', () => {
  it('suspend: one log row, one audit row, customer e-mail queued; retry is idempotent; stale state is 409', async () => {
    const { id } = await createLicense(ctx)
    const expected = await expectedOf(id)
    const body = { requestId: rid(), reason: 'chargeback investigation', note: 'ticket 42', expected }
    const res = await post(`licenses/${id}/suspend`, 'admin', body)
    expect(res).toMatchObject({ status: 200, json: { code: 'suspended' } })
    expect(await license(id)).toMatchObject({ status: 'suspended', reason: 'manual', source: 'admin' })
    const [log] = await logs(id)
    expect(await logs(id)).toHaveLength(1)
    expect(log).toMatchObject({ from: 'active', to: 'suspended', reason: 'manual', source: 'admin', actor: ctx.ids.admin, note: 'ticket 42' })
    const event = await one(`SELECT type, source, action_taken AS action, customer_id AS customer, notify_state AS notify, triage FROM security_events WHERE id = ${log!.event}`)
    expect(event).toMatchObject({ type: 'license.status_changed', source: 'admin', action: 'suspended', customer: ctx.ids.customer, notify: 'pending', triage: 'resolved' })
    const rows = await audits()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ action: 'license.suspend', actor: ctx.ids.admin, kind: 'admin', reason: 'chargeback investigation', result: 'ok', license: id })
    expect(String(rows[0]!.nonce)).toMatch(new RegExp(`^admin:${ctx.ids.admin}:${body.requestId}:[0-9a-f]{32}$`))

    // Same request again (lost response): nothing new.
    expect((await post(`licenses/${id}/suspend`, 'admin', body)).json).toEqual({ code: 'replayed', replayed: true })
    expect(await logs(id)).toHaveLength(1)
    expect(await audits()).toHaveLength(1)
    // A new request with the old view of the license: stale.
    expect((await post(`licenses/${id}/suspend`, 'admin', { ...body, requestId: rid() })).json).toEqual({ code: 'stale' })
    // Current view but wrong state for the action.
    expect((await post(`licenses/${id}/suspend`, 'admin', { ...body, requestId: rid(), expected: await expectedOf(id) })).json).toEqual({ code: 'invalid_transition' })
    expect(await count('security_audit', "result = 'ok'")).toBe(1)
    expect(await count('security_events')).toBe(1)
  })

  it('idempotency: rejects requestId reuse with different body/action/target (409) and isolates admins', async () => {
    const { id } = await createLicense(ctx)
    const { id: secondLicense } = await createLicense(ctx)
    const sharedRid = rid()
    const act = await insertActivation(ctx, id)
    expect((await post(`license-activations/${act}/deactivate`, 'admin', { requestId: sharedRid, reason: 'release first', mode: 'release' })).json).toEqual({ code: 'device_released' })
    // Same requestId with different mode or different target/action must fail 409 idempotency_conflict instead of returning 200 replayed.
    const diffMode = await post(`license-activations/${act}/deactivate`, 'admin', { requestId: sharedRid, reason: 'release first', mode: 'revoke' })
    expect(diffMode).toMatchObject({ status: 409, json: { code: 'idempotency_conflict' } })
    const diffAction = await post(`licenses/${id}/suspend`, 'admin', { requestId: sharedRid, reason: 'reuse across action', expected: await expectedOf(id) })
    expect(diffAction).toMatchObject({ status: 409, json: { code: 'idempotency_conflict' } })
    const blockRid = rid()
    expect((await post('security-blocks/add', 'admin', { requestId: blockRid, reason: 'first ip', kind: 'ip_prefix', value: '198.51.100.0/24', durationHours: 24 })).json).toMatchObject({ code: 'blocked' })
    expect((await post('security-blocks/add', 'admin', { requestId: blockRid, reason: 'second ip', kind: 'ip_prefix', value: '203.0.113.0/24', durationHours: 24 })).json).toEqual({ code: 'idempotency_conflict' })

    const secondAdmin = await ctx.payload.create({
      collection: 'users',
      overrideAccess: true,
      data: { email: 'admin2.l6b@example.test', password: 'Admin2-l6b-password-123', name: 'Admin2', roles: ['admin'] } as never,
    })
    try {
      const secondToken = (await ctx.payload.login({ collection: 'users', data: { email: 'admin2.l6b@example.test', password: 'Admin2-l6b-password-123' } })).token!
      const resOther = await post(`licenses/${secondLicense}/suspend`, 'admin', { requestId: sharedRid, reason: 'second admin', expected: await expectedOf(secondLicense) }, { cookie: `payload-token=${secondToken}` })
      expect(resOther).toMatchObject({ status: 200, json: { code: 'suspended' } })
      expect(String((await audits()).at(-1)!.nonce)).toMatch(new RegExp(`^admin:${secondAdmin.id}:${sharedRid}:[0-9a-f]{32}$`))
    } finally {
      await ctx.run(`DELETE FROM security_audit WHERE actor_user_id = ${Number(secondAdmin.id)}`)
      await ctx.run(`DELETE FROM license_status_log WHERE actor_user_id = ${Number(secondAdmin.id)}`)
      await ctx.run(`DELETE FROM security_events WHERE actor_user_id = ${Number(secondAdmin.id)}`)
      await ctx.payload.delete({ collection: 'users', id: secondAdmin.id, overrideAccess: true })
    }
  })

  it('concurrent admins: one suspension, one log row, one audit row (serial BEGIN IMMEDIATE + re-read)', async () => {
    const { id } = await createLicense(ctx)
    const expected = await expectedOf(id)
    const same = rid()
    const results = await Promise.all([
      post(`licenses/${id}/suspend`, 'admin', { requestId: rid(), reason: 'admin one', expected }),
      post(`licenses/${id}/suspend`, 'admin', { requestId: rid(), reason: 'admin two', expected }),
      post(`licenses/${id}/suspend`, 'admin', { requestId: same, reason: 'double click', expected }),
      post(`licenses/${id}/suspend`, 'admin', { requestId: same, reason: 'double click', expected }),
    ])
    const codes = results.map((r) => r.json.code)
    expect(codes.filter((c) => c === 'suspended')).toHaveLength(1)
    expect(codes.every((c) => ['suspended', 'stale', 'replayed'].includes(String(c)))).toBe(true)
    expect(await logs(id)).toHaveLength(1)
    expect(await audits()).toHaveLength(1)
  })

  it('restore of a manual suspension: back to active, revertOf, customer "re-enabled" re-armed; reactivate refuses it', async () => {
    const { id } = await createLicense(ctx)
    await post(`licenses/${id}/suspend`, 'admin', { requestId: rid(), reason: 'manual hold', expected: await expectedOf(id) })
    const [suspension] = await logs(id)
    await ctx.run(`UPDATE security_events SET notify_state = 'sent', detail = json_set(detail, '$.notifyCustomerSuspendedAt', '2026-11-18T00:00:00.000Z') WHERE id = ${suspension!.event}`)
    expect((await post(`licenses/${id}/reactivate`, 'admin', { requestId: rid(), reason: 'wrong button', expected: await expectedOf(id) })).json).toEqual({ code: 'use_restore' })
    const res = await post(`licenses/${id}/restore`, 'admin', { requestId: rid(), reason: 'customer verified', expected: await expectedOf(id) })
    expect(res.json).toEqual({ code: 'restored' })
    expect((await license(id)).status).toBe('active')
    const rows = await logs(id)
    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({ from: 'suspended', to: 'active', reason: 'restore', source: 'admin', revertOf: expect.any(Number) })
    const event = await one(`SELECT notify_state AS notify, detail FROM security_events WHERE id = ${suspension!.event}`)
    expect(event!.notify).toBe('pending')
    expect(JSON.parse(String(event!.detail))).toMatchObject({ restoredAt: expect.any(String) })
    expect((await audits()).map((a) => a.action)).toEqual(['license.suspend', 'license.restore'])
    expect((await post(`licenses/${id}/restore`, 'admin', { requestId: rid(), reason: 'again', expected: await expectedOf(id) })).json).toEqual({ code: 'not_restorable' })
  })

  it('restore of a rule suspension uses the L5 core (false positive + suppression); a payment suspension needs reactivate', async () => {
    const { id } = await createLicense(ctx)
    const event = await ruleSuspend(id)
    const res = await post(`licenses/${id}/restore`, 'admin', { requestId: rid(), reason: 'false alarm', expected: await expectedOf(id) })
    expect(res.json).toEqual({ code: 'restored' })
    expect((await license(id)).status).toBe('active')
    expect(await one(`SELECT triage FROM security_events WHERE id = ${event}`)).toMatchObject({ triage: 'false_positive' })
    expect((await logs(id)).at(-1)).toMatchObject({ reason: 'restore', source: 'admin' })
    const [audit] = await audits()
    expect(audit).toMatchObject({ action: 'license.restore', license: id })
    expect(String(audit!.nonce)).toMatch(new RegExp(`^admin:${ctx.ids.admin}:`))

    const { id: disputed } = await createLicense(ctx)
    await transition(ctx.payload, disputed, 'suspended', { source: 'payment', reason: 'payment_dispute' })
    expect((await post(`licenses/${disputed}/restore`, 'admin', { requestId: rid(), reason: 'dispute won', expected: await expectedOf(disputed) })).json).toEqual({ code: 'not_restorable' })
    const re = await post(`licenses/${disputed}/reactivate`, 'admin', { requestId: rid(), reason: 'dispute won', expected: await expectedOf(disputed) })
    expect(re.json).toEqual({ code: 'reactivated' })
    expect((await logs(disputed)).at(-1)).toMatchObject({ from: 'suspended', to: 'active', reason: 'manual', source: 'admin' })
    expect((await audits()).at(-1)).toMatchObject({ action: 'license.reactivate', license: disputed })
  })

  it('revoke: typed confirmation and reason are mandatory; revokes active devices; terminal', async () => {
    const { id, publicId } = await createLicense(ctx)
    const active = await insertActivation(ctx, id)
    const ended = await insertActivation(ctx, id, { status: 'deactivated', endReason: 'user' })
    const expected = await expectedOf(id)
    expect((await post(`licenses/${id}/revoke`, 'admin', { requestId: rid(), reason: 'fraud', expected })).json).toEqual({ code: 'confirm_required' })
    expect((await post(`licenses/${id}/revoke`, 'admin', { requestId: rid(), reason: 'fraud', expected, confirm: 'nope00' })).json).toEqual({ code: 'confirmation_required' })
    expect((await post(`licenses/${id}/revoke`, 'admin', { requestId: rid(), expected, confirm: publicId.slice(-6) })).json).toEqual({ code: 'reason_required' })
    expect(await count('license_status_log')).toBe(0)
    const res = await post(`licenses/${id}/revoke`, 'admin', { requestId: rid(), reason: 'confirmed fraud', expected, confirm: publicId.slice(-6).toUpperCase() })
    expect(res.json).toEqual({ code: 'revoked', devices: 1 })
    expect(await license(id)).toMatchObject({ status: 'revoked', reason: 'manual', source: 'admin' })
    expect(await logs(id)).toHaveLength(1)
    expect(await one(`SELECT status, end_reason AS r FROM license_activations WHERE id = ${active}`)).toEqual({ status: 'revoked', r: 'license_revoked' })
    expect(await one(`SELECT status FROM license_activations WHERE id = ${ended}`)).toEqual({ status: 'deactivated' })
    expect((await audits()).map((a) => a.action)).toEqual(['license.revoke'])
    for (const action of ['revoke', 'reactivate', 'restore', 'suspend']) {
      const r = await post(`licenses/${id}/${action}`, 'admin', { requestId: rid(), reason: 'after revoke', expected: await expectedOf(id), confirm: publicId.slice(-6) })
      expect(r.status, action).toBe(409)
    }
    expect(await logs(id)).toHaveLength(1)
  })
})

describe('devices and events', () => {
  it('device release / revoke frees the seat once', async () => {
    const { id } = await createLicense(ctx)
    const a = await insertActivation(ctx, id)
    const b = await insertActivation(ctx, id)
    const body = { requestId: rid(), reason: 'lost laptop', mode: 'release' }
    expect((await post(`license-activations/${a}/deactivate`, 'admin', body)).json).toEqual({ code: 'device_released' })
    expect((await post(`license-activations/${a}/deactivate`, 'admin', body)).json).toEqual({ code: 'replayed', replayed: true })
    expect((await post(`license-activations/${a}/deactivate`, 'admin', { ...body, requestId: rid() })).json).toEqual({ code: 'not_active' })
    expect((await post(`license-activations/${b}/deactivate`, 'admin', { requestId: rid(), reason: 'stolen', mode: 'revoke' })).json).toEqual({ code: 'device_revoked' })
    expect((await post(`license-activations/${b}/deactivate`, 'admin', { requestId: rid(), reason: 'stolen', mode: 'wipe' })).json).toEqual({ code: 'invalid_mode' })
    expect((await ctx.run(`SELECT status, end_reason AS r FROM license_activations WHERE license_id = ${id} ORDER BY id`)).rows)
      .toEqual([{ status: 'deactivated', r: 'admin' }, { status: 'revoked', r: 'admin' }])
    expect((await audits()).map((x) => [x.action, x.activation])).toEqual([['activation.deactivate', a], ['activation.deactivate', b]])
    expect(await count('license_status_log')).toBe(0)
  })

  it('triage transitions with stale protection; false positive + restore only for the event that caused the suspension', async () => {
    const event = await insertEvent(ctx, { type: 'api.replay', severity: 'high' })
    expect((await post(`security-events/${event}/acknowledge`, 'admin', { requestId: rid(), reason: 'looking', expectedTriage: 'acknowledged' })).json).toEqual({ code: 'stale' })
    expect((await post(`security-events/${event}/acknowledge`, 'admin', { requestId: rid(), reason: 'looking', expectedTriage: 'open' })).json).toEqual({ code: 'acknowledged' })
    expect((await post(`security-events/${event}/acknowledge`, 'admin', { requestId: rid(), reason: 'looking', expectedTriage: 'acknowledged' })).json).toEqual({ code: 'invalid_transition' })
    expect((await post(`security-events/${event}/resolve`, 'admin', { requestId: rid(), reason: 'benign client bug', note: 'v1.2', expectedTriage: 'acknowledged' })).json).toEqual({ code: 'resolved' })
    expect(await one(`SELECT triage, triaged_by_id AS by, triage_note AS note FROM security_events WHERE id = ${event}`)).toEqual({ triage: 'resolved', by: ctx.ids.admin, note: 'v1.2' })
    expect((await audits()).map((a) => [a.action, a.event, a.note])).toEqual([
      ['event.triage', event, 'open -> acknowledged'], ['event.triage', event, 'acknowledged -> resolved: v1.2'],
    ])

    const { id } = await createLicense(ctx)
    const older = await insertEvent(ctx, { type: 'activation.burst', source: 'rule', license: id })
    const cause = await ruleSuspend(id)
    expect((await post(`security-events/${older}/false-positive`, 'admin', { requestId: rid(), reason: 'false alarm', expectedTriage: 'open', restore: true })).json).toEqual({ code: 'not_rule_suspension' })
    expect((await license(id)).status).toBe('suspended')
    expect((await post(`security-events/${cause}/false-positive`, 'admin', { requestId: rid(), reason: 'false alarm', note: 'office NAT', expectedTriage: 'open', restore: true })).json).toEqual({ code: 'restored' })
    expect((await license(id)).status).toBe('active')
    expect(await one(`SELECT triage, triage_note AS note FROM security_events WHERE id = ${cause}`)).toEqual({ triage: 'false_positive', note: 'office NAT' })
    expect((await audits()).filter((a) => a.action === 'license.restore')).toHaveLength(1)
  })

  it('acknowledging an open circuit-breaker event closes the breaker for the rule engine', async () => {
    const breaker = await insertEvent(ctx, { type: 'system.rule_circuit_open', severity: 'critical', source: 'system' })
    expect((await post(`security-events/${breaker}/acknowledge`, 'admin', { requestId: rid(), reason: 'reviewed spike', expectedTriage: 'open' })).json).toEqual({ code: 'acknowledged' })
    expect(await count('security_events', `type = 'system.rule_circuit_open' AND triage = 'open'`)).toBe(0)
  })
})

describe('blocks', () => {
  it('add and lift invalidate the in-process cache immediately (no 30 s wait)', async () => {
    const blocks = runtimeFor(ctx.payload).blocks
    const now = new Date()
    const network = { address: '203.0.113.9', prefix: '203.0.113.0/24' }
    await blocks.load()
    expect(blocks.matches(now, network)).toBe(false)
    const res = await post('security-blocks/add', 'admin', { requestId: rid(), reason: 'credential stuffing', kind: 'ip_prefix', value: '203.0.113.0/24', durationHours: 24 })
    expect(res.json).toMatchObject({ code: 'blocked', block: expect.any(Number), expiresAt: expect.any(String) })
    await blocks.load()
    expect(blocks.matches(new Date(), network)).toBe(true)
    expect((await post('security-blocks/add', 'admin', { requestId: rid(), reason: 'again', kind: 'ip_prefix', value: '203.0.113.0/24', durationHours: 24 })).json).toEqual({ code: 'already_blocked' })
    const lift = await post(`security-blocks/${res.json.block}/lift`, 'admin', { requestId: rid(), reason: 'customer office' })
    expect(lift.json).toEqual({ code: 'lifted' })
    await blocks.load()
    expect(blocks.matches(new Date(), network)).toBe(false)
    expect((await post(`security-blocks/${res.json.block}/lift`, 'admin', { requestId: rid(), reason: 'again' })).json).toEqual({ code: 'already_lifted' })
    expect(await one(`SELECT active, lifted_by_id AS by, lift_reason AS r, source, created_by_id AS creator FROM security_blocks WHERE id = ${res.json.block}`))
      .toEqual({ active: 0, by: ctx.ids.admin, r: 'customer office', source: 'admin', creator: ctx.ids.admin })
    expect((await audits()).map((a) => [a.action, a.block])).toEqual([['block.add', res.json.block], ['block.lift', res.json.block]])
  })

  it('concurrent blocks.load() during invalidate() retries and returns the fresh committed block', async () => {
    const { createBlocksCache } = await import('../../src/lib/licensing/blocks-cache')
    let resolveFirst!: (rows: unknown[]) => void
    let calls = 0
    const fakePayload = {
      db: {
        drizzle: {
          all: () => {
            calls++
            if (calls === 1) return new Promise((resolve) => { resolveFirst = resolve })
            return Promise.resolve([{ kind: 'ip_prefix', value: '203.0.113.0/24', expires_at: null }])
          },
        },
      },
    }
    const cache = createBlocksCache(fakePayload as never)
    const firstLoad = cache.load()
    cache.invalidate()
    const secondLoad = cache.load()
    resolveFirst([])
    await Promise.all([firstLoad, secondLoad])
    expect(calls).toBe(2)
    expect(cache.matches(new Date(), { address: '203.0.113.9', prefix: '203.0.113.0/24' })).toBe(true)
  })

  it('validates values, warns before an admin blocks their own network, and blocks from an event without exposing hashes', async () => {
    for (const value of ['203.0.113.9/24', '203.0.113.0/16', '10.0.0.0', 'nonsense']) {
      expect((await post('security-blocks/add', 'admin', { requestId: rid(), reason: 'x-test', kind: 'ip_prefix', value, durationHours: 1 })).json, value).toEqual({ code: 'invalid_value' })
    }
    expect((await post('security-blocks/add', 'admin', { requestId: rid(), reason: 'too wide', kind: 'cidr', value: '10.0.0.0/8', durationHours: 1 })).json).toEqual({ code: 'invalid_value' })
    for (const badCidr of ['0.0.0.0/0', '::/0', '2001:db8::/16', '192.0.2.0/024', '203.0.113.0/33', '2001:db8::/129']) {
      expect((await post('security-blocks/add', 'admin', { requestId: rid(), reason: 'bad cidr', kind: 'cidr', value: badCidr, durationHours: 1 })).json, badCidr).toEqual({ code: 'invalid_value' })
    }
    expect((await post('security-blocks/add', 'admin', { requestId: rid(), reason: 'odd', kind: 'ip_prefix', value: '203.0.113.0/24', durationHours: 5 })).json).toEqual({ code: 'invalid_durationHours' })

    // Subnet CIDRs mask host bits so full host IPs are never stored and duplicate subnets are caught.
    const maskedV4 = await post('security-blocks/add', 'admin', { requestId: rid(), reason: 'mask v4', kind: 'cidr', value: '198.51.100.77/24', durationHours: 1 })
    expect(maskedV4).toMatchObject({ status: 200, json: { code: 'blocked' } })
    expect(await one(`SELECT value FROM security_blocks WHERE id = ${maskedV4.json.block}`)).toEqual({ value: '198.51.100.0/24' })
    expect((await post('security-blocks/add', 'admin', { requestId: rid(), reason: 'dup v4', kind: 'cidr', value: '198.51.100.88/24', durationHours: 1 })).json).toEqual({ code: 'already_blocked' })
    const maskedV6 = await post('security-blocks/add', 'admin', { requestId: rid(), reason: 'mask v6', kind: 'cidr', value: '2001:0db8:0001:0002::9/48', durationHours: 1 })
    expect(maskedV6).toMatchObject({ status: 200, json: { code: 'blocked' } })
    expect(await one(`SELECT value FROM security_blocks WHERE id = ${maskedV6.json.block}`)).toEqual({ value: '2001:db8:1::/48' })
    await ctx.run('DELETE FROM security_blocks')
    await ctx.run('DELETE FROM security_audit')

    process.env.FORM_PROXY_SECRET = PROXY_SECRET
    const own = { 'x-softmarket-proxy-secret': PROXY_SECRET, 'x-softmarket-client-ip': '192.0.2.77' }
    const body = { requestId: rid(), reason: 'office test', kind: 'cidr', value: '192.0.2.0/25', durationHours: null }
    expect((await post('security-blocks/add', 'admin', body, own)).json).toEqual({ code: 'self_block_confirmation_required' })
    expect(await count('security_blocks')).toBe(0)
    const ok = await post('security-blocks/add', 'admin', { ...body, confirmSelf: true }, own)
    expect(ok.json).toMatchObject({ code: 'blocked', expiresAt: null })
    expect((await audits()).at(-1)).toMatchObject({ action: 'block.add', ip: '192.0.2.0/24' })

    const { id } = await createLicense(ctx)
    const device = await insertActivation(ctx, id)
    const event = await insertEvent(ctx, { type: 'activation.clone_suspected', license: id, activation: device, prefix: '198.51.100.0/24' })
    const fp = await post(`security-events/${event}/block`, 'admin', { requestId: rid(), reason: 'cloned install', kind: 'fingerprint', durationHours: 168 })
    expect(fp.json).toMatchObject({ code: 'blocked' })
    expect(fp.text).not.toMatch(/[0-9a-f]{64}/)
    const stored = await one(`SELECT b.value, a.fingerprint_hash AS fp, b.event_id AS event FROM security_blocks b, license_activations a WHERE b.id = ${fp.json.block} AND a.id = ${device}`)
    expect(stored!.value).toBe(stored!.fp)
    expect(stored!.event).toBe(event)
    expect((await post(`security-events/${event}/block`, 'admin', { requestId: rid(), reason: 'prefix', kind: 'ip_prefix', durationHours: 1 })).json).toMatchObject({ code: 'blocked' })
    const bare = await insertEvent(ctx, { type: 'api.replay' })
    expect((await post(`security-events/${bare}/block`, 'admin', { requestId: rid(), reason: 'nothing', kind: 'license', durationHours: 1 })).json).toEqual({ code: 'invalid_target' })
  })
})

describe('signing key rotation', () => {
  it('requires the typed word, rotates through the L2 service, audits and alerts, and never returns or logs private material', async () => {
    const master = randomBytes(32).toString('base64url')
    process.env.SOFTMARKET_SECRETS_KEY = master
    delete process.env.SOFTMARKET_LICENSE_SIGNING_KEY
    const lines: string[] = []
    const logger = ctx.payload.logger as unknown as Record<'info' | 'error' | 'warn', (m: unknown) => void>
    const original = { info: logger.info, error: logger.error, warn: logger.warn }
    for (const level of ['info', 'error', 'warn'] as const) logger[level] = (m: unknown) => void lines.push(String(m))
    try {
      await ctx.payload.updateGlobal({ slug: 'licensing-settings', data: { signingKeys: [] } })
      expect((await post('globals/licensing-settings/rotate-signing-key', 'admin', { requestId: rid(), reason: 'yearly', confirm: 'yes' })).json).toEqual({ code: 'confirmation_required' })
      const first = await post('globals/licensing-settings/rotate-signing-key', 'admin', { requestId: rid(), reason: 'initial key', confirm: 'döndür' })
      expect(first.status).toBe(200)
      expect(Object.keys(first.json).sort()).toEqual(['code', 'kid'])
      const body = { requestId: rid(), reason: 'yearly rotation', confirm: 'ROTATE' }
      const second = await post('globals/licensing-settings/rotate-signing-key', 'admin', body)
      expect(second.json).toMatchObject({ code: 'rotated' })
      expect((await post('globals/licensing-settings/rotate-signing-key', 'admin', body)).json).toEqual({ code: 'replayed', replayed: true })
      const settings = await ctx.payload.findGlobal({ slug: 'licensing-settings', depth: 0, overrideAccess: true })
      expect(settings.signingKeys).toHaveLength(2)
      expect(settings.signingKeys!.filter((k) => !k.retiredAt).map((k) => k.kid)).toEqual([second.json.kid])
      expect((await audits()).map((a) => [a.action, a.note])).toEqual([
        ['signing_key.rotate', `kid ${first.json.kid}`], ['signing_key.rotate', `kid ${second.json.kid}`],
      ])
      expect(await count('security_events', `type = 'system.signing_key_rotated' AND notify_state = 'pending' AND triage = 'open'`)).toBe(2)
      const everything = [first.text, second.text, ...lines, JSON.stringify(await audits()), JSON.stringify((await ctx.run('SELECT detail FROM security_events')).rows)].join('\n')
      expect(everything).not.toMatch(/PRIVATE KEY|MC4CAQAwBQYDK2Vw|sm1\./)
      expect(everything).not.toContain(master)
      process.env.SOFTMARKET_LICENSE_SIGNING_KEY = 'externally-managed-key-value'
      expect((await post('globals/licensing-settings/rotate-signing-key', 'admin', { requestId: rid(), reason: 'env', confirm: 'ROTATE' })).json).toEqual({ code: 'environment_key_configured' })
      delete process.env.SOFTMARKET_LICENSE_SIGNING_KEY
      process.env.SOFTMARKET_SECRETS_KEY = randomBytes(32).toString('base64url')
      expect((await post('globals/licensing-settings/rotate-signing-key', 'admin', { requestId: rid(), reason: 'wrong master', confirm: 'ROTATE' })).json).toEqual({ code: 'vault_key_unreadable' })
      delete process.env.SOFTMARKET_SECRETS_KEY
      expect((await post('globals/licensing-settings/rotate-signing-key', 'admin', { requestId: rid(), reason: 'no master', confirm: 'ROTATE' })).json).toEqual({ code: 'vault_key_required' })
    } finally {
      Object.assign(logger, original)
      delete process.env.SOFTMARKET_SECRETS_KEY
      delete process.env.SOFTMARKET_LICENSE_SIGNING_KEY
    }
  })
})

describe('settings audit', () => {
  it('a panel admin save writes one settings.update row with a value summary; e-mail values are never echoed', async () => {
    const before = await ctx.payload.findGlobal({ slug: 'licensing-settings', depth: 0, overrideAccess: true })
    const res = await ctx.rest('POST', 'globals/licensing-settings', 'admin', { rules: { ...before.rules, ipSpread: { ...before.rules?.ipSpread, threshold: 12 } } })
    expect(res.status).toBe(200)
    const rows = await audits()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ action: 'settings.update', actor: ctx.ids.admin, kind: 'admin', result: 'ok' })
    expect(String(rows[0]!.note)).toContain('rules.ipSpread.threshold: 10 -> 12')
    expect(summarizeSettingsChange({ notifications: { alertEmails: [] } }, { notifications: { alertEmails: [{ email: 'ops@example.test' }] } })).toBe('notifications.alertEmails')
    expect(summarizeSettingsChange({ general: { publicHost: 'a@b.c' } }, { general: { publicHost: 'x' } })).toBe('general.publicHost')
    expect(summarizeSettingsChange({ a: 1 }, { a: 1 })).toBeNull()
  })
})

describe('denied admin actions are audited (coalesced, no PII)', () => {
  it('identified callers are audited once per (actor or prefix, action, reason); anonymous and successes are not', async () => {
    process.env.FORM_PROXY_SECRET = PROXY_SECRET
    const own = { 'x-softmarket-proxy-secret': PROXY_SECRET, 'x-softmarket-client-ip': '192.0.2.77' }
    const { id, publicId } = await createLicense(ctx)
    const body = { requestId: rid(), reason: 'denied-audit-secret-reason', expected: await expectedOf(id) }

    expect((await post(`licenses/${id}/suspend`, 'anonymous', body, own)).status).toBe(401)
    expect(await denied()).toEqual([])
    for (let i = 0; i < 3; i += 1) expect((await post(`licenses/${id}/suspend`, 'editor', body, own)).status).toBe(403)
    expect((await post(`licenses/${id}/suspend`, 'customer', body, own)).status).toBe(403)
    expect((await post(`licenses/${id}/suspend`, 'apiKey', body, own)).status).toBe(403)
    expect((await post(`licenses/${id}/suspend`, 'admin', body, { ...own, 'sec-fetch-site': 'same-site' })).status).toBe(403)
    expect((await post(`licenses/${id}/suspend`, 'admin', body, { ...own, 'content-type': 'text/plain' })).status).toBe(415)
    expect((await post(`licenses/${id}/suspend`, 'admin', { ...body, requestId: 'x' }, own)).json).toEqual({ code: 'invalid_requestId' })

    const rows = await denied()
    // editor (3 coalesced), customer, api-key admin, cross-origin admin, 415, invalid requestId: 6 keys.
    expect(rows).toHaveLength(6)
    const editorRow = rows.find((r) => r.actor === ctx.ids.editor)!
    expect(editorRow).toMatchObject({ action: 'license.suspend', kind: 'system', reason: 'forbidden', note: 'count=1 http=403', ip: '192.0.2.0/24', result: 'denied', license: id })
    expect(String(editorRow.nonce)).toMatch(/^denied:[0-9a-f]{24}:\d+$/)
    expect(rows.find((r) => r.reason === 'cross_origin')).toMatchObject({ actor: ctx.ids.admin, kind: 'admin', note: 'count=1 http=403' })
    expect(rows.find((r) => r.reason === 'invalid_requestId')).toMatchObject({ actor: ctx.ids.admin, note: 'count=1 http=400' })
    // A customer is not a users document: no actor relation.
    expect(rows.find((r) => r.actor === null && r.reason === 'forbidden')).toBeDefined()
    // No full address, request text, license key or e-mail anywhere in the audit rows.
    const dump = JSON.stringify((await ctx.run('SELECT * FROM security_audit')).rows)
    expect(dump).not.toMatch(/192\.0\.2\.77|denied-audit-secret-reason|@example\.test|https:\/\/evil/)
    const key = String((await one(`SELECT key FROM licenses WHERE id = ${id}`))!.key)
    expect(dump).not.toContain(key)
    expect(dump).not.toContain(publicId)

    // A successful action writes no denied row; its ok row is unchanged.
    const before = (await denied()).length
    expect((await post(`licenses/${id}/suspend`, 'admin', { ...body, requestId: rid() }, own)).json).toEqual({ code: 'suspended' })
    expect((await denied()).length).toBe(before)
    expect(await audits()).toHaveLength(1)
  })

  it('business refusals (stale, invalid transition, wrong confirmation, unknown target) are audited with the target', async () => {
    const { id } = await createLicense(ctx)
    const stale = await expectedOf(id)
    expect((await post(`licenses/${id}/suspend`, 'admin', { requestId: rid(), reason: 'first one', expected: stale })).json).toEqual({ code: 'suspended' })
    expect((await post(`licenses/${id}/suspend`, 'admin', { requestId: rid(), reason: 'stale view', expected: stale })).json).toEqual({ code: 'stale' })
    expect((await post(`licenses/${id}/suspend`, 'admin', { requestId: rid(), reason: 'wrong state', expected: await expectedOf(id) })).json).toEqual({ code: 'invalid_transition' })
    const revoke = await post(`licenses/${id}/revoke`, 'admin', { requestId: rid(), reason: 'typo confirm', expected: await expectedOf(id), confirm: 'WRONG1' })
    expect(revoke.status).toBeGreaterThanOrEqual(400)
    expect((await post('licenses/999999/suspend', 'admin', { requestId: rid(), reason: 'ghost', expected: stale })).json).toEqual({ code: 'not_found' })
    const rows = await denied()
    expect(rows.map((r) => `${r.action}:${r.reason}`).sort()).toEqual([
      'license.revoke:' + revoke.json.code, 'license.suspend:invalid_transition', 'license.suspend:not_found', 'license.suspend:stale',
    ].sort())
    expect(rows.find((r) => r.reason === 'stale')).toMatchObject({ license: id, actor: ctx.ids.admin, kind: 'admin' })
    expect(rows.find((r) => r.reason === 'not_found')!.license).toBeNull()
    // Refusals still change nothing.
    expect(await logs(id)).toHaveLength(1)
  })

  it('opens a new row after the 10 minute window', async () => {
    const { recordDeniedAdminAction, DENIED_WINDOW_MS } = await import('../../src/lib/licensing/admin/denied-audit')
    const user = { id: ctx.ids.admin, collection: 'users', roles: ['admin'] }
    const req = { user, headers: new Headers(), payload: ctx.payload } as never
    const t0 = new Date('2026-11-18T10:00:00.000Z')
    const at = (ms: number) => new Date(t0.getTime() + ms)
    const deny = (now: Date) => recordDeniedAdminAction(req, { route: 'block.add', code: 'invalid_kind', http: 400, now })
    await deny(t0)
    await deny(at(DENIED_WINDOW_MS - 1))
    expect(await denied()).toMatchObject([{ action: 'block.add', reason: 'invalid_kind', note: 'count=1 http=400', ip: null }])
    await deny(at(DENIED_WINDOW_MS))
    expect(await denied()).toMatchObject([{ note: 'count=1 http=400' }, { note: 'count=1 http=400' }])
    // Anonymous callers and malformed reason codes write nothing.
    await recordDeniedAdminAction({ user: null, headers: new Headers(), payload: ctx.payload } as never, { route: 'block.add', code: 'forbidden', http: 403, now: t0 })
    await recordDeniedAdminAction(req, { route: 'block.add', code: 'has space', http: 400, now: t0 })
    expect(await denied()).toHaveLength(2)
  })

  it('recovers the existing window deadline when the in-process cache is cold', async () => {
    const { recordDeniedAdminAction, DENIED_WINDOW_MS } = await import('../../src/lib/licensing/admin/denied-audit')
    const user = { id: ctx.ids.admin, collection: 'users', roles: ['admin'] }
    const headers = new Headers()
    const start = Date.parse('2026-11-18T11:00:00.000Z')
    const deny = (payload: typeof ctx.payload, offset: number) => recordDeniedAdminAction({ user, headers, payload } as never, {
      route: 'block.lift', code: 'stale', http: 409, now: new Date(start + offset),
    })
    // The proxy simulates a fresh process's cache while sharing the committed SQLite rows.
    const cold = new Proxy(ctx.payload, {})
    await deny(ctx.payload, 0)
    await deny(cold, DENIED_WINDOW_MS - 1)
    expect(await denied()).toHaveLength(1)
    await deny(cold, DENIED_WINDOW_MS)
    expect(await denied()).toHaveLength(2)
  })

  it('coalesces concurrent refusals without races, attaches target on post-guard 403s, and never lets audit failures alter responses or block the queue', async () => {
    const { id } = await createLicense(ctx)
    const expected = await expectedOf(id)
    const body = { requestId: rid(), reason: 'concurrent test', expected }

    const writer = vi.spyOn(ctx.payload.db, 'beginTransaction')
    // Only the first concurrent refusal asks for the writer lock.
    const burst = await Promise.all(Array.from({ length: 5 }, () => post(`licenses/${id}/suspend`, 'editor', body)))
    expect(burst.every((r) => r.status === 403 && r.json.code === 'forbidden')).toBe(true)
    expect(await denied()).toMatchObject([{ actor: ctx.ids.editor, action: 'license.suspend', reason: 'forbidden', note: 'count=1 http=403', license: id }])
    expect(writer).toHaveBeenCalledTimes(1)

    // The custom guard still rejects and audits a request with cross-site metadata.
    expect((await post(`licenses/${id}/suspend`, 'admin', body, { authorization: '' })).status).toBe(403)
    expect((await post(`licenses/${id}/suspend`, 'admin', body, { 'sec-fetch-site': 'cross-site' })).status).toBe(403)
    const rows = await denied()
    expect(rows.find((r) => r.reason === 'panel_session_required')).toMatchObject({ actor: ctx.ids.admin, license: id })
    expect(rows.find((r) => r.reason === 'cross_origin')).toMatchObject({ actor: ctx.ids.admin, license: id })

    // If writing the denied audit row fails, the endpoint still returns the original refusal and leaves the serial queue healthy.
    await ctx.run(`CREATE TRIGGER fail_denied_audit BEFORE INSERT ON security_audit
      WHEN NEW.result = 'denied' BEGIN SELECT RAISE(ABORT, 'audit write failure'); END`)
    try {
      const refused = await post(`licenses/${id}/suspend`, 'apiKey', body)
      expect(refused).toMatchObject({ status: 403, json: { code: 'panel_session_required' } })
    } finally {
      await ctx.run('DROP TRIGGER fail_denied_audit')
    }
    const ok = await post(`licenses/${id}/suspend`, 'admin', { requestId: rid(), reason: 'queue still works', expected })
    expect(ok).toMatchObject({ status: 200, json: { code: 'suspended' } })
    expect(await audits()).toHaveLength(1)
  })
})
