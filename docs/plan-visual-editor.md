# Plan — Visual editor (WYSIWYG), animation effects, and product page composition

> Status: V0, V1, and V2 were implemented and verified (2026-11-08); V3–V6 are waiting as draft plans. V0 evidence and compatibility notes are at the end of the document.
> Sources: `memory-bank/*`, `AGENTS.md`, `docs/plan-page-builder-animation.md` (F0–F11 "Implemented" notes), `docs/perf/f11-acceptance.md`, current code. Advisor reports: GPT 6 Astra (`editor-astra.md`), Gemini 4 Argon (`editor-argon.md`), in the session scratchpad.

## User request and decision

- Request (verbatim): "When adding a product showcase page on the admin page, a good WYSIWYG editor is also needed. An editor that can add animations is needed. The showcase page shouldn't be plain. Animations should be addable, and page content should be movable in blocks. In short, it should be something professional like wix.com."
- Decision: **"Try both first."** In a 2–3 day pilot on a real product page, **Puck** and **Payload-native canvas** are tested; one is chosen using measurable criteria. Shared work runs in parallel: (a) animation effect system, (b) migrating the product page completely to blocks, (c) Payload 3.85.1 → 3.93.x security update.

## Permanent rules (apply to every phase; violations reject the phase)

1. **The single source of truth is Payload `layout` blocks.** No opaque JSON blobs (`puckData`, `canvasState`, etc.) are stored. The editor's internal model lives only in memory.
2. **MCP, `content:import`, and TR/EN are preserved.** New fields flow automatically from config to schema; `content/seed/schema.json` is regenerated, and the MCP allowlist (`src/lib/mcp.ts`) does not change.
3. **No editor JS is sent to the published page.** Puck, bridge, toolbar, and admin panel code never enter public chunks. Proof: `tests/unit/client-bundle-guard.test.ts` is extended; home page JS gzip ≤ current 129 KB (+1 KB tolerance).
4. **Existing security is preserved.** `/api/preview` is staff-only, draft responses are `private, no-store`, `readAs()` verifies staff on every request, `X-Frame-Options: SAMEORIGIN`, and the CSP Report-Only policy is not relaxed.
5. **Existing option/field names and `defaultValue` values do not change.** Only additions are made. Renaming/deleting in SQLite means `__new_` table rebuilds and data loss.
6. **Migrations run on a DB copy first; `down()` is safe.** No `DROP`/`DELETE`/`__new_` in `up`; `down` removes only its own columns/tables/indexes. Flow: `cp data/*.db $TMPDIR/softmarket-<name>.db` → point `DATABASE_URI` to the copy → `pnpm migrate` → `pnpm content:import --dry-run` → `sqlite-integrity` + migration test → live DB backup (including WAL/SHM) → live migrate.
7. The 3100 dev server, live DB, and `.next` folder are only touched when explicitly tasked. Build uses `NEXT_DIST_DIR=.next-<name>`, QA ports are 3200/3300/3400, and pilot ports are 3510/3520.

---

## 1. Decision summary and advisor comparison

### 1.1 Summary

- **Shared data layer, competing editor layer.** V0–V2 establish the schema and render foundation needed by both editors. Pilots (V3a/V3b) **do not change the schema**; they work only in separate file areas on the admin side.
- **Animation is editor-independent.** The preset contract (`motion` group + CSS) writes the same fields in both editors; the chosen editor only displays this panel in a different place.
- **Wix-like experience, not Wix's freedom.** Add/move/delete blocks, edit text in place, pick an effect card, preview devices, switch TR/EN, and publish. No freeform pixel positioning: brand consistency, mobile responsiveness, and LCP require this (Argon's "Wix syndrome" risk).
- **Selection rule:** mandatory gates first (0 data loss, security, public bundle), then weighted score (§V4). If the score difference is <10, the lower-maintenance option (native) wins.

### 1.2 Advisor comparison

| Topic | GPT 6 Astra | Gemini 4 Argon | Plan decision |
|---|---|---|---|
| Primary path | Puck (`@puckeditor/core` 0.24, MIT) custom view + Payload block adapter | On-canvas bridge over Live Preview iframe (`data-block-id`, `postMessage`, toolbar) | **Both in pilot** (user decision) |
| Fallback | Payload-native canvas | Puck + bidirectional serializer | Determined by pilot outcome |
| Package name | `@puckeditor/core` (`@measured/puck` old name) | `@measured/puck` | **Astra is right**; exact version pinned in V3a (`0.24.x`, no caret) |
| Puck and RSC | Editor is client, `Render` supports RSC; keeping current RSC renderer adds 0 public JS | "Components in the editor must be client, making the RSC boundary harder" | Both are partly right: **public render remains our RSC registry**; the real risk is RSC/data blocks looking realistic on the canvas. V3a measures this |
| what-digital/payload-inline-visual-editor | 1.0.1, MIT, `^3.85`; good fit, ~11 stars, low maturity; evaluate in pilot | None | Time-boxed spike in the **first half-day** of V3b |
| Animation data model | Panel: preset/trigger/direction/duration(ms)/delay/easing + "replay"; bounds 150–800 ms, 0–300 ms | Flat fields under `appearance`; duration enum `fast/normal/slow`, delay `0/100/200/300` | **Separate `motion` group** (separate `Hareket` (Motion) panel) + **enum values** (Argon; invalid values impossible) + **Astra bounds** |
| Animation engine | CSS + existing IntersectionObserver; parallax via CSS scroll-driven + `@supports`; Motion/GSAP/Lottie/Rive island-only | Same; GSAP/Motion blows the budget | **CSS-first**, no new runtime. GSAP **excluded** due to license (Webflow §9) |
| LCP protection | LCP element is not hidden/delayed | `render-plan.ts` automatically disables hiding animations on first block/hero | **Argon's mechanism** mandatory in `planBlocks` |
| Product page | Fixed hero/features/spec table outside `layout`; bound blocks `productHero/productFeatures/productSpecs`, content not duplicated | Not mentioned | **Astra**; releases/downloads/docs are also bound blocks (V2) |
| Products autosave | Only `pages` has 2s autosave; `products` must be handled separately | None | Must add `_products_v.autosave` in V2 migration |
| Translation trap | Do not save fallback text as a translation | None | Editor reads EN with `fallbackLocale: false`; locked by test |
| Concurrency | Single save queue, MCP/admin conflict | None | Payload document lock + `updatedAt` comparison in V5 |
| Payload upgrade | 3.93.0 block access + upload security fixes | None | **V0**, before anything else |
| Effort | 25–40 person-days (Puck); 12–22 with native plugin | None | V5 estimate in two scenarios in §V5 |

Note: Version, star, and bundle figures are advisor statements. They are verified from npm/GitHub release notes in V0 and V3; unverified values are marked "unverified" in the plan.

---

## 2. Phases

Timeline (calendar days; parallel tracks):

| Day | Sequential (schema) track | Parallel track A | Parallel track B |
|---|---|---|---|
| 1 | V0 Payload 3.93 | — | — |
| 2 | V1-S motion schema → V2-S bound block schema | V1-C CSS contract | — |
| 3–5 | (schema lock) | V3a Puck pilot + V1-UI Motion panel | V3b native canvas pilot + V2-R product renderer |
| 6 | V4 comparison + user decision | | |
| 7+ | V5 chosen editor (2–3 weeks) | V6 QA/perf/guide (end of V5) | |

### V0 — Payload 3.85.1 → 3.93.x security update

