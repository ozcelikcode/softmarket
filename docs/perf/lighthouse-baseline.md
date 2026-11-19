# Lighthouse baseline (F0, 2026-11-07)

Environment: `NEXT_DIST_DIR=.next-prod pnpm build` + `next start` (127.0.0.1:3200), local SQLite, warm ISR cache. Lighthouse 13.6.0 (`pnpm exec lighthouse`), Chrome for Testing 1248 (playwright), mobile = default simulated throttling, desktop = `--preset=desktop`. Run count: 1 (no median). Raw results: `docs/perf/lighthouse-baseline.json`.
To reproduce: start the server, run `CHROME_PATH=<chrome> node scripts/perf-lighthouse.mjs` (URL/budget list in `lighthouserc.json`). No sandbox/MachPort issue occurred; ran with `--no-sandbox`.

Budget (plan §7): LCP < 2.0 s, CLS < 0.05, TBT < 150 ms, Perf ≥ 90, A11y/SEO/BP ≥ 95, JS gzip ≤ 130 KB.


### Mobile

| Page | Perf | A11y | BP | SEO | LCP (s) | CLS | TBT (ms) | TTFB (ms) | JS gzip (KB) | JS raw (KB) | LCP element |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Home TR (`/tr`) | 92 | 100 | 100 | 92 | 1.12 | 0.000 | 323 | 5 | 193 | 579 | `section.relative > div.mx-auto > div > h1.text-balance "Karmaşık işler için sade yazılım."` |
| Home EN (`/en`) | 100 | 100 | 100 | 92 | 1.06 | 0.000 | 10 | 2 | 193 | 579 | `section.relative > div.mx-auto > div > h1.text-balance "Simple software for complex work."` |
| Product list (`/tr/urunler`) | 100 | 100 | 100 | 92 | 1.21 | 0.000 | 7 | 31 | 200 | 595 | `section.relative > div.mx-auto > div > p.mt-5 "Ürün ailelerimizi ve ailelerin altındaki"` |
| Product detail (`/tr/urunler/akis-yonetimi/akis-merkezi`) | 100 | 100 | 100 | 92 | 1.06 | 0.000 | 8 | 2 | 200 | 596 | `div#genel-bakis > section.relative > div.mx-auto > p.text-h3 "Akışları tek noktadan tasarlayın ve izle"` |
| Solutions (`/tr/cozumler`) | 100 | 100 | 100 | 92 | 1.21 | 0.000 | 12 | 12 | 200 | 595 | `section.relative > div.mx-auto > div > p.mt-5 "Sektör ve kullanım senaryolarına göre ha"` |
| Support (`/tr/destek`) | 100 | 100 | 100 | 92 | 1.06 | 0.000 | 6 | 2 | 194 | 580 | `section.relative > div.mx-auto > div > p.mt-5 "Yazılımınız için dokümanları, güncelleme"` |
| News (`/tr/haberler`) | 100 | 100 | 100 | 92 | 1.21 | 0.000 | 14 | 12 | 195 | 583 | `section.relative > div.mx-auto > div > p.mt-5 "Duyurular, ürün güncellemeleri ve yazıla"` |

### Desktop

| Page | Perf | A11y | BP | SEO | LCP (s) | CLS | TBT (ms) | TTFB (ms) | JS gzip (KB) | JS raw (KB) | LCP element |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Home TR (`/tr`) | 100 | 100 | 100 | 92 | 0.29 | 0.000 | 0 | 1 | 197 | 586 | `section.relative > div.mx-auto > div > h1.text-balance "Karmaşık işler için sade yazılım."` |
| Home EN (`/en`) | 100 | 100 | 100 | 92 | 0.29 | 0.000 | 0 | 2 | 197 | 586 | `section.relative > div.mx-auto > div > h1.text-balance "Simple software for complex work."` |
| Product list (`/tr/urunler`) | 100 | 100 | 100 | 92 | 0.33 | 0.000 | 0 | 13 | 205 | 602 | `section.relative > div.mx-auto > div > h1.text-balance "Ürünler"` |
| Product detail (`/tr/urunler/akis-yonetimi/akis-merkezi`) | 100 | 100 | 100 | 92 | 0.29 | 0.000 | 0 | 2 | 205 | 603 | `section.relative > div.mx-auto > div > h1.text-balance "Akış Merkezi"` |
| Solutions (`/tr/cozumler`) | 100 | 100 | 100 | 92 | 0.33 | 0.000 | 0 | 11 | 205 | 602 | `section.relative > div.mx-auto > div > h1.text-balance "Çözümler"` |
| Support (`/tr/destek`) | 100 | 100 | 100 | 92 | 0.29 | 0.000 | 0 | 2 | 208 | 610 | `section.relative > div.mx-auto > div > h1.text-balance "Destek merkezi"` |
| News (`/tr/haberler`) | 100 | 100 | 100 | 92 | 0.33 | 0.000 | 0 | 11 | 214 | 621 | `section.relative > div.mx-auto > div > h1.text-balance "Haberler"` |

INP: not measured in lab runs (TBT is the proxy). Playwright vitals is a post-F0 item.

## Interpretation

- Mobile Perf 100 / A11y 100 / BP 100; SEO 92. LCP 1.05-1.21 s, CLS 0. Budgets are met for LCP/CLS/TBT.
- First run (`/tr` mobile) cold-cache outlier: Perf 92, TBT 323 ms, LCP element render delay 882 ms. Two consecutive re-runs: Perf 100, TBT 9-10 ms, LCP 1.05 s. Therefore, "first load" behavior should be measured separately in F2.
- **JS gzip 193-214 KB exceeds the 130 KB budget** (on all pages). Next "First Load JS shared" = 102 KB; per-page total 135-146 KB (build output). Lighthouse's total counts all scripts requested after hydration (unused `motion` dependency and separate client `Reveal` islands per block are suspected; bundle analysis is an F0 item). F1: remove `motion` + `Reveal` islands.
- SEO 92 reason: `canonical` audit. In prod build `NEXT_PUBLIC_SERVER_URL` is the local origin (`http://127.0.0.1:3100`), which the build warning also notes. Drops once a domain is set; not a code bug.
- Failing audits: `canonical` (all), `bf-cache` (list pages `/urunler`, `/cozumler`, `/haberler`; back-forward cache blocker, cause to be investigated in F1).
- Mobile LCP element: hero `h1` on home page (text; no image), hero lead paragraph (`p.mt-5`) on subpages, `p.text-h3` (overview) on product detail. No hero image exists; image budget cannot be measured in this phase.
- Worst page (mobile): home page first run 92; in steady state all are 100. The real bottlenecks are JS size and render-blocking CSS (render-blocking-insight: estimated 360 ms savings).
