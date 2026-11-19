# F11 performance acceptance (2026-11-07)

Environment: `NEXT_DIST_DIR=.next-prod pnpm build` + `next start` 127.0.0.1:3200 (live SQLite, read-only); for image pages, a DB **copy** + `.next-f11` build + 3300 (`media` record in copy + landing page with hero image `/tr/f11-gorsel-test` and home page hero image; not written to live DB). Lighthouse 13.6 (`scripts/perf-lighthouse.mjs`, `LH_RUNS=3` → **3-run median**), Chrome for Testing 1248, mobile = default simulated throttling (Lantern), desktop = `--preset=desktop`. Raw results: `docs/perf/f11-raw/` (`summary-live.json`, `summary-image.json`, `isr-query-log.tsv`).

## Budget table (plan §7)

| Metric | Target | Measured | Status |
|---|---|---|---|
| LCP (text hero; `/tr`, `/en`, catalog, product, solutions, support, news) | < 2.0 s | 1.06–1.21 s | GREEN |
| LCP (image hero; home page and landing, copy DB) | < 2.0 s | **3.01 s** (3 runs 3007–3013 ms) | RED |
| CLS (all pages, including images) | < 0.05 | 0.000 | GREEN |
| TBT (INP proxy) mobile | < 150 ms | 73–89 ms | GREEN |
| INP proxy (Playwright, 390 px, CPU x4: menu, FAQ x3, tab x3, locale) | < 200 ms | worst 128 ms (menu) | GREEN |
| Lighthouse Performance (mobile) | ≥ 90 | 100 (text) / 94 (image) | GREEN |
| Lighthouse A11y / Best Practices | ≥ 95 | 100 / 100 | GREEN |
| Lighthouse SEO | ≥ 95 | **92** (only failing audit `canonical`) | RED (environment) |
| Home page JS gzip total | ≤ 130 KB | **191–198 KB** (Next "First Load JS" 132–136 KB) | RED |
| Page-specific chunk | ≤ 15 KB | 0.3–0.8 KB (largest route share: `global-error` 11 KB, `[locale]/layout` 9 KB) | GREEN |
| CSS gzip | ≤ 30 KB | 12.5 KB (1.4 + 11.1) | GREEN |
| Hero image (mobile) | ≤ 180 KB | At DPR 1.75 selected `card` 768w = 10–11 KB; at DPR 3 `hero` 1280w = 100 KB (synthetic textured fixture; varies for real photos) | GREEN |
| Font preload | ≤ 1 file / ≤ 60 KB | 1 file but **70 KB**; also second font (70 KB, unpreloaded) downloads on initial load | RED |
| TTFB, ISR HIT | < 50 ms | 2nd request on 123 routes 2–8 ms (first cold `/tr` 55.7 ms) | GREEN |
| TTFB, MISS | < 400 ms | No MISS observed (all generated at build); 24 dynamic routes 17–107 ms, does not substitute for ISR MISS | NOT VERIFIED |
| DB queries / request: home ≤ 12, product ≤ 15 | | home 0, product 0 (HIT); dynamic list/form routes 11–18 (`/tr/iletisim` 18, `/tr/urunler` 16, search 33) | YELLOW (home/product budget green; budget undefined for dynamic pages, 18 is high) |

Result: §7 budget is **not completely green**; 4 reds remain for acceptance (image LCP, SEO, JS, font).

### Mobile (3-run median)

| Page | Perf | A11y | BP | SEO | LCP (s) | CLS | TBT (ms) | JS gzip (KB) |
|---|---|---|---|---|---|---|---|---|
| `/tr` | 100 | 100 | 100 | 92 | 1.06 | 0.000 | 81 | 192 |
| `/en` | 100 | 100 | 100 | 92 | 1.06 | 0.000 | 80 | 192 |
| `/tr/urunler` | 100 | 100 | 100 | 92 | 1.21 | 0.000 | 87 | 193 |
| `/tr/urunler/…/akis-merkezi` | 100 | 100 | 100 | 92 | 1.06 | 0.000 | 81 | 192 |
| `/tr/cozumler` | 100 | 100 | 100 | 92 | 1.21 | 0.000 | 89 | 193 |
| `/tr/destek` | 100 | 100 | 100 | 92 | 1.06 | 0.000 | 81 | 191 |
| `/tr/haberler` | 100 | 100 | 100 | 92 | 1.21 | 0.000 | 88 | 197 |
| `/tr` (with image) | 94 | 100 | 100 | 92 | 3.01 | 0.000 | 75 | 191 |
| `/tr/f11-gorsel-test` (with image) | 94 | 100 | 100 | 92 | 3.01 | 0.000 | 73 | 192 |

