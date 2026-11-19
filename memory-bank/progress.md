# Progress

## VPS disk footprint

- Classified `tsx` and TypeScript as runtime dependencies and Tailwind/PostCSS as build dependencies. The disposable macOS release used 952 MiB of production dependencies and 39 MiB of compiled output after excluding 885 MiB of Webpack cache.
- The production-only release rendered both locales, a product and the Payload admin, and served a sample upload through in-process HTTP handlers. Snapshot retention was exercised only with temporary fixtures. Linux systemd and Caddy acceptance remains open.
- Typecheck, lint, the isolated production build, and all 1,892 unit tests passed.

## Payments P8 security audit (2026-11-19, done)

- P8 audit complete; fixes QA'd and runtime-verified (isolated e2e 30/30, MCP Bearer, REST/GraphQL API-key denials, admin cookie session, content:import and payments:reconcile dry runs).
- Sandbox acceptance waits for user keys. Full suite 1891 tests passed.

- Closed API-key access to order documents, payment events and integrations. Blocked API-key account mutations, restricted order provider fields, and unified panel-session checks for payment settings and legal approval.
- Kept verified Stripe refunds and disputes active after the checkout drain. Added bounded browser return limits and skipped provider calls for ineligible order states.
- Typecheck and the full Vitest suite (1891 tests) passed. Real-provider sandbox acceptance and multi-process SQLite performance are pending.

## L10 deployment and audit (2026-11-19, uncommitted)

- Added `lisans.{$DOMAIN}`, reviewed all systemd units, and documented provisioning, recovery, incident response, and VPS acceptance. `pnpm licensing:preflight` checks the real L4 file helper and reads signing metadata through read-only SQLite.
- Hardened Caddy routing, trusted headers and log redaction. Fixed limiter eviction, audit coalescing, login and preview origin checks, API-key license creation and SMTP deferral. The web unit uses in-memory ISR under the read-only release sandbox.
- Typecheck and lint passed. Vitest passed 1,880 tests in 115 files, and 23 focused tests passed after adding the staff REST login guard. Linux VPS acceptance, browser E2E, and the 250 ms load gate remain open.

## L8 identity/webhook anomalies and L9 client kit (2026-11-18, not committed)
- L8: `events/anomalies.ts` observers in Users hooks, portal login action and payment webhooks; per-hour coalescing, cap of 20 prefix rows per type/hour; new-network admin alert via L5 queue. Tests: `licensing-anomalies-db.test.ts` (6 L8 cases). Full suite 1,848 tests / 114 files passed.
- L9: client guide, test vectors tied to L2 fixtures, TS verifier (tested), C# verifier (not compiled, no dotnet), `pnpm licensing:sim` run end to end on an isolated DB copy by QA.

## G1 rollback (2026-11-18)

- Reverted the header and footer draft workflow, global version checks, draft preview reads, and G1 link field validation. Render-time `safeHref` filtering still applies.
- The forward migration removes 22 version tables, their indexes, and two status columns. It refuses pending unpublished drafts. Its down migration restores the G1 schema with empty history. The physical `footer_columns_locales.title` column stays nullable, and Payload still requires the title on save.
- The live backup copy passed integrity and foreign-key checks. All 710 non-G1 table hashes matched before and after migration and the import dry run, with the newly appended migration ledger entry accounted for separately. The dry run reported 0 creates and 98 updates. The refreshed snapshot generated no follow-up schema changes.
- Type generation, typecheck and lint passed. The full Vitest run passed 1,802 tests in 110 files, including three migration cases covering draft refusal, row preservation and rollback.

## Licensing L6b admin actions

- Implemented the §5.4 admin endpoints (suspend, revoke, restore, reactivate, device release/revoke, triage, block add/lift incl. from events, signing key rotation) with the P6 guard, idempotent receipts, optimistic concurrency and one log + one audit row per action; settings-change audit; license side panel, security center action widgets and the rotate button. No schema change or migration.
- Audit fixes: actor- and payload-bound idempotency (`409 idempotency_conflict`), CIDR network masking, `blocks-cache` in-flight invalidation retry loop, strict `:id`/header/`Origin` checks, `revokeConfirmation` length guard, and `settings-audit` first-entry truncation.
- Tests: `licensing-admin-endpoints-db` (17), `licensing-admin-ui` (4); admin-labels and payments-p4 boundary kept green. Full suite: 112 files / 1,821 tests.
- Open: enforce reason for direct panel status edits (plan §4.1) if wanted; `denied` audit rows; bulk actions out of scope.

## Licensing L5 rules engine, sweep and notification queue

- Implemented the sweep, six pure rules, monitor-only mode, circuit breaker, episodes/suppression, restore core, retention cleanup and the durable licensing e-mail queue. No migration; one new stored enum value `system.daily_digest` (types regenerated).
- Audit fixes: same-hour breaker re-trip re-opening, retention preservation of open high/critical events / active suppressions / block links / recently lifted blocks / newer log & activation rows / leap-day math, expired-license rule exclusion & revoked-license expiry exclusion, invalid `minSeverityImmediate` fallback, `CHANGE_` contact filtering, whitespace customer email skip, `impossibleTravel` tie-breaking, same-ms rule `dedupe_key` uniqueness, malformed `detail` handling in `restore`, retention upper clamping, and guarded/batched alert marker writes.
- Tests: `licensing-rules` (16), `licensing-sweep-db` (17), `licensing-notify-db` (12), `licensing-retention-db` (6). 10k activations sweep in about 1.4 s locally.
- L6b follow-ups: `licenses.status` is locked for all user-facing updates (field access `nobodyField`, read-only with TR+EN hint; only action endpoints, payment code and the rule engine change it, one log row each; L1 tests moved to server-side transitions), and refused admin actions of identified callers write coalesced `security-audit` `denied` rows (`src/lib/licensing/admin/denied-audit.ts`: reason code, `count=n http=s` note, IP prefix only, one row per key per 10 min; anonymous 401s unaudited; no schema change, no security event).
- Open: L6b admin endpoints (restore/triage/block) wrap the L5 cores; impossible travel only sees aggregated country data; Stripe dispute-closed automation undecided.

## Licensing L4 updates and downloads

- Implemented `POST /updates`, `POST /downloads/link` and `GET|HEAD /dl/<token>` under `/api/v1/licensing`. The existing SQLite schema and temporary upload fixtures cover the new routes.
- L4 regression coverage includes signed admission, current entitlements, five-use concurrency, tampering and expiry, unsafe file paths, HTTP ranges, cancelled streams and privacy. See the L4 implementation record in `docs/plan-licensing-security.md`.
- Typecheck and lint passed. Full Vitest passed 1,747 tests in 106 files, including 36 L4 tests. Production HTTP verification remains open because this environment denies socket binds.

## Licensing L6a security center (read-only)

- Admin custom view `/admin/guvenlik` with tabs Overview, Events, Blocks, Status transitions; counters (open high events, active blocks, suspended licenses, recent activations), filters in the URL, 50/25 rows per page, links to the Payload documents. Nav link with an open-high badge for admins only. Files in `src/admin/security/`, labels in `src/lib/security-center-labels.ts`, styles `.sc-*` in `src/app/(payload)/custom.scss`.
- Access: server-side admin cookie-session check inside the view (editor redirected to `/admin`, anonymous to login) and again in every loader; reads use the Local API with the admin user and `overrideAccess: false`, always with `select`. No keys, customer e-mail, device material or full hashes are shown; `detail` is redacted. No schema, migration, dependency or client JS.
- A custom view under a new key needs its own `DefaultTemplate` wrapper (Payload adds none). Actions (suspend, revoke, block, triage, key rotation) and the rules engine stay for L6b/L5.
- Gates: typecheck, lint, full Vitest 104 files / 1,711 tests (before the final template wrapper; the affected files re-run green). Browser check on an isolated copy (port 3550): anonymous, editor and admin sessions, light and dark, filter submit, mobile width. Record: "L6a implementation record" in `docs/plan-licensing-security.md`.

## Licensing L3 client API

- Implemented and tested signed activation, lease refresh and deactivation against temporary SQLite fixtures. L3 reuses the L1 schema and adds no migration.
- Added durable replay and skew checks, per-device seat enforcement, rebind limits, trusted-prefix abuse controls and privacy-preserving observations. Verified exactly three seats among 20 and 50 concurrent activation attempts.
- Typecheck, lint, and the full suite passed (102 files, 1,672 tests). The isolated production build compiled all four licensing routes.
- Added payment transition and rollback regressions and the client contract at `docs/licensing/client-api.md`. Local load p95 was 70.2 ms for 1,000 successful validations. The production HTTP run on port 3600 needs a host that permits loopback binds.

