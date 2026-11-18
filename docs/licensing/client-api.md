# SoftMarket licensing client API v1

Use HTTPS with the licensing hostname supplied for your product. The base path is `/api/v1/licensing`. Generate an Ed25519 key pair for each device and license binding. Store the private key in the OS credential store and send only the 32-byte public key. Pin the vendor's trusted signing keys and issuer in the program.

## Endpoints

All POST bodies are UTF-8 JSON, limited to 8,192 bytes. Use `Content-Type: application/json`. Additional request fields are rejected. Clients should ignore additional response fields.

| Method and path | Request body | HTTP 200 response |
|---|---|---|
| `POST /activate` | `licenseKey`, `productCode`, `fingerprint`, `devicePublicKey`, `platform`, `appVersion`, optional `deviceLabel` and `arch` | `activationId`, `lease`, `refreshAfter`, `serverTime` |
| `POST /validate` | `ctr` from the saved lease, `fingerprint`, `appVersion` | `lease`, `refreshAfter`, `serverTime` |
| `POST /deactivate` | `{}` or `{"reason":"user"}`. Other reasons are `uninstall` and `transfer`. | `{"deactivated":true}` |
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

## Leases and offline use

Verify the Ed25519 compact JWS with a pinned, unrevoked key. Require protected header `alg: EdDSA`, `typ: sm-lease+jwt` and a known `kid`. Require `v: 1`, `st: active`, the expected issuer (`iss`), product code (`aud`), activation ID (`sub`), license ID (`lid`), local fingerprint (`fp`) and base64url SHA-256 digest of the raw device public key (`dkt`). On initial activation, learn the opaque `lic_…` ID from the verified lease in the authenticated response and persist it with the activation. Check `nbf <= now < exp` using Unix seconds. `sku` identifies the edition and `seats` gives the device limit. `lexp` is the license expiry in ISO 8601 or `null` for perpetual licenses.

Refresh in the background after `rfa` (`refreshAfter`), normally 24 hours after issuance. Serialize refreshes for each activation and replace the cached lease and its `ctr` together. The lease remains usable offline up to `exp`, normally 14 days from issuance, capped by the license expiry. There is no grace period beyond `exp`. After a network failure, an unverifiable response or a temporary service error, retain the last verified lease and retry with backoff. An authenticated `403 license_*` or `403 activation_revoked` invalidates the cached lease. A device that stays offline cannot learn about a suspension or refund before its cached lease expires.

## Error codes

Errors return `{"error":{"code":"…"},"serverTime":<unix seconds>}`. Rate and service limits can add `error.retryAfter` and a `Retry-After` header in seconds. For signed responses, use the authenticated body value. `seat_limit` adds top-level `used` and `max`.

| HTTP | Codes | Client handling |
|---|---|---|
| 400 | `bad_request`, `clock_skew` | Check serialization and input. For authenticated skew, offset the request timestamp using `serverTime` and retry with a fresh nonce. |
| 401 | `invalid_signature`, `invalid_license` | Check the device binding, fresh nonce, key and product code. Unavailable or mismatched license credentials share one code. |
| 403 | `license_suspended`, `license_revoked`, `license_expired`, `license_not_started`, `activation_revoked`, `blocked` | Show the relevant status after verification. Retain an unexpired cached lease on `blocked`. |
| 409 | `seat_limit`, `rebind_limit` | Show the device limit or rebind quota. An authorized user may need to free a seat. |
| 429 | `rate_limited` | Back off and retry with a fresh nonce. |
| 503 | `unavailable` | Keep working with an unexpired verified lease. |
| 500 | `internal` | Keep the eligible cached lease and retry with backoff. |

## Device changes and seat limits

If the device fingerprint changes, the client must deactivate the old activation (or generate a new device key) before activating again. Otherwise activate returns `invalid_license`.

Lowering `maxDevices` on a license does not end devices that are already active. The new limit applies only to new activations.
