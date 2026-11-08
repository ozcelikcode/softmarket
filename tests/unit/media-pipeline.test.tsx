import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { renderToStaticMarkup } from 'react-dom/server'
import { createLocalReq, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { MediaImage } from '@/components/ui/media-image'
import { regenerateMedia } from '@/lib/media-regenerate'
import type { Media } from '@/payload-types'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
let payload: Payload
let dir: string
let publicImage: Media
let protectedImage: Media
let licensedImage: Media
let customer: PayloadRequest['user']
let staff: PayloadRequest['user']
let getFile: (req: PayloadRequest) => Promise<Response>
const NAME = '20261107_192347_media_image_sizes'

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'softmarket-f9-'))
  process.env.UPLOADS_DIR = join(dir, 'uploads')
  process.env.DATABASE_URI = `file:${dir}/test.db`
  process.env.PAYLOAD_SECRET ||= 'test-secret-long-enough-for-payload'
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: (await import('../../src/payload.config')).default })
  const { migrations } = await import('../../src/migrations')
  await payload.db.migrate({ migrations: migrations as unknown as NonNullable<Parameters<typeof payload.db.migrate>[0]>['migrations'] })
  // Deliberately textured source: q78 exceeds the mobile budget, q74 stays below it.
  const pixels = Buffer.alloc(2400 * 1600 * 3)
  let state = 42
  for (let y = 0; y < 1600; y++) for (let x = 0; x < 2400; x++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    const noise = (state >>> 24) % 60 - 30
    const i = (y * 2400 + x) * 3
    pixels[i] = 40 + x / 24 + noise
    pixels[i + 1] = 70 + y / 1600 * 90 + noise
    pixels[i + 2] = 150 + noise
  }
  const buffer = await sharp(pixels, { raw: { width: 2400, height: 1600, channels: 3 } }).png().toBuffer()
  const file = { data: buffer, mimetype: 'image/png', name: 'public.png', size: buffer.length }
  publicImage = await payload.create({ collection: 'media', file, data: { alt: 'Ekran', protected: false, visibility: 'public', seedPath: 'media/public.png' } })
  await payload.update({ collection: 'media', id: publicImage.id, locale: 'en', data: { alt: 'Screen' } })
  protectedImage = await payload.create({ collection: 'media', file: { ...file, name: 'protected.png' }, data: { alt: 'Protected', protected: true, visibility: 'public' } })
  licensedImage = await payload.create({ collection: 'media', file: { ...file, name: 'licensed.png' }, data: { alt: 'Licensed', protected: true, visibility: 'licensed' } })
  const c = await payload.create({ collection: 'customers', disableVerificationEmail: true, data: { email: 'f9@example.test', password: 'Media-test-123!', name: 'Test' } })
  const s = await payload.create({ collection: 'users', data: { email: 'staff@f9.test', password: 'Media-test-123!', roles: ['admin'] } })
  customer = { ...c, collection: 'customers' }
  staff = { ...s, collection: 'users' }
  // Exercise the actual installed Payload file handler, including its second access check and byte stream.
  const handlerPath = resolve('node_modules/payload/dist/uploads/endpoints/getFile.js')
  getFile = (await import(handlerPath)).getFileHandler
}, 120000)
afterAll(async () => { await payload?.destroy(); if (dir) rmSync(dir, { recursive: true, force: true }) })

async function request(filename: string, user: PayloadRequest['user'] = null) {
  const req = await createLocalReq({ user: user ?? undefined }, payload)
  req.routeParams = { collection: 'media', filename }
  Object.defineProperty(req, 'searchParams', { value: new URLSearchParams() })
  req.headers = new Headers()
  return getFile(req)
}

