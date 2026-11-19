# Hosting: subdomain and non-VPS (shared/managed) hosting feasibility

> Status: assessment (2026-11-17). No code/schema changes. Related plan: `docs/plan-licensing-security.md`.
> Current setup: single VPS, systemd `softmarket.service` (`pnpm start`, 127.0.0.1:3000), host Caddy (automatic TLS, `X-Softmarket-Client-IP` + `FORM_PROXY_SECRET`), Litestream (S3), `payments-reconcile.timer` (15 min), `scripts/deploy.sh` (`pnpm build` + `pnpm migrate` on server), SQLite WAL + in-process write queue (`src/lib/db-serial-transactions.ts`).

## Short answer

| Question | Decision |
|---|---|
| (a) Running the site or licensing API on a subdomain (`lisans.alanadi.com`, `api.alanadi.com`) | **Works.** Only DNS + Caddy block on today's VPS. **Recommended** for the licensing API. |
| (b) cPanel/Plesk Node.js (Passenger) shared hosting instead of a VPS | **Conditional — not recommended for licensing API and payments.** Must not be deployed unless all minimum specifications below are guaranteed in writing. |
| (c) Non-VPS single-instance managed container + persistent disk (e.g., PaaS with persistent volume) | **Conditional.** Works without architecture changes if single instance and persistent disk are pinned; backups preserved via Litestream. |

Recommendation: **Stay on the VPS, serve the licensing API from the `lisans.<alan-adi>` subdomain.** The monthly cost difference is small; license verification and payment webhooks require a persistent single process, system timers, and real-time backups.

## (a) Subdomain

**What is required:** DNS `A/AAAA lisans → VPS IP`; a second site block in Caddy. Same process, separate host:

```caddy
lisans.{$DOMAIN} {
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options nosniff
        -Server
    }
    request_body { max_size 16KB }
    @api path /api/v1/licensing/*
    handle @api {
        reverse_proxy 127.0.0.1:3000 {
            header_up X-Softmarket-Client-IP {remote_host}
            header_up X-Softmarket-Proxy-Secret {$FORM_PROXY_SECRET}
        }
    }
    handle { respond 404 }
}
```

(The download endpoint `/api/v1/licensing/dl/*` streams large files; the body limit applies only to requests and does not affect responses.)

**Impacts:**

- **Cookies:** Payload and portal cookies today are written without a `Domain` attribute (host-only); they are not sent to subdomains. Keep this: **do not** set `Domain=.alanadi.com` (a vulnerability on the subdomain would be able to read session cookies). The licensing API does not use cookies.
- **SameSite:** unchanged (`Lax`). A subdomain counts as "same-site"; therefore the same-origin (`Origin == Host`) and `Sec-Fetch-Site: same-origin` check (`guardAdminSession`) on admin endpoints is already stricter than SameSite and is preserved.
- **CORS:** not needed (desktop/server software is not a browser). `Access-Control-Allow-Origin` is not emitted; browser calls are intentionally unsupported.
- **HSTS `includeSubDomains`** is already enabled: all subdomains must be HTTPS (Caddy obtains certificates automatically).
- **CSP/middleware:** `/api` is outside middleware; no impact.
- **Pros:** the address embedded in software is independent of the marketing site (site can be redesigned/moved without affecting applications); the API can move to a separate machine later; Cloudflare/WAF rules and rate limits can be written per host; logs are separated.
- **Cons:** additional DNS record and certificate (automatic); risk of exposing admin/portal on the subdomain via a misconfigured Caddy rule → mitigated by the "only `/api/v1/licensing/*`" rule above and the L10 test (`curl https://lisans…/admin` → 404).
- **If Cloudflare proxy is used:** client IP is `CF-Connecting-IP`; `trusted_proxies` in Caddy must be configured strictly to Cloudflare IP ranges, otherwise rate limiting collapses to a single IP.

## (b) Shared / managed hosting (cPanel "Setup Node.js App"/Application Manager, Plesk Node.js, CloudLinux Node.js Selector — Phusion Passenger or LiteSpeed lsnode)

### Compatibility table

