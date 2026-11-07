// Full-page screenshot matrix + automated layout probes. Usage: node scripts/qa-screenshots.mjs <urlsFile> <outDir> [baseUrl]
import { chromium } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [urlsFile, outDir, base = 'http://127.0.0.1:3200'] = process.argv.slice(2)
const paths = readFileSync(urlsFile, 'utf8').split('\n').filter(Boolean).map((u) => new URL(u).pathname)
mkdirSync(outDir, { recursive: true })
const widths = [390, 768, 1440]
const browser = await chromium.launch()
const report = []
for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 500 ? 844 : 900 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  for (const p of paths) {
    const errors = []
    page.removeAllListeners('console')
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)))
    await page.addInitScript(() => {
      window.__cls = 0
      new PerformanceObserver((l) => l.getEntries().forEach((e) => !e.hadRecentInput && (window.__cls += e.value))).observe({ type: 'layout-shift', buffered: true })
    }).catch(() => {})
    const res = await page.goto(base + p, { waitUntil: 'load', timeout: 45000 }).catch((e) => ({ status: () => 'ERR ' + e.message.slice(0, 60) }))
    await page.evaluate(async () => {
      const h = () => document.documentElement.scrollHeight
      for (let y = 0; y < h(); y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)) }
      window.scrollTo(0, 0)
      await new Promise((r) => setTimeout(r, 400))
    })
    const probe = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth
      const overflow = document.documentElement.scrollWidth - vw
      const wide = [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > vw + 2 }).slice(0, 3).map((e) => e.tagName + '.' + String(e.className).slice(0, 50))
      const broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src.slice(-60))
      const hidden = document.querySelectorAll('[data-anim-state="pending"]').length
      const small = [...document.querySelectorAll('a,button')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 24 || r.width < 24) }).length
      return { overflow, wide, broken, stuckHidden: hidden, tinyTargets: small, h: document.documentElement.scrollHeight, cls: window.__cls || 0 }
    })
    const slug = (p === '/tr' || p === '/en' ? p.slice(1) : p.slice(1).replace(/\//g, '__'))
    const file = `${slug}--${w}.png`
    await page.screenshot({ path: join(outDir, file), fullPage: true }).catch((e) => errors.push('shot ' + e.message.slice(0, 80)))
    report.push({ p, w, status: typeof res.status === 'function' ? res.status() : '?', errors, ...probe, file })
  }
  await ctx.close()
}
await browser.close()
writeFileSync(join(outDir, 'probe.json'), JSON.stringify(report, null, 1))
console.log('done', report.length)
