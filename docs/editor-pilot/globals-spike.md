# G0 — Global visual editor verification (2026-11-17)

**Status: incomplete.** The results below are independent of one another; source code paths and Local API evidence do not substitute for real admin/Chromium or public HTML evidence. The plan was not in the worktree; read-only `/Users/ozcelik/dev/softmarket/docs/plan-visual-globals.md` was used. Branch `spike/globals-g0`, Payload 3.93.0. Experimental code and migrations exist only in this worktree and must not be merged into the main branch. DBs are copies `/private/tmp/.../scratchpad/softmarket-g0.db` and `/private/tmp/g0-fresh.db` created from live via SQLite `.backup`. No migration was applied to live.

## 1. Global Live Preview host — source path yes, browser verification no

Temporary `src/editor/canvas/admin/g0-probe.tsx` calls all requested hooks; global `admin.livePreview.openByDefault` and `admin.components.elements.beforeDocumentControls` were defined in `Header.ts`. `pnpm generate:importmap && pnpm typecheck` succeeded. This is type/compile evidence only and does not prove the hooks work in real interaction.

Payload source path: `@payloadcms/next/dist/views/Document/renderDocumentSlots.js:27` selects the global slot; `Document/index.js:331,351,354` carries `globalSlug`, `LivePreviewProvider`, and `openByDefault` when no preference exists. `@payloadcms/ui/dist/views/Edit/index.js:451-460,530` places the global view inside `Form`; `elements/DocumentControls/index.js:222` renders the slot. `forms/Form/index.js:531-563,621-623` provides the three row actions; `providers/LivePreview/index.js:69,203` provides `iframeRef`, and `elements/LivePreview/Window/index.js:113` binds it to the iframe. `scripts/g0-request.ts` output has `enabled:true, open:true`. These do not replace a real UI test of adding/moving/removing rows, `iframeRef` populating, or the effect of a prior user preference.

Chromium `@playwright/test` launch exits even with `--no-sandbox` due to `bootstrap_check_in ... Permission denied (1100)`. 3510 Next dev returned 404 for `/tr` with `EMFILE: too many open files, watch` warnings; therefore admin HTTP/host verification could not be obtained either. **G1–G4 impact:** supported in architecture source, but a browser acceptance test for real global form mutations and host is mandatory before G1/G2; item 1 cannot be called a definitive yes.

## 2. previewPath — yes, real admin request not yet verified

`node --env-file=.env --import tsx scripts/g0-request.ts` (with temporary Header config) output: `param:/tr/urunler`, `enabled:true`, `open:true`, `url:http://127.0.0.1:3510/api/preview?redirect=%2Ftr%2Furunler`. This is a representative request constructed with Payload `createLocalReq` and real `handleLivePreview`. `@payloadcms/next/dist/views/Root/index.js:97-122` puts admin query into `urlSuffix`; `utilities/initReq.js:72` passes it to `createLocalReq`; `payload/dist/utilities/createLocalReq.js:24-55` builds `searchParams` from the URL; `ui/dist/utilities/handleLivePreview.js` passes `globalConfig` and the same `req` to the callback. Thus it is accessible in the normal code path shown. Validation with `safePreviewRedirect` remains mandatory. **G1–G4 impact:** `previewPath` is usable; `usePreferences` does not appear to be a required fallback. Real login/refresh and preservation of the query across locale switches must be verified with G2 E2E.

## 3. Draft migration — SQL yes; HTML and footer not yet verified

`pnpm migrate:create g0_header_drafts` with only Header drafts enabled generated `src/migrations/20261117_131103_g0_header_drafts.ts`. Up: 13 CREATE TABLE, 37 CREATE INDEX, 6 CREATE UNIQUE INDEX, 1 ALTER TABLE ADD; no `__new_`, DROP TABLE, or DELETE FROM. `header._status text DEFAULT 'draft'` is added. Generated down drops the tables; safe down conditions for G1 must be designed separately. Footer was not included in this experiment; its SQL must be generated and inspected separately.

