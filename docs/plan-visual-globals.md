# Plan: Visual editing for the site chrome (header, footer, menus, branding)

> **CANCELLED — owner decision, 2026-11-18.** Wix-style header and footer editing requires custom code that Payload does not provide. G1 runtime changes have been reverted, and G2–G7 were dropped. The plan and implementation record below are historical.

> Status: **draft plan (2026-11-17)**. No code, schema, or migration changed. Implementation starts with G0 verification, and user approval is awaited at the end of each phase.
> Sources: `AGENTS.md`, `memory-bank/*`, `docs/plan-visual-editor.md` (Permanent rules, V3b, V5 record, V5 audit note, P1 closure record), `docs/editor-pilot/decision.md`, `docs/editor-guide.md` §2.10. Existing code read from `main` 1a8969e. Payload 3.93.0 sources verified in `node_modules`.

## User request

- In the user's words: "components of the site such as the header, footer, and menu will also have a preview section and be editable directly on the preview—Wix-style editing from the preview without having to rely on text tools."
- Interpretation: the V5 visual editor (Payload-native canvas: Live Preview iframe and bridge) must also be able to edit these components: header, footer, main menu, mega menu, mobile menu, announcement bar, utility bar, logo, site name, tagline, contact info, and social links. The user selects these items in the preview and edits text in place. They add, delete, or drag-and-drop reorder menu items. They pick the link target from a small panel and the logo from the media drawer.

## Permanent rules (apply to every phase; violations reject the phase)

1. **The single source of truth is Payload globals:** `header`, `footer`, and `site-settings`. No opaque editor state is stored. Existing field names, options, and `defaultValue` values do not change. Additive changes only (the "F7: append-only" note in the Header/Footer files).
2. **All writes go through the Payload form.** The bridge does not write to the API. The host (admin) re-validates the message against an allowlist, applies the change via the Payload form API (`dispatchFields`, `addFieldRow`, `moveFieldRow`, `removeFieldRow`), and uses server validation and the access chain. The only exception is the "materialize default menu into a record" endpoint in G3. This endpoint requires a staff session, same origin, and an `editorVersion` precondition, and writes only a draft.
3. **Visitors never see drafts.** Header and footer drafts are read only in draft mode and with a staff session re-verified on every request (`readAs`/`getPreviewUser`). Autosave does not refresh the cache. The cache is refreshed only on publish.
4. **Public/ISR HTML stays byte-for-byte identical.** `data-chrome-*` markers, badges, and "not visible to visitors" elements are emitted only in editing render. For proof, `<header>` and `<footer>` HTML is compared against the pre-change baseline (V2 pattern).
5. **No editor code enters the public bundle.** Home page JS gzip must be ≤ 130 KB. Proof: `tests/unit/client-bundle-guard.test.ts`. Only a few-byte "pinned panel" check may be added inside `src/lib/header-nav.ts`, with the measured difference recorded.
6. **Security is preserved.** In `postMessage`, `origin === location.origin` and `event.source` match are checked in both directions, and a strict zod/mini schema is used. The bridge does not carry URL values. The link address is entered in the admin panel form and validated on the server (`javascript:`, `data:`, `vbscript:`, and `//` are rejected). `/api/preview` is open to staff only. Draft responses are `private, no-store`.
7. **Migration rules** (`plan-visual-editor.md` rule 6): run on a DB copy first. Up contains only `CREATE TABLE`, `ADD COLUMN`, `CREATE INDEX`, and `UPDATE` (backfill) targeting the new column. `DROP`, `DELETE`, and `__new_` are forbidden. Down removes only its own tables, columns, and indexes. Before applying to live, take a backup including WAL/SHM and a snapshot.
8. Unless explicitly requested by the task, do not touch the 3100 dev server, the live DB, or the `.next` folder. Builds use `NEXT_DIST_DIR=.next-<name>`, and QA ports are 3200, 3300, and 3400. Processes are not killed.

---

## 1. Current state (code reality)

| Topic | Current state | Consequence for the plan |
|---|---|---|
| Globals | `header` (navItems ≤8 → children / megaMenu `products\|solutions\|custom` → columns ≤4 → links ≤8 + featured; cta.link/secondary; announcement; utility.links ≤4 + 3 switches), `footer` (columns ≤6 → links; legalLinks; copyright; brandBlurb; showContact/showSocial; newsletter), `site-settings` (siteName, tagline, logo, logoDark, favicon, contact, social[] … commerce/company/legal). **None of them have `versions`.** | In Live Preview, every save goes live immediately. Drafts require a schema change (G1). |
| Access | header and footer: `update: isAdminOrEditor`. site-settings: `update: isAdmin`. | The editor role cannot change logo, site name, or social links. These are shown with a read-only badge on the canvas. |
| Link field | `linkField()`: `type` `internal\|external\|route` ("custom" in the request = `external`), `reference` (LINKABLE_COLLECTIONS, 9 collections), `route` (LINK_ROUTES) + `routeParam`, `url` (localized). **No server validation on the `url` field.** Security is provided only by `safeHref` at render time. | In G1, schemaless `validate` is added: `https?:`, `mailto:`, `tel:`, and relative paths starting with `/` are accepted. Tested against existing seed data. |
| Loaders | `getHeaderNav`/`getFooterData` (`src/lib/site.ts`): `draft:false`, anonymous. Drops rows with unresolvable links, unpublished targets, and sales legal pages when payments are off (`resolvePublicLink` + `isSalesLegalTarget`, P3/P7). Drops columns with empty titles. Row `id` is not carried onto `NavItem`. | Rendered items cannot be mapped back to saved rows. Editing render must carry row IDs and show dropped items with a badge (G2). |
| Fallbacks | When `navItems` is empty, a static menu from i18n is used; when CTA is empty, `requestDemo → /demo-talep`; when footer columns or legal are empty, an i18n fallback is used. | These items have no record. To be editable, they must first be materialized into a record (G3). |
| Mega menu | Panels sit hidden in HTML. `initMegaNav` opens them with hover/click delay. Clicking outside, losing focus, or clicking a link inside the panel closes the menu. | Needs to stay open in preview. `data-canvas-pinned` control is used for this (G2). |
| Mobile menu | Native `<dialog>` + `showModal()`: top layer, page inert, Esc closes (`initSheet`). | The bridge's selection overlay stays underneath the dialog and inert. While the dialog is open, the overlay must mount inside the dialog (G4). |
| Announcement bar | Dismissal is remembered in `localStorage` (`sm-announcement-dismissed`). | Must always be visible in editing render. |
| Payload 3.93 global Live Preview | `isLivePreviewEnabled` reads root `livePreview.globals` or global `admin.livePreview`. Document view (`@payloadcms/next/dist/views/Document`) also applies `openByDefault` for globals. `livePreviewURL` function receives `globalConfig`. The global control slot is at `admin.components.elements.beforeDocumentControls` (on collections it is `edit.beforeDocumentControls`). Globals support `versions.drafts.autosave`. `lockDocuments` exists for globals. | Technical path is clear. G0 proves the form API works identically in global view. |
| Cache | `withGlobalRevalidation`: **every** change to header, footer, and site-settings calls `revalidatePath('/', 'layout')`. When payments capability is on, `commerceRenderBoundary()` renders every page per request. | Once drafts are added, revalidation must run only on publish. Otherwise autosave invalidates the whole site every 2 seconds. |
| Import and MCP | `content:import` calls `updateGlobal` for globals and does not send `_status`. MCP: find/update for header, footer, and site-settings. | On a drafted global, `_status: 'published'` becomes mandatory. Importer and AGENTS recipe are updated. |
| V5 concurrency | `editorVersion` virtual field and `guardEditorVersion` work only with collection hooks (`findByID`). `db-serial-transactions` serializes transactions in-process. | Global equivalent needed: `GlobalBeforeChangeHook` + `findGlobal({ draft:true, req })` (G1). |

