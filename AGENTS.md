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
- Sales (P2-S, payments still off): `orders` (orderNumber/idempotencyKey unique, items[].license, billing TCKN/VKN, consents) and `payment-events` (eventKey unique, body SHA-256 only). Store `src/lib/payments/store/**` (BEGIN IMMEDIATE, conditional writes, one licence per order). Editions `saleMode`/`pricing.*Minor` and `site-settings.commerce.{mode,providers,vat,quoteSince}`: staff read, admin write (commerce switch panel-only, not API key), never in content:import.
- Plugin: `forms`, `form-submissions`, `search` (products, docs, faqs, posts). Globals: `header`, `footer`, `site-settings`.
- `*` = drafts+versions. Content fields `localized`; slugs via `slugField()` (`src/fields/slug.ts`): auto from title, unique per locale.

## Access rules (`src/access`)

- Payload default access is `Boolean(user)` and customers ARE users: every collection/global/plugin collection must set explicit access.
- Admin panel: `users` with role admin/editor only; `customers.access.admin = false`.
- Content: public read (`publishedOrStaff` for drafted collections; `careers` only `isOpen`); write = admin/editor.
- `licenses`: read = admin or owner customer; create/update/delete = admin only. Server code uses `overrideAccess: true`. Customers NEVER write them.
- `support-tickets`: read/update = staff or owner; customers create for themselves and may only append messages (hook-enforced).
- `downloads`/`media`: `public` for everyone; `licensed` only for staff or customers with a valid license (active, started, not expired) for the product. `downloads` hook syncs `media.visibility/licensedProducts` (fail-closed).
- `orders`: read = staff or owner customer (any commerce mode); create/delete = nobody (server `overrideAccess`); update = admin, only invoice/notes/requiresReview; billing/consents hidden from editors. `payment-events`: read admin, nothing else. Both NOT in the MCP allowlist.
- `users`: admins manage; staff edit self; roles field admin-only. First user becomes admin. `site-settings` update = admin.

## Tanıtım, teklif ve lisans atama

- Online ödeme yok. Her sürümde Teklif İste; SKU dilden bağımsız sürüm tanımlayıcısıdır.
- Lisansı admin paneli veya yetkili API/MCP üzerinden yönetici atar; mevcut admin-only yazma erişimi korunur. Müşteri asla lisans oluşturamaz/güncelleyemez.
- Anahtar create sırasında sunucuda `src/lib/licenses/generate.ts` ile üretilir. Ürün ve koltuk sayısı sürümden alınır; abonelik bitişi başlangıç + ay süresidir.
- SMTP host boş veya `CHANGE_` ile başlıyorsa Payload konsol adaptörü kullanılır.

## Ödeme: checkout ve siparişler (P5)

