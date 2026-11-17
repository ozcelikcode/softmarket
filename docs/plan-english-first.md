# Plan: English-first infrastructure and default locale `en`

Status: **plan only** (2026-11-17). No code, schema or migration has been changed. Approval required per phase.

User decisions (2026-11-17):

1. The whole infrastructure is English: code, identifiers, comments, tests, scripts, error codes, README, plans, agent docs. Turkish is only an additional **site translation** (content + UI strings).
2. The default locale becomes English: `defaultLocale = 'en'`, code routes become English (`/en/products` is canonical), Turkish URLs stay as the translation (`/tr/urunler`), and content-import identity moves from TR slug to EN slug.

Constraint: visual-globals **G1** is in flight on `main` (uncommitted: `src/fields/link.ts`, `src/lib/site.ts`, `src/lib/content-import/importer.ts`, `src/lib/safe-href.ts`, header/footer globals + components, `src/payload.config.ts`, migration `20261117_133332_globals_chrome_drafts`). Licensing **L1** (schema) follows G1. No phase below may start until G1 is committed, because the English-first phases touch the same files.

---

## 0. Executive summary

- The public URL space does **not** need to change. Today next-intl `pathnames` maps a Turkish canonical folder (`/urunler`) to `{ tr: '/urunler', en: '/products' }`. Renaming folders to English and inverting the map (`{ en: '/products', tr: '/urunler' }`) keeps every public URL byte-identical. Route redirects are only needed for content slugs whose EN value we decide to change (legal pages, optional demo content).
- Payload stores localized values in `*_locales` tables keyed by `_locale`; `defaultLocale` is not persisted. Switching it is a **config change, not a DDL migration**. Its real effects are behavioural: which locale fills fallbacks, which locale a locale-less Local API call reads/writes, `x-default`, admin editing default.
- The one real data migration is **CMS link route keys**: `routeKey()` derives stored select values from the Turkish canonical paths (`urunler`, `destek_surum-notlari`, `yasal_slug` …) in ~39 `*_link_route` columns (more once G1 adds `_header_v`/`_footer_v`). Changing them is a data-only migration (SQLite stores selects as text) plus a legacy-key normalizer.
- Code is already mostly English. Turkish in `src/` is overwhelmingly legitimate bilingual admin labels. The bulk of Turkish lives in docs (≈2,650 lines) and memory-bank (≈675 lines), plus ASCII Turkish route identifiers (`/hesap/giris`, `SEGMENTS_EN`, `SYSTEM_PAGES`) and tests asserting TR defaults.

Recommended order: **G1 commit → E0 → E1 → E2 → (L1 may start) → E3 → E4 → E5 → E6 → E7**. Total 14–18 days.

---

## A. Inventory (grep-based, 2026-11-17, excludes `payload-types.ts` and `src/migrations`)

Turkish-character lines (`[çğıöşüÇĞİÖŞÜ]`) per area:

| Area | Files | Lines | Nature |
|---|---|---|---|
| `src/i18n/messages/tr.json` | 1 | 431 | **Legitimate** UI translation (588 keys; all keys already English) |
| `src/lib/admin-i18n.ts` | 1 | 283 | **Legitimate** `loc(tr, en)` admin dictionary |
| `src/blocks` | 24 | 168 | Almost all `L('Giriş', 'Intro')` bilingual labels — legitimate |
| `src/collections` | 7 | 114 | Bilingual labels; 3 TR/EN ternary error messages |
| `src/globals` | 4 | 79 | Bilingual labels; some TR-only `description` strings (Integrations.ts) |
| `src/lib` (excl. admin-i18n) | 30 | ~180 | `slugify` TR map (legit), legal placeholder tokens `[ŞİRKET UNVANI]` (legit content tokens), `visual-editor-labels.ts` (bilingual), `validation-messages.ts` (bilingual), **TR-only**: `media-upload.ts:41` APIError, `brand.ts:140` contrast error, `preview-url.ts:25` breakpoint label |
| `src/fields` | 4 | 38 | Slash-bilingual validation strings (`'Slug yalnızca … / Slug may only …'`) |
| `src/app`, `src/components`, `src/editor` | 10 | 15 | Comments quoting UI copy ("Teklif İste"), `global-not-found.tsx` bilingual h1, OG `alt` |
| `scripts` | 3 | 25 | `admin-block-placeholders.mjs` (20), `e2e-seed-payments.ts` (4) |
| `tests/unit` | 46 | 237 | Mostly assertions on TR UI text / TR URLs; 5 Turkish test names |
| `tests/e2e` | 5 | 40 | TR assertions; 4 Turkish test names |
| `docs/**` | 23 | 2,655 | Plans/guides 40–80 % Turkish |
| `memory-bank/*` | 7 | 675 | 60–75 % Turkish |
| `AGENTS.md` / `README.md` | 2 | 96 / 66 | Mixed, Turkish-heavy sections |
| `content/seed`, `content/templates`, `content/legal` | 25 | 1,044 | **Legitimate** TR content |
| `Makefile`, `deploy/**`, `package.json` | – | 0 | Clean |