### Desktop (3-run median)

| Page | Perf | A11y | BP | SEO | LCP (s) | CLS | TBT (ms) | JS gzip (KB) |
|---|---|---|---|---|---|---|---|---|
| `/tr` | 100 | 100 | 100 | 92 | 0.29 | 0.000 | 0 | 192 |
| `/en` | 100 | 100 | 100 | 92 | 0.29 | 0.000 | 0 | 192 |
| `/tr/urunler` | 100 | 100 | 100 | 92 | 0.33 | 0.000 | 0 | 195 |
| `/tr/urunler/…/akis-merkezi` | 100 | 100 | 100 | 92 | 0.33 | 0.000 | 5 | 193 |
| `/tr/cozumler` | 100 | 100 | 100 | 92 | 0.33 | 0.000 | 0 | 195 |
| `/tr/destek` | 100 | 100 | 100 | 92 | 0.29 | 0.000 | 0 | 191 |
| `/tr/haberler` | 100 | 100 | 100 | 92 | 0.33 | 0.000 | 0 | 198 |
| `/tr` (with image) | 100 | 100 | 100 | 92 | 0.65 | 0.000 | 0 | 192 |
| `/tr/f11-gorsel-test` (with image) | 100 | 100 | 100 | 92 | 0.65 | 0.000 | 0 | 193 |

## Interpretation

- **Image LCP 3.0 s (Lantern).** On the same page under real throttling (`--throttling-method=devtools`), LCP = FCP = 2.18 s; text page 2.16 s: the image adds no delay. Observed loading chain is fast (image `fetchpriority=high`, `loading=eager`, preloaded, 10 KB, no discovery issue). Because simulation ties the image to the main-thread/JS chain (`interactive` = LCP = 3006 ms). Experiment: blocking image gives 1.06 s, blocking font gives 2.68 s. So the moves that save the budget are: (1) shrink JS, (2) make font 1 file and < 60 KB / remove preload. Not verified with real-user field data (CrUX).
- **JS 192 KB gzip.** Breakdown: `react-dom` 53.7, `next client` 44.2, Radix NavigationMenu 16.6 (mega menu), ICU MessageFormat parser 12.5 (client-side message parsing), `tailwind-merge`+`cva` 9.3, Radix primitives 8.2, `[locale]/layout` 9.3, `global-error` 11.2 (on every page). Framework baseline is ~100 KB; for the 130 KB target, at least 30 KB must be cut from ~60 KB of site JS (replacing mega menu with CSS/`details`, resolving messages on server, removing `tailwind-merge`). Large effort: separate phase.
- **TBT** rose from 6–14 ms in F0 to 73–89 ms (still green). Cause not investigated (F2 animation observer/hydration suspected; measurement was taken on a machine with a dev server running).
- **SEO 92:** `canonical` only; expected to close in production once a domain (`NEXT_PUBLIC_SERVER_URL`) is set (same reason as F0). `bf-cache` fails on dynamic list pages (`Cache-Control: private, no-store`); out of budget.
- **Fonts:** `b6ea3859…woff2` (preload) 70,166 B, `4b23c4cd…woff2` 68–70 KB. The second is likely the mono family (`Ürün aileleri` in the hero panel, version numbers). Subsetting (latin + latin-ext) or moving mono to the system stack is recommended.
- **Dynamic routes:** `/tr/iletisim` (18 queries), `/tr/urunler`, `/tr/cozumler`, `/tr/haberler`, downloads, and documentation listing have no ISR (`private, no-store`). Catalog/contact queries are most likely globals + list; can drop to 0 with ISR/`unstable_cache`.
- Build: `.next-prod` and `.next-f11` builds passed on the first attempt without timeout (root-cause investigation of documented build timeouts was not done in this phase).

