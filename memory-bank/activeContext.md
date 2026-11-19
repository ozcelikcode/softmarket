# Active Context

## VPS disk footprint

- `scripts/deploy.sh` builds in a disposable directory and installs production dependencies into the staged release before cutover. Temporary pnpm caches and the Webpack build cache stay out of the release. The web and timer units keep their current entry points.
- `pnpm backups:prune --dry-run` previews migration snapshot retention. See the disk budget and cleanup instructions in `docs/plan-hosting.md`.

## Payments P8 security audit (2026-11-19, done)

- Audit and fixes complete; Sonnet QA added iyzico callback limiter ordering (closed surface stays 404). Full suite 1891 tests, isolated e2e 30/30.
- Sandbox acceptance waits for user-supplied iyzico/Stripe keys (`docs/plan-payments.md` P8 record).

- Payload REST and GraphQL require panel cookie sessions for staff access to orders, the payment journal, and integrations. Owners still see their orders. Staff API keys cannot mutate staff or customer accounts, and order provider metadata is limited to staff sessions.
- Verified Stripe refunds and disputes for a linked order continue after the quote-mode checkout drain while capability and the adapter are enabled. Browser return sync uses two admissions per token and 60 per trusted address per minute, with separate bounded maps for each provider and fresh order-state checks before retrieval.
- Real-provider sandbox acceptance and multi-process SQLite performance are pending. See the P8 implementation note in `docs/plan-payments.md`.

## L10 deployment and audit (2026-11-19)

- Added the licensing Caddy host, explicit loopback app listener, read-only VPS preflight, and `docs/licensing/operations.md`.
- The L10 audit protects active limiter and denied-audit windows, keeps API-key license issuance independent of event insert failures, and fixes staff REST login and HTTPS preview origin checks. Licensing SMTP notices defer when the transport disappears. The Caddy runbook disables startup environment logging and the web unit keeps ISR writes off the read-only release.
- VPS acceptance is pending: installed Caddy and systemd validation, DNS/TLS and trusted-header smoke tests, Linux `/proc/self/fd` checks, and production HTTP p95 below 250 ms. Previous loopback p95 was 717.7 ms.

## L8 and L9 done (2026-11-18, uncommitted until the L8/L9 commit)
- L8 identity/webhook anomalies: coalesced login failure/lockout and success events, new-network admin alert, webhook rejections recorded after the response (responses byte-identical). Details: "L8 implementation record" in `docs/plan-licensing-security.md`.
- L9 client integration kit: `docs/licensing/client-integration.md`, `test-vectors.json` bound to L2 fixtures, TS and C# verifiers (C# not compiled yet), `pnpm licensing:sim`. Details: "L9 implementation record".
- C# compile and `pnpm licensing:sim` against a dotnet-capable host remain open.

## Header and footer editing rollback (2026-11-18)

- The owner cancelled the visual globals project. Header and footer use the standard Payload global form and save directly to the live row, with revalidation on every save. G2–G7 are cancelled.
- The owner also cancelled the English-first conversion. Turkish stays the default locale. New code is written in English.
- The release uses `20261118_142532_revert_globals_chrome_drafts` after the existing G1 and licensing migrations. Resolve any pending drafts in G1 before the release and back up published version history before migrating.

## Licensing L6b admin actions (security center)

- §5.4 endpoints (POST, admin panel session + same origin + JSON, 2 KiB): `/api/licenses/:id/{suspend,revoke,restore,reactivate}`, `/api/license-activations/:id/deactivate`, `/api/security-events/:id/{acknowledge,resolve,false-positive,block}`, `/api/security-blocks/add`, `/api/security-blocks/:id/lift`, `/api/globals/licensing-settings/rotate-signing-key`. Core `src/lib/licensing/admin/actions.ts`, HTTP `endpoints.ts`.
- One serial BEGIN IMMEDIATE transaction per action: requestId receipt (`security-audit.nonce`, retry = `replayed`), preconditions re-read (`expected` status/changedAt -> 409 `stale`), exactly one status-log row (L1 hooks, source admin) and exactly one audit row. Revoke needs reason + last 6 chars of the public id and revokes active devices; restore only for rule (L5 core) or admin manual suspensions, `reactivate` for the rest; revoked is terminal.
- Manual suspend/restore customer e-mails via the L5 queue; block add/lift invalidates the API blocks cache; self-block needs `confirmSelf`; rotation reuses `provisionSigningKeyTx`, returns kid only, raises a high event. Panel saves of licensing settings write a `settings.update` audit row.
- L6b follow-ups: `licenses.status` is locked for all user-facing updates (field access `nobodyField`, read-only with TR+EN hint; only action endpoints, payment code and the rule engine change it, one log row each; L1 tests moved to server-side transitions), and refused admin actions of identified callers write coalesced `security-audit` `denied` rows (`src/lib/licensing/admin/denied-audit.ts`: reason code, `count=n http=s` note, IP prefix only, one row per key per 10 min; anonymous 401s unaudited; no schema change, no security event).
- UI: license sidebar "Lisans işlemleri" (License actions) (status, devices, history, actions), action columns + "Add block" in `/admin/guvenlik`, rotate button in the signing keys tab; admin panel session only. Record: "L6b implementation record" in `docs/plan-licensing-security.md`.
- L6b security/quality audit fixed idempotent replay abuse across differing payloads/actions/targets and cross-admin `requestId` collisions (`security-audit.nonce` bound to actor + request digest, 409 `idempotency_conflict`), CIDR host-bit leakage and duplicate subnets in `canonicalCidr`, the `blocks-cache` in-flight `invalidate()` race, empty `Authorization` header / zero-or-leading-zero `:id` / non-canonical `Origin` edge cases in `endpoints.ts`, short `publicId` handling in `revokeConfirmation`, and first-item truncation in `settings-audit.ts`.
- Open: direct panel edit of `licenses.status` is still allowed (logged); no `denied` audit rows; L7 portal/legal and L8 next.

## Licensing L5 rules engine, sweep and notification queue

- Pure rules in `src/lib/licensing/rules/` (ipSpread, geoSpread, impossibleTravel, activationBurst, activationChurn, cloneSuspected) and a pure decision step. `pnpm licensing:sweep [--dry-run] [--retention]` with `deploy/licensing-sweep.{service,timer}` every 5 minutes.
- Rules never revoke. Automatic suspension only in `suspend` mode after a valid elapsed `rules.observeUntil`, for active unsuppressed non-expired licenses, with the circuit breaker closed (`maxAutoSuspendsPerHour`, N+1th trips a critical event, open 24 h or until triaged; same-hour re-trip re-opens triaged breaker and re-arms alert). The L1 hook re-checks and logs the transition (source `rule`). Each hit is one BEGIN IMMEDIATE transaction; concurrent sweeps are idempotent.
- `restoreRuleSuspension` is the core for the L6b endpoint (409 unless the last transition is that rule suspension); suppression is derived from the restore row or false-positive event.
- Durable e-mail queue on `security-events.notify_*` + `detail` markers: batched PII-free admin alerts, daily digest, customer suspended/re-enabled e-mails in TR/EN. Retention cleanup nightly (04:00 Europe/Istanbul) in 1,000-row batches, preserving open high/critical events, active suppressions, block-linked events, recently lifted blocks, newer logs/activations, and leap-day boundaries. No schema change or migration.
- Record: "L5 implementation record" in `docs/plan-licensing-security.md`.
- L5 security/quality audit fixed same-hour circuit breaker re-trip bypass, retention deletion of open high/critical events / active suppressions / block-linked events / recently lifted blocks / newer status-log & activation rows / leap-day clamping, expired-license auto-suspension and revoked-license expiry events, invalid `minSeverityImmediate` fallback, `CHANGE_` contact-email filtering, blank customer e-mail skipping, `impossibleTravel` equal-timestamp tie-breaking, same-ms rule `dedupe_key` collision, `restore` malformed `detail` handling, unbounded retention settings, and batched/guarded alert marker writes.

## Licensing L4 updates and downloads

- Signed update discovery and link issuance share L3 authentication, durable nonce batching and rate limits. Unsigned file GET and HEAD recheck entitlement against current SQLite records and serve only eligible original uploads.
- Download tokens last five minutes and allow five GETs per token in the issuing process. Descriptor-based path checks reject symlinks and hard links. Streaming supports one byte range and aggregates download events by activation and trusted IP prefix.
- Client behavior is documented in `docs/licensing/client-api.md`. The L4 plan record tracks verification, including the open HTTP check on Linux.

## Licensing L6a security center (read-only)

- Admin custom view `/admin/guvenlik` with tabs Overview, Events, Blocks, Status transitions; counters (open high events, active blocks, suspended licenses, recent activations), filters in the URL, 50/25 rows per page, links to the Payload documents. Nav link with an open-high badge for admins only. Files in `src/admin/security/`, labels in `src/lib/security-center-labels.ts`, styles `.sc-*` in `src/app/(payload)/custom.scss`.
- Access: server-side admin cookie-session check inside the view (editor redirected to `/admin`, anonymous to login) and again in every loader; reads use the Local API with the admin user and `overrideAccess: false`, always with `select`. No keys, customer e-mail, device material or full hashes are shown; `detail` is redacted. No schema, migration, dependency or client JS.
- A custom view under a new key needs its own `DefaultTemplate` wrapper (Payload adds none). Actions (suspend, revoke, block, triage, key rotation) and the rules engine stay for L6b/L5.
- Gates: typecheck, lint, full Vitest 104 files / 1,711 tests (before the final template wrapper; the affected files re-run green). Browser check on an isolated copy (port 3550): anonymous, editor and admin sessions, light and dark, filter submit, mobile width. Record: "L6a implementation record" in `docs/plan-licensing-security.md`.

## Licensing L3 client API

- Signed device activation, refresh and deactivation are implemented under `/api/v1/licensing`. The L2 public key diagnostic shares the prefix and global rate limits. Clients pin the issuer and signing keys, use fresh nonces and hold a verified lease for up to 14 days by default.
- The existing SQLite writer queue protects device seats and durable nonce claims. Waiting validations share a commit with per-request savepoints. Last-seen and event aggregation have a separate bounded flush path.
- Refund and dispute append payment-sourced status history atomically. Refund revokes active devices and dispute prevents lease refresh. The panel-admin license detail lookup uses a virtual field because Payload 3.93 cannot build GraphQL for a native join to a GraphQL-disabled collection.
- Details and remaining deployment verification are in the L3 record in `docs/plan-licensing-security.md` and `docs/licensing/load-report.md`.

