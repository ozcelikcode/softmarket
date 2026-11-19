# V3b — Payload-native canvas pilot (custom bridge) — 2026-11-08

Branch `pilot/native-canvas` (above main `fc22469`). The what-digital plugin was **rejected** (see `canvas-spike.md`: site bridge accepts non-parent same-origin messages) and completely removed from the worktree. This pilot is the plan's "Custom bridge (Argon design)" path. Raw metrics: `canvas-metrics.json`; automation scripts: `canvas-e2e/*.mjs` (Playwright, 3520 + copy DB).

## What was built

| Part | File | Note |
|---|---|---|
| `editing` flag | `src/lib/blocks/render-plan.ts` | `planBlocks(..., { editing: storedLayout })` → `ctx.edit = { id, path: 'layout.N' \| null }`. Path is the **stored** layout index (accurate even when product composition, `listing` filter, or hidden blocks shift indices). `path: null` on virtual (compatibility mode) blocks. |
| Markers | `src/components/blocks/block-shell.tsx` (`EditableBlock`, `editField`), `render-blocks.tsx` | `display: contents` wrapper: `data-block-id`, `data-block-path`, `data-block-type`. Plain text: hero `eyebrow/heading/subheading`, CTA `heading/body` → `data-field-path`. Product intro `h1` maps to the `title` field in the bridge. |
| Gate | home page, landing (`[slug]`), product page | `editing` is passed only when `getPreviewUser()` (draft mode + staff re-verified on every request) is populated. No markers in public/ISR HTML (unit + browser tests). |
| Bridge | `src/editor/canvas/bridge.tsx` (+ `bridge-loader.tsx`) | Alongside `LivePreviewRefresh` in layout, behind the same gate. Separate chunk via `React.lazy` + mount gate (initial version used `next/dynamic`; replaced because it added ~1 KB to the shared layout chunk and crossed the 130 KB gate). Hover outline, selected block toolbar (↑ ↓ drag, `Çoğalt` [Duplicate], `Gizle` [Hide], `Sil` [Delete, two-step confirmation], `+ Blok ekle` [Add block]), Alt+↑/↓ keyboard move, Esc clears selection. Plain text `contenteditable="plaintext-only"`, `textContent` only, paste plain text, Enter = commit, Esc = revert. Does not write to API. |
| Admin host | `src/editor/canvas/admin-host.tsx`, `plugin.ts` | Injected as `beforeDocumentControls` (inside Form) on the `products` + `pages` edit screen (`payload.config.ts` single line `canvasPilot()`; no collection file changed). Applies messages via Payload form API: `moveFieldRow`, `addFieldRow`, `removeFieldRow`, `DUPLICATE_ROW`, `UPDATE` (+ `setModified`). Selecting a block expands its form row, scrolls to it, and opens its inner groups (`Görünüm` [Appearance], `Hareket` [Motion], `Hareket › Gelişmiş` [Motion › Advanced]); focus stays on the canvas. Block palette: block label from config + `public/admin/blocks/*.webp`. |
| Protocol | `src/editor/canvas/protocol.ts`, `rules.ts` | See Security. V2 rules are mirrored in the editor (server remains authoritative). |

The save chain did not change: form → autosave (2 s) → server validation/access → `RefreshRouteOnSave` → iframe refreshes. Publish is Payload's `Değişiklikleri yayınla` ("Publish changes") button. TR/EN: admin locale switcher changes the form and preview URL; the bridge writes only to the current form locale.

**Compatibility mode (V2):** when `layout` has no bound blocks, the page renders with virtual blocks. Selecting a virtual block shows a single button `Bölümleri düzenlenebilir yap` ("Make sections editable"): adds the 8 bound blocks at the top of the form as references (content is not copied); extra blocks remain behind them.

## Audit fix (2026-11-08)

The measurements below belong to the previous build; they were not re-verified after the fix and do not count as V4 acceptance. In-place text is pushed to form state on every input; preview refresh is deferred while editing. Messages carry block ID and locale, and the form finds its current row by ID. Existing text exceeding 500 characters must be edited in the form; input exceeding the limit is rejected. If the tab closes before autosave finishes, the latest changes are not guaranteed to reach the server. Caret, fast close, and locale switching must be re-measured in a real browser. The MCP/import gate did not pass due to the existing seed conflict.

## V4 gates (previous build measurements)

