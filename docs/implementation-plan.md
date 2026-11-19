> Phase 8a working copy. Source plan is read-only outside sandbox: `/Users/ozcelik/.claude/plans/imdi-yapmam-z-gereken-proje-greedy-lynx.md`
> 2026-11-06 decision: Cloudflare Web Analytics because Umami requires Postgres; cookieless, no cookie banner needed for analytics. For the current SQLite/systemd architecture, `memory-bank/projectbrief.md` is authoritative.

# SoftMarket — Enterprise software showcase + sales site plan

## Context
Empty repo (`/Users/ozcelik/dev/softmarket`: README only). A site where an enterprise company showcases 5–20 software products and sells partially online. Spirit: major product company like Vizrt / Blackmagic (product families, solutions, support center, downloads); not a design copy. Look: modern, minimal, professional, comprehensive yet understated. The site must be self-hosted on our own server and **easily manageable by AI agents** (not manual panel clicking; via API/MCP/scripts).

Decisions (user-approved): Hybrid sales · Next.js + Payload CMS · TR + EN · Products/Solutions + Support + Corporate + Customer portal · iyzico + Stripe · in-site licensing module · Docker self-host · dark-dominant + light sections · palette proposed by us.

---

## 1. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router, RSC, TypeScript strict) | SEO, ISR, single app with Payload |
| CMS + backend | Payload CMS 3 (embedded in Next) | Self-host, typed collections, auth, Local/REST API |
| Database | PostgreSQL 16 (`@payloadcms/db-postgres`) | Relational order/license data |
| Files | MinIO (S3-compatible, `@payloadcms/storage-s3`) | Images + installer files, signed download URLs |
| UI | Tailwind CSS v4 + shadcn/ui (Radix) + lucide-react | Accessible, token-based |
| Animation | Motion (framer-motion) — restrained | Scroll reveal, product showcases |
| Font | Geist Sans + Geist Mono (`next/font`) | Modern, neutral, technical |
| i18n | next-intl (`/tr`, `/en`, localized slug) + Payload localization | Bilingual, hreflang |
| Payments | Abstract `PaymentProvider` → iyzico (TRY) + Stripe (USD/EUR) | Routing by currency/country |
| Email | Payload nodemailer adapter (SMTP) + React Email templates | Self-host compatible |
| Forms | `@payloadcms/plugin-form-builder` | Demo/quote/contact; managed in CMS |
| Search | `@payloadcms/plugin-search` (Postgres) | Product/doc/FAQ search |
| SEO | `@payloadcms/plugin-seo`, sitemap, JSON-LD (Product, Organization), OG images | |
| Analytics | Cloudflare Web Analytics | Cookieless, KVKK-friendly |
| Captcha | Cloudflare Turnstile | Form spam protection |
| Testing | Vitest (unit), Playwright (e2e) | |
| Infrastructure | Docker Compose: `app`, `postgres`, `minio`, `caddy` (automatic TLS), Cloudflare Web Analytics (external beacon) | Single server |
| CI/CD | GitHub Actions: lint → typecheck → test → build image → ssh deploy | |
| Package mgr. | pnpm | |

### AI manageability (critical requirement)
- **Payload MCP plugin** (`@payloadcms/plugin-mcp`; version to be verified at install) → agents perform product/page/news CRUD over MCP.
- **REST/GraphQL** with admin API key + type generation (`payload generate:types`).
- **`AGENTS.md`**: architecture, collections, commands, rules.
- **`Makefile` / pnpm scripts**: `dev`, `seed`, `migrate`, `backup`, `restore`, `deploy`, `logs`, `content:import <json>`.
- Content **JSON seed/import** (`/content/*.json`) → products can be added in bulk.
- Migrations (`payload migrate`) in code; backup cron (`pg_dump` + MinIO mirror).

---

## 2. Design system

**Tone:** cinematic dark showcases (hero, product showcase), light and legible information areas (docs, support, portal, technical specs). Large typography, generous whitespace, single accent color, product screenshots/videos front and center.

**Palette (easy on the eyes, no pure black/white):**