## Licensing L2 crypto and key lifecycle

- Audit fixes bind offline leases to the enrolled license and activation, restrict issuance by retired keys, reject weak public keys and ambiguous metadata, and protect vault rotation against a wrong master. The request verifier can pass the raw decimal timestamp to the canonical builder.

- Node Ed25519 lease JWS and raw-body signing strings live in `src/lib/licensing/crypto/`. HKDF/HMAC domains cover fingerprints, monthly IP hashes and downloads. IPv4 /24 and IPv6 /48 prefixes are the only address fragments retained.
- `pnpm licensing:keygen` writes the encrypted key and public metadata atomically. `--rotate` keeps the old public key eligible for 90 days. `--register-env` registers the public half of the configured environment override. `GET /api/v1/licensing/keys` reads public metadata only and returns 503 when disabled or uninitialized.
- Panel admins can save non-secret licensing settings in a same-origin session. Signing metadata remains read-only in the panel. See the L2 implementation record in `docs/plan-licensing-security.md`.

## Licensing L1 schema (`licensing_core`) — 2026-11-17 (independent audit, no commit, live DB not migrated)

- New collections `license-activations`, `license-status-log`, `security-events`, `security-blocks`, `security-audit` (admin panel session read only, nobody writes through any API, no GraphQL, not in MCP) and global `licensing-settings` (panel admin read, server-only write). Rule suspensions require `mode=suspend` and a valid elapsed `observeUntil`. Enum source `src/lib/licensing/constants.ts`.
- `licenses`: `publicId`, `maxDevices`, server-stamped `statusReason/statusSource/statusChangedAt`; API key (MCP) cannot set/change `status`; every Payload status change logs one row in the same transaction (`src/lib/licensing/transitions.ts`); delete refused (409) with history. `products.licensing.{enabled,code}` (code unique, immutable, panel admin only, not in import).
- Migration `20261117_200700_licensing_core`: additive up (9 tables, 2 hand-written partial unique indexes, 9 ADD COLUMN and a collision-checked `public_id` backfill), guarded down without rebuild. Copy DB: 723 tables row-equal, integrity/FK ok, import dry-run ok, down+up identical schema.
- Audit fixes cover panel authentication, lock isolation, projected and bulk license transitions, draft code validation and uniqueness. Raw-SQL refund/dispute history and summary updates remain L3 work.
- Gates: Typecheck, lint and `git diff --check` pass. Focused Vitest passed 58 tests in 5 files. Full Vitest passed 1,599 tests in 97 files. Partial-chain migration tests (page-builder, p7, blocks-static, block-motion, blocks-appearance, integrations) now also apply `licensing_core`.

## Licensing API + security center + hosting plan — 2026-11-17 (plan only, no code/schema, no commit)

- `docs/plan-licensing-security.md`: program ↔ site license API `/api/v1/licensing/*` (same process, suggested `lisans.<domain>` subdomain), device requests signed with an Ed25519 key + server-signed lease JWS (offline tolerance 14 days) + response signature/nonce, seat = active device, graduated rule engine (observe → notify → automatic suspension; revocation only by admin), `/admin/guvenlik` security center, KVKK minimization. New collections: `license-activations`, `security-events`, `security-blocks`, `license-status-log`, `security-audit`; global `licensing-settings`.
- Phases L0 spike → L1 single schema phase (`licensing_core`) → L2 crypto → L3 API → L4 ∥ L5 → L6 center → L7 ∥ L8 ∥ L9 → L10 QA (+ optional L11). 24–30 days. 6 open questions, awaiting approval.
- `docs/plan-hosting.md`: a subdomain is used; shared (Passenger) hosting is conditional and not recommended for licensing/payments (single process, build, no Litestream); recommendation is to stay on the VPS.

## Integration security audit — 2026-11-17

- Secret writes inside a transaction; the last four characters of short secrets are hidden. An unreadable SMTP password makes sending fail. Missing company details close the sales legal gate; the legal summary covers visible line/paragraph endings. Migration down preserves the port/TLS settings. Typecheck/lint clean; full test 91 files/1531 tests; live DB and 3100 preserved.

## Integration settings — 2026-11-17 (QA pending, no commit, not applied to live)

- New unversioned `integrations` global (admin; no MCP): iyzico/Stripe test+live keys, environment (live needs extra confirmation), SMTP. Secrets AES-256-GCM, key `SOFTMARKET_SECRETS_KEY` (if absent, saving is rejected; if lost, secrets cannot be read). Write-only endpoint `POST /api/globals/integrations/secret`, test e-mail `/test-email`. If set in env, env wins.
- E-mail `softmarketEmailAdapter` reads the env → panel setting on every send. Legal company placeholders are filled at render time; `pages.legalReview` binds lawyer approval to the text, and `legalReady` requires approval. `site-settings.company.etbisNo` added.
- Migration `20261117_092957_integrations_settings` (CREATE TABLE + 7 ADD COLUMN, guarded down); verified on a copy. Tests 91/1527, build OK. Details in `docs/plan-payments.md` "Entegrasyon ayarları kaydı" (Integration settings record).

## P6 security audit — 2026-11-17 (no commit)

- An uncertain refund lock is not opened by time; no repeat refund is allowed for a delayed provider result. Stripe/iyzico server and uncertain responses are not counted as explicit rejections; an iyzico cancellation record is verified with success/amount/currency.
- A Stripe refund/dispute notice returns 500 when the order ID is not yet linked, or when the refund notice is not yet verified at the provider, so it is redelivered. Regressions in `payments-p6*.test.ts`.
- Typecheck/lint clean with the latest code; full test 89 files/1492 tests passed.
- Refund e-mail is delivered at least once; a repeat is possible if the outage happens between SMTP and the marker write. Exactly-once delivery was not achieved. The isolated E2E script was not run in this audit because it terminates the process group; a 404/sitemap test was added at the end.

## P6 admin operations — 2026-11-17 (QA pending, no commit, no schema)

- Order side panel "`Sipariş işlemleri`" (Order actions): `İade et` (Refund) / `İptal et` (Cancel) / `Bildirimi yeniden gönder` (Resend notifications) → `POST /api/orders/:id/{refund,cancel,resend-notifications}` (admin panel session only + same origin; anonymous 401, editor/customer/API key/MCP 403). Refund: first `refundStatus()`, one lock per order (`payment-events` `admin-refund`), single refund, in one transaction `refunded` + license `revoked`; on uncertainty no blind retry (`requiresReview`, reconcile only reads). Refund e-mail via `notify.ts` type `refund` (marker `refund-notice` row). Stripe dispute → `suspended`; there is no dispute notification for iyzico. Operations: `docs/payments/operations.md`.
- Root cause of the `/yasal` static→dynamic 500: in a capability build, routes without a path (empty `generateStaticParams`) remained ISR fallback, and the first runtime render with `noStore` gave 500. Fix: layout `commerceRenderBoundary()` + `contentStaticParams` catch-all path (`__dynamic__`); in the E2E build `dynamicRoutes` is 0. Tests 89/1488 (+1), e2e 29/29. Details in the P6 record of `docs/plan-payments.md`.

## P5 checkout UI + portal orders — 2026-11-16 (QA pending, no commit, no schema)

- P5 QA: in a normal production build, the loopback payment provider cannot be enabled by environment variable; a separate `SOFTMARKET_E2E_BUILD=1` build and an isolated DB are required. The E2E build must not be deployed. The contract copy that contains invoice data was hidden from the editor; the recipient VKN is masked in display. CLI processes with an ambiguous environment also reject the loopback provider. Last QA: typecheck/lint clean, 87 files/1462 tests passed; isolated build succeeded; browser E2E was not run because of the PID restriction.
- `/hesap/satin-al/[sku]` (EN `checkout`), `/hesap/siparisler[/no]` (EN `orders`), `startCheckoutAction` + `createCheckoutOrder` (price/VAT computed on the server, form token idempotency, contract copy SHA), CSP form-action only on the checkout path, `CHECKOUT_READY=true` (in the default setup `open` is off; quote mode HTML is identical to HEAD). Callback 303 → relative `/{locale}/hesap/siparisler?donus=1` → the logged-in customer's latest order.
- P3 cache finding fixed: while the capability is on, `getCommerceState` makes every render dynamic; a build environment needs `PAYMENTS_ENABLED=true` (otherwise payments fall back to closed). Isolated e2e with the fake iyzico (`scripts/e2e-fake-iyzico.ts`, port 3500): 28/28. Details in the P5 record of `docs/plan-payments.md`.

## P4 notification audit — 2026-11-16 (no commit)

- Reconcile does not skip ready orders because of a batch full of undeliverable/locked notifications; a new review and license assignment refresh the notification retry budget. The notification migration down refuses if delivery status exists. Isolated SQLite regressions added; the live DB and the 3100 process were not touched. Open P2: reconcile pending/paid queries use a fixed first page; if it fills with persistently failing records, later orders may wait. Current gates: typecheck/lint passed, full test 85 files / 1407 tests passed; committable: no (open P2).

## P4 notification durability — 2026-11-16 (no commit)

- Closed (Terra P2): `orders.notifications` + `src/lib/payments/notify.ts` (lease + conditional marker, reconcile retry ≤5 attempts). The order license e-mail is sent from the queue instead of the hook (it also goes out in the CLI); manual assignment hook behavior is the same. Migration `20261116_175713_p4_order_notifications` (7 ADD COLUMN), verified on a copy, not applied to live.

## P4 independent audit — 2026-11-16 (no commit)

- The callback redirects to the account page without carrying an order number; a closed adapter returns 404 before Payload opens. Reconcile does not count unverified provider errors as cancellation proof; review and changed reference are preserved on conditional cancellation.
- Open: the license hook cannot send the key e-mail when the CLI has no `after()` context; there is no durable delivery guarantee for the e-mail after commit without schema. Must be resolved before checkout opens; details in the P4 record of `docs/plan-payments.md`.

## P3 independent audit — 2026-11-16 (no commit)

- P1 closed: open payment HTML/RSC was still returning HIT from ISR while the env was off (reproduced in production). Open payment surfaces use `unstable_noStore`, quote mode uses ISR; Next bailout is outside the content/DB catch. The ISR HIT target for payment mode was removed for security.
- P2: same-origin absolute/normalized legal URL filter, reset after an invalid price entry, readiness price/VAT/provider consistency, and the active provider's test/live/MIXED badge were fixed. Pure/SQLite and real React DOM regressions were added.
- Production render 6/6: open price; DB quote/env off shows no price, sales legal 404. Anonymous REST/GraphQL and draft/staff boundaries verified. P3 limit: if a slug is renamed, the sales type is not recognized (`commerceLegal` in a later phase). Details in the P3 audit record of `docs/plan-payments.md`.
- Final gates: typecheck/lint 0 errors, full test 80 files/1339 tests (296 s), both open and quote builds with the latest code, production render 9/9, diff-check clean. Build/scratchpad deleted, tsconfig restored. Live DB, 3100, `.next`, techContext preserved; P3 committable: YES.