Classification of the 980 non-message code lines: 256 explicit `{ tr, en }`/`loc()` labels, ~600 `L()`/`bilingual()` pairs (legitimate), 55 comment lines, 9 test names, 4 TR-only/TR-first error paths.

ASCII Turkish identifiers (no special chars, invisible to the grep above):

- Route segments as code literals (src incl. tests): `urunler` 53/83, `hesap` 99/67, `destek` 86/23, `yasal` 26/42, `talepler` 28, `haberler` 30, `cozumler` 28, `referanslar` 24, `teklif-iste` 18/20, `siparisler` 16/27, `satin-al` 9/17 … (src/tests+scripts).
- Core sources: `src/i18n/paths.ts` (`SEGMENTS_EN`, `CANONICAL_PATHS`, `routeKey`), `src/lib/system-pages.ts` (`SYSTEM_PAGES`, `pagePath`, `hakkimizda`), `src/app/sitemap.ts` (`STATIC`), `src/lib/portal/redirect.ts` (`PORTAL_HOME`, `FROM_EN`, allow-regex), `src/lib/portal/*` (`/hesap/giris` …), `src/lib/preview-url.ts`, `src/lib/csp.ts` (lists both forms), `next.config` headers (public, both forms), `src/lib/request-guards.ts` (`/arama` legacy).
- Stored DB values: link `route` select values (`urunler`, `sirket_hakkimizda`, `destek_surum-notlari`, `yasal_slug` …), legal page slugs = TR filenames in **both** locales (`/en/legal/kvkk-aydinlatma`), `COMMERCE_LEGAL_FILES` keyed by TR filename.
- TR-as-default fallbacks: 35 occurrences in 30 files (`=== 'en' ? 'en' : 'tr'`, `?? 'tr'`), e.g. `bridge.tsx`, `host.tsx`, `preview-url.ts`, `preview-route.ts` (`'/tr'`), `static-params.ts`, `iyzico.ts`, `paths.ts` (`publicLanguageSwitch`, `localizedHref`).
- Local API calls without `locale`: **68 of 124** (they currently read/write TR): `portal/actions.ts` 8, `payments/*` ~20, `email/*` 5, `access/*` 6, collections 6, `editor/canvas/concurrency.ts` 4 …

Commit convention: already English Conventional Commits (41 of the last 42 subjects). Keep.

What legitimately stays Turkish: `src/i18n/messages/tr.json`; `tr` halves of `loc()`/`L()`/`bilingual()`/`{ tr, en }` labels and `VALIDATION_TRANSLATIONS.tr`; `content/seed/**` and `content/templates/starter/**` `tr` objects; `content/legal/tr/*.md`; Turkish public URL segments (as **translation data** in one map); `slugify` TR transliteration table; legal placeholder tokens that appear in TR legal texts (`[ŞİRKET UNVANI]` — the token list is content contract; optionally add EN aliases); the `Türkçe` locale label.

---

## B. Default locale switch `tr` → `en`

### B1. Payload (`src/payload.config.ts`)

- `localization.defaultLocale: 'en'`, keep `fallback: true`, reorder locales `[en, tr]` (admin locale selector order).
- `i18n.fallbackLanguage: 'en'` (admin UI language for browsers that are neither TR nor EN). Keep `supportedLanguages: { tr, en }`; Payload still picks TR for TR browsers and the `payload-lng` cookie keeps current staff choices.
- **No DDL / no data migration.** `_locale` rows are untouched. Versions/drafts (`_*_v_locales`) are the same tables. Slug uniqueness is `(slug, _locale)` and is locale-agnostic.
- Behaviour changes to verify:
  1. **Fallback direction.** Today a missing EN field falls back to TR; after the switch a missing TR field falls back to EN and a missing EN field renders **empty**. Local DB check (read-only): `pages 15/15`, `products 8/8`, `product_families 3/3`, `solutions 4/4`, `posts 3/3`, `docs 24/24`, `faqs 10/10`, `industries 4/4` EN rows exist with EN slugs. E2 adds a read-only completeness script: for every localized field that is required or rendered, count rows where TR is non-null and EN is null (collections, versions, globals header/footer/site-settings). Acceptance: 0, or an explicit list fixed by content before the switch.
  2. **Required localized fields.** Payload validates required fields for the locale being written. Existing docs are not re-validated by the switch; a later EN save of a doc lacking EN values will require them. Verify in the E2 spike with one product (EN-only save, TR-only save, locale-less save).
  3. **Locale-less Local API calls** (68) now read/write EN. Audit each: emails (`license-assigned`, `order-confirmation`, `order-refund`, `portal/email.ts`) must use the customer/order locale; payments snapshots (product title in order lines) must pick an explicit locale; access helpers usually read non-localized fields (no change). Rule after E2: every call touching localized fields passes `locale` explicitly; add a lint-style unit test that scans for `payload.find|findByID|findGlobal|create|update` without `locale` outside an allowlist.
  4. **`findGlobal` without locale** (header/footer/site-settings) now returns EN; frontend calls already pass `locale` — verify.
  5. **Search plugin** (`search` collection, `localize: true`): run `pnpm search:reindex` after the switch on a DB copy; verify TR and EN search results.
  6. **SEO plugin** meta fields are localized; generated meta falls back per (1).
  7. **MCP**: requests without `locale` now hit EN. Update AGENTS.md recipes to always pass `locale` (`en` first, then `tr`).
  8. **content:import** already writes both locales explicitly; creation locale changes from `tr` to `en` (E4).