- **Scope:** all `@payloadcms/*` and `payload` packages to the same 3.93.x version (exact pinned version). Release notes 3.86–3.93 are read one by one: breaking changes, SQLite adapter, MCP plugin (`overrideAuth`, tool count), live-preview-react, Lexical, `payload-mcp-api-keys`. Peer dependency compatibility with Next 15.4.11 and React 19.2.6 is verified; if a Next upgrade is required, **stop and ask the user** (out of scope for this plan).
- **Files:** `package.json`, `pnpm-lock.yaml`, `src/payload-types.ts`, `src/app/(payload)/admin/importMap.js`, and if needed compatibility fixes in `src/lib/mcp.ts` and `src/lib/preview-url.ts`. Version note in `techContext.md` and `AGENTS.md` ("Payload MCP (3.85.1)" heading).
- **Migration:** `pnpm migrate:create v0_payload_393`. Expected: "No schema changes". If changes appear (version tables, lock tables, etc.), inspect per SQL rule 6; if `__new_` appears, write safe up/down manually.
- **Acceptance:** typecheck/lint, `pnpm test --maxWorkers=1` all green (currently 54 files / 696 tests). `mcp.test.ts` + MCP tool list with a fresh handler (69 ± version diff, diff recorded), anonymous 401, editor/customer rejection. `live-preview*.test.ts` green. `.next-v0` build on copy DB + 3200 smoke test (TR/EN, admin, product, preview 401/403). `pnpm test:e2e:isolated` green. Admin label test (`admin-labels.test.ts`) green. Live Preview breakpoint `label` still a plain string.
- **Tests:** existing suite. New: `tests/unit/payload-version.test.ts` (all `@payloadcms/*` on the same version).
- **Risks:** MCP plugin internal API changes (Proxy wrapping `req.payload`), HMR not refreshing `authStrategies` registration (requires restart: inform the user), Lexical node schema changes. Rollback: git revert of lockfile + DB snapshot.
- **Dependency:** none. **First before everything else**, because pilots and the what-digital plugin must be tested on the target version.

### V1 — Animation preset system

Three sub-tasks: **V1-S** schema (sequential), **V1-C** CSS/render contract, **V1-UI** admin `Hareket` (Motion) panel (parallel).

**V1-S data model.** An additive `motion` group on every block (`layoutBlocks`, `pageBlocks`, V2 bound blocks), separate from `appearance`. Single source is a new pure module `src/fields/block-motion.ts` (`MOTION_*` constants, `motionSettings()` field factory, `resolveMotion()`), matching the `block-settings.ts` pattern.

| Field | Type / options | Default | Note |
|---|---|---|---|
| `motion.preset` | `auto`, `none`, `fade`, `fade-up`, `slide-left`, `slide-right`, `zoom-in`, `parallax-soft` | `auto` | `auto` = current behavior (`appearance.animation` `subtle` → fade-up 12 px). Existing data looks identical |
| `motion.trigger` | `scroll`, `load`, `hover` | `scroll` | `scroll` = once when visible; `load` = CSS keyframe on page load; `hover` = on card/item |
| `motion.duration` | `fast` (240 ms), `base` (560 ms), `slow` (800 ms) | `base` | Bounds 150–800 ms |
| `motion.delay` | `0`, `100`, `200`, `300` | `0` | ms |
| `motion.easing` | `soft`, `standard`, `emphasized` | `soft` | `--ease-out-soft` / `--ease-standard` / new token |
| `motion.stagger` | `none`, `tight` (60 ms), `relaxed` (100 ms) | `tight` | Item-based blocks only (grid, card); max 4 steps, total ≤ 300 ms |
| `motion.mobile` | checkbox | `false` | Only for `parallax-soft`: whether to run on mobile as well |

- Columns: `motion_preset`, etc. On long block table names, enum names exceed 63 characters: a shortener following the `appearanceEnumName` pattern (`motionEnumName`) is mandatory (F3 `productFamilies` lesson).
- `appearance.animation` (`subtle|none`) **remains as-is** and is the master switch: if `none`, `motion` is ignored. Its label can be updated to `Animasyon (aç/kapat)` ("Animation (on/off)") (labels are not schema).
- **Precedence chain (circuit breaker):** `prefers-reduced-motion: reduce` → `html[data-motion="none"]` (site setting) → `appearance.animation: none` → `motion.preset`. First match wins.
- Migration `v1_block_motion`: `ADD COLUMN` only (5 collections `pages/products/solutions/case-studies/product-families` × normal + `_v` × all block tables). Column defaults = table defaults; existing rows receive `auto`. `Down` drops only these columns. Test: `tests/unit/block-motion-migration.test.ts` (copy DB, up/down data preservation, no forbidden statements in SQL).

**V1-C CSS contract and render.**
- `BlockShell` and `anim()` emit attributes only on the server: `data-anim="<preset>"` (`auto` → `subtle`, backward compatibility), `data-anim-trigger`, `style="--anim-dur;--anim-delay;--anim-ease;--i"`. Content is always visible without JS and in SSR HTML.
- `globals.css` motion section: initial state `[data-anim="<preset>"][data-anim-state="pending"]` for each preset (`opacity` + `transform` only). `scroll` works with the existing single `MotionObserver`; no new observer.
- `load`: CSS keyframe `backwards` (hero pattern). `hover`: `:hover`/`:focus-within`, transform only. `parallax-soft`: `@supports (animation-timeline: view())` + `prefers-reduced-motion: no-preference` + default `@media (min-width: 768px)`. Unsupported browsers see static content, no JS.
- **LCP protection (`src/lib/blocks/render-plan.ts`, mandatory):** for the `pageTop` block, the first visible block, and every `hero`/`productHero`, if the preset is `fade`/`zoom-in`/`fade-up`, it is downgraded to translate-only. The `load` trigger on these blocks never starts from `opacity 0`. Blocks carrying a `priority` image are never hidden. `planBlocks` tests lock this down.
- `html[data-motion="none"]` rules cover the new preset selectors.
- Forbidden: layout properties, `filter: blur`, `box-shadow`, and `backdrop-filter` animations; number counters; JS animation libraries (Motion/GSAP). Lottie/Rive are out of scope for this plan.

**V1-UI admin `Hareket` (Motion) panel.**
- Separate collapsible `Hareket` next to `Görünüm` (Appearance) on each block. Custom admin field component for `motion.preset` (`src/admin/fields/motion-preset-cards.tsx`, Payload `admin.components.Field`): **preset cards** with icon + name + 1-line description. Above the card, a pure-CSS **live mini preview** (gray box, with selected duration/easing/delay) and a `Tekrar oynat` (Replay) button.
- Details (trigger, duration, delay, easing, stagger, mobile) under the cards in the `Gelişmiş` (Advanced) section.
- Filter by block type: only LCP-safe presets are shown on hero/bound hero cards. On the server side, `validate` enforces the same rule (if admin is bypassed, render-plan downgrades it anyway).
- Labels are entered into the `src/lib/admin-i18n.ts` dictionary in TR/EN; `admin-labels.test.ts` green.
- The component lives in the admin import map and is never imported from the `(frontend)` tree (bundle guard).

**Acceptance (V1):** screenshot diff across all existing pages at 1440/390 ≈ 0 (`auto` = old look). Playwright for every preset × trigger: no transform under reduced-motion emulation, static under `data-motion=none`, content visible with JS disabled. First block never has `opacity:0` under any condition. CLS 0, TBT unchanged, CSS gzip increase ≤ 2 KB. `motion` can be written and read via MCP `updatePages`; `content:import` fixture 2× idempotent; `schema.json` sync test green.
**Tests:** extend `motion.test.ts`, new `block-motion.test.ts` (resolveMotion, precedence chain, LCP downgrade), migration test, e2e `tests/e2e/motion-presets.spec.ts`.
**Risks:** enum name length, over-animation (fixed preset count, no freeform values), Safari scroll-driven support (static via `@supports`).
**Dependency:** V1-S → after V0. V1-C and V1-UI → after V1-S, in parallel with pilots.

### V2 — Product page bound blocks (composition)

**Goal:** `src/app/(frontend)/[locale]/urunler/[family]/[product]/page.tsx` currently draws hero, tab bar, overview, features, technical specs, releases, downloads, and documentation sections in a fixed order. `layout` is only appended at the end as "additional blocks", and duplicate hero/featureGrid/specTable blocks are filtered out. The goal is for each section to become a movable, hideable, and animatable block. **Content is not duplicated**: bound blocks read product fields (`title/tagline/summary/heroImage/features/specs/systemRequirements/brochure`, `editions/downloads/docs` joins) at render time.