## P3 mode gate and visibility — 2026-11-16 (QA pending, no commit, no schema, no checkout)

- `getCommerceState` (env + site-settings.commerce + provider/VAT; fail-closed, does not touch the DB when env is absent), `resolveProductActions`, `EditionCard` buy/quote, hero primary action, price formatting (server Intl, TR/EN), JSON-LD `offers`, sales legal page slug constant (footer/`/yasal` 404/sitemap), admin readiness `ui` field, decimal price entry (`price-minor-field`), i18n messages. `checkoutReady=false`: "Buy" disabled, no checkout link; P5 opens it.
- No schema/migration (copy DB `migrate:create` = "No schema changes detected"). In quote mode, product HTML is identical to pre-P3 (frozen old card + build comparison). Tests: `tests/unit/payments-p3{,-render,-db}.test`. Details in the P3 implementation record of `docs/plan-payments.md`.
- Open: `pages.commerceLegal` schema proposal (awaiting approval), `legalReady` joins `open` in P7, checkout in P5.

## P2-S payment schema + store — 2026-11-16 (QA pending, no commit, not applied to live DB)

- Migration `20261116_141401_p2_payments_commerce`: up is only 3 CREATE TABLE (`orders`, `orders_items`, `payment_events`) + 21 indexes + 20 ADD COLUMN (`editions` 5, `site_settings` 13, `payload_locked_documents_rels` 2). Hand-written safe down: refuses if sales/lock rows exist; otherwise removes only what was added (no rebuild/DELETE). Copy DB: migrate + `content:import --dry-run` 0 errors, integrity ok.
- Single write: `quote-only|payments`, `quote|buy` (aliases removed). Price `editions.pricing.{taxMode,tryMinor,usdMinor,eurMinor}`; VAT `site-settings.commerce.vat.{try,usd,eur}` (entered as a percentage, stored as basis points). New fields are read by staff and written by admin; the commerce key cannot be written with an API key; content:import refuses (`custom.contentImport:false`).
- `orders`: read staff + owner customer; create/delete nobody; admin only invoice/notes/requiresReview. `payment-events`: read admin. Not in MCP.
- Store `src/lib/payments/store/**`: BEGIN IMMEDIATE (V5 queue), conditional `license_id IS NULL` and `status = from` writes, full rollback on conflict, side effects after commit + independent read verification. Tests `tests/unit/payments-{db,schema}.test.ts`; P2-S up added to the old migration tests.

## V5 P1 independent audit — 2026-11-10

- P1: concurrent finalization on the same transaction ID released the lock early; the finalization promise was shared. A raw all-locale snapshot SHA-256 token replaced the timestamp (first virtual field, no DB column); same-ms/hour rollback tested.
- P1/P2: block/array ID-based merge; no write on Lexical/value/delete/order conflict. Flush base is updated, merge clears old undo; late response/locale, hidden tab 409, empty/null token and restore 409 fixed. Unversioned API/bulk and explicit restore are intentionally unconditional. Anonymous token is invisible; the copy is limited to schema content fields.
- Focused 4 files/36 tests passed; 30 writes + 30 reads: 0 errors, 1579 ms, max read 190 ms. Typecheck/lint clean; full suite 73 files/1186 tests: 1184 passed, 2 red (out-of-scope media fixture and an old migration 60 s timeout; the same migration passed 3/3 with a temporary 120 s limit). Branch acceptance: NO: build/browser E2E missing and the standard gate is red. The commit failed to create because of an `index.lock` sandbox block; it is in the working tree. The provided scratchpad DB was missing: build/E2E on port 3531 could not be run. Live DB/3100/main repo/schema preserved. Details in `docs/qa/v5-concurrency-audit.md`.

## V5 audit fixes (2026-11-09)

- QA P2 (Terra): fixed Escape on an empty EN fallback, language switch after a failed save, UTF-8 keepalive, and per-language undo history.
- P1 closed: virtual `editorVersion` + `beforeChange` 409 (same transaction), in-process SQLite transaction ordering (`src/lib/db-serial-transactions.ts`; libsql had SQLITE_BUSY on concurrent BEGIN and invisible writes), Merge/Copy/Reload in the editor. MCP/import pass without a version. Isolated e2e 20/20, 71 files/1163 tests (1 out-of-scope red), LH JS 129.62 KB. Details in the plan's "V5 P1 closure record".

## V5 — Visual editor (Payload-native canvas), branch `feat/visual-editor` (2026-11-09)

- Product/page documents open directly in the visual editor (`openByDefault` + `beforeDocumentControls` host, narrow form `custom.scss`); the classic form per visit. Code in `src/editor/canvas/**` (fields, protocol zod/mini v2, rules, history, bridge, admin/{host,reveal,sync,palette,tour}, plugin); markers only with `isEditingRender()`.
- All plain-text fields are inline (17 blocks + product title/tagline/summary/features + system hero); hidden blocks are shown faded with a badge; palette with images; MutationObserver reveal; undo/redo; keepalive flush; `updatedAt` conflict warning; a 4-step tour; the compatibility product is materialized automatically on the first structural operation.
- Verification: typecheck/lint, 70 files/1154 tests (1 red pre-existing: legal md not in git), `.next-v5` build, isolated e2e 17/17, LH mobile Perf 100 / JS 129.62 KB (main 129.31) / CLS 0, MCP find + import dry-run clean. Details in the V5 record of `docs/plan-visual-editor.md`.
- Production server on 3530 open (DB copy `scratchpad/softmarket-v5.db`, admin `v5-admin@example.test`, password `scratchpad/v5-cred.env`). No push; merge to main after user QA.

## V2 security/quality audit (2026-11-08)

- Closed the hole where removing all bound blocks from a composition returned to compatibility mode: the mandatory editions block is preserved against the previous layout comparison in EN/draft/autosave/where bulk update/old version restore/import. Raw input `beforeValidate`, final `beforeChange`; `hidden: true|"true"|1|"1"` and conflicting block IDs → 400. Partial ID updates and Duplicate work.
- The render-plan boundary for extra CMS blocks in the old layout was kept; the LCP-safe animation of the first extra block is the same as before V2. Regressions: `product-bound-db`, `product-composition`, new `product-render`, product draft/related list/ISR tests in `live-preview-db`.
- Typecheck/lint/diff-check clean; `pnpm test --maxWorkers=1`: 67 files / 1015 tests. A `.next-prod` build with a DB copy and a smoke test on 3200 passed (TR/EN home + product 200, missing product 404, single h1, SKU quote links). MISS query for legacy and 8-bound-block TR/EN products: the same, 24. Migration up/down/old-row preservation, import idempotence, REST/MCP retries passed; no anonymous draft/licensed download/unpublished document leak seen.
- No live DB/3100/`.next`/payments/commit action. Evidence directory `/private/tmp/softmarket-v2-audit-dlkms1ma`. **3200 PID 98175 is waiting to close:** the sandbox rejected SIGTERM, and the process stayed after the terminal was cut; only a request to close this PID was sent to the user. Visual/pixel equivalence in the browser was not measured in this audit.

## V2 — Product page bound blocks (2026-11-08)

- `products.layout` = `productBlocks` (`layoutBlocks` + `src/blocks/product-bound.ts`): productHero, productNav, productOverview, productFeatures, productSpecs (`showRequirements`), productEditions, productDownloads, productDocs. Content is not copied; it is read from product/edition/download/doc records (`slots.product`, `src/components/blocks/product/product-blocks.tsx`).
- `src/lib/blocks/product-composition.ts`: with no bound blocks, compatibility mode (pre-V2 order + old filter, virtual `virtual:*` blocks; HTML identical, 14 old pages verified). With bound blocks, the saved order is used.
- **Request a Quote is mandatory:** `productEditions` is movable and cannot be deleted, hidden (no hidden column), or duplicated. Layout `validate` + field `beforeChange` hook returns 400 for draft/autosave/REST/MCP/import; the renderer adds it back if missing. `productHero` is the first block, cannot be hidden; if absent, a default entry is drawn; it is in `LCP_BLOCK_TYPES`.
- Products autosave 2 s. Migration `20261108_130717_v2_product_bound_blocks` (16 CREATE TABLE + 49 indexes + `_products_v.autosave`); applied to live, backup `scratchpad/softmarket-pre-v2.db`. The dev 3100 was not restarted; product pages returned 200 after migrate and matched the old output.
- Verification: typecheck/lint clean, `pnpm test --maxWorkers=1` 66 files / 1005 tests (new: product-composition, product-bound-db); prod build 118 pages, 3200 smoke, LH mobile product Perf 100 / LCP 1.21 s / CLS 0. Details in the V2 record of `docs/plan-visual-editor.md`. No commit.

## V1 security/quality audit (2026-11-08)

- Hero preset validation was skipped on the Payload draft/autosave path: the `Hero.ts` preset `beforeValidate` hook enforces the seven-option limit, including REST/MCP/Local API. The import schema is limited by the same list; the live schema/migration was not changed.
- `render-plan.ts`: hidden/decorative/empty/no-result starting blocks do not consume LCP protection. Candidates stay protected until visible content is confirmed; the Lexical check walks with a limit.
- Fixed: crash on unknown preset in admin cards, adding a forbidden card for hero, out-of-enum preview timing, missing-field error display. The CSS hover was removed from the keyboard focus pointer condition; scroll-progress completes at full entry, the fallback checks both timeline and range support.
- Focused regressions and migration 1134 up/down (162 tables; 72 `_v`) data-preservation test passed; real REST/MCP handler rejection verified. Full gate results are in the audit record at the top of `progress.md`. No live DB/3100/`.next`/commit action; build and smoke in the DB copy.

## V1 — Animation preset system (2026-11-08)

