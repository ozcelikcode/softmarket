import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SECURITY_CENTER_LABELS as L } from '@/lib/security-center-labels'
import {
  ACTIVATION_STATUSES,
  DEVICE_PLATFORMS,
  LICENSE_STATUSES,
  LICENSE_STATUS_REASONS,
  SECURITY_ACTIONS_TAKEN,
  SECURITY_BLOCK_KINDS,
  SECURITY_BLOCK_SCOPES,
  SECURITY_BLOCK_SOURCES,
  SECURITY_EVENT_SOURCES,
  SECURITY_EVENT_TYPES,
  SECURITY_SEVERITIES,
  SECURITY_TRIAGE_STATES,
  TRANSITION_SOURCES,
} from '@/lib/licensing/constants'
import { decideSecurityCenterAccess, showSecurityNavLink } from '@/admin/security/guard'
import { DETAIL_LIMITS, documentHref, formatInstant, safeDetail, shortHash } from '@/admin/security/format'
import { blocksWhere, eventsWhere, parseSecurityQuery, securityHref, statusLogWhere } from '@/admin/security/query'

/*
 * L6a (pure part): server role guard, nav filter, query parsing/where building, display helpers, label coverage and
 * the rendered view with a fake Payload (every read must carry the requesting user and overrideAccess:false).
 * DB-backed loader checks live in security-center-db.test.ts.
 */

const mockHeaders = { current: new Headers({ cookie: 'payload-token=x' }) as Headers | null }
vi.mock('next/headers', () => ({
  headers: async () => {
    if (!mockHeaders.current) throw new Error('outside request scope')
    return mockHeaders.current
  },
}))
const redirect = vi.fn((to: string) => { throw new Error(`NEXT_REDIRECT:${to}`) })
vi.mock('next/navigation', () => ({ redirect: (to: string) => redirect(to) }))
vi.mock('@payloadcms/next/templates', () => ({ DefaultTemplate: ({ children }: { children: React.ReactNode }) => <div data-template>{children}</div> }))
vi.mock('@payloadcms/ui', () => ({ Gutter: ({ children }: { children: React.ReactNode }) => <div data-gutter>{children}</div> }))
vi.mock('next/link', () => ({ default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => <a href={href} className={className}>{children}</a> }))

const staff = (roles: string[], extra: Record<string, unknown> = {}) => ({ id: 1, collection: 'users', roles, _strategy: 'local-jwt', ...extra })
const ADMIN = staff(['admin'])
const EDITOR = staff(['editor'])
const CUSTOMER = { id: 2, collection: 'customers', _strategy: 'local-jwt' }
const cookieHeaders = () => new Headers({ cookie: 'payload-token=x' })

describe('server role guard', () => {
  it('allows an admin with a panel (cookie) session', () => {
    expect(decideSecurityCenterAccess({ user: ADMIN, headers: cookieHeaders() } as never)).toEqual({ ok: true })
  })

  it('redirects an editor to the admin dashboard', () => {
    expect(decideSecurityCenterAccess({ user: EDITOR, headers: cookieHeaders() } as never)).toEqual({ ok: false, redirectTo: '/admin' })
  })

  it('redirects a customer (no admin session in practice) to the dashboard route, never allows it', () => {
    expect(decideSecurityCenterAccess({ user: CUSTOMER, headers: cookieHeaders() } as never)).toEqual({ ok: false, redirectTo: '/admin' })
  })

  it('sends anonymous visitors to the login page', () => {
    expect(decideSecurityCenterAccess({ user: null, headers: new Headers() } as never)).toEqual({ ok: false, redirectTo: '/admin/login' })
    expect(decideSecurityCenterAccess({ user: undefined, headers: new Headers() } as never, '/panel')).toEqual({ ok: false, redirectTo: '/panel/login' })
  })

  it('refuses an admin that is not a cookie session (API key, bearer token, missing headers)', () => {
    expect(decideSecurityCenterAccess({ user: staff(['admin'], { _strategy: 'api-key' }), headers: new Headers() } as never).ok).toBe(false)
    expect(decideSecurityCenterAccess({ user: ADMIN, headers: new Headers({ authorization: 'Bearer abc' }) } as never).ok).toBe(false)
    expect(decideSecurityCenterAccess({ user: ADMIN, headers: new Headers({ cookie: 'payload-token=x', authorization: 'Bearer abc' }) } as never).ok).toBe(false)
    expect(decideSecurityCenterAccess({ user: ADMIN, headers: undefined } as never)).toEqual({ ok: false, redirectTo: '/admin' })
    expect(decideSecurityCenterAccess(null)).toEqual({ ok: false, redirectTo: '/admin/login' })
  })

  it('refuses a staff user with an empty or foreign role list', () => {
    expect(decideSecurityCenterAccess({ user: staff([]), headers: cookieHeaders() } as never).ok).toBe(false)
    expect(decideSecurityCenterAccess({ user: staff(['editor', 'viewer']), headers: cookieHeaders() } as never).ok).toBe(false)
  })
})

