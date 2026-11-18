# SoftMarket licensing client API v1

Use HTTPS with the licensing hostname supplied for your product. The base path is `/api/v1/licensing`. Generate an Ed25519 key pair for each device and license binding. Store the private key in the OS credential store and send only the 32-byte public key. Pin the vendor's trusted signing keys and issuer in the program.

## Endpoints

All POST bodies are UTF-8 JSON, limited to 8,192 bytes. Use `Content-Type: application/json`. Additional request fields are rejected. Clients should ignore additional response fields.

| Method and path | Request body | HTTP 200 response |
|---|---|---|
| `POST /activate` | `licenseKey`, `productCode`, `fingerprint`, `devicePublicKey`, `platform`, `appVersion`, optional `deviceLabel` and `arch` | `activationId`, `lease`, `refreshAfter`, `serverTime` |
| `POST /validate` | `ctr` from the saved lease, `fingerprint`, `appVersion` | `lease`, `refreshAfter`, `serverTime` |
| `POST /deactivate` | `{}` or `{"reason":"user"}`. Other reasons are `uninstall` and `transfer`. | `{"deactivated":true}` |
| `POST /updates` | `channel` (`stable`, `beta`, or `lts`), `currentVersion`, `os`, optional `arch` | `{latest: null}` or `{latest: {version, releaseDate, channel, notesUrl, mandatory: false, downloads: [{id, os, arch, size, sha256?}]}}` |
| `POST /downloads/link` | `downloadId` from `/updates` or another known download record | `{url, expiresAt}`. Resolve the relative URL against the licensing origin. `expiresAt` is Unix seconds. |
| `GET /dl/<token>` | No body or device headers. Optional `Range` and `If-Range`. | File attachment at 200, or 206 for a single byte range. |
| `HEAD /dl/<token>` | No body or device headers | Full representation headers at 200, with an empty body. |
| `GET /keys` | No body or device headers | `keys` with `{kid, alg: "EdDSA", x}` entries and `revokedKids`. Diagnostics are unsigned and cacheable for one hour. Use your existing trusted channel for key and revocation updates. |

`fingerprint` is an unpadded base64url encoding of a stable 32-byte hash. One option is SHA-256 over UTF-8 `sm-fp-v1|<productCode>|<stable hardware IDs>`, with a deterministic encoding of the hardware IDs. Keep the same fingerprint algorithm throughout the life of the activation. Send only the hash. `devicePublicKey` is the unpadded base64url encoding of the raw 32-byte Ed25519 key. `platform` is `windows`, `macos`, `linux` or `other`. `appVersion` is a semantic version of at most 32 characters. `arch` accepts up to 32 characters without control characters. `deviceLabel` is optional, holds up to 64 characters without control characters, and should be a generic device name.

The license key is used at activation. Save the successful activation ID and lease atomically in secure local storage. Retrying activation with the same fingerprint and device key, using a fresh nonce, returns the same active device ID. Replacing that key uses the rebind quota. A successful deactivation releases the seat. Delete the local lease after verifying the response. An exact, still-fresh, authenticated retry of a successful deactivation returns the same acknowledgment.

## Request and response signatures

For each POST set `SM-Activation` to `-` for activation and the issued `act_…` ID for other requests. Set `SM-Timestamp` to Unix seconds as a canonical decimal integer and `SM-Nonce` to 16 fresh CSPRNG bytes in unpadded base64url. Put the 64-byte Ed25519 signature in `SM-Signature`, also unpadded base64url. Sign the UTF-8 lines below with the device private key. Use a single LF between lines and omit the final LF.

```text
SM1-REQ
POST
/api/v1/licensing/validate
<SM-Timestamp>
<SM-Nonce>
<SM-Activation>
<lowercase hex SHA-256 of the exact transmitted body bytes>
```

Use the actual path for the operation and omit the query string. Serialize once and reuse those bytes for the hash and the body. A different nonce or corrected clock requires a new signature. The server accepts ±300 seconds by default.

Before acting on any POST response, use the pinned key identified by `SM-Key-Id` to verify the unpadded base64url `SM-Response-Signature`. The key must still be trusted and unrevoked. Use the nonce you sent and hash the exact response entity bytes after HTTP decompression and before parsing the JSON.

```text
SM1-RES
<decimal HTTP status>
<request SM-Nonce>
<lowercase hex SHA-256 of the exact response body bytes>
```

The server signs errors with the same nonce when it can load a signer. If the nonce is missing or malformed, the server uses `-`. An unverifiable response has the same effect as a network failure.

## Updates and licensed downloads

