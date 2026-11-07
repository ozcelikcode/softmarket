import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * F8 on real SQLite + real Payload auth:
 * - `pages_autosave` migration: additive up(), down() keeps every row.
 * - /api/preview gate: anonymous 401, customer (portal cookie or JWT) 403, cross-site 403, bad redirect 400 —
 *   none enable draft mode; editor/admin enable it and get a relative redirect.
 * - Draft leakage: loaders return drafts only for draft mode + live staff session; a draft cookie alone,
 *   a customer session or no draft mode always read the published version.
 * - Autosave/draft writes never call revalidatePath; publishing does.
 */
const state = vi.hoisted(() => ({
  draft: { isEnabled: false, enable: () => { state.draft.isEnabled = true }, disable: () => { state.draft.isEnabled = false } },
  headers: new Headers(),
}))
vi.mock('next/headers', () => ({ draftMode: async () => state.draft, headers: async () => state.headers }))
const nextCache = vi.hoisted(() => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('next/cache', () => nextCache)

const NAME = '20261107_190342_pages_autosave'
let payload: Payload
let dir: string
let content: typeof import('../../src/lib/content')
let route: typeof import('../../src/lib/preview-route')
let PORTAL_COOKIE: string
const run = (q: string) => payload.db.drizzle.$client.execute(q)
type Migration = { name: string; up: (a: never) => Promise<void>; down: (a: never) => Promise<void> }
const cookies = { editor: '', admin: '', customerPortal: '', customerJwt: '' }

const login = async (collection: 'users' | 'customers', email: string) =>
  (await payload.login({ collection, data: { email, password: 'Preview-test-123!' } })).token as string

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'softmarket-f8-'))
  process.env.UPLOADS_DIR = join(dir, 'uploads')
  process.env.DATABASE_URI = `file:${dir}/test.db`
  process.env.PAYLOAD_SECRET ||= 'test-secret-long-enough-for-payload'
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: (await import('../../src/payload.config')).default })
  const { migrations } = (await import('../../src/migrations')) as unknown as { migrations: Migration[] }
  const index = migrations.findIndex((m) => m.name === NAME)
  expect(index).toBe(migrations.length - 1)
  type MigrateArgs = NonNullable<Parameters<typeof payload.db.migrate>[0]>['migrations']
  await payload.db.migrate({ migrations: migrations.slice(0, index) as unknown as MigrateArgs })
  // Pre-F8 version rows must survive up/down.
  await run(`INSERT INTO pages(id,page_type,_status) VALUES(1,'standard','published')`)
  await run(`INSERT INTO _pages_v(id,parent_id,version__status,latest) VALUES(1,1,'published',1)`)
  const before = (await run('SELECT * FROM _pages_v ORDER BY id')).rows
  const migration = migrations[index]
  await payload.db.drizzle.transaction(async (db) => migration.up({ db, payload, req: {} } as never))
  expect((await run('SELECT autosave FROM _pages_v')).rows).toEqual([{ autosave: null }])
  await payload.db.drizzle.transaction(async (db) => migration.down({ db, payload, req: {} } as never))
  expect((await run('SELECT * FROM _pages_v ORDER BY id')).rows).toEqual(before)
  await payload.db.migrate({ migrations: migrations.slice(index) as unknown as MigrateArgs })
  await run(`DELETE FROM _pages_v`)
  await run(`DELETE FROM pages`)

  content = await import('../../src/lib/content')
  route = await import('../../src/lib/preview-route')
  PORTAL_COOKIE = (await import('../../src/lib/portal/cookie')).PORTAL_COOKIE
  const password = 'Preview-test-123!'
  await payload.create({ collection: 'users', overrideAccess: true, data: { email: 'admin@f8.test', password, roles: ['admin'] } })
  await payload.create({ collection: 'users', overrideAccess: true, data: { email: 'editor@f8.test', password, roles: ['editor'] } })
  await payload.create({ collection: 'customers', overrideAccess: true, disableVerificationEmail: true,
    data: { email: 'customer@f8.test', password, name: 'Müşteri' } as never })
  await run(`UPDATE customers SET _verified = 1`)
  cookies.admin = `payload-token=${await login('users', 'admin@f8.test')}`
  cookies.editor = `payload-token=${await login('users', 'editor@f8.test')}`
  const customerToken = await login('customers', 'customer@f8.test')
  cookies.customerPortal = `${PORTAL_COOKIE}=${customerToken}`
  cookies.customerJwt = `payload-token=${customerToken}`
}, 120000)
afterAll(async () => { await payload?.destroy(); if (dir) rmSync(dir, { recursive: true, force: true }) })
beforeEach(() => { state.draft.isEnabled = false; state.headers = new Headers() })