- Yüzey yalnız `getCommerceState().checkoutOpen` iken açık: env `PAYMENTS_ENABLED=true` + site modu `payments` + sağlayıcı + KDV + yasal sayfalar hazır; varsayılan kurulumda her şey teklif modunda. `CHECKOUT_READY` bayrağı açık (tek başına bir şey açmaz).
- Rotalar: TR `/hesap/satin-al/[sku]`, `/hesap/siparisler[/no]` ↔ EN `/account/checkout/[sku]`, `/account/orders[/no]`. Checkout kapalı/sürüm satın alınamaz ise teklif sayfasına yönlenir (fail-to-quote); siparişler her modda salt okunur görünür. Müşteri başkasının sipariş numarasında 404 alır.
- `startCheckoutAction` (`src/lib/portal/checkout-actions.ts`) → `createCheckoutOrder` (`src/lib/payments/checkout.ts`): fiyat/KDV/sağlayıcı/sözleşme metni sunucuda hesaplanır, formdan tutar okunmaz; aynı form jetonu tek sipariş üretir; sözleşme kopyası `src/lib/payments/contract.ts`. JS'siz çalışır (POST→303).
- Callback 303 hedefi göreli `/{dil}/hesap/siparisler?donus=1`; sayfa oturumdaki müşterinin son siparişine yönlendirir (numara URL'de taşınmaz).
- **Build ortamında `PAYMENTS_ENABLED=true` olmalı:** capability açıkken `[locale]/layout.tsx` `commerceRenderBoundary()` (`src/lib/commerce/state.ts`) çağırır ve sitenin tüm sayfaları istek başına üretilir; derleme sabiti `__SOFTMARKET_BUILD_PAYMENTS__` (`next.config.ts`). Capability'li derlemede `contentStaticParams` rota başına tek sonda yolu (`__dynamic__`) döndürür, böylece boş listeli rota ISR fallback kalmaz. Capability'siz build + capability'li süreç = ödeme gizli (kapalıya düşer, `noStore` çağrılmaz) ve yeniden build gerekir. `getCommerceState()`'i yalnız bazı veri yollarında çağırmak tek başına yetmez (P6 bulgusu: "Page changed from static to dynamic at runtime" → 500); yeni okuyucu `[locale]` layout'u altında olmalı (testli).
- İzole e2e: `E2E_NEXT_DIST_DIR=.next-<ad> pnpm test:e2e:isolated` (build ortamı `PAYMENTS_ENABLED=true` + kopya DB); sahte iyzico `scripts/e2e-fake-iyzico.ts` (port 3500) için ayrı `SOFTMARKET_E2E_BUILD=1` derlemesi ve `assertIsolatedE2E` gerekir; bu derlemeyi dağıtmayın.

## Ödeme: yönetici işlemleri (P6)

- Sipariş belgesi yan paneli "Sipariş işlemleri" (`ui` alanı, `src/admin/fields/order-actions*.tsx`): **İade et** (paid/fulfilled, tam tutar), **İptal et** (pending), **Bildirimi yeniden gönder**. Uç noktalar `POST /api/orders/:id/{refund,cancel,resend-notifications}` (`src/lib/payments/admin-endpoints.ts`): yalnız admin **panel oturumu** (cookie, `_strategy=local-jwt`, `Authorization` başlığı yok) + aynı origin; anonim 401, editor/customer/API key/MCP 403.
- İade protokolü (`src/lib/payments/admin-actions.ts`): önce `provider.refundStatus()` (iyzico `/v2/reporting/payment/details`, Stripe PaymentIntent) → sipariş başına tek kilit (`payment-events` `<sağlayıcı>:admin-refund:<no>`) → tek `refund()` → tek transaction'da `refunded` + lisanslar `revoked`. Zaman aşımı/belirsiz yanıt: **kör tekrar yok**, sipariş `requiresReview` (`refund_uncertain`), reconcile yalnız okur. İade e-postası kalıcı kuyrukta (`notify.ts` tür `refund`, işaret `<sağlayıcı>:refund-notice:<no>`); şema değişmedi.
- Stripe `charge.dispute.created` → lisanslar `suspended` + inceleme; `charge.refunded` → sağlayıcı okunup `refunded`. iyzico'da itiraz bildirimi yok (elle). Operasyon: `docs/payments/operations.md`.

## Faz 8a: JSON içerik importu

- `pnpm content:import [directory|file.json] [--dry-run] [--legal]`; varsayılan `content/seed`. `make seed` = ensure-forms + content:import.
- Format: `content/seed/schema.json`; her koleksiyon dizisindeki kayıt `{ "tr": { ...Payload alanları }, "en": { ...Payload alanları } }`. Ortak alanlar ve array/blok sırası iki dilde aynı; lokalize alanlar farklı olabilir. `version: 1` zorunlu. Fiyat/ID kabul edilmez.
- İlişkiler hedefin **TR slug** değeri; editions = SKU; docs = `product-tr-slug/doc-tr-slug`; releases = ürün+version kimliği. Forms referansları ensure-forms'un sabit `title` değeri. Çoklu koleksiyon linki `{ "relationTo": "products", "value": "ornek-urun" }`.
- Rich text: `{ "markdown": "# Başlık\nMetin" }`.
- Site içi linkler (header/footer/bloklar): `{ "type": "route", "route": "urunler", "label": "…" }`; dinamik yol `{ "route": "yasal_slug", "routeParam": "eula" }`. Anahtarlar `src/i18n/paths.ts` `LINK_ROUTES`; `/tr`/`/en` önekli URL yazma. Vurgu rengi `site-settings.brand.accent` (hex, WCAG AA kuralı `src/lib/brand.ts`), `motion: subtle|none`. Globals: `globals: { "header": { "tr": {...}, "en": {...} }, ... }`.
- Medya: `media: [{ "path": "media/screen.png", "alt": { "tr": "Ekran", "en": "Screen" }, "protected": false }]`; dosya `content/seed/media` içinde, alan referansı `"heroImage": "media/screen.png"`. Dosya adları seed içinde tekil olmalı. Medya `seedPath` alanıyla upsert edilir; Payload dosya adı çakışmalarında da kimlik korunur. Public görseller açıkça `protected:false`.
- Slug/SKU kimliği sabittir: değiştirirsen yeni kayıt kabul edilir. Aynı dosyaları tekrar çalıştırmak kayıt/array/blok kopyası üretmez. Schema dosyası import edilmez.
- Editörde kompozisyon moduna geçmiş ürünün en son taslak/autosave layout'u import'ta korunur (seed eski düzendeyse, `--dry-run` dahil): TR/EN yazımından ve ilişki/Markdown dönüşümünden layout çıkarılır; diğer alanlar güncellenir, `warn products:<tr-slug> layout korundu (editörde düzenlenmiş)` basılır, hata/exit≠0 yok. Import yine yayınlar; yalnız taslakta olan kompozisyon da yayına geçer. Layout yapısı ortaktır, blok içi metinler lokalizedir; tek dilde bağlı blok taşıyan seed yazmadan reddedilir. Seed de kompozisyondaysa V2 doğrulamalarıyla yazılır. Diğer koleksiyonlar etkilenmez.
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
- **Header/footer drafts (G1):** `header` and `footer` have drafts + autosave (2 s). Publishing a change via MCP/API: `updateHeader`/`updateFooter` with `_status: 'published'` (always send it). A draft write needs `draft: true` (version table only; the public site is unchanged). `_status: 'draft'` without `draft: true` is rejected with 400 (public reads ignore `_status`, so it would leak draft content); the chrome cannot be unpublished, and only a published version can be restored (not "as draft"). `content:import` always publishes these globals. Only publishing (incl. a published version restore) revalidates the site; draft/autosave never does. `editorVersion` (virtual, same as V5 collections) gives 409 on a stale admin save; writes without it pass. `site-settings` has no drafts (save = publish).
- **G1 audit safeguards:** anonymous/customer reads apply a published-status constraint even with `draft: true`; version history is staff-only. A status-less write while a draft is pending returns 400. Header/footer writes with `select` return 400 because Payload 3.93 otherwise saves incomplete versions; use a separate projected read. Link grandfathering on publication compares all locales and row IDs against the public main row, never the latest autosave; rejected publications roll back before revalidation.
- **Link addresses (G1):** `linkField().url` is validated on the server (`isAllowedLinkUrl`, `src/lib/safe-href.ts`): http/https/mailto/tel, `/` paths, `#`/`?`; `javascript:`/`data:`/`vbscript:`/`//` always rejected. An unchanged stored invalid but harmless value (e.g. placeholder `mailto:[COMPANY EMAIL]`) is kept. Drafts are not validated by Payload; publishing is. Header/footer loaders read the draft only for a staff preview request (`getHeaderNav(locale, getPreviewUser())`).
- Agent upsert: önce slug/SKU ile find; varsa ID üzerinden update, yoksa create. İçerik yazımında locale tr/en ayrı ve yayın için `_status: published` kullan. MCP create doğal olarak upsert değildir; idempotent toplu içerik için content:import kullan.
- MCP araç sözleşmesi: `findPages.where` JSON **string** (`JSON.stringify({ slug: { equals: 'home' } })`); `select/populate/joins` nesnedir. `createPages/updatePages` içerik alanlarını **kök argümanlar** olarak alır (`{ id, locale: 'tr', layout: [...], _status: 'published' }`), `data` sarmalı yoktur. Global update araçları aynı kök alan desenini kullanır. Gerçek şekil için `tools/list` şemasını esas al.
- Dev HMR authStrategies kaydını yenilemez: yeni users API key stratejisi olağan sonraki süreç başlangıcında aktif olur. Bu fazda restart yapılmadı; taze Payload handler ile 69 araç doğrulandı.
- Analytics: `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` varsa frontend beacon. Cloudflare auto-injection kullanma (portal/admin sınırını aşar). `spa:false` ile ölçüm document yüklemeleriyle sınırlı. Kaynak: https://developers.cloudflare.com/web-analytics/get-started/web-analytics-spa/

## Page builder (F6): ana sayfa, sistem sayfaları, landing

- Ana sayfa = `pages` kaydı. Çözüm sırası: `site-settings.homePage` → slug `home` → yerleşik yedek (`src/components/home/fallback-home.tsx`). Yalnız **yayınlı** kayıt görünür; taslak ziyaretçiye gitmez. `/home` → `/` (308).
- Bloklar `layout` dizisinde sırayla render edilir; ilk `hero` sayfanın h1'idir. Ana sayfa seed'i `content/seed/05-pages.json` (bugünkü düzenin birebir karşılığı: hero `aside: families`, productFamilies, solutionsGrid, logoWall, caseStudy, newsList, cta). Görünüm: `appearance.{theme,spacing,align,width,animation,anchor,hidden,separator}`.
- Hareket (V1, `src/fields/block-motion.ts`; spacer/divider/listing hariç): `motion.preset` auto|none|fade|slide-up|slide-down|slide-left|slide-right|zoom-in|parallax-soft|stagger, `trigger` scroll|scroll-progress|load|hover, `duration` fast|base|slow, `delay` "0"|"100"|"200"|"300", `easing` soft|standard|emphasized, `stagger` none|tight|relaxed, `mobile` (paralaks). Varsayılanlar eski görünüm; `appearance.animation: none` hepsini kapatır. Hero yalnız auto/none/slide-*/parallax-soft kabul eder; ilk blok + hero'da gizleyen efekt sunucuda kaymaya düşürülür (LCP). CSS sözleşmesi `globals.css` "Motion system" + `src/lib/anim.ts`.
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

- Admin'de Live Preview: `pages, products, product-families, solutions, case-studies, posts` (390/768/1440). iframe `/api/preview?redirect=/<tr|en>/…` açar; `pages` ve `products` autosave ~2 sn, kayıt/autosave sonrası iframe `RefreshRouteOnSave` ile yenilenir.
- `/api/preview` yalnız oturum açmış staff (users admin/editor) için draft modunu açar; anonim 401, customer 403, cross-site 403, redirect yalnız `/tr|/en` + slug segmentleri (aksi 400). Gizli token yok. Çıkış: `/api/exit-preview?redirect=/tr/…`.
- Taslak yalnız draft modu **ve** her istekte yeniden doğrulanan staff oturumu ile okunur (`src/lib/preview.ts` `readAs`); yeni tekil sayfa yükleyicisi eklerken `...(await readAs(locale))` kullan, liste sorguları anonim kalsın. Frontend rotalarında `dynamic = 'error'|'force-static'` kullanma (draft okumayı kapatır; testle yasak).
- Draft yanıtları `private, no-store`, ISR'a yazılmaz; taslak/autosave önbelleği yenilemez (yalnız yayın).


## Ürün sayfası bağlı bloklar (V2)

- `products.layout` = `productBlocks` (`layoutBlocks` + `src/blocks/product-bound.ts`): `productHero`, `productNav`, `productOverview`, `productFeatures`, `productSpecs` (`showRequirements`), `productEditions`, `productDownloads`, `productDocs`. İçerik alanı yok; ürün/sürüm/indirme/doküman kaydından okunur (slot `product`, `src/components/blocks/product/product-blocks.tsx`). Yalnız appearance (anchor yok; hero/editions'ta hidden yok) + motion.
- `src/lib/blocks/product-composition.ts`: layout'ta bağlı blok yoksa **uyumluluk modu** (V2 öncesi sıra + eski tekrar filtresi; sanal `virtual:<tip>` bloklar DB'ye yazılmaz, HTML birebir aynı). En az bir bağlı blok = **kompozisyon modu** (kayıtlı sıra; listede olmayan bölüm çizilmez).
- **`productEditions` (Sürümler + Teklif İste) zorunlu:** taşınabilir, silinemez/gizlenemez. `products.layout` validate + `beforeChange` kancası `ValidationError` (400) atar; taslak/autosave, REST, MCP, content:import dahil. `productHero` ilk blok olmalı (h1/breadcrumb/LCP). Renderer yine de eksik editions/hero'yu ekler ve gizlemeyi yok sayar.
- `productHero` `LCP_BLOCK_TYPES` içinde: yalnız `HERO_PRESETS`, render-plan'da korumalı. Layout `hero` blokları ürün sayfasında h2.
- Products autosave 2 sn (`PRODUCTS_AUTOSAVE_INTERVAL`), yalnız `_products_v`'ye yazar, ISR'ı yenilemez. Migration `20261108_130717_v2_product_bound_blocks` (16 CREATE TABLE + indeks + `_products_v.autosave`).
- Gelecek "Satın al" (docs/plan-payments.md) `productEditions`'a eklemeli seçenek olarak gelir; Teklif İste kalır.

## Görsel düzenleyici (V5, Payload-native canvas)

- `pages` + `products` Live Preview'da açılır (`src/editor/canvas/plugin.ts`: `admin.livePreview.openByDefault` + `beforeDocumentControls` host); form dar yan panel (`src/app/(payload)/custom.scss`). Klasik form ziyaret başına seçimdir (host `editViewType` tercihini canvas'a geri yazar). İkinci dalga koleksiyonu eklemek: `VISUAL_EDITOR_COLLECTIONS` (`rules.ts`) + işaretleyen rota + `INLINE_DOC_FIELDS`.
- Tek veri kaynağı Payload formu: köprü API'ye yazmaz; host (`src/editor/canvas/admin/host.tsx`) mesajı formun GÜNCEL durumuna göre id+locale ile çözer ve form API'siyle uygular (move/add/remove/DUPLICATE_ROW/UPDATE/REPLACE_STATE). Kayıt Payload autosave → sunucu doğrulaması. Şema/migration yok.
- İşaretler yalnız `isEditingRender()` (`src/lib/preview.ts`: draft modu + yeniden doğrulanan staff) ile: `RenderBlocks/CmsPageContent/SystemBody/SystemHero editing`, `planBlocks({ editing })` → `ctx.edit` (gizli bloklar soluk `data-block-hidden`). Metin işaretleri `editText/fieldAttrs/docFieldAttrs` (`block-shell.tsx`); izinli alanlar yalnız `src/editor/canvas/fields.ts` (`INLINE_BLOCK_FIELDS`, `INLINE_DOC_FIELDS`). Yeni blok/metin alanı eklerken listeye ekle; `tests/unit/visual-editor-fields.test.tsx` şema ve render eşleşmesini zorlar. Public/ISR HTML'de `data-block-*`, `data-field-path`, `data-doc-field` YOK.
- Köprü (`bridge.tsx`) yalnız `LivePreviewRefresh` içinde, iframe içindeyken `React.lazy` ile iner (bundle guard). Mesajlar `protocol.ts` (zod/mini, `ns: sm-canvas`, `v: 2`): iki yönde origin + `event.source` (iframe.contentWindow ↔ parent) + strict şema; metin yolu allowlist + prototype segment yasağı; değer düz tek satır ≤1000.
- V2 kuralları editörde aynalanır (`rules.ts`): productHero ilk/kilitli, productEditions taşınır ama silinmez/gizlenmez, bağlı bloklar çoğaltılmaz; uyumluluk ürünü ilk yapısal işlemde 8 bağlı bloğa somutlaşır (eski filtrelenen tekrarlar gizli eklenir).
- Kayıp/çakışma: `admin/sync.ts` sekme gizlenince/kapanınca Payload autosave isteğinin aynısını keepalive PATCH ile gönderir (>60 KB'da `beforeunload` onayı, UTF-8 bayt).
- **Koşullu yazım (P1):** pages/products'a sanal gizli `editorVersion` alanı (okumada = ham tüm-dil belge snapshot SHA-256 özeti; `updatedAt` dahil; DB kolonu YOK) + ilk `beforeChange` kancası (`src/editor/canvas/concurrency.ts`). Admin formu (görsel + klasik, autosave/kaydet/yayınla, flush) sürümü taşır; aynı transaction'da son draft snapshot özetiyle eşleşmezse **409**. Sürüm taşımayan yazımlar (MCP, content:import, Local API, toplu düzenleme) ve açık sürüm geri yükleme koşulsuz yazımdır; MCP'de `editorVersion` gönderme. Editör 409'da "Birleştir ve kaydet / Değişikliklerimi kopyala / Yeniden yükle" gösterir. Birleştirme blok/dizi kimliklerini korur; aynı değer/silme/sıra çakışırsa yazmaz. `editorVersion` staff dışında okunamaz, boş/null değer 400, eski timestamp 409; ilk alan olmalı (locale flatten/populate öncesi hash). Payload `lockDocuments` yalnız başka kullanıcıyı engeller (aynı kullanıcı/MCP anahtarı/başka sekme değil).
- SQLite transaction'ları süreç içinde sıralanır (`src/lib/db-serial-transactions.ts`, `payload.config` adaptörü): libsql her transaction'ı busy-timeout'suz yeni bağlantıda açtığı için eşzamanlı ikinci transaction BEGIN'de SQLITE_BUSY alıyor ve sonraki yazımlar görünmez kalabiliyordu. Transaction içinden Local API çağrısı `req` taşımalı (yoksa 5 sn sonra "write queue timeout").
- Payload iç bağımlılıkları (yükseltmede `tests/e2e/isolated/visual-editor.spec.ts` zorunlu): BEM sınıfları `.collection-edit--is-live-previewing`, `.collection-edit__main`, `.live-preview-window`, satır `#layout-row-N`, `.collapsible-field__collapsible.collapsible--collapsed .collapsible__toggle`, `SET_ROW_COLLAPSED` / `REPLACE_STATE` / `DUPLICATE_ROW` form eylemleri, `#action-save`, `config.blocksMap`.
- E2E: `E2E_SOURCE_DB=<db kopyası> E2E_NEXT_DIST_DIR=.next-<ad> pnpm test:e2e:isolated` (3400, geçici kopya; 16 senaryo: T1–T8, geri al, gizli blok, kapanışta flush, çakışma, sahte postMessage, anonim erişim).

## Satış kapısı ve görünürlük (P3, checkout yok)

- Tek karar noktası `getCommerceState()` (`src/lib/commerce/state.ts`; saf çekirdek `src/lib/payments/commerce-state.ts`): `open` = env `PAYMENTS_ENABLED=true` + `site-settings.commerce.mode='payments'` + açık VE env'de tanımlı sağlayıcı + en az bir KDV kuralı. Fiyat/satın al/yasal satış sayfası/offers kodu env'i ya da global'i doğrudan okumaz. Env capability yoksa DB okunmaz; hata = kapalı (yalnız teklif).
- `checkoutReady` (`src/lib/payments/flags.ts`) `false`: ödeme modunda bile "Satın al" devre dışı düğmedir, checkout linki yoktur (P5 açar). `resolveProductActions` (`src/lib/payments/actions.ts`) sürüm/hero eylemlerinin tek kaynağıdır; "Teklif İste" her durumda kalır, quote modunda HTML P3 öncesiyle birebir aynıdır (`tests/fixtures/legacy-edition-card.tsx` ile testli).
- Fiyat alanları staff-only; `getProductDetail` onları yalnız `open` iken `overrideAccess` ile okur ve ham halini sayfaya vermez (`commerce` eylemleri verilir). Public REST/GraphQL/Local API'de sızıntı yok (testli).
- Satış yasal sayfaları slug sabitiyle (`src/lib/payments/legal.ts`) ayrılır; `open` değilken 404 + sitemap dışı + footer/header linki yok. Şema alanı (`pages.commerceLegal`) önerildi, eklenmedi.
- Admin: site-settings "Satış ve ödeme" bölümünde salt okunur hazırlık listesi (`ui` alanı) ve fiyat için ondalık giriş bileşeni (`1.250,00`; saklama yine tam sayı minor unit). Şema değişmez.

## Yeni şirket kurulumu (starter)

- `content/templates/starter/` boş DB'de çalışan nötr site üretir: globals (header/footer/site-settings), ana sayfa (hero, productFamilies, cta), 9 sistem sayfası, 1 örnek aile + ürün + sürüm (`STARTER-ORNEK-URUN`). Yasal sayfa yoktur.
- **Yalnız yeni/boş kurulum içindir.** Mevcut kurulu DB'de çalıştırmayın: import ekleme ile sınırlı değildir; aynı TR slug/SKU (`home`, sistem sayfaları, `ornek-aile`, `ornek-urun` dahil) kayıtlarının içeriğini günceller ve taslaklı koleksiyonları yayınlar; menü/footer/site ayarlarında gönderilen alanların üzerine yazar. İdempotans mevcut özelleştirmeleri korumaz. `--dry-run` da gerçek yazımları transaction içinde yapıp geri alır; kurulu siteyi incelemek için DB ve uploads kopyasını kullanın.
- Sıra: `pnpm migrate` → `pnpm ensure-forms` → `pnpm content:import content/templates/starter --dry-run` → aynı komut `--dry-run`sız. İdempotenttir; sonra admin `Site ayarları`ndan ad, logo, vurgu rengi; örnek aile/ürünü kendi kayıtlarınla değiştir. Demo içerik (`content/seed`) ayrıdır; silme komutu yoktur.
- Yasal metinler hazır olunca `--legal`. Starter izole SQLite testi: `tests/unit/starter-template-db.test.ts`.
- Admin etiketleri (TR/EN) `src/lib/admin-i18n.ts` sözlüğünden gelir (`payload.config.ts` uygular); yeni koleksiyon/alan eklerken sözlüğe gir. `tests/unit/admin-labels.test.ts` eksik/İngilizce kalıntıyı yakalar. Live Preview breakpoint `label` düz string kalmalı (Payload React child olarak basar).

## Ödeme P4: webhook, callback, reconcile

- Rotalar (yalnız POST): `/api/payments/iyzico/webhook`, `/api/payments/iyzico/callback`, `/api/payments/stripe/webhook`. `PAYMENTS_ENABLED` ≠ `true` ise DB'ye dokunmadan 404; Stripe adaptörü kapalıyken 404. Mantık `src/lib/payments/{events,sync,fulfill,reconcile,runtime,body}.ts`; rota dosyaları yalnız bağlar.
- Olay = tetik, sağlayıcı = gerçek: imza → `payment-events` kaydı → sunucu `retrieve` → koşullu durum geçişi → `fulfilPaidOrder` (tek transaction, tek lisans) → commit sonrası kalıcı bildirim kuyruğu (`src/lib/payments/notify.ts`). Tutar/para birimi/referans uyuşmazlığı = `requiresReview`, lisans yok; uyarı `PAYMENTS_ALERT_EMAIL`.
- Gövde 256 KB okunurken sınırlanır. Drain dışı imzalı olay `ignored` + 200; imzasız 404. Hata/`SQLITE_BUSY` → 500 (sağlayıcı yeniden dener).
- Bildirim kalıcılığı: `orders.notifications` (staff-only, sunucu yazar) `confirmationSentAt/licenseSentAt/reviewAlertSentAt` + `attempts/lastError/nextAttemptAt/leaseUntil`. Gönderim commit sonrası; sipariş başına koşullu lease (eşzamanlı ikinci gönderici durur), her başarıda `WHERE <alan> IS NULL` işaret. Reconcile işaretsiz `fulfilled`/`requiresReview` siparişleri (≤7 gün) en fazla 5 deneme, 15/30/60/120 dk bekleme ile yeniden dener; SMTP (uyarı için `PAYMENTS_ALERT_EMAIL`) yoksa atlar, saymaz. Sipariş lisansları `ORDER_FULFILMENT_CONTEXT` ile oluşturulur → lisans hook'u e-posta atmaz (tek gönderim kuyruktan); elle atanan lisans hook'u `after()` ile eskisi gibi. Teslim en az bir kez: gönderim ile işaret yazımı arasında süreç ölürse tek tekrar olası.
- `pnpm payments:reconcile [--dry-run]` + `deploy/payments-reconcile.{service,timer}` (15 dk). Log'a e-posta/TCKN/VKN/anahtar/gövde yazma (testli). Payments sunucu modüllerini `'use client'` dosyalardan import etme (`payments-p4.test.ts` grafiği tarar; `server-only` paketi CLI/test'i kırdığı için kullanılmıyor).

