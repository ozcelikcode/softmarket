import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { LICENSE_STATUSES, LICENSING_RULE_KEYS, RULE_STATUS_REASONS } from '../../src/lib/licensing/constants'
import { LICENSE_TRANSITION_CONTEXT, recordLicenseTransition } from '../../src/lib/licensing/transitions'
import { createLicense, setupLicensingDb, type Ctx } from './helpers/licensing-db'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

/*
 * L1 permanent rule 1: every license status change through Payload writes exactly one `license-status-log` row in the
 * same transaction, with the source/reason stamped on the license. The admin users API key (MCP) can never change the
 * status; customers/editors cannot write licenses at all. A license with history cannot be deleted.
 */
let ctx: Ctx
const logs = async (license: number) => (await ctx.run(
  `SELECT "from", "to", reason, source, actor_user_id AS actor, order_id AS "order", rule_key AS rule, note, revertible, at FROM license_status_log WHERE license_id = ${license} ORDER BY id`,
)).rows
const licenseRow = async (id: number) => (await ctx.run(`SELECT status, status_reason AS reason, status_source AS source, status_changed_at AS changed FROM licenses WHERE id = ${id}`)).rows[0]!

beforeAll(async () => { ctx = await setupLicensingDb('l1-transitions') }, 240000)
afterAll(async () => { await ctx?.destroy() })