## Post-fix round (2026-11-08, JS/font/image LCP)

Environment: read-only backup of live DB + empty uploads (scratchpad), only 1 media item (1600×1000 textured JPEG → card 768w 22 KB) and `/tr/f11-gorsel-test` landing (`default` hero with image) added to copy via `content:import`. `NEXT_DIST_DIR=.next-perf` prod build + `next start` 127.0.0.1:3300, Lighthouse 13.6 (`LH_RUNS=3`, median), mobile Lantern + desktop preset. **Before** = pre-change build with the same copy/fixture (the 3.01 s in the F11 table was from a different, lighter fixture). Font KB = `Font` transfer total in the Lighthouse network log (new `fontKb`/`fontCount` fields).

### Mobile (3-run median, before → after)

| Page | Perf | LCP (s) | TBT (ms) | CLS | JS gzip (KB) | Font KB (files) |
|---|---|---|---|---|---|---|
| `/tr` | 100 → 100 | 1.06 → 1.06 | 77 → 71 | 0 → 0 | 192.0 → **129.0** | 138.7 (2) → **48.3 (2)** |
| `/en` | 100 → 100 | 1.06 → 1.06 | 73 → 69 | 0 → 0 | 192.0 → **129.0** | 138.7 (2) → **48.3 (2)** |
| `/tr/urunler` | 100 → 100 | 1.21 → 1.21 | 75 → 70 | 0 → 0 | 193.3 → 130.4 | 68.5 (1) → **28.1 (1)** |
| `/tr/urunler/akis-yonetimi/akis-merkezi` | 100 → 100 | 1.06 → 1.06 | 75 → 67 | 0 → 0 | 192.0 → 129.0 | 68.5 (1) → 28.1 (1) |
| `/tr/f11-gorsel-test` (image hero) | 93 → 97 | **3.16 → 2.53** | 59 → 70 | 0 → 0 | 192.0 → 129.0 | 68.5 (1) → 28.1 (1) |

### Desktop (3-run median, before → after)

| Page | Perf | LCP (s) | TBT (ms) | CLS | JS gzip (KB) | Font KB |
|---|---|---|---|---|---|---|
| `/tr` | 100 → 100 | 0.29 → 0.29 | 0 → 0 | 0 → 0 | 192.0 → 129.0 | 138.7 → 48.3 |
| `/en` | 100 → 100 | 0.29 → 0.29 | 0 → 0 | 0 → 0 | 192.0 → 129.0 | 138.7 → 48.3 |
| `/tr/urunler` | 100 → 100 | 0.33 → 0.33 | 0 → 0 | 0 → 0 | 194.6 → 131.9 | 68.5 → 28.1 |
| `/tr/urunler/…/akis-merkezi` | 100 → 100 | 0.29 → 0.29 | 0 → 0 | 0 → 0 | 193.3 → 130.4 | 68.5 → 28.1 |
| `/tr/f11-gorsel-test` | 100 → 100 | 0.68 → 0.57 | 0 → 0 | 0 → 0 | 193.3 → 130.4 | 68.5 → 28.1 |

Image hero under real throttling (`--throttling-method=devtools`, 3 runs): LCP 2.24–2.27 s, FCP 2.14 s (image ≈ FCP + 0.1 s). A11y/BP 100, SEO 92 (`canonical` only) unchanged.

### What changed

