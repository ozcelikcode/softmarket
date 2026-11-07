# Sistem Desenleri

## Mimari
- Tek Next.js 15 uygulaması: site (`src/app/(frontend)/[locale]`), Payload admin + API (`src/app/(payload)`), özel API rotaları (`src/app/api`).
- Payload CMS 3, Next içine gömülü. Veri: SQLite (`@payloadcms/db-sqlite`).
- Dosyalar: Dosyalar yerel disk üzerinde (`media` koleksiyonu).
- Lisans iş mantığı: `src/lib/licenses`, `src/collections/Licenses.ts`.
- Ön uç yüklemesi: `site.ts` / `content.ts` üzerinden güvenli sorgular.

## Koleksiyonlar (21) ve globals (3)
- **Kimlik:** `users` (admin|editor, yalnız panel), `customers` (portal, `access.admin=false`).
- **Katalog:** `product-families` → `products` (drafts, blok `layout`, özellik/spec/gereksinim) → `editions` (sku (teklif sürüm kodu); `licenseType`, `durationMonths`, `seats`).
- **Pazarlama:** `solutions`*, `industries`, `case-studies`*, `posts`*, `careers`, `partners`, `pages`*, `media`.
- **Destek:** `docs`* (slug, ürün+locale içinde tekil), `releases` (ürün+sürüm tekil), `downloads` (file→media, os, `access: public|licensed`), `faqs`, `support-tickets` (mesaj dizisi).
- **Lisans:** `licenses` (CSPRNG anahtar tekil; ürün edition'dan denormalize).
- **Eklenti:** `forms`, `form-submissions` (form-builder), `search` (products, docs, faqs, posts).
- **Globals:** `header`, `footer`, `site-settings`.
- `*` = drafts + versions. İçerik alanları `localized`. Slug: `slugField()` (`src/fields/slug.ts`), başlıktan üretilir, locale başına tekil.
- Payload eklentileri yapılandırmada: seo, form-builder, search.

## Erişim kuralları (`src/access`)
- Payload varsayılanı `Boolean(user)`; müşteriler de `users` gibi görünür. **Her koleksiyon/global/eklenti açıkça erişim tanımlamalı.**
- Yayınlananlar: herkese açık okuma (`publishedOrStaff` taslaklı koleksiyonlar için; `careers` yalnız `isOpen`). Yazma: admin/editor.
- `licenses`: okuma = admin veya sahip müşteri; yazma (create/update/delete) = yalnız admin. Müşteri işlemleri sunucudan `overrideAccess: true` ile yürür. Müşteri asla doğrudan yazmaz.
- `support-tickets`: okuma/güncelleme = personel veya sahip; müşteri kendi adına açar, yalnız mesaj ekler (hook zorlar).
- `downloads` / `media`: `public` herkese; `licensed` yalnız personel veya ürün için geçerli lisansı olan müşteri (active, başlamış, süresi dolmamış). `downloads` hook'u `media.visibility/licensedProducts` alanlarını senkronlar (fail-closed).
- `users`: admin yönetir; personel kendini düzenler; `roles` alanı yalnız admin. İlk kullanıcı admin olur. `site-settings` güncelleme = admin.

## Kritik akış 1: Personel → lisans atama
1. Yetkili yönetici panel/API/MCP üzerinden müşteri ve sürüm seçer (mevcut admin-only yazma erişimi).
2. `Licenses.beforeValidate` create sırasında sunucuda CSPRNG anahtar üretir; istemcinin anahtarı kullanılmaz.
3. Ürün sürümden türetilir, koltuk sayısı varsayılanı alınır. Abonelikte expiresAt boşsa startsAt + durationMonths hesaplanır.
4. Müşteri yalnız kendi lisansını okuyabilir; doğrudan create/update/delete yapamaz.
5. Lisans doğrulama: `src/lib/licenses/validity.ts` (active, tarih aralığı) → lisanslı indirme izni.
6. SMTP host boş/yer tutucu ise Payload konsol adaptörü; otomatik lisans bildirim e-postası eklenmedi.

## Kritik akış 2: Lisanslı medya erişimi
- `media.protected` varsayılanı `true` (genel görseller için `false` açılır).
- `mediaRead` (`src/access/index.ts`) ve `downloads` üzerinden: protected dosya yalnız personele ya da geçerli lisansa sahip müşteriye açılır.
- Hook, `downloads` access'ini `media` tarafına yansıtır; eşleşme yoksa kapalı kalır.

## Kritik akış 3: i18n yolları
- `localePrefix: 'always'`: varsayılan TR `/tr/...`, EN `/en/...` altında; kök yollar TR önekine yönlenir. Rota eşlemesi `src/i18n/paths.ts` (`CANONICAL_PATHS`).
- Örnekler: `/tr/urunler` ↔ `/en/products`, `/tr/cozumler` ↔ `/en/solutions`, `/tr/referanslar` ↔ `/en/customers`, `/tr/haberler` ↔ `/en/news`, `/tr/kariyer` ↔ `/en/careers`, `/tr/iletisim` ↔ `/en/contact`, `/tr/sirket/hakkimizda` ↔ `/en/company/about`, `/tr/yasal/[slug]` ↔ `/en/legal/[slug]`.
- Sözlükler: `src/i18n/messages/tr.json`, `en.json` (next-intl). Route dizinleri `[locale]` altında, TR slug'ları kullanır (`urunler/`, `cozumler/`).
- Dil alternatifleri: `src/lib/alternates-store.ts` + `src/components/layout/set-alternates.tsx` → `LanguageSwitcher`.

## Güvenlik ve yardımcı desenler
- **Güvenli sorgu:** `src/lib/site.ts` ve `src/lib/content.ts` anonim okuma kalıbı: `overrideAccess: false`, `user: null`, `draft: false`, sınırlı alan ve derinlik; hata fırlatmaz, güvenli fallback döner.
- **safeHref** (`src/lib/utils.ts`): `javascript:` ve protokol-relative (`//`) URL'leri ayıklar; yalnız `http`, `https`, `mailto`, `tel` ve yerel yolları geçirir.
- **Section theme** (`src/components/ui/section.tsx`): `data-theme="dark|light"` ile alt ağaçtaki CSS token'larını değiştirir.
- **Blocks renderer** (`src/components/blocks/render-blocks.tsx`): Payload blok dizisini eşler; tanımsız bloğu hata vermeden atlar.
- **Slug** (`src/fields/slug.ts`): otomatik üretim, regex doğrulama, `scope` ile üst ilişki bazlı tekillik.

## Test
- Birim (Vitest, `tests/unit/`): access, collections, frontend-content/routing/security/site, license-key, sqlite-integrity (lisans atama ve veri korunumu), slugify.
- E2E (Playwright, `tests/e2e/smoke.spec.ts`): yalnız duman testi; tam akış Faz 9.

## Faz 4 destek ve form sınırları
- `src/lib/support.ts`: ürünün anonim yayınına bağlı doküman, sürüm, public indirme ve SSS sorguları; licensed kayıtlar sorgulanmaz. `supportVariants` ID üzerinden locale yollarını eşler.
- `src/lib/search.ts` + `src/access/search.ts`: indeks sorgusu ve güncel kaynak erişimi; ham search API de yalnız public kaynak ID'lerini döndürür.
- `src/lib/forms/{schema,security,data,action}.ts`: izinli dört form kimliği, Zod/KVKK, honeypot, origin-host, doğrulanmış Caddy IP başlığı veya ortak limit ve Turnstile. Production secret yoksa kapalı; development atlar.
- `form-submissions.create = nobody`; yalnız sunucu aksiyonu doğrulama sonrası `overrideAccess:true` kullanır. Bildirim kayıt sonrası; hatası gönderimi bozmaz, başlıklar kullanıcı verisinden türetilmez.
- `pnpm ensure-forms`: stable `softmarket-*` başlığıyla upsert; form blok kimlikleri ve TR/EN etiketleri korunur. Schema eklemez.
- Scoped slug tekilliği SQLite/Payload locale uyumu için `count` yerine `find(limit:1, depth:0)` kullanır.

## Faz 8a içerik ve MCP
- `scripts/content-import.ts`: AJV/JSON Schema, TR/EN ayrı yazım, slug/SKU upsert; docs ürün+slug, releases ürün+version. SSS artık lokalize slug taşır.
- İki aşama: gerekli ilişkilerle kimlikleri oluştur; sonra blok/isteğe bağlı ilişkileri doldur. Ürün↔SSS döngüsü ve ileri docs.parent referansı desteklenir. Row/block ID'leri locale'ler ve tekrarlar arasında korunur.
- Medya upsert kimliği `media.seedPath` (unique); gerçek dosya adı çakışmalarında Payload'ın atadığı dosya adı korunur.
- CLI tek DB transaction: hata tüm kayıt yazılarını geri alır; yüklenen dosyalar SQLite transaction kapsamı dışındadır. `--dry-run` dosya/ilişki doğrular, yazmaz. `--legal`: Markdown → Payload Lexical → pages(legal), açıkça yayınlar.
- MCP 3.85.1 `/api/mcp`: `src/lib/mcp.ts` tek allowlist; admin `users` API anahtarı, Bearer taşıma; cookie/JWT/editor/customer reddi. Anahtar alanları admin-only; rol düşürmede iptal. Lisans delete kapalı; deneysel araçlar kapalı.
- Cloudflare Web Analytics token varsa frontend beacon; portal/admin hariç, `spa:false` ile portal navigasyonu ölçülmez. Ölçüm document yüklemeleriyle sınırlı.

## Faz 9 — ISR, CSP ve SEO (2026-11-06)
- Locale layout çerez/headers okumaz; Header herkese aynı `/hesap` bağlantısını sunar. Public ana sayfa, aile/ürün ve içerik detayları + kurumsal/listesiz sayfalar `generateStaticParams` ve 3600 sn ISR kullanır. Statik parametreler yalnız public/yayınlı sitemap kaynaklarından gelir; yeni slug'lar istekte üretilebilir.
- URL query ile filtrelenen katalog/çözüm/haber/destek listeleri, arama ve formlar dinamik; portal layout `force-dynamic`, `revalidate=0`, `fetchCache=force-no-store` ve noindex kalır. Locale layout'ta generateStaticParams yok: Next 15 bunun altındaki dinamik sayfaları yanıltıcı biçimde `●` etiketler.
- Payload config, public koleksiyonların afterChange/afterDelete ve globals afterChange hook'larına `src/lib/revalidate.ts` sarmalını ekler; mevcut hook'lar korunur. `/tr` ve `/en` layout invalidation tüm detay/liste/nav bağımlılıklarını, ayrıca `/sitemap.xml` kapsar. Next dışı CLI atlar; cache context yoksa hata yakalanır, en fazla saatlik yenileme beklenir.
- CSP varsayılan Report-Only; `CSP_ENABLED=false` kapatır, `CSP_ENFORCE=true` zorunlu kılar. ISR public HTML statik allowlist; dinamik HTML middleware nonce + DynamicSecurity/NonceProvider üzerinden JSON-LD/Turnstile. Analytics belge nonce'u öğrenildikten sonra yüklenir. Admin ayrı unsafe-eval politikası; Permissions-Policy/COOP next.config headers'ta.
- Tüm public sayfalarda istek nonce'u + ISR birlikte desteklenmez: https://nextjs.org/docs/app/guides/content-security-policy#static-vs-dynamic-rendering-with-csp . Nonce okuması ortak locale layout'a taşınmamalı. Loading client bileşenidir; orada örtük server getTranslations tüm frontend'i dinamik yapar.
- `skipMiddlewareUrlNormalize=true`: Next 15 production EN rewrite sırasında 127.0.0.1 → localhost normalizasyonuyla dış proxy/redirect döngüsü oluşmasını engeller. Middleware özgün NextRequest'i next-intl'e iletir.
- `MediaImage` next/image kullanır; Payload URL'leri erişim değişikliğinde aynı kalabildiğinden **tümü unoptimized**. `images.localPatterns` yalnız `/images/**`, remotePatterns boş: `/api/media/file` doğrudan optimizer isteği de 400; protected dosya shared optimizer cache'e giremez.
- `server-url.ts` local alias'ları 127.0.0.1:3100'a indirger; production domain eksik/bozuk/local ise build/start açık uyarı verir. OG/Twitter fallback `/[locale]/opengraph-image` next/og markalı TR/EN PNG; search noindex + robots disallow, sitemap'te arama yok, tüm URL'lerde lastmod; dokümanlarda TechArticle.
- `NEXT_DIST_DIR=.next-prod pnpm build` çalışan `.next` dev çıktısını korur. `pnpm test:e2e` yalnız Playwright çalıştırır; build ayrı adımdır. Playwright baseURL ve reuse URL: http://127.0.0.1:3100/tr; bağımsız start `.next-prod` kullanır.
