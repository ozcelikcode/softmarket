# ADR L0 — Licensing spike decisions

- **Date:** 2026-11-17
- **Status:** Proposed decision; the open verifications below must be completed in L1–L3 implementation.
- **Context:** `spike/licensing-l0`, `6e9a339`, Node 24.22.2, Payload 3.93.0, Next 15.4.11, SQLite/libsql. The DB was copied from the main DB via SQLite `.backup` to a separate `/private/tmp/.../softmarket-l0.db` file; experiment writes went only to this copy. Measurements are on a single process and single machine. Temporary app and migration code are not product changes.

## 1. Admin custom view and authorization

**Result: Yes, at component level; end-to-end HTTP/browser verification missing.** Temporary view/import map created with `admin.components.views.guvenlik = { path: '/guvenlik', Component: '…#View' }` and `afterNavLinks: ['…#Nav']`. `Nav` returned the link only when `user.collection === 'users' && user.roles.includes('admin')`. `View` performed the same check on the server with `initPageResult.req.user`; redirected others with `redirect('/admin')`. Payload `dist/admin/views/index.d.ts` declares `initPageResult.req: PayloadRequest`; `@payloadcms/next/dist/views/Root/index.js` passes it to the view. Visibility is not an authorization boundary; the check inside the view is mandatory.

**Evidence:** Running the temporary components with React `renderToStaticMarkup` on real role objects: `admin nav=<a href="/admin/guvenlik">L0 Security</a>`, `admin view=<main>L0 security admin only</main>`, `editor nav=` (empty), `editor view redirect=NEXT_REDIRECT;replace;/admin;307;`. `pnpm generate:importmap` generated both components. On the 3520 Next dev server, routes could not be discovered due to Watchpack `EMFILE: too many open files, watch`; requests returned 404. Therefore, real-session HTTP results and **browser verification were not performed**; this test does not substitute for them.

**L1–L3 impact:** No schema needed. In the relevant panel phase, verify nav and direct URL check with a real admin/editor session via Playwright/HTTP; keep the server `req.user` check and also admin panel session/origin checks on the relevant APIs.

## 2. Failed admin login

**Result: Yes: collection `afterError` for REST; `beforeLogin`/`afterLogin` do not run on wrong password.** `beforeOperation('login')` runs before the login attempt but cannot know that the result failed; `afterForgotPassword` is a different operation. `payload/dist/auth/operations/login.js` checks user lookup and `authenticateLocalStrategy` result before `beforeLogin`/`afterLogin`. `handleEndpoints.js` forwards errors to `routeError`; `routeError.js` calls collection `afterError`.

**Evidence:** With temporary `users` hooks, `payload.login` wrong password: `beforeOperation login`, `AuthenticationError`; no `beforeLogin`, `afterLogin`, `afterForgotPassword`, `afterError`. Correct password: `beforeOperation login`, `beforeLogin`, `afterLogin`. `REST_POST(config)` real Payload REST handler with `NextRequest` and `params: {slug:['users','login']}` wrong password: `beforeOperation login`, `afterError AuthenticationError`, HTTP response object `401`. This is not an HTTP test over the network. Local API errors do not go through the `routeError` path; observation covers REST only.

**L1–L3 impact:** The hook point proposed in plan §8 should be clarified as `users.afterError`: filter only the relevant login route/method and explicitly defined error types such as `AuthenticationError`/locked account; never log password, email, or raw body. Also test non-REST Local API/GraphQL and different error types; if scope requires them too, a shared wrapper is needed. It must be tested that failure in counting and event logging does not alter the login response.

## 3. Ed25519 compact JWS

