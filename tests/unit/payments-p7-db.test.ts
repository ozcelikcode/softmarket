import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

/* P7 on real temporary SQLite: migration p7_commerce_legal, commerceLegal hook, sitemap flag, readLegalFacts. */
const NAME = '20261116_155928_p7_commerce_legal'
let payload: Payload
let dir: string
const run = (q: string) => payload.db.drizzle.$client.execute(q)
type Migration = { name: string; up: (a: never) => Promise<void>; down: (a: never) => Promise<void> }
type MigrateArgs = NonNullable<Parameters<Payload['db']['migrate']>[0]>['migrations']
let migration: Migration
const args = () => ({ db: payload.db.drizzle, payload, req: {} }) as never
const md = (text: string) => [{ blockType: 'richText', content: { root: { type: 'root', format: '', indent: 0, version: 1, direction: null, children: [
  { type: 'paragraph', format: '', indent: 0, version: 1, direction: null, children: [{ type: 'text', text, format: 0, mode: 'normal', style: '', detail: 0, version: 1 }] }] } } }]
const page = (slug: string, extra: Record<string, unknown>) => payload.create({
  collection: 'pages', locale: 'tr', overrideAccess: true, depth: 0,
  data: { title: slug, slug, pageType: 'legal', _status: 'published', layout: md('Temiz metin.'), ...extra } as never,
})

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'softmarket-p7-'))
  process.env.UPLOADS_DIR = join(dir, 'uploads')
  process.env.DATABASE_URI = `file:${dir}/test.db`
  process.env.PAYLOAD_SECRET ||= 'test-secret-long-enough-for-payload'
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: (await import('../../src/payload.config')).default })
  const { migrations } = (await import('../../src/migrations')) as unknown as { migrations: Migration[] }
  const index = migrations.findIndex((m) => m.name === NAME)
  expect(index).toBeGreaterThanOrEqual(0)
  migration = migrations[index]
  await payload.db.migrate({ migrations: migrations.slice(0, index) as unknown as MigrateArgs })
  await run(`INSERT INTO pages(id,page_type,_status) VALUES(1,'legal','published')`)
  await run(`INSERT INTO pages_locales(title,slug,_locale,_parent_id) VALUES('Eski','eski','tr',1)`)
}, 240000)
afterAll(async () => {
  await payload?.destroy()
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe(`migration ${NAME}`, () => {
  it('up() only adds columns/indexes; down() never rebuilds or deletes rows', async () => {
    const source = readFileSync(join(process.cwd(), 'src/migrations', `${NAME}.ts`), 'utf8')
    const [up, down] = source.split('export async function down')
    expect(up).not.toMatch(/DROP |DELETE FROM|__new_|RENAME|PRAGMA|INSERT INTO|UPDATE `/)
    expect(down).not.toMatch(/__new_|INSERT INTO|RENAME|DELETE FROM|CREATE TABLE/)
    expect([...up.matchAll(/ALTER TABLE \\`(\w+)\\` ADD \\`(\w+)\\`/g)].map((m) => `${m[1]}.${m[2]}`).sort())
      .toEqual(['_pages_v.version_commerce_legal', 'pages.commerce_legal'])

    const snapshot = async () => (await run('SELECT * FROM pages')).rows.map((r) => ({ ...r }))
    const before = await snapshot()
    await migration.up(args())
    const after = await snapshot()
    expect(after.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'commerce_legal')))).toEqual(before)
    expect(after[0].commerce_legal).toBeNull()
    const indexes = async (table: string) => (await run(`PRAGMA index_list('${table}')`)).rows
    expect((await indexes('pages')).find((r) => r.name === 'pages_commerce_legal_idx')).toMatchObject({ unique: 1 })
    expect((await indexes('_pages_v')).find((r) => r.name === '_pages_v_version_version_commerce_legal_idx')).toMatchObject({ unique: 0 })
    const version = String((await run('SELECT sqlite_version() AS version')).rows[0].version).split('.').map(Number)
    expect(version[0] > 3 || (version[0] === 3 && version[1] >= 35)).toBe(true)
    await migration.down(args())
    expect(await snapshot()).toEqual(before)
    expect((await run('PRAGMA integrity_check')).rows[0]).toMatchObject({ integrity_check: 'ok' })
    await migration.up(args())
  }, 240000)
})

describe('commerceLegal behaviour', () => {
  it('reserves a kind in the latest draft, including concurrent assignments', async () => {
    const a = await page('draft-owner-a', {})
    const b = await page('draft-owner-b', {})
    const results = await Promise.allSettled([a, b].map((p) => payload.update({
      collection: 'pages', id: p.id, overrideAccess: true, draft: true,
      data: { commerceLegal: 'distanceSales' },
    })))
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1)
    for (const p of [a, b]) await payload.delete({ collection: 'pages', id: p.id, overrideAccess: true })
  })

  it('allows only one of two concurrent published creates, while multiple NULL kinds are allowed', async () => {
    const results = await Promise.allSettled(['race-a', 'race-b'].map((slug) => page(slug, { commerceLegal: 'preInformation' })))
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1)
    for (const result of results) if (result.status === 'fulfilled') {
      await payload.delete({ collection: 'pages', id: result.value.id, overrideAccess: true })
    }
    const unmarked = await Promise.all(['null-a', 'null-b'].map((slug) => page(slug, { commerceLegal: null })))
    expect(unmarked.map((p) => p.commerceLegal)).toEqual([null, null])
  })

  it('does not count fallback TR, empty or hidden content as translated reviewed legal text', async () => {
    const { readLegalFacts } = await import('../../src/lib/commerce/legal-facts')
    const p = await page('translation-check', { commerceLegal: 'refund' })
    const fact = async (locale: string) => (await readLegalFacts(payload)).find((f) => f.kind === 'refund' && f.locale === locale)
    expect(await fact('tr')).toMatchObject({ draft: false })
    expect(await fact('en')).toMatchObject({ draft: true })
    await payload.update({ collection: 'pages', id: p.id, locale: 'en', overrideAccess: true,
      data: { title: 'English', slug: 'english-legal', layout: md('Reviewed English text.'), _status: 'published' } as never })
    expect(await fact('en')).toMatchObject({ draft: false })
    await payload.update({ collection: 'pages', id: p.id, locale: 'tr', overrideAccess: true, data: { layout: [] } })
    expect(await fact('tr')).toMatchObject({ draft: true })
    await payload.update({ collection: 'pages', id: p.id, locale: 'tr', overrideAccess: true,
      data: { layout: md('Reviewed').map((b) => ({ ...b, appearance: { hidden: true } })) } as never })
    expect(await fact('tr')).toMatchObject({ draft: true })
    await payload.delete({ collection: 'pages', id: p.id, overrideAccess: true })
  })

  it('one page per kind (localized message), other kinds and the same page remain fine', async () => {
    const a = await page('mesafeli-satis-sozlesmesi', { commerceLegal: 'distanceSales' })
    expect((a as { commerceLegal?: string }).commerceLegal).toBe('distanceSales')
    const err = await page('baska', { commerceLegal: 'distanceSales' }).then(() => null, (e: unknown) => e)
    expect(JSON.stringify((err as { data?: unknown }).data)).toMatch(/başka bir sayfa kullanıyor/)
    await page('iade-ve-cayma', { commerceLegal: 'refund' })
    // Re-saving the owner is not a clash.
    await payload.update({ collection: 'pages', id: a.id, locale: 'tr', overrideAccess: true, data: { title: 'Yeni başlık' } as never })
    // DB unique index backs the hook.
    await expect(run(`UPDATE pages SET commerce_legal = 'refund' WHERE id = ${a.id}`)).rejects.toThrow(/UNIQUE/)
    const duplicate = await payload.create({ collection: 'pages', duplicateFromID: a.id, locale: 'tr', overrideAccess: true,
      data: { title: 'Duplicate', slug: 'duplicate-legal', _status: 'draft' } as never })
    expect(duplicate.commerceLegal ?? null).toBeNull()
    const versions = await payload.findVersions({ collection: 'pages', where: { parent: { equals: a.id } }, overrideAccess: true })
    expect(versions.docs.filter((v) => v.version.commerceLegal === 'distanceSales').length).toBeGreaterThan(1)
    await payload.restoreVersion({ collection: 'pages', id: versions.docs[0]!.id, overrideAccess: true })
  })

  it('is cleared when the page is not (or stops being) a legal page', async () => {
    const p = await page('landing-x', { pageType: 'standard', commerceLegal: 'preInformation' })
    expect((p as { commerceLegal?: unknown }).commerceLegal ?? null).toBeNull()
    const q = await page('on-bilgilendirme-formu', { commerceLegal: 'preInformation' })
    const moved = await payload.update({ collection: 'pages', id: q.id, locale: 'tr', overrideAccess: true, data: { pageType: 'standard' } as never })
    expect((moved as { commerceLegal?: unknown }).commerceLegal ?? null).toBeNull()
    const cleared = await payload.update({ collection: 'pages', id: q.id, locale: 'en', overrideAccess: true, draft: true,
      data: { pageType: null, commerceLegal: 'preInformation' } as never })
    expect(cleared.commerceLegal ?? null).toBeNull()
    await expect(payload.update({ collection: 'pages', id: p.id, overrideAccess: true, draft: true,
      data: { pageType: 'legal', commerceLegal: 'bogus' } as never })).rejects.toMatchObject({ status: 400 })
  })

  it('readLegalFacts + sitemap flag: draft banner is a draft fact; commerce entries are flagged', async () => {
    const { readLegalFacts } = await import('../../src/lib/commerce/legal-facts')
    const { evaluateLegal } = await import('../../src/lib/payments/legal')
    const { getSitemapEntries } = await import('../../src/lib/content')
    const draft = await page('mesafeli-satis-ornek', { commerceLegal: 'preInformation', layout: md('TASLAK — x Metin') })
    const facts = await readLegalFacts(payload)
    expect(facts).toContainEqual({ kind: 'preInformation', locale: 'tr', published: true, draft: true })
    expect(facts).toContainEqual({ kind: 'refund', locale: 'tr', published: true, draft: false })
    expect(evaluateLegal(facts).ready).toBe(false)
    const entries = await getSitemapEntries()
    const flagged = entries.filter((e) => e.commerce)
    expect(flagged.length).toBeGreaterThan(0)
    expect(flagged.every((e) => Object.values(e.paths).every((p) => p!.startsWith('/yasal/')))).toBe(true)
    expect(draft.id).toBeTruthy()
  })
})
