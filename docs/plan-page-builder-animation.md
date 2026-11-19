# Plan — Page Builder, Balanced Animation, and Performance

## User decisions (2026-11-07)

- Separate installation for each company; no multi-tenancy.
- The logo and single accent color can be changed in the admin; contrast is checked automatically.
- On listing pages, the listing itself is also a movable block.
- Optional short, silent looping video in the hero: poster and lazy loading; disabled on mobile and when reduced motion is requested.
- Live Preview autosave is enabled by default (about 2 seconds).

> Status: DRAFT PLAN (2026-11-07). No code changes. Implementation proceeds in phases under the `takim-lideri` rules.
> Sources: `memory-bank/*`, `AGENTS.md`, `docs/implementation-plan.md`, and current code (with file:line evidence below).

## 0. Goal (user requests)

1. The site should be **performant and animated**; animation should be balanced, the site lightweight, and the design professional. A **visual QA and fix pass** will address design issues observed by the user (details to follow).
2. Content should be editable like a **general template**: headings, text, menus, hero, and so on. The home page layout should support movable **WordPress-style blocks**.

---

## 1. Current state (verified)

### 1.1 The home page is entirely hard-coded
- `src/app/(frontend)/[locale]/page.tsx:45-265`: the hero, product families, solutions, logos, case study, news, and CTA sections sit in fixed order inside JSX. Section headings and copy come from the i18n `home` dictionary (`t('title')`, `t('familiesTitle')` …, 22 keys: `src/i18n/messages/tr.json` → `home`). Only the listed records (families, solutions, case studies, news) come from the CMS.
- Hero CTA targets are fixed: `page.tsx:105,108` (`/demo-talep`, `/urunler`). The bottom CTA band is also fixed: `page.tsx:254-263`.
- The hero right panel is hard-coded as a family list (`page.tsx:112-144`). Editors cannot replace it with an image or video.
- The `pages` collection has a "home" description (`src/collections/Pages.ts:36`), but the home page never reads `pages`. There are no page records in the seed (`content/seed/*.json`: globals, families/products, solutions, support, news).

### 1.2 A block system exists, but its use is limited
- There are 10 blocks (`src/blocks/index.ts:17-28`): hero, featureGrid, mediaText, specTable, stats, logoWall, cta, faq, richText, videoEmbed. All are used via a single `layoutField()` in the `pages/products/solutions/case-studies` collections (`src/fields/common.ts:6-11`).
- Its renderer uses a switch statement; it skips any undefined block (`src/components/blocks/render-blocks.tsx:16-37`). Used in: about, legal, solution detail, case study detail, and product "extra blocks".
- Blocks **lack theme, spacing, alignment, animation, and anchor fields**. `HeroBlock` is always `theme="dark"` (`hero-block.tsx:15`) and its heading is always `h2` (`hero-block.tsx:20`). When a hero is the first block on a page, the page has no `h1`.
- The product page filters out hero, featureGrid, and specTable blocks (`urunler/[family]/[product]/page.tsx:81-82`). This single-source rule will be preserved.
- Admin labels are in English (`labels: { singular: 'Hero' }` …). There is no Payload `i18n` config (`src/payload.config.ts:56-62`). There are no block preview images (`imageURL`).
- Live Preview and draft mode do not exist: `admin.livePreview` is not defined, and `draftMode` is not used. Drafts have `autosave: false` (`common.ts:38-41`).

### 1.3 Listing and corporate page headers are fixed
- The `PageHero title={t('title')} lead={t('lead')}` pattern appears on these pages: `urunler/page.tsx:51`, `cozumler/page.tsx:44`, `haberler/page.tsx:51`, `referanslar/page.tsx:38`, `kariyer/page.tsx:38`, `is-ortaklari/page.tsx:43`. Top copy lives only in i18n; blocks cannot be added below them.
- About reads the `pages` record by slug `hakkimizda|about`, but still builds its hero from `PageHero` + i18n fallback (`sirket/hakkimizda/page.tsx:19,41`).
- There is no free-form landing page route: `pages` is only read for legal and about pages (`src/lib/content.ts:210-219`).

### 1.4 Globals are partially editable
- Header: has `navItems` (link + mega `products|solutions` + children) and a single CTA (`src/globals/Header.ts`). When the CMS is empty, an i18n fallback menu is in code (`src/components/layout/header.tsx:22-49`).
- **Logo and site name do not come from the CMS**: `Logo` is a hard-coded SVG and text placeholder (`src/components/layout/logo.tsx:3`). Header takes the site name from the `c('siteName')` i18n key (`header.tsx:58`). `SiteSettings.logo/logoDark` fields exist (`SiteSettings.ts:19-20`), but are not used in the header.
- The link field has no internal static route type: `internal` only resolves a collection `reference` (`src/fields/link.ts:58-64`). Therefore, the seed menu uses a workaround like `type: external, url: "/tr/urunler"` (`content/seed/01-globals.json`). This path is locale-dependent (`/tr` hard-coded).
- Footer: columns, legal links, and copyright are in the CMS. Fallback columns and legal links are in code (`footer.tsx:32-77`).

### 1.5 Performance and animation findings
- The `motion` dependency (`package.json:56`) is **never imported** in `src`. It is an unused dependency.
- `Reveal` is a separate client component and a separate IntersectionObserver for each card (`src/components/ui/reveal.tsx:1-26`). On the home page, as many hydrated islands as there are cards are created (`page.tsx:99,112,159,186,242`). The CSS side is correct: visible without JS, disabled under reduced-motion (`globals.css:132-141,199-202`).
- Images: `Media` has no `imageSizes` (`src/collections/Media.ts:74-76`) and all Payload images are `unoptimized` (`src/components/ui/media-image.tsx:32`, for security). Result: no srcset, WebP/AVIF, or downscaling; the original file is downloaded. This is the biggest risk for LCP.
- `src/lib/content.ts` loaders are not wrapped with React `cache()` (only `site.ts`, `support.ts`, `static-params.ts` are wrapped). `generateMetadata` and the page run the same query twice: `sirket/hakkimizda/page.tsx:24` and `:34` (`getPage`), and on the home page `page.tsx:36` and `:58` (`getContactSettings`).
- The home page fetches 200 products with full fields just to count products per family (`page.tsx:53,61-65`). This is over-fetching. The only field needed is `family`.
- Revalidation is too coarse and also triggers on drafts: on every `afterChange` call, the entire `/tr` and `/en` layouts are invalidated (`src/lib/revalidate.ts:10-12,21`). Saving a draft also purges the whole site. If autosave or live preview is added, this becomes a severe regression.
- Fonts: Geist Sans and Geist Mono are preloaded on every page (`src/app/(frontend)/[locale]/layout.tsx:2-3,55`). Mono is only used in small labels.
- Client components (17): header-shell (382 lines), language-switcher, sheet, tabs, accordion, reveal, json-ld, set-alternates, forms, portal, and analytics. Radix accordion is used for FAQ. Zero-JS `<details>` can be used instead.
- The root cause of the 60 s timeout seen during the docs page build could not be determined (`progress.md`, "404/security QA").

### 1.6 Compatible infrastructure (to preserve)
- The content import schema is derived from the Payload config; blocks are automatically included via `$defs` (`src/lib/content-import/schema.ts:28`). Block and row IDs are preserved (`importer.ts:60-75`). New blocks get automatic support. Exception: `blockReferences` (string blocks) are currently filtered out (`schema.ts:28`, `importer.ts:52,71,172`).
- MCP allows CRUD for `pages`. Find/update is open for header, footer, and site-settings.
- CSP `frame-ancestors 'self'` (`src/lib/csp.ts:15`). Same-origin admin iframe preview is compatible.

---

## 2. Target architecture