## Licensing L2 crypto and lease core

- Implemented strict Ed25519 JWS, canonical request and response signing, purpose-specific HMAC and IP privacy helpers. Added the install CLI, transactional key rotation and revocation, and public key discovery.
- Enabled same-origin panel admin edits of non-secret licensing settings. Added RFC vectors and negative tests, temporary SQLite key lifecycle and disclosure tests, and the settings access matrix.
- Type generation, typecheck and lint passed. Full Vitest passed 1,628 tests in 99 files.
- L2 security audit added regression coverage for lease identity and retirement, Ed25519 key encodings, canonical input, proxy trust, vault master changes, read-only key discovery and settings origin checks. Final typecheck and lint passed. Full Vitest passed 1,632 tests in 99 files on isolated databases.
- L2 uses the existing schema. Client activation routes are L3 work. Admin key actions and settings audit are L6 work.

## Licensing L1 schema (`licensing_core`) — 2026-11-17 (independent audit; committed and live-migrated)

- Done: 5 security collections + `licensing-settings` global, license/product fields, transition log hooks, delete guard, migration with partial unique indexes and guarded down, TR/EN admin labels. Record: `docs/plan-licensing-security.md` "L1 implementation record".
- Live: `20261117_200700_licensing_core` applied to data/softmarket.db on 2026-11-17 (pre-migration backup in gitignored data/backups/); integrity_check ok, foreign_key_check clean, content:import dry-run 0 created / 98 updated. Suite: 97 files / 1599 unit tests, e2e 19, isolated 30. Note: `licensing-settings` is server-write-only in L1 (panel save disabled by design until the L2 endpoint). Deferred L3: refund/dispute raw SQL in admin-actions.ts bypasses status logging.
- Tests: `licensing-migration`, `licensing-access`, `licensing-transitions-db` (new); `mcp`, `admin-labels`, `globals-drafts-migration` (updated). The final focused Vitest run passed 58 tests in 5 files. Full Vitest passed 1,599 tests in 97 files. Typecheck and lint passed.
- Audit verified copy migration up/down/up, all 723 original table hashes, integrity, foreign keys, the schema snapshot and seed rollback. Regression tests exercise panel and bearer access, hidden-field predicates, transactional status history, rule gating and draft code reservation.
- Open: settings-change audit and reason-required status edits (L6), payment raw-SQL transition logging (L3), `licenses.activations` join (L3).

## License API / security center / hosting plan — 2026-11-17 (plan only)

- Written: `docs/plan-licensing-security.md` (threat model, API contract, data model, phases L0–L11, agent allocation, 6 open questions) and `docs/plan-hosting.md` (a subdomain is used; shared Passenger hosting is conditional and not recommended). No code, schema, migration or commit. Finding: `admin-actions.ts` changes license status with raw SQL; status logging must also be attached to these paths (L3).

## Integration security audit — 2026-11-17

- Fixed: concurrent loss during secret updates, short secret display, false success with an unreadable SMTP, opening sales with missing company details, a line limit in the legal summary, and port/TLS loss in migration down. Typecheck/lint clean, full test 91 files/1531 tests passed; no migration applied to live.

## Integration settings — 2026-11-17 (QA pending, no commit, not applied to live)

- New unversioned `integrations` global (admin; no MCP): iyzico/Stripe test+live keys, environment (live needs extra confirmation), SMTP. Secrets AES-256-GCM, key `SOFTMARKET_SECRETS_KEY` (if absent, saving is rejected; if lost, secrets cannot be read). Write-only endpoint `POST /api/globals/integrations/secret`, test e-mail `/test-email`. If set in env, env wins.
- E-mail `softmarketEmailAdapter` reads the env → panel setting on every send. Legal company placeholders are filled at render time; `pages.legalReview` binds lawyer approval to the text, and `legalReady` requires approval. `site-settings.company.etbisNo` added.
- Migration `20261117_092957_integrations_settings` (CREATE TABLE + 7 ADD COLUMN, guarded down); verified on a copy. Tests 91/1527, build OK. Details in `docs/plan-payments.md` "Integration settings record".

## P6 security audit — 2026-11-17 (no commit)

- An uncertain refund lock is not opened by time; no repeat refund is allowed for a delayed provider result. Stripe/iyzico server and uncertain responses are not counted as explicit rejections; an iyzico cancellation record is verified with success/amount/currency.
- A Stripe refund/dispute notice returns 500 when the order ID is not yet linked, or when the refund notice is not yet verified at the provider, so it is redelivered. Regressions in `payments-p6*.test.ts`.
- Typecheck/lint clean with the latest code; full test 89 files/1492 tests passed.
- Refund e-mail is delivered at least once; a repeat is possible if the outage happens between SMTP and the marker write. Exactly-once delivery was not achieved. The isolated E2E script was not run in this audit because it terminates the process group; a 404/sitemap test was added at the end.

## P6 admin operations — 2026-11-17 (QA pending, no commit, no schema)

- Order side panel "`Sipariş işlemleri`" (Order actions): `İade et` (Refund) / `İptal et` (Cancel) / `Bildirimi yeniden gönder` (Resend notifications) → `POST /api/orders/:id/{refund,cancel,resend-notifications}` (admin panel session only + same origin; anonymous 401, editor/customer/API key/MCP 403). Refund: first `refundStatus()`, one lock per order (`payment-events` `admin-refund`), single refund, in one transaction `refunded` + license `revoked`; on uncertainty no blind retry (`requiresReview`, reconcile only reads). Refund e-mail via `notify.ts` type `refund` (`refund-notice` marker row). Stripe dispute → `suspended`; there is no dispute notification for iyzico. Operations: `docs/payments/operations.md`.
- Root cause of the `/yasal` static→dynamic 500: in a capability build, routes without a path (empty `generateStaticParams`) remained ISR fallback, and the first runtime render with `noStore` gave 500. Fix: layout `commerceRenderBoundary()` + `contentStaticParams` catch-all path (`__dynamic__`); in the E2E build `dynamicRoutes` is 0. Tests 89/1488 (+1), e2e 29/29. Details in the P6 record of `docs/plan-payments.md`.

## P5 checkout UI + portal orders — 2026-11-16 (QA pending, no commit, no schema)

- P5 QA: in a normal production build, the loopback payment provider cannot be enabled by environment variable; a separate `SOFTMARKET_E2E_BUILD=1` build and an isolated DB are required. The E2E build must not be deployed. The contract copy containing invoice data was hidden from the editor; the recipient VKN is masked in display. CLI processes with an ambiguous environment also reject the loopback provider. Last QA: typecheck/lint clean, 87 files/1462 tests passed; isolated build succeeded; browser E2E was not run because of the PID restriction.
- `/hesap/satin-al/[sku]` (EN `checkout`), `/hesap/siparisler[/no]` (EN `orders`), `startCheckoutAction` + `createCheckoutOrder` (price/VAT computed on the server, form token idempotency, contract copy SHA), CSP form-action only on the checkout path, `CHECKOUT_READY=true` (in the default setup `open` is off; quote mode HTML is identical to HEAD). Callback 303 → relative `/{locale}/hesap/siparisler?donus=1` → the logged-in customer's latest order.
- P3 cache finding fixed: while the capability is on, `getCommerceState` makes every render dynamic; the build environment needs `PAYMENTS_ENABLED=true` (otherwise payments fall back to closed). Isolated e2e with the fake iyzico (`scripts/e2e-fake-iyzico.ts`, port 3500): 28/28. Details in the P5 record of `docs/plan-payments.md`.

## P4 notification audit — 2026-11-16 (no commit)

- Reconcile does not skip ready orders because of a batch full of undeliverable/locked notifications; a new review and license assignment refresh the notification retry budget. The notification migration down refuses if delivery status exists. Isolated SQLite regressions added; the live DB and the 3100 process were not touched. Open P2: reconcile pending/paid queries use a fixed first page; if it fills with persistently failing records, later orders may wait. Current gates: typecheck/lint passed, full test 85 files / 1407 tests passed; committable: no (open P2).

## P4 notification durability — 2026-11-16 (no commit)

- `notify.ts`, `orders.notifications`, migration `20261116_175713_p4_order_notifications`; tests `payments-p4-db` (+7) and `payments-p4n-db` (migration up/down). Not applied to the live DB. Details in the P4 record of `docs/plan-payments.md`.

## P4 independent audit — 2026-11-16 (no commit)

