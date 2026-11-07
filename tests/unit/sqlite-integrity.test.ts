import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'
import example from '../fixtures/content-example'
import { mcpOptions } from '../../src/lib/mcp'
import { validateSeed } from '../../src/lib/content-import/schema'
import { createLocalReq } from 'payload'
import { importContent, loadLegal } from '../../src/lib/content-import/importer'
import { withImportTransaction } from '../../src/lib/content-import/transaction'
import { convertMarkdownToLexical, defaultEditorConfig, sanitizeServerEditorConfig } from '@payloadcms/richtext-lexical'

let payload: Payload
let dir: string
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'softmarket-sqlite-'))
  process.env.UPLOADS_DIR = join(dir, 'uploads')
  process.env.DATABASE_URI = `file:${dir}/test.db`
  process.env.PAYLOAD_SECRET ||= 'test-secret-long-enough-for-payload'
  const { getPayload } = await import('payload')
  const config = (await import('../../src/payload.config')).default
  payload = await getPayload({ config })
  const { migrations } = await import('../../src/migrations')
  await payload.db.migrate({ migrations: migrations.slice(0, 2) as unknown as NonNullable<Parameters<typeof payload.db.migrate>[0]>['migrations'] })
  payload.sendEmail = async () => ({}) as never
  const db = payload.db.drizzle.$client
  for (const q of [
    "INSERT INTO customers(id,name,email) VALUES(901,'Test','sqlite-test@example.com')",
    'INSERT INTO products(id) VALUES(901)',
    "INSERT INTO editions(id,sku,product_id) VALUES(901,'SQLITE-TEST',901)",
  ]) await db.execute(q)
  await db.execute("INSERT INTO licenses(id,key,customer_id,edition_id,product_id,starts_at) VALUES(901,'EXISTING-LICENSE',901,901,901,'2026-01-01')")
  await db.execute("INSERT INTO payload_locked_documents(id) VALUES(901)")
  await db.execute("INSERT INTO payload_locked_documents_rels(parent_id,path,licenses_id) VALUES(901,'document',901)")
  await payload.db.migrate({ migrations: migrations as unknown as NonNullable<Parameters<typeof payload.db.migrate>[0]>['migrations'] })
}, 30000)
afterAll(async () => { await payload?.destroy(); if (dir) rmSync(dir, { recursive: true, force: true }) })
describe('SQLite integrity', () => {
  it('assigns licenses server-side and preserves subscription duration', async () => {
    await payload.update({ collection: 'editions', id: 901, data: {
      title: 'Test', sku: 'SQLITE-TEST', licenseType: 'subscription', durationMonths: 12, seats: 3,
    }, overrideAccess: true })
    const license = await payload.create({ collection: 'licenses', data: {
      key: '', status: 'active', customer: 901, edition: 901, startsAt: '2026-01-15T00:00:00.000Z',
    }, depth: 0, overrideAccess: true })
    expect(license.key).toMatch(/^[A-Z0-9]{5}(?:-[A-Z0-9]{5}){4}$/)
    expect(license.product).toBe(901)
    expect(license.seats).toBe(3)
    expect(license.expiresAt).toBe('2027-01-15T00:00:00.000Z')
    const updated = await payload.update({ collection: 'licenses', id: license.id, data: { key: 'AAAAA-AAAAA-AAAAA-AAAAA-AAAAA' }, overrideAccess: true })
    expect(updated.key).toBe(license.key)
    const db = payload.db.drizzle.$client
    await expect(db.execute('INSERT INTO licenses(key,customer_id,edition_id,starts_at) SELECT key,customer_id,edition_id,starts_at FROM licenses LIMIT 1')).rejects.toThrow()
  })
  it('preserves existing licenses, their locks and foreign key integrity', async () => {
    const db = payload.db.drizzle.$client
    expect((await db.execute('SELECT key FROM licenses WHERE id=901')).rows[0].key).toBe('EXISTING-LICENSE')
    expect((await db.execute('SELECT licenses_id FROM payload_locked_documents_rels WHERE parent_id=901')).rows[0].licenses_id).toBe(901)
    expect((await db.execute('PRAGMA foreign_key_check')).rows).toEqual([])
  })
  it('preserves document and release uniqueness', async () => {
    const db = payload.db.drizzle.$client
    await db.execute("INSERT INTO docs(id,product_id) VALUES(901,901),(902,901)")
    await db.execute("INSERT INTO docs_locales(_parent_id,_locale,slug) VALUES(901,'tr','same')")
    await expect(db.execute("INSERT INTO docs_locales(_parent_id,_locale,slug) VALUES(902,'tr','same')")).rejects.toThrow()
    await db.execute("INSERT INTO releases(product_id,version,release_date) VALUES(901,'v1','2026-01-01')")
    await expect(db.execute("INSERT INTO releases(product_id,version,release_date) VALUES(901,'v1','2026-01-01')")).rejects.toThrow()
  })
})