Use the same POST signatures for `/updates` and `/downloads/link`. Both share the existing per-activation request budget with `/validate`. Eligibility comes from the enrolled device and current license. The server selects the highest SemVer newer than `currentVersion` in the exact requested channel with a release date at or before the server time. `currentVersion` is limited to 32 characters, and build metadata has no precedence. `notesUrl` points to the product group on the English release-notes page. Resolve it against the licensing origin.

Supported OS values are `windows`, `macos`, `linux`, `web`, `android`, `ios`, and `other`. Supported architectures are `x64`, `arm64`, `x86`, and `universal`. With an architecture specified, matching downloads include that architecture, universal installers, and installers whose architecture is unspecified (`null`). Omitting `arch` returns all architectures for the OS. `size` is the upload's recorded byte count. Verify `sha256` after receiving the full file when the catalog supplies it. A newer release can have an empty download list for your platform.

Keep the returned URL private. It is a bearer credential for one download and expires in five minutes. The API checks the activation, license, and file binding again on each request. Download managers can use it without adding device headers. Each authorized GET that starts a transfer, including an interrupted transfer, spends one of five uses. HEAD and rejected Range requests spend none. Expired, exhausted, or lost links can be replaced by signing a fresh `/downloads/link` request. Restarting the single API process invalidates outstanding links.

- GET without Range returns 200. A single closed, open-ended, or suffix byte range returns 206 with `Content-Range`, `Content-Length`, and `Accept-Ranges: bytes`. An end beyond EOF is clamped.
- Invalid ranges, multiple ranges, and ranges starting beyond EOF return 416 with `Content-Range: bytes */<size>`. HEAD ignores Range.
- For a resumed transfer, send the strong `ETag` from the previous response in `If-Range`. A mismatched, weak, or date validator gives 200 with the full representation. Replace any partial bytes in that case. File responses have `Cache-Control: private, no-store, no-transform`.
- GET and HEAD responses are unsigned, including errors. Treat file-route errors as transfer failures and use a signed POST for license status decisions.

## Leases and offline use

Verify the Ed25519 compact JWS with a pinned, unrevoked key. Require protected header `alg: EdDSA`, `typ: sm-lease+jwt` and a known `kid`. Require `v: 1`, `st: active`, the expected issuer (`iss`), product code (`aud`), activation ID (`sub`), license ID (`lid`), local fingerprint (`fp`) and base64url SHA-256 digest of the raw device public key (`dkt`). On initial activation, learn the opaque `lic_…` ID from the verified lease in the authenticated response and persist it with the activation. Check `nbf <= now < exp` using Unix seconds. `sku` identifies the edition and `seats` gives the device limit. `lexp` is the license expiry in ISO 8601 or `null` for perpetual licenses.

Refresh in the background after `rfa` (`refreshAfter`), normally 24 hours after issuance. Serialize refreshes for each activation and replace the cached lease and its `ctr` together. The lease remains usable offline up to `exp`, normally 14 days from issuance, capped by the license expiry. There is no grace period beyond `exp`. After a network failure, an unverifiable response or a temporary service error, retain the last verified lease and retry with backoff. An authenticated `403 license_*` or `403 activation_revoked` invalidates the cached lease. A device that stays offline cannot learn about a suspension or refund before its cached lease expires.

## Error codes

Errors return `{"error":{"code":"…"},"serverTime":<unix seconds>}`. Rate and service limits can add `error.retryAfter` and a `Retry-After` header in seconds. For signed responses, use the authenticated body value. `seat_limit` adds top-level `used` and `max`.

| HTTP | Codes | Client handling |
|---|---|---|
| 400 | `bad_request`, `clock_skew` | Check serialization and input. For authenticated skew, offset the request timestamp using `serverTime` and retry with a fresh nonce. |
| 401 | `invalid_signature`, `invalid_license`, `invalid_token` | For signed requests, check the device binding, fresh nonce, key and product code. For file URLs, request a fresh link. |
| 403 | `license_suspended`, `license_revoked`, `license_expired`, `license_not_started`, `activation_revoked`, `blocked`, `download_unavailable` | Only use verified POST responses to decide license status. Missing, foreign, or unavailable downloads share `download_unavailable`. |
| 409 | `seat_limit`, `rebind_limit` | Show the device limit or rebind quota. An authorized user may need to free a seat. |
| 416 | `range_not_satisfiable` | Use the reported size to correct the single range, or retry a full GET. |
| 429 | `rate_limited` | Back off and retry with a fresh nonce. |
| 503 | `unavailable` | Keep working with an unexpired verified lease. |
| 500 | `internal` | Keep the eligible cached lease and retry with backoff. |

## Device changes and seat limits

If the device fingerprint changes, the client must deactivate the old activation (or generate a new device key) before activating again. Otherwise activate returns `invalid_license`.

Lowering `maxDevices` on a license does not end devices that are already active. The new limit applies only to new activations.
