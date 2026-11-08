import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createLocalReq, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { sanitizeMediaUpload } from '@/lib/media-upload'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
let payload: Payload
let dir: string

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'softmarket-media-privacy-'))
  process.env.UPLOADS_DIR = join(dir, 'uploads')
  process.env.DATABASE_URI = `file:${dir}/test.db`
  process.env.PAYLOAD_SECRET ||= 'test-secret-long-enough-for-payload'
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: (await import('../../src/payload.config')).default })
  const databases = await payload.db.drizzle.$client.execute('PRAGMA database_list')
  expect(realpathSync(String(databases.rows[0].file))).toBe(realpathSync(resolve(dir, 'test.db')))
  expect(payload.collections.media.config.upload.staticDir).toBe(join(dir, 'uploads'))
  const { migrations } = await import('../../src/migrations')
  await payload.db.migrate({ migrations: migrations as unknown as NonNullable<Parameters<typeof payload.db.migrate>[0]>['migrations'] })
}, 120000)

afterAll(async () => {
  await payload?.destroy()
  if (dir) rmSync(dir, { recursive: true, force: true })
})

const file = (data: Buffer, name: string, mimetype: string) => ({ data, name, mimetype, size: data.length })
const upload = (data: Buffer, name: string, mimetype: string) => payload.create({
  collection: 'media', data: { alt: 'Privacy fixture', protected: false, visibility: 'public' }, file: file(data, name, mimetype),
})

async function gpsJPEG() {
  const pixels = Buffer.alloc(80 * 40 * 3)
  for (let y = 0; y < 40; y++) for (let x = 0; x < 80; x++) {
    pixels[(y * 80 + x) * 3 + (x < 40 ? 0 : 2)] = 255
  }
  return sharp(pixels, { raw: { width: 80, height: 40, channels: 3 } })
    .jpeg().withMetadata({ orientation: 6, exif: { IFD3: {
      GPSLatitudeRef: 'N', GPSLatitude: '41/1 0/1 0/1',
      GPSLongitudeRef: 'E', GPSLongitude: '29/1 0/1 0/1',
    } } }).withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/">private-location</x:xmpmeta>').toBuffer()
}

it('strips GPS EXIF and XMP from the saved original, applies orientation and records correct dimensions', async () => {
  const data = await gpsJPEG()
  const source = await sharp(data).metadata()
  expect(source).toMatchObject({ orientation: 6, width: 80, height: 40 })
  expect(source.exif).toBeDefined()
  // The EXIF GPS IFD pointer (0x8825) proves the fixture actually contains GPS.
  expect(source.exif!.includes(Buffer.from([0x25, 0x88]))).toBe(true)
  expect(source.xmp).toBeDefined()
  const doc = await upload(data, 'gps.jpg', 'image/jpeg')
  const saved = readFileSync(join(dir, 'uploads', doc.filename!))
  const metadata = await sharp(saved).metadata()
  expect(doc).toMatchObject({ filename: 'gps.jpg', mimeType: 'image/jpeg', width: 40, height: 80, filesize: saved.length })
  expect(metadata).toMatchObject({ format: 'jpeg', width: 40, height: 80 })
  for (const key of ['exif', 'xmp', 'iptc', 'orientation'] as const) expect(metadata[key]).toBeUndefined()
  const { data: pixels, info } = await sharp(saved).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const top = (10 * info.width + 20) * info.channels
  const bottom = (70 * info.width + 20) * info.channels
  expect(pixels[top]).toBeGreaterThan(240)
  expect(pixels[top + 2]).toBeLessThan(15)
  expect(pixels[bottom + 2]).toBeGreaterThan(240)
  expect(pixels[bottom]).toBeLessThan(15)
})

it.each(['png', 'webp', 'tiff'] as const)('preserves %s format and removes private metadata', async (format) => {
  const data = await sharp({ create: { width: 32, height: 24, channels: 4, background: '#12345680' } })
    .toFormat(format).withMetadata({ exif: { IFD0: { Artist: 'private-author' } } })
    .withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/">private-location</x:xmpmeta>').toBuffer()
  expect((await sharp(data).metadata()).xmp).toBeDefined()
  const doc = await upload(data, `private.${format}`, `image/${format}`)
  const saved = readFileSync(join(dir, 'uploads', doc.filename!))
  const metadata = await sharp(saved).metadata()
  // Payload 3.90+ derives the canonical extension from the detected bytes (TIFF -> tif).
  expect(doc.filename).toBe(`private.${format === 'tiff' ? 'tif' : format}`)
  expect(metadata.format).toBe(format)
  expect(metadata.exif).toBeUndefined()
  expect(metadata.xmp).toBeUndefined()
  expect(metadata.iptc).toBeUndefined()
})

it('sanitizes replacement uploads from a temporary file without altering the source file', async () => {
  const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'white' } }).png().toBuffer()
  const doc = await upload(png, 'replace.png', 'image/png')
  const data = await gpsJPEG()
  const tempFilePath = join(dir, 'incoming.jpg')
  writeFileSync(tempFilePath, data)
  const updated = await payload.update({ collection: 'media', id: doc.id, data: {},
    file: { ...file(Buffer.alloc(0), 'replacement.jpeg', 'image/jpeg'), tempFilePath },
  })
  const metadata = await sharp(readFileSync(join(dir, 'uploads', updated.filename!))).metadata()
  expect(metadata).toMatchObject({ format: 'jpeg', width: 40, height: 80 })
  expect(metadata.exif).toBeUndefined()
  expect(readFileSync(tempFilePath)).toEqual(data)
})

it('rejects uncleanable raster uploads with 400 before any record or file is saved', async () => {
  const before = readdirSync(join(dir, 'uploads')).sort()
  const count = await payload.count({ collection: 'media' })
  await expect(upload(Buffer.from('broken jpeg'), 'broken.jpg', 'image/jpeg')).rejects.toHaveProperty('status', 400)
  expect(await payload.count({ collection: 'media' })).toEqual(count)
  expect(readdirSync(join(dir, 'uploads')).sort()).toEqual(before)
})

it.each([
  ['vector.svg', 'image/svg+xml'], ['animation.gif', 'image/gif'],
  ['movie.mp4', 'video/mp4'], ['document.pdf', 'application/pdf'],
])('leaves %s buffers untouched', async (name, mimetype) => {
  const req = await createLocalReq({}, payload)
  const original = file(Buffer.from('untouched bytes'), name, mimetype)
  req.file = original
  await sanitizeMediaUpload({ operation: 'create', req } as Parameters<typeof sanitizeMediaUpload>[0])
  expect(req.file).toBe(original)
})