describe(`migration ${NAME}`, () => {
  it('up() only adds the autosave column + index; down() drops only them (no rebuild)', () => {
    const source = readFileSync(join(process.cwd(), 'src/migrations', `${NAME}.ts`), 'utf8')
    const [up, down] = source.split('export async function down')
    expect(up).not.toMatch(/DROP |DELETE FROM|__new_|RENAME|PRAGMA/)
    expect(up.match(/ALTER TABLE/g)).toHaveLength(1)
    expect(down).not.toMatch(/__new_|PRAGMA|INSERT INTO|DROP TABLE/)
  })
})

const request = (query: string, headers: Record<string, string> = {}) =>
  new Request(`http://127.0.0.1:3200/api/preview${query}`, { headers })

describe('/api/preview gate', () => {
  it('rejects anonymous (401) and customers (403) without enabling draft mode', async () => {
    const cases: [Record<string, string>, number][] = [
      [{}, 401],
      [{ cookie: 'payload-token=forged.jwt.value' }, 401],
      [{ cookie: '__prerender_bypass=stolen' }, 401],
      [{ cookie: cookies.customerPortal }, 403],
      // A customer JWT in the staff cookie still authenticates as a customer: rejected.
      [{ cookie: cookies.customerJwt }, 403],
      [{ authorization: `JWT ${cookies.customerPortal.split('=')[1]}` }, 403],
    ]
    for (const [headers, status] of cases) {
      const res = await route.enablePreview(request('?redirect=/tr', headers))
      expect(res.status, JSON.stringify(headers)).toBe(status)
      expect(res.headers.get('location')).toBeNull()
      expect(res.headers.get('cache-control')).toBe('private, no-store, max-age=0')
      expect(state.draft.isEnabled).toBe(false)
    }
  })

  it('rejects redirect attack vectors (400) and cross-site navigation (403) even for staff', async () => {
    for (const redirect of ['', '?redirect=', '?redirect=https%3A%2F%2Fevil.example', '?redirect=%2F%2Fevil.example',
      '?redirect=%2F%5Cevil.example', '?redirect=%2Ftr%2F%252F%252Fevil.example', '?redirect=%2Fadmin', '?redirect=%2Ftr%2F..%2Fadmin',
      '?redirect=%2Ftr%0d%0aSet-Cookie%3Ax', '?redirect=javascript%3Aalert(1)']) {
      const res = await route.enablePreview(request(redirect, { cookie: cookies.editor }))
      expect(res.status, redirect).toBe(400)
      expect(state.draft.isEnabled).toBe(false)
    }
    for (const site of ['cross-site', 'same-site', 'none']) {
      const res = await route.enablePreview(request('?redirect=/tr', { cookie: cookies.editor, 'sec-fetch-site': site }))
      expect(res.status).toBe(403)
      expect(state.draft.isEnabled).toBe(false)
    }
    for (const headers of [{}, { origin: 'https://evil.example' }, { referer: 'https://evil.example/' }] as Record<string, string>[]) {
      const res = await route.enablePreview(request('?redirect=/tr', { cookie: cookies.editor, ...headers }))
      expect(res.status).toBe(403)
      expect(state.draft.isEnabled).toBe(false)
    }
    const fallback = await route.enablePreview(request('?redirect=/tr', { cookie: cookies.editor, referer: 'http://127.0.0.1:3200/admin' }))
    expect(fallback.status).toBe(307)
  })

  it('editor and admin enable draft mode and are redirected to the relative path', async () => {
    for (const cookie of [cookies.editor, cookies.admin]) {
      state.draft.isEnabled = false
      const res = await route.enablePreview(request('?redirect=%2Fen%2Fproducts%2Ferp', { cookie, 'sec-fetch-site': 'same-origin' }))
      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toBe('/en/products/erp')
      expect(res.headers.get('cache-control')).toBe('private, no-store, max-age=0')
      expect(state.draft.isEnabled).toBe(true)
    }
  })

  it('exit-preview disables draft mode and validates its redirect', async () => {
    state.draft.isEnabled = true
    for (const headers of [{}, { 'sec-fetch-site': 'cross-site' }, { origin: 'https://evil.example' }] as Record<string, string>[]) {
      const res = await route.disablePreview(new Request('http://127.0.0.1:3200/api/exit-preview', { headers }))
      expect(res.status).toBe(403)
      expect(state.draft.isEnabled).toBe(true)
    }
    const headers = { 'sec-fetch-site': 'same-origin' }
    const bad = await route.disablePreview(new Request('http://127.0.0.1:3200/api/exit-preview?redirect=%2F%2Fevil.example', { headers }))
    expect(bad.status).toBe(400)
    expect(state.draft.isEnabled).toBe(true)
    const ok = await route.disablePreview(new Request('http://127.0.0.1:3200/api/exit-preview?redirect=%2Ftr%2Fkampanya', { headers }))
    expect([ok.status, ok.headers.get('location'), state.draft.isEnabled]).toEqual([307, '/tr/kampanya', false])
    const dflt = await route.disablePreview(new Request('http://127.0.0.1:3200/api/exit-preview', { headers }))
    expect(dflt.headers.get('location')).toBe('/tr')
  })
})