### B2. Next / next-intl

- `src/i18n/routing.ts`: `locales: ['en', 'tr']`, `defaultLocale: 'en'`, keep `localePrefix: 'always'`, keep locale detection (default on).
- Root `/`: next-intl redirects by `NEXT_LOCALE` cookie → `Accept-Language` → `en`. Turkish browsers still land on `/tr`. Recommendation: keep detection (no SEO harm: `/` is a redirect, both locale homes are indexable with hreflang).
- Unprefixed legacy paths (`/urunler`, `/hesap/giris` without locale): today they resolve to `/tr/...`; after the switch next-intl would try `/en/urunler` (404). E1 adds a middleware rule: unprefixed path that matches a **TR** template → 308 to `/tr/<path>`; matching an EN template → `/en/<path>`. Test both.
- `x-default`: `src/lib/seo.ts` already uses `routing.defaultLocale` (auto-switches); `src/app/sitemap.ts:58` hard-codes `languages.tr` → use `routing.defaultLocale`.
- Canonical URLs and per-locale hreflang: unchanged (public URLs unchanged).
- OG images: `src/app/[locale]/opengraph-image.tsx` is per locale; only the `alt` string (bilingual constant) changes to English + per-locale.
- `src/lib/preview-route.ts:61` default redirect `/tr` → `/${routing.defaultLocale}`.
- All `=== 'en' ? 'en' : 'tr'` style fallbacks → `normalizeLocale(x)` helper returning `routing.defaultLocale` for unknown input (single implementation in `src/i18n/has-locale.ts`).
- `iyzico.ts` `locale ?? 'tr'`: keep provider locale derived from the order locale; the fallback becomes the default locale only if iyzico accepts `en` (it does: `tr|en`).

### B3. Data migration needs

| Change | DDL | Data |
|---|---|---|
| `defaultLocale` switch | no | no |
| Route key rename (E3) | no (text columns; select enum is TS/GraphQL only) | **yes**: `UPDATE … SET link_route = <new> WHERE link_route = <old>` over every `%link_route`/`%_route` column incl. version tables |
| Legal EN slugs (E4) | no | yes, via `content:import --legal` upsert matched by legacy slug |
| Optional EN demo slug anglicization (E4, question 2) | no | yes, via import |

Public TR URLs keep working in every phase. A 308 map is needed only for EN content slugs that change (§D4).

---

## C. Route folder strategy

### C1. Current mechanism (precise)

- Folders under `src/app/(frontend)/[locale]/` are Turkish (`urunler`, `hesap/(auth)/giris`, `hesap/(portal)/satin-al/[sku]` …).
- `CANONICAL_PATHS` lists those Turkish internal pathnames; `buildPathnames()` emits `{ tr: p, en: translate(p) }` using `SEGMENTS_EN`. next-intl rewrites `/en/products` → internal `/en/urunler` folder.
- `localizedHref(path, locale)` takes a canonical (TR) or locale-prefixed path and translates segments; it assumes `sourceLocale = 'tr'` for unprefixed input. `routeKey()` turns canonical paths into stored CMS keys (`/destek/surum-notlari` → `destek_surum-notlari`).
- `/arama` folder is a legacy redirect (middleware `legacySearchPath` also 308s `/tr/arama` → `/tr/ara`, `/en/arama` → `/en/search`).

### C2. Target