## Entegrasyon ayarları (panel sırları)

- `integrations` global'i (yalnız admin; versiyonsuz; MCP'de yok): iyzico/Stripe test+canlı anahtarları, ortam seçimi (canlı = ek onay kutusu, sanal alan), SMTP host/port/TLS/kullanıcı/gönderen + şifre. Şirket bilgileri `site-settings.company/contact` (+ `company.etbisNo`).
- Sırlar AES-256-GCM (`src/lib/secrets/crypto.ts`), anahtar `SOFTMARKET_SECRETS_KEY` (PAYLOAD_SECRET'tan türetilmez). Anahtar yoksa sır kaydı reddedilir. **Anahtarı DB ile birlikte yedekle: kaybolur/değişirse kayıtlı sırlar okunamaz, panelden yeniden girilir.** Kayıt `sm1.<kid>.<iv>.<ct>.<tag>`, AAD = alan kimliği; SMTP şifresi host+kullanıcıya bağlı (host değişirse yeniden girilir).
- Write-only: `secrets` JSON sütunu alan erişimi read/create/update = nobody; yazım yalnız `POST /api/globals/integrations/secret` (admin panel oturumu + aynı origin), panelde "tanımlı · son 4 · tarih". Test e-postası `POST /api/globals/integrations/test-email` (yalnız kendi adresine, 1/dk 5/saat).
- Öncelik: sağlayıcının herhangi bir env değişkeni (`IYZICO_*`, `STRIPE_*`) ya da `SMTP_HOST` tanımlıysa env kazanır, panel yok sayılır. `PAYMENTS_ENABLED`, `PAYMENTS_STRIPE_ENABLED`, `NEXT_PUBLIC_SERVER_URL` yalnız sunucuda. Çalışma zamanı: `loadPaymentsConfig` / `loadPaymentsDeps` (`src/lib/integrations/runtime.ts`), e-posta `softmarketEmailAdapter` her gönderimde ayarı okur.
- Yasal: şirket yer tutucuları (`[ŞİRKET UNVANI]`, `[ADRES]`, `[MERSİS]`, `[VERGİ DAİRESİ/NO]`, `[KEP]`, `[ETBİS NO]`, `[TELEFON]`, `[KVKK İLETİŞİM E-POSTASI]`) render anında doldurulur (`src/lib/company-facts.ts`); kayıtlı sayfa değişmez. `pages.legalReview` (dil başına, yalnız admin panel) metne SHA-256 ile bağlı hukukçu onayı; metin değişince onay düşer. `legalReady` = yayında + doldurulmuş metinde yer tutucu/bant yok + onaylı.

## Licensing core (L1 schema, L2 signing, L3 client API, L6a security center)

- Plan and implementation records in `docs/plan-licensing-security.md`, ADR in `docs/licensing/adr-l0.md`. Enum values live in `src/lib/licensing/constants.ts`.
- New collections (group Security): `license-activations`, `license-status-log`, `security-events`, `security-blocks`, `security-audit`. Read = admin **panel session** only (`isPanelAdmin`: `local-jwt` with no Authorization header). Create/update/delete require server code with `overrideAccess: true`. No versions or document locks. `graphQL: false`; NOT in the MCP allow-list; no public revalidation. Never log or store full IPs, raw fingerprints, license keys or e-mails in these rows.
- Global `licensing-settings` is readable by panel admins. The same-origin admin panel session can save non-secret fields, including `apiEnabled`, rule thresholds and `rules.observeUntil`. Server code owns `signingKeys`. The API defaults to off and rules default to `notify`. A rule can suspend only in `suspend` mode after a valid `rules.observeUntil` has elapsed. The global has no versions, document locks, GraphQL, MCP or content import access.
- L2 server crypto in `src/lib/licensing/crypto/` implements the Ed25519 lease JWS, raw-body request/response canonical strings, and purpose-specific HKDF/HMAC. IP persistence uses only IPv4 /24 or IPv6 /48 and a UTC-month-scoped hash. Mapped IPv6 uses its IPv4 identity.
- `pnpm licensing:keygen` provisions on the configured deployment DB. Keygen stores PKCS#8 in the `integrations` vault under `licensing-signing-ed25519` and returns public metadata. An active key requires explicit `--rotate`. `SOFTMARKET_LICENSE_SIGNING_KEY` takes precedence over the vault. Use `--register-env` to register only its public metadata and include `--rotate` to replace an active key. An invalid or mismatched env key disables signing. Retired keys verify for 90 days and `revokedAt` ends verification immediately.
- `GET /api/v1/licensing/keys` publishes public signing metadata. It returns `{ keys: [{ kid, alg: "EdDSA", x }], revokedKids }` with a one-hour public cache or `503 unavailable` with `no-store` when disabled or uninitialized. Programs pin trusted public keys.
- `licenses`: `publicId` (server CSPRNG, immutable), `maxDevices` (positive safe integer), `statusReason/statusSource/statusChangedAt` (server-stamped, admin read). `status` cannot be set or changed with a users API key (MCP/REST; field access strips it). Every status change through Payload writes one `license-status-log` row in the same transaction, including bulk and projected writes (`src/lib/licensing/transitions.ts`); server code declares `req.context.licenseTransition = { source, reason, ... }`. A license with status history or activations cannot be deleted (409). Refund and dispute stamp the same fields and append a payment transition in the order transaction. Refund also revokes active devices. The activation join is readable only by panel admins.
- `products.licensing.{enabled,code}`: staff read, panel admin write, not in content:import; `code` unique, `^[a-z0-9][a-z0-9-]{2,40}$`, immutable once stored (embedded in shipped programs).
- Migration `20261117_200700_licensing_core` is additive (backfill only `licenses.public_id`) with guarded down. Partial unique indexes `license_activations_one_active_fp` / `_one_active_thumb` live only in hand-written migration SQL: any future migration that rebuilds `license_activations` (`__new_license_activations`) must re-create them; `tests/unit/licensing-migration.test.ts` and `licensing-access.test.ts` assert them.
- L3 serves signed raw-JSON `POST /api/v1/licensing/{activate,validate,deactivate}`. Set the global `apiEnabled` and `publicHost`, provision signing metadata and the vault master, and enable the product's licensing code. Clients pin the issuer and public keys. Failures use fixed English codes, and disabled or unavailable service returns 503. See `docs/licensing/client-api.md`.
- Each active device uses a seat. Activation, rebind and deactivation use the shared SQLite `BEGIN IMMEDIATE` writer queue. Mutations and authenticated nonce receipts commit together. Validation jobs already waiting at lock acquisition share a bounded commit with per-request savepoints. Counters and receipts are durable before a lease is returned. An exact, fresh, authenticated deactivate retry is idempotent. Other authenticated replays return 401.
- Token buckets and block cache belong to the single API process. Settings supply the thresholds. Address attribution uses the authenticated Caddy headers, with one shared bucket for unknown addresses. Observational events and last-seen metadata are bounded and coalesced. Rules can report anomalies in L3. The L1 transition guard still owns automatic license suspension.
- L6a read-only security center: custom admin view `/admin/guvenlik` (`src/admin/security/`, registered in `payload.config.ts` under `admin.components.views.securityCenter` + `afterNavLinks`). The view decides access on the server first (`decideSecurityCenterAccess`: admin cookie session only; editor/customer/API-key admin -> `/admin`, anonymous -> login); the nav link is cosmetic. A custom view under a new key gets no template from Payload, so it wraps itself in `DefaultTemplate`. Data comes from `loaders.ts` via the Local API with the requesting admin user and `overrideAccess: false` (never an override read), always with `select`, shaped into view models; loaders also refuse any non-admin-session user. The URL is the only state (GET form, links, `query.ts` allow-lists), no client JS. Privacy: IP prefix plus a 10-char shortened hash only, `detail` flattened and redacted (`format.ts` `safeDetail`), never the license key, customer e-mail, device keys or fingerprint hashes. Labels: `src/lib/security-center-labels.ts` (re-exported from `admin-i18n.ts`). Styles: `.sc-*` in `src/app/(payload)/custom.scss` with Payload theme tokens only. Actions (suspend/revoke/restore/block/triage, key rotation) are NOT here: they arrive with the §5.4 endpoints in L6b.

