# SoftMarket licensing client integration

Use the vendor’s HTTPS licensing origin and its trusted Ed25519 public keys. This guide uses paths relative to `/api/v1/licensing`. See the [endpoint schemas](client-api.md#endpoints), [TypeScript verifier](examples/ts/README.md), [C# verifier](examples/csharp/README.md), and [shared L2 vectors](test-vectors.json).

## Enroll, refresh, update, and deactivate

1. Generate an Ed25519 pair for this installation and license binding before activating. Keep the private key in the OS credential store. Compute the fingerprint once from a stable, deterministic encoding of your device identifiers. For example, send base64url of SHA-256 over UTF-8 `sm-fp-v1|<productCode>|<stable hardware IDs>`. Send the hash and the raw 32-byte public key in unpadded base64url.
2. Sign `POST /activate` with the device key using `SM-Activation: -`. Send the license key, product code, fingerprint, device public key, platform, and app version. Verify the response signature and then the lease. Use the authenticated `activationId` as the expected lease subject and learn the opaque license ID from the verified lease. Save the binding and lease atomically before use.
3. At startup verify the cached lease using the local fingerprint and device public key. At or after `rfa`, refresh in the background if online. Send `POST /validate` with `ctr` from the last verified lease, the fingerprint, and app version. Verify its response and lease against the stored binding and replace the lease and its counter atomically. Serialize refreshes across processes for each activation. The server rotates `ctr` on a successful validation. Depending on the rules setting, a value matching neither the current nor the previous counter can produce a clone observation, even when validation succeeds.
4. Use `POST /updates` for the newest release above the installed SemVer in the requested channel, then send `POST /downloads/link` with a positive integer `downloadId`. The signed update reply can have `latest: null` or an empty installer list. An eligible download can also be addressed by a known ID. Resolve the authenticated link against the licensing origin and fetch it without device headers. Treat the URL as a secret, use it within five minutes, and verify the full file against the signed catalog's size and SHA-256 when supplied. Check the installer's vendor signature where available before executing it. Each authorized GET spends one of five uses, including interrupted transfers. See [range and resumption behavior](client-api.md#updates-and-licensed-downloads).
5. Send `POST /deactivate` with `{}` or with `reason` set to `user`, `uninstall`, or `transfer`. Verify the signed `{"deactivated":true}` acknowledgment and remove the cached lease. The server can recognize an exact authenticated retry within the clock window. A fresh valid request against a device previously deactivated by this endpoint can also be acknowledged when otherwise eligible. The server records the end reason as `user` for all three accepted request reasons. If removal cannot be confirmed, have the user release the seat in the customer portal.

On an uncertain activation result, reuse the same device key and fingerprint and sign with a fresh nonce. An existing active binding for that license and fingerprint with the same public key returns its existing activation ID. Changing the key on that binding can consume rebind quota. With a new fingerprint and the old key still active, activation can fail with `seat_limit` or `invalid_license`, depending on the device limit. Removing the old activation frees its seat.

## Sign requests and verify responses

POST JSON is UTF-8 and limited to 8,192 bytes. Use `Content-Type: application/json` (the server also accepts `charset=utf-8`). Serialize once and send those exact bytes. Use `SM-Timestamp` as canonical decimal Unix seconds, `SM-Nonce` as 16 fresh random bytes in unpadded base64url, and `SM-Activation` as `-` on activate or the issued `act_` ID otherwise. The default clock tolerance is ±300 seconds. Construct these UTF-8 lines using one LF between lines and no final LF.

```text
SM1-REQ
POST
/api/v1/licensing/validate
<SM-Timestamp>
<SM-Nonce>
<SM-Activation>
<lowercase hex SHA-256 of exact transmitted body>
```

Replace the path line with the path for the operation and exclude the query string. Put the pure Ed25519 signature over this entire string in `SM-Signature` as 64 bytes encoded in unpadded base64url. Use a fresh nonce and recompute the signature for ordinary retries, even when the JSON is identical.

For every POST response, capture the status and the body bytes after HTTP decompression, before JSON parsing. Select a unique trusted key by `SM-Key-Id` and verify the unpadded base64url `SM-Response-Signature` over these UTF-8 lines, again without a final LF.

```text
SM1-RES
<decimal HTTP status>
<request SM-Nonce>
<lowercase hex SHA-256 of exact response body>
```

Use the nonce from the request in flight. For an incoming request with no valid nonce the server signs using `-` when it has a signer. A client that sent a valid nonce must still check its original value. Treat unsigned or unverifiable POST responses as transport failures. Read authentication-sensitive fields only from the verified body. Headers such as `Date` and `Retry-After` are outside the signature. The file route and `GET /keys` are unsigned. `GET /keys` is useful for diagnostics. Distribute pins and revocations through your trusted update channel.

The published wire vectors use a sample UTF-8 body with a trailing LF to test byte preservation. Use the endpoint schemas when sending actual requests.

### curl examples

These shell examples use OpenSSL 3, curl, and jq. Use a disposable test license and a test environment. Set `LICENSE_KEY`, `PRODUCT`, and `BASE` first. The fingerprint below models a stable test installation ID for one run. Keep the scratch directory private because it contains the device private key, activation payload, and download link.

```sh
umask 077
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

b64url() { openssl base64 -A | tr '/+' '_-' | tr -d '='; }
openssl genpkey -algorithm ED25519 -out "$work/device.pem"
pub=$(openssl pkey -in "$work/device.pem" -pubout -outform DER | tail -c 32 | b64url)
installation=$(openssl rand -hex 16)
fp=$(printf '%s' "sm-fp-v1|$PRODUCT|$installation" | openssl dgst -sha256 -binary | b64url)

post() {
  path="/api/v1/licensing/$1"
  activation=$2
  timestamp=$(date +%s)
  nonce=$(openssl rand 16 | b64url)
  hash=$(openssl dgst -sha256 -r "$work/body" | cut -d ' ' -f 1)
  printf '%s\n%s\n%s\n%s\n%s\n%s\n%s' \
    SM1-REQ POST "$path" "$timestamp" "$nonce" "$activation" "$hash" > "$work/request"
  sig=$(openssl pkeyutl -sign -rawin -inkey "$work/device.pem" -in "$work/request" | b64url)
  printf '%s' "$nonce" > "$work/nonce"
  curl --silent --show-error --compressed --request POST \
    --header 'Content-Type: application/json' --header "SM-Activation: $activation" \
    --header "SM-Timestamp: $timestamp" --header "SM-Nonce: $nonce" \
    --header "SM-Signature: $sig" --data-binary "@$work/body" \
    --dump-header "$work/headers" --output "$work/reply" --write-out '%{http_code}' \
    "$BASE$path" > "$work/status"
}

LICENSE_KEY="$LICENSE_KEY" jq -nc --arg product "$PRODUCT" --arg fp "$fp" --arg pub "$pub" \
  '{licenseKey:env.LICENSE_KEY,productCode:$product,fingerprint:$fp,devicePublicKey:$pub,platform:"linux",appVersion:"1.0.0"}' > "$work/body"
post activate -
```

Verify the saved response using `headers`, `status`, `nonce`, and the decompressed `reply`. Verify the returned lease. Set `ACT` and `CTR` from that verified exchange before running validate.

```sh
jq -nc --arg ctr "$CTR" --arg fp "$fp" \
  '{ctr:$ctr,fingerprint:$fp,appVersion:"1.0.0"}' > "$work/body"
post validate "$ACT"
```

Verify each response before making the next call. After validate, accept the refreshed lease. After updates, set `DOWNLOAD_ID` from the verified catalog. After the link response, set `DOWNLOAD_PATH` to its verified relative `/api/v1/licensing/dl/…` path, then fetch the file.

```sh
printf '%s' '{"channel":"stable","currentVersion":"1.0.0","os":"linux","arch":"x64"}' > "$work/body"
post updates "$ACT"
# Verify the response and set DOWNLOAD_ID.
jq -nc --argjson id "$DOWNLOAD_ID" '{downloadId:$id}' > "$work/body"
post downloads/link "$ACT"
# Verify the response and set DOWNLOAD_PATH.
curl --fail --silent --show-error --output "$work/installer" "$BASE$DOWNLOAD_PATH"

printf '%s' '{"reason":"uninstall"}' > "$work/body"
post deactivate "$ACT"
# Verify the acknowledgment before deleting the local lease.
```

The simulator performs the whole flow, verifies every POST and downloads the file into a streaming hash. Use a dedicated test license because it creates and releases an activation. It takes the license key from `SOFTMARKET_SIM_LICENSE_KEY`. `--issuer` is the configured HTTPS lease issuer, which can differ from the transport origin for a loopback test server. Use `--download-id` if the test catalog lacks a matching newer release. That fallback has no catalog size or digest unless the ID also appears in the signed update result.

```sh
pnpm licensing:sim --url https://licensing.example.com --issuer https://licensing.example.com \
  --product studio-pro --server-key "$PINNED_RAW_ED25519_PUBLIC_KEY" --os linux --arch x64
```

## Verify a cached lease

1. Require a compact JWS of at most 4,096 characters with exactly three nonempty canonical, unpadded base64url segments. Require a 64-byte signature and a compact UTF-8 JSON protected header with exactly `alg: "EdDSA"`, `typ: "sm-lease+jwt"`, and `kid`. Reject duplicate fields. The header may only select from the caller’s pinned keys.
2. Check the selected key against trusted revocations. Its `kid` is the base64url SHA-256 of its raw 32-byte public key. Verify pure Ed25519 over the original ASCII `encodedHeader.encodedPayload`. With trusted retirement metadata, allow overlap for 90 days after retirement and reject leases whose `iat` is later than that retirement time. Revocation takes effect as soon as trusted revocation data is available.
3. Parse the authenticated payload as compact UTF-8 JSON. Require the exact v1 claims `iss`, `aud`, `sub`, `lid`, `sku`, `seats`, `fp`, `dkt`, `iat`, `nbf`, `exp`, `rfa`, `lexp`, `ctr`, `st`, and `v`. Require `v: 1`, `st: "active"`, a nonempty `sku`, positive integer `seats`, and a canonical 16-byte base64url `ctr`. Match the pinned HTTPS issuer, product code, activation ID, stored license ID, local fingerprint and local device thumbprint. Compute `dkt` as base64url of SHA-256 over the raw device public key bytes. Both `fp` and `dkt` encode 32 bytes. `sub` starts with `act_`, `lid` with `lic_`, and each suffix has 24 lowercase hex characters.
4. Check integer Unix seconds. Require `nbf == iat`, `nbf <= now < exp`, a positive lifetime of at most 30 days, and `rfa - iat` equal to 1–168 whole hours. `lexp` is an ISO 8601 date-time with time zone or null. If present, require `exp` at or before its whole Unix second. `rfa` may be later than `exp`. The activate and validate replies also carry `serverTime == iat` and `refreshAfter == rfa`.

## Errors and offline behavior

Application errors use `{"error":{"code":"…"},"serverTime":<unix seconds>}`. When a retry delay is present, `error.retryAfter` and `Retry-After` are in seconds. Use the body value on a verified POST. `seat_limit` adds top-level `used` and `max`.

| HTTP | Codes | Client handling |
|---|---|---|
| 400 | `bad_request`, `clock_skew` | Fix the body or signing input. On verified clock skew, use `serverTime` to correct the request timestamp and sign again with a fresh nonce. |
| 401 | `invalid_signature`, `invalid_license`, `invalid_token` | Check the device binding, nonce, license key, and product. `invalid_signature` also covers nonce replay and a mismatched validate fingerprint. On an invalid file token, get a fresh signed link. |
| 403 | `license_suspended`, `license_revoked`, `license_expired`, `license_not_started`, `activation_revoked`, `blocked`, `download_unavailable` | Invalidate the cached lease for an authenticated POST reporting a listed `license_*` or `activation_revoked`. `blocked` reports a policy block. `download_unavailable` means the requested download cannot be served. File-route errors are transfer failures. |
| 409 | `seat_limit`, `rebind_limit` | Display the limit and let the user manage devices in the portal. |
| 416 | `range_not_satisfiable` | Use `Content-Range: bytes */<size>` to correct the single range or retry a full GET. |
| 429 | `rate_limited` | Honor the retry delay and back off. |
| 503 | `unavailable` | Retry with backoff. The API can return this when disabled or when no signer is available. |
| 500 | `internal` | Retry with backoff. |

The default refresh interval is 24 hours and the default offline lease is 14 days, capped by license expiry. After a timeout, unverifiable reply, rate limit, or transient server failure, continue only while the last verified lease is valid. Back off with jitter, keeping any verified retry delay as a minimum. Schedule renewal before `exp` if expiry comes first. At expiry, require network renewal before enabling licensed features. Offline devices can continue using an eligible cached lease until expiry even if the license was suspended, refunded, or revoked in the meantime. A lost or reinstalled device key requires enrollment again.

## Protect local state

Use OS-backed storage such as Keychain, DPAPI-backed storage, or a Linux Secret Service. Use a non-exportable Ed25519 key when the platform supports it. Scope the key to the installation and license binding and avoid syncing it across devices. Keep the license key only if your product explicitly needs it for recovery. Exclude private keys, license keys, lease contents, raw identifiers, and bearer download URLs from logs, crash reports, and telemetry. Treat the cached lease, license ID, and activation ID as local state and write replacements atomically.

Ship the key pins in signed application builds or authenticated trust updates, and publish replacement keys before switching signers. Prefer signed installers and updates. Obfuscation can raise the cost of patching local checks. Keep the verifier small and auditable, keep server signing keys off the client, and design update and download access around the server’s entitlement checks. Local license enforcement remains patchable on a device controlled by the user.
