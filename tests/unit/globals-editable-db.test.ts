import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload, PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

/*
 * Real SQLite (all migrations): F7 global writes through the Local API and the MCP auth path
 * (admin users API key → proxied payload, overrideAccess:false), plus anonymous reads.
 */
let payload: Payload
let dir: string
let site: typeof import('../../src/lib/site')
const run = (q: string) => payload.db.drizzle.$client.execute(q)
const API_KEY = 'f7-test-api-key-0123456789abcdef'

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'softmarket-f7-db-'))
  process.env.UPLOADS_DIR = join(dir, 'uploads')
  process.env.DATABASE_URI = `file:${dir}/test.db`
  process.env.PAYLOAD_SECRET ||= 'test-secret-long-enough-for-payload'
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: (await import('../../src/payload.config')).default })
  expect(realpathSync(String((await run('PRAGMA database_list')).rows.find((r) => r.name === 'main')?.file)))
    .toBe(realpathSync(join(dir, 'test.db')))
  const { migrations } = await import('../../src/migrations')
  await payload.db.migrate({ migrations: migrations as unknown as NonNullable<Parameters<typeof payload.db.migrate>[0]>['migrations'] })
  await payload.create({
    collection: 'users', overrideAccess: true,
    data: { email: 'admin-f7@example.com', password: 'Str0ng-pass-F7!', name: 'Admin', roles: ['admin'], enableAPIKey: true, apiKey: API_KEY } as never,
  })
  await run(`INSERT INTO media(id,filename,mime_type,protected,visibility,url) VALUES(1,'logo.svg','image/svg+xml',0,'public','/api/media/file/logo.svg')`)
  await run(`INSERT INTO media(id,filename,mime_type,protected,visibility,url) VALUES(2,'secret.png','image/png',1,'licensed','/api/media/file/secret.png')`)
  site = await import('../../src/lib/site')
}, 120000)
afterAll(async () => { await payload?.destroy(); if (dir) rmSync(dir, { recursive: true, force: true }) })

async function mcpPayload() {
  const { mcpOptions } = await import('../../src/lib/mcp')
  const req = { headers: new Headers({ authorization: `Bearer ${API_KEY}` }), payload } as unknown as PayloadRequest
  const access = await mcpOptions.overrideAuth!(req, vi.fn())
  return { mcp: req.payload, user: access.user, access }
}

describe('F7 globals through Local API and MCP', () => {
  it('rejects a low-contrast accent and malformed hex on every write path', async () => {
    const error = await payload.updateGlobal({ slug: 'site-settings', data: { brand: { accent: '#e11d48' } }, overrideAccess: true })
      .then(() => null, (e: { data?: { errors?: { path: string; message: string }[] } }) => e)
    expect(error?.data?.errors?.[0]).toMatchObject({ path: 'brand.accent', message: expect.stringMatching(/Kontrast yetersiz|Insufficient contrast/) })
    const { mcp, user, access } = await mcpPayload()
    expect(access).toMatchObject({ siteSettings: { find: true, update: true }, header: { update: true }, footer: { update: true } })
    await expect(mcp.updateGlobal({ slug: 'site-settings', data: { brand: { accent: 'red;x:y' } }, overrideAccess: false, user }))
      .rejects.toThrow()
    expect((await payload.findGlobal({ slug: 'site-settings', depth: 0 })).brand?.accent ?? null).toBeNull()
  })

  it('MCP admin key updates settings (normalized accent, motion, logo) and the header with route links', async () => {
    const { mcp, user } = await mcpPayload()
    const saved = await mcp.updateGlobal({ slug: 'site-settings', locale: 'tr', overrideAccess: false, user,
      data: { siteName: 'Acme', brand: { accent: '#0F766E' }, motion: 'none', logoDark: 1, favicon: 2 } })
    expect(saved).toMatchObject({ brand: { accent: '#0f766e' }, motion: 'none' })
    await mcp.updateGlobal({ slug: 'header', locale: 'tr', overrideAccess: false, user, data: {
      navItems: [
        { link: { type: 'route', route: 'urunler', label: 'Ürünler' }, megaMenu: 'products' },
        { link: { type: 'route', route: 'sirket_hakkimizda', label: 'Şirket' }, megaMenu: 'custom',
          columns: [{ title: 'Kurumsal', links: [{ link: { type: 'route', route: 'kariyer', label: 'Kariyer' } }] }],
          featured: { title: 'Demo', link: { type: 'route', route: 'demo-talep', label: 'Planla' } } },
      ],
      cta: { link: { type: 'route', route: 'demo-talep', label: 'Demo' }, secondary: { type: 'route', route: 'teklif-iste', label: 'Teklif' } },
      announcement: { enabled: true, text: 'Duyuru', link: { type: 'route', route: 'yasal_slug', routeParam: 'eula', label: 'EULA' } },
    } })
    await expect(mcp.updateGlobal({ slug: 'header', overrideAccess: false, user, data: {
      navItems: [{ link: { type: 'route', route: 'yasal_slug', routeParam: '../admin', label: 'Bad' } }],
    } })).rejects.toThrow()
    await expect(mcp.updateGlobal({ slug: 'header', overrideAccess: false, user, data: {
      navItems: [{ link: { type: 'route', label: 'Missing' } }],
    } })).rejects.toThrow()

    // Anonymous public reads.
    const nav = await site.getHeaderNav('tr')
    expect(nav.items.map((i) => i.href)).toEqual(['/urunler', '/sirket/hakkimizda'])
    expect(nav.items[1]).toMatchObject({ mega: 'custom', columns: [{ links: [{ href: '/kariyer' }] }], featured: { link: { href: '/demo-talep' } } })
    expect(nav.cta?.href).toBe('/demo-talep')
    expect(nav.secondaryCta?.href).toBe('/teklif-iste')
    expect(nav.announcement?.link?.href).toBe('/yasal/eula')
    const identity = site.siteIdentity(await site.getSiteSettings('tr'), 'SoftMarket')
    expect(identity).toMatchObject({ name: 'Acme', accent: '#0f766e', motion: 'none' })
    expect(identity.logoOnDark?.url).toBe('/api/media/file/logo.svg')
    expect(identity.favicon).toBeNull() // protected media never reaches the public chrome
  })
})