describe('Phase 8a real SQLite import', () => {
  it('imports bilingual catalog and Markdown legal pages twice with stable IDs and block translations', async () => {
    validateSeed(example, 'example.json')
    const legal = await loadLegal(join(process.cwd(), 'content/legal'))
    const editorConfig = await sanitizeServerEditorConfig(defaultEditorConfig, payload.config)
    const run = () => importContent({ payload, root: join(process.cwd(), 'content/seed'),
      sources: [{ file: 'example.json', seed: { ...example, version: 1 as const } }, legal],
      markdown: markdown => convertMarkdownToLexical({ markdown, editorConfig }), log: () => {},
    })
    expect(await run()).toEqual({ creates: 8, updates: 0 })
    const first = await payload.find({ collection: 'products', locale: 'tr', depth: 0, where: { slug: { equals: 'ornek-urun' } } })
    const row = first.docs[0].layout![0].id
    const versions = async () => (await payload.db.drizzle.$client.execute('SELECT count(*) AS n FROM _products_v')).rows[0].n
    const beforeVersions = await versions()
    expect(await run()).toEqual({ creates: 0, updates: 8 })
    expect(await versions()).toBe(beforeVersions)
    const second = await payload.find({ collection: 'products', locale: 'en', fallbackLocale: false, depth: 0, where: { slug: { equals: 'example-product' } } })
    expect(second.docs).toHaveLength(1)
    expect(second.docs[0].id).toBe(first.docs[0].id)
    expect(second.docs[0].layout![0]).toMatchObject({ id: row, heading: 'Example Product' })
    const tr = await payload.findByID({ collection: 'products', id: first.docs[0].id, locale: 'tr', fallbackLocale: false, depth: 0 })
    expect(tr.layout![0]).toMatchObject({ id: row, heading: 'Örnek Ürün' })
    const pages = await payload.find({ collection: 'pages', where: { pageType: { equals: 'legal' } }, locale: 'en', fallbackLocale: false })
    expect(pages.docs).toHaveLength(5)
    expect(pages.docs.every(p => p._status === 'published')).toBe(true)
    const text = pages.docs.find(p => p.slug === 'kvkk-aydinlatma')!.layout![0]
    expect(text.blockType).toBe('richText')
    if (text.blockType === 'richText') expect(text.content.root.children.length).toBeGreaterThan(3)
    expect((await payload.db.drizzle.$client.execute('PRAGMA foreign_key_check')).rows).toEqual([])
  }, 30000)
})

