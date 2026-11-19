# V3a — Puck pilot report (2026-11-08)

Branch `pilot/puck` (from main `fc22469`). Numerical results: `docs/editor-pilot/puck-metrics.json`. Pilot code is disposable quality (plan §V3a, "Pilot common rules").

## What was built

- **Dependency:** `@puckeditor/core` **0.24.0** (exact version; MIT; peer `react ^18 || ^19`; build and runtime verified with React 19.2.6 / Next 15.4.11). The package `exports` includes a `react-server` condition; the editor is used only in a client component. `no-external.css` is used for Puck CSS (no rsms.me font requests, CSP clean).
- **Admin:** `Görsel düzenle` ("Visual edit") tab on the `products` document screen (`src/admin/views/visual-puck.tsx`, Payload edit view; one line in `Products.ts`, import map regenerated). The tab navigates to the full-screen editor route: `/admin/visual-puck/<collection>/<id>`.
- **Editor route:** `src/app/(puck)/` with its own root layout (site `globals.css` + Geist). Because it lives under `/admin`, it bypasses locale middleware; no shared files with the `(frontend)` tree. Server loader `src/editor/puck/load.ts`: `users` admin/editor only; anonymous → `/admin/login?redirect=…`, customer and unsupported collection → 404. Reads run with the staff user, `overrideAccess:false`, `draft:true`, `fallbackLocale:false`. The route works for `products` and `pages` (the tab is only on `products`; `pages/6` is opened via URL to measure the home page).
- **Adapter** `src/editor/puck/adapter.ts` (pure): `payloadToPuck(layout, locale)` / `puckToPayload(data)`, `blockType ↔ type`, `id ↔ props.id`; all other keys (hidden fields, `blockName`, row IDs, Lexical JSON) pass through intact in `props`. Product compatibility mode: the editor materializes the 8 bound sections (`materializeProductLayout`); if the user does not touch them, they are stripped back out on save (`compactProductLayout`) → layout stays in compatibility mode, 0 round-trip diff. No opaque `puckData` is stored.
- **Field generation** `schema.ts` (server, Payload `Block.fields` → serializable schema) + `config.tsx` (client, schema → Puck fields): text/textarea/number/select/radio/checkbox(radio Yes/No)/group(object)/array. `row`/`collapsible`/unnamed `tabs` are flattened; Appearance and **Motion** groups get their own panels (preset/trigger/duration/delay/easing/stagger/mobile editable). upload/relationship/richText/hasMany: **read-only card** (summary + "Edited in Payload form"), value passes through verbatim; Lexical is never converted. Localized field labels carry a language badge (`Başlık · TR`). Inline (on-canvas) editing is enabled only on top-level plain text fields (`heading`, `subheading`, `eyebrow`, `intro`, `body`, `quote`, `panelTitle`).
- **V2 rules:** For `productEditions` (`Teklif İste` / "Request a Quote"), Puck `permissions.delete=false` (no delete button; 0 buttons in automation) and duplication disabled; bound blocks cannot be duplicated. Before saving, the client runs `validateProductLayout(normalizeProductLayout())`; server validation (`beforeValidate`/`beforeChange`) still runs (publishing when required EN heading is missing returns 400 → error shown in panel as `layout.6.heading: Bu alan gereklidir.`).
- **Saving** `editor.tsx`: Payload REST + staff cookie. Autosave every 2 s (`?draft=true&autosave=true`), `Taslak kaydet` ("Save draft", `?draft=true`, `_status:draft`), `Yayınla` ("Publish", `_status:published`). On language switch, the current language is saved first and the other language is re-read from the server with `fallback-locale=none` (structure is shared, text is locale-specific). `beforeunload` warning on unsaved changes. Top bar: TR/EN, 390/768/1440 (Puck viewport), undo/redo (Puck), Save draft, Preview (existing `/api/preview` staff draft mode), Publish, Close. Puck UI strings in Turkish (`dictionary`).
- **Canvas** `canvas.tsx`: because published blocks are server components, client-safe equivalents were written; same primitives and classes (`BlockShell`, `Section`, `Heading`, `FeatureGrid`, `SpecTable`, `Badge`, `buttonVariants`) and same render plan (`planBlocks` → appearance + motion resolution). Product sections render from the edited product's data (title, summary, features, specs, editions, downloads). Live-data blocks render as placeholder cards. Hidden blocks are dimmed + badged, non-default motion shows a `Hareket: Yukarı kayma · yavaş` ("Motion: Slide up · slow") badge. Canvas sets `data-motion="none"` (content does not shift while editing).

