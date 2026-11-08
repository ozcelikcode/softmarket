## Memory Bank

Her görev başında `memory-bank/` altındaki tüm dosyaları oku; önemli değişikliklerden sonra `activeContext.md` ve `progress.md`'yi güncelle.

# SoftMarket — Phase 1 (data core)

- Stack: Next.js 15 App Router, Payload CMS 3, SQLite, TypeScript strict, Node 24, pnpm 12.
- Payload config: `src/payload.config.ts`. Localization `tr` (default) + `en`, fallback on. Plugins: seo, form-builder, search.
- Admin/API routes: `src/app/(payload)`. Frontend route directories: `src/app/(frontend)/[locale]`.
- Empty directories intentionally use `.gitkeep`. Do not add page content, integrations, or seed data until the relevant phase is requested.
- `make dev`: run Next on the host; SQLite is local. Deploy: systemd + Caddy + Litestream on one VPS.
- Yerel: http://127.0.0.1:3100
- Checks: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`. E2E: `pnpm test:e2e` (Chromium installation required).
- Types/import map: `pnpm generate:types`, `pnpm generate:importmap`. DB push is OFF: schema change => `pnpm migrate:create <name>` (wraps tsx; plain `payload migrate:create` fails) then `pnpm migrate`.
- Never commit `.env`, credentials, local uploads, or backups. Do not commit changes unless explicitly requested.
- Respect `RTK.md` when present; it is not included in this repository.

## Collection map (`src/collections`, globals in `src/globals`, blocks in `src/blocks`)

- Identity: `users` (roles admin|editor, only panel users) · `customers` (portal auth, verify email, company/tax/phone).
- Catalog: `product-families` → `products` (drafts, blocks `layout`, features/specs/requirements) → `editions` (sku (stable quote identifier), licenseType, durationMonths, seats).
- Marketing: `solutions`*, `industries`, `case-studies`*, `posts`*, `careers`, `partners`, `pages`*, `media`.
- Support: `docs`* (slug unique per product+locale), `releases` (unique product+version), `downloads` (file→media, os, access public|licensed), `faqs`, `support-tickets` (messages array).
- Licenses: `licenses` (CSPRNG key unique, product denormalised from edition).
- Plugin: `forms`, `form-submissions`, `search` (products, docs, faqs, posts). Globals: `header`, `footer`, `site-settings`.
- `*` = drafts+versions. Content fields `localized`; slugs via `slugField()` (`src/fields/slug.ts`): auto from title, unique per locale.

## Access rules (`src/access`)

- Payload default access is `Boolean(user)` and customers ARE users: every collection/global/plugin collection must set explicit access.
- Admin panel: `users` with role admin/editor only; `customers.access.admin = false`.
- Content: public read (`publishedOrStaff` for drafted collections; `careers` only `isOpen`); write = admin/editor.
- `licenses`: read = admin or owner customer; create/update/delete = admin only. Server code uses `overrideAccess: true`. Customers NEVER write them.
- `support-tickets`: read/update = staff or owner; customers create for themselves and may only append messages (hook-enforced).
- `downloads`/`media`: `public` for everyone; `licensed` only for staff or customers with a valid license (active, started, not expired) for the product. `downloads` hook syncs `media.visibility/licensedProducts` (fail-closed).
- `users`: admins manage; staff edit self; roles field admin-only. First user becomes admin. `site-settings` update = admin.

## Tanıtım, teklif ve lisans atama

- Online ödeme yok. Her sürümde Teklif İste; SKU dilden bağımsız sürüm tanımlayıcısıdır.
- Lisansı admin paneli veya yetkili API/MCP üzerinden yönetici atar; mevcut admin-only yazma erişimi korunur. Müşteri asla lisans oluşturamaz/güncelleyemez.
- Anahtar create sırasında sunucuda `src/lib/licenses/generate.ts` ile üretilir. Ürün ve koltuk sayısı sürümden alınır; abonelik bitişi başlangıç + ay süresidir.
- SMTP host boş veya `CHANGE_` ile başlıyorsa Payload konsol adaptörü kullanılır.

## Faz 8a: JSON içerik importu

- `pnpm content:import [directory|file.json] [--dry-run] [--legal]`; varsayılan `content/seed`. `make seed` = ensure-forms + content:import.
- Format: `content/seed/schema.json`; her koleksiyon dizisindeki kayıt `{ "tr": { ...Payload alanları }, "en": { ...Payload alanları } }`. Ortak alanlar ve array/blok sırası iki dilde aynı; lokalize alanlar farklı olabilir. `version: 1` zorunlu. Fiyat/ID kabul edilmez.
- İlişkiler hedefin **TR slug** değeri; editions = SKU; docs = `product-tr-slug/doc-tr-slug`; releases = ürün+version kimliği. Forms referansları ensure-forms'un sabit `title` değeri. Çoklu koleksiyon linki `{ "relationTo": "products", "value": "ornek-urun" }`.
- Rich text: `{ "markdown": "# Başlık\nMetin" }`.
- Site içi linkler (header/footer/bloklar): `{ "type": "route", "route": "urunler", "label": "…" }`; dinamik yol `{ "route": "yasal_slug", "routeParam": "eula" }`. Anahtarlar `src/i18n/paths.ts` `LINK_ROUTES`; `/tr`/`/en` önekli URL yazma. Vurgu rengi `site-settings.brand.accent` (hex, WCAG AA kuralı `src/lib/brand.ts`), `motion: subtle|none`. Globals: `globals: { "header": { "tr": {...}, "en": {...} }, ... }`.
- Medya: `media: [{ "path": "media/screen.png", "alt": { "tr": "Ekran", "en": "Screen" }, "protected": false }]`; dosya `content/seed/media` içinde, alan referansı `"heroImage": "media/screen.png"`. Dosya adları seed içinde tekil olmalı. Medya `seedPath` alanıyla upsert edilir; Payload dosya adı çakışmalarında da kimlik korunur. Public görseller açıkça `protected:false`.
- Slug/SKU kimliği sabittir: değiştirirsen yeni kayıt kabul edilir. Aynı dosyaları tekrar çalıştırmak kayıt/array/blok kopyası üretmez. Schema dosyası import edilmez.
- `--legal`: `content/legal/{tr,en}/*.md` → pages (`pageType: legal`, dosya adı slug), Payload Markdown→Lexical; **yayınlar**. Hukuki taslaklar hazır olduğunda kullan; varsayılan komut legal dosyaları import etmez.
- CLI tek DB transaction kullanır; hata dosya+koleksiyon+kimlikle raporlanır. SQLite rollback medya dosyalarını geri almaz.

## Payload MCP (3.93.0)

- Streamable HTTP: **http://127.0.0.1:3100/api/mcp** (POST). Kurulu plugin endpoint'i ve anonim 401 doğrulandı. GET araç çağrısı değildir.
- Admin panelinde `users` koleksiyonundaki **admin** kullanıcıya API key etkinleştir. Anahtarı repoya yazma; `SOFTMARKET_MCP_API_KEY` ortam değişkeninde tut. Editor/customer/session cookie/JWT MCP açamaz. Rol düşürme anahtarı iptal eder.
- 3.90+ anahtarı üretim anında kopyala; sonraki UI/Local API okumalarında gösterilmez (`hasAPIKey` sanal alanı yalnız varlığını bildirir). `useAPIKey.reveal` açılmaz. 3.93 için Node `>=24.22.1 <25`; Next `15.4.11` / React `19.2.6` korunur. Yeni JWT `authVersion` başlığı nedeniyle yükseltme sonrası eski admin/portal oturumları tekrar giriş gerektirir.
- `users.useAPIKey` anahtarı Bearer olarak taşınır; plugin `overrideAuth` yalnız bu anahtarı doğrular. Plugin'in kendi `payload-mcp-api-keys` koleksiyonu erişime kapalı ve gizlidir.
- Claude Code yerel `.mcp.json` örneği (dosyaya gerçek anahtar koyma):

```json
{
  "mcpServers": {
    "softmarket": {
      "type": "http",
      "url": "http://127.0.0.1:3100/api/mcp",
      "headers": { "Authorization": "Bearer ${SOFTMARKET_MCP_API_KEY}" }
    }
  }
}
```

- İzinli koleksiyonlar: product-families, products, editions, solutions, industries, case-studies, posts, careers, partners, pages, docs, releases, downloads, faqs, media (CRUD); **licenses yalnız create/find/update; delete kapalı**.
- Globals: header, footer, site-settings (find/update). users, customers, forms, form-submissions, support-tickets, support-ticket-messages, search ve deneysel auth/config/schema/jobs araçları kapalı.
- Agent upsert: önce slug/SKU ile find; varsa ID üzerinden update, yoksa create. İçerik yazımında locale tr/en ayrı ve yayın için `_status: published` kullan. MCP create doğal olarak upsert değildir; idempotent toplu içerik için content:import kullan.
- MCP araç sözleşmesi: `findPages.where` JSON **string** (`JSON.stringify({ slug: { equals: 'home' } })`); `select/populate/joins` nesnedir. `createPages/updatePages` içerik alanlarını **kök argümanlar** olarak alır (`{ id, locale: 'tr', layout: [...], _status: 'published' }`), `data` sarmalı yoktur. Global update araçları aynı kök alan desenini kullanır. Gerçek şekil için `tools/list` şemasını esas al.
- Dev HMR authStrategies kaydını yenilemez: yeni users API key stratejisi olağan sonraki süreç başlangıcında aktif olur. Bu fazda restart yapılmadı; taze Payload handler ile 69 araç doğrulandı.
- Analytics: `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` varsa frontend beacon. Cloudflare auto-injection kullanma (portal/admin sınırını aşar). `spa:false` ile ölçüm document yüklemeleriyle sınırlı. Kaynak: https://developers.cloudflare.com/web-analytics/get-started/web-analytics-spa/

## Page builder (F6): ana sayfa, sistem sayfaları, landing

- Ana sayfa = `pages` kaydı. Çözüm sırası: `site-settings.homePage` → slug `home` → yerleşik yedek (`src/components/home/fallback-home.tsx`). Yalnız **yayınlı** kayıt görünür; taslak ziyaretçiye gitmez. `/home` → `/` (308).
- Bloklar `layout` dizisinde sırayla render edilir; ilk `hero` sayfanın h1'idir. Ana sayfa seed'i `content/seed/05-pages.json` (bugünkü düzenin birebir karşılığı: hero `aside: families`, productFamilies, solutionsGrid, logoWall, caseStudy, newsList, cta). Görünüm: `appearance.{theme,spacing,align,width,animation,anchor,hidden,separator}`.
- Sistem sayfaları: `pages.systemKey` ∈ `products|solutions|news|customers|careers|partners|support|contact|about` (her biri tek kayıt) → `hero` (eyebrow/title/lead/actions; boş alan = i18n) + bloklar o rotada. Listenin yeri `listing` bloğudur; blok yoksa liste hero'nun altında, `appearance.hidden` ile gizlenir. Kayıt yoksa rota eski düzende kalır.
- Landing: `pageType` standard/landing + `systemKey` boş → `/tr/<slug>`, `/en/<en-slug>`. Rota klasörü/EN çevirisi olan slug'lar (`urunler`, `products`, `hesap`, `admin` …; `src/lib/system-pages.ts` `RESERVED_SLUGS`) reddedilir. Link: `type: internal` + pages referansı (dile göre slug) ya da `type: route`, `route: slug`, `routeParam: <tr-slug>`.
- `pageType: template` asla public değildir (anonim okuma/rota/sitemap yok); Payload "Duplicate" ile yeni sayfa başlat (systemKey kopyada boşalır).
- Yayın (`_status: published`) ve global güncellemesi tüm site önbelleğini yeniler (`revalidatePath('/', 'layout')`); taslak/autosave yenilemez. CLI (`content:import`) Next önbelleğine erişemez: canlı süreçte en geç 1 saatte ya da admin/API'den bir yayınla yenilenir.
- MCP ile ana sayfa blok sırası (admin API anahtarı; `pages` CRUD açık):
  1. `findPages` `where: JSON.stringify({ slug: { equals: "home" } })`, `locale: "tr"`, `depth: 0` → `id` ve `layout`.
  2. `layout` dizisinin **tamamını** yeni sırayla gönder (blokların `id`'lerini koru, eksik blok silinir): `updatePages` `{ id, locale: "tr", layout: [...], _status: "published" }`. Blok yapısı dilden bağımsızdır; yalnız metin değiştirirken EN için `locale: "en"` ile aynı sırayı ve `id`'leri gönder.
  3. Ana sayfayı başka kayda çevirmek: `updateSiteSettings` `{ homePage: <pageId> }`.
- Toplu/idempotent içerik için `pnpm content:import` (slug/TR kimliği); MCP create upsert değildir.

## Live Preview + taslak modu (F8)

- Admin'de Live Preview: `pages, products, product-families, solutions, case-studies, posts` (390/768/1440). iframe `/api/preview?redirect=/<tr|en>/…` açar; `pages` autosave ~2 sn, kayıt/autosave sonrası iframe `RefreshRouteOnSave` ile yenilenir.
- `/api/preview` yalnız oturum açmış staff (users admin/editor) için draft modunu açar; anonim 401, customer 403, cross-site 403, redirect yalnız `/tr|/en` + slug segmentleri (aksi 400). Gizli token yok. Çıkış: `/api/exit-preview?redirect=/tr/…`.
- Taslak yalnız draft modu **ve** her istekte yeniden doğrulanan staff oturumu ile okunur (`src/lib/preview.ts` `readAs`); yeni tekil sayfa yükleyicisi eklerken `...(await readAs(locale))` kullan, liste sorguları anonim kalsın. Frontend rotalarında `dynamic = 'error'|'force-static'` kullanma (draft okumayı kapatır; testle yasak).
- Draft yanıtları `private, no-store`, ISR'a yazılmaz; taslak/autosave önbelleği yenilemez (yalnız yayın).


## Yeni şirket kurulumu (starter)

- `content/templates/starter/` boş DB'de çalışan nötr site üretir: globals (header/footer/site-settings), ana sayfa (hero, productFamilies, cta), 9 sistem sayfası, 1 örnek aile + ürün + sürüm (`STARTER-ORNEK-URUN`). Yasal sayfa yoktur.
- **Yalnız yeni/boş kurulum içindir.** Mevcut kurulu DB'de çalıştırmayın: import ekleme ile sınırlı değildir; aynı TR slug/SKU (`home`, sistem sayfaları, `ornek-aile`, `ornek-urun` dahil) kayıtlarının içeriğini günceller ve taslaklı koleksiyonları yayınlar; menü/footer/site ayarlarında gönderilen alanların üzerine yazar. İdempotans mevcut özelleştirmeleri korumaz. `--dry-run` da gerçek yazımları transaction içinde yapıp geri alır; kurulu siteyi incelemek için DB ve uploads kopyasını kullanın.
- Sıra: `pnpm migrate` → `pnpm ensure-forms` → `pnpm content:import content/templates/starter --dry-run` → aynı komut `--dry-run`sız. İdempotenttir; sonra admin `Site ayarları`ndan ad, logo, vurgu rengi; örnek aile/ürünü kendi kayıtlarınla değiştir. Demo içerik (`content/seed`) ayrıdır; silme komutu yoktur.
- Yasal metinler hazır olunca `--legal`. Starter izole SQLite testi: `tests/unit/starter-template-db.test.ts`.
- Admin etiketleri (TR/EN) `src/lib/admin-i18n.ts` sözlüğünden gelir (`payload.config.ts` uygular); yeni koleksiyon/alan eklerken sözlüğe gir. `tests/unit/admin-labels.test.ts` eksik/İngilizce kalıntıyı yakalar. Live Preview breakpoint `label` düz string kalmalı (Payload React child olarak basar).