### 2.1 Page model
- **Home page = a `pages` record.** Add `homePage` (relationship → pages) to `SiteSettings`. If empty, look up slug `home`. If that is also missing, render the current hard-coded composition as a **fallback** (backward compatibility; the site works on an empty DB). Once parity is achieved, the hard-coded version is reduced to an "empty state" component in F6.
- **System page binding:** `pages.systemKey` (select, unique / locale-independent): `products | solutions | news | customers | careers | partners | support | contact | about`. The listing route reads the record via `getSystemPage(locale, key)`:
  - `hero` group (eyebrow/title/lead/media/actions) → replaces `PageHero`. If empty, the i18n fallback is used.
  - `layout` blocks → rendered **below** the dynamic list. Making the list itself movable via a `listing` block depends on open question 3.
- **Free-form landing pages:** `[locale]/[slug]/page.tsx` (single segment). Static directories and `[...notFound]` remain more specific / higher priority. **Reserved slug validation** is added to the `slug` field: TR and EN first segments in `CANONICAL_PATHS` (`urunler`, `products`, `destek`, `hesap`, `account`, `ara`, `search`, `admin`, `api` …) are rejected. A collision test against the EN rewrite table (`src/i18n/paths.ts`) is written.
- Optional `layout` is added to **ProductFamilies**. Rendered below the product grid on the family page. Products keep their existing `layout` field and filter rule.
- `template` is added to `pageType`: it is not published and stays out of the sitemap. Editors clone it via Payload "Duplicate" (see §6).

### 2.2 Block catalog
Common rules:
- Each block gets an **`appearance` group** via the `blockSettings()` factory. The group lives inside an `initCollapsed` `collapsible` (`"Görünüm"` (Appearance)):
  `theme: dark|light` (default depends on block type), `spacing: none|sm|md|lg`, `align: start|center`, `width: narrow|normal|wide`, `animation: none|subtle` (default `subtle`), `anchor` (`^[a-z0-9-]{1,40}$`; must be unique on the page, checked in `beforeValidate`).
- Admin: `labels: { singular: { tr, en } }`, field `admin.description` in TR, `imageURL` (`public/admin/blocks/<slug>.webp`, 480×300) + `imageAltText`. Block ordering uses Payload `blocks` drag-and-drop (built-in feature). If Payload 3.85 supports block grouping (`admin.group`), the groups `"Giriş / İçerik / Katalog / Kanıt / Dönüşüm / Yardımcı"` (Intro / Content / Catalog / Proof / Conversion / Utility) are used. Support is verified in the Phase 3 spike.
- Allowed set per collection: `pageBlocks` (all), `productBlocks` (no hero/productFamilies/listing), `solutionBlocks`, `familyBlocks`. **Additive changes only**: removing a block from a collection drops a table in SQLite.
- `blockReferences` (config-level shared blocks) are evaluated in the F3 spike. If table names change or the import schema (string blocks) breaks, they are **not used**. → **F3 decision: not used for now** (rationale in the F3 section).

| Block (slug) | TR label | Status | Source | Client JS |
|---|---|---|---|---|
| `hero` | `Giriş (Hero)` | extend | variant: `cinematic` (grid+glow, media/family panel on right) · `split` · `centered` · `minimal` · `mediaBackground`; media: image/video/family panel; `h1` if first block | none (small island if video) |
| `featureGrid` | `Özellik ızgarası` | extend | `style: cards|plain`, icon allowlist select (lucide names) | none |
| `productFamilies` | `Ürün aileleri vitrini` | new | auto (sortOrder) / manual selection, `showCount`, `layout: grid|list`, limit | none |
| `productShowcase` | `Ürün vitrini` | new | selected products or `featured`, `layout: cards|alternating` | none |
| `solutionsGrid` | `Çözümler` | new | auto/manual, limit | none |
| `logoWall` | `Logo duvarı` | existing | manual/caseStudies/partners | none |
| `stats` | `Rakamlar` | existing | — | none |
| `caseStudy` | `Öne çıkan vaka` | new | auto `featured` / manual selection; outcome metrics | none |
| `testimonial` | `Müşteri görüşü` | new | quote, person, role, company, logo; or case-study relation | none |
| `cta` | `Çağrı bandı` | extend | `style: band|card|split`, 1-2 actions | none |
| `richText` | `Zengin metin` | existing | — | none |
| `mediaText` | `Medya + metin` | existing | — | none |
| `media` | `Görsel / galeri` | new | single or 2-4 grid, `aspect`, caption | none |
| `videoEmbed` | `Video` | extend | poster + **facade** (iframe on click), nocookie | small island |
| `faq` | `SSS` | existing → refactor | `<details name>` instead of Radix | **none** |
| `tabs` | `Sekmeler` | new | 2-6 tabs × (richText + media) | small island |
| `newsList` | `Haber listesi` | new | latest N news posts, category filter | none |
| `specTable` | `Teknik tablo` | existing | — | none |
| `leadForm` | `Form (demo/teklif/iletişim)` | optional (P2) | `ensure-forms` fixed titles | existing form island |
| `spacer` / `divider` | `Boşluk / ayraç` | new | size, line | none |

### 2.3 Header / Footer / SiteSettings (fully editable)
- **Link field:** `type: internal|route|external`. The `route` type is a select from `CANONICAL_PATHS` keys and resolves automatically per locale. The `external + "/tr/..."` workaround in the seed is removed. `safeHref` is preserved.
- **SiteSettings:** `siteName`, `logo`, and `logoDark` are actually used in header/footer/JSON-LD. `logo.tsx` renders the CMS logo or falls back to today's SVG placeholder. Also adds `homePage`, `motion: subtle|none` (site-wide disable), and optional `brand.accent` / `brand.accentHover` (hex). The last two are output as root `style` CSS variables. Contrast validation (WCAG AA, with `accent-contrast`) runs in a hook; if it fails, the save is rejected (open question 2).
- **Header:** `navItems` (existing + `megaMenu: products|solutions|custom`; `custom` = columns + featured card), `cta` 1-2 buttons, `utility` visibilities (search/language/account), `announcement` (on/off, text, link; no-JS and non-dismissible).
- **Footer:** columns, legal links, `brandBlurb`, `showContact`, `showSocial` (from SiteSettings), copyright `{year}` and `{siteName}` placeholders.
- In-code fallbacks (header/footer menu, home page) run only when the CMS is empty. This is locked by tests.

### 2.4 CMS ↔ i18n boundary (clear rule)
> **Rule:** Any text that must change for another company belongs in the **CMS**; interface text that stays the same for every company belongs in **i18n**.

- **CMS:** hero and section headings/leads, CTA labels and targets, menu, footer, company/contact info, page header copy, SEO meta, logo, site name, brand color, announcement bar.
- **i18n (`messages/*.json`):** form labels and validation messages, button microcopy (`"Tümünü gör"`, `"Devamını oku"`, `"Kapat"`), breadcrumb `"Ana sayfa"`, aria labels, filters and pagination, portal, 404/error, empty states, date/plural patterns, product tab names.
- **Fallback:** when a CMS field is empty, the i18n default is used. The `home` dictionary remains only as a fallback/seed source at the end of F6. New marketing copy is **not added** to i18n (lint/test rule: `home.*` key count cannot increase).

### 2.5 Live Preview and drafts
- Payload `admin.livePreview`: URL function defined for `pages`, `products`, `solutions`, `case-studies`, `posts`. Breakpoints 390/768/1440.
- Route `src/app/(frontend)/api/preview/route.ts` (or `src/app/api/preview`): accepts **staff only** (admin/editor) via `payload.auth({ headers })`. Calls `draftMode().enable()`, then redirects to the localized path. A `redirect` parameter not on the same origin is rejected. `/api/preview/exit` is used to exit.
- In draft mode, page loaders use `draft: true`. Staff is re-verified on every render; otherwise it falls back to a public query. Draft mode automatically bypasses ISR.
- `@payloadcms/live-preview-react` `RefreshRouteOnSave` (RSC-compatible; no client-side block rendering needed). Mounted only in draft mode.
- **Autosave** is enabled only for `pages`, `interval ≥ 2000 ms` (SQLite write load; open question 5).
- **Revalidation rule (mandatory):** the hook runs only if `doc._status === 'published'` or `previousDoc._status === 'published'` (unpublish). Draft/autosave never purges the cache. Behavior is unchanged for non-drafted collections.