describe('Phase 8a real API credentials', () => {
  it('only accepts enabled admin API keys, hides them from editors and revokes downgraded keys', async () => {
    const key = 'phase8a-test-admin-key-should-never-be-used-in-production'
    const admin = await payload.create({ collection: 'users', overrideAccess: true, data: { email: 'phase8a-admin@example.invalid', password: 'phase8a-integration-test-password', roles: ['admin'], enableAPIKey: true, apiKey: key } })
    const editor = await payload.create({ collection: 'users', overrideAccess: true, data: { email: 'phase8a-editor@example.invalid', password: 'phase8a-integration-test-password', roles: ['editor'], enableAPIKey: true, apiKey: 'editor-forbidden' } })
    expect(editor.enableAPIKey).toBe(false)
    const req = await createLocalReq({ req: { headers: new Headers({ authorization: `Bearer ${key}` }) } }, payload)
    const access = await mcpOptions.overrideAuth!(req, async () => { throw new Error('default auth must not run') })
    expect(access.user.id).toBe(admin.id)
    expect(access.licenses).toMatchObject({ delete: false })
    const read = await payload.findByID({ collection: 'users', id: admin.id, user: { ...editor, collection: 'users' }, overrideAccess: false })
    expect(read.apiKey).toBeUndefined()
    expect(read.enableAPIKey).toBeUndefined()
    await payload.update({ collection: 'users', id: admin.id, overrideAccess: true, data: { roles: ['editor'] } })
    await expect(mcpOptions.overrideAuth!(req, async () => { throw new Error('default auth must not run') })).rejects.toThrow()
  })
})