- Callback redirect, closed adapter 404, unverified provider error and conditional cancellation fixed; the CLI license e-mail and durable notification guarantee remain open. Details in the P4 record of `docs/plan-payments.md`.
- Checks: typecheck/lint passed; payments package 16 files/439 tests passed, latest P4 DB 18/18; full package 84 files, 1387 passed / 6 failed (`legal-draft.test.ts`, concurrent P7 scope). Committable: no.

## P4 providers/webhook/fulfillment — 2026-11-16 (QA pending, no commit, no schema)

- Routes `src/app/(payload)/api/payments/{iyzico/webhook,iyzico/callback,stripe/webhook}`, core `src/lib/payments/{body,runtime,events,sync,fulfill,reconcile,route}.ts`, e-mail `src/lib/email/order-{confirmation,review}.ts`, CLI `pnpm payments:reconcile`, `deploy/payments-reconcile.{service,timer}`. `checkoutReady` is still false.
- Tests `tests/unit/payments-p4{,-db}.test.ts` (10 + 17): signature/size, single license (repeat + concurrent webhook/callback), review, drain, retrieve error/busy → 500 + retry, callback, reconcile, e-mail, log PII scan. Details and notes in the P4 implementation record of `docs/plan-payments.md`.

## P3 independent audit — 2026-11-16 (no commit)

- P1 closed: open payment HTML/RSC was returning HIT from ISR even when the env was off (reproduced in production). Open payment surfaces use `unstable_noStore`, quote mode uses ISR; Next bailout is outside the content/DB catch. The ISR HIT target for payment mode was removed for security.
- P2: same-origin absolute/normalized legal URL filter, reset after an invalid price entry, readiness price/VAT/provider consistency, and the active provider's test/live/MIXED badge were fixed. Pure/SQLite and real React DOM regressions were added.
- Production render 6/6: open price; DB quote/env off shows no price, sales legal 404. Anonymous REST/GraphQL and draft/staff boundaries verified. P3 limit: if a slug is renamed, the sales type is not recognized (`commerceLegal` in a later phase). Details in the P3 audit record of `docs/plan-payments.md`.
- Final gates: typecheck/lint 0 errors, full test 80 files/1339 tests (296 s), both open and quote builds with the latest code, production render 9/9, diff-check clean. Build/scratchpad deleted, tsconfig restored. Live DB, 3100, `.next`, techContext preserved; P3 committable: YES.

## P3 mode gate and visibility — 2026-11-16 (QA pending, no commit, no schema, no checkout)

- `getCommerceState` (env + site-settings.commerce + provider/VAT; fail-closed, does not touch the DB when env is absent), `resolveProductActions`, `EditionCard` buy/quote, hero primary action, price formatting (server Intl, TR/EN), JSON-LD `offers`, sales legal page slug constant (footer/`/yasal` 404/sitemap), admin readiness `ui` field, decimal price entry (`price-minor-field`), i18n messages. `checkoutReady=false`: "`Satın al`" (Buy) disabled, no checkout link; P5 opens it.
- No schema/migration (copy DB `migrate:create` = "No schema changes detected"). In quote mode, product HTML is identical to pre-P3 (frozen old card + build comparison). Tests: `tests/unit/payments-p3{,-render,-db}.test`. Details in the P3 implementation record of `docs/plan-payments.md`.
- Verification: 78 files/1313 tests green; in quote mode DOM+JSON-LD identical to HEAD (21/21), payment mode correct on the DB copy, Lighthouse Perf 100/JS ~129.6 KB.
- Open: `pages.commerceLegal` schema proposal (awaiting approval), `legalReady` joins `open` in P7, checkout in P5.

## P2-S payment schema + store — 2026-11-16 (QA pending, no commit, not applied to live DB)

- Migration `20261116_141401_p2_payments_commerce`: up is only 3 CREATE TABLE (`orders`, `orders_items`, `payment_events`) + 21 indexes + 20 ADD COLUMN (`editions` 5, `site_settings` 13, `payload_locked_documents_rels` 2). Hand-written safe down: refuses if sales/lock rows exist; otherwise removes only what was added (no rebuild/DELETE). Copy DB: migrate + `content:import --dry-run` 0 errors, integrity ok.
- Single write: `quote-only|payments`, `quote|buy` (aliases removed). Price `editions.pricing.{taxMode,tryMinor,usdMinor,eurMinor}`; VAT `site-settings.commerce.vat.{try,usd,eur}` (entered as a percentage, stored as basis points). New fields are read by staff and written by admin; the commerce key cannot be written with an API key; content:import refuses (`custom.contentImport:false`).
- `orders`: read staff + owner customer; create/delete nobody; admin only invoice/notes/requiresReview. `payment-events`: read admin. Not in MCP.
- Store `src/lib/payments/store/**`: BEGIN IMMEDIATE (V5 queue), conditional `license_id IS NULL` and `status = from` writes, full rollback on conflict, side effects after commit + independent read verification. Tests `tests/unit/payments-{db,schema}.test.ts`; P2-S up added to the old migration tests.

## V5 P1 independent audit — 2026-11-10

- P1: concurrent finalization on the same transaction ID released the lock early; the finalization promise is now shared. A raw all-locale snapshot SHA-256 token replaced the timestamp (first virtual field, no DB column); same-ms/hour rollback tested.
- P1/P2: block/array ID-based merge; no write on Lexical/value/delete/order conflict. Flush base is updated, merge clears old undo; late response/locale, hidden tab 409, empty/null token and restore 409 fixed. Unversioned API/bulk and explicit restore are intentionally unconditional. Anonymous token is invisible; the copy is limited to schema content fields.
- Focused 4 files/36 tests passed; 30 writes + 30 reads: 0 errors, 1579 ms, max read 190 ms. Typecheck/lint clean; full suite 73 files/1186 tests: 1184 passed, 2 red (out-of-scope media fixture and an old migration 60 s timeout; the same migration passed 3/3 with a temporary 120 s limit). Branch acceptance: NO: build/browser E2E missing and the standard gate is red. The commit did not get created because of an `index.lock` sandbox block; it is in the working tree. The provided scratchpad DB was missing: build/E2E on port 3531 could not be run. Live DB/3100/main repo/schema preserved. Details in `docs/qa/v5-concurrency-audit.md`.

## V5 audit fixes (2026-11-09)

- QA P2 (Terra): fixed Escape on an empty EN fallback, language switch after a failed save, UTF-8 keepalive, and per-language undo history.
- P1 closed: virtual `editorVersion` + `beforeChange` 409 (same transaction), in-process SQLite transaction ordering (`src/lib/db-serial-transactions.ts`; libsql had SQLITE_BUSY on concurrent BEGIN and invisible writes), Merge/Copy/Reload in the editor. MCP/import pass without a version. Isolated e2e 20/20, 71 files/1163 tests (1 out-of-scope red), LH JS 129.62 KB. Details in the plan's "V5 P1 closure record".

## V5 — Visual editor (2026-11-09, `feat/visual-editor`)

- Implemented: default visual layout, hardened bridge (origin+source+strict schema, id+locale, allowlisted paths), inline plain-text scope, palette, drawer focus, drag/keyboard, hidden-block badges, undo/redo, flush + conflict, tour, TR/EN labels. All V4 gates green; e2e 17/17; LH Perf 100, JS 129.62 KB.
- Open: popup preview, some fields only in the form (tabs label, testimonial name/role, stats value, rich text), Lexical undo not verified, conflict polling 15 s, user 8-task trial, second-wave collections.

## content:import decision b audit (2026-11-08)

- P2: the seed layout to be preserved went through the relationship/Markdown conversion before being removed; an unused old reference could stop the import and dry-run with an error. `importer.ts` now removes the layout before the conversion; regressions that failed first passed after the fix.
- P3: the unconditional protection in the editor guide and the redirect from the editor to the old seed were corrected; the exception for a composition seed and publishing the draft composition through import were explained. Detailed scope is in the last item of `activeContext.md`.
- `pnpm typecheck`, `pnpm lint`, `git diff --check` passed. `pnpm test --maxWorkers=1`: **67 files / 1033 tests**; focused import/SQLite: **2 files / 58 tests**. DB writes only on temporary SQLite/uploads; live DB, dev 3100, `.next`, payments and commit not touched.

## V2 audit (2026-11-08)

- Fixed: bypass of the mandatory editions block by removing all bound blocks or by legacy restore, silent cleaning of raw hidden input, conflicting block IDs, and LCP animation regression for legacy extra blocks. Details/evidence and the 3200 shutdown blocker are at the top of `activeContext.md`.
- Gates: typecheck/lint/diff-check, 67 files / 1015 tests, copy DB `.next-prod` build and TR/EN 3200 smoke passed. Legacy/composition MISS = 24/24 queries; anonymous access, draft/ISR, REST/MCP, version restore, duplicate, import idempotence and migration up/down tests passed. Live DB/3100/`.next`/payments/commit preserved.

