import { generateKeyPairSync } from 'node:crypto'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  checkDescriptorConfinement, hasActiveSigningMetadata, hasTrustedHeaderSecret, isPhysicalUploadsDir, runPreflight,
} from '../../scripts/licensing-preflight'
import { ed25519PublicMetadata } from '../../src/lib/licensing/crypto/keys'

describe('licensing VPS preflight', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(await realpath(tmpdir()), 'licensing-preflight-test-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('requires a physical directory and rejects symlinks at any level', async () => {
    const physical = join(dir, 'shared')
    const uploads = join(physical, 'uploads')
    const alias = join(dir, 'alias')
    const file = join(dir, 'file')
    await mkdir(uploads, { recursive: true })
    await symlink(physical, alias)
    await symlink(uploads, join(dir, 'uploads'))
    await writeFile(file, '')

    await expect(isPhysicalUploadsDir(uploads)).resolves.toBe(true)
    for (const path of [undefined, '.', '/', file, join(alias, 'uploads'), join(dir, 'uploads')]) {
      await expect(isPhysicalUploadsDir(path)).resolves.toBe(false)
    }
  })

  it('uses the real L4 helper to open a file and reject both kinds of links', async () => {
    await expect(checkDescriptorConfinement()).resolves.toBe(true)
  })

  it('only accepts a configured proxy secret that works through the L3 header reader', () => {
    const valid = 'x'.repeat(32)
    expect(hasTrustedHeaderSecret(valid)).toBe(true)
    for (const secret of [undefined, '', 'short', `CHANGE_${valid}`, ` ${valid}`]) {
      expect(hasTrustedHeaderSecret(secret)).toBe(false)
    }
  })

  it('reads committed WAL metadata and rejects empty, retired, revoked or invalid metadata', () => {
    const dbPath = join(dir, 'fixture copy.db')
    const uri = `file:${encodeURI(dbPath)}`
    const db = new DatabaseSync(dbPath)
    const { kid, publicKey } = ed25519PublicMetadata(generateKeyPairSync('ed25519').privateKey)
    try {
      db.exec(`PRAGMA journal_mode = WAL;
        CREATE TABLE licensing_settings (id INTEGER PRIMARY KEY);
        INSERT INTO licensing_settings VALUES (1);
        CREATE TABLE licensing_settings_signing_keys (_parent_id INTEGER, kid TEXT, public_key TEXT, retired_at TEXT, revoked_at TEXT);`)
      expect(hasActiveSigningMetadata(uri)).toBe(false)
      const insert = db.prepare('INSERT INTO licensing_settings_signing_keys VALUES (1, ?, ?, NULL, NULL)')
      insert.run(kid, publicKey)
      expect(hasActiveSigningMetadata(uri)).toBe(true)
      db.exec("UPDATE licensing_settings_signing_keys SET retired_at = '2026-01-01T00:00:00.000Z'")
      expect(hasActiveSigningMetadata(uri)).toBe(false)
      db.exec("UPDATE licensing_settings_signing_keys SET retired_at = NULL, revoked_at = '2026-01-01T00:00:00.000Z'")
      expect(hasActiveSigningMetadata(uri)).toBe(false)
      insert.run('invalid-kid', publicKey)
      expect(hasActiveSigningMetadata(uri)).toBe(false)
    } finally {
      db.close()
    }
  })

  it('does not create a missing database or expose input values on failures', async () => {
    const missing = join(dir, 'missing.db')
    expect(hasActiveSigningMetadata(`file:${missing}`)).toBe(false)
    expect(hasActiveSigningMetadata('https://db.example.test')).toBe(false)
    await expect(realpath(missing)).rejects.toMatchObject({ code: 'ENOENT' })

    const input = 'sensitive-input\n'
    const broken = join(dir, input)
    await writeFile(broken, input)
    const results = await runPreflight({ DATABASE_URI: `file:${broken}`, FORM_PROXY_SECRET: input }, 'darwin')
    expect(results.map(({ passed }) => passed)).toEqual([false, false, true, false, false])
    expect(JSON.stringify(results)).not.toContain('sensitive-input')
  })
})