- English folders: `products/[family]/[product]`, `solutions/[slug]`, `support/{downloads,documentation/[product]/[slug],release-notes,faq,request,contact}`, `company/about`, `customers/[slug]`, `news/[slug]`, `careers/[slug]`, `partners`, `contact`, `request-demo`, `request-quote`, `account/(auth)/{login,register,forgot-password,reset-password,verify}`, `account/(portal)/{licenses,downloads,profile,tickets/{new,[id]},checkout/[sku],orders/[no]}`, `search`, `legal/[slug]`, `[slug]`, `[...notFound]`.
- `src/i18n/paths.ts`: `CANONICAL_PATHS` in English; `SEGMENTS_TR` (en → tr) replaces `SEGMENTS_EN`; `buildPathnames()` → `{ en: p, tr: translate(p, 'tr') }`. Because `search` maps to both `ara` (current) and `arama` (legacy), the TR map has `search: 'ara'` and `arama` is kept only in `RESERVED_SLUGS`/legacy redirect.
- **Public URLs unchanged** in both locales ⇒ no route redirects, no SEO change. Proof = URL parity crawl (E1 acceptance).
- `localizedHref()` accepts: locale-prefixed public paths (either locale), unprefixed EN canonical paths, and **unprefixed legacy TR canonical paths** (CMS `url` fields and `?next=` params written before the switch may contain `/urunler/...`, `/hesap/lisanslar`). Try EN templates first, then TR.
- `src/lib/portal/redirect.ts`: canonical becomes `/account/...`; accept legacy `/hesap/...` and EN/TR public forms in `?next=`; allow-regex rewritten in English.
- `SYSTEM_PAGES`, `pagePath()`, `sitemap.ts STATIC`, `preview-url.ts`, portal action redirects, email link builders (`/hesap/dogrula` → `/account/verify`) use English canonical paths. `pagePath()` keeps the pre-F6 `hakkimizda|about` convention.
- `RESERVED_SLUGS` is computed from both maps (same set as today plus nothing removed).
- Remove the `arama` folder only if middleware coverage test passes for `/tr/arama`, `/en/arama`, `/arama` with query strings; otherwise rename it `legacy-search` outside `pathnames`.
- `src/lib/csp.ts` and `next.config` header patterns match **public** URLs and keep both forms; optionally derive them from `buildPathnames()` (separate refactor, not required).
- Route keys stay **unchanged in E1** through an explicit table (`LEGACY_ROUTE_KEYS: Record<canonicalEnPath, storedKey>`), so E1 has zero data impact. E3 renames them.

---

## D. Content import identity TR slug → EN slug

### D1. Rules after E4

- Record identity = **EN slug** (`input.en.slug`); editions = SKU (unchanged); forms = stable `title` (`softmarket-<kind>`, already English); docs = `product-en-slug/doc-en-slug`; releases = `product-en-slug/version`; FAQs = EN slug; media = `seedPath` (unchanged).
- Relationship references in seed JSON use the target's EN slug. Links: `{ "type": "route", "route": "products" }` (English keys after E3), `routeParam` = EN slug.
- Seed record shape order becomes `{ "en": {...}, "tr": {...} }` (cosmetic; parser accepts both orders).
- Creation locale `en`, then `tr` update (mirror of today).

### D2. Idempotency and migration of existing DBs

- Lookup order per entry: (1) EN slug in locale `en`; (2) **legacy fallback**: TR slug in locale `tr` → treat as the same record, update its EN slug if seed differs, print `warn <collection>:<en-slug> matched by legacy TR identity`; (3) create. Ambiguity (two candidates) = error, as today.
- Today's local DB: every record already has an EN slug equal to the seed EN slug (verified for pages, products, families, solutions, posts, docs, faqs, industries), so step (1) matches; step (2) covers editor-created records missing an EN slug and installs whose EN slugs drifted.
- Keep the legacy fallback for one release; then gate it behind `--legacy-tr-identity`.
- Product layout preservation rule (editor-composed layout kept, `warn products:<slug> layout preserved (edited in editor)`) is unchanged except the identity in the message becomes the EN slug and the message is English.

### D3. Files

- `src/lib/content-import/importer.ts`, `schema.ts` (descriptions), `model.ts`; `content/seed/schema.json` (regenerate/describe EN identity — it states "TR slug" twice); `content/seed/*.json` and `content/templates/starter/*.json` rewritten by a **one-shot codemod script** (kept under `scripts/one-off/` until E7, then deleted) that builds a TR→EN map from the seed itself and rewrites every relationship/`routeParam`/docs key, and swaps `route` values to E3 keys.
- `tests/unit/content-import*.test.ts`, `tests/unit/starter-template-db.test.ts`.
- AGENTS.md "Phase 8a", "starter", "MCP upsert" sections.

### D4. Legal import (`--legal`)

- Today: file name = slug in **both** locales (`content/legal/{tr,en}/kvkk-aydinlatma.md` → `/en/legal/kvkk-aydinlatma`); `COMMERCE_LEGAL_FILES` keyed by TR file names; markdown cross-links rewritten to `/tr/yasal/x` or `/en/legal/x`.
- Target: `content/legal/manifest.json`:
  `[{ "en": "privacy-notice", "tr": "kvkk-aydinlatma", "legacy": ["kvkk-aydinlatma"], "commerceLegal": null }, { "en": "distance-sales-agreement", "tr": "mesafeli-satis-sozlesmesi", "commerceLegal": "distanceSales" }, …]`; files `content/legal/en/<en>.md`, `content/legal/tr/<tr>.md`. Identity = EN slug; existing records matched by `legacy` slug. Cross-links `](privacy-notice.md)` resolved through the manifest per locale.