**Result: Yes; adding `jose` is not needed for this scope.** Node `crypto.createPrivateKey({format:'jwk', key})`, `createPublicKey`, `sign(null, input, key)`, `verify(null, input, key, signature)`, and `Buffer` base64url are sufficient. With the [RFC 8037 Appendix A.1, A.4–A.5](https://www.rfc-editor.org/rfc/rfc8037#appendix-A.4) key, protected `{"alg":"EdDSA"}` header, and payload, the signature matched the 64 bytes in the RFC identically.

**Evidence:** `node spike/l0/crypto.mjs` temporary experiment output: `RFC8037 compact signature matches; verify=true; tampered=false`. Signed bytes are ASCII `base64url(header) + '.' + base64url(payload)`; signature is the third part in compact form. The experiment file was not included in product code.

**L2 impact:** Dependency-free implementation is preferred; vector and negative tests must be moved to product tests. Crypto primitive success is not full JWS/JWT security: exact three parts, strict base64url/JSON, EdDSA and Ed25519 only, `kid` selection/revocation, critical headers, size limit, and time/claim checks are defined and tested separately. Key storage and rotation are within current plan scope.

## 4. Serial transaction queue

**Result: Yes; p95 limit exceeded.** Real `withPaymentTransaction` → `payload.db.beginTransaction()` → `serializeTransactions` was used; under `BEGIN IMMEDIATE`, each transaction updated `last_seen` on a sample activation row and inserted an event row. 100 jobs were started concurrently with `Promise.all`; durations were measured with `performance.now()` from call start to commit return, including queue wait. Each succeeded, and `SELECT count(*) FROM l0_events` = 100 in the copy.

**Evidence:** `pnpm exec tsx spike/l0/bench.ts` → `n=100, p50=293.15 ms, p95=559.50 ms, p99=585.01 ms` (nearest-rank on sorted samples). Environment: local machine, single process, cold/single burst, no real network and no full L3 business logic. This is not a capacity guarantee or a VPS benchmark; the 5-second queue timeout and multi-process access are separate risks.

**L3 impact:** **Plan revision required:** coalesce `lastSeenAt` and observational events with bounded batch/debounce; do not tie successful verification to a separate observational write on every call. Keep atomic, durable writes for security-critical decisions such as activation quota, nonce/replay protection, and revocation separate from buffering. Document observations that may be lost on crash, maximum latency, and memory bounds; re-measure on the target VPS with representative load and other writers.

## 5. Raw body and Range streaming

**Result: Yes, at route-handler function level; verification over the network missing.** Temporary Next Node route preserved body bytes with `Buffer.from(await req.arrayBuffer())`; streamed with `createReadStream({start,end})` → `Readable.toWeb`. `Range: bytes=3-7` returned 206 on matching strong `If-Range` ETag; returned full 200 on mismatching ETag.

**Evidence:** Direct `POST(Request)` for `00 ff 0d 0a 41 42 43` → hex `00ff0d0a414243`, SHA-256 `944dcd7d23f81feb7e99bb23066c227011342e529b7c1f61184f2d7a59c65e02`. `GET(Request)` → `If-Range: "l0-v1"`: `206`, `Content-Range: bytes 3-7/16`, body `34567`; `If-Range: "old"`: `200`, full `0123456789abcdef`. 3520 HTTP attempts returned 404 due to the Watchpack error above.

**L3 impact:** Signature is verified on raw bytes, before parsing, and with a size limit during reading. The download implementation must open the stream after authorization; it must define and test strong real ETag/Last-Modified, suffix/open-ended/malformed/unsatisfiable/multiple range, 416, HEAD, abort, and resource cleanup behaviors with HTTP integration tests. This minimal prototype is not a full RFC Range implementation.

## 6. Partial unique index and migration diff

**Result: Yes, preserved for the tested diff; not guaranteed for all future migration types.** On the copy DB, `CREATE UNIQUE INDEX l0_active_idx ON licenses(id) WHERE status='active'` was run manually; `sqlite_master` confirmed the index. `pnpm migrate:create l0_partial_index_test` found no schema diff (interactive empty migration prompt, exit 13 without input). Then with a temporary `licenses.l0MigrationProbe` text field, `pnpm migrate:create l0_partial_index_diff` ran: generated `up` had only `ALTER TABLE licenses ADD l0_migration_probe text`, `down` only `DROP COLUMN`; no `l0_active_idx` or `DROP INDEX`. The index was still visible in the DB. The migration was not applied, and temporary generated files were removed.

**L1 impact:** Manage the partial unique index with explicit `CREATE UNIQUE INDEX ... WHERE ...` in L1 migration SQL and explicit drop in `down`. Diffing against the Drizzle snapshot schema does not carry this live index into the diff; subsequent table rebuilds/index changes can lose the manual index. After every relevant migration, `sqlite_master`/`PRAGMA index_list`, rejection of duplicate active inserts, acceptance of inactive records, and up/down/up checks are mandatory; G1 ordering is preserved. The test covers only the sample index and additive column diff.

## Operational limitation

To stop the server started on 3520, `kill` was attempted only on the PID from `lsof -ti :3520`; sandbox returned `Operation not permitted`. Therefore the process could not be stopped by this session; no other processes were signaled. Reliable HTTP and browser checks remain open.

---

## Browser/HTTP verification (Sonnet)

Date: 2026-11-17. Environment: production build (`NEXT_DIST_DIR=.next-l0 pnpm build && pnpm start`, port 3520; avoids the dev-server Watchpack EMFILE), the copied SQLite DB, real Chromium (Playwright from the repo), real HTTP via curl. The earlier "not verified" gaps in sections 1, 2, 5 and 6 are closed as below. Prototype sources are kept under `spike/l0/` (not product code).

### V1. Admin custom view access model

**Decision: adopt.** Register the view via `admin.components.views` and the nav link via `admin.components.afterNavLinks`. Component paths are relative to `importMap.baseDir` (here `src`), so write `/l0/view#View`, not `/src/l0/view.tsx#View`; the latter generates a broken import (`../../../src/l0/...` resolves to `src/src`).

Evidence (Chromium, real login at `/admin/login`):

| Session | Nav link `a[href="/admin/guvenlik"]` | Direct `/admin/guvenlik` |
|---|---|---|
| anonymous | none | final URL `/admin/login`, login form shown |
| admin | present (1) | view rendered (`L0 security admin only`) |
| editor | none | server `redirect('/admin')`, final URL `/admin`, view not rendered |

Rules for L1-L3: the server-side `initPageResult.req.user` check inside the view is the only boundary; the nav link is cosmetic. Any data the view loads must come from admin-gated endpoints with their own checks. Anonymous access is handled by Payload (login redirect), not by our code. Note the redirect is a 307 inside the RSC flow, so assert on final URL and absence of content, not on an HTTP 403.

### V2. Failed admin login

**Decision: use collection `users.hooks.afterError`; confirmed over real HTTP and via the admin UI.**

- `curl -X POST /api/users/login` with a wrong password returned 401 and `afterError` fired once (`AuthenticationError`, `POST`, `/api/users/login`, collection `users`).
- The admin UI login form (Chromium) posts to the same `/api/users/login`; a wrong password triggered `afterError` again (second log entry). So UI and REST share one path.
- Limits (from section 2, unchanged): `beforeLogin`/`afterLogin` do not run on failure; Local API `payload.login` does not go through `afterError`; GraphQL and non-auth error types were not tested. Hook must filter by route/method and error name, never log password/email/body, and must not throw (a logging failure must not change the 401 response).
- Lockout (`maxLoginAttempts: 5`, `lockTime`) is Payload-native; the hook counts attempts for the security center only.

### V3. Raw body and Range route handler

**Decision: adopt the `req.arrayBuffer()` raw-body pattern and the stream-based Range handler as the base, with the full RFC test matrix in L3.** Real HTTP against the production server (route placed under `src/app/(payload)/api/`, because the next-intl middleware matcher excludes `api` and would otherwise localize the path):

| Case | Result |
|---|---|
| POST body `00 ff 0d 0a 41 42 43` | hex `00ff0d0a414243`, SHA-256 `944dcd7d...9c65e02` identical to `shasum -a 256` of the file: bytes preserved |
| `Range: bytes=0-99` (file 16 bytes) | 206, `Content-Range: bytes 0-15/16`, 16 bytes (end clamped) |
| `Range: bytes=3-7` | 206, `Content-Range: bytes 3-7/16`, `34567` |
| `Range` + `If-Range: "l0-v1"` (match) | 206 |
| `Range` + `If-Range: "old"` (mismatch) | 200, full body |
| `Range: bytes=20-30` | 416, `Content-Range: bytes */16` |
| `Range: bytes=9-3` | 416 (prototype choice; RFC 9110 permits ignoring an invalid range with 200 instead) |

Not covered by the prototype (L3 tests): suffix `bytes=-N`, multiple ranges, HEAD, weak ETag, client abort/stream close.

### V4. Partial unique index vs table rebuild

**Decision: partial unique indexes are NOT protected by Payload/drizzle migrations; manage them manually and guard with tests.** Experiment: copy DB with `CREATE UNIQUE INDEX l0_active_idx ON licenses(id) WHERE status='active'`; temporary change `licenses.seats` to `required: true` (nullable to NOT NULL forces a SQLite table rebuild); `pnpm migrate:create`. Generated `up` does `CREATE TABLE __new_licenses`, copy, `DROP TABLE licenses`, `RENAME`, then recreates only the schema-known indexes (`licenses_key_idx`, `..._customer_idx`, etc.). `l0_active_idx` is silently dropped and never recreated; `down` behaves the same. (Combined with the earlier additive-column diff, which preserved it, the index survives only while the table is not rebuilt.) Temporary migration files and the schema change were removed.

L1 policy:
1. Create the partial index only in a hand-written migration step (`CREATE UNIQUE INDEX ... WHERE ...`), with an explicit drop in `down`.
2. Any later migration that touches a rebuilt table (`__new_<table>` in the generated SQL, or `DROP TABLE <table>`) must re-create the partial index by hand after the rename. Review every generated migration for `__new_` on tables that carry partial indexes.
3. Add a unit/integration test that runs all migrations on a fresh SQLite and asserts the partial index exists in `sqlite_master`, rejects a duplicate active row and accepts inactive duplicates. This test catches silent loss in CI.
4. Prefer app-level enforcement inside the transaction as defense in depth; the index is the backstop.

### V5. Serial transaction queue p95 (repeat)

Same script (`spike/l0/bench.ts`), 100 concurrent `withPaymentTransaction`, each UPDATE + INSERT: `n=100, p50=292.15 ms, p95=550.38 ms, p99=573.41 ms`. Terra's run: p50 293.15, p95 559.50, p99 585.01. Reproducible within about 2 percent. **Decision confirmed:** about 5.5 ms per serialized write; 100 simultaneous writers queue to about 0.55 s and a larger burst approaches the 5 s queue timeout (about 900 writers). L3 must batch/debounce observational writes (`lastSeenAt`, events) and keep security-critical writes (activation, seat, state transition) separate, atomic and synchronous.
