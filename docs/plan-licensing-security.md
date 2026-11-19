# Plan — Program ↔ Site licensing API, automatic/manual revocation, and security center

> Status: **draft plan (2026-11-17)**. Code, schema, or migrations have not changed. Implementation starts with the L0 spike; user approval is expected at the end of each phase.
> Sources: `AGENTS.md`, `memory-bank/*`, `docs/plan-payments.md` (§2.4 license↔order, §4 security, P4 fulfill, P6 refund→`revoked`, dispute→`suspended`), `docs/plan-visual-editor.md` (Permanent rules), `docs/plan-visual-globals.md` (G0–G7 order). Code was read on `main` 1a8969e: `src/collections/{Licenses,Customers,Downloads,Orders,PaymentEvents}.ts`, `src/lib/licenses/*`, `src/access/*`, `src/lib/secrets/crypto.ts`, `src/lib/integrations/vault.ts`, `src/lib/payments/{admin-endpoints,admin-actions,fulfill}.ts`, `src/lib/forms/security.ts`, `src/lib/request-guards.ts`, `src/middleware.ts`, `src/lib/db-serial-transactions.ts`, `deploy/*`, `scripts/deploy.sh`.
> Hosting and subdomain feasibility are in a separate document: `docs/plan-hosting.md`.

## User request

1. "Integration between the program and the site also needs to be done via API." Desktop/server software sold by the company will talk to the licensing system on the site: activation, validation (periodic + offline tolerance), deactivation, seat counting, device binding, update check, licensed download entitlement.
2. "License revocation will be done manually or automatically." Admin manually suspends, revokes, or reactivates. Automatic: refund, chargeback (existing), expiration, rule violation. Automatic decisions are reversible and have an audit trail.
3. "Things like violation reporting, IP violations, or suspicious activities will be gathered on one page." Security center in Admin: events, severity, filters, event → license/customer, one-click action, notifications. KVKK (Turkish Personal Data Protection Law) compliance.
4. "Since this is a critical matter, it must be both well planned and solidly built; security is very important here."
5. "Can subdomain integration be done, on a standard server without a VPS though." → `docs/plan-hosting.md`.

## Permanent rules (apply to every phase; violations reject the phase)

1. **License status changes from a single source.** Every state transition (panel, MCP, payment, rule engine, sweep) writes a `license-status-log` row **in the same transaction** via `recordLicenseTransition()` in `src/lib/licensing/transitions.ts`. Existing paths that change status with raw SQL (`admin-actions.ts` `refundOrder`, `applyDispute`) also call this function. Transitions without a log entry are caught by tests.
2. **The automatic system never writes `revoked`** (except refunds: that is the existing P6 business rule and is logged with the payment source). The rule engine writes at most `suspended`; revocation requires admin approval.
3. **Security collections cannot be written via API.** `security-events`, `security-blocks`, `license-status-log`, `security-audit`, `license-activations`: `create/update/delete = nobody`; writes happen only in server code with `overrideAccess: true`. Reads are admin-only (not editor). None of them enter the MCP allowlist.
4. **Admin actions only via panel session.** `guardAdminSession` pattern (`src/lib/payments/admin-endpoints.ts`): admin role, `_strategy === 'local-jwt'`, no `Authorization` header, same-origin + `Sec-Fetch-Site`. API key/MCP/editor/customer receive 403. Every action writes a `security-audit` row; a reason is mandatory.
5. **Personal data minimization.** Full IP, raw device fingerprint, license key, and e-mail are not written to logs or the event `detail` field. IP is stored only as a truncated prefix (IPv4 /24, IPv6 /48) + keyed HMAC. License keys in logs use `maskLicenseKey`.
6. **The hot path does not overwhelm SQLite.** A validation request performs at most one small UPDATE; events are buffered in memory and batch-written; rejected requests (rate limit/block) do not write per-row to the DB.
7. **Migration rules** (`plan-visual-editor.md` rule 6): DB copy first; up uses only `CREATE TABLE`, `ADD COLUMN`, `CREATE INDEX`, and `UPDATE` backfill on new columns. `DROP`, `DELETE`, `__new_` are forbidden. Down removes only its own tables/columns/indexes and refuses if data exists (P4 pattern). Backup including WAL/SHM before production.
8. **Single schema lane.** `migrate:create` is not run concurrently with `plan-visual-globals.md` G1; one does not start until the other is merged into `main`.
9. 3100, live DB, and `.next` only with an explicit task; build `NEXT_DIST_DIR=.next-<ad>`, QA ports 3200/3300/3400, load test on an isolated copy DB on 3600.
10. Admin labels go into the `src/lib/admin-i18n.ts` dictionary (`tests/unit/admin-labels.test.ts`). Every user-provided setting can be entered from the admin panel; if an env var is defined, the env var wins (integrations pattern).

---

## 1. Decision summary

### 1.1 Architecture

- **Same Next/Payload process, separate API namespace.** Routes `src/app/(payload)/api/v1/licensing/**/route.ts` (same pattern as payment webhooks: Node runtime, `dynamic='force-dynamic'`, matches before Payload catch-all). No separate process: SQLite is a single writer and `db-serial-transactions` is in-process; a second process breaks this guarantee.
- **Separate hostname for programs:** `lisans.<alan-adi>` (recommendation). Caddy passes only the `/api/v1/licensing/*` path on this host to the same process; everything else returns 404. No cookies, no CORS (the desktop client is not a browser). The URL embedded in the program remains independent of the marketing site; if the server moves in the future, programs are unaffected. Details in `docs/plan-hosting.md`.
- **Authentication = license key (once) + device keypair (every request).** On activation, the program generates an Ed25519 keypair on the device (private key in the OS keystore: Windows DPAPI/CNG, macOS Keychain, Linux file 0600/TPM if available). The server binds the public key to the activation. Every subsequent request is signed with this key; the license key is not sent again. A leaked license key is not enough to impersonate an existing device; a new device can only be added by consuming a seat and emits an event.
- **Server-signed lease document.** A successful activation/validation returns a short-lived JWS signed with the server's Ed25519 key. The program verifies this **offline** using embedded public key(s). It renews after `refreshAfter` (default 24 hours); when offline, it continues working until `exp` (default 14 days, configurable upper limit 30 days).
- **Response signature + request nonce binding.** All API responses (including errors) are signed with the server key and include the request's nonce. A MITM breaking TLS with a user-installed fake root certificate cannot forge a "valid" response; old responses cannot be replayed. TLS certificate pinning is not used (Let's Encrypt renewal breaks it); what is pinned is the signing public key.
- **Rotating counter for clone detection.** Each validation response issues a new `ctr`; the program sends it back in the next request. Two machines cloning the same activation will diverge quickly → `activation.clone_suspected`.
- **Graduated rule engine:** observe (event only) → notify → suspend (automatic, reversible) → revoke (admin approval only). Default first 30 days is **observe mode** (Open question 2).
- **Security center** Payload admin custom view `/admin/guvenlik` (admin only; nav link visible only to admin), reads data from admin-only GET endpoints and performs actions via admin-only POST endpoints.

### 1.2 Secret keys

| Secret | Location | Note |
|---|---|---|
| License signing private key (Ed25519, PKCS8) | New secret ID `licensing-signing-ed25519` in the `integrations` vault pattern (AES-256-GCM, `SOFTMARKET_SECRETS_KEY`, AAD `softmarket:integrations:licensing-signing-ed25519`); if env `SOFTMARKET_LICENSE_SIGNING_KEY` is defined, env wins | **Never readable** in the panel; only "Generate / rotate keypair" (two-step confirmation, admin panel session). Even if the panel is compromised, the private key never leaves; an attacker can only rotate it (event + e-mail). |
| Previous public keys | `licensing-settings.signingKeys[]` (kid, publicKey, createdAt, retiredAt) | On rotation, the old kid stays "verify-only" for 90 days; programs embed multiple kids. |
| HMAC pepper | HKDF from `SOFTMARKET_SECRETS_KEY`: `info = "licensing/fp/v1"` (fingerprint), `"licensing/ip/<YYYY-MM>"` (IP, rotates monthly), `"licensing/dl/v1"` (download link) | No new env var. The IP hash key rotates monthly: IP hashes older than 1 month cannot be linked together (strengthens pseudonymization). |

Loss of `SOFTMARKET_SECRETS_KEY` = loss of signing key and pepper → all devices require re-activation. The backup procedure is documented in the operations doc (L10).

### 1.3 Out of scope (v1)

- Floating (concurrent) seats; seat = active device (Open question 3).
- Air-gapped file-based activation (Open question 1; L11 if requested).
- Maintenance/update entitlement period (`maintenanceUntil`); in v1, update entitlement = valid license.
- Admin 2FA (Open question 6; v1 recommendation is `/admin` IP restriction via Caddy/Cloudflare).
- Technical prevention of client tampering: the server cannot block a patched program (see §2 residual risk).

---

## 2. Threat model (STRIDE)

Assets: license key, device private key, server signing key, `SOFTMARKET_SECRETS_KEY`, admin session/API key, customer personal data (IP, device name), SQLite write capacity, revenue (piracy).

| # | Threat | STRIDE | Scenario | Mitigation | Residual risk |
|---|---|---|---|---|---|
| T1 | Key sharing/piracy | S, E | Customer shares key on a forum | Seat limit (atomic count), every new device emits an event; IP prefix spread, activation churn, rebind rules; auto-suspend; admin revoke; on revocation all activations become `revoked` | First N devices work until seats are full; offline operation during lease duration (≤14 days) |
| T2 | Activation clone | S | Disk image of an activated machine is cloned (device key + fingerprint identical) | Rotating counter `ctr` → divergence; simultaneous different IP prefixes from the same activation; `clone_suspected` | Detection is delayed if one is always offline |
| T3 | Client tampering | T, E | Program is patched, check bypassed; embedded public key replaced | Server-side entitlement check: updates and licensed downloads only with a valid signed request; distribute/obfuscate in-app checks (client guide) | **Cannot be prevented**; only increases cost. Accepted risk |
| T4 | Replay | S, T | Captured `validate`/`deactivate` request is resent | Signed `SM-Timestamp` (±300 s) + `SM-Nonce`; in-memory nonce cache on read endpoints (TTL 600 s); on state-changing endpoints nonce is unique in DB (relevant `license-activations` row / `security-audit.nonce`); response signature includes request nonce | If process restarts, read nonce cache clears; replaying a read endpoint only produces a new lease bound to the same device (harmless) |
| T5 | MITM | I, T | Corporate proxy or user root certificate breaks TLS, injects "valid" response | Response signature (Ed25519, embedded kid list), nonce binding; HSTS enabled | If program public key is replaced, reduces to T3 |
| T6 | API key leak | I, E | Shared "vendor API key" embedded in the program | **No shared client secret.** Identity is device key + license key. If admin MCP key leaks: MCP cannot change `licenses.status` (new field access denial), new collections are not in MCP; creating a license via MCP emits `license.created_via_mcp` info event | License creation via MCP remains open (existing workflow) |
| T7 | Brute force | S | Random key guessing | Key is 122.7 bits; invalid key counter per IP prefix → timed automatic IP block (1 h → 24 h, graduated); no response differentiation (`invalid_license` single code) | Distributed botnet bypasses the block, but entropy makes it practically impossible |
| T8 | DoS / SQLite write lock | D | Heavy requests fill the write queue (`write queue timeout` 5 s) | In-app token bucket (IP prefix, license, activation, global); body ≤ 8 KB; signature verification before DB; validate ~1 UPDATE/device/day; event buffer 10 s batch write, drop above 500 keys + counter; blocklist in memory; optional Cloudflare WAF rule | Volumetric L3/L4 attack is outside the app (Cloudflare/VPS provider) |
| T9 | Admin account compromise | E | Phishing, session hijacking → mass revocation or signing key rotation | `maxLoginAttempts` 5 (existing); admin login from new IP prefix emits event + e-mail; key rotation and bulk actions require two-step confirmation + e-mail; private key unreadable; `/admin` IP restriction recommended; audit trail | No 2FA (Open question 6) |
| T10 | False positive → legitimate customer locked out | D | Corporate VPN/NAT triggers IP spread rule | Observe mode; even when suspended, existing lease works until `exp`; suspension e-mail includes support link; one-click restore (restores previous status from log) + 30-day suppression for the rule; global circuit breaker (at most N auto-suspends per hour, if exceeded rule engine drops to observe + critical event) | Rules ship with intentionally lenient defaults |
| T11 | KVKK violation | I | Excessive retention of IP/device data, cross-border transfer | Minimization (§6), retention periods + cleanup job, privacy notice + EULA update, not in MCP (no transfer to LLM providers), no PII in logs | Requires lawyer approval (P7 `legalReview` pattern) |
| T12 | Server signing key leak | S, E | Server is compromised, attacker mints unlimited valid leases | Vault encrypted; env alternative 0600; rotation + adding old kid to **revocation list** (`revokedKids` in `/keys` response); new kid via program update | After rotation, offline programs accept old leases until `exp` |
| T13 | Information disclosure (enumeration) | I | Error codes reveal key existence/customer | Missing key / product mismatch / unverified customer = same `invalid_license` 401; status details (`license_suspended` etc.) only after key ownership is proven; no customer name/e-mail in responses | — |
| T14 | Seat-swap abuse via portal | E | Customer deactivates device daily and transfers to another machine (floating license) | Self-service deactivation quota (default 3 in 30 days, configurable) + `activation.churn` rule | — |
| T15 | Licensed download link sharing | I | Signed URL shared on a forum | TTL 5 min, HMAC bound to activation and download ID, IP prefix logged, at most 5 uses per token (for Range resume), event | Sharing within TTL |

---

## 3. API contract (`/api/v1/licensing`)

### 3.1 General

- Base: `https://lisans.<alan-adi>/api/v1/licensing` (the same path also works on the main domain; programs use the subdomain).
- Only `POST` (uniform signing across endpoints) and `GET /keys`. `Content-Type: application/json`, body ≤ 8 KB (bounded read via `req.text()`, then zod strict parse; unknown fields return 400).
- All responses: `Cache-Control: no-store`, `X-Robots-Tag: noindex`, `Date`, `SM-Key-Id`, `SM-Response-Signature`. No CORS headers.
- Time: Unix seconds. Clock skew ±300 s (configurable 60–900). On a skew error, the response includes `serverTime`; the program adjusts the request timestamp (not its system clock) and retries.
- Versioning: breaking changes use `/api/v2`; v1 is supported for at least 24 months. Adding fields to responses is non-breaking (the program ignores unknown fields).

### 3.2 Request signature (device key)

