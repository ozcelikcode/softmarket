import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import type { CollectionBeforeValidateHook, Payload, PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import { withImportTransaction } from '../../src/lib/content-import/transaction'

describe('import media rollback', () => {
  it.each([false, true])('removes only journaled files after failed import (rollback failure: %s)', async rollbackFails => {
    const dir = await mkdtemp(resolve(tmpdir(), 'softmarket-import-rollback-'))
    const req: Partial<PayloadRequest> = { context: {} }
    const previousHook = vi.fn()
    const media = { upload: { staticDir: dir }, hooks: { beforeValidate: [previousHook] as CollectionBeforeValidateHook[] } }
    const db = {
      beginTransaction: vi.fn(async () => 'transaction'), commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn(async () => { if (rollbackFails) throw new Error('rollback failed') }),
    }
    const payload = { db, collections: { media: { config: media } } } as unknown as Payload
    try {
      await writeFile(resolve(dir, 'existing.png'), 'keep')
      await expect(withImportTransaction(payload, req, async () => {
        const track = media.hooks.beforeValidate.at(-1)!
        const data = { filename: 'new.png', sizes: { thumbnail: { filename: 'new-small.png' }, old: { filename: 'existing.png' } } }
        await track({ data, context: req.context! } as unknown as Parameters<CollectionBeforeValidateHook>[0])
        // Simulate a Payload upload failing after a partial write, before returning a document.
        await writeFile(resolve(dir, 'new.png'), 'new')
        await writeFile(resolve(dir, 'new-small.png'), 'thumbnail')
        await writeFile(resolve(dir, 'unrelated.png'), 'other request')
        throw new Error('later import failed')
      })).rejects.toThrow('later import failed')
      expect(db.rollbackTransaction).toHaveBeenCalledWith('transaction')
      expect(db.commitTransaction).not.toHaveBeenCalled()
      for (const name of ['new.png', 'new-small.png']) await expect(readFile(resolve(dir, name))).rejects.toMatchObject({ code: 'ENOENT' })
      expect(await readFile(resolve(dir, 'existing.png'), 'utf8')).toBe('keep')
      expect(await readFile(resolve(dir, 'unrelated.png'), 'utf8')).toBe('other request')
      expect(media.hooks.beforeValidate).toEqual([previousHook])
    } finally { await rm(dir, { recursive: true, force: true }) }
  })
  it('keeps uploaded files after commit', async () => {
    const dir = await mkdtemp(resolve(tmpdir(), 'softmarket-import-commit-'))
    const req: Partial<PayloadRequest> = { context: {} }
    const media = { upload: { staticDir: dir }, hooks: { beforeValidate: [] as CollectionBeforeValidateHook[] } }
    const db = { beginTransaction: vi.fn(async () => 'tx'), commitTransaction: vi.fn(), rollbackTransaction: vi.fn() }
    const payload = { db, collections: { media: { config: media } } } as unknown as Payload
    try {
      expect(await withImportTransaction(payload, req, async () => {
        await media.hooks.beforeValidate[0]({ data: { filename: 'new.png' }, context: req.context! } as unknown as Parameters<CollectionBeforeValidateHook>[0])
        await writeFile(resolve(dir, 'new.png'), 'keep')
        return 1
      })).toBe(1)
      expect(await readFile(resolve(dir, 'new.png'), 'utf8')).toBe('keep')
      expect(db.commitTransaction).toHaveBeenCalledWith('tx')
      expect(db.rollbackTransaction).not.toHaveBeenCalled()
      expect(media.hooks.beforeValidate).toEqual([])
    } finally { await rm(dir, { recursive: true, force: true }) }
  })
})