| Gate | Result | Evidence |
|---|---|---|
| Data round-trip | **PASSED** — 0 diff | Editor + canvas open, block selected, no-op edit → autosave + publish; TR/EN draft document (no fallback) deep comparison (excluding `updatedAt/createdAt/_status`): `products/5`, `products/4` (moved to composition via canvas), `pages/6` (home page), `pages/1` (legal, `richText`) → TR 0 / EN 0. |
| Lexical preservation | **PASSED** | Whole document including `pages/1` Lexical JSON 0 diff. Canvas does not write to rich text (plain text only). |
| TR/EN | **PASSED** — 0 leakage | Title changed in EN ("Flow Hub Pro"), TR title unchanged; TR was not written to empty EN fields (0). MCP find returned the same result for TR/EN. |
| Public bundle | **PASSED** | Lighthouse mobile, 3-run median, same script/same DB: main **129.42 KB** → pilot **129.59 KB** (+0.17). Perf 100, LCP ~1.06 s, CLS 0. Bridge chunk (4.2 KB gz) + zod chunk (24.8 KB gz) download only on staff draft load; not requested on anonymous load, no markers/bridge references in HTML. `client-bundle-guard` extended. |
| Security | **PASSED** | Anonymous preview 401 (`private, no-store`), customer 403, neither sees markers in HTML or can access admin; staff draft `no-store`. Spoofed messages (same-origin sibling iframe → admin, admin itself, `127.0.0.1` popup, unknown type from real iframe, non-parent window → bridge) rejected; real parent accepted (positive control); layout rows 10 → 10. Bridge is inactive on a draft page opened standalone. Unit: `tests/unit/canvas-pilot.test.tsx` (23). |
| MCP/import | **PARTIAL** | MCP `findProducts` TR/EN error-free (order + `slide-left/slow` visible). `content:import --dry-run`: pre-editor snapshot 0 errors; post-editor **rejected on `akis-merkezi` by V2 rule** ("composition cannot revert to legacy layout without Editions") — canvas moved 4 seed products into composition, while `content/seed` carries the legacy layout. Removing those 4 products yields 0 errors on dry-run (including products whose title was edited/round-tripped via canvas). Canvas did not produce invalid data; seed and editor composition conflict (V5: write back to seed / warn). |
| Canvas–publish parity | **PASSED** — 100% | Staff draft render (marked, bridge inactive, F8 exit badge hidden) vs anonymous render: `/tr`, product TR/EN × 390/1440 full-page **pixel-identical**, text and section positions match. Canvas is the real page; no placeholder blocks. |

## 8 tasks (automated, `products/4`, no human think time)

| Task | Duration | Note |
|---|---|---|
| T0 switch to composition | 2.7 s | Single click on legacy-layout product |
| T1 add CTA | 2.8 s | `+ Blok ekle` → palette (with thumbnails) |
| T2 move Editions above Features | 3.2 s | Pointer drag from handle (HTML5 DnD was unreliable in iframe, switched to pointer-based) |
| T3 delete | 2.7 s | Two-step confirmation |
| T4 edit title in place | 2.3 s | `h1` → `title` |
| T5 Slide left + slow | 4.0 s | Clicking a block opens the `Hareket` panel in the form; card + duration selection in form |
| T6 switch to EN, translate title | 5.4 s | |
| T7 preview 390/1440 | 2.1 s | Live Preview breakpoint selector |
| T8 publish | 4.2 s | Order, title, and unmarked HTML verified on public page |

Total ~29 s. V2 locks on canvas: Editions delete/hide/duplicate disabled (movable); Intro delete/hide/move/duplicate disabled; Downloads free (bound blocks are singletons, duplicate disabled). Screenshots: scratchpad `v3b/t*.png`, `parity-*.png`. **User's own 8-task trial has not been done yet** (decisive for V4 score).

## Caret / autosave finding

- Writing to the form on every keystroke (`localStorage['sm-canvas-commit']='input'`, measurement mode): pausing 2 s while typing triggers autosave → preview refresh jumps the caret to the start: **22 corrupted** out of 31 keys, text garbled. **Unacceptable.**
- Default solution: text is written to the form only on **Enter/blur**. 31 keys + 3 pauses: **0 corrupted**, text and form value accurate. Also 0 corrupted when another change's autosave/refresh intervenes while typing (React does not touch unchanged server text).
- Cycle: 2.36 s from edit to autosave PATCH, 2.42 s to preview refresh; structural change (move/add) → canvas 2.5 s.

## Performance / accessibility

Admin editor + canvas open 0.4–0.5 s (warm), block selection → toolbar 36–60 ms, keyboard move (`Alt+↑/↓`) appears on canvas in 2.5 s; toolbar buttons are focusable with `aria-label`.

## Maintenance risk