Headers: `SM-Activation` (`act_…`; `-` on activation), `SM-Timestamp`, `SM-Nonce` (16 random bytes, base64url), `SM-Signature` (Ed25519, 64 bytes, base64url).

Canonical string (UTF-8, `\n` separator, no trailing `\n`):

```text
SM1-REQ
<METHOD>
<path, without query string, e.g. /api/v1/licensing/validate>
<SM-Timestamp>
<SM-Nonce>
<SM-Activation>
<lowercase hex SHA-256(raw body bytes)>
```

In `/activate`, the signature is verified against `devicePublicKey` in the body (proof of possession); on other endpoints, against the public key registered on the activation. Server verification order: size → header format → clock → blocklist (in-memory) → rate limit (in-memory) → signature → nonce → DB.

### 3.3 Response signature

`SM-Response-Signature` = Ed25519(server, canonical):

```text
SM1-RES
<HTTP status>
<request SM-Nonce; - if absent>
<lowercase hex SHA-256(response body)>
```

Program: `SM-Key-Id` must be in the embedded kid list and not in `revokedKids`; the nonce must match what it sent; otherwise the response is ignored (treated like a network error).

### 3.4 Lease document (compact JWS)

Header `{ "alg": "EdDSA", "kid": "<kid>", "typ": "sm-lease+jwt" }`. Payload:

| Field | Meaning |
|---|---|
| `iss` | `https://lisans.<alan-adi>` |
| `aud` | product's `licensingCode` value (e.g., `studio-pro`) |
| `sub` | `act_<activationPublicId>` |
| `lid` | `lic_<licensePublicId>` (sequential DB id is not exposed) |
| `sku`, `seats` | edition SKU, license seat limit |
| `fp` | fingerprint value sent by the program (hash computed by the program itself) |
| `dkt` | SHA-256 thumbprint of the device public key (base64url) |
| `iat`, `nbf`, `exp` | `exp` = `iat + leaseDays` (end of offline tolerance); if license `expiresAt` is earlier, `exp` is clamped to it |
| `rfa` | `refreshAfter` = `iat + refreshHours` |
| `lexp` | license expiry (ISO) or `null` (perpetual) |
| `ctr` | rotating counter (to be sent back by the program in the next request) |
| `st` | `active` (leases are only issued for valid licenses) |
| `v` | `1` |

### 3.5 Endpoints

| Endpoint | Body (zod strict) | Success | Notes |
|---|---|---|---|
| `GET /keys` | — | `{ keys: [{kid, alg:"EdDSA", x}], revokedKids: [] }` | Public, `Cache-Control: public, max-age=3600`; for diagnostics, not for the program to update its kid list (trust comes from the embedded list). |
| `POST /activate` | `licenseKey`, `productCode`, `fingerprint` (base64url 32 bytes), `devicePublicKey` (base64url 32 bytes), `deviceLabel?` (≤64, no control chars), `platform` (`windows|macos|linux|other`), `arch?`, `appVersion` (semver ≤32) | 200 `{ activationId, lease, refreshAfter, serverTime }` | Single transaction: find license (normalized key), product match, `isLicenseValid`, block check, **if same (license, fpHash) is active**: same public key → idempotent same activation; different public key → rebind (old row `deactivated/rebind`, no seat consumed, quota: 3 in 30 days); otherwise seat count `count(active) < maxDevices ?? seats` → new row. If seats are full, 409 `seat_limit` + `{ used, max }` and event. |
| `POST /validate` | `ctr`, `fingerprint`, `appVersion` | 200 `{ lease, refreshAfter, serverTime }` | Activation `active` + license valid + fp matches → new lease; `lastSeenAt`/IP/`ctr` UPDATE only if ≥ `seenWriteMinutes` (default 60) elapsed since last write **or** `ctr` changed (every successful validate issues a new `ctr` → in practice 1 UPDATE/request, requests ~1/device/day). `ctr` = current or previous → accepted; older → accepted but emits `clone_suspected` event (low; high if repeated). |
| `POST /deactivate` | `reason?` (`user|uninstall|transfer`) | 200 `{ deactivated: true }` | Frees the seat; same nonce a second time returns 200 and same result (idempotent). |
| `POST /updates` | `channel` (`stable|beta|lts`), `currentVersion`, `os`, `arch?` | 200 `{ latest: { version, releaseDate, channel, notesUrl, mandatory:false, downloads:[{id, os, arch, size, sha256?}] } \| null }` | `releases` product + channel, `releaseDate ≤ now`, highest semver. `downloads` only this product's `access` public or licensed records (valid license is already proven for licensed). |
| `POST /downloads/link` | `downloadId` | 200 `{ url, expiresAt }` | `url` = `/api/v1/licensing/dl/<token>`; token = `base64url(payload).base64url(HMAC)`; payload `{ d: downloadId, a: activationId, e: exp(+300 s), n: random }`. |
| `GET /dl/<token>` | — | 200/206 file stream | HMAC + exp + activation still active + download product = license product; streams `media` file with safe path resolution (only inside `UPLOADS_DIR`, no symlinks), supports `Range`, `Content-Disposition: attachment`, `Cache-Control: private, no-store`. At most 5 uses per token (in-memory counter). This endpoint is unsigned (download managers cannot add headers); its security is the token itself. |

### 3.6 Error contract

Body: `{ "error": { "code": "<code>", "retryAfter"?: <s> }, "serverTime": <unix> }`. No message text; the program displays its own localized text.

| HTTP | Code | When | Information disclosure rule |
|---|---|---|---|
| 400 | `bad_request` | Format/schema/size | Does not reveal which field is invalid |
| 400 | `clock_skew` | Outside clock window | Returns `serverTime` |
| 401 | `invalid_signature` | Signature/nonce/activation not found | Does not distinguish whether activation exists |
| 401 | `invalid_license` | Key missing, product mismatch | Single code |
| 403 | `license_suspended` / `license_revoked` / `license_expired` / `license_not_started` | Key ownership proven | — |
| 403 | `activation_revoked` | Admin/customer removed this device | — |
| 403 | `blocked` | Blocklist | Does not reveal what is blocked |
| 409 | `seat_limit` | Seats full | Returns `used`/`max` (useful for owner) |
| 409 | `rebind_limit` | Rebind quota reached | — |
| 429 | `rate_limited` | Limit | `Retry-After` |
| 503 | `unavailable` | API disabled (`licensing-settings.apiEnabled=false`) or no signing key | Program switches to offline tolerance mode |
| 500 | `internal` | — | No details |

Rule: including any response whose signature cannot be verified, the program **never persists any error as "license invalid"**; only a signed 403 `license_*`/`activation_revoked` deletes the local lease.

### 3.7 Rate limits (defaults from `licensing-settings`)

| Key | Endpoint | Default | On exceed |
|---|---|---|---|
| IP prefix | all endpoints | 60/min | 429 + aggregate event `api.rate_limited` |
| IP prefix | `invalid_license` | 10/hour | automatic timed IP prefix block 1 h; 24 h on repeat within 24 h (`security-blocks`, source `rule`) |
| License | `activate` | 10/day | 429 + `activation.burst` |
| Activation | `validate`/`updates`/`downloads/link` | 30/hour | 429 |
| Activation | `invalid_signature` | 5/hour | event `api.bad_signature` (high) |
| Global | all | 200/s | 503 + critical event (process protection) |

Implementation: `src/lib/licensing/rate-limit.ts`, token-bucket version of the `createRateLimiter` pattern (bounded Map, `globalThis` singleton). IP source `requestIP()` (Caddy-authenticated header); if `unknown`, all requests fall into a shared bucket (fail-closed, existing rule). Because it is in-memory, the **single-process assumption** is mandatory (see `docs/plan-hosting.md`).

### 3.8 Example client flow

```text
Install/first launch:
  1. Generate Ed25519 keypair on device, store in OS keystore.
  2. fp = base64url(SHA-256("sm-fp-v1|" + productCode + "|" + stable hardware IDs)) — raw serial numbers are never sent.
  3. POST /activate (signed). 200 → securely store lease + activationId.
On every launch (offline):
  4. Lease signature (embedded kid), aud == productCode, fp == local fp, dkt == local public key, now < exp.
  5. If valid, run; if now > rfa, run step 6 in the background.
Background:
  6. POST /validate { ctr } → new lease. No network/503/unsigned response → continue with old lease, exponential backoff.
  7. Signed 403 license_* → delete lease, return to license screen.
Uninstall:
  8. POST /deactivate; if it fails, tell the user "remove the device from the portal".
```

`curl` and signature generation examples, step-by-step description of the verification algorithm, and **test vectors** (fixed keypair, fixed nonce/timestamp → expected signature) are written in L9 into `docs/licensing/client-integration.md`; reference verifier examples in TypeScript (Node `crypto`) + C# (.NET `System.Security.Cryptography`, with NSec/BouncyCastle note if Ed25519 is unavailable).

---

## 4. Data model

All in `group: 'Güvenlik'` (Security; TR/EN in admin-i18n), `admin.hidden` for editor only (custom view is used, list views remain open to admin).

### 4.1 `licenses` additions (ADD COLUMN)

| Field | Type | Note |
|---|---|---|
| `publicId` | text, unique, readOnly | Backfill uses 12 random bytes in hex and retries collisions before creating the unique index. `prepareLicense` generates IDs for new licenses. |
| `maxDevices` | number, min 1 | Empty = `seats` |
| `statusReason` | select (`manual`, `payment_refund`, `payment_dispute`, `rule_*`, `expiry`, `restore`) | Reason for the latest transition (summary of the log) |
| `statusChangedAt` | date | |
| `statusSource` | select (`admin`, `mcp`, `payment`, `rule`, `system`, `import`) | |
| `activations` | join → `license-activations.license` | No schema column |

`status` field: MCP (`_strategy === 'api-key'`) cannot write it (field access; existing commerce pattern). The field stays in the panel, but direct changes are caught in the `beforeChange` hook; if the reason field (`statusNote`, not virtual — `ui` + hook `req.context`) is missing, it returns 400 with a warning to use the `Lisans işlemleri` (License actions) panel. The recommended path is the action buttons in the side panel.

### 4.2 `products` additions

| Field | Type | Note |
|---|---|---|
| `licensing.enabled` | checkbox, default false | API only on enabled products |
| `licensing.code` | text, unique, `^[a-z0-9][a-z0-9-]{2,40}$` | `aud` in the lease; immutable once set (hook) — embedded in programs |

### 4.3 `license-activations` (new)

| Field | Type | Note |
|---|---|---|
| `publicId` | text unique | `act_` prefix in API |
| `license` | rel licenses, index | |
| `customer`, `product` | rel, index | Denormalized (queries and portal) |
| `status` | select `active|deactivated|revoked`, index | |
| `endReason` | select `user|admin|customer_portal|rebind|license_revoked|rule` | |
| `devicePublicKey` | text (base64url 32 B) | |
| `deviceKeyThumbprint` | text, index | |
| `fingerprintHash` | text (HMAC-SHA256 hex), index | Raw fp is not stored |
| `deviceLabel` | text ≤64 | Customer can rename in portal; if empty, "Device 1" |
| `platform`, `arch`, `appVersion` | select/text | |
| `counter` | text (16 B base64url) | Last issued `ctr`; previous value `prevCounter` |
| `activatedAt`, `lastSeenAt`, `endedAt` | date | |
| `lastIpPrefix` | text | `203.0.113.0/24`; NULL after 90 days / 90 days after ending |
| `lastIpHash` | text | Monthly key; same cleanup |
| `lastCountry` | text(2) | Only if country source is enabled (Open question 4) |
| `endNonce` | text | Deactivation idempotency |

Additional SQL in migration (`CREATE INDEX`, compliant with rule 7): `CREATE UNIQUE INDEX license_activations_one_active_fp ON license_activations(license_id, fingerprint_hash) WHERE status = 'active'` and `… _thumb ON (device_key_thumbprint) WHERE status='active'`. Seat counting is still inside the serial transaction; the index is the last line of defense.

### 4.4 `security-events` (new, append-only + server-side triage)

| Field | Type | Note |
|---|---|---|
| `type` | select (§5.1 catalog), index | |
| `severity` | select `info|low|medium|high|critical`, index | |
| `source` | select `api|portal|admin|webhook|system|rule` | |
| `firstSeenAt`, `lastSeenAt` | date, index | |
| `count` | number | Aggregation: same `dedupeKey` |
| `dedupeKey` | text unique | `type|subject|time bucket (e.g. 1 h)` |
| `license`, `customer`, `activation`, `order`, `actorUser` | rel, index | Event → related record link |
| `ipPrefix`, `ipHash`, `country` | text | NULL after 30 days |
| `detail` | json | Zod-validated, allowlisted keys per event type; no PII |
| `ruleKey` | text | Triggering rule |
| `actionTaken` | select `none|notified|throttled|blocked|suspended` | Automatic action |
| `triage` | select `open|acknowledged|resolved|false_positive`, index | Only admin endpoints modify this |
| `triagedBy`, `triagedAt`, `triageNote` | | Every change is also written to `security-audit` |
| `notifyState`, `notifyAttempts`, `notifyNextAt`, `notifyLastError` | | Durable notification queue (P4 `orders.notifications` lease pattern) |

Access: read admin; create/update/delete nobody. Panel list view is read-only (PaymentEvents `readOnly` pattern).

### 4.5 `security-blocks` (blocklist)

`kind` (`ip_prefix|cidr|activation|license|fingerprint`), `value` (prefix/CIDR text or record id/hash; for IP only prefix, no full IP), `scope` (`api|portal|all`), `active` (index), `expiresAt` (empty = permanent, admin only), `source` (`admin|rule`), `reason`, `event` (rel), `createdBy`, `liftedAt`, `liftedBy`, `liftReason`. In-memory cache 30 s + immediate on in-process write. Admin can add a CIDR block containing their own IP with two-step confirmation (warning). Access: read admin; writes only via endpoints.

### 4.6 `license-status-log` (status transition log)

`license` (index), `from`, `to`, `reason` (statusReason values), `source` (`admin|mcp|payment|rule|system|import|customer`), `actorUser`, `order`, `event`, `ruleKey`, `note` (≤500, PII warning), `at` (index), `revertOf` (self rel; which transition the restore reverted), `revertible` (bool). Append-only; update/delete nobody. Retention: license lifetime + 10 years (commercial record; contains no IP).

### 4.7 `security-audit` (admin and system actions)

