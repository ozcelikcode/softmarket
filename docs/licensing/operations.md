# Licensing operations

## Prepare the Linux VPS

Run one SoftMarket process on `127.0.0.1:3000` behind Caddy. Publish DNS for `lisans.<domain>` directly to the VPS. Add an AAAA record only if IPv6 reaches Caddy. Open 80 and 443 and keep 3000 private. `softmarket.service` passes `--hostname 127.0.0.1` because `next start` does not use `HOSTNAME` to select its listening address.

Set `DOMAIN` to the main site's hostname in Caddy's systemd environment. Give Caddy and SoftMarket the same `FORM_PROXY_SECRET`, at least 32 characters. A random 32-byte value encoded in hex works for both environment files. Keep `/etc/softmarket.env` and `/etc/caddy/softmarket.env` root-owned and `0600`. Install this drop-in at `/etc/systemd/system/caddy.service.d/softmarket.conf` before starting Caddy with the secret. The packaged unit uses `--environ`, which prints environment values to the journal. [Caddy's packaged systemd unit](https://github.com/caddyserver/dist/blob/master/init/caddy.service)

```ini
[Service]
EnvironmentFile=/etc/caddy/softmarket.env
ExecStart=
ExecStart=/usr/bin/caddy run --config /etc/caddy/Caddyfile
```

Run `systemctl daemon-reload` after installing the drop-in. If Caddy previously started with the secret and `--environ`, rotate the secret. Restart both services when changing it.

Caddy replaces incoming `X-Softmarket-Client-IP` and `X-Softmarket-Proxy-Secret` values with the peer address and shared secret. Use DNS-only records and keep `licensing-settings.countrySource` at `none`. The application reads `CF-IPCountry` only when `countrySource` is `cloudflare_header` and the request carries the matching proxy secret, so the header is trusted only behind a proxy that removes client copies. The shipped Caddyfile strips `CF-IPCountry` from every upstream request on both hosts, so geo rules receive no country observations in this topology. A future Cloudflare deployment must replace the unconditional `header_up -CF-IPCountry` with a request-header deletion that applies to every peer outside Cloudflare's published ranges, firewall the origin to Cloudflare ingress, configure Caddy `trusted_proxies` with `client_ip_headers CF-Connecting-IP` and send `{client_ip}` instead of `{remote_host}`, and only then switch `countrySource` to `cloudflare_header`. Connecting through an unconfigured CDN would group users by the CDN peer address. Both hosts skip access logging for licensing paths. Caddy also removes request URIs, referrers, redirect locations, and the shared proxy secret from its default runtime log fields. The subdomain proxies only the canonical licensing paths. Both hosts cap licensing request bodies at 8 KiB, matching the application, and the main host keeps its 512 MB cap for uploads and other requests. Keep request-level debug logging off and apply the same redaction to any additional logs. [Caddy reverse proxy documentation](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [Caddy access log skipping](https://caddyserver.com/docs/caddyfile/directives/log_skip)

Set `NEXT_PUBLIC_SERVER_URL` to the main site's HTTPS origin for production builds and processes. Payload reads it at process start. Cookie auth checks the exact configured `Origin` when supplied. Requests without `Origin` need `Sec-Fetch-Site` of same-origin, same-site or none. Staff REST login also rejects cross-origin browser requests before issuing a cookie. Serve the admin panel and Live Preview on the configured HTTPS host. The cookie is `Secure` in production and on HTTPS. An explicitly configured plain-HTTP loopback URL allows `127.0.0.1`, `localhost` and `[::1]` on its port with a non-Secure cookie. MCP clients authenticate with their Bearer API key.

Use `DATABASE_URI=file:/opt/softmarket/shared/data/softmarket.db` and `UPLOADS_DIR=/opt/softmarket/shared/uploads` in `/etc/softmarket.env`. Create the shared directories before starting the units and give the `softmarket` user the required ownership. The web unit can write data and uploads. The sweep and payment reconcile units can write data, and Litestream can write data and its replica directory. Each service uses `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome`, `PrivateTmp`, and the shared app environment file. The web service uses in-memory ISR because Next normally writes regenerated pages beside compiled route code. If you use Next image optimization, create the release's `.next/cache` and make it writable by `softmarket` before starting the service. The pnpm services share a writable Corepack cache at `/var/cache/softmarket/corepack`. Install Node and pnpm outside protected home directories. Run manual backups outside the app service and use the writable replica directory for local Litestream backups. [systemd execution settings](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html)

## Provision and rotate signing keys

1. Before first provisioning, configure `SOFTMARKET_SECRETS_KEY` in the app environment with at least 32 random bytes, encoded as hex or base64. Keep this master key stable across releases. It protects the vault and derives licensing keys used for fingerprint identity, IP privacy, and download links.
2. Run `pnpm licensing:keygen` against the deployment DB as `softmarket` with the service environment. This stores the private Ed25519 key encrypted in the vault and prints public metadata. For example, run `sudo systemd-run --wait --pipe --collect -p User=softmarket -p WorkingDirectory=/opt/softmarket/current -p EnvironmentFile=/etc/softmarket.env -E NODE_ENV=production /usr/bin/env pnpm licensing:keygen`.
3. Publish the trusted issuer and public pins through the authenticated client distribution channel. Clients pin `https://lisans.<domain>` and the signing public key. `/keys` is a diagnostic with a one-hour cache. See [the client contract](client-api.md) and [the integration guide](client-integration.md).
4. For routine vault rotation, use the signing tab's rotation action in the admin panel or run `pnpm licensing:keygen --rotate` in the same service environment. Schedule a maintenance window for pin delivery because generating a new vault key activates it immediately. The old public key remains eligible for verification for 90 days. Keep the old pin during the overlap for already issued leases. Use the panel when you want its rotation audit and alert.
5. Deployments using `SOFTMARKET_LICENSE_SIGNING_KEY` must register its public metadata with `pnpm licensing:keygen --register-env`. For replacement, stage the new override, use `--register-env --rotate`, and start the app with the matching override during the same maintenance window. The override takes precedence over the vault and a mismatch makes signing unavailable. Keep the vault master configured for licensing derivations in this mode as well.

Pair every recoverable SQLite backup or Litestream restore point with the exact `SOFTMARKET_SECRETS_KEY` that can decrypt it. Backup metadata should identify which secret-manager version belongs to the DB snapshot. Store secret backups in a separately protected encrypted vault, restrict restore access, and include the signing override if used. Also back up uploads. After provisioning or rotation, verify there is a recoverable backup. Rehearse restoring DB, uploads, and matching keys into an isolated environment. Master-key loss makes the vault signer and fingerprint derivations unrecoverable with that DB. Plan for replacement signing pins and device reactivation if recovery fails.

## Enable the API and roll out rules

1. As a panel admin, set `licensing-settings.publicHost` to `lisans.<domain>` as a bare hostname, then set `apiEnabled` when preflight and the proxy checks are ready. The API defaults to off and returns `503 unavailable` while disabled. Disable it again if signing or client trust fails during rollout.
2. For each product, enable `licensing.enabled` and set a unique `licensing.code`. Codes use lowercase letters, digits and hyphens, begin with a letter or digit, and are 3–41 characters. Each code is immutable once saved and must match the client product code. Verify that the test license's edition belongs to the product.
3. Set the rules to `observe` and set `rules.observeUntil` to a future cutoff. `observe` records rule hits without rule emails or suspensions. Review Security Center events (`/admin/guvenlik`) against legitimate VPN use, mobile networks and shared networks. Tune thresholds and windows before moving on.
4. Move the rules under evaluation to `notify`. Configure SMTP and `notifications.alertEmails`, confirm immediate-alert severity and optional digest delivery, and review false positives and sweep results.
5. Promote one rule at a time to `suspend` after the saved `observeUntil` deadline has elapsed. The persisted deadline must be a valid UTC ISO timestamp. Blank, invalid, or still-current deadlines leave suspension in monitor-only mode. Start with a low `rules.maxAutoSuspendsPerHour` (default 5). Rules can suspend licenses. Revocation is a separate action.

### Circuit breaker and incident response

- The next eligible suspension after the rolling hourly limit opens a critical `system.rule_circuit_open` event. The breaker checks for an **open** event in the last 24 hours. Acknowledging or resolving it removes that event from the check, so first switch the affected rules to `notify` to avoid resuming suspensions during triage. Review the recent suspensions, adjust thresholds or rollout settings, and resolve the event when the cause is addressed. Use a new observation deadline before resuming automatic suspensions if more evidence is needed.
- For a rate-limit or availability incident, check the proxy address and shared-secret configuration, clock synchronization, SQLite writer contention and disk space. Check aggregate 429/503 rates and Security Center events. A secret mismatch or invalid client address falls into the shared unknown-address bucket.
- For suspected signing-key compromise, disable the API while you coordinate client trust recovery. Preserve audit records and a protected backup. Provision a replacement, distribute its pin and the compromised key's revocation over the trusted client channel, and verify a fresh signed response before reopening. Emergency immediate revocation uses the server-side `revokeSigningKey` operation through an authorized maintenance action. The panel and keygen CLI expose rotation only. During a proxy-secret incident, rotate the secret on Caddy and the app. During a vault-master incident, coordinate vault recovery and device reactivation planning before replacing the master.
- When investigating, use event and audit IDs, timestamps and recorded network prefixes. Keep license keys, raw fingerprints, full IP addresses, private signing material and download URLs out of tickets and diagnostic logs. An offline client can keep using its last verified lease until it expires, subject to its locally trusted revocation information.

### False positives and blocks

- For an incorrect rule hit, mark its event **False positive** in Security Center. If that event caused the current suspension, use the false-positive action with restore or the license's **Restore** action. Restore checks the latest status transition, records the restoration and queues the customer notification. If the operation returns 409, reload the license and confirm its current status history first. Payment disputes have their own reactivation path, and revocation is terminal.
- The false-positive event or restoration suppresses the matching rule for that license for its configured `suppressDays` (default 30, 0 disables suppression). Review and tune the rule before suppression expires. Handle associated blocks separately.
- Add or lift blocks in Security Center. Prefer a narrow target and a finite duration. Available targets include a network prefix or CIDR, a license, an activation, or the fingerprint derived from an activation. An IP block covering the operator's current address requires explicit self-block confirmation. Repeated invalid-license attempts can create temporary prefix blocks. Check scope, expiry and audit history before lifting a block, then confirm the affected client can use the API from its normal network.

## Sweep, retention, and monitoring

Install `deploy/licensing-sweep.service` and `deploy/licensing-sweep.timer`, run `systemctl daemon-reload`, and enable the timer with `sudo systemctl enable --now licensing-sweep.timer`. It runs roughly every five minutes, evaluates rules, sends queued email, and runs retention during the 04:00 Europe/Istanbul hour. `pnpm licensing:sweep --dry-run` previews rule evaluation. Use `--retention` for a manual cleanup outside the nightly window under the same service environment. A normal sweep with `--retention` also runs rule and notification processing, and deletes data eligible under the retention policy.

| Data | Default retention |
|---|---|
| Network fields on security events | 30 days |
| Security events | 180 days, with holds for pending notifications, unresolved high or critical events, active suppression, and events linked to blocks |
| Network fields on activations | 90 days |
| Ended activations | 2 years after both the license and device have ended |
| Lifted or expired blocks | 90 days |
| License status history | 10 years after both the transition and the license end |
| Security audit | 2 years; client nonce receipts of `validate`, `updates` and `downloads/link` after 1 day |

Watch `systemctl list-timers --all` and `journalctl -u licensing-sweep.service` for missed runs, contention, retention reports and notification failures. Track 429/503 rates, signed validation latency, SQLite writer errors, replication lag, disk and WAL size, restore-test recency, and open high/critical events. Monitor `/keys` after enablement and use a disposable signed validation for a deeper health check. Keep probe output free of credential-bearing URLs or headers.

The retention sweep prunes successful nonce receipts for validation, update checks, and download-link issuance after 24 hours. Activation, deactivation, and administrative audit rows follow `auditYears`. Denied admin operations record the first refusal per actor or prefix, action, and reason in each 10-minute window. Repeats bypass the writer queue. When four denied-audit writes are pending or all 10,000 audit windows are reserved, new denials may go unrecorded. Licensing and portal rate limiters retain active budgets under churn. At capacity, new enforcement keys share an overflow budget and new observation keys cannot trigger per-subject blocks.

## VPS acceptance checklist

- [ ] Validate the installed Caddyfile with `caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile` in the Caddy service environment. Run `systemd-analyze verify` on the installed services and timers. Start the updated services and check their journals, the timer schedule and Litestream replication.
- [ ] Verify HTTPS, host isolation, and the private listener. On `lisans.<domain>`, `/`, `/admin`, `/api/mcp`, `/api/media/file/...` and unrelated paths should return 404. Check that `ss -ltn` lists the app on `127.0.0.1:3000` only. Verify the main site and its admin and upload paths as usual.
- [ ] After provisioning, run the read-only preflight as the service user under the service environment. All five lines must pass. It queries public signing metadata using a read-only SQLite connection and creates disposable files under the system temp directory to exercise L4's actual descriptor walk. It checks the app-side proxy secret contract. Verify the Caddy side against the running services in the next step.

  ```bash
  sudo systemd-run --wait --pipe --collect \
    -p User=softmarket -p WorkingDirectory=/opt/softmarket/current \
    -p EnvironmentFile=/etc/softmarket.env -E NODE_ENV=production \
    -E COREPACK_HOME=/var/cache/softmarket/corepack \
    /usr/bin/env pnpm licensing:preflight
  ```

- [ ] Use a disposable license and the reference client to verify pinned signatures on activate, validate and deactivate. From two known client prefixes in staging, confirm requests count toward their real prefixes even with fabricated client-address headers, using the Security Center's aggregate observations. Confirm a request with an oversized advertised body receives 413 at Caddy. Test full, HEAD and Range downloads, verify the file hash, and confirm the journal or any configured access log contains no test token path, including for an expired link.
- [ ] Confirm sweep and alert delivery in `observe` and `notify`, verify a restore and its suppression on a disposable license, and record the paired DB, uploads and key restore drill before automatic suspension.
- [ ] Run the production HTTP load harness on the VPS in a disposable copy of the release, with development dependencies installed, no production environment file loaded, and port 3600 free. The build and load fixtures use separate temporary DBs. In a quiet window, from the disposable release root run:

  ```bash
  bench_dir=$(mktemp -d)
  mkdir "$bench_dir/uploads"
  export DATABASE_URI="file:$bench_dir/build.db" UPLOADS_DIR="$bench_dir/uploads"
  export NODE_ENV=production PAYMENTS_ENABLED=false
  export PAYLOAD_SECRET="$(openssl rand -hex 32)"
  export NEXT_PUBLIC_SERVER_URL=http://127.0.0.1:3600
  pnpm migrate
  NEXT_DIST_DIR=.next-l3 pnpm build
  node --import tsx scripts/licensing-load.ts --http
  ```

  Record p50/p95/p99 for the 1,000 signed validations (100 concurrent, 10 rounds). Require p95 below **250 ms**, zero validation errors, the expected prefix throttling, and the three-seat cap during concurrent activations and a staff write. This loopback benchmark bypasses Caddy. Run the proxy smoke checks separately. Prior local HTTP p95 was **717.7 ms**. Treat VPS latency as open until it is measured. Remove the disposable build and fixtures after recording results. See the [load report](load-report.md).
