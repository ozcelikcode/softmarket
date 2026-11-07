/** Run against an isolated production server: pnpm exec tsx scripts/perf-isr.ts [origin] */
import { performance } from 'node:perf_hooks'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

// Redirect the flagged server stdout to a file and pass its path here.
const logFile = process.env.SM_DB_QUERY_LOG_FILE
async function queryStats(id: string): Promise<[number | string, number | string]> {
  if (!logFile) return ['—', '—']
  for (let attempt = 0; attempt < 50; attempt++) {
    const log = await readFile(logFile, 'utf8')
    for (const line of log.split('\n').slice(0, -1)) {
      const marker = line.indexOf('SM_DB_QUERY ')
      if (marker < 0) continue
      const entry = JSON.parse(line.slice(marker + 12))
      if (entry.id === id) return [entry.queries, entry.durationMs]
    }
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  throw new Error(`No completed query measurement for ${id}; is SM_DB_QUERY_LOG=1 enabled?`)
}

const origin = process.argv[2] || 'http://127.0.0.1:3300'
const sitemap = await fetch(`${origin}/sitemap.xml`)
if (!sitemap.ok) throw new Error(`Sitemap: HTTP ${sitemap.status}`)
const xml = await sitemap.text()
const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replaceAll('&amp;', '&'))
if (!locations.length) throw new Error('Sitemap has no URLs')
locations.push('/tr/ara?q=akis', '/tr/hesap/giris')
console.log('route\tfirst status\tfirst cache\tfirst TTFB ms\tfirst queries\tfirst SQL ms\tsecond status\tsecond cache\tsecond TTFB ms\tsecond queries\tsecond SQL ms')
async function measure(url: string) {
  const id = randomUUID()
  const start = performance.now()
  const response = await fetch(url, { redirect: 'manual', headers: { 'x-sm-perf-id': id } })
  const ttfb = performance.now() - start
  await response.arrayBuffer()
  return [response.status, response.headers.get('x-nextjs-cache') || '-', ttfb.toFixed(1), ...await queryStats(id)]
}
for (const location of locations) {
  const parsed = new URL(location, origin)
  const url = new URL(parsed.pathname + parsed.search, origin).toString()
  const first = await measure(url)
  const second = await measure(url)
  console.log([parsed.pathname + parsed.search, ...first, ...second].join('\t'))
}
