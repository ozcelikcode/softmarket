import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })
function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'softmarket-lh-test-'))
  dirs.push(dir)
  const report = (lcp: number) => ({
    categories: Object.fromEntries(['performance', 'accessibility', 'best-practices', 'seo'].map((k) => [k, { score: 1 }])),
    audits: Object.fromEntries(['largest-contentful-paint', 'cumulative-layout-shift', 'total-blocking-time', 'first-contentful-paint'].map((k) => [k, { numericValue: lcp }])),
  })
  for (const [run, lcp] of [[1, 100], [2, 300]]) writeFileSync(join(dir, `mobile_tr.r${run}.json`), JSON.stringify(report(lcp)))
  const run = (env: Record<string, string | undefined> = {}) => spawnSync(process.execPath, ['scripts/perf-lighthouse.mjs', dir], {
    env: { ...process.env, LH_RUNS: '2', LH_BASE: 'http://127.0.0.1:3400', LH_URLS: '/tr', LH_PRESETS: 'mobile', LH_REPARSE: '1', ...env }, encoding: 'utf8', timeout: 5000,
  })
  return { dir, run, summary: () => JSON.parse(readFileSync(join(dir, 'summary.json'), 'utf8')) }
}

describe('Lighthouse measurement integrity', () => {
  it('averages the two middle values for an even run count', () => {
    const { run, summary } = setup()
    expect(run().status).toBe(0)
    expect(summary()[0]).toMatchObject({ runs: 2, lcp: 200, lcpRuns: [100, 300] })
  })
  it.each(['0', '-1', 'NaN', 'Infinity', '1.5', '101', ''])('rejects invalid run count %s', (LH_RUNS) => {
    const { run } = setup()
    const result = run({ LH_RUNS })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('LH_RUNS must be')
  })
  it('reports a partial failure and exits unsuccessfully rather than silently dropping it', () => {
    const { dir, run, summary } = setup()
    writeFileSync(join(dir, 'mobile_tr.r2.json'), '{invalid')
    expect(run().status).toBe(1)
    expect(summary()[0]).toMatchObject({ runs: 1, lcp: 100, errors: [{ run: 2 }] })
  })
  it('does not turn null category scores into success-looking metrics', () => {
    const { dir, run, summary } = setup()
    for (const n of [1, 2]) writeFileSync(join(dir, `mobile_tr.r${n}.json`), JSON.stringify({ categories: { performance: { score: null } } }))
    expect(run().status).toBe(1)
    expect(summary()[0]).toMatchObject({ runs: 0, error: expect.stringContaining('missing category scores') })
  })
  it('rejects filename traversal in presets and cross-origin URL paths', () => {
    const { run } = setup()
    expect(run({ LH_PRESETS: '../outside' }).status).toBe(1)
    expect(run({ LH_URLS: '//outside.test' }).status).toBe(1)
  })
})