- New `motion` group (`src/fields/block-motion.ts`, "Motion" collapsible; 18 blocks, excluding spacer/divider/listing): `preset` auto|none|fade|slide-up|slide-down|slide-left|slide-right|zoom-in|parallax-soft|stagger, `trigger` scroll|scroll-progress|load|hover, `duration` fast/base/slow (240/560/800 ms), `delay` 0/100/200/300, `easing` soft/standard/emphasized, `stagger` none/tight/relaxed (≤4 steps, ≤300 ms), `mobile` (parallax). `appearance.animation` is unchanged; `none` is the master switch. The default `auto` = the old markup exactly.
- Render: `planBlocks` → `ctx.motion` (`resolveMotion`); `anim(i, motion, mode)` + `BlockShell motion`; hero `heroMotion` (translate only; parallax on media). CSS contract in `globals.css` "Motion system": `data-anim`, `data-anim-trigger`, `data-anim-safe`, `data-anim-mobile`, `--anim-dur|delay|ease|stagger`, per-effect `--m-o/--m-from`; the observer does not watch `[data-anim-trigger]`. LCP: the first block + every hero's hiding effect is downgraded on the server to `slide-up` + safe (opacity 1). Reduced-motion/`data-motion=none` turns everything off.
- Admin: `src/admin/fields/motion-preset-cards.tsx` (import map, pure CSS preview, Replay; 7 safe cards for hero + `validateHeroPreset`). Labels in `admin-i18n.ts` `MOTION_LABELS`.
- Migration `20261108_100715_blocks_motion`: 1134 ADD COLUMN (162 tables × 7); down removes only these columns. Tested on a copy; live backup `scratchpad/softmarket-pre-v1.db{,-wal,-shm}` + `.snapshot.db`; live migrate, 681 tables with old data diff 0, integrity ok.
- Verification: typecheck/lint, 58 files/728 tests, prod build, Playwright 27/27 on 3300 (copy DB) (390/1440, CLS 0, reduced/none/no-JS), mobile Lighthouse on `/tr` Perf 100, LCP 1.06 s, JS 129.4 KB. No commit. Details: V1 record in `docs/plan-visual-editor.md`.

## V0 — Payload security upgrade (2026-11-08)

- `payload` + all `@payloadcms/*` **3.85.1 → 3.93.0**, fully pinned/aligned; Next **15.4.11** and React **19.2.6** kept. Minimum Node **24.22.1**; host **24.21.0** not changed; tests/build/migration were run with a temporary official **24.22.2** runtime.
- Migration `20261108_093334_v0_payload_393`: **2 auth columns + 309 localized parent indexes**; no destructive up; down removes only its own additions. First up/down/data-preservation on a copy; then the `scratchpad/softmarket-pre-v0.db{,-wal,-shm}` + `.snapshot.db` backup and the live migrate. Copy/live: **680 tables, old data diff 0, integrity ok, FK 0**.
- Release notes for 3.86–3.93 (including patches) reviewed: block read/tip access, upload/SVG/XML/SSRF safety; API key hiding, new JWT authVersion (re-login for old sessions), localized draft, Lexical 0.50, Nodemailer 10, compatibility with SQLite/MCP/admin/i18n/preview. Security defaults were not relaxed. TIFF `.tif`, active SVG rejection, draft-only relationship and JWT tests were updated.
- **typecheck/lint, 56 files/703 tests, generate:types/importmap, copy DB `.next-prod` build, 3200 smoke, isolated E2E 1/1 passed**. Fresh MCP **69 tools**, TR/EN create/update + identity/permission checks passed. Import map unchanged. An upstream mcp-handler SDK peer warning remains; the safe SDK was not downgraded. Preview 401 test uses a valid `?redirect=/tr`; a bare endpoint is 400 as before.
- **3200/3400 closed; 3100 PID 53048 and `.next` kept; no commit.** pnpm install may break HMR: the admin must restart dev after Node >=24.22.1; no restart was done in this task. Detailed release/migration/test/file record: the V0 section at the end of `docs/plan-visual-editor.md`. **V0 completed; V1/V2/pilots not applied.**

- 2026-11-08 F11 performance fix round (JS/font/image LCP): header server component + single island `header-frame.tsx` + `src/lib/header-nav.ts` (instead of Radix NavigationMenu/Dialog; mega panels are `hidden` in HTML, aria-expanded/controls, hover intent 80/150/300 ms, ←/→/Home/End, ↓ into panel, Escape returns focus; mobile menu is a native modal `<dialog data-sheet>`, `ui/sheet.tsx` deleted). `NextIntlClientProvider` removed; no next-intl hook on the client (language selector `publicLanguageSwitch` + static JSON labels; error/global-error only `feedback`); server `hasLocale` → `src/i18n/has-locale.ts` (the `next-intl` root entry made the provider a client reference). `safeHref` → `lib/safe-href.ts`, `jsonLdString` → `lib/json-ld-string.ts`, client `cx` (`lib/cx.ts`), client lucide icons `ui/client-icons.tsx`. Font: `scripts/subset-fonts.sh` (fonttools) → `src/fonts/` Geist subsets: primary Latin-1+Turkish 28 KB single preload, Latin-ext separate unicode-range face, mono 20 KB no preload, `Geist Fallback` in globals.css. Result (copy DB, 3300, LH 3 runs): home JS 192→129 KB, font 138.7→48.3 KB (other pages 28 KB), image LCP 3.16→2.53 s (target <2.5 RED: framework JS; devtools 2.24 s), CLS 0, Perf 100/97. Remaining: on home, mono still loads (hero panel font-mono). Guard: `tests/unit/client-bundle-guard.test.ts`; e2e `tests/e2e/header-keyboard.spec.ts` (3/3, `E2E_BASE_URL`). `pnpm test --maxWorkers=1` 54/696, typecheck/lint, `.next-perf` build. Details: `docs/perf/f11-acceptance.md` "After the fix round". 3300 closed; 3100/.next/live DB untouched, no commit.

- 2026-11-08 F11 security/quality audit: isolated seed verifies the canonical/encoded DB URI, private temp directory/marker, symlink/hardlink, uploads and secrets before `.env` or Payload import; the real SQLite file is also checked before writing. 3400 is reserved; if runtime env is missing, it does not fall back to the live DB default. Read-only source backup, early/bounded cleanup, direct Node + Next shim, Playwright graceful SIGTERM, random password/secret, trace/xtrace off, correct `roles:[admin]`. Invalid Lighthouse runs/report errors and double medians fixed; docs MISS measurement not verified. Typecheck/lint and `.next-prod` build with the copy DB passed; latest `pnpm test --maxWorkers=1`: 52 files, 643/643. The default parallel test run timed out on existing heavy SQLite/media tests. Normal Playwright list 15 tests, isolated excluded; isolated list 1 test. Latest shell/isolation regression 19/19. The first real E2E API flow (copy with a pre-existing user) passed; the old pnpm-wrapper shutdown left orphan processes: PIDs 35377 and 35375 on 3400 belong only to this attempt and are waiting for the user to close them because of the sandbox signal block; audit source DB/logs in `$TMPDIR/softmarket-f11-audit-qg96e6_b` (to be cleaned when the process ends); re-running E2E and cleanup depend on this external block. No live DB writes/3100/.next/commit.

- 2026-11-07 F11 visual QA round 2 + performance acceptance (acceptance NOT MET): 432 screenshots (prod 3200) clean; baseline updated. Mobile Lighthouse (median of 3 runs) text pages Perf/A11y/BP 100, LCP 1.06-1.21 s, CLS 0, TBT 73-89 ms; SEO 92 (canonical only, awaiting domain). RED: image hero LCP 3.0 s (Lantern; LCP=FCP 2.18 s under devtools throttling), JS 192 KB gzip (>130; Radix nav-menu 16.6, ICU parser 12.5, tailwind-merge 9.3), font 70 KB + second font 70 KB. Worst INP proxy 128 ms. ISR HIT 2-8 ms; dynamic list/contact 11-18 queries. Details `docs/perf/f11-acceptance.md`, visuals `docs/qa/visual-baseline.md` "F11 round 2" (most critical: DRAFT and `[ŞİRKET UNVANI]` placeholders on legal pages are live). Small fixes: lead form `*` + `border-strong`; admin block field "Add block" (`Blok ekle`). Editor guide corrected against the real admin UI (Add layout → Add block, Delete → Remove, no draft save/autosave, Publish changes, Live Preview eye icon). e2e: `tests/e2e/f11-flows.spec.ts` (3100, read-only) + `tests/e2e/isolated/` (DB copy, 3400, `pnpm test:e2e:isolated`; `scripts/e2e-isolated-server.sh`, `scripts/e2e-seed-admin.ts`); default `playwright.config.ts` ignores the isolated folder. `scripts/perf-lighthouse.mjs` LH_RUNS/LH_BASE/LH_URLS/LH_PRESETS + median. Note: the 3100 dev process was accidentally closed by a broad pkill and restarted with `pnpm dev`.

- 2026-11-07 F9 original media privacy: `Media.beforeOperation` → `src/lib/media-upload.ts`; on new/create and replacement/update uploads of JPEG/PNG/WebP/TIFF/HEIC/HEIF, the EXIF orientation is applied, EXIF/GPS/XMP/IPTC are removed, ICC may be kept. JPEG q90/mozjpeg, PNG/WebP lossless, TIFF LZW; HEIC requires HEVC support, a cleaning error is 400. SVG/GIF/video/PDF and existing files are not changed; regenerate preserves the original. 10 new tests on temporary SQLite/uploads (GPS JPEG, physical orientation/size, formats, tempFilePath, 400 and out-of-scope files); typecheck/lint and 48 files/603 tests passed. Risk note in `docs/perf/f9-media-pipeline.md` closed. No live DB/3100/commit action.

- F9 audit (2026-11-07): derived names as UUIDs, fail-closed access on old conflicting files, SVG sandbox CSP/nosniff; regenerate builds in stages while preserving the original. Full test 47 files/593 tests, typecheck/lint, build with the isolated DB; 3200 smoke 200/200/200/200/404, optimizer 400; 3200 closed, 3100 preserved. Original JPEG/PNG may contain EXIF/GPS; real disk-full and forced kill were not tested. Details in docs/perf/f9-media-pipeline.md.

