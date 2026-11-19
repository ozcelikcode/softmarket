# System Patterns

## Architecture
- A single Next.js 15 application: the site (`src/app/(frontend)/[locale]`), Payload admin + API (`src/app/(payload)`), and custom API routes (`src/app/api`).
- Payload CMS 3, embedded in Next. Data: SQLite (`@payloadcms/db-sqlite`).
- Files: stored on the local disk (`media` collection).
- License business logic: `src/lib/licenses`, `src/collections/Licenses.ts`.
- Frontend loading: safe queries via `site.ts` / `content.ts`.

## Collections (21) and globals (3)
- **Identity:** `users` (admin|editor, panel only), `customers` (portal, `access.admin=false`).
- **Catalog:** `product-families` → `products` (drafts, `layout` blocks, features/spec/requirements) → `editions` (sku (quote edition code); `licenseType`, `durationMonths`, `seats`).
- **Marketing:** `solutions`*, `industries`, `case-studies`*, `posts`*, `careers`, `partners`, `pages`*, `media`.
- **Support:** `docs`* (slug, unique within product+locale), `releases` (unique product+version), `downloads` (file→media, os, `access: public|licensed`), `faqs`, `support-tickets` (message array).
- **Licenses:** `licenses` (CSPRNG key unique; product denormalized from the edition).
- **Plugins:** `forms`, `form-submissions` (form-builder), `search` (products, docs, faqs, posts).
- **Globals:** `header`, `footer`, `site-settings`.
- `*` = drafts + versions. Content fields are `localized`. Slug: `slugField()` (`src/fields/slug.ts`), generated from the title, unique per locale.
- Payload plugins in config: seo, form-builder, search.

## Access rules (`src/access`)
- Payload's default is `Boolean(user)`; customers look like `users` too. **Every collection/global/plugin must define explicit access.**
- Published content: public read (`publishedOrStaff` for collections with drafts; `careers` only `isOpen`). Write: admin/editor.
- `licenses`: read = admin or owner customer; write (create/update/delete) = admin only. Customer operations run from server code with `overrideAccess: true`. A customer never writes directly.
- `support-tickets`: read/update = staff or owner; a customer opens tickets for themselves and only adds messages (enforced by hook).
- `downloads` / `media`: `public` for everyone; `licensed` only for staff or customers with a valid license for the product (active, started, not expired). The `downloads` hook syncs `media.visibility/licensedProducts` (fail-closed).
- `users`: admin manages; staff edit themselves; the `roles` field is admin-only. The first user becomes admin. `site-settings` update = admin.

## Critical flow 1: staff → license assignment
1. An authorized administrator selects the customer and edition via the panel/API/MCP (existing admin-only write access).
2. `Licenses.beforeValidate` generates a CSPRNG key on the server during create; the client's key is never used.
3. The product is derived from the edition; the seat count takes the default. For subscriptions, if `expiresAt` is empty, it is computed as startsAt + durationMonths.
4. A customer can read only their own license; they cannot create/update/delete directly.
5. License validation: `src/lib/licenses/validity.ts` (active, date range) → permission for licensed downloads.
6. If the SMTP host is empty/placeholder, the Payload console adapter is used; automatic license notification e-mail was not added.

## Critical flow 2: licensed media access
- The default for `media.protected` is `true` (set to `false` for public images).
- Via `mediaRead` (`src/access/index.ts`) and `downloads`: protected files open only to staff or a customer with a valid license.
- A hook mirrors the `downloads` access onto the `media` side; if there is no match, it stays closed.

## Critical flow 3: i18n paths
- `localePrefix: 'always'`: default TR under `/tr/...`, EN under `/en/...`; root paths redirect to the TR prefix. Route mapping in `src/i18n/paths.ts` (`CANONICAL_PATHS`).
- Examples: `/tr/urunler` ↔ `/en/products`, `/tr/cozumler` ↔ `/en/solutions`, `/tr/referanslar` ↔ `/en/customers`, `/tr/haberler` ↔ `/en/news`, `/tr/kariyer` ↔ `/en/careers`, `/tr/iletisim` ↔ `/en/contact`, `/tr/sirket/hakkimizda` ↔ `/en/company/about`, `/tr/yasal/[slug]` ↔ `/en/legal/[slug]`.
- Dictionaries: `src/i18n/messages/tr.json`, `en.json` (next-intl). Route directories sit under `[locale]` and use TR slugs (`urunler/`, `cozumler/`).
- Language alternates: `src/lib/alternates-store.ts` + `src/components/layout/set-alternates.tsx` → `LanguageSwitcher`.

## Security and helper patterns
- **Safe query:** anonymous read pattern in `src/lib/site.ts` and `src/lib/content.ts`: `overrideAccess: false`, `user: null`, `draft: false`, limited fields and depth; does not throw, returns a safe fallback.
- **safeHref** (`src/lib/utils.ts`): strips `javascript:` and protocol-relative (`//`) URLs; passes only `http`, `https`, `mailto`, `tel`, and local paths.
- **Section theme** (`src/components/ui/section.tsx`): `data-theme="dark|light"` switches the CSS tokens in the subtree.
- **Blocks renderer** (`src/components/blocks/render-blocks.tsx`): `registry.ts` (single mapping) + `lib/blocks/render-plan.ts`; skips undefined/hidden blocks. Each block is wrapped in `BlockShell` (theme/spacing/container/anchor/`data-anim`); `appearance` defaults are a single source in `src/fields/block-settings.ts`. The hero h1 only via `firstHeroH1`. Block fields may only be added (renaming = SQLite table rebuild).
- **Slug** (`src/fields/slug.ts`): automatic generation, regex validation, uniqueness scoped by parent relationship via `scope`.