| Requirement (current system) | Shared hosting reality | Outcome |
|---|---|---|
| Persistent, **single** Node process | Passenger starts processes on demand, shuts them down when idle (pool idle time), and may spawn **multiple processes** under load; for Node, the default "unlimited concurrency" hint usually keeps 1 process, but it is not guaranteed; the setting is closed to customers on most plans | **Critical risk.** Second process: since `db-serial-transactions` is in-process, concurrent-write protection against `SQLITE_BUSY`/lost updates is lost; in-memory rate limits, nonce cache, event buffer, and Turnstile/form limits split per process (bypass). Required: `max pool/instances = 1`, `min instances = 1`, idle shutdown disabled. |
| Node `>=24.22.1 <25` | Selector versions depend on the provider and often lag behind | If the version is missing, **not viable**. |
| `next build` (2–4 GB RAM, minutes) | LVE memory/process limits (often 1–2 GB) kill the build | Build must run **in CI**, and compiled output (`.next` / `output: 'standalone'`) uploaded to the server → `deploy.sh` must be rewritten. |
| Working memory (Next + Payload + sharp) ~400–800 MB RSS | If LVE limit is exceeded, the process is silently killed; lsnode accumulation "resource temporarily unavailable" | At least 2 GB guaranteed RAM. |
| Writable persistent directory (`data/`, `uploads/`) outside web root | Usually home directory; provided | Must be outside web root (SQLite file must not be downloadable). |
| SQLite WAL (local disk, shared-memory files `-wal`/`-shm`) | WAL/locking is unreliable on hosts using network file systems (NFS) | Written confirmation of **local disk** required. |
| systemd timers: `payments-reconcile` (15 min), licensing `licensing:sweep` (5 min), notification queue, retention cleanup | cPanel/Plesk has **cron** (most allow 5 min minimum; some 15 min) | Covered by cron; `.env` must be loaded in command environment, writes to the same DB as a second process (short-lived; acceptable with WAL + `busy_timeout` 5000, but no cross-process queue). |
| Litestream (continuous WAL replication, RPO seconds) | Persistent sidecar process cannot run | Instead, cron `sqlite3 .backup` / `VACUUM INTO` + uploads tar + upload to external storage (`rclone`/S3); **RPO = cron interval** (15–60 min). Risk of payment/license loss increases. |
| HTTPS | AutoSSL/Let's Encrypt; also available for subdomains | Works. |
| Real client IP | No Caddy + `FORM_PROXY_SECRET` pattern; IP arrives via `X-Forwarded-For` from Apache/LiteSpeed/Passenger | Needs "trusted single proxy" mode for `requestIP()` (code change); misconfiguration allows header spoofing → rate-limit bypass. |
| Webhook availability (iyzico/Stripe) and long requests | When process sleeps, first request cold-starts (several seconds); some hosts have request timeout/body limits | Webhook providers retry; idle shutdown should still be disabled. |
| Large download streaming (licensed download, 512 MB upload) | Body/response size and duration limits | Confirm with provider; otherwise downloads must move to separate storage (S3 signed URL) → extra work. |
| Custom headers/HSTS/CSP | Partial via `.htaccess`/panel | App headers come from Next; Caddy headers must move to `.htaccess`. |
| SSH + `pnpm` | Most have SSH; if no pnpm, `corepack` | SSH mandatory (migrations, backups, emergency intervention). |

### Minimum hosting specifications (all with written confirmation)