- F9 visual pipeline implemented (2026-11-07): Media thumb400/card768/hero1280/wide1920 WebP q74, focal/crop; large targets are skipped with the Payload default (`withoutEnlargement:true` produces unnecessary original copies). A native shared MediaImage on all img consumers: srcset/sizes, container spacing, width/height, lazy, hero eager/high + responsive preload. `mediaRead` authorizes size filenames with the same media record + the existing license filter; optimizer off, private/no-store. Migration `20261107_192347_media_image_sizes` (24 ADD COLUMN + 4 indexes; down without rebuild) tested on a copy and applied live; backup `scratchpad/softmarket-pre-f9.db{,-wal,-shm,.snapshot.db}`, old data diff 0, integrity ok/FK 0. `pnpm media:regenerate` keeps identity/seedPath/TR-EN/permissions/original bytes; on the copy 3 → 0 regenerate. Real handler/SQLite tests for anon/customer/staff + valid/cancelled license, 45 production HTTP file/role checks; F8 staff+draft sees protected srcset while anon/customer/draft cookie alone sees only public. Mobile textured fixture 390px/DPR1–3: 1.24/23.28/171.17 KB. Typecheck/lint, 47 files/591 tests, production build and /tr,/en,/tr/urunler,/admin 200; /tr/unknown 404. **LCP/CLS and browser currentSrc measurement not verified:** Chromium MachPort 1100, Lighthouse port and browser host blocked; no claim of no regression. Evidence/limits: `docs/perf/f9-media-pipeline.md`. Tests/users only in the DB copy, live media=0; 3200 closed (ECONNREFUSED); 3100 open/.next preserved, no commit.

- F8 Live Preview + draft mode completed (2026-11-07): `/api/preview` (staff-only draftMode; anon 401, customer 403, cross-site 403, redirect allow-list 400) + `/api/exit-preview`; `src/lib/preview.ts` `getPreviewUser/readAs` (draft mode + `payload.auth` staff on every render; otherwise published) in singular loaders; `admin.livePreview` 6 collections + 3 breakpoints (`src/lib/preview-url.ts`); `RefreshRouteOnSave` island (same-origin) + "Exit preview" badge; `pages` autosave 2000 ms; migration `20261107_190342_pages_autosave` (only ADD COLUMN + index) live, backup `scratchpad/softmarket-pre-f8.db*` + `.snapshot.db`. The home page `dynamic='error'` was removed (headers() was forbidden in draft; still SSG). Middleware `no-store` on the draft cookie. New dependency `@payloadcms/live-preview-react@3.85.1`. 3200 verification + Playwright: autosave 2061 ms, iframe current after 92 ms; anonymous gets published + ISR HIT at the same time. 46 files/585 tests, `.next-prod` build. 3200 closed, 3100 preserved, no commit. F9/F10 notes: plan F8 note + progress.

- F6 audit (2026-11-07): sitemap content queries cached for 1 hour with the `public-sitemap` tag, invalidated on publish/delete/global change; the landing address of the configured home page is excluded from the sitemap. Migration `20261107_160000_globals_media_delete` (media FK trigger) applied and tested only on the DB copy; not applied to live.

- F6 page builder completed (2026-11-07): migration `20261107_144850_page_builder_pages` (up: 66 CREATE TABLE + 154 indexes + 185 ADD COLUMN + `site_settings_home_page_delete` trigger; the generated down rebuilt `site_settings` with `__new_` → hand-written safe down, locked by tests; applied live, backup `scratchpad/softmarket-pre-f6.db*` + `.snapshot.db`). Home page = a `pages` record: `getHomePage` homePage → slug `home` → `FallbackHome` (old composition). `pages.systemKey` (9 routes) + `hero` group → `SystemHero`/`SystemBody` (`src/components/pages/system-page.tsx`); the list = new `listing` block (pages only; if absent, below the hero; hidden = no list). `pageType: template` is not read anonymously. Landing `[locale]/[slug]` + `RESERVED_SLUGS`/`pagePath` (`src/lib/system-pages.ts`); `/[slug]` not added to next-intl pathnames, a `slug` key was added to `LINK_ROUTES`. Family `layout`. Hero `aside: families` + `panelTitle`; appearance `separator`; ListFrame `mt-14`; CTA banner spacing = CtaBand (product page CTA +8 px). Seed `05-pages.json` + `01-globals` `homePage`. Root cause of revalidate: `revalidatePath('/tr','layout')` matched no derived tag → `revalidatePath('/', 'layout')`; sitemap `force-dynamic` (Next 15.4 has no APP_ROUTE tag check). 3200 verification: 24 screens (390/1440) before/after pixel difference 0%, identical heights; block order changed via API and reverted; /tr MISS 20 / HIT 0 queries. 44 files/536 tests. 3200 closed, 3100 preserved, no commit.
- F8 notes: Live Preview/draft loaders `getHomePage`/`getSystemPage`/`getLandingPage` should get a `draft` parameter (currently anonymous+published). Once `pages` autosave is on, revalidate already runs only on publish. The F7 FKs `site_settings.favicon_id` and `header_nav_items.featured_image_id` have no ON DELETE action: deleting media causes an FK error → a trigger is needed (hero_video_delete/F6 pattern). If the landing EN slug differs, an `internal` reference must be used for the link (the route `slug` param is single-language). The CLI import does not refresh the Next cache.

- F7 globals completed (2026-11-07): migration `20261107_141523_globals_editable` (up: 6 CREATE TABLE + 91 ADD COLUMN; down was hand-written because the generated down rebuilt `header_nav_items`/`site_settings` with `__new_`, and the FK OFF inside the transaction had no effect → cascade data loss). Link `type: route` + `route` (stable key, e.g. `urunler`, `yasal_slug`) + `routeParam`; `linkTarget()` turns the TR canonical path into an AppLink for EN. Header: `megaMenu: custom` (columns + featured), `cta.secondary`, `announcement`, `utility`; Footer: `brandBlurb`, `showContact`, `showSocial`; SiteSettings: `favicon`, `brand.accent`, `motion`. Loaders `getSiteSettings` (depth 1, media projection, filename required → url), `siteIdentity`, `publicContact`, `publicImage` (`src/lib/site.ts`); `publicText`/`formatCopyright` (`src/lib/utils.ts`). Contrast: a color must pass AA in at least one theme as is; other theme/hover tones are derived; a mid-brightness band is rejected. Icons moved under `public/` (app file icons would override the CMS favicon). Announcement/utility sit above the header in normal flow (main `-mt` only balances the header). The seed e-mail is intentionally empty (so notifications do not go to the wrong address). Old `link_url` values remain in the DB as a hidden field (not read when type=route).
- (Applied in F6) F6 notes: for CMS pages/landing pages, `route` options come only from `CANONICAL_PATHS`; when adding the `[locale]/[slug]` landing route, ADD a new key to `LINK_ROUTES` (do not change or delete existing keys). CTAs in home page blocks must use `route`. `referencePath` for `pages` only resolves legal/about/home; it must be extended for landing pages. When the header `items` is empty, the i18n fallback is used; the F6 home page seed must also be written with `route`.

- F5 audit (2026-11-07): manual selection order is resolved before the limit by an anonymous ID/slug query; only the top 24 selected records are populated. The old logoWall `partners`/`caseStudies` sources use `maxDepth:0` + an anonymous ID query; existing source values, selection order, and text logos are preserved. In automatic sources, logo-less records are excluded in the query, and unreadable media are removed before dedup. The import JSON schema also applies the `max` value of number fields. Details and verification: progress.md F5 audit.
- F5 dynamic blocks completed (2026-11-07): migration `20261107_130000_blocks_dynamic_set` (only CREATE + logoWall `limit` ADD COLUMN; applied live). Blocks `productFamilies`, `productShowcase`, `solutionsGrid`, `caseStudy`, `newsList` + logoWall automatic sources; loader `src/lib/blocks/data.ts` (anonymous, cached, fixed query, `preloadBlockData` in RenderBlocks); DO NOT use block `dbName` (it conflicts); long slugs use `enumName` for animation. Manual-selection relationships `maxDepth:0`. No commit.

- F4 static blocks completed (2026-11-07): migration `20261107_111754_blocks_static_set` (only CREATE TABLE + hero `video_id` ADD COLUMN; applied live, copy DB + dry-run 0 errors). New blocks `media`, `testimonial`, `tabs`, `spacer`, `divider`; `videoEmbed` facade (iframe only on click, nocookie/dnt); hero `mediaBackground` + optional muted video (`hero-video` island: `<video>` mounts only at ≥768px with reduced-motion/saveData/`data-motion=none` off; otherwise only the poster = LCP). Client islands: `tabs-island`, `video-facade`, `hero-video`; logic `src/lib/blocks/static.ts`. `common.playVideo` i18n key added. typecheck/lint/36 files 420 tests, `.next-prod` build, 3200 Playwright (CLS 0, network/keyboard/no-JS) passed; temporary `qa-blocks` page and media deleted; 3200 closed, 3100 untouched, no commit. F5 note: new blocks were added at the end of `layoutBlocks`; the hero `video` field `filterOptions mimeType contains video/`.

## Phase audit log (F0–F10)

- F10 cross-audit (2026-11-07): the label walker preserves access/hooks/defaultValue/admin.hidden and the schema; sanitized plugin config access policies + MCP exclusions verified in regression tests. A real write/rollback + Lexical conversion via CLI, a physical DB isolation check, and proof of overwriting existing content were added to the starter test; AGENTS.md contains only the empty-setup warning. `docs/editor-guide.md` was corrected for media protection/metadata scope, admin-only Site settings, instant saving of globals, license conditions, template copy type, common block structure and other code discrepancies. Typecheck/lint, 50 files/613 tests and `NEXT_DIST_DIR=.next-prod pnpm build` with a starter-loaded temporary SQLite passed (existing localhost canonical warning). `pnpm migrate:create f10_audit`: No schema changes; no file created, payload-types difference only in comments. Live DB/3100/.next/commit untouched.

- F10 code part (2026-11-07): admin labels/descriptions/options/tabs/array rows/groups in TR+EN, single dictionary `src/lib/admin-i18n.ts` (`localizeCollection/localizeGlobal`, applied in payload.config; plugin collection labels `pluginLabels`). No schema change (migrate:create "No schema changes"). `tests/unit/admin-labels.test.ts` scans the config; `content/templates/starter` (+ isolated SQLite test `starter-template-db.test.ts`); starter section in AGENTS.md. Live Preview breakpoint label is a plain string (Payload React child). `editor-guide.md` is a separate agenda; no commit.

- F8 audit (2026-11-07): preview/exit-preview closed by default with the same source verification via Fetch Metadata or Origin/Referer; `X-Frame-Options: SAMEORIGIN` added. 585 tests, typecheck, lint and `.next-prod` build with the copy DB passed. On 3200, after a staff draft, anonymous ISR served the published content; only the draft cookie did not open the draft. 3200 closed, live DB and 3100 untouched.