---

## 3. Data model and migration strategy

| Change | Collection/Global | Migration name (proposed) | Phase |
|---|---|---|---|
| `appearance` group on all blocks | pages/products/solutions/case-studies (+ `_v` tables) | `blocks_appearance` | F3 |
| Hero variant/media type, cta style, featureGrid style | block tables | same | F3 |
| New blocks (static) | pageBlocks etc. | `blocks_static_set` | F4 |
| New blocks (dynamic) + relation tables | pageBlocks | `blocks_dynamic_set` | F5 |
| `pages.systemKey`, `pages.hero`, `pageType: template`, SiteSettings `homePage`, families `layout` | pages, site-settings, product-families | `page_builder_pages` | F6 |
| Link `route` type, header/footer/settings fields | globals + all link usages | `globals_editable` | F7 |
| `pages` autosave | `_pages_v` (`autosave` column) | `pages_autosave` | F8 |
| `media` `imageSizes` + `focalX/Y` | media | `media_image_sizes` | F9 |

Rules:
- Continue with `push: false`. For every schema change, run `pnpm migrate:create <name>` followed by `pnpm migrate`. Types (`generate:types`) and importmap are updated in the same commit.
- **Additive changes only.** Renaming or removing fields/blocks is forbidden: Drizzle rebuilds the SQLite table via a `__new_` copy, creating a risk of data loss. Adding/removing select options on a text column is safe and verified in the migration SQL.
- For every migration, **test on a DB copy first**: `cp data/*.db $TMPDIR/softmarket-<name>.db` → point `DATABASE_URI` to the copy → `pnpm migrate` → `pnpm content:import --dry-run` → `sqlite-integrity` test. Stop if the SQL contains `DROP TABLE` (except `__new_` rebuilds) or `DELETE`.
- **Backward compatibility:** the renderer uses block-type defaults for missing `appearance`. Legacy `hero.variant: default` maps to `cinematic`. Unknown blocks are skipped (existing behavior). If no `home` record exists, the fallback home page is rendered.
- **Content import:** since the schema is generated from config, new blocks are included automatically. Required: regenerate `schema.json` (a test checks it is in sync), cover `collapsible` and the `route` link field with `flatFields`, and if `blockReferences` is used, add string block resolution to `schema.ts`/`importer.ts`. New `content/seed/05-pages.json`: `home` (block equivalent of today's home page), `about`, and system page records (`systemKey`). Convert the header seed to `route` links. Must be idempotent across two runs (0 create / N update).
- **Seed conversion (home page → blocks):** `hero(cinematic, family panel)` → `productFamilies` → `solutionsGrid(theme dark)` → `logoWall(source partners+caseStudies)` → `caseStudy(auto featured)` → `newsList(3)` → `cta(band)`. Copy is taken from existing `home.*` TR/EN values.
- **MCP:** `pages` and globals are already open. Add an agent recipe to `AGENTS.md` and the editor guide: `find` by slug → rewrite the **entire** `layout` (arrays are not partially updated; preserve block `id`s) → `_status: published`, TR and EN separately. Use `content:import` for bulk/idempotent work.

---

## 4. Rendering architecture

- **Block registry:** `src/components/blocks/registry.ts` → `{ [slug]: Component }`. A parity test verifies that every config block has a renderer.
- **`BlockShell` (server):** `<Section theme spacing id={anchor} data-anim={animation}>` + `Container width`. Blocks only produce content; theme and spacing are managed in one place. If `index===0 && blockType==='hero'`, the heading is `h1`; otherwise `h2`. Single `h1` per page is locked by test.
- **All blocks are RSC.** Client islands are only `tabs`, `videoEmbed` facade, (optional) hero video, and `leadForm`. FAQ works with `<details>` and zero JS.
- **Dynamic block data:** loaders wrapped with `cache()` in `src/lib/blocks/data.ts`. The page calls `preloadBlockData(blocks)` in the first pass so sibling blocks run in parallel with no waterfall. Each block fetches only needed fields via `select`/`populate`, `depth ≤ 1`.
  - Product count per family is fetched in a single query: `products` `select: { family: true }`, `depth: 0`, `pagination: false`. No N+1.
- **All loaders in `content.ts` are wrapped with `cache()`.** Metadata and page share the same query.
- **ISR:** 3600 s and on-demand preserved. Draft bypass rule added (§2.5). Tag-based fine-grained revalidation is evaluated **after measurement**: layout invalidation is considered sufficient for a small site.
- **Images:**
  - `Media.upload.imageSizes`: `thumb 400`, `card 768`, `hero 1280`, `wide 1920` (width, no upscaling; Payload's default skips targets larger than source). `formatOptions: webp q74`, `focalPoint: true`, `crop: true`, `adminThumbnail: 'thumb'`.
  - `MediaImage` generates `srcSet` and accurate `sizes` from the size URLs. Native `img` bypasses the optimizer (protected bytes never enter the optimizer cache). Every size goes through the same `/api/media/file` access rule; verified by test.
  - LCP: `priority` + `fetchPriority="high"` only on the first hero image. Other images get `loading="lazy"`. `width/height` always provided (CLS).
  - AVIF is added only if measurement shows meaningful gain on hero (extra storage and sharp time).
  - `pnpm media:regenerate` script for existing media: reprocesses the file while preserving identity and `seedPath`.
- **Video:** facade for third-party video (poster + play button; iframe on click). Self-hosted hero video loads only when `prefers-reduced-motion: no-preference`, `!saveData`, and ≥768px: `muted playsinline loop preload="none"` + poster. On mobile, only the poster is shown.
- **Fonts:** Geist Sans (variable, single woff2) is preloaded. Geist Mono is **not preloaded** (`next/font/local`, `preload: false`) or falls back to system mono. `display: swap` and `adjustFontFallback`.
- **Dependency:** `motion` is removed. If a block truly needs it in the future, it is lazy-loaded via `import()` only inside that island.

---

## 5. Animation system (CSS-first, balanced)

**Tokens (`globals.css` `@theme`):** `--dur-fast: 150ms` (hover/focus), `--dur-base: 240ms` (menu/tab), `--dur-reveal: 560ms`, `--ease-out-soft` (existing, `globals.css:103`), `--ease-standard: cubic-bezier(.2,0,0,1)`, `--reveal-distance: 12px`, `--stagger: 60ms` (at most 4 items, total ≤ 240 ms).

**Rules:**
1. Only `transform` and `opacity` are animated. Color/border-color transitions on hover (`--dur-fast`) are allowed. Layout properties (width/height/top/margin), `filter: blur` on large areas, `box-shadow`, and `backdrop-filter` animations are forbidden. If a shadow effect is needed, use pseudo-element `opacity`.
2. **Content visible without JS:** hidden state is applied only when JS sets `data-anim-state="pending"` on off-screen elements (today's logic, `reveal.tsx:14`).
3. **Single observer:** instead of a client `Reveal` per block, the server outputs `data-anim="subtle"` and per-item `style="--i:n"`. A **single** `<MotionObserver />` client component (~1 KB) is added to the layout. It observes `[data-anim]` elements with a single `IntersectionObserver`, re-scans on route changes, and unobserves an element once revealed. `Reveal` is removed.
4. `prefers-reduced-motion: reduce` → CSS transitions are zeroed out (existing) and the observer never runs. `SiteSettings.motion = none` → same effect via `<html data-motion="none">`. Block `animation: none` → `data-anim` is not output.
5. **Hero micro-animations (no JS, CSS keyframes):** 400–560 ms fade-up with 80 ms stagger for eyebrow, lead, actions, and media frame. **The LCP candidate (hero heading or hero image) does not start at opacity 0.** Only `translateY(8px)→0` is applied or no animation at all, because starting at opacity 0 delays LCP.
6. Decorative glow/grid stays static. Optional slow gradient drift runs only with `transform`, while in viewport, and with reduced-motion off. Default is off.
7. Card hover: `translateY(-2px)` + border color. Image `scale(1.03)` 500 ms (existing). Mega menu `mega-in` 160 ms (existing).
8. **No** number counters or parallax (weight and INP risk).

---

## 6. Editor experience

- Admin language: Payload `i18n.supportedLanguages: { tr, en }`, default `tr`. All collection, global, block, and field labels use `{ tr, en }`. Descriptions are short and written in "what it does / where it appears" style.
- Defaults: hero `theme: dark`, other blocks `light`, `spacing: lg`, `animation: subtle`. New pages get a `[hero(minimal)]` starter block via `defaultValue`.
- Block preview images: a noindex "Block gallery" template page (seed, `pageType: template`) is screenshotted with Playwright at 480×300 → `public/admin/blocks/*.webp`. Images can be regenerated (`pnpm admin:block-previews`).
- **Starting from an empty template** (new company):
  1. `content/templates/starter/` (globals: neutral site name/color/menu; `home`, `about`, system pages; sample images `protected:false`).
  2. `pnpm content:import content/templates/starter` (idempotent). Then in admin, enter logo, name, and color under `Site Ayarları` (Site Settings).
  3. Template pages (`pageType: template`) are turned into new landing pages via "Duplicate".
  4. Existing demo content (`content/seed`) is separate from this flow. There is **no** delete command (destructive actions only with user confirmation).
- **`docs/editor-guide.md`** (TR): block catalog (with screenshots), ordering and drag-and-drop, theme/anchor/animation, Live Preview, draft → publish, menu/footer/logo/color, image upload rules (size ≥ 2400 px, alt text required, `protected` off), SEO fields, bulk updates via MCP/JSON, and common mistakes.

---

## 7. Performance budget and audit

**Budget (mobile, Lighthouse default throttling, prod build):**

| Metric | Target |
|---|---|
| LCP | < 2.0 s (`/tr`, `/en`, catalog, product, solution, doc detail) |
| CLS | < 0.05 |
| INP | < 200 ms (TBT < 150 ms proxy in lab) |
| Lighthouse | Performance ≥ 90 · A11y/SEO/Best Practices ≥ 95 |
| Home page first-load JS (gzip) | ≤ 130 KB total, page-specific chunk ≤ 15 KB |
| CSS (gzip) | ≤ 30 KB |
| Hero image (mobile) | ≤ 180 KB · font preload ≤ 1 file / ≤ 60 KB |
| TTFB | ISR HIT < 50 ms · MISS < 400 ms (local prod) |
| DB query count / request | home page ≤ 12 · product ≤ 15 · per-list-item query = 0 |

**Measurement method:**
- `NEXT_DIST_DIR=.next-prod pnpm build` → `next start -p 3200` (3100 dev is untouched) → `@lhci/cli autorun` (3 runs, median; `lighthouserc.json` budgets). Results are stored under `docs/perf/`.
- Playwright `tests/perf/vitals.spec.ts`: 390×844, CDP CPU throttle ×4. LCP/CLS measured with `PerformanceObserver`; menu/tab/FAQ interactions used for INP. No transform under `reducedMotion: 'reduce'` emulation.
- Bundle: `@next/bundle-analyzer` (`ANALYZE=1`) and `next build` "First Load JS" output. Test fails if budget is exceeded.
- DB: adapter logger with `DB_QUERY_LOG=1` flag, per-request counter via AsyncLocalStorage. Report shows page → query count and duplicate queries.
- ISR verification: `curl -sI` to check `x-nextjs-cache` HIT/STALE. Publish → next request MISS then HIT. **Must remain HIT after a draft save.**
- **Docs build timeout root-cause investigation.** Hypotheses, in order of likelihood:
  - (a) un-deduped loaders and double metadata+page loading;
  - (b) concurrent Payload init across build workers (SQLite open, plugin init, search sync);
  - (c) write lock or WAL checkpoint held on the same SQLite DB by a running dev server (busy timeout 5000);
  - (d) large Lexical content conversion and heading extraction;
  - (e) `getDocTree` field selection.

  Method: per-page and `generateStaticParams` timing flag, dev on/off × `experimental.cpus=1/default` matrix, 5 consecutive builds. Acceptance: root cause documented and fixed, 5/5 builds pass without timeout, build duration recorded.

---

## 8. Phases

Each phase can be committed separately, comes with its own tests, and no commit is made unless the user requests it. Phases with schema changes carry migration + types + importmap + `schema.json` in the **same** change. Common gates: `pnpm typecheck && pnpm lint && pnpm test` and `NEXT_DIST_DIR=.next-prod pnpm build`.

Dependency: `F0 → (F1 ∥ F2 ∥ F9) → F3 → (F4 ∥ F5 ∥ F7) → F6 → F8 → F10 → F11`. G (visual fixes) can happen at any time after F0.

### F0 — Measurement baseline + visual QA pass 1 (no code behavior changes)
- **Scope:** Lighthouse/LHCI baseline, bundle report, DB query counter flag, ISR verification script, docs timeout investigation (§7). 390/768/1440 screenshot matrix of all public pages → `docs/qa/visual-baseline.md` (bug list; the user's list is added here).
- **Files:** `lighthouserc.json`, `tests/perf/*`, `scripts/perf-*.ts`, `src/lib/db-query-log.ts` (flagged), `docs/perf/baseline.md`.
- **Acceptance:** baseline table filled, root cause report for timeout (fix in F1), zero behavior difference when flag is off.
- **Tests:** counter unit test, perf spec execution (on permitted host; MachPort limitation noted).
- **Risk:** Chromium macOS sandbox (known). Mitigation: permitted host or user machine.

### F1 — Quick performance wins (no schema)
- **Scope:** `cache()` for `content.ts`, single lightweight query for home page family count, draft-skipping revalidation, disable Mono preload, remove `motion` dependency, FAQ `<details>`, F0 timeout fix.
- **Files:** `src/lib/content.ts`, `src/lib/revalidate.ts`, `[locale]/page.tsx`, `[locale]/layout.tsx`, `components/blocks/faq-block.tsx`, `package.json`.
- **Acceptance:** query count lower than baseline, no double metadata+page query, draft save does not bust cache, first-load JS reduced by ≥ 5 KB, 5/5 builds.
- **Tests:** revalidate (published/draft/unpublish), FAQ no-JS keyboard/accessibility, existing 345 tests.
- **Risk:** `cache()` is per-request only; CLI and import paths are unaffected (verified by test).

### F2 — Animation system
- **Scope:** tokens, `data-anim` + single `MotionObserver`, hero CSS micro-animations (LCP rule), hover standard, `SiteSettings.motion` reading (field in F7; for now `html[data-motion]` support only), remove `Reveal`.
- **Files:** `src/app/(frontend)/globals.css`, `components/ui/motion-observer.tsx`, `components/ui/reveal.tsx` (deleted), `Reveal` usages in home page and block components.
- **Acceptance:** fewer client islands (single observer), all content visible without JS and under reduced-motion, CLS < 0.05, no LCP regression.
- **Tests:** vitest (no hidden state in SSR, `data-anim=none`), Playwright reduced-motion + JS-disabled visibility, CLS measurement.
- **Risk:** re-scanning on client navigation → `usePathname` dependency and no MutationObserver (intentional choice).

### F3 — Block core + data model (schema)
- **Scope:** `blockSettings()`/`appearance`, `BlockShell`, registry, hero `h1` rule, hero variants, cta/featureGrid extensions, admin `i18n` + TR labels (core blocks), `imageURL` placeholders, `blockReferences` spike decision, migration `blocks_appearance`.
- **Files:** `src/blocks/*`, `src/fields/block-settings.ts`, `src/components/blocks/{registry,block-shell}.tsx`, `render-blocks.tsx`, `src/payload.config.ts`, `src/migrations/*`, `src/payload-types.ts`, `content/seed/schema.json`.
- **Acceptance:** all existing pages visually identical (screenshot diff ≈ 0), legacy data renders with defaults, migration clean on DB copy, import dry-run 0 errors.
- **Tests:** config↔registry parity, anchor uniqueness, single `h1`, schema sync, `sqlite-integrity`, rendering with legacy block data.
- **Risk:** block table/column changes also affect `_v` tables. Mitigation: SQL review and DB copy.
- [x] **Implemented (2026-11-07).** Migration `20261107_110012_blocks_appearance`: `ADD COLUMN` only across 80 block tables (4 collections + `_v`) (560 statements; no `DROP TABLE`/`DELETE`/`__new_`), column defaults = legacy appearance. DB copy → migrate → import dry-run 0 errors → live DB; import twice 0 create/88 update.
  - `src/fields/block-settings.ts`: `blockSettings(slug)` (`"Görünüm"` (Appearance) collapsible → `appearance` group: `theme auto|dark|light`, `spacing none|sm|md|lg`, `align start|center`, `width narrow|normal|wide` (except richText; has its own `width` field), `animation subtle|none`, `anchor` (regex + reserved id + per-page uniqueness validation), `hidden`). `BLOCK_DEFAULTS` + `resolveAppearance()` single source for config and renderer; `theme: auto` resolves to block default (style on CTA).
  - `BlockShell` (theme/spacing/tone/container/anchor id + `scroll-mt`, `data-anim` **on container**; section background does not fade), `registry.ts` (mapped type: missing renderer = type error), `lib/blocks/render-plan.ts` (hidden/unknown skipped, single h1, duplicate anchor dropped from HTML). `RenderBlocks firstHeroH1` is enabled only when the page has no own h1 (F6 CMS pages); on pages with PageHero all heroes are h2.
  - Hero variants: `default` (= cinematic; value name preserved to avoid rename/table rebuild), `split`, `centered`, `minimal`. `mediaBackground` + video in F4. CTA `split` style; featureGrid `style: cards|plain` + icon allowlist select (`src/lib/icon-names.ts`, legacy text values normalized).
  - Admin `i18n` (`payload/i18n/tr|en`, default TR), TR/EN labels for core 10 blocks + link field, `admin.group` (supported in 3.85: `Giriş/İçerik/Katalog/Kanıt/Dönüşüm/Yardımcı`), `imageURL` placeholders `public/admin/blocks/*.webp` (`node scripts/admin-block-placeholders.mjs`).
  - **`blockReferences` decision: not used (F3).** In 3.85, type comment says "`@todo` merge with `blocks` in 4.0" (API not stable); content-import schema/importer skips string blocks (would need extra resolver); gain (admin client config duplication) is small for 4 collections × 10 blocks. SQLite table name in both paths is `<root>_blocks_<slug>` (drizzle `traverseFields`), so future migration is zero-migration: revisit in F10/4.0 if block count/admin bundle measurement requires it.
  - Verification: typecheck/lint/34 files 398 tests (new: `blocks-core.test.tsx`, `blocks-appearance-migration.test.ts`), `.next-prod` build, 3200 1440/390 screenshots: exact height match on 7 pages, pixel diff dev↔dev ≤ 0.021%.

### F4 — Static new blocks
- **Scope:** `media`, `testimonial`, `tabs` (island), `videoEmbed` facade, `spacer`/`divider`, hero `mediaBackground` + optional video. Migration `blocks_static_set`.
- **Acceptance:** each block visually correct across dark/light × 390/1440, tabs keyboard (arrow keys/ARIA) working, video iframe not loaded before click.
- **Tests:** block render unit tests, Playwright keyboard + network (no iframe request) check.
- **Risk:** CSP video permissions (existing allowlist) and facade poster CLS.
- [x] **Implemented (2026-11-07).** Migration `20261107_111754_blocks_static_set`: only `CREATE TABLE` (96) + `CREATE INDEX` and 8 `ALTER TABLE ... ADD video_id` (hero, 4 collections + `_v`); no `DROP`/`DELETE FROM`/`__new_` in up (rebuild only in `down`). DB copy → migrate → import dry-run 0 errors → live DB.
  - New blocks (added to `layout` of all 4 collections): `media` (1–4 images, caption, `aspect` auto|16-9|4-3|1-1|21-9), `testimonial`, `tabs` (2–6 tabs × richText + optional image), `spacer` (`size`), `divider` (`style` line|accent). `videoEmbed` already existed: no schema change, converted to facade. Hero: added `mediaBackground` to `variant` options (existing values/default unchanged) + `video` upload (visible only on mediaBackground).
  - All have `blockMeta` + `blockSettings` + `BLOCK_DEFAULTS` + registry + `public/admin/blocks/*.webp` placeholder. Client islands: `tabs-island` (WAI-ARIA tablist, arrow/Home/End, automatic activation; all panels in SSR, `hidden` except first panel → first tab visible without JS), `video-facade` (poster + play; iframe only on click, `youtube-nocookie` / Vimeo `dnt=1`, compatible with existing CSP `frame-src`), `hero-video` (empty in SSR; mounts `<video muted loop playsinline>` when ≥768px + reduced-motion off + saveData off + `data-motion≠none`, pauses off-screen). Pure logic in `src/lib/blocks/static.ts`.
  - Hero `mediaBackground`: poster = `media` (server `<img>` + preload, LCP), video on top. No video request on mobile/reduced-motion.
  - Verification: typecheck/lint/36 files 420 tests; `.next-prod` build; temporary `qa-blocks` on 3200 (legal route `/tr/yasal/qa-blocks`, deleted afterwards): CLS 0 (390/1440), 0 video requests at 390, 0 at 1440 reduced-motion, video plays at 1440; 0 requests to provider before click, nocookie iframe on click; tabs keyboard (Right/End/wrap/Left/Home) and JS-disabled verified. Screenshots `scratchpad/f4/shots`.

### F5 — Dynamic (data-bound) blocks
- **Scope:** `productFamilies`, `productShowcase`, `solutionsGrid`, `caseStudy`, `newsList`, `logoWall` source improvements; `src/lib/blocks/data.ts` (`cache`, `select`, preload). Migration `blocks_dynamic_set`.
- **Acceptance:** fixed query count per block (no N+1), unpublished records never appear (anon pattern), block hides silently on empty source.
- **Tests:** N+1 test with query counter, draft and hidden record leak test, import relation resolution (TR slug).
- **Risk:** relation depth and populate bloat. Mitigation: `populate` allowlist.
- [x] **Implemented (2026-11-07).** Migration `20261107_130000_blocks_dynamic_set`: 80 `CREATE TABLE` (5 blocks × 4 collections × normal/`_v` × main+`_locales`) + indexes + 8 `ADD COLUMN` for logoWall `limit`; no `DROP`/`DELETE`/`__new_` in up, down drops only its own tables and `limit` column. DB copy → migrate → dry-run 0 errors → backup (`scratchpad/softmarket-pre-f5.db*`) → live DB.
  - Blocks: `productFamilies`, `productShowcase`, `solutionsGrid`, `caseStudy`, `newsList` (appended to layoutBlocks); shared fields `src/blocks/list-fields.ts`: eyebrow/heading/description, `source`, `limit` (1–24), `sort` (order|newest|oldest|manual), `layout` (grid-3|grid-2|grid-4|list; showcase adds `alternating`), `showViewAll/viewAllLabel/viewAllUrl`. Manual selection relations use `maxDepth: 0` (page query does not populate). logoWall: new sources `allPartners|allCaseStudies|partnersAndCaseStudies` + `limit`; legacy values unchanged.
  - `src/lib/blocks/data.ts`: `cache()` + primitive key, anonymous (`overrideAccess:false`, `draft:false`), `pagination:false`, select/populate allowlist, depth 1; `preloadBlockData` inside `RenderBlocks`. Empty source → empty without querying, block not rendered.
  - Note: on 15+ char slugs, `enum_..._appearance_animation` exceeded 63 chars; added `enumName` function to `blockSettings` animation select (drizzle schema only, no SQLite impact). Do NOT use block `dbName` (table name becomes root-independent and collides across 4 collections).
  - Query count (per loader, independent of record count): families 4, products 4, solutions 3, posts 3, logos 4, caseStudy 1. 3200 prod: page with 9 data blocks = 29 queries total.
  - Tests: typecheck/lint/38 files 457 tests (new `blocks-dynamic.test.tsx`, `blocks-dynamic-db.test.tsx`, content-import F5 relation test). Screenshots `scratchpad/f5/qa-{390,1440}-{dark,light}.png`; temporary `qa-dynamic` page and QA records deleted.

### F6 — Home page and system pages to CMS
- **Scope:** `SiteSettings.homePage`, `pages.systemKey` + `hero` group, `pageType: template`, `layout` on families, `[locale]/[slug]` landing route + reserved slug validation, CMS hero + bottom blocks on listing pages, `content/seed/05-pages.json` (1:1 block equivalent of today's home page), reducing hard-coded home page to fallback. Migration `page_builder_pages`.
- **Acceptance:** after seed, `/tr` and `/en` are visually equivalent to today. Changing block order in admin (after publish) changes home page order. Listing page headings come from CMS, falling back to i18n when empty. Sitemap and hreflang cover landing pages. Template pages are not public.
- **Tests:** reserved slug and EN rewrite collision, home resolution order (`homePage` → slug `home` → fallback), Playwright: reorder blocks via API → publish → order changed, import idempotent (2nd run 0 create).
- **Risk:** `[slug]` vs `[...notFound]` and rewrite priority; language switcher with locale-specific slugs.
- [x] **Implemented (2026-11-07).** Migration `20261107_144850_page_builder_pages`: up has only 66 `CREATE TABLE` (pages `listing` block + `_v`, `pages_hero_actions` + `_v`, product-family `layout` block tables + `product_families_rels`), 154 indexes, and 185 `ADD COLUMN` (160 × `appearance_separator`, hero `aside`/`panel_title` 8+8, pages `system_key` + hero texts + `_v`, `site_settings.home_page_id`) + `site_settings_home_page_delete` trigger (ALTER ADD FK cannot carry `ON DELETE SET NULL`; clears setting when page is deleted). Generated `down()` rebuilt `site_settings` with `__new_` → manual: drops only F6 objects (F7 pattern); locked by test. DB copy → migrate → dry-run 0 errors → 3200 verification → backup `scratchpad/softmarket-pre-f6.db*` (+ `.snapshot.db`) → live DB; import 2× (10 create → 0 create/98 update).
  - Page model (`src/lib/system-pages.ts` single source): `pages.systemKey` (`products|solutions|news|customers|careers|partners|support|contact|about`, unique, cleared on duplicate) + `hero` group (eyebrow/title/lead/actions ≤2; visible only on system pages), `pageType: template` (NULL-safely excluded from anonymous read access; no route/sitemap/search), `SiteSettings.homePage` (filters out legal/template/system pages), `layout` on families (below product list). Home resolution `getHomePage`: single anonymous query for homePage ID → slug `home` → `null` = `components/home/fallback-home.tsx` (legacy composition, 1:1). `/home` and homePage's own slug 308 to `/`.
  - Listing itself as a movable block: new `listing` block (`pages` only; no fields, has appearance settings). `SystemBody`: legacy layout if no record; if record has no `listing`, list appears right below hero; if present, at block's position; hidden block = no list. 9 routes use `SystemHero` (CMS → i18n fallback; SEO meta → hero → i18n); partners CTA band only when no record exists (`cta` block in seed).
  - Landing: `[locale]/[slug]` (ISR 3600 + static params from sitemap). Reserved slug = all `CANONICAL_PATHS` first segments + `SEGMENTS_EN` keys/values + admin/api/arama/tr/en/_next/metadata paths; rejects save only on standard/landing pages without systemKey, and route also re-checks. `/[slug]` was NOT added to next-intl `pathnames` (EN rewrites unaffected); only new `slug` key added to `LINK_ROUTES`. `referencePath` uses `pagePath()` for pages (legal/system/home/landing, no template). Sitemap + hreflang cover landing pages.
  - Home page 1:1: hero `aside: families` (legacy family panel) + cinematic pageTop padding/lead/button spacing and arrow on secondary button; new appearance field `separator` (`none|top`, thin top line); ListFrame `mt-14`; CTA `banner` spacing matched to CtaBand (CTA band on product pages +8 px). Seed `content/seed/05-pages.json` (home + 9 system pages, `route` links), `01-globals.json` `homePage: "home"`.
  - Revalidate fix: `revalidatePath('/tr'|'/en', 'layout')` never matched Next's derived tags (`/layout`, `/(frontend)/[locale]/layout`, URL path) → `revalidatePath('/', 'layout')` (same draft-safe rule). Sitemap `force-dynamic` (Next 15.4 file ISR cache ignores tag invalidation on route handlers).
  - Verification: `.next-prod` + 3200 (DB copy): /tr, /en, and 9 system pages 390/1440 before(dev)/after exact height match, 0% pixel diff (no threshold); block order changed via API → publish → changed on 3200 → reverted; listing title from CMS / from i18n when empty; landing TR/EN 200 + hreflang + sitemap, reserved slug 400, template 404 and absent from anonymous API; draft home page hidden from anonymous. Queries: /tr MISS 20, HIT 0. typecheck/lint/44 files 536 tests.

### F7 — Full globals editability
- **Scope:** link `route` type (all link usages), header logo/site name/announcement/utility/custom mega/multi CTA, footer blurb/contact/social/placeholders, SiteSettings `motion` + `brand.accent` (contrast hook), converting seed menu to `route`. Migration `globals_editable`.
- **Acceptance:** logo and site name come from CMS, no hard-coded `/tr` in seed menu, EN menu routes to right paths, low-contrast color rejected.
- **Tests:** route resolution TR/EN, contrast validation, header/footer CMS-empty fallback test, MCP global update.
- **Risk:** link field is used in many tables and migration is wide. Mitigation: additive only.
- [x] **Implemented (2026-11-07).** Migration `20261107_141523_globals_editable`: up has only 6 `CREATE TABLE` (+11 indexes) and 91 `ADD COLUMN` (link `route`/`route_param` 24 block action tables + header/footer link tables; new header/footer/site-settings fields). Generated `down()` rebuilt `header_nav_items` and `site_settings` with `__new_` (`PRAGMA foreign_keys=OFF` ineffective inside transaction → would cascade-delete locales/children/social); manual `down()` drops only F7 objects and is locked by test. DB copy → migrate → dry-run 0 errors → backup (`scratchpad/softmarket-pre-f7.db*`) → live DB. Import 2× 0 create/88 update.
  - Link: added `route` to `type` radio (internal/external/default unchanged). `route` select values are stable keys (`urunler`, `destek_surum-notlari`, `yasal_slug`…; not paths, GraphQL enum compatibility), labels TR path/EN path; `CANONICAL_PATHS` with at most one dynamic segment (excluding token/ID portal pages) + `routeParam` (slug regex). `linkTarget()` produces TR canonical path, `AppLink/localizedHref` translates to EN. Header/footer/hero/CTA/mediaText share `linkField` → all support it; legacy internal/external data renders as before.
  - Header: `megaMenu: custom` (+ `columns` ≤4 × links + `featured` card: title/description/public image/link), `cta.secondary`, `announcement` (enabled/text/link/dismissible; in normal flow above header, `announcement-bar` island only handles dismiss + localStorage, id = text+link hash), `utility` (≤4 small links, desktop top bar + mobile menu; `showSearch/showLanguage/showAccount`). Footer: `brandBlurb`, `showContact`, `showSocial`, copyright `{year}`/`{siteName}`.
  - SiteSettings: `favicon`, "Marka ve hareket" (Brand and motion) tab `brand.accent` + `motion` (subtle|none → `html[data-motion]`). Logo/logoDark/site name in header/footer/metadata/OG/JSON-LD (public only, image MIME; never protected media). Icons moved `src/app` → `public/` (file-based app icons overrode CMS favicon); admin `meta.icons`.
  - Contrast rule (`src/lib/brand.ts`): entered color must pass as-is in at least one theme (text on background+surface and own button text white/#0b0d10 ≥4.5:1); the other theme's shade is derived with the same hue by shifting HSL lightness, hover ±8% satisfying the same rule. Mid-luminance band failing in both themes (e.g. #e11d48, #d9480f) and non-hex values are rejected by field `validate` (admin/REST/Local API/MCP). Layout writes `<html style>` `--brand-{dark,light}-accent(-hover|-contrast)`; `globals.css` uses `var(--brand-…, default)`. Empty = legacy palette.
  - Placeholder cleanup: `publicText()` treats `[BÜYÜK HARF]` (UPPERCASE) patterns as empty → contact/footer/JSON-LD line is hidden. Seed: menu/footer/product CTAs use `route` (no `/tr`/`/en` or `mailto:[COMPANY EMAIL]` in seed), siteName TR/EN `SoftMarket`, neutral contact (Istanbul, +90 212 000 00 00, weekdays 09–18; email intentionally empty → notifications never go to a wrong address).
  - Tests: `globals-editable.test.tsx` (route TR/EN, contrast accept/reject/format, CMS-empty fallback, legacy link, placeholder, MCP permission), `globals-editable-db.test.ts` (real SQLite: update + reject via MCP API key path), `globals-editable-migration.test.ts`. 42 files/516 tests, `.next-prod` build, 3200 Playwright 390/1440 (`scratchpad/f7/shots`), temporary accent change verified via Local API and reverted.

### F8 — Live Preview + draft mode
- **Scope:** `admin.livePreview`, preview/exit routes (staff auth, open-redirect protection), draft loaders, `RefreshRouteOnSave`, `pages` autosave. Migration `pages_autosave`.
- **Acceptance:** iframe refreshes within ≤ 2 s when editor saves, anonymous users cannot see drafts (staff check even if cookie is stolen), drafts do not corrupt ISR.
- **Tests:** preview route anon/customer/editor, `redirect` validation, draft leak, revalidate skip, Playwright admin iframe flow.
- **Risk:** security (draft leak). Therefore QA runs at highest effort.
- [x] **Implemented (2026-11-07).** Migration `20261107_190342_pages_autosave`: up is only `ALTER TABLE _pages_v ADD autosave` + index (no DROP/DELETE/`__new_`); down drops only index + column (no table rebuild), locked by test. DB copy → migrate → dry-run 0 errors → backup `scratchpad/softmarket-pre-f8.db*` (+ `.snapshot.db`) → live DB. New dependency `@payloadcms/live-preview-react@3.85.1`.
  - Security model: `GET /api/preview?redirect=/<tr|en>/...` (`src/lib/preview-route.ts`) calls `draftMode().enable()` only for staff (users, admin/editor) verified by `payload.auth`; no shared secret token (never sufficient alone). Order: `Sec-Fetch-Site` cross-site/same-site 403 → invalid redirect 400 → no session 401 → customer (portal cookie, customer JWT in `payload-token`, `Authorization: JWT`) 403; no draft cookie written in any of these. Redirect allowlist (`safePreviewRedirect`): only `/tr|/en` + slug-shaped segments; `%` (encoded `/`, `\`, CRLF), `//`, `\`, scheme, dot segment, query/hash rejected; Location is relative. `GET /api/exit-preview` always disables draft mode (same validation, default `/tr`).
  - Draft reading: `src/lib/preview.ts` `getPreviewUser` (per-request `cache`) = draft mode on **and** live staff session on the request (`payload.auth` on every render); otherwise `null` (fail-closed, Next internal errors via `unstable_rethrow`). `readAs(locale)` → if staff, `draft: true` + `overrideAccess: false` + staff user; otherwise anonymous published read. Singular document loaders only: `getHomePage`, `getSystemPage`, `getLandingPage`, `getPage` (legal/about), `getFamily`, `getProductDetail` (product query), `getSolution`, `getCaseStudy`, `getPost`; list/related queries (releases, downloads, block lists) stay anonymous. Stolen draft cookie alone, customer session, demoted/revoked staff → published content.
  - Cache: no ISR key in Next draft mode (per-request render, not written to ISR) and `Cache-Control: private, no-cache, no-store…`; middleware also adds `private, no-store` to every request with `__prerender_bypass` cookie. Removed `dynamic = 'error'` from home page (forbade `headers()` even in draft mode; page is still SSG ●). Unit test: no frontend route may use `dynamic = 'error'|'force-static'`. Autosave/draft writes to `_pages_v`, revalidate rule (F1/F6) unchanged: only publish/unpublish refreshes cache.
  - Admin: `admin.livePreview` (`src/lib/preview-url.ts`): `pages, products, product-families, solutions, case-studies, posts`; breakpoints 390×844 / 768×1024 / 1440×900. URL = `<origin>/api/preview?redirect=<localizedHref>`; pages: homePage ID or slug `home` → `/`, system/legal/landing `pagePath`, template → no preview; product looks up family slug. Origin: public `NEXT_PUBLIC_SERVER_URL` if set, locally (loopback) the loopback host of the admin request (3100/3200 previews itself; spoofed Host ignored). `pages` autosave `interval: 2000` (other drafted collections manual draft).
  - Client island `components/preview/live-preview-refresh.tsx`: added to layout only on staff draft render; `RefreshRouteOnSave` `serverURL = window.location.origin` (only same-origin `payload-document-event` → `router.refresh()`); when opened outside iframe, shows `"Önizlemeden çık"` (Exit preview) badge (`common.exitPreview`). Cloudflare beacon not loaded in draft mode. CSP unchanged (`frame-ancestors 'self'`, admin `frame-src 'self'` already allows same-origin iframe).
  - Verification (`.next-prod` + 3200, DB copy, temporary admin/editor/customer only on copy): anonymous 401, customer 3 variants 403, fake JWT 401, cross-site 403, 10 redirect vectors 400, none with `__prerender_bypass`; editor 307 + cookie. /tr, news, solution, product, draft-only case study and landing: editor+draft sees draft (`private, no-store`), draft cookie alone/customer+draft/editor without draft sees published; afterwards anonymous still sees published + `x-nextjs-cache: HIT`; draft-only pages 404 for anonymous. Publish → MISS + new content (reverted). Playwright: editor opens home page in admin → Live Preview iframe (`/api/preview?redirect=%2Ftr`) → hero heading edited → autosave 2061 ms → iframe updated 92 ms later; simultaneously anonymous visitor saw published; mobile breakpoint 390×844; posts EN → `/en/news/...`. Screenshots `scratchpad/f8/shots`. Tests: `live-preview.test.ts` (43: redirect vectors, target paths, origin, config, message contract, middleware, route config) + `live-preview-db.test.ts` (6: migration, gate anon/customer/editor/admin, exit, draft leak, role/session revocation, autosave revalidate skip, single autosave version); 46 files/585 tests.

### F9 — Image pipeline (independent after F1)
- **Scope:** `imageSizes` + webp + focal point, `MediaImage` srcset/sizes, hero `priority`/`fetchPriority`, `media:regenerate`. Migration `media_image_sizes`.
- **Acceptance:** mobile hero ≤ 180 KB, `sizes` selected accurately, protected size URLs return 404/403 to unauthorized users, LCP target met.
- **Tests:** srcset generation, size URL access tests (anon/customer/staff), regenerate idempotent.
- **Risk:** disk usage (~4×) and sharp time. Mitigation: `withoutEnlargement` and skipping unnecessary sizes.
- [x] **Implemented (2026-11-07).** `20261107_192347_media_image_sizes`: up 24 ADD COLUMN + 4 indexes; down only its own indexes/columns, no rebuild. DB copy → transaction down/up data-preservation test → live DB/WAL/SHM + snapshot backup → live migration. Native MediaImage: responsive srcset/sizes + CLS dimensions, lazy default, hero eager/high + responsive preload, focal CSS; all img consumers on shared component. `mediaRead` binds original and size filenames to the same record and existing license filter. `media:regenerate` idempotent; 3 → 0 operations on copy.
  - Security: 45 production HTTP file/role checks, protected/licensed anon/customer 404, staff 200; all private/no-store. Valid license and revocation tested against real handler/SQLite. F8 staff+draft sees protected srcset; anon/customer/draft cookie alone sees only published/public.
  - Verification: typecheck/lint, 47 files/591 tests, `.next-prod` production build and 3200 smoke passed. Mobile fixture 1.24/23.28/171.17 KB for 390px/DPR 1–3 (quality 74); calculated from HTML contract rather than real browser candidate selection. **LCP/CLS regression measurement open:** Chromium MachPort 1100, Lighthouse debugging port, and browser host access block. LCP acceptance is not considered verified without a new measurement. Details: `docs/perf/f9-media-pipeline.md`.

### F10 — Editor experience
- **Scope:** all admin labels and descriptions in TR/EN, block gallery page + preview images, `content/templates/starter`, `docs/editor-guide.md`, page builder/MCP recipe in `AGENTS.md`.
- **Acceptance:** no English labels left in TR admin (test: config scanner), starter import produces a working site on empty DB, guide covers every block.
- **Tests:** label scanner unit test, starter import (isolated SQLite).
- **Code portion implemented (2026-11-07):** [x] TR/EN labels (`src/lib/admin-i18n.ts` dictionary; no schema change, `migrate:create` "No schema changes"), [x] `tests/unit/admin-labels.test.ts`, [x] `content/templates/starter` + `tests/unit/starter-template-db.test.ts`, [x] 21/21 block preview images (wireframe; real screenshot refresh can wait for F11), [x] AGENTS.md starter section. Note: Live Preview breakpoint `label` is rendered as a React child in Payload so an `{tr,en}` object would crash; kept as `"Mobil / Mobile"` string. `docs/editor-guide.md` in a separate agent.

### F11 — Visual QA pass 2 + perf acceptance
- **Scope:** repeat F0 matrix, close user bug list, budget gates, e2e (catalog → quote, language, block order, preview).
- **Acceptance:** entire §7 budget green, `docs/qa/visual-baseline.md` items closed.
- **Implemented (2026-11-07), acceptance NOT MET:** [x] 432-screenshot pass 2 + `visual-baseline.md` update (K1/K2/Y2/Y4-Y8/O1/O2/O4/O8/D1/D2 closed; Y1/O7 partial; Y3/O3/O5/O6/D3-D6 open), [x] 3-run median Lighthouse + Playwright INP proxy + DB query/ISR measurement (`docs/perf/f11-acceptance.md`), [x] e2e: `tests/e2e/f11-flows.spec.ts` (catalog→product→`Teklif İste` (Request a Quote) form, anonymous preview rejection; does not write to live DB) and `tests/e2e/isolated/block-order.spec.ts` (DB copy + 3400; `pnpm test:e2e:isolated`; changing block order via API changes home page order + preview staff/anon), [x] editor guide aligned with admin UI. **Red budgets:** hero with image mobile LCP 3.0 s (Lantern; on real throttling LCP=FCP), SEO 92 (canonical, awaiting domain), JS 192 KB gzip (>130), font 70 KB (>60). Follow-up: separate phase "JS/font diet" (mega menu Radix, client ICU parser, tailwind-merge, mono font) + legal page placeholders + empty state pages.

### G — Visual bug-fix pass (once user list arrives, after F0)
- For each item, record page, viewport width, expected, and actual. Fixes are small and committed per item. Before/after screenshots are taken.

---

## 9. Agent distribution (`takim-lideri`; author ≠ reviewer)

| Phase | Author (effort) | QA (effort) |
|---|---|---|
| F0 | GPT 6.1 Terra (High): perf/DB/timeout · Claude Sonnet 5.5 (Medium): screenshot matrix | GPT 6.1 Sol (Medium) |
| F1 | GPT 6.1 Terra (Medium) | Claude Opus subagent (Medium) |
| F2 | Claude Sonnet 5.5 (Medium) | GPT 6.1 Terra (High) |
| F3 | Claude Opus subagent (High): schema/renderer · GPT 6.1 Sol (Medium): migration/import/tests | GPT 6.1 Terra (High) |
| F4 | Claude Sonnet 5.5 (Medium): UI · GPT 6.1 Sol (Medium): migration/tests | GPT 6.1 Terra (High) |
| F5 | GPT 6.1 Terra (High): data loaders · Claude Sonnet 5.5 (Medium): UI | GPT 6.1 Sol (High) + Claude Opus (Low) cross-read |
| F6 | Claude Opus subagent (High): page model/routes · GPT 6.1 Sol (Medium): seed/migration/tests | GPT 6.1 Terra (High) |
| F7 | Claude Opus subagent (Medium): schema · Claude Sonnet 5.5 (Medium): header/footer UI · GPT 6.1 Sol (Medium): migration/seed | GPT 6.1 Terra (High) |
| F8 | Claude Opus subagent (High) | GPT 6.1 Terra (High), zero-context security review |
| F9 | GPT 6.1 Terra (High) | Claude Sonnet 5.5 (Medium) + Opus (Low) access control |
| F10 | Claude Haiku 5.5 (Low): labels/translations/guide · Claude Sonnet 5.5 (Low): preview images | GPT 6.1 Sol (Medium) |
| F11 / G | Claude Sonnet 5.5 (Medium): fixes · GPT 6.1 Terra (Medium): perf verification | GPT 6.1 Sol (High) |

Quota balance: Claude-heavy phases (F2–F4, F6–F7) alternate with GPT-heavy phases (F1, F5, F9). When blocked, the lead asks for consultation but does not write code.

---

## 10. Risks (summary)
- **Data loss (SQLite rebuild):** additive only, DB copy, SQL review.
- **Draft leak or cache corruption:** staff verification and publish-status-gated revalidation.
- **Admin config/bundle bloat as block count grows:** `blockReferences` spike and per-collection subsets.
- **Generality ↔ simplicity:** block options are intentionally kept minimal (theme, spacing, alignment, width, animation, anchor). No free-form color, font, or pixel settings.
- **Browser tests:** macOS MachPort limitation (known); acceptance measurements run on a permitted host.

## 11. Open questions (for the user)
1. Should the "general template" use a **separate installation** (single site/single DB) per company, or a **multi-tenant** setup on one installation? The plan assumes separate installations.
2. Should the brand color (instead of cobalt) and logo be editable from admin (with contrast checks), or stay in code/token files?
3. On listing pages (Products, News, Customers…), are top hero + bottom blocks enough, or should the listing itself also be a movable "Listing" block?
4. Do you want self-hosted video (MP4/WebM) in the hero? On mobile only the poster is shown, and it loads on desktop to protect the budget.
5. Should autosave (approx. 2 s interval, SQLite write load) be enabled for Live Preview, or is "Save → preview refreshes" sufficient?