**V2-S schema:**
- New blocks (`products.layout` only; `src/blocks/product-bound.ts`): `productHero`, `productNav` (sticky tab bar), `productOverview`, `productFeatures`, `productSpecs` (`showRequirements` checkbox, default `true`), `productEditions`, `productDownloads`, `productDocs`.
- No content fields. Only `appearance` + `motion` and at most one or two appearance options (e.g., `productHero.layout: split|centered`). Section headings come from i18n.
- `productBlocks = [...layoutBlocks, ...productBoundBlocks]` only on `Products` `layoutField({ blocks: productBlocks })`. `layoutBlocks` and `pageBlocks` do not change; no tables are created on other collections.
- `validate` on `layout` field: each bound block at most once. If `productHero` is present, it must be the first visible block (h1 + LCP).
- `Products.versions`: `drafts.autosave: { interval: 2000 }` (canvas/Live Preview loop). The shared `draftVersions` constant does not change; Products takes its own value.
- Migration `v2_product_bound_blocks`: `CREATE TABLE products_blocks_product_*` + `_v` + indexes + `ALTER TABLE _products_v ADD autosave` (+ index). Created after V1-S so tables are born with `motion_*` columns. `Down` removes only these tables/columns.

**V2-R render:**
- Pure function `src/lib/blocks/product-composition.ts` → `composeProductLayout(layout)`:
  - **Compatibility mode (no bound blocks in layout):** virtual default order `[productHero, productNav, productOverview, productFeatures, productSpecs, productEditions, productDownloads, productDocs, ...extraBlocks]` is generated. Current filter (duplicate hero/featureGrid/specTable) applies as-is to extra blocks. **Old pages look pixel-identical.** Virtual blocks have a stable `id` (`virtual:productHero`) but are not written to DB.
  - **Composition mode (at least one bound block):** `layout` order is rendered as-is. Any bound section missing from the list is not shown (the editor intentionally removed it). No filter is applied.
- Bound blocks go through `RenderBlocks` → `registry` → `BlockShell`. Product data is passed via `slots.product`, an extension of `BlockSlots` (`listing` pattern). The page component only loads data, generates JSON-LD/metadata/alternates, and calls `RenderBlocks`.
- `productNav` links are derived from the currently visible bound blocks. Section ids (`genel-bakis`, `ozellikler`, `teknik-ozellikler`, `surumler`, `indirmeler`, `dokumantasyon`) are fixed and already in `RESERVED_ANCHORS`.
- Single h1: `productHero` is h1, `hero` blocks in `layout` are h2 (existing rule).
- `Teklif İste` (Request a Quote) is a mandatory primary action inside `productHero`. If `productHero` is removed, the page still draws the default hero (sales flow is preserved).
- Editor side: on first open, `Görsel düzenle` (Edit visually) materializes the virtual list from compatibility mode **in the editor**. On save, only reference blocks are written to `layout`, not copies of content.

**Files:** `src/blocks/product-bound.ts`, `src/blocks/index.ts` (adding `productBlocks`), `src/collections/Products.ts`, `src/components/blocks/product/*.tsx` (reusing existing `PageHero`, `FeatureGrid`, `SpecTable`, `EditionCard`), `registry.ts`, `types.ts`, `product-composition.ts`, product `page.tsx` (simplified), `admin-i18n.ts`, `content/seed/schema.json`, migration + json.
**Acceptance:** compatibility mode screenshot diff across all seed products is 0 (1440/390, TR/EN). In composition mode, scenarios for moving hero below features, removing downloads, and applying `slide-left` to editions render correctly. ISR HIT/0 queries preserved, product query count ≤ 15. JSON-LD/hreflang identical. `productEditions` can be added/ordered in layout via MCP `updateProducts`. `content:import` fixture idempotent. Products autosave writes only to `_products_v` and does not revalidate ISR (revalidate test).
**Tests:** `product-composition.test.ts` (both modes, filter, singleton rule, nav derivation), `product-bound-db.test.ts` (temp SQLite, TR/EN, round-trip), migration test, e2e `product-composition.spec.ts`, `frontend-routing` regression.
**Risks:** unexpected loss when switching compatibility ↔ composition. Mitigation: on the first save switching to composition mode, missing bound sections are shown with a warning badge in admin. Additional risk: sticky nav + `scroll-mt` calculations.
**Dependency:** V2-S → after V1-S. V2-R → after V2-S, in parallel with pilots. Pilots test the product page in composition mode once V2-R is ready; otherwise they start with the virtual list in compatibility mode.

### V3a — Puck pilot (2–3 days, branch `pilot/puck`)

- **Scope:** `Görsel düzenle` on the `products` document screen (Payload custom edit view) → full-screen Puck. Block catalog on the left, canvas in the center, `İçerik`/`Görünüm`/`Hareket` (Content/Appearance/Motion) on the right; TR/EN, 390/768/1440, undo, draft, publish at the top.
- **Adapter (core):** `src/editor/puck/adapter.ts` → `payloadToPuck(layout, locale)` / `puckToPayload(data)`. `blockType ↔ type`, `id ↔ props.id`. Payload `Block.fields` → Puck field config generated automatically (text/textarea/select/number/checkbox/array/group). Custom fields that open the Payload drawer are used for `upload`/`relationship`/`richText`. **Lexical is not converted to Tiptap**: richText is edited only in the side panel with Payload's Lexical field. Inline text only on plain text fields.
- **Canvas appearance:** presentation blocks are shown in the admin bundle with client-safe versions. Two options are tested for data/RSC blocks (productFamilies, newsList, bound product blocks): (1) staff-only `/api/editor/block-preview` HTML fragment, (2) placeholder card. The reference for real appearance is the Live Preview iframe.
- **Save:** Payload REST/Local API (staff session, `overrideAccess:false`, draft). When editing EN, read with `fallbackLocale: false`. Only `localized` fields are written to the selected language; block/row ids are preserved across both languages.
- **To be measured:** §V4 tasks, round-trip test, canvas parity (percentage of blocks rendered with real appearance), admin bundle size, any `@puckeditor` trace in the public bundle.
- **File area:** only `src/editor/puck/**`, `src/admin/views/visual-puck.tsx`, `docs/editor-pilot/puck.md`. Single-line registration in config. New dependency `@puckeditor/core` exact version.

### V3b — Payload-native canvas pilot (2–3 days, branch `pilot/native-canvas`)

- **First half-day (time-box): what-digital/payload-inline-visual-editor spike.** Install on 3.93, test add/duplicate/delete/reorder, locale, and publish flow on a product page. Gates: 0 data round-trip diff, clean public bundle, preview security intact, code readable/forkable (MIT license). If it passes, the rest of the pilot builds on it (pinned + `vendor/` fork if needed). If it fails, switch to the custom bridge.
- **Custom bridge (Argon design):**
  - `editing` flag on `planBlocks` (only when `getPreviewUser()` returns staff). With this flag, `BlockShell` outputs `data-block-id`, `data-block-path="layout.N"`. Plain text fields carry `data-field-path`. These attributes are **absent** from public/ISR HTML.
  - `src/editor/canvas/bridge.tsx` (client): loaded only during draft+staff alongside `LivePreviewRefresh` as a separate chunk via `next/dynamic`. Provides hover frame, selected block toolbar (up/down, drag, duplicate, hide, delete, "+ add block"), and `contenteditable` (`textContent` only) for plain text.
  - `src/editor/canvas/admin-host.tsx` (admin): listener next to Live Preview. Applies messages via Payload form API as move/add/remove row and field value updates, and opens the corresponding block's field drawer (including Appearance/Motion). Autosave (2 s) → `RefreshRouteOnSave` → iframe refreshes. Form API names are verified in the pilot.
  - Message security: `event.origin === location.origin` and `event.source` match in both directions (iframe ↔ parent). Allowlisted message types with Zod schema. The bridge never writes directly to the API; all writes go through the Payload form → server validation/access chain.
- **To be measured:** the same §V4 tasks. Additionally, whether autosave refresh disrupts the caret while typing inline and the 2s loop latency.
- **File area:** `src/editor/canvas/**`, only the `editing` flag in `render-plan.ts`/`block-shell.tsx` (small, can be taken into main in V5), `docs/editor-pilot/canvas.md`.