| Token | Dark | Light |
|---|---|---|
| `bg` | `#0B0D10` | `#F7F8FA` |
| `surface` | `#13161B` | `#FFFFFF` |
| `surface-2` | `#1B1F26` | `#F0F2F5` |
| `border` | `#262B33` | `#E3E6EA` |
| `text` | `#E7E9EC` | `#12161C` |
| `text-muted` | `#9AA2AD` | `#5A6370` |
| `accent` (single brand color, cobalt) | `#4C7DFF` | `#2F5FE0` |
| `accent-hover` | `#6B93FF` | `#244CC0` |
| `success` / `warning` / `danger` | `#2FB37A` / `#E0A63B` / `#E5574F` | dark variants of the same tones |

- All colors are CSS variables in `globals.css`; if branding changes, only one file changes. Contrast checked for WCAG AA.
- Per-section theme: `<Section theme="dark|light">`.
- Components: Header (mega menu), Footer, Hero (video/image), ProductCard, FeatureGrid, SpecTable, PricingTable (buy / request quote), CaseStudyCard, LogoWall, CTA band, Breadcrumb, Tabs, Accordion (FAQ), DownloadList, ReleaseNotes, Form renderer.

---

## 3. Site map (TR / EN)

**Header:** `Ürünler` ("Products", mega menu: families → products) · `Çözümler` ("Solutions", industries + use cases) · `Destek` ("Support") · `Şirket` ("Company") · Search · Language · `Hesabım` ("My Account") · **`[Demo İste]`** ("Request Demo")

- `/` Home page: hero, featured product families, solutions, customer logos, case study, news, CTA
- `/urunler` catalog (family filter), `/urunler/[aile]`, `/urunler/[aile]/[urun]`
  - Product page tabs: Overview · Features · Specs & System Requirements · Editions & Pricing · Downloads · Documentation
  - Per edition: `purchasable` → **Buy** (`Satın Al`), otherwise → **Request a Quote** (`Teklif İste`)
- `/cozumler`, `/cozumler/[slug]` (industry/scenario → related products + case study)
- `/destek`: `indirmeler` (filtered by product/edition/OS), `dokumantasyon/[urun]/[slug]`, `surum-notlari`, `sss`, `talep` (support ticket), `iletisim`
- Company: `hakkimizda`, `referanslar` + `referanslar/[slug]` (case study), `haberler` + `[slug]`, `kariyer` + `[slug]`, `is-ortaklari`, `iletisim`
- Conversion: `demo-talep`, `teklif-iste`, `satin-al/[edition]` (checkout), `siparis/[id]/tamamlandi`
- **Customer portal** `/hesap`: Overview · My Licenses · My Downloads · Orders & Invoices · My Support Tickets · Profile (login/register/password reset)
- Legal: KVKK privacy notice, privacy policy, cookie policy (+ cookie banner), **distance sales agreement**, **pre-information form**, refund/cancellation, terms of use, EULA
- `/admin` Payload panel

---

## 4. Data model (Payload collections)

- **Identity:** `users` (admin/editor, role-based) · `customers` (portal auth, company info, tax ID)
- **Catalog:** `product-families` · `products` (block-based page, features, specs, system requirements, media) · `editions` (product edition/package: price TRY/USD/EUR, `purchasable`, license type: subscription/perpetual, seats)
- **Marketing:** `solutions` · `industries` · `case-studies` · `posts` · `careers` · `partners` · `pages` (block-based freeform page) · `media`
- **Support:** `docs` (per-product, ordered) · `releases` (version number, notes, files) · `downloads` (file, OS, product, `access: public|licensed`) · `faqs` · `support-tickets` (+ messages)
- **Commerce:** `orders` (items, amount, currency, provider, status) · `licenses` (key, customer, edition, start/end, seats, status)
- **Forms:** form-builder `forms` + `form-submissions` (lead)
- **Globals:** `header`, `footer`, `site-settings` (contact, social, legal text links)
- All content fields `localized: true` (TR/EN). Access control: public read published only (drafts + versions enabled).

---

## 5. Sales and licensing flow

