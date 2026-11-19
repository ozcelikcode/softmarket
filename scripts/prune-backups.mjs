import { lstat, readdir, unlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    dir: { type: 'string', default: fileURLToPath(new URL('../data/backups', import.meta.url)) },
    keep: { type: 'string', default: '5' },
    'dry-run': { type: 'boolean' },
  },
})
const keep = Number(values.keep)
if (!/^\d+$/.test(values.keep) || !Number.isSafeInteger(keep)) {
  throw new Error('--keep must be a non-negative integer')
}

const dir = resolve(values.dir)
const directory = await lstat(dir).catch((error) => {
  if (error.code !== 'ENOENT') throw error
})
if (!directory) {
  console.log(`No backup directory at ${dir}`)
  process.exit(0)
}
if (!directory.isDirectory()) throw new Error('Backup path must be a directory, not a symlink')

// Migration snapshots use YYYYMMDD-HHMMSS or YYYYMMDDHHMM. Group SQLite sidecars
// with the snapshot so a retained backup keeps the files it may need for recovery.
const snapshotName = /^((?:pre|post)-[a-z0-9]+(?:-[a-z0-9]+)*-\d{8}(?:-\d{6}|\d{4})\.db)(?:-(?:wal|shm))?$/
const groups = new Map()
for (const name of await readdir(dir)) {
  const match = snapshotName.exec(name)
  if (!match) continue
  const snapshot = match[1]
  const files = groups.get(snapshot) ?? new Map()
  files.set(name, await lstat(join(dir, name)))
  groups.set(snapshot, files)
}

const backups = [...groups].filter(([name, files]) => files.get(name)?.isFile())
backups.sort(([nameA, filesA], [nameB, filesB]) =>
  filesB.get(nameB).mtimeMs - filesA.get(nameA).mtimeMs || nameB.localeCompare(nameA),
)

const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
let pruned = 0
for (const [snapshot, files] of backups.slice(keep)) {
  if ([...files.values()].some((file) => !file.isFile() || file.nlink !== 1 || file.mtimeMs > cutoff)) {
    continue
  }
  // Unlink the DB first. If that fails, its sidecars remain available for recovery.
  for (const name of [snapshot, `${snapshot}-wal`, `${snapshot}-shm`]) {
    if (!files.has(name)) continue
    if (!values['dry-run']) await unlink(join(dir, name))
    console.log(`${values['dry-run'] ? 'Would prune' : 'Pruned'} ${name}`)
  }
  pruned++
}
console.log(`${values['dry-run'] ? 'Would prune' : 'Pruned'} ${pruned} backup set(s).`)