## V2 — Product page bound blocks (2026-11-08)

- 8 product section blocks (products only), compatibility/composition modes, mandatory `productEditions` (Request a Quote; validation + draft hook + render guarantee), productHero first block/h1/LCP, products autosave 2 s, admin TR/EN labels + block preview images, seed schema, editor guide §7.2a.
- Migration `20261108_130717_v2_product_bound_blocks` only CREATE TABLE/INDEX + ADD COLUMN; down removes only its own additions. Copy → backup (`softmarket-pre-v2.db`) → live; old data diff 0.
- typecheck/lint clean, `pnpm test --maxWorkers=1` 66 files / 1005 tests (new: product-composition, product-bound-db), `.next-prod` build, 3200 smoke (including 404), `<main>` HTML byte-identical for old products, LH mobile product Perf 100.

## V1 audit — 2026-11-08

- Fixed: hero draft/autosave validation bypass, first-content LCP protection, broken admin preset save, hover keyboard focus, and scroll-progress range/fallback; details at the top of `activeContext.md`. No CSS value injection found; legacy `appearance.animation` and stagger limits kept in regression. The import schema uses the same seven options for hero.
- Final fixed-source run: **`pnpm typecheck`, `pnpm lint`, `pnpm test --maxWorkers=1` (59 files / 737 tests), `NEXT_DIST_DIR=.next-prod PORT=3200 pnpm build` passed**. A SQLite copy from the read-only source and separate uploads were used for build/smoke. Migration up/down + `_v`/row preservation passed on isolated SQLite; migration file/schema not changed.
- 3200: `/tr`, `/en`, `/tr/urunler`, `/tr/urunler/akis-yonetimi/akis-merkezi`, `/admin` 200; `/tr/olmayan` 404. Hidden animation state in SSR 0; none of the 13 JS chunks loaded by the public HTML contain the admin preset component. `next start` must run through pnpm's `node_modules/.bin/next` shim (NODE_PATH/libsql resolution).
- Chromium could not start: real-browser no-JS/reduced-motion/keyboard/sticky image QA was not verified in this audit; the CSS contract and SSR checks passed. 3200 closed; 3100 open with the same PID 69553, live DB/`.next` preserved; no commit. `docs/plan-payments.md` stayed out of scope.

## V0 — Payload security upgrade (2026-11-08)

- `payload` + all `@payloadcms/*` **3.85.1 → 3.93.0**, fully pinned/aligned; Next **15.4.11**, React **19.2.6** kept. Minimum Node **24.22.1**; host **24.21.0** not changed; tests/build/migration were run with a temporary official **24.22.2** runtime.
- Migration `20261108_093334_v0_payload_393`: **2 auth columns + 309 localized parent indexes**; no destructive up; down removes only its own additions. First up/down/data-preservation on a copy; then the `scratchpad/softmarket-pre-v0.db{,-wal,-shm}` + `.snapshot.db` backup and live migrate. Copy/live: **680 tables, old data diff 0, integrity ok, FK 0**.
- Release notes for 3.86–3.93 (including patches) reviewed: block read/tip access, upload/SVG/XML/SSRF safety; API key hiding, new JWT authVersion (re-login for old sessions), localized draft, Lexical 0.50, Nodemailer 10, SQLite/MCP/admin/i18n/preview compatibility. Security defaults were not relaxed. TIFF `.tif`, active SVG rejection, draft-only relationship and JWT tests were updated.
- **typecheck/lint, 56 files/703 tests, generate:types/importmap, copy DB `.next-prod` build, 3200 smoke, isolated E2E 1/1 passed**. Fresh MCP **69 tools**, TR/EN create/update + identity/permission checks passed. Import map unchanged. An upstream mcp-handler SDK peer warning remains; the safe SDK was not downgraded. Preview 401 test uses a valid `?redirect=/tr`; a bare endpoint is 400 as before.
- **3200/3400 closed; 3100 PID 53048 and `.next` preserved; no commit.** pnpm install may break HMR: the admin must restart dev after Node >=24.22.1; no restart was done in this task. Detailed release/migration/test/file record: the V0 section at the end of `docs/plan-visual-editor.md`. **V0 completed; V1/V2/pilots not applied.**

- F11 performance fix round (2026-11-08): Radix mega menu/sheet → server markup + `lib/header-nav.ts` + `<dialog>`; ICU/next-intl removed from the client (no provider, `has-locale`); tailwind-merge server-only; Geist subsets (28 KB single preload + ext unicode-range + mono 20 KB). JS 192→129 KB, font 138.7→48.3 KB, image LCP 3.16→2.53 s (target 2.5; remaining is framework JS). Tests 54/696, header keyboard e2e 3/3. Details in `docs/perf/f11-acceptance.md`.

- F11 security/quality audit (2026-11-08): isolation, seed authority/password privacy, process cleanup and Lighthouse error/median fixes applied. Typecheck/lint/isolated build and `pnpm test --maxWorkers=1` (52 files, 643/643) passed; the default parallel run times out. Re-verification of the real E2E shutdown depends on the old test processes being closed outside the sandbox; details and PID/copy paths at the top of `activeContext.md`. Live DB/3100/.next/commit unchanged.

- 2026-11-07 F9 original media privacy: `Media.beforeOperation` → `src/lib/media-upload.ts`; on new/create and replacement/update uploads of JPEG/PNG/WebP/TIFF/HEIC/HEIF, the EXIF orientation is applied and EXIF/GPS/XMP/IPTC are removed; ICC may be kept. JPEG q90/mozjpeg, PNG/WebP lossless, TIFF LZW; HEIC requires HEVC support, a cleaning error is 400. SVG/GIF/video/PDF and existing files are not changed; regenerate preserves the original. 10 new tests on temporary SQLite/uploads (GPS JPEG, physical orientation/size, formats, tempFilePath, 400 and out-of-scope files); typecheck/lint and 48 files/603 tests passed. Risk note in `docs/perf/f9-media-pipeline.md` closed. No live DB/3100/commit action.

- F10 code part completed (2026-11-07): TR/EN label dictionary + walker, label scanner test (filesystem scan, EN leftover rule, block preview file existence), `content/templates/starter` (01-globals, 05-pages, 10-families-products; `--dry-run` 0 errors on live DB, real import + idempotence test on an isolated empty SQLite). Remaining: `docs/editor-guide.md` (separate agent), upgrading block preview wireframes to real screenshots (optional, F11), F10 QA (writer ≠ reviewer).

- F9 audit (2026-11-07): UUID-derived names, fail-closed access on old conflicting files, SVG sandbox CSP/nosniff; regenerate builds in stages while preserving the original. Full test 47 files/593 tests, typecheck/lint, build with the isolated DB; 3200 smoke 200/200/200/200/404, optimizer 400; 3200 closed, 3100 preserved. Original JPEG/PNG may contain EXIF/GPS; real disk-full and forced kill were not tested. Details in docs/perf/f9-media-pipeline.md.

- F9 visual pipeline implemented (2026-11-07): Media thumb400/card768/hero1280/wide1920 WebP q74, focal/crop; large targets are skipped with the Payload default (`withoutEnlargement:true` produces unnecessary original copies). Native shared MediaImage on all img consumers: srcset/sizes, container spacing, width/height, lazy, hero eager/high + responsive preload. `mediaRead` authorizes size filenames with the same media record + the existing license filter; optimizer off, private/no-store. Migration `20261107_192347_media_image_sizes` (24 ADD COLUMN + 4 indexes; down without rebuild) tested on a copy and applied live; backup `scratchpad/softmarket-pre-f9.db{,-wal,-shm,.snapshot.db}`, old data diff 0, integrity ok/FK 0. `pnpm media:regenerate` keeps identity/seedPath/TR-EN/permissions/original bytes; on the copy 3 → 0 regenerate. Real handler/SQLite anon/customer/staff + valid/cancelled license tests, 45 production HTTP file/role checks; with F8 staff+draft see protected srcset, while anon/customer/draft cookie alone see only public. Mobile textured fixture 390px/DPR1–3: 1.24/23.28/171.17 KB. Typecheck/lint, 47 files/591 tests, production build and /tr,/en,/tr/urunler,/admin 200; /tr/unknown 404. **LCP/CLS and browser currentSrc measurement not verified:** Chromium MachPort 1100, Lighthouse port and browser host blocked; no claim of no regression. Evidence/limits: `docs/perf/f9-media-pipeline.md`. Tests/users only in the DB copy, live media=0; 3200 closed (ECONNREFUSED); 3100 open/.next preserved, no commit.