New dependencies **0** (zod already present). `@payloadcms/ui` public exports: `useAllFormFields, useConfig, useDocumentInfo, useForm, useLivePreviewContext, useLocale, useTranslation`. Internal dependencies (e2e mandatory on Payload upgrade): `SET_ROW_COLLAPSED` action shape (not in types, cast), `DUPLICATE_ROW/UPDATE`, `formState.layout.rows`, DOM `layout-row-N` ID and `.collapsible__toggle--collapsed` class (group expansion), `config.blocksMap`, `beforeDocumentControls` slot. Code ~680 lines (`src/editor/canvas`).

## Known issues / limits

1. Seed conflict (above MCP/import): seed products moved to composition cannot be overwritten by `content:import`.
2. In-place text only on hero (eyebrow/heading/subheading), CTA (heading/body), and product title; others from the form.
3. A hidden block is not visible on the canvas; re-enabling is from the form (`Görünüm › Gizle` / Appearance › Hide).
4. No `Görsel düzenle` ("Visual edit") entry button; canvas activates when Live Preview (eye icon) is opened. Popup preview mode is not supported.
5. Motion/Appearance settings are not on the canvas, but in the auto-expanded form panel.
6. System pages, legal, and solution/case-study pages were not marked (pilot scope: product + home page + landing).
7. Toolbar sticks to the top of the viewport on very tall blocks; overlaps sticky product tabs.
8. Bridge chunk pulls zod as a separate 24.8 KB gz chunk (staff only); in V5 use `zod/mini` or manual validator.
9. Terra spike products (9–11) are published in the copy DB; pilot measurements were unaffected.

## Re-verification (post-QA, commit 9715277, 2026-11-08)

New build, 3520 + copy DB, Playwright/Chromium. Product 4 (a–c) and 5 (T0–T8); in-place typing is now pushed to the form on every input.

| Measurement | Result |
|---|---|
| a. Caret (product 4, 31 keys, 220 ms interval, 3.5 s pause every 10 keys) | **PASSED**: 0 corrupted keys, 0 focus loss, 0 caret jumps; text and form title identical; 4 autosave PATCHes, 2 RSC refreshes. Same on product 5 (31 keys, 0 corruption). |
| b. Fast close (type, no blur, leave page / close tab within ~0.3–0.55 s) | **NOT SAVED** (old title on server in both variants). Leaving before the autosave interval (~2 s) expires loses the change; waiting 2 s+ saves it. Standard Payload behavior, not canvas-specific; no `beforeunload`/flush (see limits). |
| c. TR/EN | **PASSED**: title changed in EN, 0 TR diff; TR was not written to empty EN fields (0 fields). After T7, `enLeak = []`. |
| d. Round-trip (no-op save, TR+EN) | **PASSED**: `products/4`, `products/5`, `pages/6`, `pages/1` (including Lexical) 0 deep diff (excluding `updatedAt/createdAt/_status`). |
| e. Security smoke | **PASSED**: anonymous `/api/preview` 401; anonymous `/tr`, `/en`, product HTML 0 `data-block-id/path`, `data-field-path`, `data-canvas-ui`. T8 public page 0 markers, 0 `canvasUi`. |
| f. T1–T8 (product 5) | T0 2728 ms, T1 2815, T2 3187 (drag, first run; 227 ms on second run since order was already correct, invalid), T3 2711, T4 2281, T5 3928, T6 5279, T7 2068, T8 4209. Total ≈ 29 s. Locks (remove/hide editions, remove/move hero) disabled: correct. |

Observations:
- T5 (Motion duration) timed out on the first attempt: when product 5's title wrapped to multiple lines, T4's `End` key moved to the line end and typed in the middle (test artifact); once on the second attempt, the selected row's Motion group (`Gelişmiş` inner group) stayed closed in the form panel even after 4 s (`reveal` 50/300 ms inner-group open race). Passed on the third run (3928 ms). Tracked as flaky; no code changed.
- Product 5's old title was corrupted from the earlier (pre-fix) caret test; restored to a clean title. Because reverting from composition is rejected by the V2 rule, products 4 and 5 are now in composition mode.

## V5 effort estimate (if native is chosen): **6–8 workdays**

Extend markers to plain text fields of all 29 block types (1.5), show hidden blocks dimmed on canvas (0.5), undo/redo (1), concurrency warning + document lock (1), palette search/categories + guided tour + accessibility (1), seed/composition warning (0.5), other collections (0.5), e2e/security suite `visual-editor.spec.ts` (1–1.5), `zod/mini` (0.25).
