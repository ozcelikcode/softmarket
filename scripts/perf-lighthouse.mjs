// Lighthouse baseline runner. Reads lighthouserc.json, writes JSON + summary.json.
// Usage: CHROME_PATH=<chrome> node scripts/perf-lighthouse.mjs [outDir]
// Env: LH_RUNS (default cfg.runs), LH_BASE (base URL), LH_URLS (comma list), LH_PRESETS (comma list). Multiple runs -> median per metric.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const cfg = JSON.parse(readFileSync('lighthouserc.json', 'utf8'))
const outDir = process.argv[2] || 'docs/perf/raw'
const rows = []
const runs = Number(process.env.LH_RUNS ?? cfg.runs ?? 1)
if (!Number.isSafeInteger(runs) || runs < 1 || runs > 100) throw new Error('LH_RUNS must be an integer between 1 and 100')
const base = new URL(process.env.LH_BASE ?? cfg.baseUrl)
if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
  throw new Error('LH_BASE must be an HTTP(S) origin without credentials')
}
const urls = process.env.LH_URLS !== undefined ? process.env.LH_URLS.split(',').map((v) => v.trim()) : cfg.urls
const presets = process.env.LH_PRESETS !== undefined ? process.env.LH_PRESETS.split(',').map((v) => v.trim()) : cfg.presets
if (!urls.length || urls.some((v) => typeof v !== 'string' || !v.startsWith('/') || v.startsWith('//') || v.includes('\\') || /[\r\n]/.test(v))) {
  throw new Error('LH_URLS must contain local absolute paths')
}
if (!presets.length || presets.some((v) => !['mobile', 'desktop'].includes(v))) throw new Error('LH_PRESETS must contain mobile or desktop')
mkdirSync(outDir, { recursive: true })
const median = (xs) => {
  const v = xs.filter(Number.isFinite).sort((a, b) => a - b)
  const mid = Math.floor(v.length / 2)
  return v.length ? v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2 : undefined
}
const single = []
for (const preset of presets) {
  for (const path of urls) {
    for (let run = 1; run <= runs; run++) {
      const name = `${preset}${path.replace(/\//g, '_')}${runs > 1 ? `.r${run}` : ''}`
      const out = join(outDir, `${name}.json`)
      const args = [
        'lighthouse',
        new URL(path, base).href,
        '--output=json',
        `--output-path=${out}`,
        '--quiet',
        '--chrome-flags=--headless=new --no-sandbox',
      ]
      if (preset === 'desktop') args.push('--preset=desktop')
      // LH_REPARSE=1: reuse existing raw JSON, skip running Lighthouse.
      const reuse = process.env.LH_REPARSE === '1' && existsSync(out)
      const r = reuse ? { status: 0 } : spawnSync('pnpm', ['exec', ...args], { encoding: 'utf8' })
      if (r.status !== 0) {
        single.push({ preset, path, run, error: (r.error?.message || r.stderr || `Lighthouse exited with status ${r.status}`).slice(-300) })
        continue
      }
      try {
        const j = JSON.parse(readFileSync(out, 'utf8'))
        if (j.runtimeError || ['performance', 'accessibility', 'best-practices', 'seo'].some((k) => !Number.isFinite(j.categories?.[k]?.score))) {
          throw new Error('Lighthouse report contains a runtime error or missing category scores')
        }
        const a = j.audits
        const lcpNode = a['lcp-breakdown-insight']?.details?.items?.find((i) => i.type === 'node')
        const rd = a['lcp-breakdown-insight']?.details?.items?.[0]?.items?.find((i) => i.subpart === 'elementRenderDelay')
        const js = (a['network-requests']?.details?.items ?? []).filter((i) => i.resourceType === 'Script')
        const fonts = (a['network-requests']?.details?.items ?? []).filter((i) => i.resourceType === 'Font')
        single.push({
          preset,
          path,
          run,
          perf: Math.round(j.categories.performance.score * 100),
          a11y: Math.round(j.categories.accessibility.score * 100),
          bp: Math.round(j.categories['best-practices'].score * 100),
          seo: Math.round(j.categories.seo.score * 100),
          lcp: a['largest-contentful-paint'].numericValue,
          cls: a['cumulative-layout-shift'].numericValue,
          tbt: a['total-blocking-time'].numericValue,
          fcp: a['first-contentful-paint'].numericValue,
          ttfb: a['server-response-time']?.numericValue,
          jsTransferKb: js.reduce((s, i) => s + (i.transferSize || 0), 0) / 1024,
          jsRawKb: js.reduce((s, i) => s + (i.resourceSize || 0), 0) / 1024,
          fontKb: fonts.reduce((s, i) => s + (i.transferSize || 0), 0) / 1024,
          fontCount: fonts.length,
          lcpEl: lcpNode ? `${lcpNode.selector || ''} "${(lcpNode.nodeLabel || '').slice(0, 40)}"` : '',
          lcpRenderDelay: rd?.duration,
          failed: Object.values(a)
            .filter((x) => x.score !== null && x.score < 0.9 && x.scoreDisplayMode === 'binary')
            .map((x) => x.id),
        })
      } catch (error) {
        single.push({ preset, path, run, error: error.message })
      }
    }
  }
}
for (const preset of presets) {
  for (const path of urls) {
    const rs = single.filter((x) => x.preset === preset && x.path === path)
    const ok = rs.filter((x) => !x.error)
    const errors = rs.filter((x) => x.error).map(({ run, error }) => ({ run, error }))
    if (!ok.length) { rows.push({ preset, path, runs: 0, error: errors[0]?.error, errors }); continue }
    const row = { preset, path, runs: ok.length, ...(errors.length ? { errors } : {}) }
    for (const k of ['perf', 'a11y', 'bp', 'seo', 'lcp', 'cls', 'tbt', 'fcp', 'ttfb', 'jsTransferKb', 'jsRawKb', 'fontKb', 'fontCount', 'lcpRenderDelay']) row[k] = median(ok.map((x) => x[k]))
    row.lcpEl = ok[0].lcpEl
    row.failed = [...new Set(ok.flatMap((x) => x.failed))]
    row.lcpRuns = ok.map((x) => Math.round(x.lcp))
    row.perfRuns = ok.map((x) => x.perf)
    rows.push(row)
  }
}
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(rows, null, 1))
console.log(`wrote ${rows.length} rows`)
if (single.some((x) => x.error)) process.exitCode = 1