- F4 security/quality audit (2026-11-07): `blocks_static_set.down()` deleted the hero table translation/CTA data by rebuilding the table; now only the video index/column is removed. Normal + `_v`, four collections, and transaction regression passed. The `20261107_120000_hero_video_delete` trigger migration was applied deliberately to the live DB after backup (commit `a45a9df`). Two migration tests verify the real DB file to a temporary directory with `PRAGMA database_list`.
- VideoEmbed record/render use the same strict YouTube/Vimeo parser; ID/path/credential/port checks; autoplay parameters are not generated from scratch. Hero video requires public MP4/WebM and a poster; the Payload upload filter was verified on the server with real writes. The renderer repeats the public/MIME check. Testimonial alt fallback fixed. Tabs show all panels without JS; after hydration ARIA/roving tabindex, horizontal arrows/Home/End (does not block up/down scrolling).
- F4 final verification: typecheck/lint, 36 files/438 tests, `.next-prod` build passed on the DB copy. F4 fixture JSON import 2× (4 create → 0 create/4 update); default seed dry-run 0 create/88 update. 3200: /tr, /en, catalog, product detail, /admin 200; unknown route 404. Protected video HTML/Flight URL does not leak, file 404; public poster 200; no-JS tabs/richText/CSP checks passed. After QA content was removed and the clean build/smoke repeated (QA routes 404); temporary DB/media copies deleted. Browser interactions could not be verified because of Chromium MachPort sandbox permission. 3200 closed, 3100 PID 45975 preserved; no live migration/commit/.next deletion.

- F3/F0 audit (2026-11-07): reserved anchor IDs are rejected at render time too; prototype names get a safe default. The query log does not write the URL path and limits the correlation ID to UUID v4. typecheck/lint/399 tests and `.next-prod` build with the DB copy passed; 3200 smoke test passed, process closed. 3100 and live DB migration not touched.

- F3 block core completed (2026-11-07): migration `20261107_110012_blocks_appearance` (only ADD COLUMN, 80 block tables, defaults keep the old look; copy DB + dry-run, then live; import 2× 0 create/88 update). `src/fields/block-settings.ts` (`blockSettings`, `BLOCK_DEFAULTS`, `resolveAppearance`, anchor validation), `components/blocks/{block-shell.tsx,registry.ts,types.ts}`, `lib/blocks/render-plan.ts` (single h1: `RenderBlocks firstHeroH1` only for CMS pages without h1 / F6; on pages with PageHero the hero is h2). Hero `default`=cinematic + split/centered/minimal; CTA `split`; featureGrid `style` + icon select (`lib/icon-names.ts`). Admin i18n TR default, block TR/EN labels + `admin.group` + `public/admin/blocks/*.webp` placeholders. `blockReferences` not used (rationale in the F3 plan). typecheck/lint/34 files 398 tests, `.next-prod` build; 3200 at 1440/390 image difference ≈0 (`scratchpad/f3/`). 3200 closed, 3100 untouched, no commit.

- F0 SQLite query measurement completed (2026-11-07): `src/lib/db-query-log.ts`, Node `instrumentation.ts` and the Payload adapter wrapper enabled by a flag. With `SM_DB_QUERY_LOG=1`, the libSQL statement count/time + ALS context per HTTP request; server render can read `getDbQueryStats()`. After streaming, the `finish` logs are matched by `scripts/perf-isr.ts` via `SM_DB_QUERY_LOG_FILE` and the request ID. With the flag off, the adapter/client/HTTP emit is not wrapped. `.next-perf` build + 3300 production measurement: 146 routes/292 HTTP 200; 0/0 queries in 122 HIT/HIT pairs. Search 33/33, catalog 17/14 (first 3 PRAGMA), contact/downloads 16/16, portal login 9/9; concurrent isolation 33/9/14 verified. The first 10 routes are in `docs/perf/baseline.md`. typecheck/lint/32 files 376 tests/diff-check passed. 3300 closed; 3100 untouched; no commit.

- F1/F2/G audit (2026-11-07): cache cleanup on unpublish was skipped after a draft was saved on top of a published record; `revalidate.ts` tracks the main record's publish state between before/afterChange. Publish, consecutive drafts, unpublish, slug change and delete were verified with a real temporary SQLite test. `content.ts` converts options to primitive cache keys; a missing family relationship does not break other counters. React cache is not persistent outside render; public queries stay anonymous + draft:false.
- MotionObserver restores visibility on observation/callback errors; it is also cleared on query change along with pathname (Suspense in `Header`). Covered by the locale layout, including the portal. Hero aside translates only; breadcrumb shortens long parents while keeping accessible text. `safeHref` also rejects encoded mailto placeholders; javascript/data were already blocked. Final QA: typecheck/lint/31 files 372 tests and `.next-prod` build passed. 3200 `pnpm start`: the 6 requested routes 200, `/tr/unknown` 404, SSR pending=0, Mono preload=0; process closed. No interference with 3100 and the `.next` process; no commit.
- QA command note: build and typecheck are not run at the same time (generated `.next-prod/types` files are refreshed). Running `node node_modules/next/dist/bin/next start` directly failed to find `libsql` because the pnpm shim's NODE_PATH setting was skipped; the supported repo/systemd `pnpm start` flow passed.

- F2 animation + G visual round (2026-11-07): `Reveal` deleted; `src/lib/anim.ts` (`anim(i)`, `heroIn`), `src/lib/motion.ts` (core), `components/ui/motion-observer.tsx` (single IntersectionObserver, attached inside `Header`; because layout.tsx is in Terra). Hidden state only with JS as `data-anim-state="pending"`; `html[data-motion="none"]` is supported (settings field F7). Hero CSS keyframes (h1/lead translate only). Header light theme only on `/hesap`; all heading pages have a dark hero. Tokens in `globals.css` `:root` (--dur-*, --stagger). Mobile Lighthouse 100, CLS 0, JS gzip ~192 KB unchanged (motion package in Terra). `docs/qa/visual-baseline.md` updated.

- F0 partial measurement without a browser (2026-11-07): `docs/perf/baseline.md`, `scripts/perf-isr.ts`; 144 sitemap URLs two GETs each, 122 HIT/HIT, 22 caches without headers, all 200. Three isolated builds: one had a `/500` prerender error, two succeeded; the document timeout did not repeat, root cause not verified. SQLite request counter/test and query measurement missing. 3300 closed, 3100 untouched.

- Security QA (2026-11-07): the license e-mail is sent after the HTTP response, for independently verified durable recording; the key is not written to the console when SMTP is absent. Notifications are not scheduled for assignments outside a request context. The applied `20261107_092304_remove_sales_legal_fields` deletes three old relationship values; down does not restore the values. Migration history not changed.

This file holds the "where we are now" information between sessions. Update it when it changes.

## Payment mode plan (2026-11-08)
- Plan: `docs/plan-payments.md` (draft, no code). Three-layer switch: env `PAYMENTS_ENABLED` → `site-settings.commerce.mode` (quote|payment, default quote) → `editions.saleMode` (quote|purchase). In closed mode the payment surface is fully 404/hidden; data is not deleted. iyzico (TRY) + Stripe (USD/EUR) hosted redirect (SAQ-A); webhook = trigger / truth = provider retrieve; automatic license through idempotent fulfillment.
- Order: P0 verification + P1 pure core + P7 legal drafts in parallel with the V pilots; P2-S schema after V4 (never before V2-S). 4 open questions in plan §9; awaiting user answer.

## Next task: visual editor pilot (2026-11-08)
- Plan: `docs/plan-visual-editor.md` (draft, no code). The user's decision was "try both first": V3a Puck (`@puckeditor/core`) and V3b Payload-native canvas (first a half-day spike of the what-digital plugin) 2–3 day pilots, separate worktree/branch, without schema change; in V4, gates (round-trip 0 difference, Lexical, TR/EN, public bundle, security) + selection by weighted score.
- Ordered schema: V0 Payload 3.85.1→3.93.x → V1-S `motion` group (preset/trigger/duration/delay/easing/stagger, `auto` = old look) → V2-S product bound blocks (`productHero`…`productDocs`, products only; compatibility mode draws the old page exactly) + `_products_v.autosave`.
- Rules: data single source of truth `layout`, editor JS does not go to public, field/option/defaultValue do not change, migrations: copy DB first + safe down. 3 open questions in plan §5; awaiting user answer.

## Next major task: page builder + animation/performance plan (2026-11-07)
- Next 15.4.11: `notFound()` under `(frontend)/[locale]` produces a `__next_error__` shell in SSR; the localized 404 is visible from the RSC payload on the client. The HTTP test checks status 404 + HTML/RSC content; `smoke.spec.ts` checks the visible `<main>` 404.
- Tried and no result: disabling globalNotFound, simplifying the layout, removing header/footer/error.tsx, passthrough app/layout + app/not-found and moving the OG file; to be revisited in the page builder phase.
- Plan: `docs/plan-page-builder-animation.md` (draft, no code). The home page moves to a `pages` record (SiteSettings.homePage); blocks get a shared `appearance` (theme/spacing/alignment/animation/anchor), new catalog/proof blocks, system page binding, Live Preview + draft, fully editable globals.
- Performance: content.ts `cache()`, no revalidation on draft, single IntersectionObserver (`Reveal` removed), unused `motion` removed, Media `imageSizes` + webp srcset, no Mono preload; budget LCP<2.0s/CLS<0.05/INP<200ms/LH≥90.
- Phases F0 (measurement + visual QA) → F1/F2/F9 → F3 → F4/F5/F7 → F6 → F8 → F10 → F11; G = user visual bug list round. 5 open questions in plan §11; awaiting user answer.