On the first copy, `pnpm migrate`, then `node --env-file=.env --import tsx scripts/g0-probe.ts`: TR and EN `publishedStatus:draft`, `draftStatus:draft`, 4 nav items in both reads and `identical:true`; `_header_v` was initially empty. In this example `findGlobal({draft:false})` did not filter out the draft main row or fall back; `draft:true` fell back to the main row when no version row existed. This Local API result does not prove equivalence across all public render paths.

On a separate clean copy, after migration `scripts/g0-hash.ts`, then `UPDATE header SET _status='published'` and the same script again: `_header_v` count **0**, TR and EN content hashes (with status field excluded) remained identical at `fed274315cae2410db4350955a909b0192c6fed99390b1d56571a612ca634660` and `a5057a3694739017c20ddf55be992d56c3fab94132ea2195e82c0d1b34f4c732` (4 items per locale). Backfill is needed to represent the existing row as published; inserting version rows was not required for initial Local API reads. This alone does not prove inserting is unnecessary for admin version history and all frontend behaviors.

In `scripts/g0-request.ts`, after an explicit `_status:'published'` write, writing with `draft:true` read public `published G0`, draft `draft G0`. Then with `scripts/g0-update.ts`, `updateGlobal` without `_status` and `draft` resulted in `update:draft`, `publicStatus:draft`, `publicText:no status G0`, `draftStatus:draft`, `draftText:no status G0`: the main row changed and appeared on public reads. **G1 impact:** for importer/MCP, not only status but also the `draft` option and public effect must be an explicit contract/test; if import intends to publish, it must explicitly send `_status:'published'`. Draft writes are not safe without `draft:true`.

**G1 definite implementation candidate, not yet accepted:** inspect the separately generated up SQL for Header and Footer; add backfill only to the new column via `UPDATE header SET _status='published'` and `UPDATE footer SET _status='published'`. Do not INSERT into `_header_v` for the first read; Footer and real admin version/publish flows must also be tested with an empty history. Pre/post-migration TR/EN public `<header>` and `<footer>` byte equality could not be measured here (`/tr` 404); it must be measured on a working isolated server before G1 acceptance. Before applying to live, the plan's backup and safe down conditions apply.

## 4. Dialog top layer — not verified

`header-shell.tsx:151` native dialog; `initSheet` uses `showModal()` and native cancel. Bridge clears selection on Esc inside `bridge.tsx`. Proposed prototype: mount the selection overlay inside the open dialog via a React portal; on dialog `cancel` event, if active editing/selection exists, call `preventDefault()` and close it first; if no active editor operation exists, preserve default dialog close and focus return. Related bridge click events must also be tested not to misfire link/close handling inside `initSheet`. Because Chromium could not launch, this is a proposal, not a working top-layer prototype or proof of a technical blocker. **G4 impact:** G4 must not be accepted without passing click, focus, Tab, two-stage Esc, close, and reopen in a real 390 px Chromium test.

## 5. Mega menu pinning — proposal yes, no runtime test

`close()` in `src/lib/header-nav.ts` is the shared closer for all hover/focus/outside/link/Escape paths; `open()` closes the current panel directly with `setState(current,false)`. Minimal proposal: check `data-canvas-pinned` on the current panel in `close()`; in `open()`, also prevent dislodging the pinned panel when another trigger opens. There must be a forced close path for explicit unpin and cleanup, otherwise unmount cleanup breaks. Only editing render should set the marker; normal public behavior must not change. The editor contract for Esc and selecting a new panel must also be defined. This change was not implemented or tested. **G2 impact:** source analysis indicates feasibility; pointer, focus, link, Escape, different-trigger, and cleanup regressions are required.

## Plan revision and open gates

G0 acceptance of the plan was not met: 1 and 4 lack real UI evidence, 3 lacks pre/post HTML and Footer, and 5 lacks behavioral testing. An explicit revision conditioning transition to G1 on this evidence is needed. In particular, the fact that global updates without `_status` can write to the main row/public view must be added to the plan's import/MCP text. The preference fallback assumption for `previewPath` does not appear necessary in the normal Payload 3.93 code path and should remain conditional until real admin testing.