1. On edition page **Buy** (`Satın Al`) → `satin-al/[edition]`: customer login/register, billing info, distance sales + pre-information consent.
2. Currency TRY → iyzico Checkout Form; USD/EUR → Stripe Checkout.
3. Webhook (`/api/webhooks/iyzico`, `/api/webhooks/stripe`) signature verification → `orders.status=paid` (idempotent).
4. Create `licenses` (key: cryptographically random, formatted) → email + visible in portal; `licensed` downloads unlock.
5. Enterprise (`purchasable=false`) → **Request a Quote** (`Teklif İste`) form → lead email + admin record.
- Out of scope v1: e-Invoice/e-Archive integration (later `Paraşüt` etc.), in-software activation API (license model designed ready for it), subscription renewal automation.

---

## 6. Project structure

```text
softmarket/
  AGENTS.md  Makefile  docker-compose.yml  Caddyfile  .env.example
  src/
    app/(frontend)/[locale]/...     # site pages
    app/(frontend)/[locale]/hesap/  # portal
    app/(payload)/admin/...         # Payload admin
    app/api/webhooks/{iyzico,stripe}/route.ts
    collections/  globals/  blocks/  access/  hooks/
    components/{ui,layout,sections,product,portal}/
    lib/{payments/{provider.ts,iyzico.ts,stripe.ts},licenses/,email/,seo/}
    i18n/{routing.ts,messages/{tr,en}.json}
    payload.config.ts
  content/seed/*.json   scripts/{seed,backup,restore,import}.ts
  tests/{unit,e2e}/
```

---

## 7. Implementation phases and agent allocation (`takim-lideri` skill)

In each phase: discovery/summary → production → **cross-QA** (if Claude wrote it, GPT 6.1 Sol/Terra High audits; author ≠ auditor).

| Phase | Work | Agent (effort) | QA |
|---|---|---|---|
| 0 | Repo skeleton, `create-payload-app` (Next+Postgres), Docker Compose, Caddy, `.env.example`, Makefile, `AGENTS.md` | GPT 6 Luna (Low) + GPT 6.1 Sol (Medium) | Gemini 3.8 Flash summary check |
| 1 | Architecture core: collection schema, access control, localization, payment abstraction interface | Claude Opus 5.5 subagent (Medium) | GPT 6.1 Terra (High) |
| 2 | Design system: tokens, theme, shadcn components, Header/Footer/mega menu | Claude Sonnet 5.5 (Medium) | GPT 6.1 Sol (High) |
| 3 | Pages: home page, product catalog/detail, solutions, corporate pages, block renderer | Claude Sonnet 5.5 (Medium) | GPT 6.1 Sol (High) |
| 4 | Support center: docs, releases, downloads (signed URL), FAQ, search, support ticket | GPT 6.1 Sol (Medium) | Claude Sonnet ≠ author; Sol wrote → Terra (High) |
| 5 | Payments (iyzico + Stripe), webhook, orders, license generation, email | GPT 6.1 Terra (High) | GPT 6.1 Sol (High) zero context |
| 6 | Customer portal (`/hesap`) | Claude Sonnet 5.5 (Medium) | GPT 6.1 Sol (High) |
| 7 | i18n strings, UI copy, error messages, legal text drafts, README | Claude Haiku 5.5 (Low) | — (legal text: user/counsel approval) |
| 8 | Seed content (5–20 sample products JSON), MCP plugin, backup/deploy script | GPT 6 Luna (Low) + GPT 6.1 Sol (Medium) | Terra (High) deploy/security |
| 9 | SEO, performance, accessibility, e2e tests | GPT 6.1 Sol (Medium) | Gemini 3.8 Flash report summary |

On blockers: GPT 6 Astra + Gemini 4 Argon consultation. Quota balance: after Claude-heavy phases (2–3), shift 4–5 to GPT.

---

## 8. Verification
- `make dev` → `localhost:3000/tr`, `/en`, `/admin` open; after seed, product/family/solution pages are populated.
- `pnpm typecheck && pnpm lint && pnpm test` (Vitest: payment signature verification, license generation, access control).
- Playwright e2e: catalog → product → Buy (iyzico sandbox + Stripe test mode) → webhook → license visible in portal → licensed download unlocks; Request a Quote form submission; language switch + hreflang.
- Lighthouse ≥ 90 (Performance/SEO/A11y), WCAG AA contrast check.
- Test adding/updating products via agent over MCP.
- `docker compose up` on staging server; Caddy TLS, backup/restore rehearsal.