describe('nav link filter', () => {
  beforeEach(() => { mockHeaders.current = cookieHeaders() })

  it('shows only for an admin cookie session without Authorization header', () => {
    const hdr = cookieHeaders()
    expect(showSecurityNavLink(ADMIN as never, hdr)).toBe(true)
    expect(showSecurityNavLink(EDITOR as never, hdr)).toBe(false)
    expect(showSecurityNavLink(CUSTOMER as never, hdr)).toBe(false)
    expect(showSecurityNavLink(null, hdr)).toBe(false)
    expect(showSecurityNavLink(undefined, hdr)).toBe(false)
    expect(showSecurityNavLink(staff(['admin'], { _strategy: 'api-key' }) as never, hdr)).toBe(false)
    expect(showSecurityNavLink(ADMIN as never, new Headers({ authorization: 'Bearer jwt' }))).toBe(false)
    expect(showSecurityNavLink(ADMIN as never, null)).toBe(false)
  })

  it('renders nothing for non-admins or bearer-token admins and a link (with badge) for cookie-session admins', async () => {
    const { SecurityNavLink } = await import('@/admin/security/SecurityNavLink')
    const payload = { config: { routes: { admin: '/admin' } }, count: vi.fn(async () => ({ totalDocs: 3 })) }
    const props = (user: unknown, language = 'en') => ({ user, payload, i18n: { language } }) as never
    expect(await SecurityNavLink(props(EDITOR))).toBeNull()
    expect(await SecurityNavLink(props(null))).toBeNull()
    expect(await SecurityNavLink(props(CUSTOMER))).toBeNull()
    mockHeaders.current = new Headers({ authorization: 'Bearer admin-jwt' })
    expect(await SecurityNavLink(props(ADMIN))).toBeNull()
    mockHeaders.current = null
    expect(await SecurityNavLink(props(ADMIN))).toBeNull()
    expect(payload.count).not.toHaveBeenCalled()

    mockHeaders.current = cookieHeaders()
    const html = renderToStaticMarkup((await SecurityNavLink(props(ADMIN)))!)
    expect(html).toContain('href="/admin/guvenlik"')
    expect(html).toContain('Security center')
    expect(html).toContain('>3<')
    expect(payload.count).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'security-events',
      user: ADMIN,
      overrideAccess: false,
      req: expect.objectContaining({ headers: mockHeaders.current }),
    }))
    expect(renderToStaticMarkup((await SecurityNavLink(props(ADMIN, 'tr')))!)).toContain('Güvenlik merkezi')
  })

  it('omits the badge when there is nothing open or the count is unreadable', async () => {
    const { SecurityNavLink } = await import('@/admin/security/SecurityNavLink')
    for (const count of [async () => ({ totalDocs: 0 }), async () => { throw new Error('nope') }]) {
      const html = renderToStaticMarkup((await SecurityNavLink({ user: ADMIN, payload: { config: { routes: { admin: '/admin' } }, count }, i18n: { language: 'en' } } as never))!)
      expect(html).not.toContain('sc-nav-badge')
    }
  })
})