describe('draft loaders and cache invalidation', () => {
  const as = (draft: boolean, cookie?: string) => {
    state.draft.isEnabled = draft
    state.headers = new Headers(cookie ? { cookie } : {})
  }

  it('serves drafts only to a draft-mode request with a live staff session', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs')
    try {
      const page = await payload.create({ collection: 'pages', locale: 'tr', overrideAccess: true,
        data: { title: 'Yayındaki kampanya', slug: 'f8-kampanya', pageType: 'landing', _status: 'published' } })
      const home = await payload.create({ collection: 'pages', locale: 'tr', overrideAccess: true,
        data: { title: 'Ana sayfa', slug: 'home', _status: 'published' } })
      const post = await payload.create({ collection: 'posts', locale: 'tr', overrideAccess: true,
        data: { title: 'Yayındaki haber', slug: 'f8-haber', _status: 'published' } as never })
      nextCache.revalidatePath.mockClear()

      // Autosave (admin Live Preview) and manual drafts: version rows only, no cache purge.
      for (let i = 0; i < 3; i++) {
        await payload.update({ collection: 'pages', id: page.id, locale: 'tr', overrideAccess: true, draft: true, autosave: true,
          data: { title: `Taslak kampanya ${i}` } })
      }
      await payload.update({ collection: 'pages', id: home.id, locale: 'tr', overrideAccess: true, draft: true, autosave: true,
        data: { title: 'Taslak ana sayfa' } })
      await payload.update({ collection: 'posts', id: post.id, locale: 'tr', overrideAccess: true, draft: true,
        data: { title: 'Taslak haber' } })
      await payload.create({ collection: 'pages', locale: 'tr', overrideAccess: true, draft: true,
        data: { title: 'Hiç yayınlanmamış', slug: 'f8-gizli', pageType: 'landing', _status: 'draft' } })
      expect(nextCache.revalidatePath).not.toHaveBeenCalled()
      // Autosave keeps one rolling autosave version instead of one row per interval.
      expect((await run(`SELECT count(*) AS n FROM _pages_v WHERE parent_id=${page.id} AND autosave=1`)).rows[0].n).toBe(1)

      const read = async () => ({
        landing: (await content.getLandingPage('tr', 'f8-kampanya'))?.title ?? null,
        hidden: (await content.getLandingPage('tr', 'f8-gizli'))?.title ?? null,
        home: (await content.getHomePage('tr'))?.title ?? null,
        post: (await content.getPost('tr', 'f8-haber'))?.title ?? null,
      })
      const published = { landing: 'Yayındaki kampanya', hidden: null, home: 'Ana sayfa', post: 'Yayındaki haber' }
      const drafts = { landing: 'Taslak kampanya 2', hidden: 'Hiç yayınlanmamış', home: 'Taslak ana sayfa', post: 'Taslak haber' }

      as(false); expect(await read()).toEqual(published)
      as(false, cookies.editor); expect(await read()).toEqual(published) // staff without draft mode
      as(true); expect(await read()).toEqual(published) // stolen/forwarded draft cookie, no session
      as(true, 'payload-token=forged.jwt.value'); expect(await read()).toEqual(published)
      as(true, cookies.customerPortal); expect(await read()).toEqual(published)
      as(true, cookies.customerJwt); expect(await read()).toEqual(published)
      as(true, cookies.editor); expect(await read()).toEqual(drafts)
      as(true, cookies.admin); expect(await read()).toEqual(drafts)

      // Re-validated per request: a staff user who lost the role, or whose session was revoked, gets published content.
      const editorId = (await payload.find({ collection: 'users', where: { email: { equals: 'editor@f8.test' } }, overrideAccess: true })).docs[0].id
      const roles = (await run(`SELECT * FROM users_roles WHERE parent_id=${editorId}`)).rows
      await run(`DELETE FROM users_roles WHERE parent_id=${editorId}`)
      as(true, cookies.editor); expect(await read()).toEqual(published)
      for (const r of roles) await run(`INSERT INTO users_roles("order",parent_id,value,id) VALUES(${r.order},${r.parent_id},'${r.value}',${r.id})`)
      as(true, cookies.editor); expect(await read()).toEqual(drafts)
      await run(`DELETE FROM users_sessions WHERE _parent_id=${editorId}`)
      as(true, cookies.editor); expect(await read()).toEqual(published)

      // Publishing purges the cache; the anonymous reader then sees the new version.
      as(false)
      await payload.update({ collection: 'pages', id: page.id, locale: 'tr', overrideAccess: true, data: { _status: 'published' } })
      expect(nextCache.revalidatePath).toHaveBeenCalledWith('/', 'layout')
      expect((await read()).landing).toBe('Taslak kampanya 2')
    } finally {
      vi.unstubAllEnvs()
    }
  }, 120000)
})