1. Selectable Node.js **24.22.1+** (24.x), SSH access.
2. Per-app **single process** pinnable (`passenger_max_instances`/pool = 1, `min_instances = 1`) and **idle shutdown disabled**; or permission for a persistent process (PM2/supervisor) instead of Passenger.
3. At least **2 GB** guaranteed RAM, 1 vCPU, 20 GB **local** (not NFS) disk, inode limit ≥ 200k.
4. Persistent writable directory outside web root; working directory preserved across deployments.
5. **Cron** at least every 5 minutes; commands must run with the app's Node version and environment variables.
6. Panel support for **environment variables** (without committing secrets to files) or `0600` `.env` outside web root.
7. Subdomain + automatic TLS; request body ≥ 512 MB (media uploads) or decision to downsize uploads; long response streaming allowed.
8. Real client IP forwarded via a single trusted header (provider's proxy chain documented).
9. External backup target (S3-compatible) reachable from cron.

If any of these is missing, shared hosting **will not work**. If all are present, that server is essentially a "near-VPS" plan; the price advantage usually disappears.

### Required code/ops changes (if moving to shared hosting, ~2–3 days)

- `next.config` `output: 'standalone'` + Passenger entry file (`server.js`, reads `PORT` from Passenger); build in CI, upload artifact; artifact deployment + SSH `pnpm migrate` step instead of `deploy.sh`.
- Configurable trusted-proxy mode for `requestIP()` (only the last value of `X-Forwarded-For` arriving from loopback).
- "Second process" detection at startup: `flock`-based singleton lock in `data/`; a process failing to acquire the lock rejects write operations (licensing API, webhook) with 503 and logs a critical event (fail-closed). Recommended as a harmless safeguard on VPS as well.
- Cron version of `scripts/backup.sh` + external upload instead of Litestream; restore rehearsal.
- systemd timers → cron entries (`payments:reconcile`, `licensing:sweep`).

## (c) Managed container + persistent disk

On a platform supporting single instance (`min=max=1`), persistent volume (`data/`, `uploads/`), always-on process, cron/scheduled tasks, and sidecar process (Litestream), the current architecture is preserved. Conditions: autoscaling **off**, scale-to-zero off, volume attached to the single instance, provider region cleared under KVKK assessment (cross-border transfer). Brief downtime during deployment is accepted (single instance, no blue/green).

## Disk footprint

`DEPLOY_HOST=<ssh-target> make deploy` stages a release on the VPS. The script builds with all dependencies in a temporary directory, copies the compiled output, and installs into the release with `pnpm install --prod --frozen-lockfile`. It discards the temporary pnpm store, metadata cache, and Webpack cache before stopping the live service. Keep `NEXT_DIST_DIR` unset or set to `.next` in `/etc/softmarket.env`. Build and run with the same payment capability and public origin. Installs run on the target OS and architecture so sharp, libsql and Next get their matching native binaries.

The release keeps `pnpm start`, the Payload admin, the shared DB and uploads paths, and the production CLI entry points. Next standalone traces the web server and uses its own `server.js`. It also needs a separate copy of `public` and the compiled static assets. The systemd timers and operator CLIs would still need the repo source and an install containing Payload and `tsx`. One production install serves both roles. [Next.js standalone output](https://nextjs.org/docs/15/app/api-reference/config/next-config-js/output)

`tsx` runs the TypeScript CLIs, and Next needs TypeScript to load `next.config.ts` at startup. Monaco comes from the Payload admin, happy-dom from Lexical, and drizzle-kit from Payload's SQLite adapter. The production install excludes the browser test, benchmark, and CSS build tools.

| Component | Planning estimate |
|---|---:|
| Source, public assets and content per release | ~50–70 MiB |
| Production `node_modules` per release | ~0.9–1.2 GiB |
| Compiled `.next` per release after excluding the Webpack cache | ~40–100 MiB for a small catalog |
| Live SQLite DB plus WAL | ~20–100 MiB for a small catalog |
| Shared uploads | Measure separately. Add the full size of installers and media. |
| Local migration snapshots | ~80 MiB for five 16 MiB snapshots, plus additional snapshots from the last seven days and any WAL files |

Allow **25 GiB minimum** for a small catalog, including Ubuntu, logs, the active and previous releases, and roughly 4–6 GiB of temporary build and install space. Budget separately for large uploads, upload archives and any on-disk Litestream replica. A disposable macOS build measured 952 MiB of production dependencies and 39 MiB of compiled output after excluding an 885 MiB Webpack cache. Measure the release, shared data and replica directories on the target Linux VPS with `du -sh`. Keep the active and previous known-good release after smoke checks and retire older release directories after verifying the `current` symlink.

The release retains prerender and fetch data. The web unit uses in-memory ISR. If the Next image optimizer is used, `.next/cache/images` can be cleared while the service is stopped. The next release starts with an empty image cache. Keep the cache root writable by `softmarket` if image optimization is enabled.

Run `pnpm backups:prune --dry-run` to preview migration-snapshot retention under `data/backups`. The command keeps the newest five snapshots by modification time and any snapshot set with a file modified in the last seven days. Use `--keep <number>` to change the count or `--dir <directory>` for a different snapshot directory. After reviewing the preview, run without `--dry-run` while no backup or restore is in progress. It matches timestamped `pre-*.db` and `post-*.db` snapshots and their SQLite sidecars. Manage `scripts/backup.sh` archives in `backups/` and Litestream retention separately.

Locally, inactive `.next-perf` and other `.next-*` builds, `test-results/` and `playwright-report/` can be cleared when you no longer need their output. Keep any dist directory used by a running server. Clear `.cache/ms-playwright` only if you can reinstall browsers before the next E2E run. Keep `.cache/pnpm` if you rely on it for offline installs.

## References

- cPanel — How to install a Node.js application (Application Manager, Passenger): https://docs.cpanel.net/knowledge-base/web-services/how-to-install-a-node.js-application/
- cPanel — Passenger applications (reverse port binding): https://docs.cpanel.net/knowledge-base/web-services/using-passenger-applications
- Plesk — Next.js support (Obsidian 18.0.81+, Passenger): https://support.plesk.com/hc/en-us/articles/12376965359511-Does-Plesk-support-Next-JS
- Plesk forum — Pinning Passenger process pool for Node.js: https://talk.plesk.com/threads/how-to-configure-a-fixed-process-pool-for-nodejs-with-passenger.362847/
- Phusion Passenger — Dynamic scaling of Node.js app processes: https://www.phusionpassenger.com/library/indepth/nodejs/dynamic_scaling_of_app_processes/nginx/
- Phusion Passenger — Node.js request load balancing: https://www.phusionpassenger.com/library/indepth/nodejs/request_load_balancing.html
- Phusion Passenger — Apache optimization (pool size): https://www.phusionpassenger.com/library/config/apache/optimization/
- CloudLinux — Limits (LVE): https://docs.cloudlinux.com/cloudlinuxos/limits/
- CloudLinux — Resource limiting modes for web-interface-started Node.js processes: https://cloudlinux.zendesk.com/hc/en-us/articles/21229976203804-What-are-web-interface-resource-limiting-modes
- LiteSpeed — CloudLinux/lsnode process accumulation: https://docs.litespeedtech.com/lsws/cp/cpanel/ts-cloudlinux/
- SQLite — WAL and network file systems: https://www.sqlite.org/wal.html