describe('query parsing', () => {
  it('uses safe defaults', () => {
    expect(parseSecurityQuery(undefined)).toEqual({
      tab: 'overview', page: 1, severity: [], type: null, triage: 'open', range: 'all', source: null, license: null, licenseInvalid: false,
      product: null, blockState: 'active', blockKind: null,
    })
  })

  it('accepts only allow-listed values and falls back otherwise', () => {
    const q = parseSecurityQuery({
      tab: 'events', page: '3', severity: ['high', 'bogus', 'high', 'critical'], type: 'api.replay', triage: 'all', range: '7d', source: 'api',
      license: ` ${'A1'.repeat(12)} `, product: '42', blockState: 'expired', blockKind: 'cidr',
    })
    expect(q).toMatchObject({ tab: 'events', page: 3, severity: ['high', 'critical'], type: 'api.replay', triage: 'all', range: '7d', source: 'api', license: 'a1'.repeat(12), product: 42, blockState: 'expired', blockKind: 'cidr' })
    const bad = parseSecurityQuery({ tab: 'x', page: '-4', severity: "high' OR 1=1", type: 'drop table', triage: 'weird', range: 'forever', source: '*', license: 'nope', product: '1; DROP', blockState: 'x', blockKind: 'y' })
    expect(bad).toMatchObject({ tab: 'overview', page: 1, severity: [], type: null, triage: 'open', range: 'all', source: null, license: null, licenseInvalid: true, product: null, blockState: 'active', blockKind: null })
  })

  it('bounds the page number, rejects non-integer suffixes and zero product ids, and ignores array-valued scalars after the first', () => {
    expect(parseSecurityQuery({ page: '99999999999' }).page).toBe(10_000)
    expect(parseSecurityQuery({ page: 'abc' }).page).toBe(1)
    expect(parseSecurityQuery({ page: '2abc' }).page).toBe(1)
    expect(parseSecurityQuery({ page: '0' }).page).toBe(1)
    expect(parseSecurityQuery({ product: '0' }).product).toBeNull()
    expect(parseSecurityQuery({ product: '00' }).product).toBeNull()
    expect(parseSecurityQuery({ tab: ['blocks', 'events'] }).tab).toBe('blocks')
  })

  it('builds where clauses only from validated values', () => {
    const now = new Date('2026-11-18T12:00:00.000Z')
    const q = parseSecurityQuery({ tab: 'events', severity: ['high'], type: 'api.replay', triage: 'open', range: '24h', source: 'api', license: 'ab'.repeat(12), product: '7' })
    expect(eventsWhere(q, now)).toEqual({
      and: [
        { severity: { in: ['high'] } },
        { type: { equals: 'api.replay' } },
        { triage: { equals: 'open' } },
        { lastSeenAt: { greater_than_equal: '2026-11-17T12:00:00.000Z' } },
        { source: { equals: 'api' } },
        { 'license.publicId': { equals: 'ab'.repeat(12) } },
        { 'license.product': { equals: 7 } },
      ],
    })
    expect(eventsWhere(parseSecurityQuery({ triage: 'all' }), now)).toEqual({ and: [] })
    expect(JSON.stringify(blocksWhere(parseSecurityQuery({ blockState: 'active', blockKind: 'cidr' }), now))).toContain('2026-11-18T12:00:00.000Z')
    expect(JSON.stringify(blocksWhere(parseSecurityQuery({ blockState: 'all' }), now))).toBe('{"and":[]}')
    expect(statusLogWhere(parseSecurityQuery({ range: '30d', license: 'cd'.repeat(12) }), now)).toEqual({
      and: [{ at: { greater_than_equal: '2026-10-19T12:00:00.000Z' } }, { 'license.publicId': { equals: 'cd'.repeat(12) } }],
    })
  })

  it('round-trips non-default values into links', () => {
    const q = parseSecurityQuery({ tab: 'events', page: '2', severity: ['high', 'low'], triage: 'all', range: '7d' })
    const href = securityHref('/admin/guvenlik', q)
    expect(href).toBe('/admin/guvenlik?tab=events&page=2&severity=high&severity=low&triage=all&range=7d')
    expect(parseSecurityQuery(Object.fromEntries(new URL(`http://x${href}`).searchParams.entries()))).toMatchObject({ tab: 'events', page: 2, triage: 'all', range: '7d' })
    expect(securityHref('/admin/guvenlik', { tab: 'overview' })).toBe('/admin/guvenlik')
  })
})

