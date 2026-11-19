# L3 licensing load results

The in-process run used Node 24.22.2, Payload 3.93.0 and a fresh temporary SQLite database with the complete migration chain. The harness sent signed Fetch API requests through the route handlers. It measured elapsed time through response-body consumption. Concurrent validation used 100 activation IDs and separate prefixes. The fixture raised the global admission limit for the burst and used the default 60-per-minute prefix limit for the single-prefix test.

| Scenario | Result |
|---|---|
| 100 concurrent validations, 10 rounds | 1,000 successful responses. p50 48.2 ms, p95 70.2 ms, p99 75.9 ms. No queue timeouts surfaced. |
| 1,000 validations from one prefix over 10 seconds | 69 accepted, 931 returned 429. There were 69 durable nonce rows and one aggregate rate-limit row with count 931. |
| 50 concurrent activations and one staff write | Exactly 3 active devices, 47 seat-limit responses. The staff write committed. No SQLite busy failures surfaced. |

The initial one-commit-per-validation run had p95 592.4 ms and p99 614.8 ms. The final design takes up to 16 validations already waiting when the writer lock becomes available. Each request uses a savepoint, and the service independently confirms the resulting nonce receipts after the shared commit. New work enters the existing serializer immediately. Observations use a separate flush path.

To reproduce against a fresh temporary database, run `node --import tsx scripts/licensing-load.ts`. After producing an isolated `.next-l3` production build against a temporary database, add `--http` to exercise it on port 3600. The isolated production build passed and listed all four licensing routes. The sandbox denied binding a local TCP socket (`EPERM`), so production HTTP was verified later (see the section below); target VPS latency remains unverified.

## Production HTTP run (loopback)

The run used the isolated `.next-l3` production build served by `next start` on 127.0.0.1:3600 (Node 24, SQLite temp database with the full migration chain, `node --import tsx scripts/licensing-load.ts --http`). Client and server shared one machine, so these numbers include load-generator overhead and are not VPS numbers.

| Scenario | Result |
|---|---|
| 100 concurrent validations, 10 rounds | 1,000 successful responses, 0 errors. p50 383.9 ms, p95 717.7 ms, p99 750.2 ms. |
| 1,000 validations from one prefix over 10 seconds | 69 accepted, 931 returned 429. 69 audit rows and one aggregate rate-limit event with count 931. |
| 50 concurrent activations and one staff write | Exactly 3 active devices, 47 seat-limit responses (409). The staff write committed. |

Seat limits held. Latency is roughly 8x the in-process run because every request now crosses HTTP, Next middleware and a single-writer SQLite path on a shared machine. Target VPS latency remains unmeasured.

Harness fixes made for this run: the readiness probe now sends the proxy-secret and client-IP headers, and the server is started through `node_modules/.bin/next` so the pnpm `NODE_PATH` (needed for the externalised `libsql` package) is preserved.

## L4 production HTTP smoke (updates, download link, `/dl/<token>`)

The run used an isolated `.next-l4http` production build served by `next start` on 127.0.0.1:3560 (Node 24.22.2) against a backup copy of the development database, with a temporary uploads directory reached through a symlinked root (`release/uploads` pointing to `shared/uploads`, mirroring the VPS layout). A 3,145,851-byte random file served as the licensed download. Client and server shared one machine, so latencies are not VPS numbers. No download scenario exists in `scripts/licensing-load.ts`; a throwaway driver (not committed) signed the requests with the test client helpers.

| Check | Result |
|---|---|
| activate / updates / downloads/link | 200 each, response signatures verified. 534 ms (first activation), 13 ms, 12 ms. Link TTL 300 s. |
| updates payload | Latest 3.2.1, one download, catalog SHA-256 equals the source file. |
| GET `/dl/<token>` full | 200, 3,145,851 bytes, SHA-256 equals the source. 9.6 ms (about 312 MB/s on loopback). `Accept-Ranges: bytes`, `Cache-Control: private, no-store, no-transform`, attachment filename. |
| Range `bytes=1000-1999` | 206, `Content-Range: bytes 1000-1999/3145851`, 1,000 bytes identical to source. |
| Suffix `bytes=-500` | 206, `Content-Range: bytes 3145351-3145850/3145851`, bytes identical. |
| Range beyond EOF / multi-range | 416 (`Content-Range: bytes */3145851`) / 416. |
| HEAD | 200, Content-Length 3145851, ETag present, no body. |
| Use limit | Served transfers count (full, range, suffix = 3); two more succeeded, then 401 from the sixth. 416 and HEAD did not consume a use. A fresh token: five 206 responses, sixth 401. |
| Tampered signature / tampered payload | 401 `invalid_token` / 401. |
| Expired token (305 s after issue) | 401 `invalid_token`. |
| Observation | A token replayed with a different `X-Softmarket-Client-IP`, or with a wrong proxy secret, was still served (200). The token binds activation and download, not the client address; with a bad proxy secret the request falls into the unknown-address path. Confirm this matches the intended L4 binding design. |

The temporary build, database copy and uploads copy were removed or live only in the session scratchpad. Target VPS behaviour (`/proc/self/fd` real-name check, Caddy) remains unmeasured.

The [VPS acceptance checklist](operations.md#vps-acceptance-checklist) gives the isolated production HTTP commands and the L10 p95 target of 250 ms.
