import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { assertIsolatedE2E } from '../../src/lib/e2e-isolation'

const dirs: string[] = []
const temp = (prefix: string) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)))
  dirs.push(dir)
  return dir
}
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })

function fixture() {
  const root = temp('softmarket-e2e-isolated.')
  chmodSync(root, 0o700)
  mkdirSync(join(root, 'uploads'))
  writeFileSync(join(root, 'db.sqlite'), 'not a live database')
  writeFileSync(join(root, '.e2e-isolated'), 'softmarket isolated e2e\n')
  return {
    root,
    env: { E2E_ISOLATED: '1', E2E_ISOLATED_DIR: root, DATABASE_URI: pathToFileURL(join(root, 'db.sqlite')).href, UPLOADS_DIR: join(root, 'uploads'), PAYLOAD_SECRET: 'x'.repeat(64) },
  }
}

describe('isolated E2E fail-closed boundaries', () => {
  it('accepts only the physical temporary DB and uploads pair', () => {
    const { env, root } = fixture()
    expect(assertIsolatedE2E(env)).toEqual({ root, database: join(root, 'db.sqlite'), uploads: join(root, 'uploads') })
  })
  it.each(['E2E_ISOLATED', 'E2E_ISOLATED_DIR', 'DATABASE_URI', 'UPLOADS_DIR', 'PAYLOAD_SECRET'])('rejects missing %s before Payload loads', (key) => {
    const { env } = fixture()
    const unsafe: Record<string, string | undefined> = { ...env }
    delete unsafe[key]
    expect(() => assertIsolatedE2E(unsafe)).toThrow('refusing')
  })
  it('rejects live paths, URI queries and substring-only isolation', () => {
    const { env } = fixture()
    for (const DATABASE_URI of ['file:./data/softmarket.db', env.DATABASE_URI + '?mode=rw', 'file:./data/softmarket-e2e-isolated.db']) {
      expect(() => assertIsolatedE2E({ ...env, DATABASE_URI })).toThrow('refusing')
    }
    expect(() => assertIsolatedE2E({ ...env, UPLOADS_DIR: resolve('uploads') })).toThrow('refusing')
  })
  it.each(['db.sqlite', 'db.sqlite-wal', 'db.sqlite-shm', 'uploads'])('rejects symlinked %s', (name) => {
    const { env, root } = fixture()
    const outside = temp('softmarket-e2e-fixture-')
    if (name !== 'uploads') writeFileSync(join(outside, name), 'sentinel')
    rmSync(join(root, name), { recursive: true, force: true })
    symlinkSync(name === 'uploads' ? outside : join(outside, name), join(root, name))
    expect(() => assertIsolatedE2E(env)).toThrow('refusing')
  })
  it('rejects hardlinked DBs, permissive directories and missing markers', () => {
    const { env, root } = fixture()
    linkSync(join(root, 'db.sqlite'), join(root, 'alias'))
    expect(() => assertIsolatedE2E(env)).toThrow('refusing')
    rmSync(join(root, 'alias'))
    chmodSync(root, 0o755)
    expect(() => assertIsolatedE2E(env)).toThrow('refusing')
    chmodSync(root, 0o700)
    rmSync(join(root, '.e2e-isolated'))
    expect(() => assertIsolatedE2E(env)).toThrow('refusing')
  })
  it('the seed CLI refuses absent isolation without reading dotenv or echoing a URI secret', () => {
    const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URI: 'file:secret-sentinel-softmarket-e2e-isolated.db' }
    delete env.E2E_ISOLATED
    delete env.E2E_ISOLATED_DIR
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/e2e-seed-admin.ts'], { env, encoding: 'utf8' })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('refusing')
    expect(result.stderr).not.toContain('secret-sentinel')
    expect(existsSync('secret-sentinel-softmarket-e2e-isolated.db')).toBe(false)
  })
  it.each(['partial', 'all'])('the runtime config rejects %s missing isolation before its live DB fallback can be used', (missing) => {
    const { env } = fixture()
    const runtimeEnv: NodeJS.ProcessEnv = { ...process.env, ...env, DATABASE_URI: '', UPLOADS_DIR: '', PORT: '3400' }
    if (missing === 'all') {
      delete runtimeEnv.E2E_ISOLATED
      delete runtimeEnv.E2E_ISOLATED_DIR
    }
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', "await import('./src/payload.config.ts')"], {
      env: runtimeEnv, encoding: 'utf8', timeout: 15000,
    })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('refusing')
  }, 20000)
})

