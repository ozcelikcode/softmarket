import { randomUUID } from 'node:crypto'
import { lstat, unlink } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import type { CollectionBeforeValidateHook, Payload, PayloadRequest } from 'payload'

/** Journal Payload's generated filenames before it writes them, including writes
 * from an operation that subsequently fails. Never delete pre-existing files. */
export async function withImportTransaction<T>(payload: Payload, req: Partial<PayloadRequest>, work: () => Promise<T>, options: { rollback?: boolean } = {}): Promise<T> {
  const transactionID = await payload.db.beginTransaction()
  if (!transactionID) throw new Error('Import requires database transactions')
  req.transactionID = transactionID
  const token = randomUUID()
  req.context = { ...req.context, contentImportRun: token }
  const media = payload.collections.media.config
  const upload = media.upload
  const created = new Set<string>()
  const track: CollectionBeforeValidateHook = async ({ data, context }) => {
    if (context.contentImportRun !== token || !upload || !upload.staticDir || !data) return data
    const sizes = Object.values(data.sizes ?? {}) as { filename?: string }[]
    for (const filename of [data.filename, ...sizes.map(size => size?.filename)]) {
      if (typeof filename !== 'string') continue
      if (basename(filename) !== filename) throw new Error(`Invalid media filename: ${filename}`)
      const path = resolve(upload.staticDir, filename)
      try { await lstat(path) } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        created.add(path)
      }
    }
    return data
  }
  const hooks = media.hooks.beforeValidate ?? []
  media.hooks.beforeValidate = [...hooks, track]
  let rollbackAttempted = false
  try {
    const result = await work()
    if (options.rollback) {
      // Dry run: real writes (hooks and validation included), then roll back and drop new files.
      const failures: unknown[] = []
      rollbackAttempted = true
      try { await payload.db.rollbackTransaction(transactionID) } catch (rollbackError) { failures.push(rollbackError) }
      for (const path of created) {
        try { await unlink(path) } catch (cleanupError) {
          if ((cleanupError as NodeJS.ErrnoException).code !== 'ENOENT') failures.push(cleanupError)
        }
      }
      if (failures.length > 0) throw new AggregateError(failures, failures.map(String).join('; '))
      return result
    }
    await payload.db.commitTransaction(transactionID)
    return result
  } catch (error) {
    // File cleanup must also run if the database rollback itself fails.
    const failures: unknown[] = [error]
    if (!rollbackAttempted) {
      try { await payload.db.rollbackTransaction(transactionID) } catch (rollbackError) { failures.push(rollbackError) }
    }
    for (const path of created) {
      try { await unlink(path) } catch (cleanupError) {
        if ((cleanupError as NodeJS.ErrnoException).code !== 'ENOENT') failures.push(cleanupError)
      }
    }
    if (failures.length > 1) throw new AggregateError(failures, failures.map(String).join('; '))
    throw error
  } finally {
    media.hooks.beforeValidate = hooks
    delete req.transactionID
    delete req.context.contentImportRun
  }
}
