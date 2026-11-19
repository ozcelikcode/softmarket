import { statSync } from 'node:fs'
import { link, mkdtemp, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

import { requestIP } from '../src/lib/forms/security'
import { openDownloadFile } from '../src/lib/licensing/api/download-file'
import { validSigningKeyRows } from '../src/lib/licensing/crypto/keys'

export async function isPhysicalUploadsDir(path: string | undefined): Promise<boolean> {
  return Boolean(path && path !== sep && resolve(path) === path
    && await realpath(path) === path && (await stat(path)).isDirectory())
}

export async function checkDescriptorConfinement(): Promise<boolean> {
  const dir = await mkdtemp(join(tmpdir(), 'softmarket-licensing-preflight-'))
  try {
    const file = join(dir, 'installer.bin')
    await writeFile(file, 'probe')
    const regular = await openDownloadFile('installer.bin', dir)
    if (!regular) return false
    await regular.handle.close()

    // Test the symlink before creating the hard link, so the target still has nlink=1.
    await symlink('installer.bin', join(dir, 'symlink.bin'))
    const symlinkResult = await openDownloadFile('symlink.bin', dir)
    await symlinkResult?.handle.close()

    await link(file, join(dir, 'hard-link.bin'))
    const hardLinkResult = await openDownloadFile('hard-link.bin', dir)
    await hardLinkResult?.handle.close()
    return !symlinkResult && !hardLinkResult
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export function hasActiveSigningMetadata(databaseUri: string | undefined): boolean {
  // Accept the application's local SQLite file URIs only. Never create a missing DB.
  if (!databaseUri?.startsWith('file:') || databaseUri.length === 5 || /[?#]/.test(databaseUri)) return false
  const path = databaseUri.startsWith('file://') ? fileURLToPath(databaseUri) : resolve(decodeURIComponent(databaseUri.slice(5)))
  if (!statSync(path, { throwIfNoEntry: false })?.isFile()) return false

  const db = new DatabaseSync(path, { readOnly: true, timeout: 2000 })
  try {
    const rows = db.prepare(`SELECT k.kid, k.public_key AS publicKey, k.retired_at AS retiredAt, k.revoked_at AS revokedAt
      FROM licensing_settings_signing_keys k JOIN licensing_settings s ON s.id = k._parent_id`).all()
    return validSigningKeyRows(rows) && rows.some((row) => row.retiredAt === null && row.revokedAt === null)
  } finally {
    db.close()
  }
}

export function hasTrustedHeaderSecret(secret: string | undefined): boolean {
  if (!secret) return false
  const address = '192.0.2.1'
  const headers = new Headers({ 'X-Softmarket-Proxy-Secret': secret, 'X-Softmarket-Client-IP': address })
  return requestIP(headers, secret) === address
}

export async function runPreflight(env: Record<string, string | undefined>, platform = process.platform) {
  const checks = [
    ['Linux VPS', () => platform === 'linux'],
    ['UPLOADS_DIR is an absolute physical directory', () => isPhysicalUploadsDir(env.UPLOADS_DIR)],
    ['L4 descriptor confinement accepts a regular file and rejects symlinks and hard links', checkDescriptorConfinement],
    ['SQLite has valid active signing-key metadata', () => hasActiveSigningMetadata(env.DATABASE_URI)],
    ['FORM_PROXY_SECRET meets the trusted-header contract', () => hasTrustedHeaderSecret(env.FORM_PROXY_SECRET)],
  ] as const

  return Promise.all(checks.map(async ([label, check]) => {
    try {
      return { label, passed: await check() }
    } catch {
      // Filesystem, SQLite and header errors can contain sensitive input values.
      return { label, passed: false }
    }
  }))
}

if (import.meta.main) {
  const results = await runPreflight(process.env)
  for (const { label, passed } of results) console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`)
  process.exitCode = results.every(({ passed }) => passed) ? 0 : 1
}