`action` (`license.suspend|revoke|reactivate|restore`, `activation.deactivate`, `block.add|lift`, `event.triage`, `settings.update`, `signing_key.rotate`, `bulk.*`), `actorUser`, `actorKind` (`admin|system|rule`), `target` (polymorphic rel: licenses, license-activations, security-blocks, security-events), `reason`, `note`, `at`, `ipPrefix` (admin), `result` (`ok|denied|error`). Retention 2 years.

### 4.8 `licensing-settings` (new global, unversioned, admin-only, no MCP)

Tabs: **General** (`apiEnabled`, `publicHost` (e.g., `lisans.alanadi.com`), `refreshHours` 24, `leaseDays` 14 (≤30), `clockSkewSeconds` 300, `seenWriteMinutes` 60), **Limits** (§3.7 table), **Rules** (each rule: `mode` `off|observe|notify|suspend`, thresholds, window, suppression days; `observeUntil` date; circuit breaker `maxAutoSuspendsPerHour` 5), **Self-service** (portal deactivation quota, rebind quota), **Notifications** (`alertEmails[]`, `minSeverityImmediate` `high`, `dailyDigest` bool + hour, customer suspension e-mail bool), **Retention** (§6 periods, lower bounds are code constants), **Signing keys** (`signingKeys[]` read-only + "generate/rotate" button → endpoint), **Country source** (`none|cloudflare_header`; Open question 4). Changes write `security-audit` `settings.update` (summary of old/new values).

### 4.9 Migration plan

Single migration `licensing_core` (L1): 5 CREATE TABLE (+ Payload relation/locale tables), `licenses` 5 ADD COLUMN + backfill, `products` 2 ADD COLUMN, global table, 2 partial UNIQUE INDEXes. Down: refuses if data exists (`license_activations`/`security_events` rows); otherwise removes only its own objects. Copy DB → `pnpm migrate` → `content:import --dry-run` → `starter-template-db` → integrity/FK → migration up/down/up test.

---

## 5. Events, rule engine, automatic/manual revocation

### 5.1 Event catalog (`src/lib/licensing/events/catalog.ts`, single source)

| Type | Default severity | Source |
|---|---|---|
| `activation.created` / `activation.rebind` / `activation.ended` | info | api/portal/admin |
| `activation.seat_limit` | low | api |
| `activation.burst` (many activations per license in a short time) | medium | rule |
| `activation.churn` (activation/deactivation cycle) | medium | rule |
| `activation.clone_suspected` | low → high (repeat) | api/rule |
| `license.ip_spread` (distinct IP prefixes in 24 h > N) | medium | rule |
| `license.geo_spread` / `license.impossible_travel` | medium/high | rule (if country source enabled) |
| `license.status_changed` | info (revocation: medium) | all |
| `license.expired` (once) | info | sweep |
| `license.created_via_mcp` | info | admin |
| `api.invalid_license` (aggregate) | low → high (threshold) | api |
| `api.bad_signature` / `api.replay` / `api.clock_skew` (aggregate) | medium/high/info | api |
| `api.rate_limited` (aggregate) | low | api |
| `api.blocked_request` (aggregate) | info | api |
| `auth.admin_login_failed` / `auth.admin_locked` / `auth.admin_new_network` | medium/high/high | admin |
| `auth.portal_login_failed` (aggregate) / `auth.portal_locked` | low/medium | portal |
| `webhook.bad_signature` (existing `payment-events` rejection) | high | webhook |
| `system.rule_circuit_open` / `system.signing_key_rotated` / `system.events_dropped` | critical/high/high | system |

### 5.2 Event writer

`src/lib/licensing/events/writer.ts`: `emit(event)` is synchronous, puts into memory; every 10 s (and at 200 entries) in a single transaction runs `INSERT … ON CONFLICT(dedupe_key) DO UPDATE SET count = count + excluded.count, last_seen_at = …`. If the buffer exceeds 500 distinct keys, new keys are dropped and the `system.events_dropped` counter increments. `high`/`critical` events are also written immediately (so notifications are not delayed). Final flush on process shutdown (SIGTERM). The rule engine reads `license-activations` alongside this table as input.

### 5.3 Rule engine

- Synchronous rules (on request): seat limit (reject, not suspend), rebind quota, blocklist, rate limit.
- Asynchronous rules (`pnpm licensing:sweep`, 5 min timer): `ip_spread`, `geo_spread`, `impossible_travel`, `activation.burst`, `activation.churn`, `clone_suspected` repeat, `invalid_license` → IP block, expiry log, retention cleanup, notification queue.
- Rule result → according to `mode`: `observe` (event only), `notify` (event + admin e-mail), `suspend` (event + automatic suspension + admin and customer e-mail). `suspend` conditions: license `active`, no suppression for the same rule in the last 30 days, no payment-sourced suspension, global circuit breaker closed, `observeUntil` elapsed.
- **Automatic suspension = no new leases + no new activations on API**; existing leases continue until `exp`, portal and licensed web downloads close (existing `validLicenseWhere` already requires `active`).
- **Restore:** "False positive — restore" on the event or license panel: if the latest `license-status-log` row is this rule's suspension, reverts to the `from` value (`reason: restore`, `revertOf`), event becomes `false_positive`, 30-day suppression for rule + license, "re-enabled" e-mail to customer. If another transition (payment, admin) occurred in between, restore is rejected (409) and admin handles it manually.
- **Revocation:** admin only, reason mandatory, two-step confirmation; all active activations become `revoked` (`endReason: license_revoked`).
- **Expiration:** no status is written (date is the single source of truth; `isLicenseValid` already enforces expiration). Sweep produces one `license.expired` event (dedupe: license + `expiresAt`) + informational e-mail to customer (optional); since status does not change, no `license-status-log` row is written. `exp` in the lease is already clamped to license expiry. Renewal automatically restores via admin extending `expiresAt`.
- **Payment integration:** after the raw SQL of `refundOrder` and `applyDispute`, inside the same `tx`, call `recordLicenseTransitions(tx, ids, …, source:'payment', order)` + affected activations (`refund` → `revoked`; dispute → unchanged, suspension takes effect on API). If the dispute is won, admin uses "Lift suspension" (`restore`); Stripe `charge.dispute.closed` automation is separate work (evaluated in L5, consult P6 code owner).

### 5.4 Admin action endpoints (all `guardAdminSession` + body `{ reason, note?, confirm? }` ≤ 2 KB)

`POST /api/licenses/:id/{suspend,revoke,reactivate,restore}`, `POST /api/license-activations/:id/deactivate`, `POST /api/security-events/:id/{acknowledge,resolve,false-positive}` (`false-positive` optional `restore: true`), `POST /api/security-events/:id/block` (timed block for IP prefix/activation/license in the event), `POST /api/security-blocks` + `/:id/lift`, `POST /api/globals/licensing-settings/rotate-signing-key` (`confirm` = `"DÖNDÜR"` text), `GET /api/security/summary|events|blocks|audit|risky-licenses` (admin, panel session, paginated, `no-store`). No bulk actions in v1 (one by one; risk reduction).

---

## 6. KVKK, observability, retention

- **Collected data:** device label (customer-controlled), platform/version, fingerprint HMAC, device public key, IP prefix + monthly keyed IP HMAC, (optional) country code, timestamps. Raw hardware ID, MAC, username, and full IP are **not collected/stored**.
- **Legal basis (draft, pending lawyer approval):** performance of a contract (license validation) + legitimate interest (fraud/piracy prevention). Privacy notice (`content/legal/{tr,en}/kvkk.md`, `gizlilik.md`) and "activation and verification data" section in EULA; P7 `legalReview` approval. Remind the user to update the VERBIS registration.
- **Retention (default; admin can increase/decrease; code lower bound in parentheses):**
  - `security-events` raw IP fields 30 days (7) → NULL; event row 180 days (30) → deleted.
  - `license-activations` IP fields: last 90 days while active; NULL 90 days after ending; row (without IP) license lifetime + 2 years.
  - `security-blocks` expired + 90 days → deleted.
  - `license-status-log` license lifetime + 10 years; `security-audit` 2 years.
  - Cleanup inside `licensing:sweep`, once nightly, batches of 1,000, each batch a separate short transaction.
- **Logs:** only codes and short IDs (`act_…` last 6, `lid` last 6, masked key). Full IP, e-mail, fingerprint, and body are not logged. Test: regex scan with log capture.
- **Customer rights:** device list and deactivation in portal; on a deletion request, activation IP fields are immediately NULLed and activation rows are anonymized (customer link remains via license, license is not deleted — commercial record).
- **Observability:** Security center summary cards (last 24 h events/severity, open high events, active blocks, auto-suspends count, API request/rejection rate — in-memory counters, per process), `GET /api/security/summary`.

---

## 7. Security center (admin custom view)

- Location: `admin.components.views.securityCenter` → `/admin/guvenlik`; nav: `afterNavLinks` component renders only if `isAdminUser`. The view also verifies the role server-side (editor via direct URL gets 403/redirect).
- Files: `src/admin/security/{SecurityCenterView.tsx, Summary.tsx, EventsTable.tsx, EventDrawer.tsx, BlocksTable.tsx, AuditTable.tsx, RiskyLicenses.tsx, actions.ts}`; styling uses existing admin tokens; no dependencies added.
- **Tabs:** Overview · Events · Risky licenses · Blocks · Audit trail · Settings (→ `licensing-settings`).
- **Events filter:** type, severity (multi), triage, date range, source, license/customer search (id/last group of masked key/exact e-mail match — server-side). Pagination 50, default sort `lastSeenAt desc`, default filter `triage=open`.
- **Event drawer:** detail (allowlist fields), links (license, customer, activation, order — Payload document links), timeline (last 20 events of same license + status-log), actions: Acknowledge · Resolve · False positive (+restore) · Suspend license · Revoke license (two-step) · Remove device · Block IP prefix/activation (duration choice 1 h/24 h/7 days/permanent). Every action requires a reason.
- **License document view:** side panel `Lisans işlemleri` (License actions; P6 `Sipariş işlemleri` pattern): status badge + reason, Suspend/Revoke/Reactivate/Restore, activation list (device label, platform, last seen, IP prefix, remove), last 10 status-log rows.
- **Notifications:** `high`+ immediate e-mail (`alertEmails`, fallback `PAYMENTS_ALERT_EMAIL` → site-settings contact), daily digest (optional), open high event count badge in nav. E-mail content is PII-free: type, severity, masked ID, panel link. Queue is at-least-once delivery (P4 note: duplicate possible on interruption between SMTP and mark).

---

## 8. Integration with existing system

| Area | Change |
|---|---|
| P4 fulfill | Unchanged; new license receives `publicId`; `license.status_changed` not needed (create). |
| P6 refund/dispute | Log + activation `revoked` (refund) in same tx as `admin-actions.ts` raw SQL. Regression `payments-p6*.test.ts` must stay green. |
| Customer portal | `/hesap/lisanslar` (EN `licenses`): device list per license (label, platform, last seen at day granularity, IP not shown), "Remove this device" (server action, `forbiddenActionOrigin` + per-customer limit + quota), label renaming. On suspended license, reason text (generic) + support ticket link. |
| Downloads | Web download unchanged (`downloadsRead`/`mediaRead`). API path is separate (`/dl/<token>`), streams the same file. |
| E-mail | New templates: customer suspended/restored/revoked/new device added (optional) — `src/lib/email/licensing-*.ts`, `softmarketEmailAdapter`. |
| MCP | `src/lib/mcp.ts` allowlist: new collections/global **not added**; `licenses` create/find/update remains, `status` field cannot be written with API key (field access) → `mcp.test.ts` locks this. Note in AGENTS.md MCP section. |
| Payment webhook routes | `emit('webhook.bad_signature')` (aggregate) on signature rejection; response unchanged. |
| Login | Admin: `users` `hooks.afterLogin` (new network prefix → event); for failed login, Payload 3.93 hook point verified in L0 (`afterError`/`beforeOperation('login')`). Portal: `emit` in `src/lib/portal/actions.ts` existing login flow. |
| Content import / starter | New fields optional; seed unchanged, `schema.json` regenerated; `products.licensing` not in seed. |
| Caddy / deploy | `deploy/Caddyfile` subdomain block; `deploy/licensing-sweep.{service,timer}`; no new variable in `.env.example` (optional `SOFTMARKET_LICENSE_SIGNING_KEY`). |

---

## 9. Phases

Total estimate: **24–30 business days** (excluding L11). Schema only in L1. Cross-QA + user approval at the end of each phase.

### L0 — Spike and ADR (1 day, schema-free, disposable branch)

- **Scope:** (1) Payload 3.93 admin custom view + `afterNavLinks` role filter + server-side role check inside view; (2) hook point for failed admin login; (3) Ed25519 JWS with Node 24 `crypto` (zero dependencies) — whether `jose` is needed; (4) latency measurement of 100 concurrent "validate-like" tx (serial queue) on copy DB; (5) raw body + `Range` file streaming in Next 15 route handler; (6) partial unique index coexisting with Drizzle/Payload migrations.
- **Output:** `docs/licensing/adr-l0.md` (yes/no + proof command + impact on plan).
- **Acceptance:** proof for all 6 items; if p95 > 250 ms in (4), L3 design (write coalescing) is revised.

### L1 — Schema (2–2.5 days, **has schema**)

- **Scope:** §4.1–4.8 collections/global/fields, `src/access` helpers (`nobody` exists), admin-i18n, `generate:types`, `generate:importmap`, migration `licensing_core` (§4.9), `prepareLicense` `publicId`, `products.licensing.code` immutability hook, `licenses.status` MCP field access, `recordLicenseTransition()` skeleton + `Licenses.beforeChange` logging hook.
- **Acceptance:** REST/GraphQL read-write to new collections with anonymous/customer/editor/API key returns 401/403; admin can read, write returns 403; migration up/down/up on copy, row diff 0, integrity/FK ok, no forbidden statements in SQL; seed + starter import idempotent; status change from panel writes log row; MCP `status` write is rejected.
- **Tests:** `tests/unit/licensing-access.test.ts`, `licensing-migration.test.ts`, `licensing-transitions-db.test.ts`, `mcp.test.ts` expansion, `admin-labels.test.ts` green.
- **Risks:** migration collision with G1 (rule 8); partial index counted as a "diff" in Payload's next `migrate:create` diff (L0 item 6).

### L2 — Crypto and lease core (2 days, schema-free) — **critical**

- **Scope:** `src/lib/licensing/crypto/{keys.ts, jws.ts, canonical.ts, hmac.ts, ip.ts}` (pure, `server-only`); vault secret ID `licensing-signing-ed25519` + env precedence; `pnpm licensing:keygen` (setup only; writes to vault, outputs only kid + public key); rotation function; `GET /keys`.
- **Acceptance:** test vectors fixed (RFC 8032 + our own canonical strings); malformed signature, wrong kid, `revokedKids`, `alg` change (`none`/HS256) rejected; private key absent from all responses/logs (scan test); API returns 503 if no key.
- **Tests:** `licensing-crypto.test.ts` (vectors, negatives), `licensing-keys-db.test.ts`.

