// Lighthouse baseline runner. Reads lighthouserc.json, writes JSON + summary.json.
// Usage: CHROME_PATH=<chrome> node scripts/perf-lighthouse.mjs [outDir]
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const cfg = JSON.parse(readFileSync('lighthouserc.json', 'utf8'))
const outDir = process.argv[2] || 'docs/perf/raw'
mkdirSync(outDir, { recursive: true })
const rows = []
for (const preset of cfg.presets) {
  for (const path of cfg.urls) {
    const name = `${preset}${path.replace(/\//g, '_')}`
    const out = join(outDir, `${name}.json`)
    const args = [
      'lighthouse',
      cfg.baseUrl + path,
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
      rows.push({ preset, path, error: (r.stderr || '').slice(-300) })
      continue
    }
    const j = JSON.parse(readFileSync(out, 'utf8'))
    const a = j.audits
    const lcpNode = a['lcp-breakdown-insight']?.details?.items?.find((i) => i.type === 'node')
    const rd = a['lcp-breakdown-insight']?.details?.items?.[0]?.items?.find((i) => i.subpart === 'elementRenderDelay')
    const js = (a['network-requests']?.details?.items ?? []).filter((i) => i.resourceType === 'Script')
    rows.push({
      preset,
      path,
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
      lcpEl: lcpNode ? `${lcpNode.selector || ''} "${(lcpNode.nodeLabel || '').slice(0, 40)}"` : '',
      lcpRenderDelay: rd?.duration,
      failed: Object.values(a)
        .filter((x) => x.score !== null && x.score < 0.9 && x.scoreDisplayMode === 'binary')
        .map((x) => x.id),
    })
  }
}
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(rows, null, 1))
console.log(`wrote ${rows.length} rows`)