---

## 2. Decision summary

### 2.1 Architecture choice: **(c), phased and with a single write path**

| Option | Pros | Cons |
|---|---|---|
| (a) Separate Live Preview per global + extend bridge | Clear data integrity: one Payload form writes one global. Fully compatible with V5 draft, publish, lock, and 409 pattern. | User switches screens between page and chrome. |
| (b) Select header/footer directly in page editor and write to global | Single canvas (Wix feel). | Page form cannot hold global fields. Needs a second write path (off-form REST): form validation, undo/redo, autosave, 409, and TR/EN form state must be built twice. Page draft and chrome draft publish separately. Confusing that the "Publish this page" button does not change the whole site. |
| **(c) Recommended** | — | — |

**Recommendation:**
- **Writing goes through a single path: path (a).** The "Site chrome" editor opens the `header`, `footer`, and (admin-only) `site-settings` global views with the Live Preview canvas (`openByDefault`). The V5 host runs in global scope. On the canvas, the **page body is dimmed and locked** (`"Sayfa içeriği: bu ekranda düzenlenmez → Sayfayı aç"` (Page content: not edited on this screen → Open page)). The chrome regions are live.
- **The lightweight version of (b) delivers the single-canvas feel.** In the page or product editor, hovering over the header or footer region frames it with a `"Site geneli · Tüm sayfalarda"` (Site-wide · On all pages) badge. Clicking it shows the `"Üst menüyü düzenle ↗"` (Edit top menu ↗) shortcut. The shortcut flushes any pending page save and opens the global editor on the same preview path (`previewPath`). The global editor has a `"← Sayfaya dön"` (← Back to page) button. The user stays on the same view. The only thing that changes is which form writes, shown with a large label in the top bar: `"Düzenlenen: Üst menü (tüm sayfalar)"` (Editing: Top menu (all pages)).
- In the global editor, switching from one region to another is one click. Clicking the footer goes to `/admin/globals/footer?previewPath=…`, and clicking the logo (for admin) goes to `site-settings`. Any pending change is flushed first.
- Rationale: V5's "all writes form → server" rule, 409 concurrency, and TR/EN form discipline are preserved while delivering a Wix-like flow. Direct path (b) remains open for a later release (§8 question 1).

### 2.2 Draft and publish: **add `versions.drafts` (2 s autosave) to header and footer**

- Without drafts, every autosave on the canvas goes live immediately. Wix-style experimentation becomes impossible, which is unacceptable.
- `Header`/`Footer`: `versions: { drafts: { autosave: { interval: 2000 } }, max: 50 }`. Payload generates the `_status` column, `_header_v*`, and `_footer_v*` tables for this. The migration is additive only (G1).
- **Existing row state is critical:** `ADD COLUMN _status DEFAULT 'draft'` can turn the existing global row into a "draft". G0 proves on a DB copy how Payload 3.93 handles a main row with `_status='draft'` on `findGlobal({ draft:false })`. The migration runs `UPDATE header SET _status='published'` (new column only) and `INSERT`s an initial published version row if needed. Acceptance criterion: public header/footer HTML before and after migration is byte-for-byte identical.
- Publish: Payload's global `"Değişiklikleri yayınla"` (Publish changes) button is used. `withGlobalRevalidation` revalidates a drafted global only on `_status === 'published'` writes. Draft and autosave do not revalidate (same logic as `withPublicRevalidation` on collections).
- **Drafts are not added to `site-settings` in the first wave.** Readers of this global include payment state (`commerce/state.ts`, `payments/runtime.ts`), checkout, `company-facts`, and legal readiness. Drafts would require auditing all of them. Logo, site name, tagline, social links, and contact are edited on the canvas **by admin only**, with a "Save = publish immediately" confirmation dialog. There is no autosave on this screen and a red badge is shown. Adding draft support becomes a separate phase if the user approves (§8 question 2).
- Preview: on a staff draft request, `getHeaderNav`/`getFooterData` read with `draft:true` and staff `user`. The page editor also shows the chrome draft. If a draft exists, an "Unpublished chrome changes" badge appears on the chrome region.

### 2.3 Concurrency: V5 `editorVersion`/409 pattern moves to globals

