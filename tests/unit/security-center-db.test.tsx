import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { countOpenHighEvents, loadBlocks, loadEvents, loadOverview, loadProductOptions, loadStatusLog, loadSummary, type ReadContext } from '@/admin/security/loaders'
import { parseSecurityQuery } from '@/admin/security/query'
import { createLicense, setupLicensingDb, ADMIN, CUSTOMER, type Ctx } from './helpers/licensing-db'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: (to: string) => { throw new Error(`NEXT_REDIRECT:${to}`) } }))
vi.mock('@payloadcms/next/templates', () => ({ DefaultTemplate: ({ children }: { children: React.ReactNode }) => <div data-template>{children}</div> }))
vi.mock('@payloadcms/ui', () => ({ Gutter: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))

/*
 * L6a loaders and view on a real temporary SQLite (all migrations, real access rules): counters, filters, paging,
 * the admin-only read rule (editor/customer/API key get nothing) and the privacy rule (no key, full hash, device key,
 * fingerprint or e-mail anywhere in the view models or the rendered HTML).
 */
const NOW = new Date('2026-11-18T12:00:00.000Z')
const iso = (hoursAgo: number) => new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString()
const FULL_IP_HASH = 'f'.repeat(16) + 'e'.repeat(27)
const FP_HASH = 'fingerprint-hash-0123456789abcdef'
const DEVICE_KEY = 'device-public-key-ABCDEFGHIJKLMNOPQRSTUV'
const THUMB = 'device-thumbprint-ZYXWVUTSRQPONMLKJI'
const LAST_IP_HASH = 'last-ip-hash-qwertyuiop'

let ctx: Ctx
let admin: ReadContext
const users: Record<string, never> = {} as never
let license: { id: number; publicId: string }
let otherLicense: { id: number; publicId: string }
let licenseKey = ''
let secondProduct = 0
let eventIds: number[] = []

const cookieHeaders = () => new Headers({ cookie: 'payload-token=x' })
const readCtx = (user: unknown, lang: 'tr' | 'en' = 'en', headers: Headers = cookieHeaders()): ReadContext => ({
  payload: ctx.payload,
  user: user as never,
  headers,
  lang,
  adminRoute: '/admin',
  now: NOW,
})

const event = (over: Record<string, unknown>) => ({
  type: 'api.replay', severity: 'high', source: 'api', firstSeenAt: iso(2), lastSeenAt: iso(1), count: 1, triage: 'open',
  dedupeKey: `k-${Math.random().toString(36).slice(2)}`, ...over,
})

beforeAll(async () => {
  ctx = await setupLicensingDb('l6a')
  const asUser = async (collection: 'users' | 'customers', id: number, extra: Record<string, unknown>) => ({
    ...(await ctx.payload.findByID({ collection, id, overrideAccess: true })), collection, ...extra,
  })
  Object.assign(users, {
    admin: await asUser('users', ctx.ids.admin, { _strategy: 'local-jwt' }),
    editor: await asUser('users', ctx.ids.editor, { _strategy: 'local-jwt' }),
    customer: await asUser('customers', ctx.ids.customer, { _strategy: 'local-jwt' }),
    apiKey: await asUser('users', ctx.ids.admin, { _strategy: 'api-key' }),
  })
  admin = readCtx(users.admin)

  license = await createLicense(ctx)
  otherLicense = await createLicense(ctx, ctx.ids.otherCustomer)
  licenseKey = String(((await ctx.payload.findByID({ collection: 'licenses', id: license.id, overrideAccess: true })) as { key?: string }).key)
  secondProduct = (await ctx.payload.create({ collection: 'products', overrideAccess: true, locale: 'tr', data: { title: 'Ikinci Urun', slug: 'ikinci-urun', family: ctx.ids.family, _status: 'published' } as never })).id as number
  const secondEdition = (await ctx.payload.create({ collection: 'editions', overrideAccess: true, locale: 'tr', data: { title: 'Std', sku: 'L6A-STD', product: secondProduct, licenseType: 'perpetual', seats: 1 } as never })).id as number
  const third = (await ctx.payload.create({ collection: 'licenses', overrideAccess: true, context: { paymentsOrderFulfilment: true }, data: { customer: ctx.ids.customer, edition: secondEdition, startsAt: '2026-01-01T00:00:00.000Z' } as never })) as { id: number; publicId: string }

  const mk = async (data: Record<string, unknown>) => (await ctx.payload.create({ collection: 'security-events', overrideAccess: true, data: data as never })).id as number
  eventIds = [
    await mk(event({ type: 'api.replay', severity: 'high', license: license.id, ipPrefix: '203.0.113.0/24', ipHash: FULL_IP_HASH, country: 'TR', detail: { window: '1h', contact: 'victim@example.com', ip: '198.51.100.9' }, customer: ctx.ids.customer })),
    await mk(event({ type: 'api.bad_signature', severity: 'low', triage: 'acknowledged', license: license.id, lastSeenAt: iso(100) })),
    await mk(event({ type: 'activation.clone_suspected', severity: 'critical', license: otherLicense.id, source: 'rule', ruleKey: 'cloneSuspected', lastSeenAt: iso(30) })),
    await mk(event({ type: 'api.rate_limited', severity: 'medium', license: third.id, triage: 'resolved', lastSeenAt: iso(24 * 20) })),
    await mk(event({ type: 'auth.admin_login_failed', severity: 'info', source: 'admin', triage: 'false_positive', lastSeenAt: iso(5) })),
  ]
  const block = (data: Record<string, unknown>) => ctx.payload.create({ collection: 'security-blocks', overrideAccess: true, data: { kind: 'ip_prefix', scope: 'api', source: 'admin', ...data } as never })
  await block({ value: '198.51.100.0/24', reason: 'forever block', event: eventIds[0] })
  await block({ value: '192.0.2.0/24', reason: 'future expiry', expiresAt: iso(-48) })
  await block({ value: '203.0.113.0/24', reason: 'expired block', expiresAt: iso(3), source: 'rule', kind: 'cidr' })
  await block({ value: '100.64.0.0/10', reason: 'lifted block', active: false, liftedAt: iso(4), liftReason: 'oops' })
  await block({ value: FP_HASH, reason: 'fp block', active: false, liftedAt: iso(5), kind: 'fingerprint' })
  await ctx.payload.create({
    collection: 'license-activations', overrideAccess: true,
    data: {
      publicId: 'b'.repeat(24), license: license.id, customer: ctx.ids.customer, product: ctx.ids.product, status: 'active', devicePublicKey: DEVICE_KEY, deviceKeyThumbprint: THUMB,
      fingerprintHash: FP_HASH, deviceLabel: 'Workstation', platform: 'windows', appVersion: '1.2.3', activatedAt: iso(2), lastSeenAt: iso(1), lastIpPrefix: '203.0.113.0/24', lastIpHash: LAST_IP_HASH, counter: 'ctr-secret', endNonce: 'nonce-secret',
    } as never,
  })
  await ctx.payload.create({
    collection: 'license-activations', overrideAccess: true,
    data: { publicId: 'c'.repeat(24), license: license.id, status: 'deactivated', devicePublicKey: DEVICE_KEY + '2', deviceKeyThumbprint: THUMB + '2', fingerprintHash: FP_HASH + '2', activatedAt: iso(24 * 9) } as never,
  })
  await ctx.payload.update({ collection: 'licenses', id: license.id, overrideAccess: true, data: { status: 'suspended' } as never, context: { licenseTransition: { source: 'admin', reason: 'manual', note: 'investigating' } } })
  await ctx.payload.update({ collection: 'licenses', id: third.id, overrideAccess: true, data: { status: 'revoked' } as never, context: { licenseTransition: { source: 'payment', reason: 'payment_refund' } } })
}, 240000)

afterAll(async () => { await ctx?.destroy() })

const q = (raw: Record<string, string | string[]> = {}) => parseSecurityQuery(raw)

describe('summary', () => {
  it('counts open high-severity events, blocks, suspended licenses and recent activations', async () => {
    const s = await loadSummary(admin)
    expect(s.openHigh).toBe(2)
    expect(s.openTotal).toBe(2)
    expect(s.last24h).toBe(2) // high (1h) and info (5h); critical (30h), 100h and 20d are outside
    expect(s.activeBlocks).toBe(2)
    expect(s.suspended).toBe(1)
    expect(s.activations24h).toBe(1)
    expect(s.activationsActive).toBe(1)
    expect(s.openBySeverity).toEqual({ info: 0, low: 0, medium: 0, high: 1, critical: 1 })
  })
})

describe('events', () => {
  it('defaults to open events, newest first, with resolved relations and no raw documents', async () => {
    const r = await loadEvents(admin, q())
    expect(r.totalDocs).toBe(2)
    expect(r.rows.map((e) => e.type)).toEqual(['api.replay', 'activation.clone_suspected'])
    const first = r.rows[0]!
    expect(first).toMatchObject({
      severity: 'high', source: 'api', count: 1, triage: 'open', ipPrefix: '203.0.113.0/24', country: 'TR', href: `/admin/collections/security-events/${eventIds[0]}`,
      license: { id: license.id, publicId: license.publicId, status: 'suspended', product: { id: ctx.ids.product, title: 'Ürün L1' }, href: `/admin/collections/licenses/${license.id}` },
      customer: { id: ctx.ids.customer, href: `/admin/collections/customers/${ctx.ids.customer}` },
    })
    expect(first.ipHash).toBe(FULL_IP_HASH.slice(0, 10) + '…')
    expect(first.detail.entries.find((e) => e.key === 'window')).toMatchObject({ value: '1h', redacted: false })
    expect(first.detail.entries.filter((e) => e.redacted).map((e) => e.key).sort()).toEqual(['contact', 'ip'])
    expect(Object.keys(first).sort()).toEqual(['actor', 'activation', 'actionTaken', 'count', 'country', 'customer', 'detail', 'firstSeenAt', 'href', 'id', 'ipHash', 'ipPrefix', 'lastSeenAt', 'license', 'order', 'ruleKey', 'severity', 'source', 'triage', 'type'].sort())
  })

  it('filters by severity, type, triage, range, source, license and product', async () => {
    const types = async (raw: Record<string, string | string[]>) => (await loadEvents(admin, q({ triage: 'all', ...raw }))).rows.map((e) => e.type).sort()
    expect(await types({})).toHaveLength(5)
    expect(await types({ severity: ['high', 'critical'] })).toEqual(['activation.clone_suspected', 'api.replay'])
    expect(await types({ type: 'api.bad_signature' })).toEqual(['api.bad_signature'])
    expect(await types({ range: '24h' })).toEqual(['api.replay', 'auth.admin_login_failed'])
    expect(await types({ range: '7d' })).toEqual(['activation.clone_suspected', 'api.bad_signature', 'api.replay', 'auth.admin_login_failed'])
    expect(await types({ source: 'rule' })).toEqual(['activation.clone_suspected'])
    expect(await types({ license: license.publicId })).toEqual(['api.bad_signature', 'api.replay'])
    expect(await types({ license: 'd'.repeat(24) })).toEqual([])
    expect(await types({ product: String(secondProduct) })).toEqual(['api.rate_limited'])
    expect(await types({ product: String(ctx.ids.product), triage: 'open' })).toEqual(['activation.clone_suspected', 'api.replay'])
    expect(await types({ triage: 'acknowledged' })).toEqual(['api.bad_signature'])
    expect(await types({ license: license.publicId, severity: 'low', range: '30d' })).toEqual(['api.bad_signature'])
  })

  it('paginates (50 per page) with stable ordering and total counts', async () => {
    const create = (i: number) => ctx.payload.create({ collection: 'security-events', overrideAccess: true, data: event({ type: 'api.rate_limited', severity: 'low', triage: 'acknowledged', dedupeKey: `bulk-${i}`, lastSeenAt: iso(200 + i) }) as never })
    for (let i = 0; i < 52; i++) await create(i)
    const base = { triage: 'acknowledged' }
    const p1 = await loadEvents(admin, q({ ...base }))
    const p2 = await loadEvents(admin, q({ ...base, page: '2' }))
    expect(p1).toMatchObject({ page: 1, totalPages: 2, totalDocs: 53 })
    expect(p1.rows).toHaveLength(50)
    expect(p2).toMatchObject({ page: 2, totalPages: 2, totalDocs: 53 })
    expect(p2.rows).toHaveLength(3)
    expect(new Set([...p1.rows, ...p2.rows].map((r) => r.id)).size).toBe(53)
    const beyond = await loadEvents(admin, q({ ...base, page: '9' }))
    expect(beyond.rows).toEqual([])
  })
})

describe('blocks', () => {
  it('separates active from expired/lifted and filters by kind', async () => {
    const state = async (blockState: string, extra: Record<string, string> = {}) => (await loadBlocks(admin, q({ blockState, ...extra }))).rows
    const active = await state('active')
    expect(active.map((b) => b.value).sort()).toEqual(['192.0.2.0/24', '198.51.100.0/24'])
    expect(active.every((b) => b.state === 'active')).toBe(true)
    const expired = await state('expired')
    expect(expired.map((b) => `${b.value}:${b.state}`).sort()).toEqual([`${FP_HASH.slice(0, 10)}…:lifted`, '100.64.0.0/10:lifted', '203.0.113.0/24:expired'].sort())
    expect(await state('all')).toHaveLength(5)
    expect((await state('all', { blockKind: 'cidr' })).map((b) => b.value)).toEqual(['203.0.113.0/24'])
    expect((await state('all', { blockKind: 'fingerprint' })).map((b) => b.value)).toEqual([`${FP_HASH.slice(0, 10)}…`])
    const forever = active.find((b) => b.value === '198.51.100.0/24')!
    expect(forever).toMatchObject({ expiresAt: null, reason: 'forever block', event: { id: eventIds[0] } })
  })
})

describe('status log and overview', () => {
  it('lists transitions newest first with license/product and filters', async () => {
    const all = await loadStatusLog(admin, q())
    expect(all.rows.map((t) => `${t.from}>${t.to}:${t.source}`).sort()).toEqual(['active>revoked:payment', 'active>suspended:admin'])
    const mine = await loadStatusLog(admin, q({ license: license.publicId }))
    expect(mine.rows).toHaveLength(1)
    expect(mine.rows[0]).toMatchObject({ to: 'suspended', reason: 'manual', note: 'investigating', license: { publicId: license.publicId, product: { title: 'Ürün L1' } } })
    expect((await loadStatusLog(admin, q({ product: String(secondProduct) }))).rows.map((t) => t.to)).toEqual(['revoked'])
    expect((await loadStatusLog(admin, q({ range: '24h' }))).rows).toHaveLength(2)
  })

  it('builds the overview sections and lists product options', async () => {
    const o = await loadOverview(admin, q())
    expect(o.partial).toBe(false)
    expect(o.suspended).toMatchObject([{ publicId: license.publicId, statusReason: 'manual', statusSource: 'admin', product: { title: 'Ürün L1' } }])
    expect(o.recentHigh?.map((e) => e.severity)).toEqual(['high', 'critical'])
    expect(o.activations?.map((a) => a.publicId)).toEqual(['b'.repeat(24), 'c'.repeat(24)])
    expect(o.activations?.[0]).toMatchObject({ deviceLabel: 'Workstation', platform: 'windows', appVersion: '1.2.3', lastIpPrefix: '203.0.113.0/24', license: { publicId: license.publicId } })
    expect(o.transitions).toHaveLength(2)
    const products = await loadProductOptions(readCtx(users.admin, 'tr'))
    expect(products.map((p) => p.title).sort()).toEqual(['Ikinci Urun', 'Ürün L1'])
  })
})

describe('access: only an admin panel session reads', () => {
  it.each(['editor', 'customer', 'apiKey'] as const)('%s gets nothing', async (who) => {
    const c = readCtx(users[who])
    await expect(loadEvents(c, q())).rejects.toThrow()
    await expect(loadBlocks(c, q())).rejects.toThrow()
    await expect(loadStatusLog(c, q())).rejects.toThrow()
    const s = await loadSummary(c)
    expect(Object.values({ ...s, openBySeverity: undefined }).filter((v) => v !== undefined && v !== null)).toEqual([])
    expect(Object.values(s.openBySeverity).every((v) => v === null)).toBe(true)
    const o = await loadOverview(c, q())
    expect(o.partial).toBe(true)
    expect(o.recentHigh).toBeNull()
    expect(o.activations).toBeNull()
    expect(o.suspended).toBeNull()
    expect(o.transitions).toBeNull()
  })

  it('an admin without the cookie-session marker (Local API default user) or with an Authorization header is also refused', async () => {
    const { _strategy: _s, ...bare } = users.admin as Record<string, unknown>
    await expect(loadEvents(readCtx(bare), q())).rejects.toThrow()
    const bearerCtx = readCtx(users.admin, 'en', new Headers({ authorization: 'Bearer jwt' }))
    await expect(loadEvents(bearerCtx, q())).rejects.toThrow()
    await expect(loadBlocks(bearerCtx, q())).rejects.toThrow()
    await expect(loadStatusLog(bearerCtx, q())).rejects.toThrow()
    await expect(loadProductOptions(bearerCtx)).rejects.toThrow()
    const s = await loadSummary(bearerCtx)
    expect(Object.values({ ...s, openBySeverity: undefined }).filter((v) => v !== undefined && v !== null)).toEqual([])
    expect(await countOpenHighEvents(ctx.payload, users.admin, cookieHeaders())).toBe(2)
    expect(await countOpenHighEvents(ctx.payload, users.admin, new Headers({ authorization: 'Bearer jwt' }))).toBeNull()
    expect(await countOpenHighEvents(ctx.payload, users.editor, cookieHeaders())).toBeNull()
    expect(await countOpenHighEvents(ctx.payload, users.customer, cookieHeaders())).toBeNull()
    expect(await countOpenHighEvents(ctx.payload, users.apiKey, new Headers())).toBeNull()
  })
})

describe('privacy', () => {
  const FORBIDDEN = [FULL_IP_HASH, FP_HASH, DEVICE_KEY, THUMB, LAST_IP_HASH, 'ctr-secret', 'nonce-secret', 'victim@example.com', '198.51.100.9', ADMIN.email, CUSTOMER.email]

  it('never exposes keys, full hashes, device material or e-mail addresses in view models', async () => {
    const all = JSON.stringify([
      await loadOverview(admin, q()),
      await loadEvents(admin, q({ triage: 'all' })),
      await loadBlocks(admin, q({ blockState: 'all' })),
      await loadStatusLog(admin, q()),
    ])
    expect(licenseKey.length).toBeGreaterThan(8)
    for (const secret of [...FORBIDDEN, licenseKey]) expect(all, secret).not.toContain(secret)
  })

  it('renders every tab for the real admin without leaking and with working links', async () => {
    const { SecurityCenterView } = await import('@/admin/security/SecurityCenterView')
    const req = (search: Record<string, string>) => ({
      initPageResult: { req: { user: users.admin, payload: ctx.payload, headers: new Headers({ cookie: 'payload-token=x' }), i18n: { language: 'en' } } },
      searchParams: search,
    }) as never
    const pages = await Promise.all(([{}, { tab: 'events', triage: 'all' }, { tab: 'blocks', blockState: 'all' }, { tab: 'status-log' }] as Record<string, string>[]).map(async (s) => renderToStaticMarkup(await SecurityCenterView(req(s)))))
    for (const html of pages) {
      expect(html).not.toContain('Some data could not be read')
      for (const secret of [...FORBIDDEN, licenseKey]) expect(html, secret).not.toContain(secret)
    }
    expect(pages[0]).toContain(license.publicId)
    expect(pages[1]).toContain(`/admin/collections/security-events/${eventIds[0]}`)
    expect(pages[2]).toContain('198.51.100.0/24')
    expect(pages[3]).toContain('investigating')
    await expect(SecurityCenterView({
      initPageResult: { req: { user: users.editor, payload: ctx.payload, headers: new Headers({ cookie: 'x=y' }), i18n: { language: 'en' } } },
      searchParams: {},
    } as never)).rejects.toThrow('NEXT_REDIRECT:/admin')
  })
})