- **Mega menu (Radix NavigationMenu + Dialog, ~16 KB):** header is now a server component (`header-shell.tsx`); single client island `header-frame.tsx` (scroll/portal light theme) + DOM controller `src/lib/header-nav.ts`. Panels have `hidden` in HTML, triggers have `aria-expanded`/`aria-controls`/`data-state`; hover-intent 80 ms open / 150 ms close / 300 ms skip-delay, click toggle (like Radix, click-to-close does not reopen on hover), Escape closes and returns focus to trigger, ←/→/Home/End across top items, ↓ opens panel and enters first link, ↑/↓ inside panel, outside click/focus closes, link click closes. Mobile menu uses native modal `<dialog>` (focus trap, Escape, background inert, built-in focus return; backdrop/link/close click and ≥64rem close it; `html:has(dialog[data-sheet][open])` scroll lock). `ui/sheet.tsx` deleted.
- **ICU parser + messages (12.5 KB):** no `next-intl` hooks remain on the client; `NextIntlClientProvider` removed (the provider alone pulled `use-intl/format-message` → `intl-messageformat`). Language switcher gets locale from URL and its label from a static JSON selection (`publicLanguageSwitch`); `error.tsx`/`global-error.tsx` include only `feedback` strings (previously both full message files, 10.5 KB). Server code does not import the `next-intl` root entry (`hasLocale`): the react-server build was registering `NextIntlClientProvider` as a client reference and adding `use-intl` to every page → `src/i18n/has-locale.ts`. Evidence: no `MALFORMED_ARGUMENT`/`MISSING_MESSAGE` in build chunks; `tests/unit/client-bundle-guard.test.ts` locks the regression.
- **tailwind-merge + cva (9.3 KB):** `cn()` remains on the server (F2 `text-small` test unchanged). Shared client islands do not use `cn`/cva/Button/Container; `safeHref` moved to dependency-free `src/lib/safe-href.ts` (`i18n/paths` was pulling `tailwind-merge` on the client), `jsonLdString` → `src/lib/json-ld-string.ts` (JsonLd island was pulling `lib/seo` + routing). Page-level islands (tabs, accordion, portal-nav) use `cx` (= clsx). 3 lucide icons in client islands inlined with the same SVG (`ui/client-icons.tsx`).
- **Font:** instead of `geist/font/sans` (70 KB, all languages), subset variable Geist via `scripts/subset-fonts.sh` (OFL, `src/fonts/OFL.txt`): primary Latin + Latin-1 + Turkish (`ĞğİıŞş`) + punctuation/arrows/€/₺ = 28 KB, **single preload**; remaining Latin Extended-A is a separate `unicode-range` face (15 KB, downloaded only if those characters appear on the page; not downloaded on measured pages); Geist Mono subset 20 KB, no preload. `font-display: swap`, shared `Geist Fallback` (Arial + next/font-computed ascent/descent/size-adjust) → CLS 0.
- **Image LCP:** hero image already had preload + `fetchpriority=high` + accurate `sizes` (390 px/DPR 1.75 → 768w); render-blocking was only 2 CSS files. Because Lantern simulates image LCP with all JS/font network and CPU nodes starting before observed LCP, the gain came from JS (−63 KB) and font (−40 KB) reductions.

### Visual/behavioral comparison

390/1440, 7 pages (+ on `/tr` and `/tr/hesap/giris`: mega menu `Ürünler` hover, `Şirket` click, closed after Escape; mobile sheet open and accordion open): header, mega panels, and mobile sheet are pixel-identical (only sub-pixel antialiasing difference from the subset font, 0–25 pixels in the top 900 px). Differences in page bodies (PageHero/breadcrumb spacing, product hero, footer language switcher/copyright) belong to the parallel visual-fix round. Playwright: `tests/e2e/header-keyboard.spec.ts` (read-only, can be pointed to an isolated build via `E2E_BASE_URL`) 3/3.

### Remaining reds

- **Image hero LCP (Lantern) 2.53 s** (target < 2.5 s; down from 3.16). Experiment (1 run): blocking all JS gives 1.97 s, blocking only site chunks (`/chunks/app/*`, ~8 KB) gives 2.51 s, blocking `react-dom` or `next` chunk gives 2.26 s; blocking font gives 2.38 s. Remaining cost is the framework baseline (`react-dom` 53 + `next` 43 KB gzip) and local `next start`'s HTTP/1.1 connection model; `experimental.inlineCss` was tried (2.83 s, worse, reverted), and splitting conditional islands with `next/dynamic` yielded no gain (reverted). Must be re-measured in production with Caddy HTTP/2 and real photo sizes.
- **Geist Mono downloads on the home page** (20 KB, within total 48 KB ≤ 60 KB budget): `font-mono` labels in the hero panel (`Ürün aileleri`, counters). Removing it completely means switching these labels to sans/system mono (a visual change), not done.
- JS: home page 129.0 KB (≤ 130); catalog 130.4 / desktop 131.9 KB (page-specific list/filter chunk) at the budget boundary. SEO 92 (`canonical`, environment) unchanged.