- [x] 2026-11-07 F8 Live Preview + draft mode: staff-only `/api/preview` + `/api/exit-preview` (open-redirect allow-list, cross-site rejection, no secret token); draft reads only with draft mode + re-verified staff session (`readAs`); `admin.livePreview` on 6 collections (390/768/1440), `RefreshRouteOnSave` island, `pages` autosave 2 s, migration `20261107_190342_pages_autosave` (additive) on live DB. Draft responses are no-store/outside ISR; autosave does not refresh the cache. Playwright iframe ≤2 s (92 ms). 585 tests. Details: plan F8 note.
  - F9 note: when adding `MediaImage`/imageSizes, in draft mode staff `populate` can return protected media too; image URLs still reach only the staff member in the iframe (not written to ISR), but srcset generation must keep the `mediaOf`/visibility check.
  - F10 note: Live Preview should be added to the editor guide (autosave, breakpoints, no preview for template pages, only published records appear in related lists, "Exit preview"); admin breakpoint labels are TR/EN single strings ("Mobil / Mobile"). If autosave is requested for other drafted collections, each needs its own `ADD COLUMN autosave` migration.
  - Open note: CSP is Report-Only by default → `frame-ancestors` is not enforced in production (pre-existing). Draft leakage still does not happen (`payload-token` SameSite=Lax is not sent in a cross-site iframe), but for clickjacking protection `CSP_ENFORCE=true` or `X-Frame-Options: SAMEORIGIN` is recommended in production.

- F6 audit (2026-11-07): sitemap content queries cached for 1 hour with the `public-sitemap` tag, invalidated on publish/delete/global change; the configured home page's landing address is excluded from the sitemap. Migration `20261107_160000_globals_media_delete` (media FK trigger) applied and tested only on the DB copy; not applied to live.

- [x] 2026-11-07 F7 globals fully editable: link `route` type (locale-independent, `src/i18n/paths.ts` LINK_ROUTES/routePath), header custom mega/second CTA/announcement bar (dismissable island)/utility links, footer blurb/contact/social toggle/`{year}{siteName}` copyright, SiteSettings favicon + `brand.accent` (contrast rule `src/lib/brand.ts`) + `motion`. Migration `20261107_141523_globals_editable` (up only CREATE/ADD; the generated destructive `__new_` down was replaced by hand) on live DB; backup `scratchpad/softmarket-pre-f7.db*`. Seed converted to route, placeholders cleaned; import 2× 0 create/88 update. 42 files/516 tests, `.next-prod` build, 3200 Playwright 390/1440 + accent Local API temporary change (DB copy) verified, then reverted; 3200 closed, no commit.
- 2026-11-07 F5 audit: manual selection/limit, old logoWall anonymous re-read, automatic logo empty result/dedup and the import schema upper bound fixed. Typecheck/lint, 39 files/467 tests and `.next-prod` build with the SQLite copy passed. Query counts with different media IDs are fixed: family/product 4, solution/news/case 3, combined logo 6. On temporary SQLite, the migration up/down transaction test preserved all old table rows (including normal + `_v` translations); the migration file was not changed. Regressions for locale/draft, closed career, protected media, URL whitelist and 63-character enum limit passed. 3200: /tr, /en, /tr/urunler, /tr/urunler/akis-yonetimi/akis-merkezi, /admin 200; /tr/unknown 404. 3200 closed; 3100 PID 64423 preserved; no live migration/commit/.next deletion.
- [x] F5 dynamic (data-bound) blocks: 5 new blocks + logoWall sources, list source/limit/sorting/layout/show-all, fixed query + draft leak + import relationship tests (457 tests passed).

## Progress log

- 2026-11-07 F10 audit completed: overwriting of existing slugs/SKUs and globals by the starter is explicitly warned in AGENTS.md; the isolated test proves the real CLI transaction/rollback path and the overwrite risk. Admin label tests cover preservation of behavior settings, plugin access and MCP exclusions. Authorization, publishing, template, media privacy, license and translation guidance in the editor guide were adapted to the code. Typecheck/lint/613 tests/isolated `.next-prod` build passed; migrate:create produced no schema diff/file. No real person/company data or unsafe link found in the starter; no regression found in application access logic. Live DB/3100/.next/commit unchanged.

- 2026-11-07 F8 audit: preview and exit-preview CSRF checks strengthened; SAMEORIGIN frame header added. typecheck, lint, 585 tests, isolated build and the 3200 smoke/real draft-ISR test passed.

- [x] 2026-11-07 F6 page builder: home page as a CMS `pages` record (homePage → `home` → fallback), 9 system pages (`systemKey` + hero + movable `listing` block), landing `[locale]/[slug]` + reserved slugs, template privacy, family `layout`, sitemap/hreflang, migration `20261107_144850_page_builder_pages` (additive up, hand-written safe down, home delete trigger) on live DB; seed `05-pages.json` 2× (10 → 0 create). Revalidate root cause fix (`'/'` layout) + dynamic sitemap. 3200 visual equivalence 0% pixel difference; 536 tests. Details: plan F6 note + activeContext.

- Migration `20261107_120000_hero_video_delete` was deliberately applied to the live DB after a backup (commit `a45a9df`).

- 2026-11-07 F4 audit: migration down data loss, video FK delete error (a new forward migration applied to live later), video URL validation, public video/MIME/poster limits, no-JS tabs and testimonial alt fallback fixed. Typecheck/lint/438 tests/isolated build and 3200 HTTP smoke passed; temporary SQLite isolation, import repetition, protected URL/404 and richText XSS regressions verified. Chromium UI blocked by MachPort permission. 3200 closed; 3100 not touched during the audit. Details in activeContext.

- 2026-11-07 F4 static blocks: media/testimonial/tabs/spacer/divider + videoEmbed facade + hero mediaBackground/video; migration `blocks_static_set` (additive) on live DB; 420 tests, build, 3200 Playwright QA (CLS 0, iframe/video network checks, tabs keyboard) passed. Details: plan F4 note + activeContext.

- 2026-11-07 F3/F0 audit: fixed reserved anchor collision and information leak of URL/title source in the diagnostic log. Temporary DB migration up/down test, typecheck, lint, 399 tests, isolated build and 3200 HTTP smoke check passed; process closed.

- 2026-11-07 F3 block core completed: migration `20261107_110012_blocks_appearance` (only ADD COLUMN, 80 block tables, defaults keep the old look; copy DB + dry-run, then live; import 2× 0 create/88 update). `src/fields/block-settings.ts` (`blockSettings`, `BLOCK_DEFAULTS`, `resolveAppearance`, anchor validation), `components/blocks/{block-shell.tsx,registry.ts,types.ts}`, `lib/blocks/render-plan.ts` (single h1: `RenderBlocks firstHeroH1` only for CMS pages without h1 / F6; on pages with PageHero the hero is h2). Hero `default`=cinematic + split/centered/minimal; CTA `split`; featureGrid `style` + icon select (`lib/icon-names.ts`). Admin i18n TR default, block TR/EN labels + `admin.group` + `public/admin/blocks/*.webp` placeholders. `blockReferences` not used (rationale in the F3 plan). typecheck/lint/34 files 398 tests, `.next-prod` build; 3200 1440/390 image difference ≈0 (`scratchpad/f3/`). 3200 closed, 3100 untouched, no commit.

- F0 SQLite query measurement completed (2026-11-07): `src/lib/db-query-log.ts`, Node `instrumentation.ts` and a flag-enabled Payload adapter wrapper. With `SM_DB_QUERY_LOG=1`, libSQL statement count/time + ALS context per HTTP request; server render can read `getDbQueryStats()`. After streaming, `finish` logs are matched by `scripts/perf-isr.ts` via `SM_DB_QUERY_LOG_FILE` and the request ID. With the flag off, the adapter/client/HTTP emit is not wrapped. `.next-perf` build + 3300 production measurement: 146 routes/292 HTTP 200; 0/0 queries in 122 HIT/HIT pairs. Search 33/33, catalog 17/14 (first 3 PRAGMA), contact/downloads 16/16, portal login 9/9; concurrent isolation 33/9/14 verified. The first 10 routes are in `docs/perf/baseline.md`. typecheck/lint/32 files 376 tests/diff-check passed. 3300 closed; 3100 untouched; no commit.

