# SoftMarket

A website for a corporate software company that showcases its 5-20 products, collects quote and demo requests, and provides a support center and customer portal. The company name is not final yet, so the copy uses the `SoftMarket` placeholder.

## Features

- Product catalog with product families, product detail tabs, and editions per product.
- No online payment or cart. Every edition has a **Request a Quote** flow, and general introductions have a **Request a Demo** flow.
- Licenses are assigned to customers by staff and shown in the customer portal (`/tr/hesap`, `/en/account`).
- Support center: downloads, documentation, release notes, FAQ, and support tickets.
- Bilingual content: Turkish (default, `/tr`) and English (`/en`).
- Content management through the Payload admin panel (`/admin`), with drafts and version history.
- Content import from JSON (`pnpm content:import`) and a Payload MCP endpoint for AI agents.

## Tech stack

- **Application:** Next.js 15 (App Router) and Payload CMS 3 running as a single application. The site lives in `src/app/(frontend)/[locale]`; the admin panel and API live in `src/app/(payload)`.
- **Database:** SQLite (`@payloadcms/db-sqlite`). Schema changes are made with migrations; `push` is disabled.
- **Language:** TypeScript (strict mode).
- **Deployment:** No Docker. On a single VPS: systemd (application), Caddy (automatic TLS and reverse proxy), and Litestream (continuous SQLite backup).
- **Localization:** Turkish (default, `/tr`) and English (`/en`). Copy is in `src/i18n/messages/{tr,en}.json`; path mapping is in `src/i18n/paths.ts`.
- **Manageability:** Content is managed through the admin panel. Payload REST/Local API and MCP integration are planned (Phase 8).

## Requirements

- Node.js `>=24.22.1 <25` (required by Payload 3.93)
- pnpm `>=12 <13` (`packageManager`: `pnpm@12.16.1`)

## Getting started

```sh
pnpm install
cp .env.example .env        # fill in the values
pnpm migrate                # prepares the database
pnpm ensure-forms           # creates the demo, quote, contact, and support forms (idempotent)
pnpm dev                    # http://127.0.0.1:3100
```

Local address: `http://127.0.0.1:3100` (`/tr`, `/en`, admin panel at `/admin`). `localhost:3000` does not belong to this project.

> Note: To create a new migration, use `pnpm migrate:create <name>`; plain `payload migrate:create` does not work in this project. After a schema change, run `pnpm migrate`.

### Environment variables

`.env.example` lists all keys. The table below lists the variables required in production. Never commit `.env`.

## Scripts

Makefile targets (`make <target>`):

| Target | What it does |
|---|---|
| `make dev` | `pnpm dev` (port 3100) |
| `make migrate` | `pnpm migrate` |
| `make seed` | `pnpm ensure-forms` + `pnpm content:import` (same as `pnpm seed`) |
| `make backup` | `scripts/backup.sh` |
| `make restore BACKUP=<backup-dir>` | Restores with `scripts/restore.sh` |
| `make deploy` | `scripts/deploy.sh` (requires `DEPLOY_HOST`) |
| `make provision` | `scripts/provision.sh` (server setup, Ubuntu 24.04, root) |
| `make logs` | `journalctl -u softmarket -f` on `DEPLOY_HOST` |
| `make typecheck` / `make lint` / `make test` | `pnpm typecheck` / `pnpm lint` / `pnpm test` |

Other pnpm scripts:

| Command | Description |
|---|---|
| `pnpm build` / `pnpm start` | Production build and start |
| `pnpm migrate:create <name>` | Creates a new migration file |
| `pnpm migrate:status` | Shows migration status |
| `pnpm generate:types` | Regenerates `payload-types.ts` |
| `pnpm generate:importmap` | Regenerates the Payload import map file |
| `pnpm media:regenerate` | Fills in missing WebP sizes for existing raster media; keeps IDs, file names, permissions, and TR/EN copy. Records that are already complete are skipped on the second run. |
| `pnpm ensure-forms` | Creates or updates form definitions in TR/EN |
| `pnpm test:e2e` | Runs a build and then the Playwright tests (requires Chromium) |

Quality check: `pnpm typecheck && pnpm lint && pnpm test`. For E2E, run `pnpm exec playwright install chromium` once.

## Project structure