## Gates (V4)

| Gate | Result | Evidence |
|---|---|---|
| Data round-trip (product + home page, TR/EN, 0 diff) | **Passed** | `tests/unit/puck-roundtrip-db.test.ts`: fixture product/page + with `PUCK_PILOT_DB=<copy>`, **8 products + 15 pages** in the copy (clean copy and edited copy) → 0 diff. UI: Playwright `products/1` and `pages/6` Save draft TR+EN → REST layout identical |
| Lexical preservation | **Passed** | `richText`, `tabs`, `faq` answers, `systemRequirements` node JSON identical |
| TR/EN | **Passed** (0 leakage) | EN heading changed → TR unchanged; empty EN `body` remained empty; block IDs/order shared across both locales |
| Public bundle | **Passed** | `.next-pilot-puck`: 0 Puck traces across 48 public entries / 65 chunks (`client-bundle-guard` extended: source + build rule). `/tr` JS transfer **124.6 KB** (≤ 130), product page 124.8 KB |
| Security | **Passed** | anonymous 307 → login; customer 404 (loader test `forbidden`); staff 200 + `private, no-store` + `X-Frame-Options: SAMEORIGIN`; other collection 404. No postMessage bridge (Puck is in the same document). Existing preview tests green |
| MCP/import | **Failed** | After editor publish, MCP `findProducts` worked; however, post-composition `content:import --dry-run` is rejected. Plan V4 requires "Error-free"; being independent of the editor does not pass this mandatory gate. Details and re-verification below. |

## Measurements

