/** Run against an isolated production server: pnpm exec tsx scripts/perf-isr.ts [origin] */
import { performance } from 'node:perf_hooks'

const origin = process.argv[2] || 'http://127.0.0.1:3300'
const sitemap = await fetch(`${origin}/sitemap.xml`)
if (!sitemap.ok) throw new Error(`Sitemap: HTTP ${sitemap.status}`)
const xml = await sitemap.text()
const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replaceAll('&amp;', '&'))
if (!locations.length) throw new Error('Sitemap has no URLs')
console.log('route\tfirst status\tfirst cache\tfirst TTFB ms\tsecond status\tsecond cache\tsecond TTFB ms')
async function measure(url: string) {
  const start = performance.now()
  const response = await fetch(url, { redirect: 'manual' })
  const ttfb = performance.now() - start
  await response.arrayBuffer()
  return [response.status, response.headers.get('x-nextjs-cache') || '-', ttfb.toFixed(1)]
}
for (const location of locations) {
  const parsed = new URL(location)
  const url = new URL(parsed.pathname + parsed.search, origin).toString()
  const first = await measure(url)
  const second = await measure(url)
  console.log([parsed.pathname, ...first, ...second].join('\t'))
}