```
src/
  app/(frontend)/[locale]/  site pages (urunler, cozumler, destek, hesap, yasal, ...)
  app/(payload)/            admin panel and Payload API
  collections/              collections (products, editions, licenses, support, ...)
  globals/                  header, footer, site-settings
  blocks/                   page blocks (Hero, FeatureGrid, SpecTable, ...)
  access/                   access rules
  lib/                      license, form, portal, search, and query logic
  i18n/                     routing, path mapping, messages (tr.json, en.json)
  migrations/               SQLite migration files
  components/, fields/, hooks/
content/                    legal text drafts (content/legal/{tr,en})
scripts/                    seed, ensure-forms, backup, restore, deploy, provision
deploy/                     Caddyfile, systemd and Litestream configuration
tests/unit/, tests/e2e/     Vitest and Playwright tests
memory-bank/                project memory (see below)
```

## Content management

- Product, edition, solution, news, reference, documentation, download, and FAQ content is managed in the admin panel (`/admin`). Collections with drafts and version history work with `drafts`.
- Licenses are assigned only by an authorized administrator; the key is generated on the server, and customers cannot edit licenses directly.
- Form notifications go to `FORM_NOTIFICATION_EMAIL` (optional) or the site contact address. If SMTP is not configured, the notification is written to the console.
- AI agent content management (Payload MCP, JSON import) is part of Phase 8 and does not exist yet.

## Environment variables

Required in production:

| Variable | Description |
|---|---|
| `PAYLOAD_SECRET` | Payload session and signing secret |
| `DATABASE_URI` | SQLite database path |
| `NEXT_PUBLIC_SERVER_URL` | Canonical address of the site (e.g. `https://example.com`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Email delivery. If the host is empty or starts with `CHANGE_`, the console adapter is used |
| `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile. If absent in production, form submission and customer registration are disabled |
| `FORM_PROXY_SECRET` | At least 32 characters. **Must be the same value in Caddy and the application**; required for rate limiting |
| `FORM_NOTIFICATION_EMAIL` | Optional form notification recipient |
| `UPLOADS_DIR` | Folder for uploaded files |
| `LITESTREAM_BUCKET`, `LITESTREAM_PATH`, `LITESTREAM_ENDPOINT`, `LITESTREAM_REGION`, `LITESTREAM_ACCESS_KEY_ID`, `LITESTREAM_SECRET_ACCESS_KEY` | Litestream backup target |
| `DOMAIN`, `DEPLOY_HOST` | Caddy domain and deployment server (SSH target) |

The `.env` file and credentials are never committed.

## Deployment

Hosting and operations are documented in:

- [`docs/plan-hosting.md`](docs/plan-hosting.md): hosting plan (subdomain and VPS-less hosting feasibility) and the VPS disk budget.
- [`docs/licensing/operations.md`](docs/licensing/operations.md): licensing API deployment and operations runbook.

Summary:

1. Prepare the server: `make provision` (Ubuntu 24.04, root). It installs Node 24, pnpm, Caddy, rsync, and sqlite3.
2. Set the `.env` values for the server and the local environment. Use the same value for `FORM_PROXY_SECRET` in Caddy.
3. `make deploy` (requires `DEPLOY_HOST`): copies the code to `/opt/softmarket/releases/<version>` and links the `data`/`uploads` folders to shared locations. Installation and service steps are in `scripts/deploy.sh`.
4. Watch the service logs with `make logs`.

Backups: `make backup` takes a copy of the SQLite database and uploads; Litestream continuously backs up the database. To restore, use `make restore BACKUP=<backup-dir>`. By default, `scripts/restore.sh` stops the `softmarket` and `litestream` services (set `RESTORE_SERVICE=0` to skip this step).

## Documentation

- [`AGENTS.md`](AGENTS.md): rules and reference for coding agents.
- [`memory-bank/`](memory-bank/README.md): project context and status tracking. Read in this order: `projectbrief.md` → `productContext.md` → `systemPatterns.md` → `techContext.md` → `activeContext.md` → `progress.md`.
- [`docs/`](docs/): plans, operations runbooks, and QA records (e.g. [`docs/payments/operations.md`](docs/payments/operations.md), [`docs/licensing/client-api.md`](docs/licensing/client-api.md)).

## Legal texts

The KVKK disclosure, privacy, cookie, terms of use, and EULA texts under `content/legal/{tr,en}/` are **drafts**. They must be reviewed by a legal advisor before publication, and the bracketed fields must be filled in.
