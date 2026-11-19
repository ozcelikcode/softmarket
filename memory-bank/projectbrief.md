# Project Brief — SoftMarket

The single source of truth for scope. If there is a conflict, this file comes first, then `progress.md`.

## Purpose
A site for a corporate software company that showcases its 5-20 software products and collects quote and demo requests.
Spirit: Vizrt / Blackmagic (product families, solutions, support center, downloads). Not a design copy.

## Firm decisions
- **Sales model:** promotion + Request a Quote / Request a Demo. Editions have no price; every edition goes to a quote request.
- **Stack:** Next.js 15 (App Router), Payload CMS 3, SQLite, TypeScript strict, Node 24, pnpm.
- **Languages:** TR (default, `localePrefix: 'always'` → `/tr/...`) + EN (`/en/...`). Localized slugs.
- **Analytics:** Cloudflare Web Analytics; Umami was not chosen because it requires Postgres. Cookieless; no analytics cookie banner needed. If there is no token, the beacon is not loaded; admin/portal are excluded.
- **Online payment:** fully removed.
- **License:** an in-site module; an authorized administrator assigns it to the customer through the panel/API/MCP. The CSPRNG key is generated on the server.
- **Deployment:** systemd self-hosted (single VPS), automatic TLS with Caddy.
- **AI manageability (critical):** `AGENTS.md`, Makefile/pnpm scripts, JSON seed/import, Payload REST/Local API, Payload MCP plugin (Phase 8a).
- **Visual:** dark-dominant with light sections; a single accent color, cobalt; the palette is ours. Details: `productContext.md`.
- **User:** does not know SQLite and does not want to perform manual database interventions. Migrations and scripts must be automatic.
- **Git:** no commits unless the user asks.

## Out of scope (v1)
- e-Invoice / e-Archive integration (later, e.g. Paraşüt).
- In-software activation API: it was out of scope for v1; it was added to the plan at the user's request on 2026-11-17 (see "Planned goals" below).
- Subscription renewal automation.

## Planned goals (2026-11-17, awaiting user approval)
- **License API:** shipped programs perform activation, verification (with offline tolerance), deactivation, seat/device binding, update checks, and licensed downloads via `/api/v1/licensing/*`. Plan: `docs/plan-licensing-security.md`.
- **License revocation:** the admin manually suspends, revokes, and re-enables; automatic: refund, dispute, rule violation (reversible, with an audit trail).
- **Security center:** a single page in the admin panel that collects violations, IPs, and suspicious activity; KVKK-compliant minimization and retention.
- **Hosting:** the license API on a subdomain (suggestion `lisans.<domain>`); VPS-less shared hosting only conditionally. Evaluation: `docs/plan-hosting.md`.

## Site scope (summary)
- Home page; product catalog (`/tr/urunler`, families, product detail tabs); solutions; references; news; careers; partners; contact; company.
- Support center (`/tr/destek`): downloads, documentation, release notes, FAQ, support request, contact.
- Conversion: `/tr/demo-talep`, `/tr/teklif-iste`.
- Customer portal `/tr/hesap`: summary, licenses, downloads, support requests, profile.
- Legal: KVKK, privacy, cookies, terms of use, EULA.
- Admin panel: `/admin` (Payload).
- Full page map and collection list: `systemPatterns.md`.

## Success criteria (plan §8)
- After `make dev`, `127.0.0.1:3100/tr`, `/en`, and `/admin` open; after seeding, the pages are populated.
- `pnpm typecheck && pnpm lint && pnpm test` pass (license assignment, subscription period, access control).
- Playwright e2e: catalog → product → Request a Quote; the admin assigns a license → the license appears in the portal → licensed download opens; quote submission; language switch + hreflang.
- Lighthouse ≥ 90 (Performance/SEO/A11y); WCAG AA contrast.
- Test via MCP: add/update a product through an agent.
- Staging server with systemd; Caddy TLS; backup/restore trial.

## Sources
- Current repo plan: `docs/implementation-plan.md` (a working copy, because the external source is read-only).
- Approved source plan: `/Users/ozcelik/.claude/plans/imdi-yapmam-z-gereken-proje-greedy-lynx.md`
- Agent rules: `/Users/ozcelik/dev/softmarket/AGENTS.md`