Attempt to stop 3510: `kill $(lsof -ti :3510)` → `kill 5987 failed: operation not permitted`. No other PID or process group was targeted; the 3510 process state must be checked by the user. `pnpm dev` hardcodes 3100; the spike server was started with `NEXT_DIST_DIR=.next-g0 pnpm exec next dev -p 3510`.

---

## Browser verification (Sonnet)

Date 2026-11-17. Real Chromium (`@playwright/test`, ran outside sandbox), real admin session, Next dev 3510 (`NEXT_DIST_DIR=.next-g0`, `G0_DRAFTS=1`). DB: copy taken from live with `sqlite3 .backup` (`scratchpad/g0/pre.db`), `.env` points to the copy DB; live DB/3100/main `.next` were untouched. Terra's "Chromium did not open" blocker does not exist in this environment. Screenshots: `/private/tmp/claude-501/-Users-ozcelik-dev-softmarket/86cb568c-5f6b-4b21-b0fe-e6a5de07c79f/scratchpad/g0/` (`01`–`08` `.png`). Scripts `scripts/g0-*.{mjs,ts}`. Header/Footer `versions.drafts` is enabled only with `G0_DRAFTS=1` (for pre/post measurement).

| # | Item | Result |
|---|---|---|
| 1 | Global edit: openByDefault, beforeDocumentControls, hooks, row actions, iframeRef | YES |
| 2 | Footer drafts migration + backfill | YES (rebuild caveat, below) |
| 3 | Pre/post-migration header/footer HTML byte equality | YES |
| 4 | Draft save does not change public; publish does | YES |
| 5 | Dialog top layer + Esc | PARTIAL: in-dialog layer yes; outside no; Esc `cancel` alone UNRELIABLE, capture keydown yes |
| 6 | Mega menu `data-canvas-pinned` | YES |

### 1. Global edit host (`/admin/globals/header?previewPath=%2Fen`)

Evidence `scripts/g0-admin.mjs`, screenshots `01-header-edit-livepreview.png`, `02-after-add-move.png`:
- `livePreview.openByDefault`: preview panel open on page load, single iframe `http://127.0.0.1:3510/api/preview?redirect=%2Fen` (`previewPath` query reaches the url function). Opened without a preference cookie.
- `beforeDocumentControls`: host rendered (`[data-g0-host]`, buttons in the document controls bar, screenshot 01).
- `useDocumentInfo().globalSlug` = `header`; `useAllFormFields` 211 fields (225 after adding a row, 211 after removing).
- `addFieldRow({path:'navItems', schemaPath:'header.navItems', rowIndex})`: row count 4→5, new row in form. `moveFieldRow(0→end)`: labels `Ürünler|Çözümler|Destek|Şirket|?` → `Çözümler|Destek|Şirket|?|Ürünler`. `removeFieldRow(end)`: 5→4. All three genuinely mutated the form.
- `useLivePreviewContext().iframeRef.current`: `IFRAME` element; `null` on first render, populated after ~a few hundred ms (must be read via an effect/poll, not during render). `isLivePreviewing` true.
- No console/page errors. UI: with drafts+autosave enabled, single publish button (`#action-save`), no `Taslak kaydet` ("Save draft") button (autosave).
- Breakpoint: toolbar width/height inputs (`input.toolbar-input`) resize the iframe to 390 px (`innerWidth` 390 verified); `livePreview.breakpoints` was added to Header.

### 2. Footer drafts migration