- 2026-11-07 F1/F2/G cross-audit: unpublish invalidation after a draft, object-option cache keys, missing family counters, observer error/URL query cleanup, hero image opacity delay, long breadcrumb overflow and encoded mailto placeholders fixed. Real Payload/SQLite publish lifecycle regression added. Typecheck/lint/31 files 372 tests/`.next-prod` build passed. 3200 `pnpm start` smoke: 6 routes 200, unknown route 404, SSR pending=0, Mono preload=0. Process closed; no 3100/.next/commit action.

- 2026-11-07 F0 partial browserless measurement: bundle and 144 URL HTTP results in `docs/perf/baseline.md`; SQLite counter and timeout root cause still missing.

- Security QA (2026-11-07): the license e-mail is sent after the HTTP response, for independently verified durable recording; the key is not written to the console when SMTP is absent. Notifications are not scheduled for assignments outside a request context. The applied `20261107_092304_remove_sales_legal_fields` deletes three old relationship values; down does not restore them. Migration history not changed.

- UX audit fixes (13 items) completed: language switcher context, legal/footer links, header seed + CTA, button contrast (cn/twMerge root cause), product page single source, form edition filter + inline errors, localized 404 (catch-all), favicon set, mobile 44px, CSP nonce hydration warning, download filters. Typecheck/lint/345 tests/isolated build passed; verified on 3100 with Playwright. New test: `tests/unit/ux-audit.test.tsx`.

- 404/security QA: the media file existence check runs after the access filter; unauthorized and nonexistent files return 404. A temporary SQLite regression test was added. The isolated prod build passed; the document page timeout could not be reproduced and the exact root cause was not determined.

- Phase 8a security QA: MCP depth/file path and media size/symlink fixed; live HTTP access tests and 264 Vitest tests passed; the CLI now applies compensating cleanup for media files.

## Status summary
- Completed: Phase 0, Phase 1, Phase 2 (QA passed). Phase 3 written; Phase 4 completed. Online payment removed from scope.
- Phase 6 (customer portal) completed. Phase 7 completed (texts, README, legal drafts; lawyer review pending). Phase 8a completed; remaining: Phase 8b, Phase 9.
- No commit; the working tree is uncommitted.

## Team
- Repo skeleton, Next.js 15 + Payload CMS 3 + SQLite.
- Makefile and pnpm scripts (list: `techContext.md`).
- 21 custom collections (including support messages), 3 globals; access rules; 3 SQLite migrations.
- Design system: tokens, `<Section>` theme, Header/Footer/mega menu, `alternates` and `LanguageSwitcher`.
- Home page, product catalog/detail, solutions, corporate pages, block renderer (Phase 3; QA ongoing).
- Unit tests cover license assignment, access rules, schema/data preservation and frontend boundaries.

## Remaining
- **Phase 7:** completed (see the "Phase 7" section below).
- **Phase 8b:** real seed content (5-20 products as JSON), backup/deploy scripts; the import/MCP infrastructure was completed in Phase 8a.
- **Phase 9:** SEO, performance, accessibility (Lighthouse ≥ 90), e2e.

## Phase 4 — completed (2026-11-06)
- Support center, public downloads filtered by product/version/OS, documentation tree/sidebar/detail/heading list/previous-next, release notes and category/product FAQ with safe FAQPage.
- `/ara` ↔ `/en/search`: Payload search index, 2–120 characters, pagination; only current anonymous sources. Raw index access is also closed to draft/deleted records.
- Demo/quote/contact/general support forms: CMS definition, idempotent TR/EN ensure script, product+SKU validation; progressive enhancement and accessible error/focus/status management.
- Zod length limits, honeypot, 5 attempts/10 minutes/IP memory limit, origin, Turnstile server verification, mandatory KVKK. Public create of `form-submissions` is closed.
- Notification after saving; user input does not enter e-mail headers. An e-mail error does not break a successful save. Console when SMTP is absent.
- paths, messages, hreflang/alternates/breadcrumb/sitemap done. No schema change or new migration.
- The Payload 3.85 SQLite localized `count` mismatch in scoped slug validation was fixed with a bounded `find`; regression test added.

## Missing frontend routes
- None (portal added in Phase 6).

## Known issues / operational inputs
- Next 15.4.11: under the `(frontend)/[locale]` root layout, `notFound()` returns a `__next_error__` shell in SSR; the localized 404 is visible on the client from the RSC payload. The HTTP test checks status 404 + HTML/RSC content; `smoke.spec.ts` checks the visible `<main>` 404 in the browser.
- Tried without result: disabling globalNotFound, simplified layout, removing header/footer/error.tsx, passthrough app/layout + app/not-found, moving the OG file. To be revisited in the page builder phase.
- Live SMTP and Turnstile site/secret keys are required; no real external service test was done.
- The `.env` canonical URL is still `localhost:3100`; app HTTP verifications were done via `127.0.0.1:3100`. The current localePrefix is `always`: TR paths open with `/tr`, root TR paths redirect.
- Legal text approval and real content in Phases 7–8. No git commit.
- Phase 8a: content:import and MCP added; real content/deploy in Phase 8b.

## Decision evolution
- **2026-11-06: Hybrid sales → promotion + quote; licenses assigned by staff.** Online payment fully cancelled; customer portal and licensed downloads kept.
- **Local port:** `localhost:3000` belongs to another project, so the site runs on `127.0.0.1:3100`.
- **Migration:** DB push is off; every schema change is done with `pnpm migrate:create` + `pnpm migrate` (plain `payload migrate:create` fails).
- **Media:** the `protected` default is `true` (safe default); public images are set to `false` explicitly.
- **Customer ≠ panel user:** `customers.access.admin=false`; customer operations run from server code with `overrideAccess: true`.
- **License model:** an in-software activation API is outside v1; the model was designed to be ready for it.
- **Scope:** e-Invoice/e-Archive and subscription renewal are outside v1.
- **Team model:** `takim-lideri` skill; the Opus lead writes no code; the writer ≠ reviewer rule.

## SQLite migration (2026-11-06)
- SQLite WAL/FULL, busy timeout 5000; Payload transactions enabled, libSQL write transactions `BEGIN IMMEDIATE`.
- Migrations: `20261106_145404_initial_sqlite`, `20261106_150000_sqlite_integrity`.
- Single VPS: systemd, host Caddy, Litestream; persistent data in `data/`, `uploads/`. Local port 3100.
- Decision evolution: Postgres+Docker → SQLite+systemd (cost); no live data yet.
- Verification: 135 tests passed; typecheck and lint passed. Stopping the running dev process was blocked by the OS; the build and restart could not be verified.

## Payment removal (2026-11-06)
- New migration `20261106_151826_remove_online_sales` applied; old migration files kept.
- The SKU stayed for quotes; price/tax and purchasable fields, the order relationship and the invoice address were removed.
- The license notification e-mail was not added because it is optional; the existing console SMTP fallback was fixed.

## Latest verification (2026-11-06)
- Phase 4 security QA: fake IP headers, Origin and LIKE wildcards fixed; typecheck, lint and 139 tests passed; HTTP bad-input checks done.
- `pnpm generate:types`, `pnpm typecheck`, `pnpm lint` succeeded. `pnpm test`: 13 files, 138 tests passed.
- HTTP: 20 TR/EN public page requests 200; invalid queries and nonexistent dynamic resources 404; sitemap 200.
- With temporary content, TR/EN document list/detail, heading anchors, hreflang, search, filtered downloads/release notes/FAQ verified. Draft index and licensed download names hidden, licensed file 403, public file 200.
- Anonymous form-submissions POST 403; the native Server Action created exactly one record on a valid submission and showed success; the record was deleted afterwards. TR/EN form labels and two ensure runs keeping the same four identities verified.
- Temporary fixtures/files cleaned up; only the four authorized form definitions were permanently added. No build/dev restart/commit; Makefile unchanged.

## Phase 7 — completed (2026-11-06)
- i18n: tr/en key trees equal; terminology consolidated into a single dictionary (Request a Quote, Request a Demo, License, Support, My Account); purchase-remnant text removed; plural ICU patterns fixed. Key names and placeholders unchanged.
- Legal texts `content/legal/{tr,en}/`: kvkk-aydinlatma, gizlilik-politikasi, cerez-politikasi, kullanim-kosullari, eula. DRAFT; legal advisor review mandatory. A note was added that distance-sales/pre-information is not required (awaiting confirmation).
- README rewritten (PostgreSQL/Docker remnants removed; commands verified against Makefile and package.json).
- Points pending legal review: Cloudflare Web Analytics activity and data-processing location; Cloudflare transfer abroad; retention periods; backup and server log periods; liability limits; competent court; EULA vs. contract precedence; DPA need; VERBİS status.
- No build, commit or code change performed.