## Current focus (2026-11-07, UX audit fixes)
- 13 UX audit items implemented: language switcher (CMS alternates + `<link hreflang>` fallback, `hreflangPath`), footer legal links (`kvkk-aydinlatma`, `gizlilik-politikasi`, EULA; seed + fallback + KVKK link on form/registration), header seed (Products/Solutions mega + Support + Company + CTA; seed links are `type: external` + site-internal path because internal links resolve only through `reference`), root cause of button contrast: `cn()` (twMerge treated `text-small` as a color and removed `text-accent-contrast` → `extendTailwindMerge`), product detail single source (hero/featureGrid/specTable blocks removed from the seed, and the page filters these blocks; extra blocks come after features), form edition list (only the selected product's editions, SKU invisible, disabled until a product is selected; the server returns `invalid` for a product/SKU mismatch via `selectionErrors`), client validation (noValidate + inline error + role=alert summary), `[locale]/[...notFound]` catch-all → 404 with header/footer (search + popular links; global-not-found only for invalid locale), favicon (`src/app/favicon.ico`, `icon.svg`, `apple-icon.png`; middleware matcher captured the `/icon` route, so static files), mobile 44px targets, product tab bar fade, JSON-LD `suppressHydrationWarning` (the browser empties the nonce attribute; CSP unchanged), downloads OS label localized + version option prefixed with the product name.
- Scroll reveal was already a progressive enhancement (no opacity in SSR, off in reduced-motion); locked by unit test.
- Verification: typecheck, lint, 29 files/345 Vitest, `NEXT_DIST_DIR=.next-prod pnpm build` passed. Playwright (3100): language switcher header/footer, 404 chrome, form edition filter + empty submit errors, download filters, mobile menu, hydration console clean. Seed imports (01-globals, 10-families-products) ran idempotently. No commit, dev server untouched.
- Note: currently all slugs are the same in TR and EN; language switching with different slugs was verified only with a unit test (`hreflangPath`).

## Previous focus (2026-11-07)
- 404/security audit: the static media asset query was combined with the access filter; inaccessible and nonexistent files return 404. Verified on a temporary SQLite with real queries and isolated prod HTTP on 3200. Two builds did not repeat the document timeout; root cause not verified.
- 404 fix: root `not-found.tsx` without a layout → `global-not-found.tsx`; Next 15.4 `experimental.globalNotFound=true` (experimental). Independent HTML 404 for multiple root layouts + dynamic locale; no catch-all needed; locale loading/not-found and OG handler placement kept.
- For static media requests without a record, `mediaRead` produces a Payload NotFound (404); the access filter is kept for existing files.
- Verification (3200 temporary prod, closed): /tr/xyz, /en/xyz, /xyz → 404 + 404 inside main; /tr and /admin → 200; /api/media/file/none → 404; TR/EN OG → 200 PNG. Typecheck, 317 Vitest tests, isolated .next-prod build and 3 HTTP E2E passed. Browser smoke could not run because of macOS MachPort permission; the visibility expectation is kept. The 3100 dev process was not touched; no commit.
- Phase 9 audit fixes applied: cookieless Header, public ISR, CMS invalidation, error/loading screens, SEO/OG/sitemap, CSP, next/image security boundary, CSS reveal, and form accessibility. Architecture details in the Phase 9 section of `systemPatterns.md`.
- Last verification: typecheck/lint passed; Vitest 25 files/310 tests passed. `NEXT_DIST_DIR=.next-prod pnpm build` passed; 126 cached URLs in the manifest, home TTL=3600, portal outside the cache. Temporary 3101 production HTTP check: TR/EN 200, ISR HIT, form/portal no-store, separate admin CSP; the temporary process was closed.
- Playwright baseURL 127.0.0.1:3100: 3 HTTP tests passed; 8 browser tests failed because Chromium could not start. Chromium was installed under `/private/tmp/softmarket-playwright`; the macOS sandbox gives `MachPortRendezvous bootstrap_check_in Permission denied (1100)`. UI/keyboard flows were written but not verified in a browser. Retry: `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/softmarket-playwright pnpm test:e2e` (requires an allowed host).
- CSP is Report-Only by default; public ISR HTML gets a static policy; dynamic pages use a nonce. NEXT_PUBLIC_SERVER_URL is still local; without a production domain, build/start shows an explicit SEO warning. `.env`, Makefile, content-import sources not changed; no schema/migration/commit/dev stop.
- Phase 8a QA: MCP response depth limited to zero and the MCP file path closed; a 25 MiB limit and bound media directory rejection were added to media import. The CLI now cleans up media files created in this run on error/rollback.
- Phase 8a content import/MCP/Cloudflare Web Analytics implemented. `content/seed/schema.json`, minimal `example.json`; `pnpm content:import` (default seed), `--dry-run`, `--legal`; `make seed` runs ensure-forms first.
- Real DB two imports: 3 create → 0 create/3 update; same family/product/edition #1, examples in the DB. Legal drafts were not published in the local DB; conversion/publishing verified in an isolated SQLite test.
- MCP `/api/mcp`, admin users API key only; setup/permissions in AGENTS.md. New migration `20261106_164616_phase8a_content_mcp` applied.
- Cloudflare token optional, cookieless; outside admin/portal; SPA measurement off. The current repo copy of the external read-only plan is `docs/implementation-plan.md`.
- MCP: fresh handler 200/69 tools, anonymous HTTP 401. The running dev authStrategies HMR registration does not yet include the users API key strategy, so a valid key gets HTTP 401; it waits for the next normal process start (restart prohibited).
- Phase 7 completed: i18n texts reviewed (tr/en key trees equal); README updated; legal texts under `content/legal/{tr,en}` are DRAFTS. Lawyer review pending; mandatory before publication.
- Phase 6 completed: customer portal `/hesap` ↔ `/en/account` (login/registration/password/verification, summary, licenses, downloads, requests, profile).
- Phase 4 completed: support center, search, and secure demo/quote/contact/support forms.
- No online payment: promotion + quote/demo request.
- License module and customer portal target are maintained; assignment through an authorized administrator in the panel/API/MCP.

## Latest changes
- Content import bug fixes: dry-run skips docs/releases queries with a planned relationship table; invalid DB identities are rejected with a clear error. Write-free dry-run is kept; during rollback, newly created media files are cleaned up and existing files are not deleted.
- Markdown conversion now applies a link/autolink URL allowlist; raw HTML stays as text, and HTML nodes are dropped. `01-globals.json` shared company/contact fields synchronized; schema unchanged.
- Final check: typecheck/lint passed; Vitest 23 files/293 tests passed. Dry-run planned 88 creates/0 updates and 3 global updates. No real local import/build/restart/commit was done.
- Download, documentation (product/tree/detail), release notes, FAQ and request pages under `/destek` opened in TR/EN; information areas use an open theme.
- `/ara` ↔ `/en/search`, header link, query limits and pagination; old `/arama` redirects. The search index is limited to source publication for anonymous access.
- Forms were created idempotently with `scripts/ensure-forms.ts` / `pnpm ensure-forms`; the `softmarket-{demo,quote,contact,support}` titles are fixed identities. TR/EN labels verified.
- Zod, honeypot, IP limit, origin check, Turnstile Siteverify and mandatory KVKK; `form-submissions.create = nobody`, only the server action writes with `overrideAccess:true`.
- Notification is sent after the record is saved; titles are server-owned; SMTP/e-mail errors do not break the record. `FORM_NOTIFICATION_EMAIL` is optional; if absent, the site contact addresses/console are used.
- Document alternates/hreflang, breadcrumb, FAQPage and sitemap completed. SQLite localized slug uniqueness check uses a bounded `find` instead of `count` (Payload 3.85 locale transfer error).
- No schema/migration added; `/hesap`, Makefile and the dev process unchanged.
- Online payment APIs/libraries, the order collection, prices and purchase paths were removed.
- The SKU was kept in the quote form as the language-independent edition identifier.
- The customer's company/tax/phone was kept; the invoice address was removed.
- License create key is automatic on the server; subscription period and admin-only write access were preserved.
- SMTP host empty/placeholder → Payload console adapter.
- Migration `20261106_151826_remove_online_sales` applied; local DB backup `/private/tmp/softmarket-before-sales-removal-pfstb8pj.db`.

## Next steps
1. Chromium UI/keyboard e2e and Lighthouse on an allowed host; enforce CSP after observing production domain + CSP Report-Only. Phase 8b backup/deploy.

## Active decisions
- Sales: promotion + quote; Request a Quote on all editions.
- Local address `http://127.0.0.1:3100`; data changes only via migration.
- The dev server is not stopped; build is isolated only with `NEXT_DIST_DIR=.next-prod pnpm build`. Commit only on explicit request.
- Decision record: the "Decision evolution" in `progress.md`.

## Patterns and preferences
- Author ≠ reviewer. Cross-QA in each phase.
- Large agent outputs are processed with `ctx_*` tools; raw output does not enter context.
- The user does not want to deal with SQLite: migrations and seed must run automatically.
- In code changes, only the relevant files are touched; existing comments are not deleted.
- Security: a customer never writes `licenses`; server operations use `overrideAccess: true`.

## Lessons learned
- Default `pnpm build` breaks the running `.next` output; with dev open, `NEXT_DIST_DIR=.next-prod` is mandatory.
- The Codex sandbox needs `network_access=true` for DB/HTTP.
- The media `protected` default is `true`; set `false` when uploading public images.
- `localhost:3000` belongs to another project; always use `127.0.0.1:3100`.

## Open questions / pending inputs
- SMTP server information.
- Legal approval for legal texts.
- Product and edition data (real product information for the seed; 5-20 sample products).

## SQLite migration (2026-11-06)
- SQLite WAL/FULL, busy timeout 5000; Payload transactions enabled, libSQL write transactions `BEGIN IMMEDIATE`.
- Migrations: `20261106_145404_initial_sqlite`, `20261106_150000_sqlite_integrity`.
- Single VPS: systemd, host Caddy, Litestream; persistent data in `data/`, `uploads/`. Local port 3100.

## Latest verification (2026-11-06)
- Phase 4 QA: proxy header authentication, shared fallback limit, mandatory Origin and rejection of LIKE wildcards in search were added; the same `FORM_PROXY_SECRET` must be given to Caddy and the application.
- `pnpm generate:types`, `pnpm typecheck`, `pnpm lint` passed; `pnpm test`: 13 files, 138 tests passed.
- HTTP (127.0.0.1:3100): 20 TR/EN hub/list/search/form requests 200; invalid queries and nonexistent products/documents 404. TR/EN product documentation lists and details with temporary content 200; alternates and heading anchors verified.
- Anonymous search API hid the draft index; the licensed download name is not on the page and its file returns 403; the public file returns 200. Direct anonymous form-submissions POST 403.
- Native multipart Server Action: a real valid submission created a single record and showed the success message; the test record was deleted. Honeypot and failed e-mail limits were also tested separately.
- `pnpm ensure-forms` ran twice; the same four identities were kept. Temporary content/files cleaned up. No build, restart or commit.
- Live Turnstile/SMTP credentials were not used for an external service test; with no production Turnstile configuration, submission is off.
- The local `.env` canonical URL value is still `localhost:3100`; HTTP tests used only `127.0.0.1:3100`. The form origin check validates the current host instead of the canonical URL; `.env` was not changed.

## Phase 6 portal decisions (2026-11-06)
- The session cookie is separate from Payload's `payload-token`: `sm_customer` (prod `__Host-sm_customer`), HttpOnly/Lax, prod Secure/Path=/. The strategy is HS256/signature, requires exp/customer/id/sid and checks the live Payload session. The portal calls the current strategy directly; an admin token does not open the portal.
- Protection: `(portal)/layout.tsx` + `requireCustomer` on each page; the middleware adds an `x-sm-path` header only for `/hesap|/account`; `next` → `sanitizeNext` (only site-internal `/hesap/*`).
- All data uses `user: customer, overrideAccess:false`; requests/messages and metadata are written in one transaction. Metadata is written with `user:null, overrideAccess:true` in the same transaction only after ownership is verified. The request collection also checks the product license.
- The full license key is not on the page; one-click with a Server Action (owner check). Registration/password reset returns a response that does not reveal whether a user exists. The profile allow-list: name, company, phone, taxNumber.
- Customer registration/login/password operations go through verified Server Actions; raw REST/GraphQL login/forgot/reset is disabled. Fields the customer can update directly are also limited by the profile allow-list. Password change/reset clears old sessions in the same DB write; a revocation error on logout is not counted as success.
- `kvkkConsentAt`/`kvkkConsentVersion` are written server-side only in the verified registration hook; new migration `20261106_161413_portal_security_consent` applied. No retroactive consent was created for existing accounts.
- When no IP is found, a shared limit applies; the FORM_PROXY_SECRET-verified IP and account limits work together. For enumeration: equal KDF work + an 800–900 ms minimum duration; SMTP runs after the response via `after`.
- Portal pages are noindex/no-store; the header passes only a `signedIn` boolean. Fixed the light background color before scrolling in the portal/support header.

## Phase 6 security QA (2026-11-06)
- `pnpm generate:types`, `pnpm typecheck`, `pnpm lint`, `pnpm test` passed: 18 files/223 tests. HTTP: IDOR, licensed file, profile injection, CSRF, redirect, logout/password change/reset token replay, KVKK and rate limit verified. Fresh account response times overlapped at about 0.83–0.93 s; this is not a statistical guarantee of constant time.
- All temporary customer/staff/product/edition/license/request/message/media/search fixtures and test scripts were cleaned up; the FK check is clean. No build/dev restart/commit.
- Payload 3.85 HMR does not refresh the `authStrategies` registration: the new exp/alg rules are active over HTTP in the portal; the running dev REST registration still accepted test tokens signed with the server secret without exp / HS512. The new strategy waits for the next normal process start in REST; no restart was done per instructions.
- Chromium is installed but the sandbox MachPort permission prevented startup; the in-app browser host is also unreachable. Header HTTP markup and SSR regression tests passed; screenshot not verified. Live SMTP/Turnstile not tested.

- Phase 8a media identity: `media.seedPath` unique; even when Payload changes the file name because of a conflict, a repeat import updates the same record/file. Migration `20261106_165449_phase8a_media_identity` applied.

## Phase 8a final verification
- `pnpm generate:types`, `pnpm typecheck`, `pnpm lint`, `pnpm test` passed: 21 files / 259 tests. `git diff --check` clean.
- Real second import and final repeats: 0 create/3 update; family/product/edition #1, TR/EN titles and FK check clean. Temporary admin/MCP key deleted; users=0, pages=0; only the sample catalog remains in the DB.
- `--dry-run --legal`: 5 legal pages planned, nothing written to the DB. Legal Markdown/locale/block/idempotency and media conflict test passed in isolated SQLite. A faulty CLI relationship attempt exited with 1, and the transaction also rolled back the family record.
- Build, dev restart and commit not performed. No live Cloudflare token; beacon limits verified in SSR tests. MCP dev HMR and the external read-only source plan limit recorded above.
- F7 security/quality audit (2026-11-07): `publicImage` accepts only media explicitly set to `protected: false` with an image MIME; the announcement hiding state is tied to the content identity. Route attack inputs and migration transaction rollback tests with normal + `_v` old link data expanded; typecheck/lint/516 tests, `.next-prod` build with the copy DB and 3200 HTTP smoke passed; 3200 closed, 3100 and live migration untouched. Browser hydration interaction not separately verified.

## G2 fixes (2026-11-08)
- Legal pages with a draft marker in their content (`TASLAK —`/`DRAFT —` title or a `[UPPERCASE]` placeholder) get `noindex,nofollow` and are excluded from the sitemap, per language (`getSitemapEntries` queries `layout` for each locale). They reopen automatically when the editor clears the content; footer links stay. `hasPlaceholder` in `src/lib/utils.ts` was exported.
- Product hero: Request a Quote (`?urun=`) is primary, Editions secondary. Release notes: product groups, latest release open, older ones in `<details>`. MediaCard placeholder cover is deterministic from the href hash.
- SEO plugin `fields: localizeSeoFields` (admin-i18n.ts). Schema unchanged.
- 2026-11-08 F11 diff security/quality audit: legal draft Lexical text splitting/case and sitemap missing-validation made fail-closed; header reconnects on client navigation, the focused panel does not close on hover-out, mobile body scroll lock and a close race on rapid reopen fixed. `pnpm typecheck`, `pnpm lint`, `pnpm test --maxWorkers=1` (54/698), `.next-prod` build with the copy DB and 3200 HTTP smoke (EULA noindex, no legal in sitemap) passed. Sans/mono TR+EN glyphs verified. Playwright Chromium could not start due to MachPort sandbox 1100; no iOS device test. 3200 closed; 3100/live DB/.next preserved, no commit.
- Mobile menu (native dialog) Tab/Shift+Tab cycle inside initSheet (header-nav.ts): Chromium was handing focus to the browser UI; full + isolated e2e green.

## 2026-11-08 V2 product page bound blocks
- V2 completed: product page has 8 bound blocks (`src/blocks/product-bound.ts`). "Request a Quote" (editions) is mandatory: movable; cannot be deleted, hidden or duplicated (server validation + render re-insertion).
- The product hero is single and always first; if it is lower, the server moves it to the top silently. An empty/old layout is identical to the old layout.
- Migration `20261108_130717_v2_product_bound_blocks` only CREATE/ADD; backup scratchpad `softmarket-pre-v2.db`. Product section anchors `.product-anchor`; `req.t` passed to ValidationError (TR toast).
- Payment P1 core commit 16b565e (`src/lib/payments`, not connected to routes/UI).
- Next: V3a Puck pilot and V3b native canvas pilot (separate worktree, ports 3510/3520, no migration), then the user's 8-task test. Known limit: Payload FieldLabel locale label "— Türkçe" is the same in every admin language.
- content:import decision b audit (2026-11-08): for an existing product in composition + old seed → the layout is removed before the TR/EN conversion (old relationship/Markdown errors do not fail the import); other fields are updated, a single warning, no error. `draft:true` reads the latest draft/autosave in the same req/transaction; import also publishes the preserved draft composition. The layout structure is shared, block texts are localized; a composition seed in only one language is rejected before writing. A composition seed is subject to V2 validation; pages are not affected. Real rollback dry-run on a temporary SQLite, draft in the same transaction, TR/EN text/settings/ID preservation and idempotence verified (`content-import.test.ts`, `product-bound-db.test.ts`); gate results at the top of `progress.md`.

## 2026-11-08 V4 visual editor decision
- Decision: Payload-native canvas. Puck dropped (label `archive/pilot-puck`). Details: `docs/editor-pilot/decision.md`.
- Next: V5 `feat/visual-editor`. Visual editor is default, form is a narrow side panel.

## 2026-11-16 V5 on main
- V5 visual editor merged into `main` (merge dff005b, fixes d40cb7f). Concurrency: `editorVersion` snapshot hash + 409, in-process transaction ordering, client merge. Pilot worktrees removed; label `archive/pilot-native-canvas` (local).
- Next: payment P2-S schema, second-wave collections, V6 acceptance.

- P2-S audit: consistency of order line/net/VAT totals, payment-event commit verification and terminal status protection, fulfillment commit verification and migration down protection when commerce data exists were added; isolated SQLite regressions added.

## 2026-11-16 Payment P4 (no commit)
- Webhook/callback/reconcile written (no schema). Decision: no `server-only` package (it breaks CLI/vitest) → an import-graph test on the client side. An signed event outside the drain → `ignored` + 200; unsigned 404. No SMTP → order e-mail skipped. Next: P4 independent QA, then P5 checkout UI; verify iyzico webhook/retrieve with sandbox keys.

## P7 commerceLegal independent audit — 2026-11-16 (complete, no commit)

- Fixed: `legalReady` opened with an EN fallback/empty-hidden legal text, missing placeholder detection, concurrent draft type conflict, leaked renamed legal URL, and importer symlink reads. Header/footer internal reference projection kept; TR/EN text consistency fixes made.
- The technical draft check does not verify lawyer approval (P3); the guide and plan state this. Details in the P7 audit record of `docs/plan-payments.md`.
- Live DB/3100/.next, P4 files, techContext and the commit are preserved. Migration unchanged; temporary SQLite up/down and NULL/UNIQUE/version tests exist. Gate result below.
- Final gates: `pnpm typecheck` and `pnpm lint` exit 0; `pnpm test --maxWorkers=1`: **84 files / 1397 tests, all passed (314.55 s)**. No broken P4-related tests. `git diff --check` clean. **P7 migration safe for live: YES; P7 scope committable: YES** (no commit made).

## L7a portal devices and e-mail (2026-11-18, not committed)
- Portal `/hesap/lisanslar/[id]` (publicId, 404 for foreign) lists a license's active devices and lets the owner release one (no-JS form, confirmation card, quota from `selfService.portalDeactivationsPer30Days`, one serial transaction). Records: portal `activation.ended` event + `security-audit` row, no status-log row. New customer e-mail "device released" through the L5 queue. No schema change. "New device activated" e-mail and label rename not done (need a setting / out of scope). Details: "L7a implementation record" in `docs/plan-licensing-security.md`.
- The L7 audit bound release receipts to the same owned device, moved the quota read under the writer lock, and checked current ownership in both device summaries and queued notices. Revoked licenses cannot release devices. Suspended and expired licenses can release an existing device without restoring entitlement.

## 2026-11-19 L10 done
- L10 (deployment, security audit fixes F-01..F-09, QA fixes) implemented and verified: typecheck, lint, 1880 tests, isolated e2e 30/30, browser recheck. Record in `docs/plan-licensing-security.md`.
- Remaining: VPS acceptance only (DNS/proxy secret, Caddy/systemd validation, signer provisioning, SECRETS_KEY backup, Linux preflight, p95 < 250 ms; local 718 ms). Optional L11 after that.