- `editorVersionField` is added to header and footer (virtual, hidden, schemaless). Global `afterRead` = raw all-locale snapshot SHA-256. `guardGlobalEditorVersion` (`GlobalBeforeChangeHook`) reads `findGlobal({ slug, draft:true, depth:0, overrideAccess:true, req })` in the same transaction (`req`). On version mismatch, it returns `APIError` 409. Writes without a version (MCP, import, scripts) pass as before. The editor's next save gets 409.
- The "materialize default menu into a record" endpoint uses the same precondition.
- The host's **`"Birleştir ve kaydet"`** (Merge and save), **`"Değişikliklerimi kopyala"`** (Copy my changes), and **`"Yeniden yükle"`** (Reload) flow (`admin/sync.ts`, `admin/merge.ts`) works with global identity (`globalSlug` instead of `id`). Merging by row ID applies directly to array rows.
- `site-settings` gets the same guard (no drafts, but 409 prevents lost updates).

### 2.4 Close to Wix, not Wix's free-form layout

- There is no free positioning, no new regions, and no new component types. Only existing fields are edited: inline text, list add/delete/reorder, links, media, and on/off toggles. Header layout (logo left, menu, CTA) does not change.

---

## 3. Editable field map

### 3.1 Inline text (`INLINE_GLOBAL_FIELDS`, `src/editor/canvas/fields.ts`)

The rule is the same as V5: localized `text` (single-line `textarea` also allowed), single line, ≤ 1000 characters, `normalizeInline`, `plaintext-only`. If EN is empty, the TR fallback is shown; clicking shows a `"No text in this language"` warning and writes only to EN.

| Global | Paths |
|---|---|
| `header` | `navItems.*.link.label`, `navItems.*.children.*.link.label`, `navItems.*.children.*.description`, `navItems.*.columns.*.title`, `navItems.*.columns.*.links.*.link.label`, `navItems.*.columns.*.links.*.description`, `navItems.*.featured.title`, `navItems.*.featured.description`, `navItems.*.featured.link.label`, `cta.link.label`, `cta.secondary.label`, `announcement.text`, `announcement.link.label`, `utility.links.*.link.label` |
| `footer` | `columns.*.title`, `columns.*.links.*.link.label`, `legalLinks.*.link.label`, `brandBlurb` (if empty, tagline fallback: fallback badge; typing writes only to `brandBlurb`) |
| `site-settings` (admin) | `siteName`, `tagline` |

- `FIELD_PATH_RE` accepts at most 4 extra segments. The deepest path, `navItems.0.columns.1.links.2.link.label`, fits this limit exactly. A test locks this. The regex is not widened.
- Global-specific security: `isInlineGlobalField(global, path)` check uses `Object.hasOwn`, and a schema↔allowlist test is written (V5 `visual-editor-fields.test.tsx` pattern: every path must be a localized text/textarea in the global config).
- **Not editable inline:** `copyright` (`{year}`/`{siteName}` template; resolved text appears on the canvas). This field is edited as a raw template in a small panel. Link URLs, media, and relations are also not edited inline.

### 3.2 Lists: add, delete, reorder (`CHROME_LISTS`, `src/editor/canvas/chrome-rules.ts`)

| List path | maxRows | Axis | New row template |
|---|---|---|---|
| `header.navItems` | 8 | horizontal (desktop) / vertical (mobile) | `{ link: { type:'route', route:'urunler', label:'Yeni öğe' } }` (active locale) |
| `header.navItems.*.children` | — (recommended UI limit: 12) | vertical | route link + empty description |
| `header.navItems.*.columns` | 4 | horizontal | title + 1 link |
| `header.navItems.*.columns.*.links` | 8 | vertical | — |
| `header.utility.links` | 4 | horizontal | — |
| `footer.columns` | 6 | horizontal | title (required) + 1 link |
| `footer.columns.*.links` | — | vertical | — |
| `footer.legalLinks` | — | horizontal | route `yasal_slug` |
| `site-settings.social` | — | horizontal | platform selection required (from panel) |

- Actions: the selected item's toolbar has move ←/→ (horizontal) or ↑/↓ (vertical), drag via ⠿, Duplicate, Delete (confirmation on second click), and "+ Add item". Moving is **within the same list only** (moving across lists: §8 question 4).
- Keyboard: Tab/↑↓/←→ selects. Alt+arrow moves. Enter edits text. Delete deletes on two presses. Esc clears selection. Focus ring is visible (`outline` 2 px, accent color, WCAG 2.4.7). Move result is announced via `aria-live` (e.g. "Products moved to position 2").
- When a list reaches `maxRows`, "+ Add item" is disabled and the tooltip explains why. Server `maxRows` validation remains authoritative.
- `navItems.*.megaMenu` (none / products / solutions / custom) is changed via segmented buttons in the selected menu item's small panel. When `custom` is selected, columns and the featured card become editable.

### 3.3 Small panels (on the admin side, positioned over the canvas)

Popovers are rendered **in the admin host**, not in the iframe. The bridge only sends a `{ type:'panel', kind, path, rowIds, rect }` request. Values go into the admin form, so no URL or relation value is ever written into the iframe.

| Panel | Content | Rule |
|---|---|---|
| **Link target** | Tabs: *Site page* (`LINK_ROUTES` list + `routeParam` slug field if needed, `ROUTE_PARAM_PATTERN`), *Record* (`LINKABLE_COLLECTIONS` via Payload `useListDrawer`; page, product, solution…), *External URL* (URL + "open in new tab") | URL is checked by server `validate` (G1). Client also gives an early warning using the same pure function. `pageType: template` pages do not appear in the list (`filterOptions` addition, schemaless). If a draft target is selected, a "Target is not published; visitors will not see this item" warning appears. If a sales legal page is selected, a "Hidden while payments are off" notice is shown. |
| **Mega menu** | Type selection, add/remove column, featured card image (media drawer) and link | `products`/`solutions` have automatic content. Canvas shows an "Automatic: product families" badge; content is not edited here. |
| **Announcement bar** | Show, visitor can dismiss, link | Text is edited inline. Editing render ignores `localStorage` dismissal state. |
| **Utility bar** | Search, language, account toggles | Bar is visible only at ≥ lg width. At 390 width, a "Visible on desktop" note appears. |
| **Logo** (admin) | Media drawer for `logo` / `logoDark` (`useListDrawer({ collectionSlugs:['media'] })`, `where protected equals false`) and upload (`useDocumentDrawer`) | `publicImage` rejects protected or non-image media. Panel warns with the same rule. Header and footer are on a dark background, so `logoDark` takes precedence; the panel explains this. |
| **Social links** (admin) | Platform (6 options) + URL, add/delete/reorder | Render only shows `https?:`. In G1, `validate` (https required) is added to `social.url`. |
| **Contact** (admin) | email, phone, address, working hours | The "Show contact info" toggle in the footer lives in the footer form. The panel clearly separates the two globals. |
| **Copyright text** | Raw template + `{year}` `{siteName}` help | — |