## Phase 6 — completed (2026-11-06)
- Paths: giris/kayit/sifremi-unuttum/sifre-sifirla/dogrula, lisanslar, indirmeler, talepler(/yeni,/[id]), profil (EN: login, register, forgot-password, reset-password, verify, licenses, downloads, tickets, new, profile).
- Verification: typecheck, lint, 170 tests (portal.test.ts added) passed. HTTP: anonymous redirect, customer 16 pages 200, another customer's ticket 404, staff/wrong token rejected, licensed file 200 only for the owner. Chromium: login/logout, show key, open request/reply, profile, registration/verification/reset; 1440 and 390 screenshots, overflow fixed. Temporary data deleted.
- Open: KVKK consent is only a required checkbox (not stored at registration; no schema field); other sessions are not ended on password change; live SMTP/Turnstile not tested (registration/forgot-password are off in production without Turnstile).
- 2026-11-06 Phase 6 security QA: KVKK/session holes, auth API/limit bypass, enumeration, direct unlicensed requests, transaction/redirect/mask/date/header endpoints fixed; `20261106_161413_portal_security_consent` applied; generate:types/typecheck/lint and 18 files/223 tests passed; HTTP IDOR/CSRF/token replay/limit/consent/no-store verified, fixtures deleted. Open: the dev REST authStrategies HMR registration waits for the next normal process start for the exp/alg tightening; the screenshot and live SMTP/Turnstile were not verified because of the sandbox; no build/restart/commit.

## Phase 8a — content tools (2026-11-06)
- JSON Schema/AJV + slug/SKU import, separate TR/EN writes, blocks, safe media paths, globals, docs.parent, product↔FAQ relationships; `--dry-run` and transaction rollback.
- The seed contains only 1 family + 1 product + 1 edition. Real DB first import 3 creates; second 0 creates/3 updates, identities #1/#1/#1; records left in place. Legal Markdown is imported with `--legal`; local drafts only in dry-run, real conversion/publishing verified in an isolated test DB.
- MCP 3.85.1, `/api/mcp`, 16 content collections + 3 globals. Admin users API key; licenses create/find/update open, delete closed. Customers/users/forms/submissions/tickets/messages/experimental tools closed.
- Migration `20261106_164616_phase8a_content_mcp` applied; earlier migrations unchanged. API keys are protected by admin field access; switching to the editor role revokes the key.
- Analytics decision: Cloudflare Web Analytics instead of Umami because Umami requires Postgres; cookieless, no analytics cookie banner needed. No beacon without a token; excluded for admin/portal; automatic SPA measurement off.
- Usage scan of product.from/bestFor is empty; removed from both dictionaries. TR prefix information corrected to `/tr/...`.
- The external source plan is read-only outside the sandbox; the current working copy is `docs/implementation-plan.md`.
- MCP fresh Payload handler tools/list 200, 69 tools; anonymous HTTP 401. Dev authStrategies HMR kept the old registration, so a valid key gives HTTP 401; a later normal process start is required; no restart done.

- Phase 8a media identity: `media.seedPath` unique; even when Payload changes the file name because of a conflict, a repeat import updates the same record/file. Migration `20261106_165449_phase8a_media_identity` applied.

## Phase 8a final verification
- `pnpm generate:types`, `pnpm typecheck`, `pnpm lint`, `pnpm test` passed: 21 files / 259 tests. `git diff --check` clean.
- Real second import and final repeats: 0 create/3 updates; family/product/edition #1, TR/EN titles and FK check clean. Temporary admin/MCP key deleted; users=0, pages=0; only the sample catalog remains in the DB.
- `--dry-run --legal`: 5 legal pages planned, nothing written to the DB. Legal Markdown/locale/block/idempotency and media conflict test passed in isolated SQLite. A faulty CLI relationship attempt exited with 1, and the transaction also rolled back the family record.
- No build, dev restart or commit. No live Cloudflare token; beacon limits verified in SSR tests. MCP dev HMR and the external read-only source plan limit recorded above.
- F7 security/quality audit (2026-11-07): `publicImage` accepts only media explicitly set to `protected: false` with an image MIME; the announcement hiding state is tied to the content identity. Route attack inputs and migration transaction rollback tests with normal + `_v` old link data expanded; typecheck/lint/516 tests, copy DB `.next-prod` build and 3200 HTTP smoke passed; 3200 closed, 3100 and live migration untouched. Browser hydration interaction not separately verified.