- Proposed EN slugs (8 files): `cookie-policy`, `eula`, `privacy-policy`, `refund-and-withdrawal`, `terms-of-use`, `privacy-notice` (KVKK), `distance-sales-agreement`, `pre-contract-information`.
- **Public EN URL change** ⇒ 308 `/en/legal/<old-tr-slug>` → `/en/legal/<en-slug>`. Implement generically: CMS slug pages that miss in the current locale look the slug up in the other locale (and the manifest `legacy` list) and `permanentRedirect` to the localized slug. Same helper serves optional demo-content slug changes.
- Footer/legal links: `routeParam` today holds the slug, rendered verbatim in both locales. After E4 the link resolver maps `legal_slug`/landing `routeParam` (EN identity) → per-locale slug through a cached slug map (`unstable_cache`, tag `public-sitemap`), so TR links render `/tr/yasal/kvkk-aydinlatma` with no redirect hop.
- Commerce legal code keys off `pages.commerceLegal` (English enum), not slugs — unaffected. `isCommerceLegalHref` and sitemap filtering must be re-tested with the new EN paths.

---

## E. Code, test and docs translation

- **Identifiers / paths**: covered by E1 (routing) and E3 (route keys).
- **Comments**: 55 lines; translate, keep quoted UI copy in English with the TR string in backticks only where the TR UI text is the subject (e.g. "the required Request quote action").
- **Errors (non-i18n)** → keys in `src/lib/validation-messages.ts` (`req.t('softmarket:<key>')`, English fallback): `media-upload.ts` APIError, `brand.ts` contrast error, `Orders.ts` `msg()` pairs, `Pages.ts` `req.i18n?.language === 'en'` ternaries (16 such ternaries project-wide), slash-bilingual strings in `slug.ts`/`link.ts` (11). Keep messages for both languages; ordering EN first in new code.
- **Logs / script output**: importer warnings, `ensure-forms`, `payments-reconcile`, `e2e-seed-*`, `admin-block-placeholders.mjs` → English.
- **Admin labels**: data stays bilingual. Do **not** mass-reorder `loc(tr, en)` (283 lines, zero value, high churn). New code may use `{ en, tr }` objects.
- **Tests**: translate 9 Turkish test names; tests asserting the default locale move to EN; keep explicit TR coverage (`/tr/...` assertions stay valid because TR URLs do not change). E2E runs both locales for the public flows.
- **Guard**: `tests/unit/english-source.test.ts` scans `src/**`, `scripts/**`, `tests/**` for Turkish characters outside an allowlist (`messages/tr.json`, `admin-i18n.ts`, `validation-messages.ts` tr block, `slugify.ts`, `company-facts.ts` tokens, lines inside `loc(`/`L(`/`bilingual(`/`tr:` literals, TR fixtures under `tests/fixtures/tr/`). Ratchet: start in E5 with a snapshot count, end at 0 unallowlisted lines.
- **Docs (cheapest safe path)**:
  - Translate fully: `AGENTS.md`, `README.md`, `memory-bank/{README,projectbrief,productContext,systemPatterns,techContext}.md` (small, high-traffic, agent-critical).
  - `memory-bank/activeContext.md` and `progress.md` (70 KB / 55 KB of history): move current content verbatim to `memory-bank/archive/{activeContext,progress}-2026-11-tr.md` (frozen), start new English files with a ≤120-line English summary of state. Agents read only the new files.
  - Active plans still being executed: `plan-visual-globals.md`, `plan-licensing-security.md` → translate (they drive G2–G7 and L1–L11 implementation briefs).
  - Completed/frozen plans and reports (`plan-payments`, `plan-visual-editor`, `plan-page-builder-animation`, `implementation-plan`, `plan-hosting`, `editor-pilot/*`, `perf/*`, `qa/*`, `payments/operations.md`): **freeze**, add a 5–15 line English summary at the top ("Frozen Turkish record; English summary"). Translate on demand when a phase reopens them. `payments/operations.md` is an operator runbook → translate (small).
  - `docs/editor-guide.md` (end-user guide for editors): translate to English as the primary; keep the current file as `docs/editor-guide.tr.md` (it is user-facing translation material, like site content). See question 4.
- **Commit messages**: English Conventional Commits (already the practice). Add one line to AGENTS.md.
- **AGENTS.md project rule** (new): "All code, identifiers, comments, tests, scripts, docs and commit messages are English. Turkish appears only in `src/i18n/messages/tr.json`, `tr` halves of bilingual labels/validation messages, TR content under `content/**/tr` or `tr` objects, and TR public URL segments in `src/i18n/paths.ts`."

---

## F. Admin panel default language