describe('Phase 8a media identity', () => {
  it('checks static file existence through the real media access filter', async () => {
    const { mediaRead } = await import('../../src/access')
    const path = join(dir, 'access-check.svg')
    writeFileSync(path, '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>')
    const publicFile = await payload.create({ collection: 'media', overrideAccess: true, filePath: path, data: { alt: 'public', protected: false, visibility: 'public' } })
    const privateFile = await payload.create({ collection: 'media', overrideAccess: true, filePath: path, data: { alt: 'private', protected: true, visibility: 'public' } })
    const req = await createLocalReq({}, payload)
    const read = (filename: string) => mediaRead({ req, data: { filename }, isReadingStaticFile: true } as never)
    await expect(read(publicFile.filename!)).resolves.toBeTruthy()
    await expect(read(privateFile.filename!)).rejects.toMatchObject({ status: 404 })
    await expect(read('missing-access-check.svg')).rejects.toMatchObject({ status: 404 })
  })

  it('cleans actual uploaded files and rolls back media records on a later import failure', async () => {
    const root = join(dir, 'rollback-seed')
    mkdirSync(join(root, 'media'), { recursive: true })
    writeFileSync(join(root, 'media/rollback.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>')
    mkdirSync(join(dir, 'uploads'), { recursive: true })
    const before = readdirSync(join(dir, 'uploads')).sort()
    const req = await createLocalReq({}, payload)
    expect(await importContent({ payload, root, dryRun: true, req,
      sources: [{ file: 'dry-media.json', seed: { version: 1, media: [{ path: 'media/rollback.svg', alt: { tr: 'Test', en: 'Test' }, protected: false }] } }],
      markdown: text => text, log: () => {},
    })).toEqual({ creates: 1, updates: 0 })
    expect(readdirSync(join(dir, 'uploads')).sort()).toEqual(before)
    await expect(withImportTransaction(payload, req, () => importContent({ payload, root, req,
      sources: [{ file: 'rollback.json', seed: { version: 1,
        media: [{ path: 'media/rollback.svg', alt: { tr: 'Test', en: 'Test' }, protected: false }],
        products: [{ tr: { title: 'Test', slug: 'rollback-product', family: 'missing-family' }, en: { title: 'Test', slug: 'rollback-product', family: 'missing-family' } }],
      } }], markdown: text => text, log: () => {},
    }))).rejects.toThrow('Unresolved relationship product-families:missing-family')
    expect(readdirSync(join(dir, 'uploads')).sort()).toEqual(before)
    expect((await payload.find({ collection: 'media', where: { seedPath: { equals: 'media/rollback.svg' } }, overrideAccess: true })).docs).toHaveLength(0)
  })
  it('upserts by source path even when Payload renames a colliding filename', async () => {
    const root = join(dir, 'seed')
    mkdirSync(join(root, 'media'), { recursive: true })
    const path = join(root, 'media/collision.svg')
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="red"/></svg>'
    writeFileSync(path, svg)
    const manual = await payload.create({ collection: 'media', overrideAccess: true, filePath: path, data: { alt: 'manual', protected: false, visibility: 'public' } })
    const run = () => importContent({ payload, root, sources: [{ file: 'media.json', seed: { version: 1, media: [{ path: 'media/collision.svg', alt: { tr: 'Görsel', en: 'Image' }, protected: false }] } }], markdown: text => text, log: () => {} })
    expect(await run()).toEqual({ creates: 1, updates: 0 })
    const first = await payload.find({ collection: 'media', where: { seedPath: { equals: 'media/collision.svg' } }, depth: 0 })
    expect(first.docs).toHaveLength(1)
    expect(first.docs[0].filename).not.toBe(manual.filename)
    writeFileSync(path, svg.replace('red', 'blue'))
    await expect(run()).rejects.toThrow('Existing media differs')
    const second = await payload.find({ collection: 'media', where: { seedPath: { equals: 'media/collision.svg' } }, locale: 'en', fallbackLocale: false, depth: 0 })
    expect(second.docs).toHaveLength(1)
    expect(second.docs[0]).toMatchObject({ id: first.docs[0].id, alt: 'Image', protected: false })
    expect(readFileSync(join(dir, 'uploads', manual.filename!), 'utf8')).toContain('red')
    expect(readFileSync(join(dir, 'uploads', second.docs[0].filename!), 'utf8')).toContain('red')
  })
})

describe('Docs slug uniqueness through the real import path', () => {
  const doc = (tr: string, en: string) => ({
    tr: { product: 'docs-regression', slug: tr, title: `TR ${tr}` },
    en: { product: 'docs-regression', slug: en, title: `EN ${en}` },
  })
  const seed = (docs: ReturnType<typeof doc>[]) => ({ version: 1 as const,
    'product-families': [{ tr: { title: 'Docs', slug: 'docs-family' }, en: { title: 'Docs', slug: 'docs-family' } }],
    products: [{ tr: { title: 'Docs', slug: 'docs-regression', family: 'docs-family' }, en: { title: 'Docs', slug: 'docs-regression', family: 'docs-family' } }], docs })
  const run = async (docs: ReturnType<typeof doc>[], options: { rollback?: boolean } = {}) => {
    const req = await createLocalReq({}, payload)
    return withImportTransaction(payload, req, () => importContent({ payload, root: join(dir, 'seed'), req, rollbackRun: options.rollback,
      sources: [{ file: 'docs.json', seed: seed(docs) }], markdown: text => text, log: () => {},
    }), options)
  }
  const rows = async () => (await payload.db.drizzle.$client.execute(
    "SELECT l._locale AS locale, l.slug AS slug FROM docs_locales l JOIN docs d ON d.id=l._parent_id JOIN products_locales p ON p._parent_id=d.product_id AND p._locale='tr' WHERE p.slug='docs-regression' ORDER BY d.id, l._locale")).rows
  const docs = [doc('baslangic', 'getting-started'), doc('kurulum', 'installation'), doc('yapilandirma', 'configuration')]

  it('rejects a duplicate slug within one product and locale and rolls back', async () => {
    await expect(run([doc('a', 'same'), doc('b', 'same')])).rejects.toThrow(/docs:docs-regression\/b.*Slug/)
    expect(await rows()).toEqual([])
  })
  it('dry run performs real validation, then leaves nothing behind', async () => {
    await expect(run([doc('a', 'same'), doc('b', 'same')], { rollback: true })).rejects.toThrow(/Slug/)
    expect(await run(docs, { rollback: true })).toEqual({ creates: 5, updates: 0 })
    expect(await rows()).toEqual([])
  })
  it('imports several docs under one product in both locales, idempotently', async () => {
    expect(await run(docs)).toEqual({ creates: 5, updates: 0 })
    expect(await rows()).toHaveLength(6)
    expect((await rows()).filter(r => r.locale === 'en').map(r => r.slug)).toEqual(['getting-started', 'installation', 'configuration'])
    expect(await run(docs)).toEqual({ creates: 0, updates: 5 })
  })
})