## Content import error fixes (2026-11-06)
- Dry-run skips docs/releases queries for new products using the planned reference table in write-free mode; NaN/undefined/invalid DB IDs fail with a clear error before reaching the query.
- Markdown→Lexical link/autolink URL allowlist (http/https/mailto/tel/site-internal relative), dangerous links converted to text, and raw HTML nodes dropped.
- The CLI transaction wrapper tracks new file names in Payload's beforeValidate stage; on error/rollback it deletes only new files and reports cleanup errors. Partial file writes, rollback errors, commit and isolated real SQLite/media regressions tested.
- `content/seed/01-globals.json`: non-localized company/contact values synced for TR/EN; schema.json not loosened.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` passed (23 files/293 tests). `pnpm content:import --dry-run`: 88 records to create/0 to update + 3 globals; no writes. No real local import/build/dev restart/commit.
- Seed applied (2026-11-06): root cause — docs EN slugs equaled the product slug (fixed in 30-support.json) + the 01-globals e-mail placeholders were invalid; `--dry-run` now performs a real write + ROLLBACK. Old ornek-aile/ornek-urun/EXAMPLE-STANDARD deleted. make seed: 88 created/0 updated; second run 0 created/88 updated; --legal 5 pages; HTTP TR/EN 200.

## Phase 9 — audit fixes and verification (2026-11-06)
- Critical: server cookie reading removed from the Header (everyone sees My Account); locale `force-dynamic` removed. Home/product-family and content details use 3600 s ISR; public collection/global hooks invalidate both locale layouts and the sitemap; the CLI/outside-Next context is safe.
- Critical: locale error/loading and provider-independent global-error with TR/EN design tokens. Preventing the loading's implicit server getTranslations call from making the whole tree dynamic was addressed with client translation.
- SEO: public origin check + production warning, local fallback 127.0.0.1:3100 instead of localhost; x-default kept. TR/EN next/og PNG and OG/Twitter fallback; search noindex/robots disallow and outside the sitemap; lastmod on all sitemap URLs; TechArticle JSON-LD.
- Performance/security: next/image + dimensions/sizes/lazy, priority only for hero uses; Payload media URLs unoptimized (permission can change on the same URL), the optimizer accepts only `/images/**`; `/api/media/file` optimizer requests return HTTP 400. Motion reveal changed to IntersectionObserver/CSS; reduced-motion and no-JS visibility kept; optimizePackageImports added.
- CSP Report-Only default; CSP_ENABLED/CSP_ENFORCE flags, nonce + JSON-LD/next/script on dynamic pages, separate relaxed admin policy, Turnstile/CF/video permissions, Permissions-Policy and COOP. Because nonce + ISR are not supported together in Next, the public ISR uses a static CSP; the nonce was not applied to the whole frontend, and the technical limit was reported to the user.
- A11y: select/label separated, product/SKU error messages linked with aria-describedby, skip target scroll margin, mobile menu focus trap/Escape/language switch tests written. Design and Makefile unchanged.
- Build `NEXT_DIST_DIR=.next-prod pnpm build` passed. `●` ISR: /tr,/en; urunler/[family]/[product] and family; cozumler/haberler/referanslar/kariyer/yasal details; documentation product/detail; support, company, references/careers/partner lists, search old redirect. `○`: robots; sitemap (1h). `ƒ`: query-filtered catalog/solution/news/support lists, search/forms, portal, OG, admin/API. Empty career/reference details can produce ISR on request for new public content.
- Production HTTP (temporary 3101, then closed): home HIT, s-maxage=3600; EN catalog/quote/portal/support 200; no-store; admin unsafe-eval only in its separate policy. `skipMiddlewareUrlNormalize=true` solved Next 15's numeric loopback → localhost EN rewrite loop. Dev 127.0.0.1:3100 not stopped.
- Final gates: `pnpm typecheck` and `pnpm lint` passed; `pnpm test` 25 files/310 tests passed. `pnpm test:e2e`: 3 HTTP passed; 8 browser tests failed before the app opened because of macOS MachPort permission. Chromium install succeeded in a tmp directory; UI/keyboard/Lighthouse waiting for an allowed host. E2E no longer runs the build; the `.next-prod` build is a separate step.
- No changes to the content import script/library, `.env` or local content data; no migration/commit. Open: production domain, browser/Lighthouse verification; enforce after CSP Report-Only observation. General SMTP/Turnstile/legal approval inputs are in the earlier sections.

## 2026-11-06 Phase 9 QA: root 404 and media no-store fixed; typecheck/lint/Vitest and 3 HTTP tests passed; Chromium blocked by MachPort; production cache/invalidation and protected media live verification pending.

## Multi-root-layout 404 fix (2026-11-07)
- `src/app/not-found.tsx` broke the production build and dev route compilation because it requires a root layout. The standalone document was moved to `global-not-found.tsx`; Next 15.4 `experimental.globalNotFound` enabled (experimental, the official option for multiple root layouts).
- The catch-all + notFound attempt gave a 200 with locale loading, and without loading an empty error document in curl HTML; the final solution has no catch-all, and the existing locale loading/not-found is kept. `src/app/[locale]/opengraph-image.tsx` is a layout-free metadata handler; its location was kept for the existing plain URL (moving it into the frontend group adds a hash suffix to the URL).
- Payload 3.85 static file check turned the access filter into 403 when no record exists. `mediaRead` now returns 404 only for the absence of the file record on static requests; the access filter for existing media is unchanged. Unit regressions cover the anonymous/customer/admin absence cases and the existing protected file filter.
- `pnpm typecheck`, `pnpm test` (27 files / 317 tests), `NEXT_DIST_DIR=.next-prod pnpm build` passed (lint included). On 3200 with curl: /tr/xyz, /en/xyz, /xyz → 404 + 404 inside main; /tr, /admin → 200; /api/media/file/none → 404; TR/EN OG → 200 PNG.
- Three HTTP E2E tests passed with a temporary Playwright config on 3200; 404/main expectations were extended and a media 404 added. The origin check uses full equality with the test baseURL origin instead of the fixed 3100. Browser smoke is blocked by Chromium MachPort Permission denied (1100) before the app opens; the visibility assertion is kept.
- The temporary production server was closed; the 3100 dev process, `.env`, DB/schema and commit were not touched.

- F2 + G (2026-11-07): animation system (data-anim + single MotionObserver, hero keyframe, tokens) and visual fixes applied. typecheck/lint/31 files 359 tests passed; production build on 3200 Playwright: hidden element count 0 with JS off/reduced-motion, 0 after scrolling normally, CLS 0.000 (8 pages/widths), client nav rescans. Mobile Lighthouse 100 (first run /tr TBT 274→13 ms), LCP ~1.05-1.2 s unchanged. 3200 closed, no commit.
- 2026-11-07 F7 audit: media protection/MIME checks closed by default, announcement hiding tied to the identity; route attack inputs and `_v` migration data added to regression tests. typecheck, lint, 516 tests, isolated build and 3200 HTTP smoke passed; no live DB migration.

- F11 (2026-11-07): visual QA round 2 (432 images, clean automated check), Lighthouse 3-run median (9 pages × mobile/desktop), INP proxy, DB query/ISR measurement, editor guide-admin UI alignment, 2 new e2e specs (one with an isolated DB copy). typecheck/lint/613 unit tests + 15 e2e (3100) + 1 isolated e2e passed. Performance acceptance red on 4 items (image LCP, SEO canonical, JS 192 KB, font 70 KB) → next phase. No commit.

- 2026-11-08 G2 (F11 new findings): draft legal pages (`TASLAK —`/`DRAFT —` or `[UPPERCASE]`) are noindex + outside the sitemap via `src/lib/legal-draft.ts` (no schema); product hero primary Request a Quote; PageHero rhythm; release notes grouped and collapsible by product; MediaCard slug-hash cover; footer bottom line; SEO plugin TR/EN field labels; lead form button lg. Details: docs/qa/visual-baseline.md.
- 2026-11-08 F11 diff audit: legal draft detection/sitemap made fail-closed and the header navigation, focus, and mobile scroll/close race fixed; typecheck/lint, 54 files 698 tests, isolated build and HTTP smoke passed. Header E2E could not run because of the Chromium MachPort sandbox; iOS not verified.
- 2026-11-08 V1 animation preset system: `motion` group + migration `blocks_motion` (ADD COLUMN only, live), CSS contract + LCP protection, admin Motion panel (preset cards), editor-guide 2.6a. Tests/build/Playwright/Lighthouse green; V2 (product-bound blocks) next.

## 2026-11-08 V2 product page bound blocks (commit and verification)
- V2: 8 product-bound blocks, Request a Quote mandatory, hero first; old layout byte-identical. Migration `20261108_130717_v2_product_bound_blocks` (ADD/CREATE only), backup scratchpad `softmarket-pre-v2.db`.
- QA fixes: restore/hidden/duplicate-id bypass closed, `.product-anchor` offset, ValidationError TR toast (`req.t`).
- Payment P1 core 16b565e (`src/lib/payments`, not connected). Next: V3a Puck pilot, V3b native canvas pilot (separate worktree, 3510/3520, no migration).

## 2026-11-08 V4 decision record
- V4 decision: native canvas won; the Puck pilot branch and worktree removed; reports under `docs/editor-pilot/`. Next: V5 (`feat/visual-editor`).

## 2026-11-16 V5 merged into main
- typecheck, lint, 73 files / 1188 unit tests (maxWorkers=1), prod build, `test:e2e` 19 + `test:e2e:isolated` 20 (including visual-editor) passed. The migration test (~45 s, independent of the serializer; same on main) has a 240 s timeout; the content-import media test generates its own fixture.

- P2-S audit: consistency of order line/net/VAT totals, payment-event commit verification and terminal status protection, fulfillment commit verification and migration-down protection when commerce data exists were added; isolated SQLite regressions added.

## P7 commerceLegal independent audit — 2026-11-16 (complete, no commit)

- Fixed: `legalReady` opening with an EN fallback/empty-hidden legal text, missing placeholder detection, concurrent draft type conflicts, leaked renamed legal URL, and importer symlink reads. Header/footer internal reference projection kept; TR/EN text consistency fixes made.
- The technical draft check does not verify lawyer approval (P3); the guide and plan state this. Details in the P7 audit record of `docs/plan-payments.md`.
- Live DB/3100/.next, P4 files, techContext and commit preserved. Migration unchanged; temporary SQLite up/down and NULL/UNIQUE/version tests exist. Gate result below.
- Final gates: `pnpm typecheck` and `pnpm lint` exit 0; `pnpm test --maxWorkers=1`: **84 files / 1397 tests, all passed (314.55 s)**. No broken P4-related tests. `git diff --check` clean. **P7 migration safe for live: YES; P7 scope committable: YES** (no commit made).

## G1 revert live migration (2026-11-18)

- Migration `20261118_142532_revert_globals_chrome_drafts` was applied to the live DB on 2026-11-18 at about 17:47 local time. The guard passed (no pending header/footer draft); the 22 `_header_v*`/`_footer_v*` tables, 2 status indexes and `_status` columns are gone.
- The planned pre-migration backup was skipped by a scripting error (a failed `rm` glob aborted the `&&` chain, so the migrate ran on the live DB directly). `integrity_check` and `foreign_key_check` passed afterwards. The reviewer's earlier copy-DB verification (on a `.backup` copy) passed.
- Restore point is the post-migration backup `data/backups/post-g1-revert-20261118-174806.db` (integrity ok). Older backups: `pre-l1-20261117-235428.db`, `pre-g1-20261117-171838.db`.
- Checks: typecheck, lint, 1803 unit tests, 19 e2e pass; /tr, /en, /admin 200; Header/Footer versions endpoints 404.

## L7a portal devices (2026-11-18, no commit)
- Added portal device list/release (`src/lib/licensing/portal-devices.ts`, `src/lib/portal/device-actions.ts`, detail page), TR/EN strings, `customerDeviceReleased` queue message. Tests: `portal-devices-db.test.ts` (8), `portal-device-action.test.ts` (8). Gates: typecheck and lint clean, full suite 112 files / 1819 tests passed. Browser check on a DB copy (port 3580): owner released a device, foreign license 404 both ways.
- The L7 audit added regressions for concurrent attempts, quota changes, atomic rollback, ownership transfers, license states, and SMTP loss. Bilingual legal drafts reflect the implemented lease limits, rule modes, and retention exceptions.

## 2026-11-19 L10 completed
- L10 deploy, audit fixes and QA fixes done; remaining: VPS acceptance only (DNS/proxy secret, Caddy/systemd validation, signer, SECRETS_KEY backup, Linux preflight, p95 < 250 ms). Optional L11.
