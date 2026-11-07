import { lstatSync, readFileSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Validate physical paths before Payload can initialize an isolated test database. Never load dotenv here. */
export function assertIsolatedE2E(env: Readonly<Record<string, string | undefined>> = process.env) {
  const refuse = () => { throw new Error('Isolated E2E environment is missing or unsafe; refusing to initialize Payload.') }
  const root = env.E2E_ISOLATED_DIR
  if (env.E2E_ISOLATED !== '1' || !root) return refuse()
  try {
    if (realpathSync(root) !== root || dirname(root) !== realpathSync(tmpdir()) ||
      !/^softmarket-e2e-isolated\.[a-zA-Z0-9]+$/.test(basename(root))) return refuse()
    const dir = lstatSync(root)
    if (!dir.isDirectory() || (dir.mode & 0o077) !== 0 || dir.uid !== process.getuid?.()) return refuse()
    if (readFileSync(join(root, '.e2e-isolated'), 'utf8') !== 'softmarket isolated e2e\n') return refuse()
    if (env.DATABASE_URI !== pathToFileURL(join(root, 'db.sqlite')).href || env.UPLOADS_DIR !== join(root, 'uploads')) return refuse()
    for (const name of ['db.sqlite', 'db.sqlite-wal', 'db.sqlite-shm']) {
      const file = join(root, name)
      let stat
      try { stat = lstatSync(file) } catch (error) {
        if (name !== 'db.sqlite' && (error as NodeJS.ErrnoException).code === 'ENOENT') continue
        throw error
      }
      if (!stat.isFile() || stat.nlink !== 1 || realpathSync(file) !== file) return refuse()
    }
    if (!lstatSync(env.UPLOADS_DIR).isDirectory() || realpathSync(env.UPLOADS_DIR) !== env.UPLOADS_DIR) return refuse()
    if (!env.PAYLOAD_SECRET || env.PAYLOAD_SECRET.length < 32) return refuse()
    return { root, database: join(root, 'db.sqlite'), uploads: env.UPLOADS_DIR }
  } catch {
    return refuse()
  }
}