describe('display helpers', () => {
  it('shortens hashes and formats instants in UTC', () => {
    expect(shortHash('abcdef0123456789abcdef')).toBe('abcdef0123…')
    expect(shortHash('abc')).toBe('abc')
    expect(shortHash(null)).toBe('')
    expect(formatInstant('2026-11-18T09:05:00.000Z', 'en')).toMatch(/18 Nov 2026.*09:05 UTC/)
    expect(formatInstant('garbage', 'tr')).toBe('')
    expect(documentHref('/admin', 'security-events', '12/../../x')).toBe('/admin/collections/security-events/12%2F..%2F..%2Fx')
  })

  it('flattens detail to redacted primitives', () => {
    const out = safeDetail({
      window: '1h', attempts: 4, ok: true, time: '12:34:56',
      nested: { a: 1 }, list: [1, 2],
      who: 'jane.doe@example.com', from: '203.0.113.77', prefix: '203.0.113.0/24', v6Prefix: '2001:db8:1::/48',
      v6: '2001:db8:85a3:0:0:8a2e:370:7334', v6Short: '2001:db8::1', v6LinkLocal: 'fe80::1', v6Loopback: '::1',
      v6Mapped: '::ffff:192.0.2.1', hostCidr4: '203.0.113.77/32', nonZeroCidr4: '203.0.113.77/24', hostCidr6: '2001:db8::1/48',
      licenseKey: 'ABCD-1234', apiKey: 'zzz', fingerprint: 'deadbeef', note: 'x'.repeat(500),
    })
    const byKey = Object.fromEntries(out.entries.map((e) => [e.key, e]))
    expect(byKey.window).toMatchObject({ value: '1h', redacted: false })
    expect(byKey.time).toMatchObject({ value: '12:34:56', redacted: false })
    expect(byKey.attempts!.value).toBe('4')
    expect(byKey.nested).toBeUndefined()
    expect(byKey.list).toBeUndefined()
    expect(byKey.prefix).toMatchObject({ value: '203.0.113.0/24', redacted: false })
    expect(byKey.v6Prefix).toMatchObject({ value: '2001:db8:1::/48', redacted: false })
    for (const k of [
      'who', 'from', 'v6', 'v6Short', 'v6LinkLocal', 'v6Loopback', 'v6Mapped',
      'hostCidr4', 'nonZeroCidr4', 'hostCidr6', 'licenseKey', 'apiKey', 'fingerprint',
    ]) expect(byKey[k], k).toMatchObject({ value: '', redacted: true })
    expect(byKey.note!.value.length).toBeLessThanOrEqual(DETAIL_LIMITS.maxValueLength + 1)

    const out2 = safeDetail({
      devicePublicKey: 'pk-123', thumbprint: 'tp-123', ipHash: 'ih-123', nonce: 'nn-123',
      embeddedKey: 'failed 7KQ9M-XH4TB-ABCDE-23456-789XY check',
      embeddedJwt: 'eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl',
      pem: '-----BEGIN PRIVATE KEY-----',
    })
    const byKey2 = Object.fromEntries(out2.entries.map((e) => [e.key, e]))
    for (const k of ['devicePublicKey', 'thumbprint', 'ipHash', 'nonce', 'embeddedKey', 'embeddedJwt', 'pem']) {
      expect(byKey2[k], k).toMatchObject({ value: '', redacted: true })
    }
    expect(JSON.stringify([out, out2])).not.toMatch(/jane\.doe|203\.0\.113\.77|ABCD-1234|deadbeef|2001:db8::1|fe80::1|::1|7KQ9M-XH4TB|eyJhbGci|pk-123|tp-123|ih-123|nn-123|PRIVATE KEY/)
  })

  it('caps the number of entries and tolerates non-objects', () => {
    const many = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`k${i}`, i]))
    const out = safeDetail(many)
    expect(out.entries).toHaveLength(DETAIL_LIMITS.maxEntries)
    expect(out.truncated).toBe(true)
    for (const v of [null, undefined, 'x', 3, [1, 2]]) expect(safeDetail(v)).toEqual({ entries: [], truncated: false })
  })
})