## Reproduction

For builds and tests, first set `DATABASE_URI` and `UPLOADS_DIR` to temporary DB/upload copies; the build command below alone does not provide DB isolation. `.next` belongs to the running 3100 dev server; do not delete this directory.

```bash
NEXT_DIST_DIR=.next-prod pnpm build && NEXT_DIST_DIR=.next-prod pnpm start --hostname 127.0.0.1 --port 3200
CHROME_PATH=<chrome> LH_RUNS=3 node scripts/perf-lighthouse.mjs <outDir>
# image page: copy DB + LH_BASE=http://127.0.0.1:3300 LH_URLS=/tr,/tr/<slug> LH_PRESETS=mobile,desktop
```

### Isolated E2E security audit

`pnpm test:e2e:isolated` uses `127.0.0.1:3400` only; it does not connect to a running server (`reuseExistingServer:false`). Normal `pnpm test:e2e --list` excludes the isolated folder. Source `E2E_SOURCE_DB` (default `data/softmarket.db`) is read with Python SQLite `mode=ro` and copied to a private temporary directory via the backup API; if the source does not exist, it is not created. Python 3 is required. Uploads are created empty in this directory; live uploads are not used. If another source DB is configured, pass `E2E_SOURCE_DB` explicitly.

Seed does not load `.env`; it refuses to start Payload without the isolation flag/directory, marker, canonical DB/uploads paths, and a separate Payload secret. Symlink/hardlink DB and symlink uploads are rejected. The file URI is constructed with `pathToFileURL` (`?`, `#`, `%`, spaces, and single quotes cannot alter the path). The launched Payload's actual DB file (`PRAGMA database_list`) and media directory are verified before writing. Runtime Payload config also errors rather than falling back to live defaults if isolated env is missing/invalid; on port 3400 the check still runs even if all isolation flags are lost. Config path is pinned to the project config. The test admin is created with `roles:['admin']` and API key disabled; password/secret are random and exist only in process env. Isolated trace and shell xtrace are off so login bodies containing passwords are not stored; do not print credentials to the command line or logs.

EXIT/INT/TERM, including seed/backup errors, terminates only the test's process group and cleans up its temporary directory. Seed runs directly via `node --import tsx`, and Next runs via the `node_modules/.bin/next` shim; `pnpm exec` (which creates separate process groups) does not sit in between, and Next's required `NODE_PATH` setting is preserved. Playwright uses `gracefulShutdown: SIGTERM`; default force-kill bypassed the trap. On SIGKILL or machine shutdown the trap cannot run; the private temporary copy/process may remain, and no switch to live DB happens. Fault-injection tests cover missing env, URI spoofing, symlink/hardlink, paths with special characters, missing source, seed error, password hiding under xtrace, and SIGTERM cleanup. Lighthouse run count must be an integer 1–100; malformed/partial reports now produce exit code 1 and an error in the summary; median for an even number of runs is the average of the two middle values.

Audit verification (2026-11-08): `pnpm typecheck`, `pnpm lint`, and `NEXT_DIST_DIR=.next-prod pnpm build` with separate SQLite/uploads succeeded. `pnpm test` under default parallelism timed out on existing heavy SQLite/media tests; latest `pnpm test --maxWorkers=1` passed 52 files/643 tests. Normal Playwright list has 15 tests and excludes isolated; isolated list has 1 test. The API step of real isolated E2E passed on a copy with an existing user (new account admin, block order, and staff/anon preview); the old wrapper shutdown left an orphaned process. Because sandbox denied sending signals to this trial's processes, real E2E shutdown of the latest direct-shim/gracefulShutdown fix could not be re-verified. Latest shell/isolation regression 19/19; 3100 process and `.next` preserved, nothing written to live DB. This spec is API-based; Chromium is not launched.