- `i18n.fallbackLanguage: 'en'`; `supportedLanguages` order `{ en, tr }`.
- Payload chooses language by `payload-lng` cookie → `Accept-Language` → fallback; Turkish staff keep Turkish.
- `localization.locales` order `[en, tr]` makes EN the default editing locale in the document view; Live Preview opens `/en/...` by default (`preview-url.ts`).
- Visual editor (V5) host/bridge default locale `tr` → `routing.defaultLocale` (`host.tsx:87,104-105`, `bridge.tsx:91`); protocol enum `['tr','en']` unchanged.
- `tests/unit/admin-labels.test.ts`: logic is language-symmetric; adapt only messages/comments and any assertion that relies on TR being the fallback. Breakpoint labels stay plain strings (Payload renders them as React children) → `'Desktop'`-style English plain strings.
- Licensing plan's `/admin/guvenlik` custom view becomes `/admin/security` (update `plan-licensing-security.md` during E0 translation, before L6).

---

## G. Risks and verification

| # | Risk | Mitigation / verification |
|---|---|---|
| 1 | Broken public URLs or changed HTML after folder rename (E1) | URL parity crawl: every sitemap URL + every `LINK_ROUTES` URL + portal/auth routes in both locales, status + `Location` + normalized HTML hash, before/after on a production build on a spare port (not 3100). Acceptance = identical (only build-id noise normalized). |
| 2 | Stored route keys break after rename (E3) | Data migration over all `*link_route`/`*_route` columns incl. version tables (`_pages_v`, `_products_v`, …, G1's `_header_v`, `_footer_v`); legacy-key normalizer in link `beforeValidate` (MCP/old seeds); `down` restores old keys; run on DB copy; query asserts 0 legacy values remain. |
| 3 | EN pages render empty fields after fallback flips (E2) | Read-only completeness script on DB copy before the switch; visual parity of EN pages; content fix list approved first. |
| 4 | Locale-less Local API calls silently change language (emails, order snapshots) | Audit all 68 calls; explicit `locale`; guard test; email snapshot tests per locale. |
| 5 | Import duplicates records when identity flips (E4) | Legacy TR fallback lookup; `--dry-run` on a copy of DB + uploads must report 0 creates for an unchanged seed; then real run; re-run = 0 creates/0 duplicate array rows. |
| 6 | EN legal URL change (payments legal gate, footer links, emails, checkout consent) | Cross-locale slug 308; `isCommerceLegalHref` tests with new paths; checkout consent links; sitemap filtering when commerce closed/open; e2e payments isolated suite. |
| 7 | Unprefixed legacy paths and `?next=` values | Middleware TR/EN template detection; `safePortalNext` accepts legacy `/hesap/...`; unit tests. |
| 8 | Conflicts with in-flight G1 / L1 | Start only after G1 commit; E3 migration serialized with L1 `migrate:create` (never concurrent; regenerate `payload-types.ts` once per migration). |
| 9 | Visual editor / canvas allowlists | Preview redirect allowlist matches public `/tr|/en` + slug segments (unchanged); `preview-url.ts` canonical paths; `tests/e2e/isolated/visual-editor.spec.ts` in both locales. |
| 10 | Performance | No new per-request DB lookups except cached slug map; Lighthouse spot-check of home/product/legal in both locales against `docs/perf/lighthouse-baseline.json`. |
| 11 | SEO signals | `x-default` → EN home; hreflang pairs unchanged; sitemap diff = only `x-default` targets and EN legal URLs. |
| 12 | Bulk-translation agents changing behaviour | Mechanical phases forbid logic edits; reviewer diffs with `git diff --word-diff` and full gates; Terra tends to end long tasks early → split by directory. |

Gates every phase: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; e2e (`pnpm test:e2e`, isolated suites where touched). Never touch the dev server on 3100 or `../softmarket-l0`; DB experiments on copies (`data/*.db` + uploads).

---

## H. Phases

Assignment rule: writer ≠ reviewer. Claude-written code is reviewed by GPT Sol High or Terra High; bulk mechanical work by GPT Sol Medium or Haiku Low with review; locale/routing core by Opus Medium. No Fable. Stop for user approval after each phase.

### E0 — Language policy and agent docs (1–1.5 days, schema: no)

- Scope: AGENTS.md English + language rule + commit convention; README English; memory-bank core files English; archive + restart activeContext/progress; translate `plan-visual-globals.md`, `plan-licensing-security.md` (incl. `/admin/security`), `payments/operations.md`; freeze headers for the other docs.
- Files: `AGENTS.md`, `README.md`, `memory-bank/**`, `docs/**`.
- Acceptance: no Turkish in AGENTS/README/memory-bank core/active plans except quoted TR URLs/UI strings in code font; frozen docs carry English summaries; facts unchanged (reviewer spot-checks commands, paths, numbers).
- Tests: none (docs only); `pnpm lint` for markdown if configured.
- Risks: meaning drift in translated plans. Writer GPT Sol Medium (translation), reviewer Opus Medium (fact check).
- Note: `techContext.md` is translated here (not in this planning task).

### E1 — English route core, public URLs unchanged (2–2.5 days, schema: no)

- Scope: rename route folders (`git mv`); `paths.ts` English canonical + `SEGMENTS_TR`; `buildPathnames` `{ en, tr }`; `localizedHref`/`matchRoute`/`languageSwitchPath`/`publicLanguageSwitch` locale-neutral with legacy TR canonical acceptance; `LEGACY_ROUTE_KEYS` so stored keys stay identical; `system-pages.ts`, `sitemap.ts`, `preview-url.ts`, `portal/redirect.ts`, `portal/*`, `email.ts` paths, `static-params.ts`; middleware unprefixed-path rule; `arama` folder decision.
- defaultLocale stays `tr` in this phase (isolates routing risk from locale risk).
- Acceptance: URL parity crawl identical; `routeOptions()` values identical to before (snapshot); GraphQL schema enum values identical; all gates green; e2e both locales.
- Tests: update path unit tests; new `tests/unit/route-parity.test.ts` (every TR and EN public path for every canonical route equals a frozen fixture captured before E1).
- Risks: Next route group/folder rename misses (`(auth)`, `(portal)`), `notFound` catch-all ordering. Writer Opus Medium, reviewer GPT Sol High.

### E2 — Default locale `en` (1.5–2 days, schema: no; data: no)

- Scope: `routing.ts`, `payload.config.ts` (`defaultLocale`, locale order, `fallbackLanguage`), `normalizeLocale` helper replacing 35 TR fallbacks, sitemap `x-default`, preview default, canvas defaults, OG alt; audit of 68 locale-less Local API calls (explicit locale); EN completeness script (read-only) and content fix list; `pnpm search:reindex` on DB copy; AGENTS MCP recipes pass `locale`.
- Spike first (0.5 day inside the phase): required-field validation and fallback behaviour on a DB copy (EN-only save, TR-only save, locale-less save) — record results in the phase report.
- Acceptance: completeness script 0 gaps (or approved list); `/` with `Accept-Language: tr` → `/tr`, `en`/none → `/en`; `x-default` = EN in pages and sitemap; TR pages visually identical to pre-E2 baseline (`docs/qa/visual-baseline.md` method); emails render in customer locale.
- Tests: seo/sitemap/x-default unit tests updated; locale-less-call guard test; e2e default-locale flows.
- Risks: empty EN fields; behaviour drift in payments/emails. Writer Opus Medium, reviewer Terra High.

**L1 may start after E2 is committed** (licensing code is English-first by policy from E0; it builds on English routes `/account/...` for later L7 portal pages).

### E3 — English CMS route keys (1 day, schema: data-only migration `YES`)

- Scope: drop `LEGACY_ROUTE_KEYS`; `routeKey()` now yields English keys (`products`, `products_family`, `support_release-notes`, `company_about`, `legal_slug`, `request-quote` …); data migration `pnpm migrate:create english_route_keys` (hand-written `up`/`down` UPDATEs over every route column, discovered from `sqlite_master` at migration time to include G1/L1 tables); legacy-key normalizer in `src/fields/link.ts` (`beforeValidate`) for MCP/old payloads; regenerate `payload-types.ts`; seed/starter `route` values updated.
- Sequencing: after G1 and after L1's migration is committed (never concurrent `migrate:create`).
- Acceptance: migration on DB copy, 0 legacy values remain, `down` restores; header/footer/blocks render identical links; MCP `updateHeader` with an old key is normalized; content:import of old-style seed still works (normalizer) with a deprecation warning.
- Tests: migration test on isolated SQLite (pattern of `globals-drafts-db.test.ts`), link field unit tests.
- Risks: missed column (versions), GraphQL enum churn. Writer Opus Medium, reviewer GPT Sol High.

### E4 — Content import EN identity + legal manifest (2–2.5 days, schema: no; data: via import)

- Scope: §D. Importer identity/legacy fallback; seed/starter codemod; `schema.json` text; legal `manifest.json`, EN file renames, cross-link rewrite via manifest; cross-locale slug 308 helper for CMS slug routes; cached per-locale slug map for `legal_slug`/landing `routeParam`; English importer messages; AGENTS Phase 8a/starter/MCP sections.
- Acceptance: on a copy of DB + uploads: `content:import --dry-run` = 0 creates, then real run = 0 creates; second run idempotent; `--legal` updates 8 legal pages in place (IDs preserved, `legalReview` approvals: confirm whether the text-hash approval must be re-done — see question 5); `/en/legal/kvkk-aydinlatma` → 308 `/en/legal/privacy-notice`; TR legal URLs unchanged; starter template test green on empty DB.
- Tests: `content-import*.test.ts`, `starter-template-db.test.ts`, legal redirect tests, payments legal tests.
- Risks: duplicate records; legal approval invalidation. Writer Opus Medium, reviewer GPT Sol High.

### E5 — Code, test and script translation sweep (3–4 days, schema: no)

- Scope: §E code items: comments, TR-only/ternary/slash errors → `validation-messages.ts` keys, script/log output, test names, default-locale assertions to EN with TR coverage kept, `english-source` guard test (ratchet).
- Split into directory batches (`src/lib`, `src/collections+globals+fields`, `src/app+components+editor`, `scripts`, `tests/unit`, `tests/e2e`) so no single agent run is long.
- Acceptance: guard test at 0 unallowlisted lines; no behavioural diff (reviewer checks that only strings/comments/test names changed outside the message-key extraction); all gates + e2e green.
- Writer GPT Sol Medium (code/tests) and Haiku Low (comments only), reviewer Opus Medium.

### E6 — Remaining docs (1–2 days, schema: no)

- Scope: `editor-guide.md` English primary + `editor-guide.tr.md`; translate any frozen doc reopened by G2–G7/L-phases; final AGENTS/memory-bank refresh after E1–E5 facts.
- Writer Haiku Low / GPT Sol Medium, reviewer Opus Medium.

### E7 — QA and release checklist (1.5 days, schema: no)

- Scope: full gates; e2e both locales incl. isolated payments/visual-editor/block-order; URL parity crawl vs pre-E1 fixture (expected diffs: EN legal slugs, optional demo slugs, `x-default`); import dry-run on DB copy; MCP recipe walkthrough (find/update pages + header with `locale`); Lighthouse spot-check; sitemap diff review; delete `scripts/one-off/` codemod.
- Writer/QA Terra High (split tasks), reviewer Opus Medium.

| Phase | Effort | Schema/migration | Depends on |
|---|---|---|---|
| E0 Policy + agent docs | 1–1.5 d | no | G1 commit |
| E1 English route core | 2–2.5 d | no | E0 |
| E2 Default locale `en` | 1.5–2 d | no | E1 |
| (L1 licensing schema) | per its plan | yes | E2 |
| E3 English route keys | 1 d | **yes (data-only)** | E2 + L1 migration committed |
| E4 Import EN identity + legal | 2–2.5 d | no (data via import) | E3 |
| E5 Code/test sweep | 3–4 d | no | E4 (can overlap L2+ on disjoint files) |
| E6 Remaining docs | 1–2 d | no | E5 |
| E7 QA | 1.5 d | no | E6 |
| **Total** | **14–18 d** | | |

G2–G7 (visual globals) touch header/footer render and the canvas; run them after E2 or pause them during E1/E2 (shared files: `site.ts`, `link.ts`, header/footer components, canvas host/bridge).

---

## I. Open questions for the user

1. **Is the site publicly live (indexed) anywhere?** Recommendation: implement the cross-locale 308s regardless (cheap); if not live, skip keeping legacy route keys beyond one release.
2. **EN slugs for demo content** (products `akis-merkezi`, families, solutions, posts, faqs, industries use Turkish slugs in EN today). Recommendation: anglicize them in `content/seed` (demo only) in E4, protected by the cross-locale 308 helper; leave the starter's `ornek-*` → rename to `sample-family`/`sample-product` (SKU `STARTER-SAMPLE-PRODUCT`) since the starter is for new installs.
3. **Legal EN slugs**: adopt the proposed English slugs (`privacy-notice`, `distance-sales-agreement`, …)? Recommendation: yes, with 308s from the old EN URLs.
4. **Editor guide**: English primary with a maintained Turkish copy (`editor-guide.tr.md`) for Turkish editors, or English only? Recommendation: English primary + Turkish copy.
5. **Legal approvals** (`pages.legalReview` is bound to the text): if renaming EN legal slugs/cross-links changes the stored EN text, must lawyer approval be re-recorded, or should approval hash exclude link targets? Recommendation: keep approvals bound to text and re-approve once in E4 (the gate exists to force that), unless payments are already live.

## User decisions (2026-11-17)

- **Do not touch editable site content.** Existing demo content (`content/seed`), DB records and their slugs stay as they are — editors can change them in the admin. Only the **fresh-install (starter template) content** ships in English (EN as the default locale, TR as translation). E4's demo slug anglicization is dropped; the import identity change applies to the starter template and future imports only, with a safe matching path for existing records.
- **Legal page slugs stay unchanged** (no `privacy-notice` etc.; no legal slug 308s; no forced lawyer re-approval from this plan).
- **Editor guide:** English primary + Turkish copy `docs/editor-guide.tr.md`.
- **Sequencing:** G1 → licensing L1 (and following licensing phases) → English-first conversion later. New code from now on (G1 remainder, licensing) is written English-first regardless (identifiers, comments, tests, docs, commit messages).