### 3.4 Badges and states (editing render only)

- `"Ziyaretçiye görünmüyor"` (Not visible to visitors): link unresolved, target is draft, sales legal page while payments are off, or column title empty. Row is dimmed, badge states the reason, and it remains selectable.
- `"Varsayılan (kayıtlı değil)"` (Default (not saved)): i18n fallback menu, CTA, footer columns, and legal fallback. First edit attempt opens the G3 materialization dialog.
- `"Otomatik içerik"` (Automatic content): products and solutions mega panels.
- `"Yalnız yönetici"` (Admin only): logo, site name, social, and contact when logged in as editor.
- `"Site geneli · Tüm sayfalarda"` (Site-wide · On all pages): chrome regions in the page or product editor.

---

## 4. Phases

Total estimate: **12–16 business days** (including G6). Schema is in a single phase (G1). Pause at the end of each phase for user approval.

### G0 — Verification spike (0.5–1 day, schemaless, throwaway branch)

- **Scope:** git worktree `../softmarket-g0`, DB and uploads copy, port 3510. Items to prove:
  1. In global view, do `admin.livePreview.openByDefault`, `elements.beforeDocumentControls` host, `useDocumentInfo().globalSlug`, `useAllFormFields`/`addFieldRow`/`moveFieldRow`/`removeFieldRow`, and `useLivePreviewContext().iframeRef` work?
  2. Is `req.searchParams.get('previewPath')` accessible inside `livePreviewURL({ globalConfig, req })`? If not, use a user preference (`usePreferences`) as fallback.
  3. Temporary `versions.drafts` on Header with `migrate:create` (on copy only): is the SQL ADD-only, is there any `__new_`? What is the `_status` default and what does `findGlobal({draft:false})` return on an existing row? Does `findGlobal({draft:true})` fall back to the main row when no version row exists? What does `updateGlobal` without `_status` (import/MCP) do: draft or published?
  4. Mounting the bridge overlay inside `<dialog>` top layer and handling the `cancel` event.
  5. Keeping `initMegaNav` open with `data-canvas-pinned`.
- **Output:** `docs/editor-pilot/globals-spike.md` (yes/no per item, evidence command, impact on G1–G4). Spike code is not merged into main.
- **Acceptance:** all 5 items proven. If item 1 or 3 is "no", the plan is revised and the user is notified.

### G1 — Schema and server contracts (1.5–2 days, **WITH schema**)

- **Scope:**
  - `src/globals/Header.ts`, `Footer.ts`: `versions.drafts.autosave.interval = 2000`, `max: 50`.
  - Migration `pnpm migrate:create globals_chrome_drafts`: `CREATE TABLE _header_v*`/`_footer_v*` (+ locales and nested array tables), `ALTER TABLE header|footer ADD _status` (+ `_header_v.autosave`), indexes, `UPDATE … SET _status='published'` for existing row and initial published version row `INSERT` per G0 result. Down removes only these. DB copy → `pnpm migrate` → `content:import --dry-run` → integrity/FK → migration test.
  - `src/lib/revalidate.ts`: `withGlobalRevalidation` revalidates drafted globals only on publish. `site-settings` and non-drafted globals work as before.
  - `src/editor/canvas/concurrency.ts`: `guardGlobalEditorVersion`, `savedGlobalEditorVersion` (global hooks). `plugin.ts` → `visualEditorGlobals(['header','footer','site-settings'])`: adds field, attaches hooks, `admin.livePreview.openByDefault`, `admin.components.elements.beforeDocumentControls` host.
  - `src/fields/link.ts`: `validate` on `url` field (pure `isSafeLinkUrl`, shared rule with `src/lib/safe-href.ts`). `filterOptions` on `reference` so `pages.pageType != template`. `SiteSettings.social.url`: https validation. These changes are validation-only, not schema.
  - `src/lib/content-import/importer.ts`: `_status: 'published'` for drafted globals. Regenerate `content/seed/schema.json`.
  - `src/lib/preview-url.ts`: `LIVE_PREVIEW_GLOBALS = ['header','footer','site-settings']`, `previewTargetPath` for global uses `previewPath` (only if `safePreviewRedirect` passes) or `/`. `payload.config.ts` `livePreview.globals`.
  - `AGENTS.md` MCP recipe: header and footer updates require `_status: 'published'`, otherwise they stay draft (exact wording per G0 result). `src/lib/mcp.ts` allowlist unchanged.
  - `pnpm generate:types`, `pnpm generate:importmap`.
- **Acceptance:** `<header>`/`<footer>` HTML across 8 representative pages × TR/EN before and after migration is byte-for-byte identical (`/`, `/tr/urunler`, product, legal, `/en`…). 0 row difference on old tables, integrity ok, FK 0. Draft autosave does not change public reads and does not call revalidate (test). Publish revalidates once. MCP update behavior without `_status` is locked by test. `content:import` 2× idempotent, globals stay published. Stale version returns 409, versionless write passes, one of two concurrent saves gets 409. `javascript:`/`data:`/`//evil` URL save returns 400. All existing URLs in seed and starter template pass.
- **Tests:** `tests/unit/globals-drafts-migration.test.ts` (DB copy, up/down/up, row and TR/EN preservation, no forbidden SQL statements), `globals-editor-db.test.ts` (409, versionless write, concurrent, draft read staff-only), `link-url-validate.test.ts`, extend `revalidate` test, `content-import` global fixture, `starter-template-db.test.ts` green.
- **Risks:** chrome falling back to default in public due to `_status` default (G0 + byte test). Long names for nested array version tables. No pruning beyond `max: 50`. New URL validation blocking legacy records (seed test + validation applied only on new values if needed).