`G0_DRAFTS=1 pnpm migrate:create g0_footer_drafts` → `src/migrations/20261117_131501_g0_footer_drafts.ts`. Up: 10 CREATE TABLE, 32 CREATE INDEX, 5 CREATE UNIQUE INDEX, `ALTER TABLE footer ADD _status text DEFAULT 'draft'` + `footer__status_idx`. **Single exception:** `PRAGMA foreign_keys=OFF` + create `__new_footer_columns_locales`, `INSERT ... SELECT`, `DROP TABLE footer_columns_locales`, RENAME. Reason: `footer_columns_locales.title` `NOT NULL` → nullable (drafts relax required localized fields). Tested on copy DB by writing 2-column TR+EN footer content (`scripts/g0-seedfooter.ts`, 4 rows): row count after migrate 4, IDs preserved. (No rebuild for Header.) Observation: an empty footer would not have exercised this rebuild; since live may have populated footer rows, G1 must be rehearsed with populated data before backup.

Content hashes (`scripts/g0-hash.ts`, excluding `_status/updatedAt/createdAt`, including `id`), BEFORE migration = after migrate without backfill = after backfill:
header tr `f77813192f9bf06b`, en `aa1e312316bed2d0`; footer tr `1284109223496625`, en `49d6b39eb08155ad`. Even with `_status=draft` before backfill, `findGlobal({draft:false})` returned the content (globals main row does not filter by `_status`); backfill represents reality (required so admin shows `Yayınlandı` / "Published"). `_header_v`/`_footer_v` have 0 rows after backfill; no INSERT was needed for first read or first admin load (admin showed `Durum: Yayınlandı` / "Status: Published", and the first autosave/publish created the first version itself).

### 3. HTML byte equality

`scripts/g0-capture.mjs` + `scripts/g0-cmp.mjs`. Pages: `/tr`, `/en`, `/tr/urunler/akis-yonetimi/akis-merkezi`, `/en/products/akis-yonetimi/akis-merkezi`. BEFORE (no migration, drafts off) two captures are byte-identical to each other. AFTER (migrate + backfill + drafts on) every page's `<header>` and `<footer>` HTML is **raw byte-identical** (header 22089/22162, footer 4631/4643 bytes; full page lengths also identical: 443924/444469/437039/438294). Normalization (nonce, `/_next/static`) produced no difference; no diff. Measured with populated footer (Column A/B, legal link).

### 4. Draft / publish (`scripts/g0-draft.mjs`, screenshots 03, 04)

In admin, TR "Menu item 01" label was set to `G0 Taslak` without publishing: after autosave, admin status `Değişiklik yapıldı` ("Changed"), on reload `Taslak` ("Draft"), field value preserved; public `/tr` HTML does **not** contain `G0 Taslak` (main row remained `published`). `Değişiklikleri yayınla` ("Publish changes") → status `Yayınlandı` ("Published"), public HTML **does** contain `G0 Taslak` (in dev; ISR revalidation must be tested with `afterChange` in G1).

Local API `updateGlobal` matrix (`scripts/g0-update.ts`, while main row is `published`):
- A no `_status`/`draft`: preserves current `_status` (`published`), content is written to public (existing behavior preserved after backfill).
- B `draft:true`: main row/public unchanged, version only.
- C `data._status:'published'`: publish.
- D `data._status:'draft'` without `draft:true`: **main row becomes `draft` and content still appears on public** (public read does not filter `_status`).
- E update without `_status` while main row is `draft`: stays `draft`, appears on public.
- Every update appends a `_header_v` version (8 versions). Terra's observation that "omitting `_status` can make the main row draft" holds only if the main row is already `draft` (no backfill); after backfill, writing without `_status` remains published.

### 5. Dialog top layer (390 px preview iframe; `scripts/g0-iframe.mjs`, `g0-esc.mjs`, screenshots 05, 06)

- Menu button opened `showModal()` in the iframe. Layer added inside dialog (`position:fixed`, dialog child): `elementFromPoint` hits itself, **clickable** (click recorded).
- Layer added to body with `popover="manual"` + `showPopover()`: visible (screenshot 05) but **unclickable** (modal backdrop inert); a layer appended directly to body is also unclickable. Result: bridge/selection layer must be a child of dialog (portal target `dialog`).
- Esc: `cancel` + `preventDefault` alone: due to Chromium close-watcher protection, on the 3rd consecutive Esc `cancel` has `cancelable=false` and the dialog closes (log: `cancel(true) cancel(true) cancel(false) close`). Unreliable. **Working method:** capture `keydown` Escape on `document`: while editing/selecting is active, `preventDefault()` → dialog stayed open across 3 consecutive Esc presses (with or without activation); when not editing, Esc triggers natural `cancel`→`close`, `body` lock releases, focus returns to menu button, and reopening works.