describe('labels', () => {
  const covers = (map: Record<string, unknown>, values: readonly string[], name: string) => {
    for (const v of values) expect(map[v], `${name}.${v}`).toBeDefined()
    expect(Object.keys(map).sort(), name).toEqual([...values].sort())
  }
  it('has a TR and EN label for every stored enum value', () => {
    covers(L.severities, SECURITY_SEVERITIES, 'severities')
    covers(L.triage, SECURITY_TRIAGE_STATES, 'triage')
    covers(L.sources, SECURITY_EVENT_SOURCES, 'sources')
    covers(L.actionsTaken, SECURITY_ACTIONS_TAKEN, 'actionsTaken')
    covers(L.eventTypes, SECURITY_EVENT_TYPES, 'eventTypes')
    covers(L.blockKinds, SECURITY_BLOCK_KINDS, 'blockKinds')
    covers(L.blockScopes, SECURITY_BLOCK_SCOPES, 'blockScopes')
    covers(L.blockSources, SECURITY_BLOCK_SOURCES, 'blockSources')
    covers(L.licenseStatuses, LICENSE_STATUSES, 'licenseStatuses')
    covers(L.statusReasons, LICENSE_STATUS_REASONS, 'statusReasons')
    covers(L.transitionSources, TRANSITION_SOURCES, 'transitionSources')
    covers(L.activationStatuses, ACTIVATION_STATUSES, 'activationStatuses')
    covers(L.platforms, DEVICE_PLATFORMS, 'platforms')
  })
})

type Call = { collection: string; args: Record<string, unknown> }
function fakePayload(calls: Call[], overrides: { find?: (a: Record<string, unknown>) => unknown } = {}) {
  const record = (kind: string) => async (args: Record<string, unknown>) => {
    calls.push({ collection: `${kind}:${String(args.collection)}`, args })
    if (kind === 'find' && overrides.find) return overrides.find(args)
    return kind === 'count' ? { totalDocs: 0 } : { docs: [], totalDocs: 0, totalPages: 0, page: 1 }
  }
  return { config: { routes: { admin: '/admin' } }, logger: { error: vi.fn() }, find: record('find'), count: record('count') }
}

const viewProps = (user: unknown, payload: unknown, searchParams: Record<string, string> = {}, language = 'en', headers = cookieHeaders()) =>
  ({ initPageResult: { req: { user, payload, headers, i18n: { language } } }, searchParams }) as never