## Tests
- Unit (Vitest, `tests/unit/`): access, collections, frontend-content/routing/security/site, license-key, sqlite-integrity (license assignment and data preservation), slugify.
- E2E (Playwright, `tests/e2e/smoke.spec.ts`): smoke test only; the full flow is in Phase 9.

## Phase 4 support and form boundaries
- `src/lib/support.ts`: anonymous queries for documentation, releases, public downloads, and FAQ tied to the product's public publication; licensed records are not queried. `supportVariants` maps locale paths by ID.
- `src/lib/search.ts` + `src/access/search.ts`: index query and current source access; the raw search API also returns only public source IDs.
- `src/lib/forms/{schema,security,data,action}.ts`: the four allowed form IDs, Zod/KVKK, honeypot, origin host, a verified Caddy IP header or a shared limit, and Turnstile. Closed when the production secret is absent; development skips it.
- `form-submissions.create = nobody`; only the server action writes after validation, using `overrideAccess:true`. Notification is sent after the record is saved; a failure does not break submission; headers are not derived from user data.
- `pnpm ensure-forms`: upserts by the stable `softmarket-*` title; form block IDs and TR/EN labels are preserved. Does not add schema.
- Scoped slug uniqueness uses `find(limit:1, depth:0)` instead of `count` for SQLite/Payload locale compatibility.

## Phase 8a content and MCP
- `scripts/content-import.ts`: AJV/JSON Schema, separate TR/EN writes, slug/SKU upsert; docs by product+slug, releases by product+version. FAQ now carries a localized slug.
- Two stages: first create the identities with required relationships; then fill block/optional relationships. Product↔FAQ cycles and forward docs.parent references are supported. Row/block IDs are preserved across locales and repeated runs.
- Media upsert identity is `media.seedPath` (unique); when real file name conflicts occur, the file name assigned by Payload is kept.
- The CLI uses a single DB transaction: an error rolls back all record writes; uploaded files are outside the SQLite transaction scope. `--dry-run` validates files/relationships and does not write. `--legal`: Markdown → Payload Lexical → pages (legal), explicitly published.
- MCP 3.85.1 `/api/mcp`: `src/lib/mcp.ts` is the single allowlist; admin `users` API key, Bearer transport; cookie/JWT/editor/customer rejected. Key fields are admin-only; the key is revoked on role demotion. License delete is disabled; experimental tools are disabled.
- Cloudflare Web Analytics token: if present, frontend beacon; excludes portal/admin; with `spa:false`, portal navigation is not measured. Measurement is limited to document loads.

## Phase 9 — ISR, CSP, and SEO (2026-11-06)
- The locale layout does not read cookies/headers; the Header shows the same `/hesap` link to everyone. Public home page, family/product and content details, plus corporate/listless pages use `generateStaticParams` and 3600 s ISR. Static params come only from public/published sitemap sources; new slugs can be generated on request.
- Catalog/solution/news/support lists filtered by URL query, search, and forms are dynamic; the portal layout is `force-dynamic`, `revalidate=0`, `fetchCache=force-no-store` and stays noindex. There is no generateStaticParams in the locale layout: Next 15 would misleadingly label the dynamic pages below it with `●`.
- Payload config wraps the afterChange/afterDelete hooks of public collections and the globals afterChange hooks with `src/lib/revalidate.ts`; existing hooks are preserved. Invalidating the `/tr` and `/en` layouts covers all detail/list/nav dependencies, and also `/sitemap.xml`. The CLI outside Next is skipped; if there is no cache context, the error is caught, and at most an hourly refresh is expected.
- CSP is Report-Only by default; `CSP_ENABLED=false` turns it off, `CSP_ENFORCE=true` makes it mandatory. ISR public HTML uses a static allowlist; dynamic HTML uses middleware nonce + DynamicSecurity/NonceProvider for JSON-LD/Turnstile. Analytics loads after the document nonce is learned. The admin has a separate unsafe-eval policy; Permissions-Policy/COOP are in next.config headers.
- A request nonce and ISR cannot both be supported on all public pages: https://nextjs.org/docs/app/guides/content-security-policy#static-vs-dynamic-rendering-with-csp . The nonce read must not be moved into the shared locale layout. Loading is a client component; an implicit server getTranslations there would make the whole frontend dynamic.
- `skipMiddlewareUrlNormalize=true`: prevents an external proxy/redirect loop caused by 127.0.0.1 → localhost normalization during the Next 15 production EN rewrite. Middleware passes the original NextRequest to next-intl.
- `MediaImage` uses next/image; since Payload URLs stay the same when access changes, **all are unoptimized**. `images.localPatterns` covers only `/images/**`, remotePatterns is empty: a direct optimizer request to `/api/media/file` also gets 400; a protected file cannot enter the shared optimizer cache.
- `server-url.ts` reduces local aliases to 127.0.0.1:3100; if the production domain is missing/broken/local, build/start shows an explicit warning. The OG/Twitter fallback `/[locale]/opengraph-image` is a next/og branded TR/EN PNG; search is noindex + robots disallow, not in the sitemap; all URLs have lastmod; documents use TechArticle.
- `NEXT_DIST_DIR=.next-prod pnpm build` keeps the running `.next` dev output intact. `pnpm test:e2e` runs only Playwright; the build is a separate step. Playwright baseURL and reuse URL: http://127.0.0.1:3100/tr; a standalone start uses `.next-prod`.