### G2 — Rendering: draft reading and editing markers (1.5–2 days, schemaless)

- **Scope:**
  - `src/lib/site.ts`: `getHeaderNav(locale, mode)` and `getFooterData(locale, mode)`. `mode = 'public' | 'editing'` (staff draft via `readAs`). Public path uses today's code unchanged. Editing path adds `rowPath` (`navItems.2.children.1`), `rowIds` chain, `hiddenReason` (`unresolved|draftTarget|salesLegal|emptyTitle`), and `fallback: true` to each item. Visibility decision still uses the **public** resolver so the badge accurately answers "does a visitor see this". Appearance comes from draft data.
  - `src/components/layout/{header,header-shell,footer,announcement-bar,logo}.tsx`: only when `editing` prop is true, emit `data-chrome="header|footer|announcement|utility|mobile"`, `data-chrome-path`, `data-chrome-ids`, `data-chrome-list` (list container + axis), and `data-field-path` (text). Badges are rendered on the server. `AnnouncementBar` ignores dismissal state in editing.
  - `src/app/(frontend)/[locale]/layout.tsx`: if `previewUser` exists, call `Header`/`Footer` in editing mode. Public branch unchanged.
  - `src/lib/header-nav.ts`: panel does not close if it has `data-canvas-pinned` (≤ 5 lines). `initSheet`: link click does not close a `data-canvas-pinned` dialog.
  - `data-chrome-region` on chrome regions for the page editor (used by G5).
- **Acceptance:** public HTML byte-for-byte identical (8 pages × 2 languages from G1, anonymous and staff without draft cookie). Home page JS gzip diff ≤ +0.1 KB. In editing HTML, every visible menu/footer item's `data-chrome-path` maps to a row in form state (DB test). When payments are off, sales legal link has a badge in editing and is absent in public. Mega panel stays open with `data-canvas-pinned`. `header-keyboard.spec.ts` green.
- **Tests:** `tests/unit/chrome-render.test.tsx` (public unmarked / editing marked, badge reasons, fallback flags), `chrome-render-db.test.ts` (temp SQLite, TR/EN, draft staff-only), `client-bundle-guard` (+ chrome editor modules not imported in frontend), e2e `header-keyboard` regression.
- **Risks:** adding mode to `React.cache` key (public and editing must not mix in the same request). Badged items breaking mobile menu layout (editing only).

### G3 — Bridge and host core: global scope (3–4 days, schemaless) — **critical core**

- **Scope:**
  - `src/editor/canvas/protocol.ts` **v3**: `scope: 'block'|'doc'|'chrome'`. New bridge messages: `chromeReady` (regions + list summaries), `chromeSelect`, `chromeMove { list, ids, place, targetId }`, `chromeAdd { list, ids, afterId }`, `chromeDuplicate`, `chromeRemove`, `panel { kind, path, ids, rect }`, `openGlobal { global, previewPath }`. Text messages `scope:'chrome'` + `global`. Host messages: `host` (`target: { kind:'collection'|'global', slug }`, `editable` region list, `readOnly` reasons, list limits), `textGrant`, `notice`. Strict schema preserved, same origin+source gate. `CANVAS_VERSION` 2 → 3 (both sides load together; old-version messages are silently dropped).
  - `src/editor/canvas/fields.ts`: `INLINE_GLOBAL_FIELDS`, `isInlineGlobalField`. `chrome-rules.ts`: `CHROME_LISTS`, limits, new row templates, id→index resolution (address is always the row ID chain, render index is never used; host resolves against current form state and rejects on ID mismatch).
  - `src/editor/canvas/admin/host.tsx`: global scope via `globalSlug` from `useDocumentInfo()`. Page body locked. Region switching (flush → `router.push('/admin/globals/<x>?previewPath=…')`). No autosave on `site-settings`, "Save = publish immediately" confirmation. In editor role, `site-settings` regions are read-only. Undo/redo (`history.ts`, per-locale key `global:<slug>:<locale>`). 409 flow (`sync.ts`, `merge.ts` global identity). Shared types kept in common modules; no duplicate modules.
  - `src/editor/canvas/bridge.tsx`: hover/selection frame on `[data-chrome]` regions, list toolbar, horizontal/vertical drag, keyboard axes, `plaintext-only` editing, panel request. Mega/mobile states arrive in G4.
  - **Materialize default menu into a record:** `POST /api/editor/chrome/materialize` (`src/app/(payload)/api/...` or a Payload global endpoint). Staff session only, same origin, `editorVersion` precondition. Generates route links with both TR **and** EN labels from i18n `nav`/`footer` messages and writes a **draft** only. Then host runs `Yeniden yükle` (Reload). Prompts user: "The default menu will be converted into an editable record (appearance does not change)."
- **Acceptance (global equivalent of V4 gates):** round-trip 0 diff (open → save without changes → header/footer TR/EN deep equal, excluding `editorVersion` and `updatedAt`). TR/EN 0 leak (edit label in EN → TR unchanged, empty EN not overwritten with TR, Escape preserves empty value). Spoofed postMessage 5 variants + wrong `global`, unknown list, fake row ID, off-allowlist path, and URL-carrying message rejected. `maxRows` cannot be exceeded (client + server). Public HTML does not change after materialization before publish. After publish, same links as fallback menu (equal href set).
- **Tests:** `visual-editor-chrome-fields.test.tsx` (schema↔allowlist, every path localized text), `visual-editor-chrome-bridge.test.ts` (protocol v3, ID resolution, limits, axes), `visual-editor-chrome-db.test.ts` (round-trip, 409, materialize endpoint auth: anonymous 401, customer/editor-API-key 403, cross-site 403), `visual-editor-merge` global case.
- **Risks:** Payload form API behaving differently in global view (mitigated by G0). Preserving row IDs with `moveFieldRow` on deep array paths. Open tabs across `CANVAS_VERSION` bump (old host with new bridge warns: "Refresh the page").

