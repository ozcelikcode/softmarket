import { execFileSync } from 'node:child_process'
import { link, mkdir, mkdtemp, readFile, readdir, rm, symlink, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const script = fileURLToPath(new URL('../../scripts/prune-backups.mjs', import.meta.url))
const day = 24 * 60 * 60 * 1000

it('keeps the newest five and recent backups, and only prunes eligible files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'softmarket-backups-'))
  try {
    const dir = join(root, 'backups')
    await mkdir(dir)
    const now = Date.now()
    async function file(name: string, daysAgo: number) {
      const path = join(dir, name)
      await writeFile(path, name)
      const date = new Date(now - daysAgo * day)
      await utimes(path, date, date)
    }
    const prune = (...args: string[]) => execFileSync(
      process.execPath, [script, '--dir', dir, ...args], { encoding: 'utf8' },
    )

    const old = Array.from({ length: 6 }, (_, index) => `pre-phase-2026010${index + 1}1234.db`)
    const recent = 'post-phase-20260108-120000.db'
    for (const [index, name] of old.entries()) await file(name, 20 - index)
    await file(recent, 2)
    await file(`${old[0]}-wal`, 20)
    await file(`${old[0]}-shm`, 20)
    // Recent sidecar activity keeps the corresponding DB as well.
    await file(`${old[2]}-wal`, 1)
    await file('softmarket.db', 40)
    await writeFile(join(root, 'softmarket.db'), 'live fixture')
    const oldDate = new Date(now - 40 * day)
    await utimes(join(root, 'softmarket.db'), oldDate, oldDate)
    await symlink(join(root, 'softmarket.db'), join(dir, 'pre-symlink-202601011234.db'))
    await link(join(root, 'softmarket.db'), join(dir, 'pre-hardlink-202601011234.db'))
    await mkdir(join(dir, 'pre-directory-202601011234.db'))
    await file('pre-untimestamped.db', 40)
    await file('pre-orphan-202601011234.db-wal', 40)

    const before = await readdir(dir)
    expect(prune('--dry-run')).toContain('Would prune 2 backup set(s).')
    expect(await readdir(dir)).toEqual(before)
    expect(prune()).toContain('Pruned 2 backup set(s).')
    const removed = [old[0], `${old[0]}-wal`, `${old[0]}-shm`, old[1]]
    expect(await readdir(dir)).toEqual(before.filter((name) => !removed.includes(name)))

    expect(prune('--keep', '0')).toContain('Pruned 3 backup set(s).')
    expect(await readdir(dir)).toEqual(before.filter(
      (name) => ![...removed, ...old.slice(3)].includes(name),
    ))
    expect(await readFile(join(root, 'softmarket.db'), 'utf8')).toBe('live fixture')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
