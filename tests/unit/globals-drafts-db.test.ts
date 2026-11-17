import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Payload, PayloadRequest } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const cache = vi.hoisted(() => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('next/cache', () => cache)

import { VERSION_CONFLICT_STATUS } from '../../src/editor/canvas/concurrency'

/*
 * G1 (plan-visual-globals) on a real temporary SQLite with every migration: header/footer drafts.
 * - `_status` safety: a draft-status write without `draft: true` (Local API, REST, MCP) and a draft restore are
 *   refused with 400 and change nothing; drafts never reach public reads; the importer always publishes.
 * - Revalidation only on publish (autosave/draft saves never invalidate the whole site).
 * - editorVersion/409 optimistic concurrency for globals.
 * - Draft chrome reads only for a staff preview user (getHeaderNav/getFooterData).
 * - Link address validation (`linkField().url`).
 */
let payload: Payload
let dir: string
let site: typeof import('../../src/lib/site')
let admin: Record<string, unknown>
const run = (q: string) => payload.db.drizzle.$client.execute(q)
const ORIGIN = 'http://127.0.0.1:3100'
const API_KEY = 'g1-test-api-key-0123456789abcdef'
const ADMIN = { email: 'admin-g1@example.test', password: 'Str0ng-pass-G1!' }
const config = async () => (await import('../../src/payload.config')).default

type Nav = { link: Record<string, unknown>; id?: string }
const nav = (label: string, extra: Record<string, unknown> = {}): Nav => ({ link: { type: 'route', route: 'urunler', label, ...extra } })
const publicHeader = async (locale: 'tr' | 'en' = 'tr') =>
  (await payload.findGlobal({ slug: 'header', locale, depth: 0, overrideAccess: false, user: null, draft: false })) as unknown as Record<string, unknown> & { navItems?: Nav[] }
const draftHeader = async (locale: 'tr' | 'en' = 'tr') =>
  (await payload.findGlobal({ slug: 'header', locale, fallbackLocale: false, depth: 0, overrideAccess: true, draft: true })) as unknown as Record<string, unknown> & { navItems?: Nav[]; editorVersion: string }
const labels = (doc: { navItems?: Nav[] } | null) => (doc?.navItems ?? []).map((n) => n.link.label)
const errorOf = (p: Promise<unknown>) => p.then(() => null, (e: { status?: number; data?: { errors?: { path: string; message: string }[] } }) => e)

async function rest(path: string, query: string, body: unknown) {
  const routes = await import('@payloadcms/next/routes')
  const token = (await payload.login({ collection: 'users', data: ADMIN })).token!
  const res = await routes.REST_POST(await config())(new Request(`${ORIGIN}/api/${path}${query}`, {
    method: 'POST',
    headers: { host: '127.0.0.1:3100', origin: ORIGIN, 'sec-fetch-site': 'same-origin', cookie: `payload-token=${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }), { params: Promise.resolve({ slug: path.split('/') }) })
  return { status: res.status, text: await res.text() }
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'softmarket-g1-db-'))
  process.env.UPLOADS_DIR = join(dir, 'uploads')
  process.env.DATABASE_URI = `file:${dir}/test.db`
  process.env.PAYLOAD_SECRET ||= 'test-secret-long-enough-for-payload'
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: await config() })
  expect(realpathSync(String((await run('PRAGMA database_list')).rows.find((r) => r.name === 'main')?.file)))
    .toBe(realpathSync(join(dir, 'test.db')))
  const { migrations } = await import('../../src/migrations')
  await payload.db.migrate({ migrations: migrations as unknown as NonNullable<Parameters<typeof payload.db.migrate>[0]>['migrations'] })
  admin = await payload.create({
    collection: 'users', overrideAccess: true,
    data: { ...ADMIN, name: 'Admin', roles: ['admin'], enableAPIKey: true, apiKey: API_KEY } as never,
  }) as unknown as Record<string, unknown>
  await payload.updateGlobal({ slug: 'header', locale: 'tr', overrideAccess: true, data: { navItems: [nav('Yayında')], _status: 'published' } as never })
  const rows = (await draftHeader('tr')).navItems!
  await payload.updateGlobal({ slug: 'header', locale: 'en', overrideAccess: true, data: { navItems: rows.map((r) => ({ ...r, link: { ...r.link, label: 'Live' } })), _status: 'published' } as never })
  site = await import('../../src/lib/site')
}, 240000)
afterAll(async () => { vi.unstubAllEnvs(); await payload?.destroy(); if (dir) rmSync(dir, { recursive: true, force: true }) })
beforeEach(() => { cache.revalidatePath.mockClear(); vi.stubEnv('NEXT_RUNTIME', 'nodejs') })

describe('G1 _status safety', () => {
  it('Local API: _status draft without draft:true is refused and changes nothing; draft:true stays out of public reads', async () => {
    const before = await publicHeader()
    const error = await errorOf(payload.updateGlobal({ slug: 'header', locale: 'tr', overrideAccess: true, data: { navItems: [nav('Sızıntı')], _status: 'draft' } as never }))
    expect(error).toMatchObject({ status: 400 })
    expect(error?.data?.errors?.[0]).toMatchObject({ path: '_status', message: expect.stringContaining('draft: true') })
    expect(await publicHeader()).toEqual(before)
    // The admin "Unpublish" request shape is refused as well (the content would stay public).
    expect(await errorOf(payload.updateGlobal({ slug: 'footer', overrideAccess: true, data: { _status: 'draft' } as never }))).toMatchObject({ status: 400 })
    await payload.updateGlobal({ slug: 'header', locale: 'tr', draft: true, overrideAccess: true, data: { navItems: [{ ...before.navItems![0]!, link: { ...before.navItems![0]!.link, label: 'Taslak' } }] } as never })
    expect(labels(await publicHeader())).toEqual(['Yayında'])
    expect(labels(await draftHeader())).toEqual(['Taslak'])
    expect(String((await run('SELECT _status FROM header')).rows[0]?._status)).toBe('published')
  })

  it('REST (admin session): draft-status write without ?draft=true is 400; with ?draft=true it saves a draft', async () => {
    const refused = await rest('globals/header', '?locale=tr&depth=0', { navItems: [nav('REST sızıntı')], _status: 'draft' })
    expect(refused.status).toBe(400)
    expect(refused.text).toContain('_status')
    expect(labels(await publicHeader())).toEqual(['Yayında'])
    const draft = await rest('globals/header', '?locale=tr&depth=0&draft=true&autosave=true', { navItems: [nav('REST taslak')] })
    expect(draft.status).toBe(200)
    // The admin autosave request (REST ?draft=true&autosave=true) never revalidates the site.
    expect(cache.revalidatePath).not.toHaveBeenCalled()
    expect(labels(await publicHeader())).toEqual(['Yayında'])
    expect(labels(await draftHeader())).toEqual(['REST taslak'])
  })

  it('MCP (admin API key): draft:false with _status draft is refused; draft:true writes only a version', async () => {
    const { mcpOptions } = await import('../../src/lib/mcp')
    const req = { headers: new Headers({ authorization: `Bearer ${API_KEY}` }), payload } as unknown as PayloadRequest
    const { user } = await mcpOptions.overrideAuth!(req, vi.fn())
    await expect(req.payload.updateGlobal({ slug: 'header', locale: 'tr', overrideAccess: false, user, data: { navItems: [nav('MCP')], _status: 'draft' } as never }))
      .rejects.toMatchObject({ status: 400 })
    await req.payload.updateGlobal({ slug: 'header', locale: 'tr', draft: true, overrideAccess: false, user, data: { navItems: [nav('MCP taslak')] } as never })
    expect(labels(await publicHeader())).toEqual(['Yayında'])
  })

  it('restoring a draft version (or restoring as draft) is refused; a published version restore publishes', async () => {
    const versions = await payload.findGlobalVersions({ slug: 'header', sort: '-updatedAt', limit: 50, overrideAccess: true })
    const draft = versions.docs.find((v) => (v.version as { _status?: string })._status === 'draft')!
    const published = versions.docs.find((v) => (v.version as { _status?: string })._status === 'published')!
    expect(await errorOf(payload.restoreGlobalVersion({ slug: 'header', id: String(draft.id), overrideAccess: true }))).toMatchObject({ status: 400 })
    // "Restore as draft" exists only on REST (?draft=true); the Local API has no draft option for global restores.
    expect((await rest(`globals/header/versions/${published.id}`, '?draft=true', {})).status).toBe(400)
    expect(cache.revalidatePath).not.toHaveBeenCalled()
    await payload.restoreGlobalVersion({ slug: 'header', id: String(published.id), overrideAccess: true })
    expect(labels(await publicHeader())).toEqual(['Yayında'])
    expect(cache.revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })
})

describe('G1 revalidation', () => {
  it('draft and autosave saves never revalidate; publishing revalidates once; site-settings (no drafts) always does', async () => {
    const base = await draftHeader()
    await payload.updateGlobal({ slug: 'header', locale: 'tr', draft: true, overrideAccess: true, data: { navItems: [{ ...base.navItems![0]!, link: { ...base.navItems![0]!.link, label: 'Oto' } }] } as never })
    await payload.updateGlobal({ slug: 'footer', locale: 'tr', draft: true, overrideAccess: true, data: { copyright: 'Taslak ©' } as never })
    expect(cache.revalidatePath).not.toHaveBeenCalled()
    await payload.updateGlobal({ slug: 'header', locale: 'tr', overrideAccess: true, data: { navItems: [{ ...base.navItems![0]!, link: { ...base.navItems![0]!.link, label: 'Yayında' } }], _status: 'published' } as never })
    expect(cache.revalidatePath.mock.calls.filter(([p, t]) => p === '/' && t === 'layout')).toHaveLength(1)
    cache.revalidatePath.mockClear()
    await payload.updateGlobal({ slug: 'site-settings', overrideAccess: true, data: { motion: 'subtle' } as never })
    expect(cache.revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })
})

describe('G1 importer', () => {
  it('writes drafts-enabled globals as published, re-publishes a draft main row, and is idempotent', async () => {
    const { importContent } = await import('../../src/lib/content-import/importer')
    const seed = { version: 1, globals: {
      footer: { tr: { copyright: 'İçe aktarılan ©', columns: [{ title: 'Kolon', links: [{ link: { type: 'route', route: 'urunler', label: 'Ürünler' } }] }] },
        en: { copyright: 'Imported ©', columns: [{ title: 'Column', links: [{ link: { type: 'route', route: 'urunler', label: 'Products' } }] }] } },
    } }
    const go = () => importContent({ payload, root: resolve('content/seed'), sources: [{ file: 'g1.json', seed: seed as never }], markdown: (t) => ({ root: { text: t } }), log: () => {} })
    await go()
    const footer = await payload.findGlobal({ slug: 'footer', locale: 'tr', depth: 0, overrideAccess: false, user: null })
    expect(footer).toMatchObject({ _status: 'published', copyright: 'İçe aktarılan ©', columns: [{ title: 'Kolon' }] })
    const count = async () => Number((await run('SELECT COUNT(*) AS n FROM _footer_v')).rows[0]?.n)
    const versions = await count()
    await go()
    expect(await count()).toBe(versions)
    // A main row that is somehow not published (e.g. a pre-backfill database) is re-written as published.
    await run(`UPDATE footer SET _status = 'draft'`)
    await go()
    expect(String((await run('SELECT _status FROM footer')).rows[0]?._status)).toBe('published')
  })
})

describe('G1 optimistic concurrency (editorVersion)', () => {
  const save = (version: string | undefined, label: string) => draftHeader().then((base) =>
    payload.updateGlobal({ slug: 'header', locale: 'tr', draft: true, overrideAccess: true,
      data: { navItems: [{ ...base.navItems![0]!, link: { ...base.navItems![0]!.link, label } }], ...(version ? { editorVersion: version } : {}) } as never }))

  it('tokens are locale-independent and hidden from anonymous reads; stale writes get 409; versionless writes pass', async () => {
    const tr = await draftHeader('tr')
    expect(tr.editorVersion).toMatch(/^[a-f0-9]{64}$/)
    expect((await draftHeader('en')).editorVersion).toBe(tr.editorVersion)
    expect(await publicHeader()).not.toHaveProperty('editorVersion')
    const saved = (await save(tr.editorVersion, 'Sürüm 1')) as unknown as { editorVersion: string }
    expect(saved.editorVersion).toBe((await draftHeader()).editorVersion)
    await expect(save(tr.editorVersion, 'Eski')).rejects.toMatchObject({ status: VERSION_CONFLICT_STATUS })
    await save(undefined, 'Sürümsüz')
    expect(labels(await draftHeader())).toEqual(['Sürümsüz'])
    for (const table of ['header', '_header_v', 'footer', '_footer_v']) {
      const columns = await run(`PRAGMA table_info(${table})`)
      expect(columns.rows.some((row) => /editor.?version/i.test(String(row.name)))).toBe(false)
    }
  })

  it('two concurrent saves from the same base: exactly one wins, the other gets 409, no data is lost', async () => {
    const base = (await draftHeader()).editorVersion
    const results = await Promise.allSettled([save(base, 'Sekme A'), save(base, 'Sekme B')])
    const won = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<unknown>[]
    const lost = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
    expect(won).toHaveLength(1)
    expect(lost).toHaveLength(1)
    expect(lost[0]!.reason).toMatchObject({ status: VERSION_CONFLICT_STATUS })
    const stored = await draftHeader()
    expect(labels(stored)).toEqual([labels(won[0]!.value as { navItems?: Nav[] })[0]])
    expect(stored.editorVersion).toBe((won[0]!.value as { editorVersion: string }).editorVersion)
  })
})

describe('G1 chrome draft reads', () => {
  it('anonymous loaders see the published chrome; a staff preview user sees the draft', async () => {
    const base = await draftHeader()
    await payload.updateGlobal({ slug: 'header', locale: 'tr', draft: true, overrideAccess: true, data: { navItems: [{ ...base.navItems![0]!, link: { ...base.navItems![0]!.link, label: 'Önizleme' } }] } as never })
    await payload.updateGlobal({ slug: 'footer', locale: 'tr', draft: true, overrideAccess: true, data: { brandBlurb: 'Taslak marka' } as never })
    const staff = { ...admin, collection: 'users' } as never
    expect((await site.getHeaderNav('tr')).items.map((i) => i.label)).toEqual(['Yayında'])
    expect((await site.getHeaderNav('tr', staff)).items.map((i) => i.label)).toEqual(['Önizleme'])
    expect((await site.getFooterData('tr')).brandBlurb).not.toBe('Taslak marka')
    expect((await site.getFooterData('tr', staff)).brandBlurb).toBe('Taslak marka')
  })
})

describe('G1 link address validation', () => {
  const publish = (url: string) => payload.updateGlobal({ slug: 'header', locale: 'tr', overrideAccess: true,
    data: { navItems: [nav('Harici', { type: 'external', url })], _status: 'published' } as never })

  it('rejects script/data schemes and protocol-relative addresses on publish; accepts http(s)/mailto/tel/paths', async () => {
    for (const url of ['javascript:alert(1)', ' JavaScript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,x', 'vbscript:msgbox', '//evil.example', '/\\evil.example', 'www.example.com']) {
      const error = await errorOf(publish(url))
      expect(error, url).toMatchObject({ status: 400 })
      expect(error?.data?.errors?.[0]?.path, url).toMatch(/url$/)
    }
    for (const url of ['https://example.com/a', 'http://example.com', 'mailto:info@example.com', 'tel:+902120000000', '/tr/iletisim', '#form']) {
      await expect(publish(url), url).resolves.toBeTruthy()
    }
  })

  it('an unchanged stored invalid placeholder does not block saving; a new invalid or dangerous value does', async () => {
    await publish('https://stored.example')
    // Stored before G1 (main row and latest version), e.g. a placeholder that render already drops.
    const store = async (url: string, from: string) => {
      for (const table of ['header_nav_items_locales', '_header_v_version_nav_items_locales']) await run(`UPDATE ${table} SET link_url = '${url}' WHERE link_url = '${from}'`)
    }
    await store('mailto:[ŞİRKET E-POSTA]', 'https://stored.example')
    const stored = await draftHeader()
    await expect(payload.updateGlobal({ slug: 'header', locale: 'tr', overrideAccess: true, data: { navItems: stored.navItems, cta: { link: { type: 'route', route: 'iletisim', label: 'Bize ulaşın' } }, _status: 'published' } as never }))
      .resolves.toBeTruthy()
    expect(await errorOf(publish('mailto:[COMPANY EMAIL]'))).toMatchObject({ status: 400 })
    await publish('https://stored.example')
    await store('javascript:alert(1)', 'https://stored.example')
    const dangerous = await draftHeader()
    expect(await errorOf(payload.updateGlobal({ slug: 'header', locale: 'tr', overrideAccess: true, data: { navItems: dangerous.navItems, _status: 'published' } as never })))
      .toMatchObject({ status: 400 })
  })
})

describe('G1 audit regressions', () => {
  it('a newly invalid draft URL cannot be grandfathered by publishing it unchanged', async () => {
    await payload.updateGlobal({ slug: 'header', locale: 'tr', data: { navItems: [nav('External', { type: 'external', url: 'https://example.test' })], _status: 'published' } as never })
    const base = await draftHeader()
    const published = await publicHeader()
    const items = [{ ...base.navItems![0]!, link: { ...base.navItems![0]!.link, url: 'mailto:[NEW INVALID]' } }]
    await payload.updateGlobal({ slug: 'header', locale: 'tr', draft: true, data: { navItems: items } as never })
    const draft = await draftHeader()
    cache.revalidatePath.mockClear()
    await expect(payload.updateGlobal({ slug: 'header', locale: 'tr', data: { navItems: items, _status: 'published' } as never }))
      .rejects.toMatchObject({ status: 400 })
    expect(await publicHeader()).toEqual(published)
    expect(await draftHeader()).toEqual(draft)
    expect(cache.revalidatePath).not.toHaveBeenCalled()
  })

  it('public and customer draft queries cannot read unpublished chrome or version history', async () => {
    for (const slug of ['header', 'footer'] as const) {
      await payload.updateGlobal({ slug, locale: 'tr', data: { _status: 'published', ...(slug === 'header' ? { navItems: [nav('Public link')] } : {}) } })
      const live = await payload.findGlobal({ slug, locale: 'tr', depth: 0, overrideAccess: false, user: null })
      await payload.updateGlobal({ slug, locale: 'tr', draft: true, data: (slug === 'header'
        ? { announcement: { text: 'Private announcement' } } : { brandBlurb: 'Private brand' }) as never })
      for (const user of [null, { id: 999999, collection: 'customers' } as never]) {
        const read = await payload.findGlobal({ slug, locale: 'tr', depth: 0, overrideAccess: false, user, draft: true })
        expect(read).toEqual(live)
        await expect(payload.findGlobalVersions({ slug, overrideAccess: false, user })).rejects.toMatchObject({ status: 403 })
      }
      const routes = await import('@payloadcms/next/routes')
      const path = `globals/${slug}`
      const response = await routes.REST_GET(await config())(new Request(`${ORIGIN}/api/${path}?draft=true&locale=tr&depth=0`),
        { params: Promise.resolve({ slug: path.split('/') }) })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(live)
    }
  })

  it('an update without status cannot implicitly publish an existing draft', async () => {
    await payload.updateGlobal({ slug: 'footer', locale: 'tr', data: { brandBlurb: 'Public brand', _status: 'published' } })
    await payload.updateGlobal({ slug: 'footer', locale: 'tr', draft: true, data: { brandBlurb: 'Private brand' } })
    await expect(payload.updateGlobal({ slug: 'footer', locale: 'tr', data: { showContact: false } }))
      .rejects.toMatchObject({ status: 400 })
    expect(await payload.findGlobal({ slug: 'footer', locale: 'tr', overrideAccess: false, user: null }))
      .toMatchObject({ _status: 'published', brandBlurb: 'Public brand' })
  })

  it('projected writes are refused before they can truncate versions or skip revalidation', async () => {
    const before = await payload.findGlobal({ slug: 'footer', draft: true })
    await expect(payload.updateGlobal({ slug: 'footer', locale: 'tr', data: { brandBlurb: 'Projected publish', _status: 'published' }, select: { brandBlurb: true } }))
      .rejects.toMatchObject({ status: 400 })
    expect(await payload.findGlobal({ slug: 'footer', draft: true })).toEqual(before)
    expect(cache.revalidatePath).not.toHaveBeenCalled()
  })

  it('a published restore invalidates stale editor tokens and supersedes the latest draft', async () => {
    await payload.updateGlobal({ slug: 'footer', locale: 'tr', data: { brandBlurb: 'Restore target', _status: 'published' } })
    const versions = await payload.findGlobalVersions({ slug: 'footer', sort: '-updatedAt', limit: 1 })
    await payload.updateGlobal({ slug: 'footer', locale: 'tr', draft: true, data: { brandBlurb: 'Unpublished change' } })
    const before = await payload.findGlobal({ slug: 'footer', draft: true })
    await payload.restoreGlobalVersion({ slug: 'footer', id: String(versions.docs[0]!.id) })
    const after = await payload.findGlobal({ slug: 'footer', draft: true })
    expect(after.brandBlurb).toBe('Restore target')
    expect(after.editorVersion).not.toBe(before.editorVersion)
    await expect(payload.updateGlobal({ slug: 'footer', draft: true, data: { brandBlurb: 'Stale save', editorVersion: before.editorVersion } }))
      .rejects.toMatchObject({ status: 409 })
  })

  it('explicit publication works through the admin REST request and the authenticated MCP identity', async () => {
    const result = await rest('globals/footer', '?locale=tr&depth=0', { brandBlurb: 'REST published', _status: 'published' })
    expect(result.status).toBe(200)
    expect(await payload.findGlobal({ slug: 'footer', locale: 'tr', overrideAccess: false, user: null }))
      .toMatchObject({ brandBlurb: 'REST published', _status: 'published' })
    const { mcpOptions } = await import('../../src/lib/mcp')
    const req = { headers: new Headers({ authorization: `Bearer ${API_KEY}` }), payload } as unknown as PayloadRequest
    const { user } = await mcpOptions.overrideAuth!(req, vi.fn())
    await payload.updateGlobal({ slug: 'footer', locale: 'tr', user, overrideAccess: false,
      data: { brandBlurb: 'MCP published', _status: 'published' } })
    expect(await payload.findGlobal({ slug: 'footer', locale: 'tr', overrideAccess: false, user: null }))
      .toMatchObject({ brandBlurb: 'MCP published', _status: 'published' })
    expect(cache.revalidatePath.mock.calls.filter(([path, type]) => path === '/' && type === 'layout')).toHaveLength(2)
  })

  it('restoring a published historical version cannot bypass link validation', async () => {
    await payload.updateGlobal({ slug: 'header', locale: 'tr', data: {
      navItems: [nav('Historical link', { type: 'external', url: 'https://history.example.test' })], _status: 'published',
    } as never })
    const before = await publicHeader()
    const versions = await payload.findGlobalVersions({ slug: 'header', sort: '-updatedAt', limit: 1 })
    const id = Number(versions.docs[0]!.id)
    // Simulate a published version written before G1 introduced URL validation.
    await run(`UPDATE _header_v_version_nav_items_locales SET link_url = 'javascript:alert(1)' WHERE _parent_id IN (SELECT id FROM _header_v_version_nav_items WHERE _parent_id = ${id})`)
    cache.revalidatePath.mockClear()
    await expect(payload.restoreGlobalVersion({ slug: 'header', id: String(id) })).rejects.toMatchObject({ status: 400 })
    expect(await publicHeader()).toEqual(before)
    expect(cache.revalidatePath).not.toHaveBeenCalled()
    await run(`UPDATE _header_v_version_nav_items_locales SET link_url = 'https://history.example.test' WHERE _parent_id IN (SELECT id FROM _header_v_version_nav_items WHERE _parent_id = ${id})`)
  })
})
