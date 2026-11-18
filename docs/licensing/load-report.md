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