### 6. Mega menu pinning (`scripts/g0-mega.mjs`, screenshots 07, 08)

`src/lib/header-nav.ts` prototype (8 lines): in `open()`, if the current panel has `data-canvas-pinned`, another trigger does not open; `close(restoreFocus, force=false)` is a no-op while pinned; cleanup forces `close(false, true)`. Browser (1440 px): unmarked behavior unchanged (click opens, outside click/Esc closes). When marked: outside click, Esc, click/hover on another trigger, focus loss, click on its own trigger **all kept it open**, panel visible. When marker was removed and outside clicked, it closed. Note: to switch to another panel while a pinned panel is open, the editor must first move `data-canvas-pinned` (unpin+pin).

### G1 migration recipe (FINAL)

1. `Header` and `Footer`: `versions: { drafts: { autosave: { interval: 2000 } }, max: 50 }` (choose autosave interval consistent with `PRODUCTS_AUTOSAVE_INTERVAL` on products). Only these two globals.
2. Two separate or single migration (`pnpm migrate:create ...`), spike SQL as reference. Header: only CREATE/ALTER ADD. Footer: additionally `footer_columns_locales` rebuild (NOT NULL relaxation, INSERT…SELECT; data preserved). Both end with **backfill**: `UPDATE header SET _status='published'; UPDATE footer SET _status='published';` (`db.run(sql\`...\`)`, inside the same transaction/migration, after ALTER).
3. No **INSERT** needed for `_header_v` / `_footer_v` (empty history suffices; public and first admin load verified). First admin publish/autosave creates the first version.
4. Down: drop the new `_status` column and `_*_v*` tables; for footer rebuild, restoring `title NOT NULL` in down errors if empty titles exist → write down to drop only version tables and `_status`, without restoring NOT NULL (or document scope and restore from backup). Rehearsal with backup + populated footer before live is mandatory.
5. Acceptance: pre/post raw `<header>`/`<footer>` equality (`scripts/g0-capture.mjs`+`g0-cmp.mjs`), hash equality.
6. Importer/MCP rule: **always send `data._status: 'published'` in global writes** (add to importer `updateGlobal`, MCP `updateHeader/updateFooter` contracts and tests). After backfill, omitting `_status` also stays published, but if the main row somehow becomes `draft`, content still appears publicly (D/E), hence the explicit send rule. Draft writes use `draft:true` only (admin autosave does this). Additional safeguard proposal: in global `beforeChange`, reject/convert to `published` any `_status:'draft'` arriving without `draft` option (`req.query.draft !== 'true'` and outside admin autosave); with test.

### Plan revision items

1. G0 acceptance complete: 1,2,3,4,6 yes; 5 partial (accepted with the two rules below).
2. G4/G2 Esc contract: dialog Esc handling should rely on `document` capture `keydown` Escape, not `cancel` (two-stage Esc: selection/editing closes first, then dialog).
3. G4 bridge/selection layer should mount inside dialog (child/portal target `dialog`); `popover` and body layers do not work.
4. G1: `footer_columns_locales` rebuild note and rehearsal with populated footer; backfill both globals; no INSERT.
5. G1: importer/MCP `_status:'published'` rule + test (D/E case: even if global main row is `draft`, it is publicly visible).
6. G2: mega menu pin contract (`data-canvas-pinned`, editing render only, unpin/cleanup `force`), switching to another panel = unpin+pin; normal public behavior unchanged.
7. G2: `iframeRef` is null on first render; must be read via effect/poll. `previewPath` query works (no fallback preference needed).
8. G2: `livePreview.breakpoints` must be defined for header/footer (like 390/768/1440 on products); with drafts+autosave there is no "save draft" button, only a single publish button.