### G4 — Panels, mega menu, and mobile menu UI (2.5–3 days, schemaless)

- **Scope:** `src/editor/canvas/admin/panels/{link-target,mega-menu,announcement,utility,logo,social,contact,copyright}.tsx` (admin import map, no frontend imports). Popover position calculated from iframe `rect` + scale (`Sığdır` (Fit) mode). Focus moves to popover, Esc closes it and returns focus to canvas (`role="dialog"` + focus loop, not `aria-modal`).
  - **Mega menu:** selected top-level item has an "Open/pin panel" button. Bridge applies `data-state=open` + `data-canvas-pinned`. Panel stays open when selection changes. "Close" unpins it. Column and featured card editing happens inside the panel. Automatic panels (products/solutions) are badged and read-only.
  - **Mobile menu:** at 390 breakpoint, toolbar has "Open mobile menu". Bridge calls `showModal()`, portals the selection/toolbar overlay **inside the dialog** (top layer), adds `data-canvas-pinned` to dialog. `cancel` event is swallowed with `preventDefault` during text editing (first Esc exits editing, second Esc closes dialog). Native focus trap is preserved. Admin popovers live in the parent document, so there is no conflict. Mobile list uses vertical axis. Desktop and mobile edit the same rows.
  - Labels `src/lib/visual-editor-labels.ts` (TR/EN), `admin-labels.test.ts`.
- **Acceptance:** e2e: mega panel is kept open while editing and saving a column title. Item order is changed in mobile menu and also changes on desktop. Link target is changed route → record → external. `javascript:` URL is rejected in panel and on server. Logo changes only with a public image, protected media is rejected. 0 axe violations (popovers). Keyboard-only select → move → edit → open panel flow completes without a mouse.
- **Tests:** e2e `tests/e2e/isolated/visual-editor-chrome.spec.ts`, panel unit tests (URL rule, limits).
- **Risks:** bridge styles colliding with site styles inside top layer (prefixed classes + `all: initial` wrapper instead of shadow DOM). Popover positioning in scaled iframe. Dialog's own Esc behavior.

### G5 — "Site-wide" shortcut in page and product editors (1 day, schemaless)

- **Scope:** `data-chrome-region` hover frame and `"Site geneli · Tüm sayfalarda"` (Site-wide · On all pages) badge on pages/products canvas. Clicking shows `"Üst menüyü düzenle ↗"` / `"Alt bilgiyi düzenle ↗"` (Edit top menu / Edit footer). Selection row does not open. Host flushes pending page save and opens global editor with `previewPath=<current path>`. Global editor has "← Back to <Page name>" (`sessionStorage` return path, only `/admin/collections/(pages|products)/<id>` pattern). If chrome draft is unpublished, badge shows: "Unpublished changes in chrome".
- **Acceptance:** pending changes on page are not lost (flush + 409 path). Return restores the same page and same scroll position. Product editor V2 locks are not broken. Badge is absent from public HTML.
- **Tests:** e2e scenario (page → chrome → back), `visual-editor-bridge` extension.

### G6 — `site-settings` brand regions (1–1.5 days, schemaless; depends on §8 question 2 answer)

- **Scope:** canvas in `site-settings` global view: logo/logoDark (panel), siteName/tagline (inline), social (list + panel), contact (panel). No autosave. Confirmation dialog before saving: "Saving this change publishes it across the entire site immediately." Other tabs (commerce, company, legal) stay in the form and have no canvas regions. For editor role, regions are read-only (server `isAdmin` is authoritative).
- **Acceptance:** admin changes logo and social links; after save, public header/footer update (revalidate once). Write attempt as editor gets 403 and canvas shows `"Yalnız yönetici"` (Admin only). Commerce/legal fields do not change through canvas operations (DB test: deep equal before and after save).
- **Risks:** `site-settings` form is large and tabbed. The entire form is submitted, so a test must lock that payment fields are not accidentally modified.

### G7 — QA, performance, security audit, and guide (1.5–2 days)