// Exercise shell quoting/cleanup against a synthetic source, never the running site's database.
function harness() {
  const root = temp('softmarket-shell-fixture-')
  const tempRoot = join(root, "temp space'quote%?#")
  mkdirSync(tempRoot)
  const source = join(root, "source space'quote.db")
  const created = spawnSync('python3', ['-c', 'import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute("CREATE TABLE sentinel (value)"); c.commit(); c.close()', source])
  expect(created.status).toBe(0)
  mkdirSync(join(root, 'scripts'))
  mkdirSync(join(root, 'node_modules/.bin'), { recursive: true })
  symlinkSync(resolve('node_modules/tsx'), join(root, 'node_modules/tsx'))
  // Run an unchanged copy of the shell with controlled executables and synthetic data.
  const script = join(root, 'scripts/e2e-isolated-server.sh')
  writeFileSync(script, readFileSync('scripts/e2e-isolated-server.sh'))
  const stub = `#!/usr/bin/env node
const fs = require('node:fs');
const seed = process.argv[1].endsWith('e2e-seed-admin.ts');
fs.writeFileSync(process.env.PROBE, JSON.stringify({ stage: seed ? 'seed' : 'server', dir: process.env.E2E_ISOLATED_DIR, uri: process.env.DATABASE_URI, uploads: process.env.UPLOADS_DIR, pid: process.pid }));
if (seed) process.exit(Number(process.env.STUB_SEED_EXIT || 0));
setInterval(() => {}, 1000);
`
  writeFileSync(join(root, 'scripts/e2e-seed-admin.ts'), stub, { mode: 0o700 })
  writeFileSync(join(root, 'node_modules/.bin/next'), stub, { mode: 0o700 })
  const env = {
    ...process.env, TMPDIR: tempRoot, PROBE: join(root, 'probe.json'),
    E2E_SOURCE_DB: source, E2E_ADMIN_EMAIL: 'fixture@example.test', E2E_ADMIN_PASSWORD: 'x'.repeat(64), E2E_ISOLATED_PORT: '3400',
  }
  const hash = () => createHash('sha256').update(readFileSync(source)).digest('hex')
  return { root, env, hash, script }
}

describe('isolated E2E shell lifecycle', () => {
  it('handles apostrophes/spaces, preserves the source and cleans up after seed failure', () => {
    const { env, hash, script } = harness()
    const before = hash()
    const result = spawnSync('bash', ['-x', script], { env: { ...env, STUB_SEED_EXIT: '17' }, timeout: 15000, encoding: 'utf8' })
    expect(result.status, result.stderr).toBe(17)
    expect(result.stdout + result.stderr).not.toContain(env.E2E_ADMIN_PASSWORD)
    const probe = JSON.parse(readFileSync(env.PROBE, 'utf8'))
    expect(probe.uri).toBe(pathToFileURL(join(probe.dir, 'db.sqlite')).href)
    expect(probe.uploads).toBe(join(probe.dir, 'uploads'))
    expect(existsSync(probe.dir)).toBe(false)
    expect(hash()).toBe(before)
  }, 20000)
  it('rejects a missing source without creating it or leaving a temp copy', () => {
    const { env, root, script } = harness()
    const source = join(root, 'missing.db')
    const result = spawnSync('bash', [script], { env: { ...env, E2E_SOURCE_DB: source }, timeout: 15000 })
    expect(result.status).not.toBe(0)
    expect(existsSync(source)).toBe(false)
    expect(existsSync(env.PROBE)).toBe(false)
    expect(readdirSync(env.TMPDIR).filter((name) => name.startsWith('softmarket-e2e-isolated.'))).toEqual([])
  }, 20000)
  it('rejects port 3100 before launching a child', () => {
    const { env, script } = harness()
    const result = spawnSync('bash', [script], { env: { ...env, E2E_ISOLATED_PORT: '3100' } })
    expect(result.status).toBe(1)
    expect(existsSync(env.PROBE)).toBe(false)
  })
  it('SIGTERM stops the owned server group and removes the copy', async () => {
    const { env, hash, script } = harness()
    const before = hash()
    const child = spawn('bash', [script], { env, stdio: 'ignore' })
    const exited = new Promise((resolve) => child.once('exit', resolve))
    let probe: { dir: string; pid: number } | undefined
    try {
      for (let i = 0; i < 100; i++) {
        try {
          const value = JSON.parse(readFileSync(env.PROBE, 'utf8'))
          if (value.stage === 'server') { probe = value; break }
        } catch { /* The probe may not exist yet or belong to the finished seed. */ }
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      expect(probe).toBeDefined()
    } finally {
      child.kill('SIGTERM')
      await exited
    }
    expect(existsSync(probe!.dir)).toBe(false)
    expect(() => process.kill(probe!.pid, 0)).toThrow()
    expect(hash()).toBe(before)
  }, 20000)
})