### L3 — Client API (3.5–4.5 days, schema-free) — **critical**

- **Scope:** `activate`, `validate`, `deactivate` routes; `src/lib/licensing/{api/guard.ts, rate-limit.ts, nonce.ts, blocks-cache.ts, activation-service.ts, errors.ts, respond.ts}`; event writer (§5.2); payments integration (§5.3 last bullet); IP prefix/HMAC; `licenses.activations` join.
- **Acceptance:** entire §3 contract tested; seat limit is exact N under 20 concurrent activations; idempotent re-activation; rebind quota; replay (same nonce) 401; ±skew; unsigned/badly-signed response test with client simulator; enumeration test (missing/mismatched product same response and similar timing ±20 ms); refund → activations `revoked` + log; dispute → log + API 403 `license_suspended`.
- **Load test** (`scripts/licensing-load.ts`, isolated copy DB, port 3600, prod build): 100 concurrent `validate` × 10 rounds → 0 errors, 0 `write queue timeout`, p95 < 300 ms, p99 < 800 ms; 1,000 requests/10 s single IP → 429s, DB writes bounded to aggregate rows (row count measured); 50 concurrent activations + parallel admin write → 0 SQLITE_BUSY.
- **Tests:** `licensing-api.test.ts`, `licensing-api-db.test.ts`, `licensing-seats-concurrency.test.ts`, `licensing-load` report `docs/licensing/load-report.md`.

### L4 — Updates and licensed downloads (1.5–2 days, schema-free)

- **Scope:** `updates`, `downloads/link`, `dl/<token>`; safe path resolution; Range; usage counter; events.
- **Acceptance:** path traversal (`../`, symlink, absolute path) rejected; download of another product 403; expired/tampered token 401; token with deactivated activation 403; 206 accurate `Content-Range`; constant memory on large files (stream).
- **Tests:** `licensing-updates.test.ts`, `licensing-download-db.test.ts`.

### L5 — Rule engine, sweep, notification queue (2.5–3 days, schema-free) — **critical**

- **Scope:** `src/lib/licensing/rules/*` (each rule a pure function: input window data → decision), `scripts/licensing-sweep.ts` (`pnpm licensing:sweep`), `deploy/licensing-sweep.{service,timer}` (5 min), observe mode, circuit breaker, suppression, restore, retention cleanup, e-mail queue (§7 notifications), customer e-mail templates.
- **Acceptance:** below/above threshold, suppressed, and observe tests for each rule; circuit breaker trips on (N+1)th suspension and produces critical event; restore only if latest transition is the rule's suspension; rule cannot undo payment suspension; sweep idempotent and < 30 s for 10k activations; cleanup deletes only expired records; e-mail at-least-once, retry budget ≤5.
- **Tests:** `licensing-rules.test.ts`, `licensing-sweep-db.test.ts`, `licensing-retention-db.test.ts`, `licensing-notify-db.test.ts`.

### L6 — Security center + admin actions (3–4 days, schema-free)

- **Scope:** §5.4 endpoints, §7 view and license side panel, `licensing-settings` signing key button, nav badge.
- **Acceptance:** editor/customer/API key/MCP/cross-site return 401/403 on every endpoint (P6 matrix); every action writes a `security-audit` row; two-step confirmations; server-side filters; list < 500 ms on 10k events; a11y (keyboard, focus, contrast); no admin code enters public bundle (`client-bundle-guard`).
- **Tests:** `licensing-admin-endpoints.test.ts`, `security-center-view.test.tsx` (React DOM), e2e `tests/e2e/security-center.spec.ts` (isolated: emit event → suspend → restore).

### L7 — Portal, e-mails, KVKK texts (1.5–2 days, schema-free)