- `.next-g7` build with DB copy. Lighthouse mobile 3-run median (`/tr`, product): Perf, LCP, CLS 0, and JS ≤ 130 KB (no more than +0.2 KB increase over V5's 129.62 KB).
- Isolated e2e (3400): V5 scenarios + chrome scenarios + `header-keyboard` + `payments` (sales legal link filter). Security: spoofed message, anonymous/customer admin global view, copied draft cookie, materialize endpoint.
- `docs/editor-guide.md` new section `"§2.11 Site çerçevesini görsel düzenle"` (Visually edit the site chrome). `AGENTS.md`: globals draft/publish, MCP `_status`, chrome markers. `memory-bank` update.
- **Acceptance:** `docs/perf/visual-globals-acceptance.md` table green, user has completed and approved the 6-task trial: (1) add a menu item and type its name, (2) swap two items, (3) point an item to another page, (4) add a column to footer, (5) switch to EN and translate a label, (6) publish.

---

## 5. Parallelism and sequencing

- **Order:** G0 → G1 (single schema phase; no other `migrate:create` until merged into main) → G2 → G3 → (G4 ∥ G5) → G6 → G7.
- G4 and G5 can run in parallel. File ownership: G4 `src/editor/canvas/admin/panels/**`, mega/mobile part of `bridge.tsx`. G5 redirect/return part of `host.tsx`, `data-chrome-region` part of `bridge.tsx`. `bridge.tsx`/`host.tsx` are shared files; the G3 owner reviews before merging.
- `generate:types`/`generate:importmap` run only on the schema owner (G1) and when panel components are added (G4).
- Build and typecheck are not run at the same time. Heavy SQLite tests use `--maxWorkers=1`.
- Cross-QA and user approval are obtained at the end of each phase before moving to the next.

## 6. Agent assignments

Rules: author and reviewer are different. When Claude writes, GPT Sol or Terra High reviews. When GPT writes, Opus Medium reviews. Heavy backend and critical core are Opus Medium. UI is Sonnet Medium. Design-heavy work is Opus Medium (Sonnet High is not used). Expensive models are used only on critical work.

| Phase | Author (effort) | Reviewer (effort) | Note |
|---|---|---|---|
| G0 spike | GPT Terra (High) | Claude Opus (Medium) | Focused diagnosis, 1-day timebox |
| G1 schema + migration + hooks | Claude Opus (Medium) | GPT Sol (High) | Sol reviews migration SQL and `_status` semantics |
| G1 URL validation + importer | GPT Sol (Medium) | Claude Opus (Medium) | Clear, well-tested work |
| G2 render + markers | Claude Opus (Medium) | GPT Terra (High) | Byte equivalence and bundle measurement on Terra |
| G3 protocol + host + bridge core | Claude Opus (Medium) | GPT Sol (High) + Terra (High) security | Most critical work of the plan. Opus High only if G0 finds a form API difference |
| G3 materialize endpoint | Claude Opus (Medium) | GPT Sol (High) | Authorization and transaction |
| G4 panels + mega/mobile UI | Claude Sonnet (Medium); popover/interaction design Opus (Medium) | GPT Sol (High) | a11y and bundle guard |
| G5 shortcut | Claude Sonnet (Medium) | GPT Sol (High) | |
| G6 site-settings | Claude Sonnet (Medium) | GPT Sol (High) | Test proving commerce fields are preserved is required |
| G7 tests/perf/security | GPT Terra (High) + Sol (Medium) e2e | Claude Opus (Medium) | Split into short tasks |
| G7 guide, labels, AGENTS, memory-bank | Claude Haiku (Low) | GPT Sol (Medium) | |
| End-of-phase commit | Claude Haiku (Low) | — | Only when QA is green and user requests it |

## 7. Top risks

1. **Side effects of adding drafts to globals.** `_status` default could cause public chrome to fall back to default. MCP or import writes without `_status` could stay draft or go live. Autosave could revalidate the entire site every 2 seconds. Mitigation: G0 proof, backfill, byte test, publish-only revalidate test, importer `_status`, AGENTS recipe.
2. **Row identity and filtered rendering.** Public loader drops items, and the fallback menu has no record. Editing render must differ from public, while public HTML must not change. Mitigation: mode separation, addressing by row ID chain, host-side ID validation, byte test, materialize endpoint.
3. **Mega and mobile menu interaction.** Auto-close, `<dialog>` top layer/inert, and Esc conflict require touching public code. Mitigation: minimal patch with `data-canvas-pinned`, portaling bridge overlay inside dialog, `header-keyboard.spec.ts` regression, bundle measurement.

Additional risks: Payload global edit view internal API (chrome e2e mandatory on every Payload upgrade), submitting the entire `site-settings` form, new URL validation blocking legacy records.

## 8. Open questions for the user (with recommendations)

1. **Single canvas level:** Our recommendation: chrome is edited in its own editor, and in the page editor a "Site-wide → Edit" shortcut switches to it on the same view. Is direct menu editing from inside the page editor (second write path, +4–6 days and extra risk) needed in the first release? **Recommendation: no.**
2. **Logo, site name, social links, and contact (`site-settings`):** Should it stay draftless in the first release (save = publish immediately, admin only, with confirmation dialog), or should drafts also be added to `site-settings` (+1.5–2 days, payment/legal reader audit)? **Recommendation: draftless + confirmation.**
3. **Editor role:** Today editors can also update header and footer. Once drafts are added, should publishing remain open to editors? **Recommendation: yes** (existing access preserved).
4. **Menu move scope:** Is dragging a submenu item under a different top-level menu (moving across lists) needed in the first release? **Recommendation: no.** Reordering within the same list is enough; moving across lists in a later release.
5. **Unrecorded default menu/footer:** When editing starts, should it be materialized into a record with TR and EN labels on a single confirmation (appearance unchanged, as a draft)? **Recommendation: yes.**

## User decisions (2026-11-17)

- **No** direct menu editing inside the page editor; in the page editor, the header/footer region switches to the chrome editor via the `"Site geneli"` (Site-wide) shortcut (G5).
- Site settings (logo, site name, social, contact) are **draftless**: save = publish, admin only, confirmation dialog before saving (G6).
- Header/footer publish permission: **editor + admin** (today's access preserved).
- Submenu items are reordered **within the same list only**; no dragging across menus.
- Unrecorded default menu/footer is materialized into a record with TR+EN labels on a single confirmation when editing starts (recommendation accepted — question 5 was not asked, recommendation taken as default).

## G0 result and plan revision (2026-11-17)

G0 accepted (report: `docs/editor-pilot/globals-spike.md`). 5 of 6 items passed; mobile menu Esc handling accepted conditionally. Revisions:

1. Mobile menu (`<dialog>`) Esc handling uses `document` capture `keydown` (Escape) instead of the `cancel` event; first closes selection/editing, then the dialog. Chromium makes `cancel` non-cancelable on the third consecutive Esc.
2. Bridge/selection overlay is mounted INSIDE the dialog; `popover` and body overlays cannot be clicked underneath the top layer.
3. G1 migration: `versions.drafts` + autosave for Header and Footer; at the end of migration `UPDATE header SET _status='published'; UPDATE footer SET _status='published';` (no initial version row INSERT needed). Footer migration rebuilds `footer_columns_locales` (`title` NOT NULL → nullable): project rule forbids `__new_` rebuilds; manager decision: migration rebuilds only when this table is EMPTY, throws and stops if rows exist (data loss impossible). Table is empty on live. Rehearsal with populated data runs on a DB copy. Down drops only version tables and `_status`; `title` nullability is not reverted.
4. Acceptance: public header/footer HTML before/after migration is raw-byte equal and content-hash equal.
5. Importer and MCP recipe always send `_status: 'published'`; draft writes only with `draft: true`. In `beforeChange`, `_status: 'draft'` without `draft` is rejected (because public reads do not check `_status`, draft content would otherwise leak to live). Tested.
6. Mega menu pinning: only editing render emits `data-canvas-pinned`; unpin/cleanup mandatory; switching to another panel unpins+pins.
7. In G2, `livePreview.breakpoints` (390/768/1440) is defined for header/footer. With drafts+autosave there is a single `"Yayınla"` (Publish) button. `previewPath` query works; preference fallback not needed. `iframeRef.current` is null on first render — read via effect/poll.

## G1 implementation record (2026-11-17)

Status: implemented, awaiting QA. Not applied to the live DB, no commit.

- **Schema:** `Header`/`Footer` get `versions: { drafts: { autosave: { interval: 2000 } }, max: 50 }` (`src/globals/chrome-drafts.ts`). Migration `20261117_133332_globals_chrome_drafts`:
  - Up: 22 `CREATE TABLE` (`_header_v*` 13, `_footer_v*` 9), 69 `CREATE INDEX` + 11 `CREATE UNIQUE INDEX` (incl. the two recreated `footer_columns_locales` indexes and `header__status_idx`/`footer__status_idx`), 2 `ALTER TABLE … ADD _status`, 2 backfill `UPDATE … SET _status = 'published'`. No `DELETE`, `INSERT`, `PRAGMA`. No initial version row (G0).
  - The only rebuild is `footer_columns_locales` (title NOT NULL → nullable): the first statement of up() counts its rows and throws `FOOTER_REBUILD_REFUSED` before any change when the table is not empty; when empty it is recreated without copying data. The live DB table is empty (0 rows).
  - Down: refuses (`DOWN_REFUSED`) while header/footer have an unpublished draft (`latest = 1 AND version__status = 'draft'`), because that content exists only in the version tables. Otherwise it drops the 22 version tables (children first), the two `_status` indexes and columns. Published history is dropped with the tables (the current content is in the main row; take a backup first if history matters). `title` nullability is not reverted (a NOT NULL rebuild could fail on rows written after up()).
  - DB copy: 700 pre-existing tables row-hash equal after migrate, `integrity_check` ok, `foreign_key_check` empty, header/footer `_status = published`, `content:import --dry-run` and 2× real import ok (idempotent, 0 new header/footer versions).
- **`_status` safety:** global `beforeOperation` (`guardGlobalDraftStatus`; global `beforeChange` has no `draft` argument in Payload 3.93) rejects with a 400 `ValidationError` (`req.t('softmarket:…')`, TR/EN in `src/lib/validation-messages.ts`): `_status` other than `published` without `draft: true` (covers Local API, REST, MCP and the admin "Unpublish" request), restoring a draft version, and REST "restore as draft" (Payload global restore writes the main row directly). Importer sends `_status: 'published'` for drafts-enabled globals and re-writes a main row that is not published.
- **Revalidation:** `withGlobalRevalidation` revalidates a drafts-enabled global only when the result is published (the restore record's `version._status` is authoritative); draft/autosave never revalidates. `site-settings` unchanged (every save).
- **Concurrency:** `guardGlobalEditorVersion`/`savedGlobalEditorVersion` (`src/editor/canvas/concurrency.ts`), added by `visualEditor()` to header/footer with the virtual `editorVersion` field (no schema). Same token as collections (all-locale snapshot hash); stale → 409, versionless writes pass, two concurrent saves from one base → exactly one 409. `lockDocuments` stays Payload's default for globals (different-user lock only).
- **Link URL validation:** `linkField().url` validate = `isAllowedLinkUrl` (`src/lib/safe-href.ts`, same rule as `safeHref`). Dangerous values (`javascript:`/`data:`/`vbscript:`, obfuscated variants, `//`, `/\`) are always rejected; other invalid values are rejected unless unchanged (`previousValue`). Seed/starter contain no `url` values. Live DB: 16 product CTA rows with the placeholder `mailto:[ŞİRKET E-POSTA]`/`mailto:[COMPANY EMAIL]` (8 products × TR/EN) fail the rule and are grandfathered while unchanged (render already drops them). Payload does not validate drafts; publishing validates.
- **Draft reads:** `getHeaderNav(locale, previewUser)` / `getFooterData(locale, previewUser)`; `Header`/`Footer` pass `getPreviewUser()` (draft mode + re-validated staff). Anonymous reads stay `draft: false`.
- **Not in G1 (moved per G0 revision 7 / user scope):** global Live Preview config and editor host (G2/G3), `reference` `filterOptions` for template pages and `site-settings.social.url` https validation (still open).

### G1 independent audit (2026-11-17)

- Fixed public/customer `draft: true` reads and customer version-history access: chrome globals now use `publishedOrStaff` and explicit staff-only `readVersions`.
- Fixed status-less updates inheriting a pending draft and copying it into the public main row. They return 400; status-less writes without a pending draft preserve the legacy publish behavior.
- Refused projected writes (`select`, 400 before mutation): Payload 3.93 passes the projected main-row result into version persistence, truncating history, defaulting its status to draft, and skipping publication revalidation. Callers can project a subsequent read.
- Fixed invalid URL grandfathering through autosave. Publication (including version restore) compares all localized URLs and stable array row IDs against the pre-write public row, inside the same transaction and before revalidation. Drafts can still hold incomplete input; invalid publication rolls back.
- Migration SQL on the required backup copy matches the snapshot's columns, nullability, primary keys, foreign keys and indexes; integrity is `ok`, with no foreign-key violations. Up/down guards and published backfill remain unchanged. Leaving `footer_columns_locales.title` nullable on down is the intentional G0 exception.
- Final validation: backup-copy up/down/up preserves original-column row hashes for all 701 pre-existing tables. Typecheck, lint and diff-check pass; full Vitest passes 94 files / 1,558 tests (384.14 s), including 18 G1 database regressions, migration guards, URL bypasses, publish-only revalidation and editor concurrency. No open G1 findings; no commit or live migration was performed.