**Shared pilot rules:**
- Separate directory via git worktree (`../softmarket-pilot-puck`, `../softmarket-pilot-canvas`). Each has its own DB + uploads copy (`$TMPDIR/softmarket-pilot-<name>.db`), its own `.next-pilot-<name>`, ports 3510/3520. Live DB and 3100 are not used.
- **Migrations and schema changes in `src/blocks/**`, `src/fields/**`, `src/collections/**` are forbidden on pilot branches.** Audit: `git diff main -- src/migrations src/blocks src/fields src/collections` must be empty (except the single registration line).
- Pilots pull V1/V2 progress on main via `git rebase main`. Direct merges from a pilot branch into main are **never done**.
- Pilot code is throwaway quality. Outputs: working demo, `docs/editor-pilot/<name>.md` (measurements, screen recording path, issues, V5 effort estimate), `docs/editor-pilot/<name>-metrics.json`.

### V4 — Pilot comparison and decision (0.5 days)

**Mandatory gates** (failing even one disqualifies the candidate):

| Gate | Measurement | Threshold |
|---|---|---|
| Data round-trip | Product + home page in copy DB: open in editor → save without changes → deep comparison of `layout` TR/EN (excluding `updatedAt`) | **0 diff** |
| Lexical preservation | Node JSON of blocks containing rich text (richText, systemRequirements, tabs) after round-trip | Byte-for-byte identical |
| TR/EN | Edit text in EN → TR unchanged; TR fallback not written into empty EN field | 0 leaks |
| Public bundle | `.next-pilot-*` build: any trace of editor packages/bridge in frontend chunks; home page JS gzip | No trace; ≤ 130 KB |
| Security | Anonymous/customer editor view and preview; forged `postMessage` origin/source; draft `no-store`; existing preview tests | All rejected/green |
| MCP/import | MCP `find` + `content:import --dry-run` after editor save | Error-free |

**Weighted score (100):**

| Criterion | Weight | How it is measured |
|---|---|---|
| Editor experience tasks | 35 | Non-technical user (preferably you), screen-recorded 8 tasks: T1 add block (CTA), T2 move (Editions above Features), T3 delete, T4 edit heading text in place, T5 set `Kayarak gel` (Slide in) + slow duration on a block, T6 switch to EN and translate the same heading, T7 preview 390/1440, T8 publish. Time per task (target ≤ 30 s, total ≤ 5 min), error/help count, 1–5 satisfaction |
| Canvas–published parity | 15 | Canvas vs. published screenshot; ratio of blocks drawn with real appearance (target ≥ 80%) |
| Maintenance risk | 20 | Number/size of new dependencies, 0.x/maturity, number of imports depending on Payload internal APIs, fork requirement, release cadence |
| V5 effort | 20 | Person-day estimate from pilot report, with independent review by Opus |
| Performance/accessibility | 10 | Admin editor open time, interaction latency, keyboard block reordering |

**Decision rule:** highest score among those passing the gates. If the difference is < 10, native wins (zero data conversion, fewer dependencies). The result is written as a one-page decision note in `docs/editor-pilot/decision.md` and submitted for user approval.

### V5 — Full implementation of the chosen editor

- **Shared scope:** `pages` + `products` (first wave). `solutions`, `case-studies`, `product-families` second wave. All blocks (21 + 8 bound), Motion panel integration, undo/redo, autosave queue, concurrency (Payload document lock + `updatedAt` comparison; "reload" warning to user on conflict with MCP write), keyboard access (select/move block), editor guided tour (4-step tooltip on first open).
- **If Puck is chosen:** extend adapter to all field types, Payload drawer bridges (media/relationship/Lexical), canvas preview strategy, `@puckeditor/core` version pinning + upgrade note. Estimate **10–15 person-days**.
- **If Native is chosen:** harden bridge (or what-digital fork), inline text coverage, block add palette (card + thumbnail `public/admin/blocks/*.webp`), drawer focusing, drag-and-drop. Estimate **6–10 person-days**.
- **Taking over pilot code:** new branch `feat/visual-editor` from main. Only reviewed modules (adapter/bridge, tests) are copied file-by-file from the winning pilot and re-audited. The losing branch is tagged `archive/pilot-<name>` and deleted; its report stays under `docs/editor-pilot/`.
- **Acceptance:** all V4 gates across all blocks. 8 tasks within target time. Existing e2e/isolation tests green. `Görsel düzenle` in admin visible only to staff.
- **Tests:** adapter/bridge unit tests (round-trip fixture for every block type), `visual-editor-db.test.ts` (temp SQLite, TR/EN, Lexical), e2e `visual-editor.spec.ts` (8-task automation, isolated 3400), bundle guard, security e2e (forged postMessage, anonymous access).
- **Risks:** Payload admin internal API changes (editor e2e mandatory on every Payload upgrade), autosave + inline caret collision, canvas performance on large pages.

### V6 — QA, performance, acceptance, and guide

- Re-run the 432-shot visual tour (`scripts/qa-screenshots.mjs`) + preset gallery page (`pageType: template`, noindex).
- Lighthouse 3-run median (`scripts/perf-lighthouse.mjs`): text pages preserve LCP < 2.0 s. Image-heavy LCP **does not regress** from F11 value (2.53 s). JS ≤ 130 KB, CLS 0, TBT < 150 ms. INP proxy < 200 ms on animated product page.
- Security audit: preview, bridge messages, editor view access, MCP, upload (including 3.93 fixes).
- `docs/editor-guide.md`: `Görsel düzenle`, moving blocks, `Hareket` panel (preset cards, when not to use), product page sections, TR/EN flow, common mistakes. `AGENTS.md`: `motion` fields, bound product blocks, MCP recipe (product layout order). `memory-bank` update.
- **Acceptance:** `docs/perf/visual-editor-acceptance.md` table green + user approval.

---

## 3. Parallelism and sequencing rules

- **Schema-changing tasks are strictly sequential:** V0 → V1-S → V2-S. There are never two open migration branches at the same time. In previous experience, parallel `migrate:create` runs conflicted on snapshot JSONs and generated `down` migrations containing `__new_` table rebuilds. The next `migrate:create` does not start until the previous migration is merged into main.
- **Non-schema tasks run in parallel:** V1-C, V1-UI, V2-R, V3a, V3b. File ownership is separate:
  - V1-C: `globals.css` motion section, `src/lib/anim.ts`, `src/lib/motion.ts`
  - V1-UI: `src/admin/fields/**`, `admin-i18n.ts`
  - V2-R: `src/components/blocks/product/**`, `product-composition.ts`, product `page.tsx`
  - V3a: `src/editor/puck/**`
  - V3b: `src/editor/canvas/**`
  - Shared files (`block-shell.tsx`, `render-plan.ts`, `registry.ts`, `payload.config.ts`) are assigned to a single owner (V1-C/V2-R sequentially). Pilots only consume changes in these files via rebase. V3b's `editing` flag is a small patch and is handed off to the V2-R owner.
- `pnpm generate:types` / `generate:importmap` runs only on the schema owner's side. Pilots regenerate `importmap` only on their own branch.
- Build and typecheck are not run concurrently (`.next-*/types` race). Heavy SQLite tests use `--maxWorkers=1`.
- At the end of each phase, the next schema phase does not start until cross-QA passes.

---

## 4. Agent allocation

Rules: Opus 5.5 Medium for core architecture, Opus High only for the most critical data path. Sonnet 5.5 Medium/Low only (never High). Terra for focused diagnostics/perf/QA (not given long multi-step phases). Sol for migrations/upgrades/tests/clear tasks + QA. Haiku Low for labels/translations/guides + commit operator. **Author ≠ reviewer**: if Claude wrote it, Sol or Terra High reviews it; if GPT wrote it, Opus Medium reviews it.