- **Real rendering on canvas:** by block type **23/29 (79%)**. Real: hero, featureGrid, mediaText, specTable, stats, logoWall (manual logo), cta, faq (inline), richText, videoEmbed (cover), media, testimonial, tabs (first tab), spacer, divider + 8 bound product sections. Placeholder: productFamilies, productShowcase, solutionsGrid, caseStudy, newsList, listing (+ collection-backed logoWall/faq). Product page 10/10 (100%), home page 2/7 (29%; hero's families panel is also a placeholder).
- **Editor open (prod, 3510):** product 465–483 ms, home page 196 ms (until iframe + first block visible). Dev first open 1.4 s.
- **Bundle:** editor route Next report 195 KB page / 315 KB first load; editor-only JS gzip 208 KB + CSS 14 KB. No change on public pages.
- **Dependencies:** 1 direct, **60 packages** added to lockfile (dnd-kit 0.4.0 ×7, tiptap ×22, prosemirror ×13, happy-dom, zustand, tanstack virtual…), core 2.9 MB. Puck 0.x; 0.24.0 released 2026-10-29, high release cadence (frequent canaries). Payload internal API imports: `useDocumentInfo`, `useAuth` (2, public `@payloadcms/ui`). No fork needed.
- **8 tasks (Playwright automation, prod, product 2; no human think time):** T1 add CTA 1.8 s ✓ (drag from left onto canvas) · T2 move `Sürümler` (Editions) above `Özellikler` (Features) 3.4 s ✓ (drag in Outline panel) · T3 delete `İndirmeler` (Downloads) 0.5 s ✓ (no delete button on Editions) · T4 edit heading in place 0.8 s ✓ · T5 `Yukarı kayma` ("Slide up") + `Yavaş (800 ms)` ("Slow (800 ms)") 0.4 s ✓ · T6 switch to EN + translate 3.3 s ✓ · T7 390/1440 1.5 s ✓ · T8 publish 0.2 s ✓. After publish, `/tr/urunler/…/talep-masasi` rendered the new order, `slide-up`/slow CTA, and `Teklif İste` links. User's own trial is authoritative for the V4 score.
- Verification: typecheck, lint clean; `pnpm test --maxWorkers=1` 68 files / 1029 tests (1 skipped = copy test that runs only with `PUCK_PILOT_DB`; also 7/7 on clean and edited copies). Worktree requires an untracked empty `content/seed/media` directory (`content-import` test). `NEXT_DIST_DIR=.next-pilot-puck pnpm build` succeeded.
- Screenshots: scratchpad `puck/*.png` (open, T1–T8, T7-390, rt-pages-6).

## Known issues / limits

1. Media and relationship selection are not in the editor (read-only card; done in the Payload form). Rich text renders on canvas with Lexical JSX, but is edited only in the Payload form.
2. Payload `admin.condition` is not evaluated: all conditional fields are visible (e.g., `reference/route/url` together in the link group).
3. Live-data blocks are placeholders; "Preview" (Live Preview/draft) is used for the real view. A staff-only block preview endpoint was not tried.
4. Once a product page enters composition mode, seed `content:import` rejects that product (above; V2 rule).
5. Product hero is always first: if dragged elsewhere in the Outline, the server moves it to the top on save (canvas shows the old order until reloaded). Bound sections remain in the catalog; adding a second one is rejected on save with an error message (no palette hiding).
6. Language switch means a save + reload; undo history resets on language switch.
7. IDs for new array rows are generated on the server on first save; a new one is generated on re-save in the same session (no loss because that row has no data in the other language yet, but V5 should assign client IDs).
8. Concurrency (document lock, conflict with MCP writes) is out of pilot scope.
9. `scripts/perf-lighthouse.mjs` could not find Chrome on this machine; JS weight was measured via Playwright (compressed transfer).

## V5 effort estimate (if Puck is chosen)

**≈ 12 workdays (10–15):** media/relationship Payload drawer bridge 2 · Lexical side panel (running Payload RichText field in a drawer) 2–3 · `admin.condition` equivalent (`resolveFields`) 1 · staff-only preview fragment for live-data blocks 2 · `pages` + second-wave collections, tab registration 1 · concurrency/lock + autosave queue 1 · keyboard move, accessibility, guided tour 1 · seed/import composition decision 0.5 · e2e (8 tasks), bundle/security tests 1.5. Risk: Puck 0.x release cadence (pinning + editor e2e on every upgrade), maintenance cost of two separate render trees (published RSC + canvas client equivalent).

## Files

`src/editor/puck/{adapter.ts,schema.ts,config.tsx,canvas.tsx,editor.tsx,load.ts}`, `src/app/(puck)/layout.tsx`, `src/app/(puck)/admin/visual-puck/[collection]/[id]/page.tsx`, `src/admin/views/visual-puck.tsx`, `src/collections/Products.ts` (one line), `src/app/(payload)/admin/importMap.js`, `tests/unit/puck-roundtrip-db.test.ts`, `tests/unit/client-bundle-guard.test.ts`. `git diff main -- src/migrations src/blocks src/fields src/collections` = only the single line in `Products.ts`.

## Independent security/quality audit — GPT, 2026-11-08

Scope: `main fc22469..370c9df`. Schema/migrations were not modified. 3510 and main repo/3100 are preserved; the production verification below was run on `.next-pilot-puck-qa`, port 3511, with a separate SQLite backup + uploads. Task durations and UI measurements above are historical results from the initial pilot and were not re-measured in this audit.

### Findings and fixes

- **P0:** none found.
- **P1 — parallel saves overwriting each other** (`src/editor/puck/editor.tsx:87`): two calls waiting on `await inflight.current` proceeded simultaneously. In a controlled response test, after the first response both PATCH B and PATCH C started together. The queue slot is now reserved at call time; draft/publish/autosave pass through the same queue.
- **P1 — stale autosave losing undo / last edit** (`editor.tsx:132`, `editor.tsx:172`): reverting to the saved value did not cancel the old timer, and it also ran after unmount. The timer is cleared on every change and unmount, the next autosave uses the latest value, and an undo made while a write is pending is saved afterward.
- **P1 — loss on language switch and late-response race** (`editor.tsx:142`, `editor.tsx:191`): editing and a second language switch remained open while waiting for save/GET. With a transition lock + `inert`, input pauses until the transition finishes; pending saves complete and the new language is read without fallback. On network/JSON error, the old language is preserved and the lock opens. Tests ran in DOM with mock Puck; real iframe/keyboard walkthrough is subject to the limit below.

P2/P3 not fixed in product code:

- **P2 — nested array duplication cannot save** (`config.tsx:74`): Puck 0.24.0 `ArrayField.uniqifyItem` only regenerates slot IDs; it copies Payload row `id`s. On real SQLite, a draft save with two identical row IDs returns 400 in `_locale` validation. Operation is atomic; TR/EN layout is unchanged. Not fetching the server ID back to the client on a new row also causes identity churn (limit 7 above).
- **P2 — EN preview opens TR** (`load.ts:128`): `previewPath` for both locales is `/tr…`; EN preview after T6 does not verify the translation.
- **P2 — Lexical links navigate out of canvas** (`canvas.tsx:78`): although normal CTAs are spans, `LexicalRichText`'s default link converter produces real `<a>` tags and does not use the project's `safeHref` guard. In static render, `data:text/html,…` href was preserved. React's javascript URL protection is present; working stored XSS was not proven. Link/autolink must be rendered inert.
- **P2 — malformed ID returns 500** (`load.ts:67`): with staff at `/admin/visual-puck/products/not-a-number` in production, returns 500; invalid ID must map to 404.
- **P3 — bundle guard source rule incomplete** (`tests/unit/client-bundle-guard.test.ts:63`): only catches `from '…'`; dynamic `import()`, `require()`, and transitive imports via relative paths can bypass the source rule. No leakage was found in the current production chunk scan.

### V4 objections and re-measurement

| Gate/claim | Audit result |
|---|---|
| Round-trip / Lexical / TR–EN | Extended adapter test: unknown fields, nested IDs, Lexical, populated upload/relationship, appearance/motion, null/empty values preserved. Independent backup saving 8 products + 15 pages TR/EN unchanged: 0 diff. This evidence did not cover concurrent UI save bugs; P1s were separately verified with 7 DOM tests. |
| Security | Real production cookie session: anonymous 307, customer 404, editor/admin 200, other collection 404; all `private, no-store` + SAMEORIGIN. Real REST handler: anonymous/customer PATCH 403, editions delete draft/autosave 400. Hero order is normalized in the existing V2 server hook. No custom `overrideAccess` write path or opaque editor blob. |
| CSRF | No new save endpoint; uses existing Payload PATCH. Cross-origin PATCH preflight response has no `Access-Control-Allow-Origin`. CSRF list in Payload config is empty (same on main branch); this measurement verifies browser CORS blocking, not a claim of an additional server Origin allowlist. |
| Public bundle | QA build: 48 entries / 65 JS chunks / 0 Puck traces. HTTP gzip script body, excluding `nomodule` for modern browsers: home page **122.6 KB**, product **122.9 KB** (decimal KB). Manifest JS gzip total **110.1 KB**; the earlier 107.6 value could not be reproduced with the same method. Passes ≤130 KB threshold. |
| MCP/import | **Failed.** Separate copy `content:import --dry-run`: `products:belge-rotasi`, `layout` error, exit 1. Cannot be called "conditionally passed" without changing the plan; V4 candidate acceptance is open. MCP find was not re-invoked in this round. |
| Canvas parity | 23/29 = 79.3%, below the 80% target; home page 2/7. "Real" classification is not proof of pixel parity (video cover, tabs first panel only). This is a weighted scoring criterion, not a standalone mandatory gate. |
| UI/duration measurements | New production UI round could not run: Chromium `MachPortRendezvousServer` Permission denied (1100). Previous Playwright task durations do not substitute for user testing/satisfaction scores. |

Evidence: `/private/tmp/softmarket-puck-qa-el4vwpfl/` (`build.log`, `http.json`, `bundle.json`, `roundtrip.log`, `tests.log`, `bundle-guard.log`, `import.log`, `browser-error.log`). Raw credentials were not added to the report/repo.

Latest commands: `pnpm typecheck`, `pnpm lint` clean; `pnpm test --maxWorkers=1` **69 files / 1039 passed, 1 skipped**; with DB backup also **10/10**; QA build and bundle guard **54/54** passed. 3511 shut down (`ECONNREFUSED`), temporary build folder removed. 3510 is running with the same PID 70299; not switched to the build containing the fixes. A commit was attempted but `git add` could not create `index.lock` in the shared worktree Git directory: sandbox `Operation not permitted`. Changes are in the working tree; commit message: `fix: prevent lost edits in Puck pilot save lifecycle`.