- **Scope:** §8 portal row; TR/EN i18n; legal draft updates (`content/legal/*`, requires `legalReview` re-approval); `docs/editor-guide.md` licensing section.
- **Acceptance:** customer sees only their own devices (another customer's activation ID returns 404); quota; suspension text PII-free; legal change drops `legalReady` until lawyer approval (existing behavior).
- **Tests:** `portal-devices.test.ts`, e2e portal device removal.

### L8 — Identity and webhook anomalies (1–1.5 days, schema-free)

- **Scope:** admin/portal login events, admin login from new network e-mail, webhook signature rejection event.
- **Acceptance:** failed login counting aggregated; lockout event; webhook responses byte-identical (regression).

### L9 — Client integration guide and reference verifier (1.5–2 days, schema-free)

- **Scope:** `docs/licensing/client-integration.md` (flow, curl, canonical string, lease verification algorithm, error table, offline behavior, key storage recommendations, obfuscation recommendations), `docs/licensing/test-vectors.json`, `scripts/licensing-sim.ts` (fake client: activate/validate/deactivate/updates/download), C# and TypeScript verifier examples.
- **Acceptance:** simulator passes end-to-end against isolated server; vectors fed from the same file as L2 tests.

### L10 — QA, security audit, deploy (2 days)

- **Scope:** item-by-item verification of threat model table, independent pentest-style audit (rate limit bypass, signature confusion, IDOR, CSRF, no SSRF, path traversal), Caddy subdomain block + `deploy/` units, `docs/licensing/operations.md` (key rotation, `SOFTMARKET_SECRETS_KEY` backup, incident response, false positive procedure), AGENTS.md + memory-bank.
- **Acceptance:** typecheck/lint/test/build green; isolated e2e green; load report targets met; no open P1/P2.

### L11 — (optional) Offline file activation (2 days, schema-free)

Program generates signed request file → customer uploads to portal → portal returns signed lease file (separate upper limit for long `leaseDays`). Depends on Open question 1.

---

## 10. Order and parallelism

- **Order:** L0 → L1 (schema) → L2 → L3 → (L4 ∥ L5) → L6 → (L7 ∥ L8 ∥ L9) → L10 → [L11].
- **With visual frame plan:** G0 is currently in `../softmarket-g0` worktree. L0 is schema-free and can run in parallel with G0/G2–G7. **L1 and G1 never run `migrate:create` concurrently**: L1 does not start until G1 is merged into `main` (or if the user reverses priority, G1 waits for L1). Shared files: `src/payload.config.ts` (collection list, admin components), `src/lib/admin-i18n.ts`, `src/payload-types.ts`, `src/app/(payload)/admin/importMap.js` — regenerated on merge, not resolved manually.
- **Payment code:** L3 touches `admin-actions.ts`; if there is open P-series work at that time, coordinate order with the file owner.
- `generate:types`/`generate:importmap` only in L1 and L6. Build and typecheck do not run concurrently; SQLite tests use `--maxWorkers=1`.

## 11. Agent allocation

Rules: author ≠ reviewer. If Claude writes, GPT Sol/Terra (High) reviews; if GPT writes, Claude Sonnet (Medium) or Gemini Hydrogen (High) reviews; critical security core goes to Claude Opus (Medium); if GPT spins on backend, Opus (Medium) takes over; UI goes to Sonnet (Medium). **Fable is not used.** User approval at the end of each phase.

| Phase | Author (effort) | Reviewer (effort) | Note |
|---|---|---|---|
| L0 spike | GPT Terra (High) | Claude Opus (Medium) | Timebox 1 day |
| L1 schema + migration | Claude Opus (Medium) | GPT Sol (High) | Migration SQL and access matrix |
| L2 crypto core | Claude Opus (Medium) | GPT Terra (High) + Gemini Hydrogen (High) crypto review | Most critical work; two independent reviewers |
| L3 client API | Claude Opus (Medium) | GPT Terra (High) | Terra runs load test |
| L4 updates/downloads | GPT Terra (High) | Claude Opus (Medium) | Path traversal and stream |
| L5 rule engine/sweep | Claude Opus (Medium) | GPT Sol (High) | False positive scenarios |
| L6 endpoints | Claude Opus (Medium) | GPT Sol (High) | Authorization matrix |
| L6 view/UI | Claude Sonnet (Medium) | GPT Sol (High) | a11y, bundle guard |
| L7 portal + e-mail | Claude Sonnet (Medium) | GPT Sol (High) | Legal text: Claude Haiku (Low) draft → user/lawyer |
| L8 anomalies | GPT Sol (Medium) | Claude Sonnet (Medium) | |
| L9 guide + reference | Claude Opus (Medium) (algorithm/vectors), Claude Haiku (Low) (text) | GPT Terra (High) | Vectors from L2 test |
| L10 audit | GPT Terra (High) + Gemini Hydrogen (High) | Claude Opus (Medium) summary | Findings → fixed by respective phase author |
| Commit | Claude Haiku (Low) | — | Only when QA is green and user requests |

## 12. Biggest risks

1. **Legitimate customer locked out by false positives** (corporate NAT/VPN, disk-image deployment). Mitigation: observe mode, lease tolerance, one-click restore, suppression, circuit breaker.
2. **SQLite write pressure / DoS.** Mitigation: in-memory limits and blocks, aggregated event writes, ~1 write/device/day, load test acceptance gate. Residual: volumetric attack → Cloudflare/provider.
3. **Single-process assumption.** Rate limits, nonces, event buffer, and serial queue are in-process. If Passenger spawns multiple processes on shared hosting, these guarantees break (`docs/plan-hosting.md`).
4. **Loss/leak of signing key or `SOFTMARKET_SECRETS_KEY`.** Loss = re-activation of all devices; leak = forged leases. Mitigation: vault + env, rotation, `revokedKids`, backup procedure, embedding multiple kids.
5. **Client tampering cannot be prevented technically.** The server protects only update/download/support entitlement; the quality of the program's own protection depends on the company's software team (L9 guide).

Additional: touching P6 payment code (regression), migration order with G1, lawyer approval delay for KVKK texts, Payload custom view internal API breaking across version upgrades.

## 13. Open questions for the user (with recommendations)

1. **Are there customer servers with no internet at all (air-gapped)?** If so, file-based activation (L11, +2 days). **Recommendation:** 14-day offline tolerance is sufficient in v1; L11 later if needed.
2. **Should automatic suspension be enabled from day one?** **Recommendation:** first 30 days observe + e-mail only; after reviewing data and tuning thresholds together, switch to "suspend" mode from the admin panel. Revocation always requires admin approval.
3. **Seat = device or concurrent usage?** **Recommendation:** seat = active device (most natural match for today's `seats` field); floating license in a separate phase.
4. **Should country/location info be used?** "Impossible travel" requires country info. **Recommendation:** if the site is behind Cloudflare, use only `CF-IPCountry` country code; otherwise no location in v1 (avoids KVKK burden and MaxMind license).
5. **Hosting and subdomain:** stay on VPS, and what should the subdomain be? **Recommendation:** VPS for the licensing API (details `docs/plan-hosting.md`) + `lisans.<alan-adi>` subdomain, embedded in programs from the first release.
6. **Additional admin account protection:** **Recommendation:** in v1, restrict `/admin` access in Caddy to office IPs or Cloudflare Access; TOTP 2FA as a separate small phase (approx. 2 days).

## User decisions (2026-11-17)

- Order: **visual-globals G1 first**, then licensing L1. L0 (schema-free spike) runs in parallel with G1.
- Automatic rules: **first 30 days monitor-only** (event + e-mail, no suspension); enabled from the admin panel once thresholds are tuned based on data. Revocation always requires admin approval.
- Seat: **per device** (customer removes a device from the portal to free a seat).
- Hosting: **VPS + `lisans.<alan-adı>`** subdomain (DNS + Caddy block). Shared hosting is not targeted.
- Unasked items defaulted to recommendations: 14-day offline tolerance in v1 (L11 file-based activation later), country info only if Cloudflare `CF-IPCountry` is present, IP/Cloudflare Access restriction recommendation for `/admin` + TOTP as a separate small phase.

## L0 result and plan revision (2026-11-17)

Details and evidence: `docs/licensing/adr-l0.md` (Terra spike plus the browser/HTTP verification).

- **No `jose` dependency.** Node `crypto` Ed25519 compact JWS reproduces the RFC 8037 A.4/A.5 vectors. Implement without a dependency; carry the RFC vector and negative tests (tamper, wrong alg, wrong `kid`, malformed base64url, oversize, critical headers, claim/time checks) into product tests.
- **Failed admin login: `users.hooks.afterError`.** Verified over real HTTP and the admin UI form (both hit `POST /api/users/login`; wrong password gives 401 and fires `afterError` with `AuthenticationError`). `beforeLogin`/`afterLogin` do not run on failure. Limits: Local API `payload.login` and GraphQL do not go through this hook (test separately if in scope); filter by route and error name; never log password, email or body; a logging failure must not change the 401; Payload's own `maxLoginAttempts` lockout stays the enforcement, the hook only feeds security-center events.
- **Admin custom view access model.** Register via `admin.components.views` and `afterNavLinks`; component paths are relative to `importMap.baseDir` (`/l0/view#View` style, not `/src/...`). Real browser results: admin sees nav link and view; editor has no nav link and a direct URL redirects to `/admin` (server-side `req.user` check in the view, final URL asserted, not an HTTP 403); anonymous is sent to `/admin/login`. The nav link is cosmetic: the server check in the view and admin checks on every data endpoint are the boundary. Cover with Playwright for all three sessions.
- **Partial unique index management.** drizzle/Payload migrations do not know partial indexes: a table rebuild (for example making a nullable column required) generates `DROP TABLE` + rename and silently drops them, never recreating. Policy: create them in hand-written migration SQL with explicit down; review every generated migration for `__new_<table>` on tables with partial indexes and re-create manually; add a CI test that migrates a fresh SQLite and asserts the index exists, rejects a duplicate active row, accepts inactive duplicates. App-level checks inside the transaction stay as defense in depth.
- **Raw body and Range.** `req.arrayBuffer()` preserves bytes (hex and SHA-256 identical over real HTTP); Range gives 206/Content-Range, `If-Range` mismatch gives 200 full body, unsatisfiable gives 416. Licensing routes live under `src/app/(payload)/api/` (the next-intl middleware matcher excludes `api`). L3 adds suffix/multiple range, HEAD, weak ETag and abort tests.
- **L3 revision: split writes by criticality.** Measured serial transaction queue (100 concurrent `BEGIN IMMEDIATE` update+insert): p95 about 550 ms (Terra 559.5 ms, repeat 550.4 ms; p50 about 292 ms, p99 about 573 ms), roughly 5.5 ms per serialized write, so bursts near 900 writers would hit the 5 s queue timeout.
  1. Observational writes (`lastSeenAt`, informational events): in-memory coalescing per activation with a periodic flush (for example every 30-60 s, one transaction per batch), a bounded buffer with a maximum age and size, and a flush on graceful shutdown (SIGTERM/exit). A crash may lose up to one interval of observations; this is accepted and documented.
  2. Security-critical writes (activation, seat claim/release, state transition, revocation, nonce/replay record): separate path, synchronous, atomic, never buffered, and committed before the response is returned.
  3. Re-measure on the target VPS with representative load and other writers before fixing flush intervals.

## L1 implementation record (2026-11-17; no commit, live DB not migrated)

Schema-only phase `licensing_core`. No API routes, crypto, rule engine or security-center UI (L2-L6).

- **Collections** (`src/collections/{LicenseActivations,LicenseStatusLog,SecurityEvents,SecurityBlocks,SecurityAudit}.ts`, group `Security`, shared shape `src/lib/licensing/collection-helpers.ts`): read = admin **panel session** (`isPanelAdmin`: admin, `local-jwt`, no Authorization header), create/update/delete = `nobody` (server code uses `overrideAccess`), `graphQL: false`, `disableDuplicate`, no versions or document locks, all fields read-only in the admin, nav hidden for non-admins, not in the MCP allow-list, no public revalidation. Enum values in `src/lib/licensing/constants.ts` (single source; stored as text, adding a value needs no migration).
- **Global** `licensing-settings` (`src/globals/LicensingSettings.ts`): panel admin read and server-only writes, no versions, document locks, GraphQL or MCP. All importable fields opt out of content import. Tabs General/Limits/Rules/Self-service/Notifications/Retention/Signing keys (country source lives in General). Safe defaults: `apiEnabled=false`; every rule `mode=notify` (no `revoke` mode exists); the license transition hook permits automatic suspension only in `suspend` mode after a valid `rules.observeUntil` has elapsed. An empty date keeps automatic suspension disabled; `leaseDays` <= 30; retention floors `RETENTION_FLOORS` (status log >= 10 years). `signingKeys[]` (kid, publicKey, createdAt, retiredAt, revokedAt) has field access create/update = nobody (L2 endpoint writes it).
- **`licenses`**: `publicId` (unique, 12 CSPRNG bytes hex, generated in `prepareLicense`, field access create/update nobody), `maxDevices` (positive safe integer, empty = seats), `statusReason`/`statusSource`/`statusChangedAt` (server-stamped, read = admin only, write = nobody). `status` field access create/update = panel admin: a users API key (MCP or REST) cannot set or change it (silently stripped by Payload field access; MCP create gets the default `active`). `beforeDelete` refuses (409) when status log or activation rows exist.
- **Transition log** `src/lib/licensing/transitions.ts`: `stampLicenseTransition` (beforeChange) + `logLicenseTransition` (afterChange, same operation transaction) + `recordLicenseTransition(req, input)`. Source: declared `req.context.licenseTransition.source`, else `admin` (panel session) / `mcp` (API key) / `system` (no user); reason defaults to `manual` for admin. Projection cannot affect logging. A failed log insert rolls back the whole bulk update. Raw-SQL refunds and disputes still skip the log and can leave older status summary values on the license. L3 will integrate these paths (§5.3).
- **`products.licensing`** (`enabled`, `code`): read = staff, create/update = panel admin, not in content:import (seed schema unchanged). `code` `^[a-z0-9][a-z0-9-]{2,40}$`, unique, empty stored as NULL, immutable and not clearable once stored (field `beforeChange`; also drafts/autosave, Local API, version restore); `enabled` requires a valid code. Drafts reserve codes across products.
- **Migration** `20261117_200700_licensing_core`: up = 9 CREATE TABLE, 59 CREATE INDEX, 5 generated CREATE UNIQUE INDEX + 2 hand-written partial unique indexes (`license_activations_one_active_fp` on (license_id, fingerprint_hash), `license_activations_one_active_thumb` on (device_key_thumbprint), both `WHERE status = 'active'`), 9 ADD COLUMN and a collision-checked backfill of `licenses.public_id` before its unique index. Up uses additive DDL. Down guards licensing rows, saved settings, product licensing values and license metadata before making schema changes. `migrate:create --skip-empty` found no schema diff.
- **Copy DB** (`.backup` of `data/softmarket.db`): migrate OK; 723 pre-existing tables row-hash equal; integrity `ok`; FK check empty; `content:import --dry-run` 0 created / 98 updated, rolled back, no row change; `migrate:down` restored the original SQLite schema and the second `migrate` preserved the original row hashes.
- **Tests**: `licensing-migration.test.ts` (static SQL rules, up/down/up hashes, backfill, partial index behaviour, guarded down), `licensing-access.test.ts` (REST/Local API/GraphQL matrix, settings bounds, field access, product code rules, partial indexes after the full chain), `licensing-transitions-db.test.ts` (log per change, context sources, atomic rollback, API-key status block, delete guard), `mcp.test.ts` and `admin-labels.test.ts` extended.
- **Deviations / narrower choices**: security collections and settings are readable only with a panel session (not with an admin API key) and have no GraphQL; `licenses.activations` join deferred to L3 (plan L3 scope); settings-change audit (`settings.update`) deferred to L6; the panel "reason required" (`statusNote`) for direct status edits is not enforced yet (L6 action panel); `security-audit.nonce` (unique, plan T4) and `signingKeys[].revokedAt` (T12) added now so later phases stay schema-free; license delete guard added.

## L2 implementation record

- **Crypto and leases.** `src/lib/licensing/crypto/` uses Node Ed25519 for signing and verification. The v1 verifier caps tokens at 4,096 bytes and checks all three compact segments, canonical unpadded base64url, compact JSON without duplicate names or trailing bytes, and the exact `alg`, `kid` and `typ` headers. It verifies against a trusted key, checks both revocation sources and the retirement deadline, and requires the expected issuer, product, activation ID, license ID, fingerprint and device key. On subsequent offline checks the expected IDs come from the saved authenticated activation. A retired key can verify leases issued at or before retirement during the overlap. Lease claims use Unix seconds. The builder caps the offline expiry at the earlier of the configured duration and license expiry. The expiry remains authoritative if it is earlier than the refresh time.
- **Canonical signing and HMAC.** `SM1-REQ` and `SM1-RES` bind the exact body bytes and nonce. HKDF-SHA256 uses the shared vault master input, salt `softmarket/secrets`, and the plan's independent fingerprint, download and UTC calendar-month IP purpose strings. Fingerprint HMAC uses the decoded fingerprint bytes and is stored as lowercase hex. IP HMAC uses the normalized address and returns base64url. IPv4 and its mapped IPv6 forms share the same hash and /24 prefix. Native IPv6 uses /48.
- **Storage and lifecycle.** `pnpm licensing:keygen` provisions a generated Ed25519 key on the configured deployment database. It stores PKCS#8 as AES-256-GCM ciphertext in the existing `integrations.secrets` JSON vault with AAD `softmarket:integrations:licensing-signing-ed25519`. Rotation refuses to overwrite an existing signing record that the supplied master cannot decrypt. The CLI emits JSON with only `kid` and `publicKey`. The `kid` is the base64url SHA-256 of the raw public key. Key generation and rotation save the vault record and public metadata in one transaction. `--rotate` is required to replace an active key. The old public key remains eligible for verification for 90 days after retirement. The server revocation function stamps `revokedAt` and keeps the kid available for deny lists.
- **Environment precedence.** `SOFTMARKET_LICENSE_SIGNING_KEY` accepts Ed25519 PKCS#8 PEM or unpadded base64url PKCS#8 DER. Blank values and `CHANGE_` placeholders are treated as unset, as in integration settings. A configured value must match the active public metadata. Invalid or mismatched values fail closed. `pnpm licensing:keygen --register-env` records the environment key's public metadata without copying its private bytes to the vault. It removes a superseded vault signing record in the same transaction. Add `--rotate` when replacing an active key. This registration mode allows the public endpoint to avoid consulting the private environment value or vault.
- **Public endpoint.** `GET /api/v1/licensing/keys` returns `{ keys: [{ kid, alg: "EdDSA", x }], revokedKids }` with `Cache-Control: public, max-age=3600`, `Date` and `X-Robots-Tag: noindex`. Disabled, uninitialized and unreadable settings return `503`, `no-store` and `{ error: { code: "unavailable" }, serverTime }`. The endpoint continues to publish revocations if there are only revoked keys. It is an unsigned diagnostic exception to §3.1. Trust comes from pinned keys. Cached diagnostics can lag a revocation by up to one hour.
- **Settings access.** The existing global form saves non-secret settings for an admin authenticated through a `local-jwt` panel session with a same-origin request and no `Authorization` header. Anonymous, customer, editor, API-key and bearer requests are denied. Payload field access keeps `signingKeys` server-written. Existing TR/EN labels are retained.
- **Verification and scope.** `licensing-crypto.test.ts` covers fixed RFC 8032 and RFC 8037 vectors, canonical strings, claim and time validation, HMAC, IP privacy and malformed tokens. `licensing-keys-db.test.ts` exercises the route handler, CLI, precedence, concurrent bootstrap, overlap, revocation, transaction rollback and scans of captured HTTP responses and logs. `licensing-access.test.ts` exercises the settings matrix and permission discovery. L2 uses the L1 schema. Client activation endpoints and the admin key action and audit flow remain in their planned phases.
- **Checks.** `pnpm generate:types` produced identical types. Typecheck, lint and the full Vitest suite passed, with 1,628 tests in 99 files. The suite used temporary SQLite databases.

## L3 implementation record

- **Client API.** The Node handlers under `src/app/(payload)/api/v1/licensing/` implement raw JSON `POST /activate`, `POST /validate` and `POST /deactivate` with a streaming 8 KiB cap, strict field validation, Ed25519 device proof and signed, nonce-bound responses. The L2 unsigned `GET /keys` diagnostic shares network admission limits. The POST routes require enabled settings, a configured issuer host, an active signer and the fingerprint pepper. Unknown keys, product mismatches, disabled products and unverified owners share `invalid_license` on activation. The client contract and offline workflow are in `docs/licensing/client-api.md`.
- **Durability and seats.** The shared SQLite serializer and `BEGIN IMMEDIATE` guard check eligibility, count active device rows, enforce the rebind quota and mutate device state atomically. L1's partial unique indexes remain the backstop. Each authenticated, admitted operation claims the unique `security-audit.nonce` within the write transaction. A distinct commit receipt is checked before returning success. Skew is checked before authentication and again under the write lock. §3.5's exact, authenticated deactivate retry is acknowledged within the clock window without releasing another seat or writing a second receipt. Other admitted replays get the uniform 401. Counters rotate on refresh and survive process restart.
- **Write performance.** Validation requests already waiting for the writer lock share a commit in groups of at most 16. A per-request savepoint confines a failed refresh, and each response waits for confirmed durability. The queue starts immediately and has no fill timer. Last-seen/IP/version writes are debounced by settings and coalesced separately with events. The event writer aggregates by hour, flushes in 10 seconds or at 200 pending event keys, and bounds outstanding event and last-seen keys at 500 each. High severity triggers a prompt flush for a new key. Next's graceful close awaits scheduled batches. Abrupt process termination can lose pending observations.
- **Abuse and privacy.** Prefix, activation, license and process buckets use admin-editable limits. Trusted IP attribution uses the authenticated proxy headers. Unknown addresses share a rate bucket without a database-wide address block. Trusted-prefix invalid-license bursts can create expiring blocks as specified by §3.7. L3 records clone and burst events without changing license status. L1 continues to guard automatic transitions. Fingerprints persist as HMACs and address metadata as /24 or /48 prefixes plus month-scoped hashes. Logs use fixed codes and security events omit arbitrary request details.
- **Payments and access.** Refund and dispute now stamp the license status summary and call `recordLicenseTransition` in the order transaction. Refund also revokes active devices. Dispute leaves the devices active and the API denies lease refresh with `license_suspended`. A failed history insert rolls back the local order and device changes while keeping the original provider refund lock. Payload 3.93 fails GraphQL schema construction on a native join to a GraphQL-disabled collection. The `licenses.activations` virtual lookup gives panel admins a bounded list on license details and keeps the underlying security collection outside GraphQL and MCP.
- **Verification.** Typecheck, lint, and the full Vitest suite passed (102 files, 1,672 tests). The isolated production build compiled all four routes. The isolated load harness completed 1,000 validations with p95 70.2 ms and p99 75.9 ms. The single-prefix flood produced one aggregate row for 931 rejected requests. The 50-device burst allocated exactly three seats alongside a staff write. See `docs/licensing/load-report.md`. The sandbox rejected binding port 3600, so the production HTTP and VPS measurements remain open. §9 assigns updates, download tokens and Range verification to L4. L3 reuses the L1 schema.

## L4 implementation record

- **Signed operations.** `POST /updates` selects the highest newer SemVer for the device's licensed product in the requested channel, with `releaseDate <= now`. It returns only eligible download metadata for the requested OS and architecture. `POST /downloads/link` accepts a positive integer `downloadId`. Both POSTs reuse L3's strict raw-body authentication, skew, nonce receipts, batched commits and configured activation budget. Missing, foreign, future, ambiguously referenced or unavailable downloads share `403 download_unavailable`.
- **File URLs.** The relative URL carries `base64url(payload).base64url(HMAC-SHA256)` under the L2 download key. The payload is `{d, a, e, n}` with a 128-bit random nonce. A bounded first-party process registry binds the token to the license, product, download row, and opened file identity. Expiry is 300 seconds. Each of up to five admitted GETs is counted synchronously, including aborted transfers. Restarting the API process discards every outstanding link. Network and activation admission thresholds come from `licensing-settings`. The token lifetime and use cap are protocol constants.
- **Current entitlement and path confinement.** GET and HEAD are unsigned and recheck the current license, activation, product, blocks and download-to-media relation before responding. Only safe basenames of protected original uploads are accepted. The operator-configured root is resolved once with `realpath`, because `scripts/deploy.sh` makes `releases/<id>/uploads` a symlink to `shared/uploads`. Linux then walks that physical directory with directory descriptors and opens the leaf with `O_NOFOLLOW`. The opened descriptor's real name must equal the catalog filename byte for byte, which rejects case or normalization aliases on insensitive volumes. macOS uses `O_NOFOLLOW_ANY`. Symlinks, hard links, image-derivative collisions and non-regular files are denied. Device, inode, size and nanosecond change/modify times identify the opened file. The same descriptor supplies the range and streams the bytes with bounded read-ahead and closes on cancellation.
- **Range decisions.** Full GETs return 200. Single closed, open-ended and suffix ranges return 206 with the actual byte range. Malformed, multi-range and unsatisfiable requests return 416 with `Content-Range: bytes */<size>`. HEAD returns full representation headers. HEAD and 416 responses spend zero uses. A mismatched, weak or date `If-Range` returns 200 with the full file. File responses are private and no-store with transformations disabled. [HTTP Semantics, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#name-range-requests)
- **Events and privacy.** `download.link_issued` and `download.started` reuse the L3 writer and aggregate per activation, IP prefix and hour. Address metadata is limited to the trusted prefix and monthly HMAC. Logs omit full IPs, raw fingerprints, license keys and bearer URLs. Next request logging excludes the bearer route. The event and audit options use the L1 text columns. L4 requires no migration.
- **Verification.** Typecheck and lint passed. The full Vitest run passed 1,747 tests across 106 files, including 36 new L4 tests. The isolated route-handler tests use migrated temporary SQLite and uploads. They cover the entitlement matrix, replay and settings, token binding and concurrent reuse, path confinement, Range and validators, header safety, bounded file reads and descriptor cleanup, disabled-mode 503, and telemetry redaction. Local socket binding returned `EPERM`. HTTP through Next and Caddy on the target Linux host remains to be verified.
- Open for L10: verify the /proc/self/fd real-name check and the symlinked uploads root on the Linux VPS.

## L5 implementation record (rules engine, sweep, notification queue)

Scope: §5.3 asynchronous rules, the sweep, monitor-only mode, circuit breaker, suppression, the restore core, §6 retention and the §7 e-mail queue. No schema change and no migration (one new stored enum value `system.daily_digest`, a plain text column value; `pnpm generate:types` updated the union). Admin HTTP endpoints (restore, triage, block) remain L6b.

- **Rules** (`src/lib/licensing/rules/rules.ts`): one pure function per rule, per-license window data in, `{ hit, metric, threshold }` out; no I/O, `now` injected. Window: an observation counts when `now - windowHours < at`. `ipSpread` hits when distinct /24 or /48 prefixes are **greater than** the threshold (plan "> N"); all others hit when the metric **reaches** it. Defaults (licensing-settings, `RULE_DEFAULTS` now in `constants.ts`): ipSpread 10 / 24 h, geoSpread 3 countries / 24 h, impossibleTravel 1 change of the same device's country within 2 h over a 24 h look-back, activationBurst 5 activations / 1 h, activationChurn 6 client/customer ends (`user`, `rebind`, `customer_portal`) / 720 h, cloneSuspected 3 aggregated L3 clone signals / 24 h. Every rule starts in `notify`; `suppressDays` 30. An invalid threshold or window never hits; country rules are skipped while `countrySource = none`. Inputs (`window.ts`) come from two scans per sweep: license-activations (activation/end/last-seen, prefix, country) and non-rule security events (prefix, country, clone counts) of **active** licenses since the longest enabled window. Rule events are never rule input. The L3 event writer now also stores the configured country code on events (column existed).
- **Decision** (`decide.ts`, pure): off -> nothing; inactive license -> nothing; suppressed -> nothing; observe -> event only; notify -> event + admin e-mail; suspend -> automatic suspension only when `rules.observeUntil` is a canonical ISO date strictly in the past, `maxAutoSuspendsPerHour > 0`, the breaker is closed and fewer than the limit rule suspensions happened in the last hour; otherwise it degrades to notify with outcome `monitor_only`, `auto_suspend_disabled`, `circuit_open` or `circuit_tripped`. There is no revoke outcome. Rules never touch activations: suspended devices keep their lease until `exp` (§5.3).
- **Apply and idempotency** (`apply.ts`): each hit is one short BEGIN IMMEDIATE transaction through the serial writer queue that re-reads license status, suppression, the hourly suspension count and the breaker state. The rule event is an episode: an open/acknowledged event of the same rule and license seen within max(windowHours, 24 h) is extended (last seen, metric, outcome); a stronger outcome (notified -> suspended) re-arms the admin alert once. Resolved or false-positive events end the episode. The suspension is a Local API `update` with the transaction's `req` and context `{ source: 'rule', reason: rule_*, ruleKey, event }`, so the L1 hooks stamp the license and append exactly one `license-status-log` row and re-check mode and observeUntil from the database; a refusal (409) rolls back the transaction and the hit is recorded again as `monitor_only` (tested with forged in-memory settings). Concurrent or repeated sweeps produce one suspension, one log row and one event (tested with two parallel sweeps plus a third run). `--dry-run` writes nothing, sends nothing and reports the decisions.
- **Circuit breaker**: the (N+1)th automatic suspension within a rolling hour is not executed; one critical `system.rule_circuit_open` event (dedupe per hour, admin e-mail queued) is recorded and all later suspend-mode hits degrade to notify while an open breaker event was seen within 24 h. Triage of that event (L6b) closes it earlier. `maxAutoSuspendsPerHour = 0` disables automatic suspension without tripping.
- **Restore and suppression** (`restore.ts`, core for the L6b endpoint): in one transaction, refuses with 409 (`not_rule_suspension`) unless the license is `suspended` and its latest status row is a rule suspension; returns to the row's `from` status (source `admin`, reason `restore`, `revertOf`, rule key, event), marks the event `false_positive` with `detail.restoredAt`, re-arms the notification (customer "re-enabled" e-mail only if the suspension e-mail was sent) and writes one `security-audit` `license.restore` row. A payment or admin transition after the rule suspension blocks the restore. Suppression is derived, no new rows: a `restore` status row with that rule key or a `false_positive` rule event within the rule's `suppressDays` suppresses the rule for that license (no event, no e-mail, no suspension).
- **Notification queue** (`notify.ts`, the P4 lease pattern on existing `security-events` columns): `notify_state` pending/sent/failed/skipped, `notify_next_at` as lease (5 min) or backoff deadline, `notify_attempts` (budget 5, backoff 15/30/60/120 min), `notify_last_error` short code, per-message markers in `detail` (`notifyAdminWant`/`notifyAdminDone`, `notifyDigestDone`, `notifyCustomerSuspendedAt`, `notifyCustomerRestoredAt`). One conditional `UPDATE … RETURNING` claims up to 50 due rows; admin alerts of all claimed rows go out as one message; markers are written right after each send; release is guarded by the lease. No SMTP: nothing claimed or counted. No alert recipient: deferred 15 min without counting. Rows pending for 7 days since their last change become `skipped`. At least once: a duplicate is possible only if the process dies between a send and its marker. Sources: rule episodes (notify/suspend modes), the breaker, restores, the daily digest, and L3/API events at or above `minSeverityImmediate` (open, seen within 24 h) that nothing queued yet.
- **E-mails** (`src/lib/email/licensing.ts`): recipients `notifications.alertEmails`, else `PAYMENTS_ALERT_EMAIL`, else site-settings `contact.email`. Admin alert and digest (counts only; one row per Europe/Istanbul day at `digestHour` when `dailyDigest` is on) carry event id, type, severity, count, outcome, rule and the license public ID's last 6 characters, plus the security-center link; no IP, e-mail, key or fingerprint. Customer e-mails (suspended / re-enabled) in TR and EN by `preferredLocale`, with the product name, the masked key and the portal licenses link; switched off by `customerSuspensionEmail`. No separate expiry e-mail (no setting exists).
- **Expiry**: one `license.expired` info event per license and `expiresAt` (dedupe key, licenses that expired in the last 30 days); status is never written.
- **Retention** (`retention.ts`): batches of 1,000 rows, each batch a short transaction, in sweeps that start in the 04:00 Europe/Istanbul hour or with `--retention`. Event IP fields after `eventIpDays` (30), events after `eventDays` (180, never a row with a pending notification), activation IP fields after `activationIpDays` (90) since last seen (active) or end, ended activations and status history `activationRowYears` (2) / `statusLogYears` (10) after the license ended (expiry, or the revocation time; perpetual running licenses keep everything), blocks `blockDays` (90) after expiry or lift, audit after `auditYears` (2). Settings below `RETENTION_FLOORS` are clamped to the floor.
- **Operation**: `pnpm licensing:sweep [--dry-run] [--retention]`; `deploy/licensing-sweep.{service,timer}` (oneshot, every 5 minutes, 240 s timeout). Output and logs: counts, rule keys, outcomes, numeric ids, short error codes. Exit 1 when a hit failed. An unreadable stored setting makes the sweep abort before any action (fail closed).
- **Tests**: `licensing-rules.test.ts` (16: boundaries of every rule, invalid configs, decision matrix incl. monitor-only cases and "no revoke", settings normalisation, queue message selection, TR/EN templates), `licensing-sweep-db.test.ts` (15: monitor-only matrix, unreadable setting, forged settings vs L1 guard, suspend once + log once + no revocation under concurrent sweeps, escalation re-arm, breaker trip/stay-open/close, limit 0, episodes, restore + suppression, restore refused after payment/admin transitions, dry run, expiry, rule inputs, 10k activations in about 1.4 s, privacy scan of logs/report/events/admin e-mail), `licensing-notify-db.test.ts` (11: no-SMTP skip, single batched alert, concurrent lease, backoff and budget, at-least-once markers, held lease, recipient fallbacks, customer TR/EN + masked key, severity enqueue, digest, max age), `licensing-retention-db.test.ts` (5).
- **Deviations / open questions**: impossible travel uses hourly aggregated event rows plus the device's last-seen snapshot, so it only sees country changes that reach the database (no per-request history); both country rules stay inert without a country source. "Invalid-license -> IP block" stays synchronous in L3 (§3.7) and is not repeated in the sweep. Stripe `charge.dispute.closed` automation is not added (P6 owner decision still open). The breaker cool-down (24 h) and episode gap (max(window, 24 h)) are code constants, not settings. Digest and retention hours use Europe/Istanbul.

## L6a implementation record (read-only security center)

Scope: the read-only half of §7. Admin action endpoints (§5.4: suspend, revoke, reactivate, restore, deactivate, block add/lift, triage, signing-key rotation), the rules engine and the sweep stay in later phases; the view renders no action buttons and says so in a footnote. No schema change, no migration, no new dependency, no client JavaScript.

- **Route and registration.** `admin.components.views.securityCenter` (`path: '/guvenlik'`, `exact: true`) serves `/admin/guvenlik`; `admin.components.afterNavLinks` adds the nav link. Component paths use the repository's `@/admin/...#Name` style (resolved by the generated import map, regenerated with `pnpm generate:importmap`). Payload renders a custom view under a new key WITHOUT a template (no nav or header), so the view wraps itself in `DefaultTemplate` from `@payloadcms/next/templates` with the same props the root view passes, then renders plain HTML inside `Gutter`.
- **Guard design.** `src/admin/security/guard.ts`: `decideSecurityCenterAccess(req)` runs first inside the view, on the server, before any query. No user -> `/admin/login`; anything that is not an admin cookie session (`hasPanelAdminSession`: role admin, `_strategy === 'local-jwt'`, no `Authorization` header) -> `/admin` (editors, customers, API-key or bearer admins). `isAdminSessionUser` also gates the nav link (cosmetic: nothing is rendered for anyone else) and is re-checked inside every loader read, so a `licenses` read that customers and API keys may do for their own scope can never feed the page. The redirect is a 307 inside the RSC flow, so assertions use the final URL and absent content, not an HTTP 403.
- **Data access.** `src/admin/security/loaders.ts` reads only through the Local API with the requesting admin user and `overrideAccess: false` (no `overrideAccess` read anywhere), so `isPanelAdmin` on the five security collections stays authoritative. Every query uses `select`, so `licenses.key`, customer e-mail, device public key, thumbprint, fingerprint hash, last IP hash, counters and nonces are never loaded. Rows are shaped into explicit view models; relation targets (license publicId and status, product title, activation publicId) come from batched projected lookups; customers, orders, actors and events are links by numeric id only. Filters by license and product use Payload relation paths (`license.publicId`, `license.product`) so there is no id pre-lookup.
- **What is shown.** Overview: counters (open high/critical events, open events, events in 24 h, active blocks, suspended licenses, activations in 24 h, active devices) each linking to the filtered list or collection, open events per severity, latest high-severity events, suspended licenses, latest status transitions, latest activations, shortcuts to the Payload lists (events, blocks, audit trail, status log, activations, licenses, licensing settings). Events tab: filters severity (multi), type, status (default `open`), time range, source, license public ID, product; 50 per page, `lastSeenAt` descending. Blocks tab: active / expired-or-lifted / all, kind; 25 per page. Status transitions tab: range, license, product; 25 per page. Active = `active` and not expired (`expiresAt` empty or in the future).
- **Privacy.** Only stored values: IP prefix and a 10-character shortened HMAC (never the full hash, never an address). `security-events.detail` is flattened to top-level primitives, capped (20 entries, 120 characters), and entries whose key looks secret-like or whose value looks like an e-mail address or a full IP are replaced by a redaction marker (`safeDetail`). Nothing from the signing vault or `licensing-settings.signingKeys` is read. Text from the database is rendered as escaped React text.
- **State and failure handling.** The URL is the only state (plain GET form, links; every parameter allow-listed or pattern-checked in `query.ts`, page capped at 10,000). One failing query shows a neutral notice and an em dash for the counter; only the error name is logged, never row data.
- **UI.** `.sc-*` styles in `src/app/(payload)/custom.scss` use only Payload theme tokens (`--theme-elevation-*`, `--theme-success/warning/error-*`, `--base`), so light and dark follow `html[data-theme]`. Severity and state are always badges with text. Tables sit in focusable scroll regions with captions; tabs are a labelled `nav` with `aria-current`; the filter form is a `fieldset` with real labels; focus rings and reduced motion are handled. Nav badge: number of open high/critical events (omitted at zero or when unreadable).
- **i18n.** `src/lib/security-center-labels.ts` (leaf module, TR/EN), re-exported by `src/lib/admin-i18n.ts` as `SECURITY_CENTER_LABELS`; `admin-labels.test.ts` audits it; `security-center-view.test.tsx` requires a label for every stored enum value. The admin language (`req.i18n`) selects the text; the document title is the static `meta.title`.
- **Tests.** `tests/unit/security-center-view.test.tsx` (guard matrix, nav filter, query parsing and where building, display helpers, label coverage, rendered view with a fake Payload that asserts the user and `overrideAccess: false` on every call) and `tests/unit/security-center-db.test.tsx` (real temporary SQLite: counters, every filter, paging, block states, transitions, editor/customer/API-key/cookieless-admin refusal, and a leak scan of view models and rendered HTML for the license key, full hashes, device material and e-mail addresses). `admin-labels.test.ts` extended.
- **Deviations / notes.** Tabs "Riskli lisanslar", "Denetim izi" and "Ayarlar" of §7 are not separate tabs yet: the audit trail and settings are linked to their Payload screens (the rule engine that produces risk is L5; audit rows start with L6b actions). The nav badge costs one indexed `count` per admin page render. `securityCenter` is a view key, not a collection: no importMap collection entries and nothing in the MCP allow-list changed.
- **Verification.** Typecheck and lint clean; full Vitest passed before the final template wrapper (104 files, 1,711 tests; baseline 102 files, 1,672): the security-center view test has 23 tests, the DB test 13 tests, `admin-labels` +1; after the wrapper the three affected files (view, DB, client-bundle-guard) were re-run green (97 tests). Browser check on a `.backup` copy (`NEXT_DIST_DIR=.next-l6a`, port 3550, throwaway admin/editor/customer and sample rows in the copy only, build log in the scratchpad): anonymous -> `/admin/login`; editor has no nav link and `/admin/guvenlik` ends at `/admin` with no view content; admin sees the nav link with the open-high badge and all four tabs; a real filter submit (critical, 24 h) returned the expected single row and kept the form state; an invalid license ID shows the inline hint; no horizontal page scroll at 1440 and 390 px; light and dark themes verified (screenshots in the scratchpad `l6a/` folder: `light-*.png`, `dark-*.png`, `light-mobile.png`). Not covered: the English admin language in a browser (covered by unit tests only) and screen-reader testing.
- **Handover to L6b.** Actions will extend the existing tables (a per-row action column or a document drawer) and must use the §5.4 endpoints with `guardAdminSession`; this view must stay a pure reader. The `Ref`/`LicenseRef` view models and `loadEvents`/`loadBlocks`/`loadStatusLog` are reusable by those endpoints' read side.

## L6b implementation record (admin actions)

Scope: §5.4 admin actions and the action half of §7 (license side panel, event/block actions, signing-key button). No schema change, no migration, no new dependency, no new stored enum value. L7 (portal, legal texts) and L8 (identity anomalies) are out of scope.

- **Endpoints** (`src/lib/licensing/admin/endpoints.ts`, registered as Payload collection/global endpoints through `routes.ts`, POST only): `/api/licenses/:id/{suspend,revoke,restore,reactivate}`, `/api/license-activations/:id/deactivate` (`mode: release|revoke`), `/api/security-events/:id/{acknowledge,resolve,false-positive,block}`, `/api/security-blocks/add`, `/api/security-blocks/:id/lift`, `/api/globals/licensing-settings/rotate-signing-key`. Block creation lives at `/add` rather than the collection root so Payload's own (closed) create route is untouched.
- **Guard.** `guardAdminSession` (P6): anonymous 401; customer, editor, users API key (MCP), JWT in an `Authorization` header and cross-site (`Origin` ≠ `Host` or `Sec-Fetch-Site` ≠ `same-origin`) 403. In addition `Content-Type: application/json` is required (415; a cross-site form cannot send it without a preflight) and the body is read with a 2 KiB streaming cap (413). Body: `requestId` (16–64 `[A-Za-z0-9_-]`), `reason` (3–500 characters, mandatory, control characters refused), optional `note` (≤ 500), per action `expected { status, changedAt }` (license actions), `expectedTriage` (events), `confirm` (revoke: last six characters of the license public ID, case-insensitive; rotation: `DÖNDÜR` or `ROTATE`), block fields (`kind`, `value`, `activation`, `license`, `scope api|all`, `durationHours 1|24|168|null`, `confirmSelf`). Responses are `no-store` JSON with short codes; logs carry the action, numeric target id, code and actor id only.
- **Transaction and audit design** (`actions.ts`). Each action is one `withPaymentTransaction` (the shared serial writer queue, `BEGIN IMMEDIATE`): (1) the receipt `security-audit.nonce = admin:<action>:<target>:<requestId>` is looked up under the write lock and a retry of a committed request returns `200 replayed` without writing; (2) preconditions are re-read (status and `statusChangedAt` against `expected` → `409 stale`, allowed transitions → `409 invalid_transition`, triage state, block/device state, latest status-log row); (3) the change: license status through the Local API with the transaction's `req` and `req.context.licenseTransition = { source: 'admin', reason: 'manual'|'restore', actorUser, note, event, revertOf }`, so the L1 hooks stamp the summary and append exactly one `license-status-log` row; everything else as conditional SQL on the same connection; (4) exactly one `security-audit` row (actor, `actorKind admin`, action, polymorphic target, reason, note, admin IP prefix /24 or /48, `result ok`, nonce). The commit is confirmed by reading the receipt outside the transaction; post-commit effects run only then. Refusals roll back and write nothing (no `denied` audit rows in v1). Two concurrent admins on the same license produce one suspension, one log row and one audit row (tested with four parallel requests, two sharing a requestId).
- **License actions.** `suspend` (active → suspended, reason `manual`, revertible) also inserts a `license.status_changed` event (`source admin`, `action_taken suspended`, triage `resolved`, customer set, `notify_state pending`) so the L5 queue sends the customer suspension e-mail when `customerSuspensionEmail` is on; the status log row links that event. `revoke` (active|suspended → revoked) requires the typed confirmation and reason, records a medium `license.status_changed` event (no customer e-mail) and revokes every active device (`end_reason license_revoked`) in the same transaction; revoked is terminal for all actions. `restore` undoes the latest suspension only when that row is a rule suspension (wraps the L5 core, now `restoreRuleSuspensionTx`, sharing the transaction, nonce and IP prefix; event `false_positive`, suppression) or an admin manual suspension (back to the row's `from`, reason `restore`, `revertOf`, `detail.restoredAt` + re-armed notification on the suspension event → customer "re-enabled" e-mail only if the suspension e-mail went out); anything else is `409 not_restorable`. `reactivate` lifts the remaining suspensions (payment dispute won, system, direct panel edit) with reason `manual`; for rule/manual suspensions it answers `409 use_restore` so suppression and e-mails stay consistent. Nothing reachable by the rule engine can revoke.
- **Devices.** `deactivate` sets `deactivated` (release) or `revoked` with `end_reason admin` only when the row is still `active` (`409 not_active` otherwise); both free the seat; no status-log row (license status unchanged). Re-activation is prevented by a fingerprint block, not by the device revoke.
- **Events.** acknowledge (open), resolve and false-positive (open|acknowledged) with `expectedTriage`; the audit note records `from -> to`. `false-positive` with `restore: true` restores only the rule suspension this event caused (the license's latest status row must reference it, else `409 not_rule_suspension`); the restore core writes the single audit row (`license.restore`). Any triage of an open `system.rule_circuit_open` event closes the breaker early (L5 only counts `triage = open`).
- **Blocks.** Kinds: `ip_prefix` (canonical stored privacy prefix, /24 or /48), `cidr` (normalised, IPv4 ≥ /16, IPv6 ≥ /32), `activation` (public id), `fingerprint` (HMAC copied server-side from the device row, never sent to the browser), `license` (public id). From an event the value comes from the event row (prefix/activation/license). Durations 1 h, 24 h, 7 days or none (admins only). An active unexpired duplicate is `409 already_blocked`; a block that covers the admin's own trusted address (`requestIP` via the authenticated proxy headers) needs `confirmSelf: true` (`409 self_block_confirmation_required`, nothing written). Add and lift invalidate the API process's blocks cache (`createBlocksCache().invalidate()`, `invalidateLicensingBlocks(payload)`), so the change applies to the next request instead of after 30 s.
- **Signing key.** Rotation (or first generation) reuses the L2 service in the same transaction (`provisionSigningKeyTx`; `provisionSigningKey` now wraps it), returns only `{ code, kid }`, writes the audit row (`note: kid <kid>`) and a high `system.signing_key_rotated` event (open, admin alert queued). Environment-managed keys answer `409 environment_key_configured`; a missing or wrong master key `409 vault_key_required|vault_key_unreadable`. Tests scan responses, logs, audit and event rows for PEM, PKCS#8 prefixes, vault records and the master.
- **Settings audit.** A panel admin's save of `licensing-settings` writes one `settings.update` row in the same operation transaction (`settings-audit.ts`): changed paths with old → new values for numbers, booleans and short strings; arrays and anything containing `@` are named without values; server writes (key lifecycle) are not audited there.
- **UI.** License document sidebar `ui` field `licenseActions` (`src/admin/fields/license-actions.tsx`): status badge, reason, source, last change, devices (label, platform, IP prefix, last seen, release/revoke), last 10 status transitions, and only the actions valid for the saved state; read with the requesting admin and `overrideAccess: false`, always with `select` (no key, device key, thumbprint, fingerprint or IP hash). Security center: an "Actions" column on event and block tables (acknowledge, resolve, false positive, false positive + restore when the row is a rule suspension of a still-suspended license, block from event; lift) and an "Add block" form on the Blocks tab, shown only when `isAdminSessionUser` (the view already redirects everyone else). Signing keys tab: active kid and the rotate button. Client widgets (`src/admin/security/{action-client,actions-ui}.tsx`) import no server code; each dialog is an inline labelled region (focus to the first field and back, Escape cancels, polite live result), keeps one requestId per dialog so a network retry cannot double-apply, and refreshes the route after success. Styles reuse Payload theme tokens (`.sc-dialog`, `.sc-panel`, `.sc-btn--danger` with a text label), so light and dark follow the admin theme. TR/EN strings in `security-center-labels.ts` (`actions.*`), audited by `admin-labels.test.ts`.
- **Tests.** `licensing-admin-endpoints-db.test.ts` (authorization matrix on all 13 routes incl. cross-site, `Sec-Fetch-Site` and JSON-only; malformed/oversized/incomplete bodies; suspend with one log + one audit + queued e-mail, replay and stale; concurrency; manual and rule restore, `use_restore`, `not_restorable`, reactivate after a dispute; revoke confirmation/reason/device revocation/terminal; device release/revoke; triage and stale; event-bound restore; breaker close; blocks cache invalidation, validation, self-block confirmation, event fingerprint block without hash exposure; rotation without private material, replay, env key; settings audit) and `licensing-admin-ui.test.tsx` (side panel and rotate button render nothing for editor, customer, API-key and bearer admins; admin markup has actions but no secrets; action columns only with `canAct`).
- **Status lock (§4.1, follow-up).** `licenses.status` is read-only for every user-facing update: field access `update` is `nobodyField` (create stays panel-admin only; MCP/API key still gets the default), the field is `readOnly` in the panel with a TR+EN hint to `Lisans işlemleri`. A submitted value (panel form, REST PATCH, bulk, Local API with `overrideAccess: false`, MCP) is stripped silently while other fields save. The only writers are server code with `overrideAccess: true`, where field access does not apply: the L6b action endpoints (`source admin`), payment fulfilment/refund/dispute, and the L5 rule engine (`source rule`, still guarded by the monitor-only checks). Each keeps declaring `req.context.licenseTransition`, so exactly one `license-status-log` row per change is unchanged. Replaces the old "reason required for a direct panel edit" idea: a direct edit is no longer possible at all. A license created in the panel by an admin can still pick its initial status through a non-panel create (REST/Local API as panel admin); the panel form shows the field read-only.
- **Denied audit (follow-up).** `src/lib/licensing/admin/denied-audit.ts`: every refusal of an identified caller (user, customer, editor, API key, bearer, cross-site, 415/413/400 validation, 404, 409 stale/invalid transition/confirmation/etc.) writes a `security-audit` row `result denied` in its own transaction after the refusal. No schema change: `action` (route's audit action), `reason` = fixed response code, `note` = `count=<n> http=<status>`, `ipPrefix` /24 or /48 only, `actorUser` only for users-collection callers (`actorKind admin` for an admin, `system` otherwise), `target` when the document exists, `nonce = denied:<hash(actor-or-prefix|action|code)>:<window start ms>`. At most one row per key per 10 minutes: a repeat inside the window increments the counter of the opening row (serial writer queue, so no duplicate rows). Anonymous 401s, successful and replayed actions write nothing; failures of the audit write are logged by code and never change the response. No security event is raised: no existing event type fits repeated forbidden admin actions and a new type is a stored enum change. The security center UI is unchanged (the audit list is the Payload screen, where `result=denied` already has a label).
- **Deviations / open.** The event drawer's "suspend/revoke license" and "remove device" shortcuts link to the license document's panel instead of duplicating the actions in the table. Bulk actions remain out of scope (§5.4). `GET /api/security/*` read endpoints are not added: the view reads through the Local API (L6a).
- **Browser check** (isolated `.backup` copy, `NEXT_DIST_DIR=.next-l6b`, port 3570, throwaway admin/editor/customer, one license with two devices and two events in the copy only; build removed afterwards): the first run found that the action dialog was a `<form>` nested inside Payload's document form, so its confirm button did nothing; the dialog is now a labelled `div` region with a button and Enter handling that never reaches the document form. Second run: admin suspended and restored license 1 from the side panel (two status-log rows admin/manual and admin/restore, two audit rows, suspension event queued for the customer e-mail), acknowledged an event in `/admin/guvenlik` (audit `open -> acknowledged`); the revoke dialog shows the typed-confirmation hint; light and dark themes render; no horizontal scroll at 1440 px. Editor: the license document is not reachable (`?notFound=1`, licenses are admin-only), `/admin/guvenlik` ends at `/admin`, no action widgets, and a direct same-origin POST to `/api/licenses/1/suspend` returns `403 forbidden`. Screenshots in the scratchpad `l6b/` folder. Not covered: English admin language and screen readers in a browser (unit-tested labels only).

## L7b implementation record (legal drafts and editor guide)

Scope: documentation and legal drafts only. No `src/`, `tests/`, package, schema or migration changes. `content:import` was not run and the database was not touched. Nothing committed.

- `content/legal/tr/kvkk-aydinlatma.md`: new 2A (license and device verification data, purposes, legal basis), 6A (retention of license and security records, as §6 and the L5 record), 8A (automated rules, monitor-only default, human review, objection).
- `content/legal/tr/gizlilik-politikasi.md`: new license/device bullet group in section 1; pointer to KVKK 6A/8A in section 4 area.
- `content/legal/tr/eula.md`: new 1A (signed lease, 14-day offline default), 3B (automatic checks, suspension not revocation, objection); pointer to KVKK 2A/6A in section 8.
- `content/legal/en/*`: GDPR-style mirror of the same sections (Art. 6(1)(b) and 6(1)(f) wording).
- `docs/editor-guide.md`: new English section "Licensing and security center" (locations, actions, monitor-only and observeUntil, circuit breaker, settings, sweep timer).
- `docs/editor-guide.tr.md`: created with a one-line note and the Turkish version of the same section.
- Lawyer re-approval is required for the changed legal pages (TR and EN eula, gizlilik-politikasi, kvkk-aydinlatma). Importing them changes the `legalReview` content hash, so the approval drops and `legalReady` stays false until counsel re-approves. Every new section carries a `Hukukçu onayı gerekir` / "Requires lawyer review" note.
- The lease duration is system-wide, with a 14-day default and a 30-day maximum. Device release does not implement a deletion request. The deletion and anonymisation procedure, legitimate-interest assessment, and notice duties for automated decisions remain for review.

## L7a implementation record (customer portal devices and e-mail)

Scope: portal licenses and devices plus the customer e-mail. No schema change, no migration, no new dependency, no new stored enum value.

- **Routes.** `/hesap/lisanslar` (EN `/account/licenses`) keeps the table and adds a "Manage devices" link per license. New `/hesap/lisanslar/[id]` (EN `/account/licenses/[id]`; `id` = the license `publicId`, never the numeric id; added to `CANONICAL_PATHS`, excluded from CMS link routes). The page loads the license through the owner-scoped read (`getMyLicenseByPublicId`, `overrideAccess: false`); a foreign, unknown or malformed id is `notFound()` (404, no difference).
- **What it shows.** Product, edition, status badge with a plain-language note for suspended/revoked/expired (generic text, no reason detail, support-ticket link for suspended/revoked), expiry, seats used / `maxDevices ?? seats`, masked key, remaining release allowance, and the active devices (label or "Device N", platform, activation date, last-seen date, coarse country when stored). Never fingerprints, device keys, IP prefixes or hashes: `listPortalDevices` selects display columns only (a test greps the page and module for sensitive column names).
- **Release flow.** "Release device" is a GET link to `?kaldir=<activation publicId>` that renders a confirmation card. Its plain form posts to `releaseDeviceAction` and redirects with a notice. The action checks the full request origin, the customer session, and the per-process limit of 10 attempts per customer per 10 minutes. The list shows notices for requests refused before ownership was established. Under the shared `BEGIN IMMEDIATE` writer lock, `releasePortalDevice` verifies ownership of the license and device, rejects revoked licenses and already ended devices, and conditionally deactivates the device with `end_reason customer_portal`. Suspended and expired licenses can release existing devices without regaining entitlement.
- **Quota.** The writer reads both the current setting and the count under the same transaction. Releases with `end_reason customer_portal` in the last 30 days for that license must stay below `licensing-settings.selfService.portalDeactivationsPer30Days` (default 3, 0 disables portal release). The UI hides the buttons when nothing is left.
- **Records.** Releasing a device preserves the license status and writes one `security_events` row (`activation.ended`, source `portal`, severity info, customer/license/activation IDs, no IP, notice queued) and one `security-audit` row (`activation.deactivate`, actor kind `system`, reason `customer_portal`, `nonce = portal:<customer>:<form token>`). A retry replays the result only for the same device and a customer who still owns it. The commit is confirmed by reading the receipt and its target back.
- **E-mail.** The L5 queue sends a localized release notice with product, masked key, filtered and escaped device label, and a portal link. The current owner, activation and queued customer must match. Delivery waits for SMTP and avoids logging the recipient if SMTP is disabled after the queue's initial check. Queue kind `customerDeviceReleased`, marker `detail.notifyCustomerDeviceReleasedAt`.
- **i18n.** `portal.devices.*` and `portal.licenses.manageDevices` in `src/i18n/messages/{tr,en}.json`.
- **Tests.** `tests/unit/portal-devices-db.test.ts` (8: release writes one UPDATE + one portal event + one audit row + no status row and leaves the license status untouched; foreign customer, foreign device, malformed ids and tokens write nothing; already-ended device; quota per license, 30-day window, 0 = off; idempotent token; display-only listing; e-mail through the queue in EN with escaped label and no full key, sent once; template escaping and label cap) and `tests/unit/portal-device-action.test.ts` (8: 303 targets, cross-origin/originless refused, anonymous to login, foreign license redirect, limit/replay mapping, rate limit, TR/EN key parity, no sensitive columns in the page or module). Full suite: 112 files, 1819 tests.
- **Browser check** (isolated `.backup` copy, `NEXT_DIST_DIR=.next-l7`, port 3580, two throwaway customers in the copy only, SMTP unset): owner sees the license, two devices and 2 / 3 seats, confirms and releases one (303, notice, list shrinks, event/audit/UPDATE rows present, no status row); the other customer gets 404 on the owner's license and the owner gets 404 on the other's; no sensitive strings in the HTML. Build removed afterwards.
- **Deviations / open.** (1) No status-log row and the audit actor kind is `system`: a customer kind or a customer-visible status would need a schema/enum change. (2) The "new device activated" e-mail is NOT added: the plan marks it optional and it needs a setting (schema change) plus a hook in the L3 hot path. (3) Device label renaming is not implemented (plan §8 mentions it; the task scope did not ask for it). (4) Key reveal on the license list is unchanged.

## L8 implementation record (identity and webhook anomalies)

Files: `src/lib/licensing/events/anomalies.ts` (bounded post-response writer and event persistence), `src/collections/Users.ts` (afterLogin/afterError hooks, guarded with try/catch), `src/lib/portal/actions.ts` (portal login failures and successes), `src/lib/payments/events.ts`, `src/lib/payments/providers/stripe.ts`, `src/lib/payments/types.ts` (signature rejections), and `tests/unit/licensing-anomalies-db.test.ts` (temporary migrated SQLite DB).

Behavior:
- Failed credential checks coalesce per known account and UTC hour. Unknown accounts share one row per trusted prefix and hour. Requests without a trusted address share one unknown-prefix bucket. Lockouts are identified by the observed Payload lock expiry; requests rejected during the lock do not raise the lockout event count. Payload keeps credential validation, retry limits and lock enforcement.
- Successful panel and portal logins record informational events. Existing `auth.admin_login_failed` and `auth.portal_login_failed` values carry `detail.outcome` (`success` or `failure`). A successful admin login from a new network uses `auth.admin_new_network`. No select values or UI changed.
- Network is new when the admin has no successful login with the same prefix or UTC-month hash in the previous seven days. Prefix matching survives monthly hash rotation. Notification state is set in the same write as the event; the existing L5 queue sends the admin e-mail.
- Coalescing cap (QA): at most 20 distinct prefix-coalesced rows per event type per hour. Excess folds into one overflow row with a null prefix.
- iyzico and Stripe signature rejections coalesce per provider, trusted prefix and UTC hour. A valid signature with a malformed payload does not count. Webhook responses (400, 404, 413) are byte-identical to the previous behavior: empty body and existing cache-control header.
- Only Caddy-trusted addresses contribute network data (/24 or /48 plus monthly hash when the licensing IP key is set). Dedupe keys hold no address material. Event details use fixed strings. Observer exceptions are swallowed without logging payloads or SQL errors.
- Observations run after the response: at most one active telemetry transaction and 64 pending per process. Jobs expire after 5 s of queue time. Overload or a process restart can drop observations; committed alerts stay durable through the L5 queue.

Scope: panel coverage is the normal users REST login; portal coverage is the login action. API-key auth, GraphQL, other Local API calls, validation failures and portal rate-limit responses are not instrumented. No dependencies, schema changes or migrations.

Verification: typecheck and lint passed; full suite passed (1,848 tests, 114 files); L8 file, portal action and provider files passed (41 tests across three files, including the six L8 cases).

## L9 implementation record (client integration guide and reference verifiers)

Files:
- `docs/licensing/client-integration.md`: enrollment, renewal, updates, downloads, deactivation, curl examples, signing bytes, lease verification, errors, offline use, key handling.
- `docs/licensing/client-api.md`: device-key conflict vs seat-limit order, unsigned file/key errors, refresh times that can exceed lease expiry; clock_skew wording corrected (QA).
- `docs/licensing/test-vectors.json`: fixed signing inputs, signatures, raw UTF-8 bodies, a compact lease and its claims. `tests/unit/licensing-crypto.test.ts` checks them against the same fixed keys and fixtures as the L2 tests.
- `docs/licensing/examples/ts/` (pinned Node verifier, request canonicalization; checked by `tests/unit/licensing-client-reference.test.ts` against the vectors, including negative binding, time, nonce, body, revocation and status cases).
- `docs/licensing/examples/csharp/` (.NET 8+ verifier with Linux OpenSSL 3 backend, standalone vector runner). Not compiled: no `dotnet` on the QA machine. C# rejection checks were added in QA.
- `scripts/licensing-sim.ts` and `pnpm licensing:sim` (`--help` available): disposable client that signs activate, validate, updates, download-link and deactivate, verifies replies and both leases, streams a file GET into a SHA-256 digest, and attempts deactivation after a confirmed enrollment even if a later step fails.

Verification: typecheck passed; 27 L2/client-reference tests passed; simulator help ran. QA ran `pnpm licensing:sim` end to end against an isolated server on a DB copy: activate, validate, updates, downloads/link, download and deactivate all succeeded. The C# example is pending compilation. No server, schema, migration or dependency changes. The 1,833-pass full run had timeouts in three unrelated suites (block-motion migration, media pipeline, SQLite integrity); they passed on a single worker.

Open: compile and run the C# example on a host with dotnet.

## L10 implementation record (deployment, security audit and fixes)

Scope: deployment config, operations runbook, preflight helper, and fixes from the independent audit (F-01..F-09). No schema change, migration or dependency change. Nothing committed by the implementation itself. The isolated browser recheck used a DB copy and port 3400/3500 only; `data/*.db`, port 3100 and `.next` were not touched.

**Deploy changes**
- `deploy/Caddyfile`: `lisans.{$DOMAIN}` block. Allowlisted licensing paths only, L3 authenticated client-address headers, client `CF-IPCountry` stripped, 8 KiB request body cap, upstream timeouts, access logging skipped. The main site block is unchanged.
- `deploy/softmarket.service`: explicit `--hostname 127.0.0.1`, `SOFTMARKET_READ_ONLY_RELEASE=1` (in-memory ISR), writable Corepack cache, optional writable `.next/cache`. Data, uploads and Litestream paths stay writable.
- `deploy/litestream.service`: private temp directory. Timers and existing env file handling kept.
- `pnpm licensing:preflight` (`scripts/licensing-preflight.ts`): read-only Linux VPS check of uploads root, L4 file confinement, active public signing metadata and proxy secret. Fixed-label failures, no input values echoed.
- `docs/licensing/operations.md`: runbook, DB and vault-master backup pairing, isolated load-test commands.

**Audit verdicts**

| ID | Verdict | Fix |
|---|---|---|
| F-01 | Confirmed | Separate limiters per namespace, LRU eviction, `global` in its own capacity-1 limiter. Overflow budget shares new keys, active budgets kept. |
| F-02 | Confirmed | IP limited before account. Portal auth uses IPv4 address or IPv6 /48. Public forms keep deny-on-overflow. |
| F-03 | Confirmed | `csrf` and users cookie from `payloadSessionConfig()`. Exact origin from `NEXT_PUBLIC_SERVER_URL`. Loopback aliases allowed on plain HTTP; Secure otherwise. |
| F-04 | Confirmed | Denied audit: in-memory 10-minute window reserved before the writer lock, max 4 writes in flight. Repeats write nothing. |
| F-05 | Partially confirmed | Caddy strips client `CF-IPCountry` and skips licensing logs. Header trusted only with `countrySource=cloudflare_header` and proxy secret. Cloudflare topology not shipped. |
| F-06 | Confirmed | API-key license create (REST or MCP) emits `license.created_via_mcp` at `info` in the create transaction. Panel creates emit nothing. |
| F-07 | Partially confirmed | Key buffers zeroed. Config load before traffic rejection kept by design (residual). |
| F-08 | Confirmed | Successful validate, updates and download-link nonce receipts pruned after 1 day. Activate, deactivate and admin rows keep `auditYears`. |
| F-09 | Confirmed | Customer licensing e-mails require SMTP at send time. Unavailable SMTP leaves the row pending. |

**Final QA fixes (Sol 6.2 High)**
- Limiter overflow budget and portal IPv6 /48 grouping. Pooled observations cannot trigger individual blocks.
- Staff REST login blocked cross-origin before cookie issue. Preview origin checks fixed behind HTTPS proxies (ports, loopback aliases, IPv6, trailing slash).
- Caddy restricted to canonical licensing routes, 8 KiB body cap (matches app guard), download-token paths and proxy secret redacted from runtime logs. systemd override removes packaged `--environ`.
- Denied-audit cache bounded (10,000 keys); saturation skips new keys. Original 10-minute deadline kept across cold caches.
- Read-only release sets `isrFlushToDisk` off (in-memory ISR); pnpm services get a writable Corepack cache.
- SMTP-gated e-mails at send time (`licensing.ts`, `license-assigned.ts`); preflight percent-decoding matches SQLite.

**Test results**
- `pnpm typecheck`: passed. `pnpm lint`: passed.
- `pnpm test --maxWorkers=4 --hookTimeout=30000`: 115 files, 1,880 tests passed.
- Isolated e2e: 30/30. Manual browser recheck on 127.0.0.1 and localhost: admin panel, Live Preview, publish/ISR, license actions, portal device release.
- Caddy route and body-limit parity, shell syntax and `git diff --check` passed.
- Load: local HTTP p95 718 ms (target 250 ms). Not met locally.

**Open VPS items**
- DNS for `lisans.{$DOMAIN}`, TLS, and matching proxy secret on app and Caddy.
- Validate Caddy and systemd units on the VPS (`caddy validate`, unit override).
- Provision the licensing signer (`pnpm licensing:keygen`), then verify `GET /api/v1/licensing/keys`.
- Back up `SOFTMARKET_SECRETS_KEY` with the DB. Losing it makes stored secrets unreadable.
- Run `pnpm licensing:preflight` on Linux.
- Load test against the VPS: p95 must be below 250 ms. Local result 718 ms.

**Residual risks**
- F-01/F-02: an attacker with more than 10,000 distinct keys in one window can evict its own buckets. Global throughput limit still applies.
- F-03: `Sec-Fetch-Site: same-site` without `Origin` is accepted for GET navigations. Browser writes carry `Origin` and are checked exactly.
- F-04: a flood across many keys can drop denied-audit rows.
- F-05: enabling Cloudflare needs the documented Caddy changes.