| Phase | Author (effort) | Reviewer (effort) | Note |
|---|---|---|---|
| V0 Payload 3.93 | GPT 6.1 Sol (High) | Claude Opus 5.5 (Medium) | Clear upgrade + tests; includes release note scan |
| V1-S motion schema + `block-motion.ts` | Claude Opus 5.5 (Medium) | GPT 6.1 Sol (High) | Sol reviews migration SQL (rule 6) |
| V1-C CSS contract + LCP protection | Claude Sonnet 5.5 (Medium) | GPT 6.1 Terra (High) | Terra: LCP/CLS/reduced-motion measurement |
| V1-UI Motion panel + preset cards | Claude Sonnet 5.5 (Medium) | GPT 6.1 Sol (High) | Bundle guard + a11y check |
| V1 labels TR/EN | Claude Haiku 5.5 (Low) | GPT 6.1 Sol (Medium) | `admin-i18n.ts` |
| V2-S bound block schema + autosave | Claude Opus 5.5 (Medium) | GPT 6.1 Sol (High) | |
| V2-R `composeProductLayout` + renderer | Claude Opus 5.5 (Medium) | GPT 6.1 Terra (High) | Visual parity + query count |
| V2 block components (visual) | Claude Sonnet 5.5 (Medium) | GPT 6.1 Terra (High) | Wraps existing components |
| V3a Puck adapter | Claude Opus 5.5 (Medium) | GPT 6.1 Sol (High) | Round-trip tests under Sol's review |
| V3a Puck UI shell | Claude Sonnet 5.5 (Medium) | GPT 6.1 Sol (High) | |
| V3b what-digital spike | GPT 6.1 Terra (High) | Claude Opus 5.5 (Medium) | Half-day time-box, focused diagnostics |
| V3b bridge (`bridge` + `admin-host`) | Claude Opus 5.5 (Medium) | GPT 6.1 Terra (High) | postMessage security by Terra |
| V3b toolbar UI | Claude Sonnet 5.5 (Medium) | GPT 6.1 Sol (High) | |
| V4 measurement + metric collection | GPT 6.1 Sol (Medium) | Claude Opus 5.5 (Medium) | Gate tests and bundle measurement; decision note Opus + user |
| V5 core data path (adapter/bridge save, locale, conflict) | **Claude Opus 5.5 (High)** | GPT 6.1 Sol (High) + Terra (High) security | Most critical work in the plan; single Opus High point |
| V5 UI/panel/palette | Claude Sonnet 5.5 (Medium) | GPT 6.1 Sol (High) | |
| V5 tests (fixture round-trip, e2e 8 tasks) | GPT 6.1 Sol (Medium) | Claude Opus 5.5 (Medium) | |
| V6 perf/QA | GPT 6.1 Terra (High) | Claude Opus 5.5 (Medium) | Measurement-focused, split into short tasks |
| V6 guide + AGENTS.md + memory-bank | Claude Haiku 5.5 (Low) | GPT 6.1 Sol (Medium) | |
| End-of-phase commit | Claude Haiku 5.5 (Low) | — | Only when QA is green; simple message |

Quota balance: since V1-S, V2-S/R, and V3 are Claude-heavy, V4 measurement and V6 are GPT-weighted.

---

## 5. Open questions (for the user)

1. **Level of freedom:** Our recommendation is editing within blocks and grids instead of Wix's freeform pixel positioning. In the first version, do you also want nested columns/slots inside blocks (e.g., another block inside a two-column section), or is a single-level block list sufficient?
2. **Fixed parts of the product page:** Should the `Teklif İste` (Request a Quote) button remain mandatory on every product page? Should Downloads, Documentation, and the sticky tab bar be sections the editor can remove, or only reorder?
3. **Pilot evaluation:** We recommend that you perform the 8-task editor test yourself (about 30–45 minutes, two editors). Are you available? If so, should your satisfaction score be decisive in the decision (all 35 points)?

## V0 implementation record — 2026-11-08

Target verified against npm `latest` and GitHub stable release: **3.93.0**. `payload` + 10 direct `@payloadcms/*` packages and transitive Payload packages in the lockfile are on the same version. Next **15.4.11**, React/React-DOM **19.2.6**, and TypeScript **5.7.3** are preserved. `@payloadcms/next` peer range includes `>=15.4.11 <15.5.0`; UI/Lexical React range includes `^19.2.1`; no Next upgrade is required.

### Reviewed GitHub release notes and project impact

