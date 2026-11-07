import { chmod, lstat, mkdtemp, rename, rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { basename, join, resolve } from 'node:path'
import type { Payload } from 'payload'
import sharp from 'sharp'

import { MEDIA_IMAGE_WIDTHS as targets } from '@/lib/media-sizes'

/** Resume safely: preserve original filename, ID, translations, seedPath and access policy. */
export async function regenerateMedia(payload: Payload) {
  const upload = payload.collections.media.config.upload
  if (!upload || !upload.staticDir) throw new Error('Local media storage is required')
  const root = resolve(upload.staticDir)
  const result = { regenerated: 0, skipped: 0 }
  let page = 1
  let more = true
  while (more) {
    const batch = await payload.find({ collection: 'media', overrideAccess: true, depth: 0, limit: 50, page, sort: 'id' })
    for (const doc of batch.docs) {
      if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff', 'image/avif'].includes(doc.mimeType ?? '')) {
        result.skipped++; continue
      }
      const localFile = async (filename: string) => {
        if (basename(filename) !== filename) throw new Error(`Invalid media filename for #${doc.id}`)
        const path = resolve(root, filename)
        const info = await lstat(path)
        if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Unsafe media file for #${doc.id}`)
        return { path, size: info.size }
      }
      if (!doc.filename) throw new Error(`Missing filename for #${doc.id}`)
      const source = await localFile(doc.filename)
      let complete = Boolean(doc.width && doc.height)
      for (const [name, width] of Object.entries(targets)) {
        const size = doc.sizes?.[name as keyof typeof targets]
        if (width > (doc.width ?? 0)) {
          if (size?.filename) complete = false
          continue
        }
        if (!size?.filename || size.width !== width || size.mimeType !== 'image/webp') { complete = false; continue }
        try {
          const derivative = await localFile(size.filename)
          if (derivative.size !== size.filesize) complete = false
          else {
            const meta = await sharp(derivative.path, { animated: true }).metadata().catch(() => null)
            if (!meta || meta.format !== 'webp' || meta.width !== size.width || (meta.pageHeight ?? meta.height) !== size.height) complete = false
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
          complete = false
        }
      }
      if (complete) { result.skipped++; continue }
      // Stage outside the public upload namespace. Never rewrite the original:
      // Payload's filePath update reads it into memory and truncates it on write.
      const stage = await mkdtemp(join(root, '.regenerate-'))
      const installed: string[] = []
      let committed = false
      try {
        const metadata = await sharp(source.path, { animated: true }).metadata()
        const rotated = [5, 6, 7, 8].includes(metadata.orientation ?? 0)
        const width = rotated ? metadata.pageHeight ?? metadata.height : metadata.width
        if (!width || !doc.width || !doc.height || width !== doc.width) throw new Error(`Inconsistent dimensions for #${doc.id}`)
        const sizes: Record<string, unknown> = {}
        for (const [name, target] of Object.entries(targets)) {
          if (target > width) { sizes[name] = null; continue }
          const filename = `sm-${randomUUID()}-${name}.webp`
          const staged = join(stage, filename)
          const info = await sharp(source.path, { animated: true }).rotate().resize({ width: target }).webp({ quality: 74 }).toFile(staged)
          await chmod(staged, 0o600)
          await rename(staged, join(root, filename))
          installed.push(join(root, filename))
          sizes[name] = { filename, width: info.width, height: info.height / (metadata.pages || 1), mimeType: 'image/webp', filesize: info.size }
        }
        const updated = await payload.db.updateOne({ collection: 'media', where: { and: [{ id: { equals: doc.id } }, { updatedAt: { equals: doc.updatedAt } }] }, data: { sizes } })
        if (!updated) throw new Error(`Media #${doc.id} changed during regeneration`)
        committed = true
      } finally {
        if (!committed) await Promise.all(installed.map(file => rm(file, { force: true })))
        await rm(stage, { recursive: true, force: true })
      }
      result.regenerated++
    }
    more = batch.hasNextPage
    page++
  }
  return result
}