describe('license status transitions', () => {
  it('rule reasons map 1:1 to rule keys', () => {
    expect(RULE_STATUS_REASONS).toEqual(LICENSING_RULE_KEYS.map((k) => `rule_${k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)}`))
  })

  it('server code declaring the admin source writes one log row and stamps the license', async () => {
    const { id } = await createLicense(ctx)
    expect(await logs(id)).toEqual([])
    expect((await licenseRow(id)).source).toBeNull()
    await ctx.payload.update({
      collection: 'licenses', id, overrideAccess: true, data: { status: 'suspended' } as never,
      context: { [LICENSE_TRANSITION_CONTEXT]: { source: 'admin', actorUser: ctx.ids.admin } },
    })
    const [row, ...rest] = await logs(id)
    expect(rest).toEqual([])
    expect(row).toMatchObject({ from: 'active', to: 'suspended', reason: 'manual', source: 'admin', actor: ctx.ids.admin, revertible: 0 })
    expect(await licenseRow(id)).toMatchObject({ status: 'suspended', reason: 'manual', source: 'admin', changed: row!.at })
    // A change of other fields writes nothing.
    await ctx.payload.update({ collection: 'licenses', id, overrideAccess: true, data: { notes: 'x', status: 'suspended' } as never })
    expect(await logs(id)).toHaveLength(1)
  })

  it('plan 4.1 lock: no user-facing update path changes the status (panel form/REST, bulk, Local API with access)', async () => {
    const { id } = await createLicense(ctx)
    const other = await createLicense(ctx)
    // Panel admin session over REST: the value is stripped, other fields still save.
    const res = await ctx.rest('PATCH', `licenses/${id}`, 'admin', { status: 'suspended', notes: 'panel-note' })
    expect(res.status).toBe(200)
    expect(await licenseRow(id)).toMatchObject({ status: 'active', source: null, changed: null })
    expect((await ctx.run(`SELECT notes FROM licenses WHERE id = ${id}`)).rows[0]).toMatchObject({ notes: 'panel-note' })
    // Bulk with a projection.
    expect((await ctx.rest('PATCH', `licenses?where[id][in]=${id},${other.id}&select[notes]=true`, 'admin', { status: 'revoked' })).status).toBe(200)
    // Local API with access control as a panel admin (what a custom admin component or script acting as the user does).
    const admin = await ctx.payload.findByID({ collection: 'users', id: ctx.ids.admin, overrideAccess: true })
    await ctx.payload.update({
      collection: 'licenses', id, overrideAccess: false, data: { status: 'revoked' } as never,
      user: { ...admin, collection: 'users', _strategy: 'local-jwt' } as never,
    })
    for (const license of [id, other.id]) {
      expect(await licenseRow(license)).toMatchObject({ status: 'active', source: null, changed: null })
      expect(await logs(license)).toEqual([])
    }
    // Creating a license still sets the initial status (panel admin) and logs nothing (no transition).
    const created = await ctx.rest('POST', 'licenses', 'admin', { customer: ctx.ids.otherCustomer, edition: ctx.ids.edition, status: 'suspended' })
    expect(created.status).toBe(201)
    const suspendedId = Number((created.json.doc as { id: number }).id)
    expect(await licenseRow(suspendedId)).toMatchObject({ status: 'suspended' })
    // GraphQL updateLicense strips status for every caller while keeping non-status updates working.
    for (const who of ['admin', 'apiKey'] as const) {
      const gql = await ctx.graphql(`mutation { updateLicense(id: ${id}, data: { status: revoked, notes: "gql-${who}" }) { id status notes } }`, who)
      expect(gql.status).toBe(200)
      expect(JSON.parse(gql.text)).toMatchObject({ data: { updateLicense: { status: 'active', notes: `gql-${who}` } } })
    }
    expect(await licenseRow(id)).toMatchObject({ status: 'active', source: null, changed: null })
    expect(await logs(id)).toEqual([])
    // Duplicating a suspended license via API key resets status to the safe default and leaves the source untouched.
    const dupKey = await ctx.rest('POST', `licenses/${suspendedId}/duplicate`, 'apiKey', {})
    expect(dupKey.status).toBe(200)
    const dupId = Number((dupKey.json.doc as { id: number }).id)
    expect(await licenseRow(dupId)).toMatchObject({ status: 'active', source: null, changed: null })
    expect(await licenseRow(suspendedId)).toMatchObject({ status: 'suspended' })
    expect(await logs(dupId)).toEqual([])
    // The field is read-only in the panel and points to the action panel in both languages.
    const { Licenses } = await import('../../src/collections/Licenses')
    const field = Licenses.fields.find((f) => 'name' in f && f.name === 'status') as { admin?: { readOnly?: boolean; description?: Record<string, string> } }
    expect(field.admin?.readOnly).toBe(true)
    expect(field.admin?.description?.tr).toContain('Lisans işlemleri')
    expect(field.admin?.description?.en).toContain('License actions')
  })

  it('every status pair is logged', async () => {
    const { id } = await createLicense(ctx)
    let from: string = 'active'
    const seen: string[] = []
    for (const to of [...LICENSE_STATUSES.slice(1), ...LICENSE_STATUSES]) {
      if (to === from) continue
      await ctx.payload.update({ collection: 'licenses', id, overrideAccess: true, data: { status: to } as never })
      seen.push(`${from}>${to}`)
      from = to
    }
    expect((await logs(id)).map((r) => `${r.from}>${r.to}`)).toEqual(seen)
    expect((await logs(id)).every((r) => r.source === 'system' && r.reason === null)).toBe(true)
  })

  it('server code declares source/reason/order through req.context', async () => {
    const { id } = await createLicense(ctx)
    await ctx.payload.updateGlobal({
      slug: 'licensing-settings',
      data: { rules: { observeUntil: '2026-01-01T00:00:00.000Z', cloneSuspected: { mode: 'suspend' } } },
    })
    await ctx.payload.update({
      collection: 'licenses', id, overrideAccess: true, data: { status: 'suspended' } as never,
      context: { [LICENSE_TRANSITION_CONTEXT]: { source: 'rule', reason: 'rule_clone_suspected', ruleKey: 'cloneSuspected', note: 'auto' } },
    })
    expect((await logs(id))[0]).toMatchObject({ source: 'rule', reason: 'rule_clone_suspected', rule: 'cloneSuspected', note: 'auto', revertible: 1, actor: null })
    expect(await licenseRow(id)).toMatchObject({ source: 'rule', reason: 'rule_clone_suspected' })
    await ctx.payload.update({
      collection: 'licenses', id, overrideAccess: true, data: { status: 'active' } as never,
      context: { [LICENSE_TRANSITION_CONTEXT]: { source: 'customer' } },
    })
    // `customer` is a log-only source; the license summary says `system`.
    expect((await logs(id))[1]).toMatchObject({ source: 'customer' })
    expect(await licenseRow(id)).toMatchObject({ source: 'system', reason: null })
    await expect(ctx.payload.update({
      collection: 'licenses', id, overrideAccess: true, data: { status: 'revoked' } as never,
      context: { [LICENSE_TRANSITION_CONTEXT]: { source: 'evil' } },
    })).rejects.toThrow(/unknown source/)
    expect((await licenseRow(id)).status).toBe('active')
  })

  it('requires an elapsed observation window and suspend mode for automatic suspensions', async () => {
    const { id } = await createLicense(ctx)
    const transition = (status: 'suspended' | 'revoked') => ctx.payload.update({
      collection: 'licenses', id, data: { status },
      context: { [LICENSE_TRANSITION_CONTEXT]: { source: 'rule', reason: 'rule_ip_spread', ruleKey: 'ipSpread' } },
    })
    for (const [observeUntil, mode] of [
      [null, 'suspend'], ['2099-01-01T00:00:00.000Z', 'suspend'], ['2026-01-01T00:00:00.000Z', 'notify'],
    ] as const) {
      await ctx.payload.updateGlobal({ slug: 'licensing-settings', data: { rules: { observeUntil, ipSpread: { mode } } } })
      await expect(transition('suspended')).rejects.toMatchObject({ status: 409 })
      expect(await licenseRow(id)).toMatchObject({ status: 'active', source: null, changed: null })
      expect(await logs(id)).toEqual([])
    }
    await ctx.payload.updateGlobal({ slug: 'licensing-settings', data: { rules: { observeUntil: '2026-01-01T00:00:00.000Z', ipSpread: { mode: 'suspend' } } } })
    await expect(transition('revoked')).rejects.toMatchObject({ status: 409 })
    await transition('suspended')
    expect(await logs(id)).toMatchObject([{ to: 'suspended', source: 'rule', rule: 'ipSpread', revertible: 1 }])
  })

  it('is atomic: if the log row cannot be written the status change rolls back', async () => {
    const { id } = await createLicense(ctx)
    await expect(ctx.payload.update({
      collection: 'licenses', id, overrideAccess: true, data: { status: 'revoked' } as never,
      context: { [LICENSE_TRANSITION_CONTEXT]: { note: 'x'.repeat(501) } },
    })).rejects.toThrow(/note too long/)
    expect(await licenseRow(id)).toMatchObject({ status: 'active', source: null, changed: null })
    expect(await logs(id)).toEqual([])
  })

  it('logs the committed fields of a projected update and ignores projections on unchanged status', async () => {
    const { id } = await createLicense(ctx)
    await ctx.payload.update({ collection: 'licenses', id, select: { notes: true }, data: { notes: 'projected' } })
    expect(await logs(id)).toEqual([])
    await ctx.payload.update({
      collection: 'licenses', id, select: { notes: true }, data: { status: 'suspended' } as never,
      context: { [LICENSE_TRANSITION_CONTEXT]: { source: 'admin', actorUser: ctx.ids.admin } },
    })
    const row = await licenseRow(id)
    expect(await logs(id)).toMatchObject([{ from: 'active', to: 'suspended', reason: 'manual', at: row.changed }])
  })

  it('rolls back the full bulk update when one audit insert fails', async () => {
    const first = await createLicense(ctx)
    const second = await createLicense(ctx)
    const where = { id: { in: [first.id, second.id] } }
    await ctx.run(`CREATE TRIGGER reject_license_log BEFORE INSERT ON license_status_log
      WHEN NEW.license_id = ${second.id} BEGIN SELECT RAISE(ABORT, 'test log failure'); END`)
    try {
      await expect(ctx.payload.update({ collection: 'licenses', where, data: { status: 'suspended' } })).rejects.toThrow()
    } finally {
      await ctx.run('DROP TRIGGER reject_license_log')
    }
    for (const id of [first.id, second.id]) {
      expect(await licenseRow(id)).toMatchObject({ status: 'active', source: null, changed: null })
      expect(await logs(id)).toEqual([])
    }
    await ctx.payload.update({ collection: 'licenses', where, select: { notes: true }, data: { status: 'suspended' } as never })
    for (const id of [first.id, second.id]) expect(await logs(id)).toMatchObject([{ from: 'active', to: 'suspended' }])
  })

  it('the admin API key (MCP) can never change the status; customers/editors cannot write', async () => {
    const { id } = await createLicense(ctx)
    const res = await ctx.rest('PATCH', `licenses/${id}`, 'apiKey', { status: 'revoked', notes: 'via key' })
    expect(res.status).toBe(200)
    expect(await licenseRow(id)).toMatchObject({ status: 'active', source: null })
    expect((await ctx.run(`SELECT notes FROM licenses WHERE id = ${id}`)).rows[0]).toMatchObject({ notes: 'via key' })
    for (const who of ['customer', 'editor', 'anonymous'] as const) expect([401, 403]).toContain((await ctx.rest('PATCH', `licenses/${id}`, who, { status: 'revoked' })).status)
    // The same through the Local API with an API-key user (what the MCP plugin does).
    const admin = await ctx.payload.findByID({ collection: 'users', id: ctx.ids.admin, overrideAccess: true })
    await ctx.payload.update({ collection: 'licenses', id, overrideAccess: false, user: { ...admin, collection: 'users', _strategy: 'api-key' } as never, data: { status: 'suspended' } as never })
    expect((await licenseRow(id)).status).toBe('active')
    expect(await logs(id)).toEqual([])
    for (const who of ['apiKey', 'adminBearer'] as const) {
      const bulk = await ctx.rest('PATCH', `licenses?where[id][equals]=${id}`, who, { status: 'revoked' })
      expect(bulk.status).toBe(200)
    }
    expect(await licenseRow(id)).toMatchObject({ status: 'active', source: null })
    expect(await logs(id)).toEqual([])
  })

  it('the MCP endpoint advertises only allowed tools and strips status writes', async () => {
    const mcp = async (method: string, params?: Record<string, unknown>) => {
      const res = await ctx.rest('POST', 'mcp', 'apiKey', { jsonrpc: '2.0', id: 1, method, params })
      expect(res.status).toBe(200)
      const raw = res.json.raw
      return typeof raw === 'string' ? JSON.parse(raw.split('\n').find((s) => s.startsWith('data: '))!.slice(6)) : res.json
    }
    const { result } = await mcp('tools/list')
    const names: string[] = result.tools.map(({ name }: { name: string }) => name)
    expect(names).toContain('updateLicenses')
    expect(names.filter((name) => /security|activation|statuslog|licensingsetting/i.test(name))).toEqual([])
    const { id } = await createLicense(ctx)
    const update = await mcp('tools/call', { name: 'updateLicenses', arguments: { id, status: 'revoked', notes: 'mcp-authorized-field' } })
    expect(update.error).toBeUndefined()
    expect(update.result?.isError).not.toBe(true)
    expect(await licenseRow(id)).toMatchObject({ status: 'active', source: null })
    expect((await ctx.run(`SELECT notes FROM licenses WHERE id = ${id}`)).rows[0]).toMatchObject({ notes: 'mcp-authorized-field' })
    expect(await logs(id)).toEqual([])
    // MCP createLicenses cannot set a dangerous initial status either: defaults to active.
    const mcpCreated = await mcp('tools/call', {
      name: 'createLicenses',
      arguments: {
        key: 'CLIENT-INPUT-IGNOR-ED000-00000',
        customer: ctx.ids.otherCustomer,
        edition: ctx.ids.edition,
        startsAt: '2026-01-01T00:00:00.000Z',
        status: 'revoked',
      },
    })
    expect(mcpCreated.error).toBeUndefined()
    expect(mcpCreated.result?.isError).not.toBe(true)
    const createdText = String((mcpCreated.result as { content?: { text?: string }[] })?.content?.[0]?.text ?? '')
    const createdMatch = createdText.match(/"id"\s*:\s*(\d+)/)
    expect(createdMatch).not.toBeNull()
    expect(await licenseRow(Number(createdMatch![1]))).toMatchObject({ status: 'active', source: null, changed: null })
  })

  it('recordLicenseTransition validates its input', async () => {
    const req = { payload: ctx.payload, context: {} } as never
    const base = { license: 1, from: 'active', to: 'suspended', source: 'admin' } as const
    await expect(recordLicenseTransition(req, { ...base, to: 'active' })).rejects.toThrow(/unchanged/)
    await expect(recordLicenseTransition(req, { ...base, to: 'gone' as never })).rejects.toThrow(/unknown status/)
    await expect(recordLicenseTransition(req, { ...base, reason: 'whim' as never })).rejects.toThrow(/unknown reason/)
    await expect(recordLicenseTransition(req, { ...base, license: Number.NaN })).rejects.toThrow(/license id/)
  })

  it('a license with history cannot be deleted; one without history can', async () => {
    const withHistory = await createLicense(ctx)
    await ctx.payload.update({ collection: 'licenses', id: withHistory.id, overrideAccess: true, data: { status: 'suspended' } as never })
    const res = await ctx.rest('DELETE', `licenses/${withHistory.id}`, 'admin')
    expect(res.status).toBe(409)
    expect((await licenseRow(withHistory.id)).status).toBe('suspended')
    const fresh = await createLicense(ctx)
    expect((await ctx.rest('DELETE', `licenses?where[id][in]=${withHistory.id},${fresh.id}`, 'admin')).status).toBe(409)
    expect(await licenseRow(fresh.id)).toMatchObject({ status: 'active' })
    expect((await ctx.rest('DELETE', `licenses/${fresh.id}`, 'admin')).status).toBe(200)
  })

  it('log rows are never writable through the API, even by an admin session', async () => {
    const { id } = await createLicense(ctx)
    await ctx.payload.update({ collection: 'licenses', id, overrideAccess: true, data: { status: 'suspended' } as never })
    const logId = Number((await ctx.run(`SELECT id FROM license_status_log WHERE license_id = ${id}`)).rows[0]!.id)
    for (const [method, path] of [['PATCH', `license-status-log/${logId}`], ['DELETE', `license-status-log/${logId}`]] as const) {
      expect([401, 403]).toContain((await ctx.rest(method, path, 'admin', method === 'PATCH' ? { to: 'active' } : undefined)).status)
    }
    expect(await logs(id)).toHaveLength(1)
  })
})