| Version | Notable changes and implementation decision |
|---|---|
| [3.86.0](https://github.com/payloadcms/payload/releases/tag/v3.86.0) | Form Builder translations; Live Preview `openByDefault` option; URL pathname regex security and draft reupload. Existing TR/EN labels/preview config preserved; no need to enable the new option. |
| [3.87.0](https://github.com/payloadcms/payload/releases/tag/v3.87.0) | Tab localization, count locale propagation, null array/block, Drizzle localized block dedup, and table name length check. Existing constrained `find` slug protection preserved; schema generation produced no collision errors. Template preview security fix is compatible with existing staff-only preview. |
| [3.87.1](https://github.com/payloadcms/payload/releases/tag/v3.87.1) | HMR endpoint by Next version; MCP SDK **1.30.0** security fix; Lexical link drawer state. AuthStrategies were not assumed to refresh on HMR; dev was not restarted. |
| [3.88.0](https://github.com/payloadcms/payload/releases/tag/v3.88.0) | Multipart Content-Type backtracking; block/array clipboard row leak; MCP API key collection default access tightened. The project's narrower explicit `nobody` policies are preserved. Template Next 16 upgrade is not a mandatory peer for this project. |
| [3.89.0](https://github.com/payloadcms/payload/releases/tag/v3.89.0) | **Breaking:** jobs access defaults. The project has no custom jobs or experimental MCP jobs. Drizzle hasMany select, name collisions; version diff, read-only rich text, fast title entry, and invalid preview URL fixes. |
| [3.90.0](https://github.com/payloadcms/payload/releases/tag/v3.90.0) | Critical security and **mandatory SQL migration**: auth `resetPasswordRequestedAt`. Session revocation on password change, forgot/reset lockout-throttle; API key shown only on initial generation. SVG/XML validation, safe external fetch/origin, upload filename, and client upload receipt/prefix protections; multipart default **50 MB**. Legacy-relaxing `reveal`, `allowRestrictedFileTypes`, and `skipSafeFetch` were not enabled. Since local storage is used, no cloud `_objectKey` column was created; no cloud CORS/prefix config needed. Form access overrides are already explicit. Polymorphic join constraints produced no new invalid queries. Lexical **0.50.0**: no data conversion needed for built-in content, no direct Lexical dependency/custom nodes. No jobs table/scheduled jobs in copy or live backup; no re-queuing needed. |
| [3.90.1](https://github.com/payloadcms/payload/releases/tag/v3.90.1) | Fixed top-level `where` query leaking into inner relationships. No custom patch needed. |
| [3.90.2](https://github.com/payloadcms/payload/releases/tag/v3.90.2) | Next/libSQL tracing include and trailingSlash; MCP create/update TS6 strict prologue fix. TS5.7 preserved; verified with real MCP tool calls. |
| [3.91.0](https://github.com/payloadcms/payload/releases/tag/v3.91.0) | MCP find arguments (locale/fallbackLocale/draft/select/populate/joins/trash/pagination); SQLite batch size by table column count, localized `_parent_id` indexes; draft findByID access. **Breaking:** Node baseline and Nodemailer **10**; we have no custom Nodemailer transport object, `transportOptions` compatible. Azure storage is not used. Activity-aware admin session and custom block view/condition fixes received. |
| [3.92.0](https://github.com/payloadcms/payload/releases/tag/v3.92.0) | **Breaking:** Node `^22.23.4 || >=24.22.1`; project engine **>=24.22.1 <25**. Host **24.21.0** unchanged; checks ran with official SHA256-verified temporary **24.22.2** runtime. Locale-all validation, field access id, Drizzle polymorphic locale join, and admin upload callback fixes. |
| [3.92.1](https://github.com/payloadcms/payload/releases/tag/v3.92.1) | Reset password field validation; nullable GraphQL virtual fields; cloud processed-upload fixes. PostgreSQL localizeStatus migration fix does not apply to SQLite. |
| [3.93.0](https://github.com/payloadcms/payload/releases/tag/v3.93.0) | **Security:** block children read access enforced in query; each block field accepts only its own types; URL upload `pasteURL` restrictions; XSL/XML response policy; Lexical HTML escaping. Localized shared draft fields preserved; config label interpolation and drawer/create card translation, virtual-field duplicate autosave fixes. Existing block lists and staff-only preview preserved. `auth.passwordHashIterations` default unchanged. |

During the upgrade, [3.85.2](https://github.com/payloadcms/payload/releases/tag/v3.85.2) (CLI/tsx, bulk block ID, Markdown line endings, and security dependencies) was also read. Local evidence of all release bodies: `v0-release-notes.md` / `payload-releases.json` inside the scratchpad below.

### Compatibility and rollback

- **JWT sessions:** installed 3.93 signer/verifier sources require the new signed `authVersion` header. Portal uses `payload.login`; application code unchanged. JWT tests use the `JWT_AUTH_VERSION` export and lock down rejection of old/wrong-header tokens. After admin restart, old admin/portal sessions require **logging in again**.
- **Upload:** rejection of active SVG and sandbox/nosniff response for safe SVG are tested. TIFF physical format/metadata stripping is preserved; new uploads get the canonical `.tif` extension. Existing files are not moved. Multipart uploads over 50 MB require a separate, deliberate `upload.requestSizeLimit` decision; default was not relaxed.
- **Draft:** rejection of a draft-only page from the `homePage` relationship filter was tested; if a legacy DB reference exists, the public loader still falls back to published `home`. No patch reverting the new localized draft behavior was added.
- **MCP:** `overrideAuth`, `req.payload` Proxy, allowlist, licenses delete ban, and closed `payload-mcp-api-keys` are preserved; fresh handler **69** tools. Anonymous/editor/customer/session rejection; find argument schema, TR/EN create-update, key unreadability/revocation on role demotion were verified. Root argument format was corrected in AGENTS.md. Upstream `mcp-handler@1.1.0` SDK peer is 1.26.0, Payload's SDK is 1.30.0: the pnpm warning that also existed in the previous install was explicitly recorded; the security SDK was not downgraded, and the peer error was not hidden.
- **Migration:** `20261108_093334_v0_payload_393` = **2 ADD COLUMN + 309 CREATE INDEX**. `up` contains no DROP/DELETE/`__new_`; `down` removes only its own 309 indexes/2 columns. Created and first applied on DB copy; 680 tables had **0** old column/row diff, integrity **ok**, FK **0**. New regression test preserves key, session, TR/EN block, and version data across up/down/up in a transaction. The same migration was applied on live DB as well; first `softmarket-pre-v0.db` + `-wal`/`-shm` raw backup and consistent `softmarket-pre-v0.snapshot.db` via SQLite backup API were taken (integrity/FK verified). After live application, 680 tables again had **0** old column/row diff, integrity **ok**, FK **0**. No other pending migrations were applied.
- **Scratchpad:** `/private/tmp/claude-501/-Users-ozcelik-dev-softmarket/86cb568c-5f6b-4b21-b0fe-e6a5de07c79f/scratchpad`. Prior copies of package/lock are `v0-before-*`; prior schema snapshots are preserved. On rollback, package/lock files are reverted together; backup DB snapshot (raw copy with WAL/SHM also available) is restored while process is stopped. No restore is done onto a running DB; rollback was not needed in this task.

### Final verification and operational status

- `pnpm generate:types` passed; `pnpm generate:importmap` passed, **No new imports** (importMap file unchanged).
- `pnpm typecheck`, `pnpm lint`, and `pnpm test --maxWorkers=1`: **56 files / 703 tests passed**. Including admin TR/EN labels, Live Preview/draft, MCP, SQLite/media/portal regressions. Compatibility diffs from the first run were closed with the test fixes above; no security default was removed by relaxing tests.
- `NEXT_DIST_DIR=.next-prod PORT=3200 pnpm build`: succeeded with copy DB/uploads, **118** static pages; existing local canonical URL warning continues. `tsconfig.json`/`next-env.d.ts` unchanged.
- **3200 smoke:** `/tr`, `/en`, `/tr/urunler`, `/tr/urunler/akis-yonetimi/akis-merkezi`, `/admin` **200**; POST `/api/mcp` anonymous **401**; `/api/preview?redirect=/tr` anonymous/same-origin **401**; `/tr/olmayan` **404**. Parameterless `/api/preview` returns **400 Invalid redirect** per existing redirect validation order; behavior unchanged.
- `pnpm test:e2e:isolated`: separate DB copy, **1/1 passed** (API publish/block order + staff preview positive check + anonymous 401; this test does not launch a browser). Temporary 3400 and uploads were automatically cleaned up.
- A separate copy was used for the fresh MCP test; API keys were generated only in memory, no fixtures were written to live. Tool list and results in `v0-mcp.log`; test/build/smoke/E2E evidence in `v0-tests.log`, `v0-build.log`, `v0-smoke.json`, `v0-e2e.log`.
- Final test audit: migration test sets up only pre-V0 even when subsequent V1/V2 migrations are added; relationship rejection assertion specifically requires HTTP 400. Final focused rerun of these two files **6/6 passed**.
- **3200/3400 closed** (no listener), **3100 PID 53048** same and open; `.next` was not deleted, no restart/signal/HTTP request was made to the dev process. `pnpm install` can break running dev HMR; dev was not touched to fix this. **The admin must perform a normal dev restart after upgrading host Node to >=24.22.1**; old sessions will require logging in again. No commit.

**Changed files:** `package.json`, `pnpm-lock.yaml`, `src/payload-types.ts`, `src/migrations/index.ts`, `src/migrations/20261108_093334_v0_payload_393.{ts,json}`, `tests/unit/payload-version.test.ts`, `payload-upgrade-migration.test.ts`, `media-pipeline.test.tsx`, `media-upload.test.ts`, `page-builder-db.test.ts`, `portal.test.ts`, `AGENTS.md`, `README.md`, `memory-bank/{activeContext,progress,techContext}.md`, this plan. Prior plan and activeContext edits made by the user were preserved. No compatibility patch was needed in application access/preview/render/config code.

## User decisions (2026-11-08)

- Nested columns/slots: **none for now** — single-level block list; column layouts via ready-made blocks. Nested structure deferred to a later version.
- Product page: **`Teklif İste` (Request a Quote) mandatory** (cannot be removed; only its position can change); Downloads, Documentation, and the tab bar can be moved or removed.
- Pilot decision: the **user will perform** the 8-task trial themselves; its result will be decisive in the V4 decision score. The user will be notified once pilots are ready.
- Seed re-import (decision b): if the existing product's latest draft/autosave layout contains bound blocks and the seed does not, the layout is excluded from TR/EN conversion/writing; other fields are updated, warning + exit 0. Import preserves the publish flow (draft composition goes live); a composition seed is written with V2 validation. Layout structure is shared; a composition seed in only a single locale is invalid. `--dry-run` rolls back the same transaction flow; pages are unaffected.

## V1 implementation record — 2026-11-08

**Deviations from plan (by user request):** preset list is `auto, none, fade, slide-up, slide-down, slide-left, slide-right, zoom-in, parallax-soft, stagger` (`fade-up` in plan → `slide-up`; `slide-down` and `stagger` added). `scroll-progress` added to triggers (CSS scroll-driven, `@supports`). `spacer`, `divider`, `listing` blocks do not receive `motion` (no visible content / list belongs to route). Direction name is movement direction: `slide-left` enters from right to left.

**Data (V1-S):** `src/fields/block-motion.ts` (`MOTION_*`, `blockMotion()`, `resolveMotion()`, `motionEnumName`, `validateHeroPreset`); `blockMotion()` after `blockSettings()` in every block definition. Selections cannot be cleared (`isClearable:false`). Migration `20261108_100715_blocks_motion`: **1134 `ALTER TABLE … ADD`** (162 block tables × 7 columns, defaults = field defaults; old rows get `auto`). No DROP/DELETE/`__new_` in `up`; generated `down` only `DROP COLUMN`s the same 1134 columns (no rebuild, no manual writing needed). Test: `tests/unit/block-motion-migration.test.ts` (up → defaults, down → row-for-row identical across all tables, up again). Previous phase DB tests (`blocks-appearance-migration`, `blocks-static-migration`, `page-builder-db`) also apply this migration for reading. Migrate + `content:import --dry-run` on copy DB (0 errors, 98 updates); live backup `scratchpad/softmarket-pre-v1.db{,-wal,-shm}` + `softmarket-pre-v1.snapshot.db`; after live migrate, 681 tables had 0 old column/row diff, integrity ok, FK 0. `payload-types.ts`, importmap (card component only), and `content/seed/schema.json` were regenerated.

**CSS contract (V1-C):** `anim(index, motion, 'item'|'container')` → `data-anim="<effect>"` (`auto` → `subtle`), `data-anim-trigger` (absent on scroll; parallax always `scroll-progress`), `data-anim-safe` (LCP), `data-anim-mobile`, and `--anim-dur|--anim-delay|--anim-ease|--anim-stagger` only when different from default. Default markup is byte-for-byte identical to pre-V1 (tested). `globals.css`: only `--m-o`/`--m-from`/`--m-hover` per effect; all rules in `:where()` (does not override `.card-hover`), inside `prefers-reduced-motion: no-preference`, and gated by `html:not([data-motion=none])`; `load` = `motion-in` keyframe (backwards), `hover` = `(hover:hover)` transform, `scroll-progress` = `animation-timeline: view()` + `animation-range: entry 0% entry 280px`, parallax `cover` range and default ≥ 768 px. Sections with horizontal effects have `overflow-x-clip`. MotionObserver does not observe `[data-anim-trigger]` elements. Hero: `heroMotion()` applies direction/duration/delay/easing via `--hero-dx/dy`, heading/lead only slide; `parallax-soft` applies to hero media.

**LCP rule:** `planBlocks` applies `protect` to the first visible block and every `hero`; `fade`/`zoom-in`/`stagger` → `slide-up`, all entrances except hover are `safe` (start at opacity 1, no scale). Legacy `auto`+scroll unchanged (observer does not hide elements in viewport). Hero field accepts only safe presets (validate); admin shows 7 cards on hero.

**Admin (V1-UI):** `src/admin/fields/motion-preset-cards.tsx` (client, import map only; frontend import forbidden by test), pure-CSS mini preview tracks duration/delay/easing, `Tekrar oynat` (Replay), hero/first-block note. Labels in `MOTION_LABELS` (`admin-i18n.ts`). `docs/editor-guide.md` §2.6a.

**Verification:** typecheck, lint clean; `pnpm test --maxWorkers=1` **58 files / 728 tests** green (new `block-motion.test.tsx` 23 tests + migration test). `NEXT_DIST_DIR=.next-prod` build (copy DB, 122 pages). 3300 (copy DB + fixture `/tr/v1-hareket-test`, `/tr/v1-ilk-blok`, content:import 2× idempotent: 2 created → 2 updated) Playwright **27/27**: 390/1440 screenshot of every preset + scroll video, CLS 0 (test page and /tr), horizontal overflow 0, hero h1 opacity 1 at DOMContentLoaded, first block zoom-in/load → slide-up safe opacity 1, /tr old pending state (0 / 12px) and `subtle`-only markup, reduced-motion and `data-motion=none` static, all content visible with JS disabled; 10 cards in admin panel (7 on hero), card selection updates form. Lighthouse mobile (3-run median) /tr: Perf 100, LCP 1.06 s, CLS 0, TBT 10 ms, JS 129.4 KB (previously 129.0); test page Perf 100, LCP 1.06 s, CLS 0. Motion CSS source gzip +0.9 KB (≤ 2 KB). Evidence: scratchpad `v1/shots/`, `v1/lh/`, `v1-tests.log`. 3200/3300 closed; temp QA DB/user deleted; 3100 and `.next` untouched. No commit.

## V2 implementation record — 2026-11-08

**Decisions (aligned with user decisions):** single-level list. **`productEditions` (`Sürümler` + `Teklif İste`) mandatory:** movable, cannot be deleted, cannot be hidden (no `hidden` field/column on the block). Two-layer enforcement: (1) write-side `products.layout` `validate` (admin form + publish) and field `beforeChange` hook enforcing the same rule on every write including draft/autosave → `ValidationError` 400 (REST, GraphQL, MCP, Local API, `content:import`; Hero preset pattern); (2) render-side `composeProductLayout` still appends a missing/hidden editions block (for old/manually written data that bypassed validation). `productHero` (h1 + breadcrumb + top `Teklif İste`) cannot be hidden and **must be the first block** (plan V2-S rule; the "move hero below features" acceptance item is therefore rejected, and the renderer also moves it to the top); if completely absent, the default intro is drawn at the top (plan V2-R). Downloads, Documentation, Tab bar, and other sections are free (move/hide/delete). Section ids are fixed; bound blocks have no anchor field.

**Schema:** `src/blocks/product-bound.ts` (8 blocks, `products.layout` only = `productBlocks`; `layoutBlocks`/`pageBlocks` unchanged), `productSpecs.showRequirements` (default `true`), block picker group `Ürün sayfası bölümleri` (Product page sections). `blockSettings(slug, { anchor, hideable })` additive option (identical output on existing blocks). `LCP_BLOCK_TYPES` += `productHero` (only `HERO_PRESETS`, hook also on draft). Products `versions.drafts.autosave.interval = 2000`. Migration **`20261108_130717_v2_product_bound_blocks`**: up = 16 `CREATE TABLE` (8 × normal/`_v`, with motion columns) + 49 `CREATE INDEX` + 1 `ALTER TABLE _products_v ADD autosave` (+ index); no DROP/`__new_`/DELETE. Generated `down` drops only these 16 tables, indexes, and column (no rebuild, no manual writing needed). Test `tests/unit/product-bound-db.test.ts`.

**Render:** `src/lib/blocks/product-composition.ts` (compatibility/composition mode, virtual `virtual:<type>` blocks, nav section derivation, write rules + TR/EN messages). `src/components/blocks/product/product-blocks.tsx` produces pre-V2 markup identically; virtual blocks have no `data-block` and no motion (hero entrance and feature card reveal as before). Saved blocks have appearance (theme, spacing, align, separator) + motion (`anim` container, x-clip, hero `heroMotion` + parallax image). `PageHero` `enter`/`asideMotion` optional props (default old output). Page only loads data (same queries, `readAs`), generates JSON-LD/metadata, and calls a single `RenderBlocks` (`slots.product`). Layout `hero` blocks are h2; single h1 `productHero`.

**Verification:** `pnpm typecheck`, `pnpm lint` clean; `pnpm test --maxWorkers=1` **66 files / 1005 tests** (new `product-composition.test.ts` 15, `product-bound-db.test.ts` 7; `blocks-core`, `live-preview`, `blocks-appearance-migration` updated for V2). Migrate + `content:import --dry-run` on copy DB (0 errors, 98 updates); fixture with bound blocks 2× import idempotent (1 created → 1 updated, no duplicates), fixture without editions rejected. Live backup `scratchpad/softmarket-pre-v2.db` (+ `.raw.db`/`-wal`/`-shm`); after live migrate, 681 old tables had 0 row diff, integrity ok, FK 0 (697 tables). Prod build (`.next-prod`, copy DB) 118 pages; 3200: `/tr`, `/en`, `/tr/urunler`, `/admin` 200; nonexistent product TR/EN 404. 8 products × TR/EN: `<main>` HTML of 14 old pages (layout only faq+cta) is **byte-for-byte identical** to pre-V2 baseline (Suspense markers normalized); copy product moved to composition (`belge-rotasi`) produced expected order, `data-block`, `slide-left`/`zoom-in`, and single h1; all products have `teklif-iste?urun=…&surum=` links. Lighthouse mobile (3-run median): `/tr/urunler/akis-yonetimi/akis-merkezi` Perf 100, LCP 1.21 s, CLS 0, TBT 2.5 ms, JS 129.4 KB; composition product Perf 100, LCP 1.21 s, CLS 0. SEO 92 = known local canonical warning. 3200 closed; 3100 and `.next` untouched. No commit.

## V4 decision record — 2026-11-08

- Decision: Payload-native canvas (custom bridge). Puck (`pilot/puck`) dropped, archive tag `archive/pilot-puck`.
- Rationale: in the user trial, native canvas was preferred ("stay within Payload infrastructure"); published output 100% pixel-equivalent; public JS +0.17 KB; V5 estimate 6–8 days (Puck ~12); no new runtime dependencies; no data conversion.
- Puck passed all gates, but canvas parity of 79% and the dependency/effort difference put native ahead.
- Addition: visual editor is the default view; form remains as a narrow side panel (media/rich text/relationship and validation via form). `what-digital` was rejected (no postMessage origin check).
- Details and reports: [docs/editor-pilot/decision.md](editor-pilot/decision.md).

## V5 implementation record — 2026-11-09 (branch `feat/visual-editor`)

**Default view path:** public `admin.livePreview.openByDefault` (3.86+) + `beforeDocumentControls` host + `custom.scss` (form `clamp(340px,30%,460px)`, canvas remaining width) INSTEAD OF Payload custom edit view. Rationale: Payload's own edit view/form/validation/lock/autosave chain stays intact; a custom view would have required rebuilding DocumentInfo/Form providers and save buttons (far more internal APIs). `Klasik forma geç` (Switch to classic form) calls `setIsLivePreviewing(false)`; because Payload writes this to the `editViewType` preference, the host writes the preference back to canvas after 800 ms (every open is visual).

**Modules (`src/editor/canvas/`):** `fields.ts` (inline field allowlist: 17 block types + products/pages document fields, safe path), `protocol.ts` (zod/mini, v2, bidirectional origin+source, strict schema), `rules.ts` (V2 locks, id/virtual resolution, move index, materialize, palette), `history.ts` (undo/redo, 50 steps), `bridge.tsx` (iframe: selection, toolbar, pointer drag, ↑/↓ select, Alt+↑/↓ move, Enter/Delete/Esc, hidden badges, host-approved `plaintext-only` editing, plain-text paste), `admin/host.tsx` (editor bar, form API applier, palette, tour, materialize, history), `admin/reveal.ts` (opening row + `Görünüm`/`Hareket`/`Gelişmiş` via MutationObserver, no fixed delay), `admin/sync.ts` (pagehide/visibilitychange keepalive flush, beforeunload over 60 KB, `updatedAt` conflict warning), `admin/palette.tsx`, `admin/tour.tsx`, `plugin.ts`. Server: `planBlocks({ editing })`, `EditableBlock/editText/fieldAttrs/docFieldAttrs`, `isEditingRender()`; 13 frontend routes (home page, landing, legal, 9 system pages, product). Labels `src/lib/visual-editor-labels.ts` (re-exported by admin-i18n). No schema/migration.

**Gates (V4 table):** round-trip 0 diff (temp SQLite, products+pages TR/EN) · Lexical identical · TR/EN 0 leaks (DB test + e2e T6) · public bundle: same script (`scripts/perf-lighthouse.mjs`, mobile, 3-run median, same DB copy) main 129.31 KB → V5 129.62 KB (+0.31), no editor trace · security: 5 forged postMessage variants + anonymous admin/preview/HTML/script rejection, unit gate tests · MCP `findProducts` (Bearer, draft) + `content:import --dry-run` (0 errors, 98 updates, `akis-merkezi layout korundu`) — **all green**.

**Measurements:** e2e automation times (no think time, 3400 isolated): open 0.9 s; T1 3.2 s, T2 3.4, T3 3.1, T4 3.5, T5 4.1, T6 4.7, T7 0.1, T8 0.2 (total ≈ 22 s). Lighthouse mobile /tr and product: Perf 100, LCP 1.05 s, CLS 0, TBT ≤ 8 ms. Bridge chunk 8.5 KB gz (staff draft iframe only), admin host chunk 15.1 KB gz.

**Tests:** `visual-editor-fields.test.tsx` (74: schema↔allowlist, per-block public unmarked / editing marked / round-trip), `visual-editor-bridge.test.ts` (33), `visual-editor-db.test.ts` (5), `client-bundle-guard` (+3), `admin-labels` (+1); e2e `tests/e2e/isolated/visual-editor.spec.ts` 16 scenarios + existing block-order = 17/17. `pnpm test --maxWorkers=1`: 70 files / 1154 tests, 1 red = `content-import.test.ts › rejects media outside` (also red on main: `content/legal/tr/eula.md` not in git, only in main working directory; unrelated to V5).

**Remaining open:** no editing in popup preview; tabs tab label, testimonial name/role, stats value, rich text, and links via form only; form history (`REPLACE_STATE`) undo on Lexical field not verified; conflict check is focus + 15 s polling (not instant); new block with empty required fields stays in draft, rejected by Payload validation on publish/import; user's own 8-task trial; second-wave collections.


### V5 audit note — 2026-11-09

The "all green" and zero-data-loss claims in the V5 record are not sufficient for production acceptance. The `updatedAt` check is periodic and independent of writes; Payload autosave continues, and an external write can be overwritten before the check runs. Until server-side atomic version checking / conditional writes are verified, the concurrency gate remains open. The previous TR/EN gate did not cover the Escape scenario on an empty fallback field; that path was fixed. Language switching after a failed flush and the UTF-8 keepalive limit were also fixed. Comprehensive re-verification across all blocks, roles, and browsers is required.

### V5 P1 closure record — 2026-11-09

**What Payload `lockDocuments` (3.93) provides:** while a document is open, it prevents a user OTHER than the lock holder from opening/updating it in admin (`checkDocumentLockStatus`). Another tab of the same user, MCP with the same user's API key, and the first saver's autosave are not covered; Payload's "stale data" check is also disabled on collections with autosave. Because this is insufficient, our own check was added (lock stays enabled).

**Solution (no schema change):** `src/editor/canvas/concurrency.ts` — virtual hidden `editorVersion` field on pages/products (afterRead = `updatedAt` of the read document; latest draft version on draft read; no DB column) + first collection `beforeChange` hook. The admin form (visual + classic; autosave, save draft, publish, pagehide flush) carries the version; the hook reads the latest draft `updatedAt` inside the same transaction (`req`) and throws `APIError` **409** on mismatch. Writes not carrying a version (MCP, content:import, Local API, scripts) pass through unchanged; the editor's next save then receives 409. Client (`admin/host.tsx`, `admin/sync.ts`): form version is kept current after Payload saves/flush/undo-redo; conflict check runs immediately after a failed save; in the warning, **`Birleştir ve kaydet`** (Merge and save) (field-level three-way: base = last saved, remote = current draft, local = form; on two-sided changes local wins and is listed; `form.reset` + new version), **`Değişikliklerimi kopyala`** (Copy my changes) (JSON of changed fields, clipboard + selectable text), **`Yeniden yükle`** (Reload) (with confirmation). Local changes remain in the form on 409.

**Race window:** read-compare-write in the same SQLite transaction (`BEGIN IMMEDIATE`). In measurement, libsql was observed opening a second concurrent transaction on a new connection without busy-timeout and throwing `SQLITE_BUSY` on `BEGIN`, after which in-process writes became invisible to reads (lost update) (Payload/libsql behavior, predating V5). `src/lib/db-serial-transactions.ts` serializes in-process transactions (5 s timeout, released on commit/rollback); one of two concurrent saves cleanly receives 409.

**Evidence:** `visual-editor-db.test.ts` 10/10 (stale version 409 + data unchanged, versionless write passes, two concurrent saves: 1 wins 1 × 409, then reload-and-save visible, three concurrent versionless writes + subsequent write visible, pages also protected), `db-serial-transactions.test.ts` 3/3, e2e `P1: …409…merge` (REST/MCP-like external write → editor autosave 409, external summary preserved, title stays only in form, copy, merge → both saved, subsequent edits save normally).

**QA P2 (Terra) reviewed and preserved:** Escape on an empty EN fallback writes back the empty value; language switch stops on a failed/racing save; undo history is separated by locale (Host key includes locale); keepalive limit is in UTF-8 bytes, only identical requests coalesce. Additional fix: undo/redo does not restore the old snapshot's version (otherwise 409).

| Gate (V4) | Result (2026-11-09, `.next-v5`, Chromium) |
|---|---|
| Data round-trip | 0 diff (DB test, products+pages TR/EN; excluding `editorVersion`) |
| Lexical | identical |
| TR/EN | 0 leaks: e2e T6 + Escape fallback + DB test |
| Concurrency / 0 data loss | **closed**: server 409 + transaction serialization; e2e P1 + DB concurrency test |
| Public bundle | /tr and product mobile LH (3-run median): Perf 100, CLS 0, JS 129.62 KB (main 129.31), no editor trace |
| Security | 5 forged postMessage variants + anonymous admin/preview/HTML/script: green |
| MCP / import | MCP `findProducts` + `content:import --dry-run` (0 errors) in previous run; P1 does not alter versionless writes (DB test) |

Isolated e2e (3400, `E2E_SOURCE_DB` copy, `E2E_NEXT_DIST_DIR`): **20/20**. `pnpm test --maxWorkers=1`: 71 files / 1163 tests, single out-of-scope red `content-import › rejects media outside` (`content/legal/tr/eula.md` absent in worktree). Typecheck/lint clean.