describe('image pipeline', () => {
  it('generates bounded WebP sizes and lazy srcset with dimensions, eager high-priority hero and focal position', () => {
    expect(Object.values(publicImage.sizes!).map(s => s!.width)).toEqual([400, 768, 1280, 1920])
    for (const s of Object.values(publicImage.sizes!)) expect(s!.mimeType).toBe('image/webp')
    expect(publicImage.sizes!.hero!.filesize).toBeLessThanOrEqual(180 * 1024)
    const html = renderToStaticMarkup(<MediaImage media={publicImage} sizes="50vw" />)
    expect(html).toContain(`${publicImage.sizes!.thumb!.filename} 400w`)
    expect(html).toContain(`${publicImage.sizes!.wide!.filename} 1920w`)
    expect(html).toContain('sizes="50vw"')
    expect(html).toContain('width="2400" height="1600"')
    expect(html).toContain('loading="lazy"')
    expect(html).not.toContain('/_next/image')
    const hero = renderToStaticMarkup(<MediaImage media={{ ...publicImage, focalX: 0, focalY: 70 }} priority />)
    expect(hero).toContain('fetchPriority="high"')
    expect(hero).toContain('loading="eager"')
    expect(hero).toContain('object-position:0% 70%')
    expect(hero).toContain('imageSrcSet=')
    expect(hero).not.toContain('href="/api/media/file/public.png"')
    expect(renderToStaticMarkup(<MediaImage media={{ id: publicImage.id, sizes: publicImage.sizes }} />)).toBe('')
    expect(renderToStaticMarkup(<MediaImage media={publicImage.id} />)).toBe('')
  })

  it('all original and size URLs enforce identical anon/customer/staff access, including staff draft relations', async () => {
    for (const image of [publicImage, protectedImage, licensedImage]) {
      const names = [image.filename!, ...Object.values(image.sizes!).map(s => s!.filename!)]
      for (const name of names) {
        for (const user of [null, customer, staff]) {
          if (image.id !== publicImage.id && user !== staff) {
            await expect(request(name, user)).rejects.toHaveProperty('status', 404)
          } else {
            const response = await request(name, user)
            expect(response.status).toBe(200)
            expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0)
          }
        }
      }
    }
    for (const user of [null, customer, staff]) await expect(request('missing-thumb.webp', user)).rejects.toHaveProperty('status', 404)
    const read = (user: PayloadRequest['user']) => payload.find({ collection: 'media', where: { id: { equals: protectedImage.id } }, user, overrideAccess: false })
    expect((await read(null)).docs).toEqual([])
    expect((await read(customer)).docs).toEqual([])
    const draftMedia = (await read(staff)).docs[0]
    expect(renderToStaticMarkup(<MediaImage media={draftMedia} />)).toContain(`${protectedImage.sizes!.thumb!.filename} 400w`)
  })

  it('fails closed when legacy records share a derivative filename', async () => {
    const db = payload.db.drizzle.$client
    const name = publicImage.sizes!.thumb!.filename!
    await db.execute({ sql: 'UPDATE media SET sizes_thumb_filename = ? WHERE id = ?', args: [name, protectedImage.id] })
    try {
      await expect(request(name)).rejects.toHaveProperty('status', 404)
    } finally {
      await db.execute({ sql: 'UPDATE media SET sizes_thumb_filename = ? WHERE id = ?', args: [protectedImage.sizes!.thumb!.filename!, protectedImage.id] })
    }
  })

  it('rejects active SVG uploads with the Payload 3.90 security defaults', async () => {
    const data = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><script>alert(1)</script></svg>')
    await expect(payload.create({ collection: 'media', data: { alt: 'SVG', protected: false, visibility: 'public' }, file: { data, mimetype: 'image/svg+xml', name: 'active.svg', size: data.length } })).rejects.toMatchObject({ status: 400 })
  })

  it('serves safe SVG under a restrictive sandbox policy', async () => {
    const data = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20"/></svg>')
    const svg = await payload.create({ collection: 'media', data: { alt: 'SVG', protected: false, visibility: 'public' }, file: { data, mimetype: 'image/svg+xml', name: 'test.svg', size: data.length } })
    const response = await request(svg.filename!)
    expect(response.headers.get('content-security-policy')).toContain('sandbox')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    await response.arrayBuffer()
  })

  it('valid licenses permit derivatives; revoked licenses immediately close them again', async () => {
    const db = payload.db.drizzle.$client
    await db.execute("INSERT INTO products(id) VALUES(901)")
    await db.execute("INSERT INTO editions(id,sku,product_id) VALUES(901,'MEDIA-TEST',901)")
    await payload.update({ collection: 'media', id: licensedImage.id, data: { licensedProducts: [901] } })
    const license = await payload.create({ collection: 'licenses', data: { key: '', customer: customer!.id, edition: 901, startsAt: '2020-01-01', status: 'active' } })
    for (const size of Object.values(licensedImage.sizes!)) {
      const response = await request(size!.filename!, customer)
      expect(response.status).toBe(200)
      await response.arrayBuffer()
    }
    await payload.update({ collection: 'licenses', id: license.id, data: { status: 'revoked' } })
    await expect(request(licensedImage.sizes!.card!.filename!, customer)).rejects.toHaveProperty('status', 404)
  })

  it('omits oversized targets, preserves originals/locales/identity and resumes idempotently', async () => {
    const tiny = await sharp({ create: { width: 500, height: 300, channels: 3, background: 'white' } }).png().toBuffer()
    const small = await payload.create({ collection: 'media', data: { alt: 'Small', protected: false, visibility: 'public' }, file: { data: tiny, mimetype: 'image/png', name: 'small.png', size: tiny.length } })
    expect(small.sizes!.thumb!.width).toBe(400)
    expect(small.sizes!.card!.filename).toBeNull()
    expect(small.sizes!.thumb!.filename).toMatch(/^sm-.*-thumb\.webp$/)
    // Simulate a pre-F9 row with no size metadata. Existing original bytes must remain identical.
    await payload.db.drizzle.$client.execute(`UPDATE media SET sizes_thumb_filename = NULL WHERE id = ${publicImage.id}`)
    const before = readFileSync(join(dir, 'uploads', publicImage.filename!))
    expect((await regenerateMedia(payload)).regenerated).toBe(1)
    const first = await payload.findByID({ collection: 'media', id: publicImage.id, locale: 'all', depth: 0 })
    const files = readdirSync(join(dir, 'uploads')).sort()
    const hashes = () => files.map(name => createHash('sha256').update(readFileSync(join(dir, 'uploads', name))).digest('hex'))
    const stats = hashes()
    expect(await regenerateMedia(payload)).toEqual({ regenerated: 0, skipped: 5 })
    expect(await payload.findByID({ collection: 'media', id: publicImage.id, locale: 'all', depth: 0 })).toEqual(first)
    expect(first).toMatchObject({ id: publicImage.id, filename: publicImage.filename, seedPath: 'media/public.png', protected: false, alt: { tr: 'Ekran', en: 'Screen' } })
    expect(readFileSync(join(dir, 'uploads', publicImage.filename!))).toEqual(before)
    expect(readdirSync(join(dir, 'uploads')).sort()).toEqual(files)
    expect(hashes()).toEqual(stats)
  }, 30000)

  it('admin crop/focal edits regenerate bounded sizes and preserve focal coordinates at the edge', async () => {
    const req = await createLocalReq({}, payload)
    req.query = { uploadEdits: { crop: { x: 0, y: 0, width: 50, height: 50, unit: '%' }, widthInPixels: 1200, heightInPixels: 800, focalPoint: { x: 0, y: 100 } } }
    const cropped = await payload.update({ collection: 'media', id: publicImage.id, data: { filename: publicImage.filename, url: publicImage.url }, req })
    expect(cropped).toMatchObject({ width: 1200, height: 800, focalX: 0, focalY: 100 })
    expect(cropped.sizes!.card!.width).toBe(768)
    expect(cropped.sizes!.hero!.filename).toBeNull()
    expect(await regenerateMedia(payload)).toEqual({ regenerated: 0, skipped: 5 })
  }, 30000)

  it('migration up is additive; down/up preserves media rows, translations and relations without table rebuild', async () => {
    const { migrations } = await import('../../src/migrations')
    const migration = migrations.find(m => m.name === NAME)!
    const source = readFileSync(resolve(`src/migrations/${NAME}.ts`), 'utf8')
    const [up, down] = source.split('export async function down')
    expect(up).not.toMatch(/DROP |DELETE|__new_|RENAME|PRAGMA/)
    expect(up.match(/ADD /g)).toHaveLength(24)
    expect(down).not.toMatch(/DROP TABLE|__new_|INSERT INTO|PRAGMA/)
    const run = (q: string) => payload.db.drizzle.$client.execute(q)
    const fields = 'id,filename,protected,visibility,seed_path,focal_x,focal_y'
    const before = (await run(`SELECT ${fields} FROM media ORDER BY id`)).rows
    const locales = (await run('SELECT * FROM media_locales ORDER BY id')).rows
    const rels = (await run('SELECT * FROM media_rels ORDER BY id')).rows
    await payload.db.drizzle.transaction(db => migration.down({ db, payload, req: {} } as never))
    expect((await run(`SELECT ${fields} FROM media ORDER BY id`)).rows).toEqual(before)
    expect((await run('SELECT * FROM media_locales ORDER BY id')).rows).toEqual(locales)
    expect((await run('SELECT * FROM media_rels ORDER BY id')).rows).toEqual(rels)
    await payload.db.drizzle.transaction(db => migration.up({ db, payload, req: {} } as never))
    expect((await run('PRAGMA foreign_key_check')).rows).toEqual([])
  })
})