describe('SecurityCenterView', () => {
  beforeEach(() => { redirect.mockClear() })

  it('redirects before reading any data (editor, anonymous, API-key admin, bearer-token admin, missing req)', async () => {
    const { SecurityCenterView } = await import('@/admin/security/SecurityCenterView')
    const calls: Call[] = []
    const payload = fakePayload(calls)
    await expect(SecurityCenterView(viewProps(EDITOR, payload))).rejects.toThrow('NEXT_REDIRECT:/admin')
    await expect(SecurityCenterView(viewProps(CUSTOMER, payload))).rejects.toThrow('NEXT_REDIRECT:/admin')
    await expect(SecurityCenterView(viewProps(null, payload))).rejects.toThrow('NEXT_REDIRECT:/admin/login')
    await expect(SecurityCenterView(viewProps(staff(['admin'], { _strategy: 'api-key' }), payload, {}, 'en', new Headers()))).rejects.toThrow('NEXT_REDIRECT:/admin')
    await expect(SecurityCenterView(viewProps(ADMIN, payload, {}, 'en', new Headers({ authorization: 'Bearer jwt' })))).rejects.toThrow('NEXT_REDIRECT:/admin')
    await expect(SecurityCenterView({ initPageResult: undefined, searchParams: {} } as never)).rejects.toThrow('NEXT_REDIRECT:/admin/login')
    expect(calls).toHaveLength(0)
  })

  it('renders the overview for an admin and reads only with the admin user and overrideAccess:false', async () => {
    const { SecurityCenterView } = await import('@/admin/security/SecurityCenterView')
    const calls: Call[] = []
    const html = renderToStaticMarkup(await SecurityCenterView(viewProps(ADMIN, fakePayload(calls))))
    expect(redirect).not.toHaveBeenCalled()
    expect(html).toContain('<h1>Security center</h1>')
    // A custom view under a new key gets no template from Payload: the view must wrap itself.
    expect(html.startsWith('<div data-template="true">')).toBe(true)
    expect(html).toContain('Open high-severity events')
    expect(html).toContain('aria-current="page"')
    expect(calls.length).toBeGreaterThan(5)
    for (const c of calls) {
      expect(c.args.overrideAccess, c.collection).toBe(false)
      expect(c.args.user, c.collection).toBe(ADMIN)
    }
    expect(new Set(calls.map((c) => c.collection))).toEqual(new Set([
      'count:security-events', 'count:security-blocks', 'count:licenses', 'count:license-activations',
      'find:security-events', 'find:licenses', 'find:license-activations', 'find:license-status-log',
    ]))
  })

  it('renders Turkish labels for the Turkish admin language', async () => {
    const { SecurityCenterView } = await import('@/admin/security/SecurityCenterView')
    const html = renderToStaticMarkup(await SecurityCenterView(viewProps(ADMIN, fakePayload([]), {}, 'tr')))
    expect(html).toContain('<h1>Güvenlik merkezi</h1>')
    expect(html).toContain('Açık yüksek önemli olay')
  })

  it('renders the events tab with filters, a row and a link to the document, escaping stored text', async () => {
    const { SecurityCenterView } = await import('@/admin/security/SecurityCenterView')
    const calls: Call[] = []
    const payload = fakePayload(calls, {
      find: (args) => {
        if (args.collection === 'security-events') {
          return {
            docs: [{
              id: 9, type: 'api.replay', severity: 'high', source: 'api', count: 4, triage: 'open', actionTaken: 'throttled',
              firstSeenAt: '2026-11-17T10:00:00.000Z', lastSeenAt: '2026-11-18T10:00:00.000Z', ipPrefix: '203.0.113.0/24', ipHash: 'abcdef0123456789abcdef', country: 'TR',
              ruleKey: '<script>alert(1)</script>', detail: { window: '1h', mail: 'a@b.co' }, license: 5,
            }],
            totalDocs: 120, totalPages: 3, page: 2,
          }
        }
        if (args.collection === 'licenses') return { docs: [{ id: 5, publicId: 'a'.repeat(24), status: 'active', product: 3 }], totalDocs: 1, totalPages: 1, page: 1 }
        if (args.collection === 'products') return { docs: [{ id: 3, title: 'Product <b>X</b>' }], totalDocs: 1, totalPages: 1, page: 1 }
        return { docs: [], totalDocs: 0, totalPages: 0, page: 1 }
      },
    })
    const html = renderToStaticMarkup(await SecurityCenterView(viewProps(ADMIN, payload, { tab: 'events', page: '2', severity: 'high' })))
    expect(html).toContain('href="/admin/collections/security-events/9"')
    expect(html).toContain('href="/admin/collections/licenses/5"')
    expect(html).toContain('203.0.113.0/24')
    expect(html).toContain('abcdef0123…')
    expect(html).not.toContain('abcdef0123456789abcdef')
    expect(html).not.toContain('<script>alert')
    expect(html).not.toContain('<b>X</b>')
    expect(html).not.toContain('a@b.co')
    expect(html).toContain('Page 2 / 3')
    expect(html).toContain('rel="prev"')
    expect(html).toMatch(/<form class="sc-filters"[^>]*action="\/admin\/guvenlik"[^>]*method="get"/)
    expect(html).toMatch(/name="severity" checked="" value="high"/)
    const eventsCall = calls.find((c) => c.collection === 'find:security-events')!
    expect(eventsCall.args).toMatchObject({ page: 2, limit: 50, overrideAccess: false })
    expect(JSON.stringify(eventsCall.args.where)).toContain('"severity":{"in":["high"]}')
  })

  it('shows a neutral notice (no error text) when a read fails', async () => {
    const { SecurityCenterView } = await import('@/admin/security/SecurityCenterView')
    const payload = fakePayload([], { find: () => { throw Object.assign(new Error('SELECT secret FROM x'), { name: 'DbError' }) } })
    const html = renderToStaticMarkup(await SecurityCenterView(viewProps(ADMIN, payload, { tab: 'events' })))
    expect(html).toContain('Some data could not be read')
    expect(html).not.toContain('SELECT secret')
    expect(payload.logger.error).toHaveBeenCalledWith('security-center: events failed (DbError)')
  })
})
