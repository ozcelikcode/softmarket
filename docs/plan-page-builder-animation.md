# Plan — Sayfa Kurucu (Page Builder) + Dengeli Animasyon + Performans

## Kullanıcı kararları (2026-11-07)

- Her şirket için ayrı kurulum; multi-tenant yok.
- Logo ve tek vurgu rengi admin'den değiştirilebilir; kontrast otomatik kontrol edilir.
- Liste sayfalarında listenin kendisi de taşınabilir bloktur.
- Hero'da opsiyonel kısa, sessiz döngü video: poster ve lazy yükleme; mobilde ve reduced-motion durumunda kapalı.
- Live Preview autosave varsayılan açık (yaklaşık 2 saniye).

> Durum: TASLAK PLAN (2026-11-07). Kod değişikliği yok. Uygulama `takim-lideri` kurallarıyla, fazlar halinde.
> Kaynak: `memory-bank/*`, `AGENTS.md`, `docs/implementation-plan.md`, mevcut kod (aşağıda dosya:satır kanıtlarıyla).

## 0. Hedef (kullanıcı istekleri)

1. Site **verimli ve animasyonlu** olmalı; animasyon dengeli, site hafif, tasarım profesyonel. Kullanıcının gördüğü tasarım hataları için **görsel QA + düzeltme turu** yapılacak (ayrıntılar sonra gelecek).
2. İçerik **genel şablon** gibi değiştirilebilir olmalı: başlık, metin, menü, hero vb. Ana sayfa yerleşimi **WordPress tarzı blok blok** taşınabilir olmalı.

---

## 1. Mevcut durum tespiti (kanıtlı)

### 1.1 Ana sayfa tamamen kodda sabit
- `src/app/(frontend)/[locale]/page.tsx:45-265`: hero, ürün aileleri, çözümler, logolar, vaka, haberler ve CTA bölümleri JSX içinde sabit sırada duruyor. Bölüm başlıkları ve metinleri i18n `home` sözlüğünden geliyor (`t('title')`, `t('familiesTitle')` …, 22 anahtar: `src/i18n/messages/tr.json` → `home`). CMS'ten yalnızca listelenen kayıtlar (aileler, çözümler, vakalar, haberler) geliyor.
- Hero CTA hedefleri sabit: `page.tsx:105,108` (`/demo-talep`, `/urunler`). Alt CTA bandı da sabit: `page.tsx:254-263`.
- Hero sağ paneli bir aile listesi olarak sabit tasarlanmış (`page.tsx:112-144`). Editör bunu görselle ya da videoyla değiştiremiyor.
- `pages` koleksiyonunda "home" açıklaması var (`src/collections/Pages.ts:36`), ama ana sayfa `pages`'ı hiç okumuyor. Seed'de hiç sayfa kaydı yok (`content/seed/*.json`: globals, aileler/ürünler, çözümler, destek, haberler).

### 1.2 Blok sistemi var, ama dar kullanılıyor
- 10 blok var (`src/blocks/index.ts:17-28`): hero, featureGrid, mediaText, specTable, stats, logoWall, cta, faq, richText, videoEmbed. Hepsi tek `layoutField()` ile `pages/products/solutions/case-studies` koleksiyonlarında kullanılıyor (`src/fields/common.ts:6-11`).
- Renderer'ı switch yapısında; tanımsız bloğu atlıyor (`src/components/blocks/render-blocks.tsx:16-37`). Kullanıldığı yerler: hakkımızda, yasal, çözüm detayı, referans detayı ve ürün "ek bloklar".
- Bloklarda **tema, boşluk, hizalama, animasyon ve anchor alanları yok**. `HeroBlock` her zaman `theme="dark"` (`hero-block.tsx:15`) ve başlığı her zaman `h2` (`hero-block.tsx:20`). Hero sayfanın ilk bloğu olduğunda sayfada `h1` kalmıyor.
- Ürün sayfası hero, featureGrid ve specTable bloklarını filtreliyor (`urunler/[family]/[product]/page.tsx:81-82`). Bu tek kaynak kuralı korunacak.
- Admin etiketleri İngilizce (`labels: { singular: 'Hero' }` …). Payload `i18n` ayarı yok (`src/payload.config.ts:56-62`). Blok önizleme görseli (`imageURL`) yok.
- Live Preview ve draft mode yok: `admin.livePreview` tanımlı değil, `draftMode` kullanımı yok. Drafts `autosave: false` (`common.ts:38-41`).

### 1.3 Liste ve kurumsal sayfaların üst kısımları sabit
- `PageHero title={t('title')} lead={t('lead')}` deseni şu sayfalarda var: `urunler/page.tsx:51`, `cozumler/page.tsx:44`, `haberler/page.tsx:51`, `referanslar/page.tsx:38`, `kariyer/page.tsx:38`, `is-ortaklari/page.tsx:43`. Üst metinler yalnız i18n'de; altlarına blok eklenemiyor.
- Hakkımızda `pages` kaydını slug `hakkimizda|about` ile okuyor, ama hero'yu yine `PageHero` + i18n yedeği oluşturuyor (`sirket/hakkimizda/page.tsx:19,41`).
- Serbest landing sayfası rotası yok: `pages` yalnız yasal ve hakkımızda için okunuyor (`src/lib/content.ts:210-219`).

### 1.4 Globals kısmen düzenlenebilir
- Header: `navItems` (link + mega `products|solutions` + children) ve tek CTA var (`src/globals/Header.ts`). CMS boşsa i18n yedek menüsü kodda (`src/components/layout/header.tsx:22-49`).
- **Logo ve site adı CMS'ten gelmiyor**: `Logo` sabit bir SVG ve metin yer tutucusu (`src/components/layout/logo.tsx:3`). Header site adını `c('siteName')` i18n anahtarından alıyor (`header.tsx:58`). `SiteSettings.logo/logoDark` alanları var (`SiteSettings.ts:19-20`), ama header'da kullanılmıyor.
- Link alanında site içi sabit yol tipi yok: `internal` yalnız bir koleksiyon `reference`'ı çözüyor (`src/fields/link.ts:58-64`). Bu yüzden seed menüsü `type: external, url: "/tr/urunler"` gibi bir geçici çözüm kullanıyor (`content/seed/01-globals.json`). Bu yol locale'e bağımlı (`/tr` sabit).
- Footer: kolonlar, yasal linkler ve copyright CMS'te. Yedek kolonlar ve yasal linkler kodda (`footer.tsx:32-77`).

### 1.5 Performans ve animasyon bulguları
- `motion` bağımlılığı (`package.json:56`) `src` içinde **hiç import edilmiyor**. Kullanılmayan bir bağımlılık.
- `Reveal` her kart için ayrı bir client bileşeni ve ayrı bir IntersectionObserver (`src/components/ui/reveal.tsx:1-26`). Ana sayfada kart sayısı kadar hydrate edilen ada oluşuyor (`page.tsx:99,112,159,186,242`). CSS tarafı doğru: JS yoksa görünür, reduced-motion'da kapalı (`globals.css:132-141,199-202`).
- Görseller: `Media` için `imageSizes` yok (`src/collections/Media.ts:74-76`) ve tüm Payload görselleri `unoptimized` (`src/components/ui/media-image.tsx:32`, güvenlik gereği). Sonuç: srcset, WebP/AVIF ve boyut küçültme yok; orijinal dosya indiriliyor. LCP için en büyük risk bu.
- `src/lib/content.ts` yükleyicileri React `cache()` ile sarılı değil (yalnız `site.ts`, `support.ts`, `static-params.ts` sarılı). `generateMetadata` ve sayfa aynı sorguyu iki kez çalıştırıyor: `sirket/hakkimizda/page.tsx:24` ve `:34` (`getPage`), ana sayfada `page.tsx:36` ve `:58` (`getContactSettings`).
- Ana sayfa, aile başına ürün sayısını bulmak için 200 ürünü tam alanlarla çekiyor (`page.tsx:53,61-65`). Bu aşırı veri çekmek demek. Gereken tek alan `family`.
- Revalidation çok kaba ve taslakta da tetikleniyor: her `afterChange` çağrısında `/tr` ve `/en` layout'larının tamamı geçersiz kılınıyor (`src/lib/revalidate.ts:10-12,21`). Taslak kaydı da tüm siteyi temizliyor. Autosave ya da live preview eklenirse bu ciddi bir regresyon olur.
- Fontlar: Geist Sans ve Geist Mono her sayfada preload ediliyor (`src/app/(frontend)/[locale]/layout.tsx:2-3,55`). Mono yalnız küçük etiketlerde kullanılıyor.
- Client bileşenleri (17): header-shell (382 satır), language-switcher, sheet, tabs, accordion, reveal, json-ld, set-alternates, formlar, portal ve analytics. FAQ için Radix accordion kullanılıyor. Yerine sıfır JS'li `<details>` kullanılabilir.
- Doküman sayfası build'inde görülen 60 sn timeout'un kök nedeni belirlenemedi (`progress.md`, "404/güvenlik QA").

### 1.6 Uyumlu altyapı (korunacak)
- Content import şeması Payload config'ten türetiliyor; bloklar `$defs` ile otomatik geliyor (`src/lib/content-import/schema.ts:28`). Blok ve satır ID'leri korunuyor (`importer.ts:60-75`). Yeni bloklar otomatik destek alır. İstisna: `blockReferences` (string blok) şu an filtreleniyor (`schema.ts:28`, `importer.ts:52,71,172`).
- MCP `pages` için CRUD'a izin veriyor. Header, footer ve site-settings için find/update açık.
- CSP `frame-ancestors 'self'` (`src/lib/csp.ts:15`). Aynı origin'deki admin iframe önizlemesi uyumlu.

---

## 2. Hedef mimari

### 2.1 Sayfa modeli
- **Ana sayfa = bir `pages` kaydı.** `SiteSettings` alanına `homePage` (relationship → pages) eklenir. Boşsa slug `home` aranır. O da yoksa mevcut sabit kompozisyon **yedek** olarak render edilir (geriye uyum, boş DB'de site çalışır). Eşdeğerlik sağlandıktan sonra sabit sürüm F6'da "boş durum" bileşenine indirgenir.
- **Sistem sayfası bağlama:** `pages.systemKey` (select, unique/locale bağımsız): `products | solutions | news | customers | careers | partners | support | contact | about`. Liste rotası `getSystemPage(locale, key)` ile kaydı okur:
  - `hero` grubu (eyebrow/başlık/lead/medya/aksiyonlar) → `PageHero` yerine. Boşsa i18n yedeği kullanılır.
  - `layout` blokları → dinamik listenin **altında** render edilir. Listeyi taşınabilir yapmak için `listing` bloğu açık soru 3'e bağlı.
- **Serbest landing sayfaları:** `[locale]/[slug]/page.tsx` (tek segment). Statik dizinler ve `[...notFound]` daha spesifik/öncelikli kalır. `slug` alanına **ayrılmış slug doğrulaması** eklenir: `CANONICAL_PATHS` içindeki TR ve EN ilk segmentleri (`urunler`, `products`, `destek`, `hesap`, `account`, `ara`, `search`, `admin`, `api` …) reddedilir. EN rewrite tablosu (`src/i18n/paths.ts`) ile çakışma testi yazılır.
- **ProductFamilies**'e opsiyonel `layout` eklenir. Aile sayfasında ürün ızgarasının altında render edilir. Ürünler mevcut `layout` alanını ve filtre kuralını korur.
- `pageType`'a `template` eklenir: yayınlanmaz ve sitemap dışında kalır. Editör bunu Payload "Duplicate" ile çoğaltır (bkz. §6).

### 2.2 Blok kataloğu
Ortak kurallar:
- Her bloğa `blockSettings()` fabrikasıyla bir **`appearance` grubu** eklenir. Grup, `initCollapsed` bir `collapsible` ("Görünüm") içinde durur:
  `theme: dark|light` (blok türüne göre varsayılan), `spacing: none|sm|md|lg`, `align: start|center`, `width: narrow|normal|wide`, `animation: none|subtle` (varsayılan `subtle`), `anchor` (`^[a-z0-9-]{1,40}$`; sayfada tekil olmalı, `beforeValidate` ile kontrol edilir).
- Admin: `labels: { singular: { tr, en } }`, alan `admin.description`'ları TR, `imageURL` (`public/admin/blocks/<slug>.webp`, 480×300) + `imageAltText`. Blok sıralaması Payload `blocks` sürükle-bırak ile yapılır (dahili özellik). Payload 3.85 blok gruplamayı (`admin.group`) destekliyorsa "Giriş / İçerik / Katalog / Kanıt / Dönüşüm / Yardımcı" grupları kullanılır. Destek Faz 3 spike'ında doğrulanır.
- Koleksiyon başına izinli set: `pageBlocks` (tümü), `productBlocks` (hero/productFamilies/listing yok), `solutionBlocks`, `familyBlocks`. **Yalnız ekleme yapılır**: bir koleksiyondan blok çıkarmak SQLite'ta tablo düşürür.
- `blockReferences` (config seviyesinde paylaşılan bloklar) F3 spike'ında değerlendirilir. Tablo adları değişiyorsa veya import şeması (string blok) kırılıyorsa **kullanılmaz**. → **F3 kararı: şimdilik kullanılmaz** (gerekçe F3 bölümünde).

| Blok (slug) | TR etiket | Durum | Kaynak | İstemci JS |
|---|---|---|---|---|
| `hero` | Giriş (Hero) | genişlet | varyant: `cinematic` (grid+glow, sağda medya/aile paneli) · `split` · `centered` · `minimal` · `mediaBackground`; medya: görsel/video/aile paneli; ilk blok ise `h1` | yok (video ise küçük ada) |
| `featureGrid` | Özellik ızgarası | genişlet | `style: cards|plain`, ikon allowlist select (lucide adları) | yok |
| `productFamilies` | Ürün aileleri vitrini | yeni | otomatik (sortOrder) / elle seçim, `showCount`, `layout: grid|list`, limit | yok |
| `productShowcase` | Ürün vitrini | yeni | seçili ürünler veya `featured`, `layout: cards|alternating` | yok |
| `solutionsGrid` | Çözümler | yeni | otomatik/elle, limit | yok |
| `logoWall` | Logo duvarı | mevcut | manual/caseStudies/partners | yok |
| `stats` | Rakamlar | mevcut | — | yok |
| `caseStudy` | Öne çıkan vaka | yeni | otomatik `featured` / elle seçim; sonuç metrikleri | yok |
| `testimonial` | Müşteri görüşü | yeni | alıntı, kişi, rol, şirket, logo; ya da vaka ilişkisi | yok |
| `cta` | Çağrı bandı | genişlet | `style: band|card|split`, 1-2 aksiyon | yok |
| `richText` | Zengin metin | mevcut | — | yok |
| `mediaText` | Medya + metin | mevcut | — | yok |
| `media` | Görsel / galeri | yeni | tek veya 2-4'lü ızgara, `aspect`, alt yazı | yok |
| `videoEmbed` | Video | genişlet | poster + **facade** (tıklayınca iframe), nocookie | küçük ada |
| `faq` | SSS | mevcut→refactor | Radix yerine `<details name>` | **yok** |
| `tabs` | Sekmeler | yeni | 2-6 sekme × (richText + medya) | küçük ada |
| `newsList` | Haber listesi | yeni | son N haber, kategori filtresi | yok |
| `specTable` | Teknik tablo | mevcut | — | yok |
| `leadForm` | Form (demo/teklif/iletişim) | opsiyonel (P2) | `ensure-forms` sabit başlıkları | mevcut form adası |
| `spacer` / `divider` | Boşluk / ayraç | yeni | boyut, çizgi | yok |

### 2.3 Header / Footer / SiteSettings (tam düzenlenebilir)
- **Link alanı:** `type: internal|route|external`. `route` tipi `CANONICAL_PATHS` anahtarlarından bir select'tir ve locale'e göre otomatik çözülür. Seed'deki `external + "/tr/..."` geçici çözümü kalkar. `safeHref` korunur.
- **SiteSettings:** `siteName`, `logo` ve `logoDark` header/footer/JSON-LD'de gerçekten kullanılır. `logo.tsx` CMS logosunu yoksa bugünkü SVG yedeğini render eder. Ayrıca `homePage`, `motion: subtle|none` (site geneli kapatma) ve opsiyonel `brand.accent` / `brand.accentHover` (hex) eklenir. Son ikisi kök `style` CSS değişkeni olarak basılır. Kontrast doğrulaması (WCAG AA, `accent-contrast` ile) hook'ta yapılır; geçmezse kayıt reddedilir (açık soru 2).
- **Header:** `navItems` (mevcut + `megaMenu: products|solutions|custom`; `custom` = kolonlar + öne çıkan kart), `cta` 1-2 buton, `utility` görünürlükleri (arama/dil/hesap), `announcement` (açık/kapalı, metin, link; JS'siz ve kapatılamaz).
- **Footer:** kolonlar, yasal linkler, `brandBlurb`, `showContact`, `showSocial` (SiteSettings'ten), copyright `{year}` ve `{siteName}` yer tutucuları.
- Kod içi yedekler (header/footer menüsü, ana sayfa) yalnız CMS boşken çalışır. Bu, testle kilitlenir.

### 2.4 CMS ↔ i18n sınırı (net kural)
> **Kural:** Başka bir şirket için değişmesi gereken her metin **CMS'te**, her şirkette aynı kalan arayüz metni **i18n'de** durur.

- **CMS:** hero ve bölüm başlıkları/lead'leri, CTA metinleri ve hedefleri, menü, footer, şirket/iletişim bilgisi, sayfa üst metinleri, SEO meta, logo, site adı, marka rengi, duyuru bandı.
- **i18n (`messages/*.json`):** form etiketleri ve doğrulama mesajları, buton mikro metinleri ("Tümünü gör", "Devamını oku", "Kapat"), breadcrumb "Ana sayfa", aria etiketleri, filtre ve sayfalama, portal, 404/hata, boş durumlar, tarih/çoğul kalıpları, ürün sekme adları.
- **Yedek:** CMS alanı boşsa i18n'deki varsayılan kullanılır. `home` sözlüğü F6 sonunda yalnız yedek/seed kaynağı olarak kalır. Yeni pazarlama metni i18n'e **eklenmez** (lint/test kuralı: `home.*` anahtar sayısı artamaz).

### 2.5 Live Preview + taslak
- Payload `admin.livePreview`: `pages`, `products`, `solutions`, `case-studies`, `posts` için URL fonksiyonu tanımlanır. Breakpoint'ler 390/768/1440.
- Rota `src/app/(frontend)/api/preview/route.ts` (veya `src/app/api/preview`): `payload.auth({ headers })` ile **yalnız staff** (admin/editor) kabul edilir. `draftMode().enable()` çağrılır, ardından locale'li yola yönlendirilir. Aynı origin olmayan bir `redirect` parametresi reddedilir. Çıkış için `/api/preview/exit` kullanılır.
- Draft mode'da sayfa yükleyicileri `draft: true` kullanır. Her render'da staff yeniden doğrulanır, aksi halde public sorguya düşülür. Draft mode ISR'i otomatik atlar.
- `@payloadcms/live-preview-react` `RefreshRouteOnSave` (RSC uyumlu; client'ta blok render gerekmez). Yalnız draft mode'da mount edilir.
- **Autosave** yalnız `pages` için açılır, `interval ≥ 2000 ms` (SQLite yazma yükü; açık soru 5).
- **Revalidation kuralı (zorunlu):** hook yalnız `doc._status === 'published'` ise ya da `previousDoc._status === 'published'` ise (yayından kaldırma) çalışır. Taslak/autosave hiçbir zaman cache temizlemez. Drafts olmayan koleksiyonlarda davranış değişmez.

---

## 3. Veri modeli ve migration stratejisi

| Değişiklik | Koleksiyon/Global | Migration adı (öneri) | Faz |
|---|---|---|---|
| `appearance` grubu tüm bloklara | pages/products/solutions/case-studies (+ `_v` tabloları) | `blocks_appearance` | F3 |
| Hero varyant/medya tipi, cta style, featureGrid style | blok tabloları | aynı | F3 |
| Yeni bloklar (statik) | pageBlocks vb. | `blocks_static_set` | F4 |
| Yeni bloklar (dinamik) + ilişki tabloları | pageBlocks | `blocks_dynamic_set` | F5 |
| `pages.systemKey`, `pages.hero`, `pageType: template`, SiteSettings `homePage`, families `layout` | pages, site-settings, product-families | `page_builder_pages` | F6 |
| Link `route` tipi, header/footer/settings alanları | globals + tüm link kullanımları | `globals_editable` | F7 |
| `pages` autosave | `_pages_v` (`autosave` kolonu) | `pages_autosave` | F8 |
| `media` `imageSizes` + `focalX/Y` | media | `media_image_sizes` | F9 |

Kurallar:
- `push: false` ile devam edilir. Her şema değişikliğinde `pnpm migrate:create <ad>` ve ardından `pnpm migrate` çalışır. Tipler (`generate:types`) ve importmap aynı committe güncellenir.
- **Yalnız eklemeli değişiklik yapılır.** Alan/blok yeniden adlandırma ve kaldırma yasaktır: drizzle SQLite tabloyu `__new_` kopyasıyla yeniden kurar ve veri kaybı riski doğar. Select seçeneği ekleme/çıkarma text kolonunda güvenlidir ve migration SQL'inde doğrulanır.
- Her migration için **önce kopya DB**: `cp data/*.db $TMPDIR/softmarket-<ad>.db` → `DATABASE_URI` kopyaya → `pnpm migrate` → `pnpm content:import --dry-run` → `sqlite-integrity` testi. SQL'de `DROP TABLE` (yalnız `__new_` yeniden kurulum dışında) veya `DELETE` varsa durulur.
- **Geriye uyum:** renderer eksik `appearance` için blok türü varsayılanlarını kullanır. Eski `hero.variant: default` `cinematic`'e eşlenir. Bilinmeyen blok atlanır (mevcut davranış). `home` kaydı yoksa yedek ana sayfa render edilir.
- **Content import:** şema config'ten üretildiği için yeni bloklar otomatik gelir. Gerekenler: `schema.json` yeniden üretilir (test senkron olduğunu kontrol eder), `collapsible` ve `route` link alanı `flatFields` ile kapsanır, `blockReferences` kullanılırsa `schema.ts`/`importer.ts` string blok çözümü eklenir. Yeni `content/seed/05-pages.json`: `home` (bugünkü ana sayfanın blok karşılığı), `about` ve sistem sayfası kayıtları (`systemKey`). Header seed'i `route` linklerine dönüştürülür. İki çalıştırmada idempotent olmalı (0 create / N update).
- **Seed dönüşümü (ana sayfa → bloklar):** `hero(cinematic, aile paneli)` → `productFamilies` → `solutionsGrid(theme dark)` → `logoWall(source partners+caseStudies)` → `caseStudy(auto featured)` → `newsList(3)` → `cta(band)`. Metinler mevcut `home.*` TR/EN değerlerinden alınır.
- **MCP:** `pages` ve globals zaten açık. Ajan tarifi `AGENTS.md` ve editör kılavuzuna eklenir: slug ile `find` → `layout`'un **tamamını** yeniden yaz (diziler kısmi güncellenmez, blok `id`'leri korunur) → `_status: published`, TR ve EN ayrı. Toplu/idempotent işlerde `content:import` kullanılır.

---

## 4. Render mimarisi

- **Blok kaydı (registry):** `src/components/blocks/registry.ts` → `{ [slug]: Component }`. Bir parity testi her config bloğunun bir renderer'ı olduğunu doğrular.
- **`BlockShell` (server):** `<Section theme spacing id={anchor} data-anim={animation}>` + `Container width`. Bloklar yalnız içerik üretir, tema ve boşluk tek yerde yönetilir. `index===0 && blockType==='hero'` ise başlık `h1`, diğerlerinde `h2` olur. Sayfa başına tek `h1` testle kilitlenir.
- **Tüm bloklar RSC.** İstemci adaları yalnız `tabs`, `videoEmbed` facade, (opsiyonel) hero video ve `leadForm`. FAQ `<details>` ile JS'siz çalışır.
- **Dinamik blok verisi:** `src/lib/blocks/data.ts` içinde `cache()` ile sarılı yükleyiciler kullanılır. Sayfa ilk aşamada `preloadBlockData(blocks)` çağırır, böylece kardeş bloklar paralel çalışır ve şelale oluşmaz. Her blok yalnız gereken alanları `select`/`populate` ile alır, `depth ≤ 1`.
  - Aile başına ürün sayısı tek sorguyla alınır: `products` `select: { family: true }`, `depth: 0`, `pagination: false`. N+1 yasak.
- **`content.ts` yükleyicilerinin tamamı `cache()` ile sarılır.** Metadata ve sayfa aynı sorguyu paylaşır.
- **ISR:** 3600 sn ve on-demand korunur. Draft atlama kuralı eklenir (§2.5). Tag tabanlı ince revalidation **ölçüm sonrası** değerlendirilir: layout invalidation küçük sitede yeterli kabul edilir.
- **Görseller:**
  - `Media.upload.imageSizes`: `sm 480`, `md 960`, `lg 1600`, `xl 2400` (genişlik, `withoutEnlargement`). `formatOptions: webp q≈78`, `focalPoint: true`, `adminThumbnail: 'sm'`.
  - `MediaImage` boyut URL'lerinden `srcSet` ve doğru `sizes` üretir. Güvenlik gereği `unoptimized` korunur (optimizer cache'ine protected bayt girmez). Her boyut aynı `/api/media/file` erişim kuralından geçer; bu testle doğrulanır.
  - LCP: yalnız ilk hero görseline `priority` + `fetchPriority="high"`. Diğer görseller `loading="lazy"`. `width/height` her zaman verilir (CLS).
  - AVIF yalnız ölçüm hero'da anlamlı kazanç gösterirse eklenir (ek depolama ve sharp süresi).
  - Mevcut medya için `pnpm media:regenerate` betiği: dosyayı yeniden işler, kimliği ve `seedPath`'i korur.
- **Video:** üçüncü taraf video için facade (poster + oynat düğmesi; iframe tıklamada). Self-host hero videosu yalnız `prefers-reduced-motion: no-preference` ve `!saveData` ise ve ≥768px'de yüklenir: `muted playsinline loop preload="none"` + poster. Mobilde poster gösterilir.
- **Font:** Geist Sans (variable, tek woff2) preload edilir. Geist Mono **preload edilmez** (`next/font/local`, `preload: false`) ya da sistem mono'ya düşülür. `display: swap` ve `adjustFontFallback`.
- **Bağımlılık:** `motion` kaldırılır. Gelecekte bir blok gerçekten ihtiyaç duyarsa yalnız o ada içinde `import()` ile lazy yüklenir.

---

## 5. Animasyon sistemi (CSS-first, dengeli)

**Token'lar (`globals.css` `@theme`):** `--dur-fast: 150ms` (hover/focus), `--dur-base: 240ms` (menü/sekme), `--dur-reveal: 560ms`, `--ease-out-soft` (mevcut, `globals.css:103`), `--ease-standard: cubic-bezier(.2,0,0,1)`, `--reveal-distance: 12px`, `--stagger: 60ms` (en çok 4 öğe, toplam ≤ 240 ms).

**Kurallar:**
1. Yalnız `transform` ve `opacity` animasyonlu olur. Hover'da renk/border-color geçişi (`--dur-fast`) serbesttir. Layout özellikleri (width/height/top/margin), büyük alanlarda `filter: blur`, `box-shadow` ve `backdrop-filter` animasyonu yasaktır. Gölge efekti gerekiyorsa pseudo-element `opacity`'si kullanılır.
2. **JS'siz içerik görünür:** gizli durum yalnız JS ekranın dışındaki öğeye `data-anim-state="pending"` koyduğunda uygulanır (bugünkü mantık, `reveal.tsx:14`).
3. **Tek gözlemci:** her blok için client `Reveal` yerine server tarafında `data-anim="subtle"` ve öğe başına `style="--i:n"` basılır. Layout'a **tek** `<MotionObserver />` client bileşeni (~1 KB) eklenir. Bu bileşen tek bir `IntersectionObserver` ile `[data-anim]` öğelerini izler, rota değişiminde yeniden tarar ve öğeyi bir kez görünür yaptıktan sonra bırakır. `Reveal` kaldırılır.
4. `prefers-reduced-motion: reduce` → CSS geçişleri sıfırlanır (mevcut) ve gözlemci hiç çalışmaz. `SiteSettings.motion = none` → `<html data-motion="none">` ile aynı etki. Blok `animation: none` → `data-anim` basılmaz.
5. **Hero mikro animasyonları (JS'siz, CSS keyframe):** eyebrow, lead, aksiyonlar ve medya çerçevesi için 400-560 ms fade-up, 80 ms stagger. **LCP adayı (hero başlığı veya hero görseli) opacity 0'dan başlamaz.** Yalnız `translateY(8px)→0` uygulanır ya da hiç animasyon yapılmaz, çünkü opacity 0'dan başlamak LCP'yi geciktirir.
6. Dekoratif glow/grid statik kalır. Opsiyonel yavaş gradient kayması yalnız `transform` ile, görünür alandayken ve reduced-motion kapalıyken çalışır. Varsayılanı kapalı.
7. Kart hover: `translateY(-2px)` + border rengi. Görsel `scale(1.03)` 500 ms (mevcut). Mega menü `mega-in` 160 ms (mevcut).
8. Sayı sayacı ve paralaks **yok** (ağırlık ve INP riski).

---

## 6. Editör deneyimi

- Admin dili: Payload `i18n.supportedLanguages: { tr, en }`, varsayılan `tr`. Tüm koleksiyon, global, blok ve alan etiketleri `{ tr, en }` olur. Açıklamalar kısa ve "ne işe yarar / nerede görünür" biçiminde yazılır.
- Varsayılanlar: hero `theme: dark`, diğer bloklar `light`, `spacing: lg`, `animation: subtle`. Yeni sayfaya `defaultValue` ile `[hero(minimal)]` başlangıç bloğu eklenir.
- Blok önizleme görselleri: noindex bir "Blok galerisi" şablon sayfasının (seed, `pageType: template`) Playwright ile 480×300 ekran görüntüsü alınır → `public/admin/blocks/*.webp`. Görseller yeniden üretilebilir (`pnpm admin:block-previews`).
- **Boş şablondan başlatma** (yeni şirket):
  1. `content/templates/starter/` (globals: nötr site adı/renk/menü; `home`, `about`, sistem sayfaları; örnek görseller `protected:false`).
  2. `pnpm content:import content/templates/starter` (idempotent). Ardından admin'de `Site Ayarları`'ndan logo, ad ve renk girilir.
  3. Şablon sayfalar (`pageType: template`) "Duplicate" ile yeni landing sayfasına dönüştürülür.
  4. Mevcut demo içeriği (`content/seed`) bu akıştan ayrıdır. Silme komutu **yoktur** (yıkıcı işlem yalnız kullanıcı onayıyla).
- **`docs/editor-guide.md`** (TR): blok kataloğu (ekran görüntüsüyle), sıralama ve sürükle-bırak, tema/anchor/animasyon, Live Preview, taslak → yayın, menü/footer/logo/renk, görsel yükleme kuralları (boyut ≥ 2400 px, alt metin zorunlu, `protected` kapalı), SEO alanları, MCP/JSON ile toplu güncelleme ve sık hatalar.

---

## 7. Performans bütçesi ve denetim

**Bütçe (mobil, Lighthouse varsayılan throttling, prod build):**

| Metrik | Hedef |
|---|---|
| LCP | < 2.0 s (`/tr`, `/en`, katalog, ürün, çözüm, doküman detay) |
| CLS | < 0.05 |
| INP | < 200 ms (lab'de TBT < 150 ms vekil) |
| Lighthouse | Performance ≥ 90 · A11y/SEO/Best Practices ≥ 95 |
| Ana sayfa ilk yük JS (gzip) | ≤ 130 KB toplam, sayfaya özel chunk ≤ 15 KB |
| CSS (gzip) | ≤ 30 KB |
| Hero görseli (mobil) | ≤ 180 KB · font preload ≤ 1 dosya / ≤ 60 KB |
| TTFB | ISR HIT < 50 ms · MISS < 400 ms (yerel prod) |
| DB sorgu sayısı / istek | ana sayfa ≤ 12 · ürün ≤ 15 · liste öğesi başına sorgu = 0 |

**Ölçüm yöntemi:**
- `NEXT_DIST_DIR=.next-prod pnpm build` → `next start -p 3200` (3100 dev'e dokunulmaz) → `@lhci/cli autorun` (3 koşu, medyan; `lighthouserc.json` bütçeleri). Sonuçlar `docs/perf/` altında saklanır.
- Playwright `tests/perf/vitals.spec.ts`: 390×844, CDP CPU throttle ×4. LCP/CLS `PerformanceObserver` ile ölçülür, INP için menü/sekme/FAQ etkileşimleri kullanılır. `reducedMotion: 'reduce'` emülasyonunda transform yok.
- Bundle: `@next/bundle-analyzer` (`ANALYZE=1`) ve `next build` "First Load JS" çıktısı. Bütçe aşımında test başarısız olur.
- DB: `DB_QUERY_LOG=1` bayrağıyla adapter logger, AsyncLocalStorage ile istek başına sayaç. Rapor sayfa → sorgu sayısı ve tekrar eden sorgular.
- ISR doğrulaması: `curl -sI` ile `x-nextjs-cache` HIT/STALE kontrolü. Yayın → sonraki istek MISS sonra HIT. **Taslak kayıt sonrası HIT kalmalı.**
- **Doküman build timeout kök neden araştırması.** Hipotezler, olasılık sırasıyla:
  - (a) dedupe edilmemiş yükleyiciler ve metadata+sayfa çift yükleme;
  - (b) build worker'larının eşzamanlı Payload init'i (SQLite açılışı, plugin init, search sync);
  - (c) çalışan dev sunucusunun aynı SQLite'ta tuttuğu yazma kilidi veya WAL checkpoint (busy timeout 5000);
  - (d) büyük Lexical içerik dönüşümü ve başlık çıkarımı;
  - (e) `getDocTree` alan seçimi.

  Yöntem: sayfa ve `generateStaticParams` başına zamanlama bayrağı, dev açık/kapalı × `experimental.cpus=1/varsayılan` matrisi, 5 ardışık build. Kabul: kök neden yazılı ve düzeltilmiş olmalı, 5/5 build timeout'suz geçmeli, build süresi kayıtlı olmalı.

---

## 8. Fazlar

Her faz ayrı commit'lenebilir, kendi testleriyle gelir ve kullanıcı istemeden commit yapılmaz. Şema içeren fazlar migration + tipler + importmap + `schema.json`'ı **aynı** değişiklikte taşır. Ortak kapılar: `pnpm typecheck && pnpm lint && pnpm test` ve `NEXT_DIST_DIR=.next-prod pnpm build`.

Bağımlılık: `F0 → (F1 ∥ F2 ∥ F9) → F3 → (F4 ∥ F5 ∥ F7) → F6 → F8 → F10 → F11`. G (görsel düzeltme) F0'dan sonra herhangi bir anda yapılabilir.

### F0 — Ölçüm temeli + görsel QA turu 1 (kod davranışı değişmez)
- **Kapsam:** Lighthouse/LHCI baseline, bundle raporu, DB sorgu sayacı bayrağı, ISR doğrulama betiği, doküman timeout araştırması (§7). Tüm public sayfaların 390/768/1440 ekran görüntüsü matrisi → `docs/qa/visual-baseline.md` (hata listesi; kullanıcının listesi buraya eklenir).
- **Dosyalar:** `lighthouserc.json`, `tests/perf/*`, `scripts/perf-*.ts`, `src/lib/db-query-log.ts` (bayraklı), `docs/perf/baseline.md`.
- **Kabul:** baseline tablosu dolu, timeout için kök neden raporu (düzeltme F1'de), bayrak kapalıyken sıfır davranış farkı.
- **Test:** sayaç birim testi, perf spec'in çalışması (izinli hostta; MachPort sınırı not edilir).
- **Risk:** Chromium macOS sandbox'ı (bilinen). Çözüm: izinli host veya kullanıcı makinesi.

### F1 — Hızlı performans kazanımları (şema yok)
- **Kapsam:** `content.ts` için `cache()`, ana sayfa aile sayısı tek hafif sorgu, revalidation taslak atlama, Mono preload kapatma, `motion` bağımlılığını kaldırma, FAQ `<details>`, F0 timeout düzeltmesi.
- **Dosyalar:** `src/lib/content.ts`, `src/lib/revalidate.ts`, `[locale]/page.tsx`, `[locale]/layout.tsx`, `components/blocks/faq-block.tsx`, `package.json`.
- **Kabul:** sorgu sayısı baseline'a göre düşük, metadata+sayfa çift sorgusu yok, taslak kayıt cache'i bozmuyor, JS ilk yük ≥ 5 KB azalmış, 5/5 build.
- **Test:** revalidate (published/draft/unpublish), FAQ JS'siz klavye/erişilebilirlik, mevcut 345 test.
- **Risk:** `cache()` yalnız istek kapsamında geçerli; CLI ve import yolları etkilenmez (testle doğrulanır).

### F2 — Animasyon sistemi
- **Kapsam:** token'lar, `data-anim` + tek `MotionObserver`, hero CSS mikro animasyonları (LCP kuralı), hover standardı, `SiteSettings.motion` okuması (alan F7'de; şimdilik yalnız `html[data-motion]` desteği), `Reveal` kaldırma.
- **Dosyalar:** `src/app/(frontend)/globals.css`, `components/ui/motion-observer.tsx`, `components/ui/reveal.tsx` (silinir), ana sayfa ve blok bileşenlerindeki `Reveal` kullanımları.
- **Kabul:** client ada sayısı azalmış (tek gözlemci), JS'siz ve reduced-motion'da tüm içerik görünür, CLS < 0.05, LCP regresyonu yok.
- **Test:** vitest (SSR'da gizli durum yok, `data-anim=none`), Playwright reduced-motion + JS kapalı görünürlük, CLS ölçümü.
- **Risk:** client navigasyonunda yeniden tarama → `usePathname` bağımlılığı ve MutationObserver yok (bilinçli seçim).

### F3 — Blok çekirdeği + veri modeli (şema)
- **Kapsam:** `blockSettings()`/`appearance`, `BlockShell`, registry, hero `h1` kuralı, hero varyantları, cta/featureGrid genişletmeleri, admin `i18n` + TR etiketler (çekirdek bloklar), `imageURL` yer tutucuları, `blockReferences` spike kararı, migration `blocks_appearance`.
- **Dosyalar:** `src/blocks/*`, `src/fields/block-settings.ts`, `src/components/blocks/{registry,block-shell}.tsx`, `render-blocks.tsx`, `src/payload.config.ts`, `src/migrations/*`, `src/payload-types.ts`, `content/seed/schema.json`.
- **Kabul:** mevcut tüm sayfalar görsel olarak aynı (ekran görüntüsü farkı ≈ 0), eski veriler varsayılanlarla render ediliyor, kopya DB'de migration temiz, import dry-run 0 hata.
- **Test:** config↔registry parity, anchor tekilliği, tek `h1`, schema senkronu, `sqlite-integrity`, eski blok verisiyle render.
- **Risk:** blok tablo/kolon değişiklikleri `_v` tablolarını da etkiler. Çözüm: SQL incelemesi ve kopya DB.
- [x] **Uygulandı (2026-11-07).** Migration `20261107_110012_blocks_appearance`: 80 blok tablosuna (4 koleksiyon + `_v`) yalnız `ADD COLUMN` (560 ifade; `DROP TABLE`/`DELETE`/`__new_` yok), kolon varsayılanları = eski görünüm. Kopya DB → migrate → import dry-run 0 hata → canlı DB; import iki kez 0 create/88 update.
  - `src/fields/block-settings.ts`: `blockSettings(slug)` ("Görünüm" collapsible → `appearance` grubu: `theme auto|dark|light`, `spacing none|sm|md|lg`, `align start|center`, `width narrow|normal|wide` (richText hariç; kendi `width` alanı var), `animation subtle|none`, `anchor` (regex + ayrılmış id + sayfada tekil doğrulama), `hidden`). `BLOCK_DEFAULTS` + `resolveAppearance()` config ve renderer'ın tek kaynağı; `theme: auto` blok varsayılanına (CTA'da stile) çözülür.
  - `BlockShell` (tema/spacing/tone/container/anchor id + `scroll-mt`, `data-anim` **container'da**; section arka planı solmaz), `registry.ts` (mapped type: eksik renderer = tip hatası), `lib/blocks/render-plan.ts` (gizli/bilinmeyen atlanır, tek h1, yinelenen anchor HTML'den düşer). `RenderBlocks firstHeroH1` yalnız sayfanın kendi h1'i yoksa (F6 CMS sayfaları) açılır; PageHero'lu sayfalarda tüm hero'lar h2.
  - Hero varyantları: `default` (= sinematik; değer adı korunarak yeniden adlandırma/tablo yeniden kurulumu önlendi), `split`, `centered`, `minimal`. `mediaBackground` + video F4. CTA `split` stili; featureGrid `style: cards|plain` + ikon allowlist select (`src/lib/icon-names.ts`, eski metin değerleri normalize edilir).
  - Admin `i18n` (`payload/i18n/tr|en`, varsayılan TR), çekirdek 10 blok + link alanı TR/EN etiketleri, `admin.group` (3.85'te destekleniyor: Giriş/İçerik/Katalog/Kanıt/Dönüşüm/Yardımcı), `imageURL` yer tutucuları `public/admin/blocks/*.webp` (`node scripts/admin-block-placeholders.mjs`).
  - **`blockReferences` kararı: kullanılmaz (F3).** 3.85'te tip yorumu "`@todo` 4.0'da `blocks` ile birleşecek" (API kararlı değil); content-import şeması/importer string blokları atlıyor (ek çözümleyici gerekir); kazanç (admin client config tekrarı) 4 koleksiyon × 10 blokta küçük. SQLite tablo adı her iki yolda `<kök>_blocks_<slug>` (drizzle `traverseFields`), yani ileride geçiş migration'sız: blok sayısı/admin bundle ölçümü gerektirirse F10/4.0'da yeniden değerlendirilir.
  - Doğrulama: typecheck/lint/34 dosya 398 test (yeni: `blocks-core.test.tsx`, `blocks-appearance-migration.test.ts`), `.next-prod` build, 3200 1440/390 ekran görüntüsü: 7 sayfada yükseklik birebir, piksel farkı dev↔dev ≤ %0,021.

### F4 — Statik yeni bloklar
- **Kapsam:** `media`, `testimonial`, `tabs` (ada), `videoEmbed` facade, `spacer`/`divider`, hero `mediaBackground` + opsiyonel video. Migration `blocks_static_set`.
- **Kabul:** her blok dark/light × 390/1440 görsel olarak doğru, tabs klavye (ok tuşları/ARIA) çalışıyor, video iframe tıklamadan yüklenmiyor.
- **Test:** blok render birim testleri, Playwright klavye + ağ (iframe isteği yok) kontrolü.
- **Risk:** CSP video izinleri (mevcut allowlist) ve facade poster CLS.
- [x] **Uygulandı (2026-11-07).** Migration `20261107_111754_blocks_static_set`: yalnız `CREATE TABLE` (96) + `CREATE INDEX` ve 8 `ALTER TABLE ... ADD video_id` (hero, 4 koleksiyon + `_v`); up'ta `DROP`/`DELETE FROM`/`__new_` yok (yeniden kurulum yalnız `down`'da). Kopya DB → migrate → import dry-run 0 hata → canlı DB.
  - Yeni bloklar (4 koleksiyonun `layout` alanına eklendi): `media` (1-4 görsel, caption, `aspect` auto|16-9|4-3|1-1|21-9), `testimonial`, `tabs` (2-6 sekme × richText + opsiyonel görsel), `spacer` (`size`), `divider` (`style` line|accent). `videoEmbed` mevcuttu: şemada değişiklik yok, facade'e çevrildi. Hero: `variant` seçeneğine `mediaBackground` eklendi (mevcut değerler/default değişmedi) + `video` upload (yalnız mediaBackground'da görünür).
  - Hepsi `blockMeta` + `blockSettings` + `BLOCK_DEFAULTS` + registry + `public/admin/blocks/*.webp` yer tutucu. İstemci adaları: `tabs-island` (WAI-ARIA tablist, ok/Home/End, otomatik aktivasyon; tüm paneller SSR'da, ilk panel dışında `hidden` → JS'siz ilk sekme görünür), `video-facade` (poster + oynat; iframe yalnız tıklayınca, `youtube-nocookie` / Vimeo `dnt=1`, mevcut CSP `frame-src` ile uyumlu), `hero-video` (SSR'da boş; ≥768px + reduced-motion kapalı + saveData kapalı + `data-motion≠none` ise `<video muted loop playsinline>` mount eder, ekran dışında duraklatır). Saf mantık `src/lib/blocks/static.ts`.
  - Hero `mediaBackground`: poster = `media` (server `<img>` + preload, LCP), video üstte. Mobil/reduced-motion'da video isteği yok.
  - Doğrulama: typecheck/lint/36 dosya 420 test; `.next-prod` build; 3200'de geçici `qa-blocks` (legal rota `/tr/yasal/qa-blocks`, sonra silindi): CLS 0 (390/1440), 390'da video isteği 0, 1440 reduced-motion'da 0, 1440'ta video oynuyor; sağlayıcıya istek tıklamadan önce 0, tıklayınca nocookie iframe; tabs klavye (Right/End/wrap/Left/Home) ve JS kapalı doğrulandı. Ekran görüntüleri `scratchpad/f4/shots`.

### F5 — Dinamik (veri bağlı) bloklar
- **Kapsam:** `productFamilies`, `productShowcase`, `solutionsGrid`, `caseStudy`, `newsList`, `logoWall` kaynak iyileştirmesi; `src/lib/blocks/data.ts` (`cache`, `select`, preload). Migration `blocks_dynamic_set`.
- **Kabul:** blok başına sabit sorgu sayısı (N+1 yok), yayınlanmamış kayıt hiç görünmüyor (anon kalıbı), boş kaynakta blok sessizce gizleniyor.
- **Test:** sorgu sayacıyla N+1 testi, taslak ve gizli kayıt sızıntı testi, import ilişki çözümü (TR slug).
- **Risk:** ilişki derinliği ve populate şişmesi. Çözüm: `populate` beyaz listesi.
- [x] **Uygulandı (2026-11-07).** Migration `20261107_130000_blocks_dynamic_set`: 80 `CREATE TABLE` (5 blok × 4 koleksiyon × normal/`_v` × ana+`_locales`) + indeksler + logoWall `limit` için 8 `ADD COLUMN`; up'ta `DROP`/`DELETE`/`__new_` yok, down yalnız kendi tablolarını ve `limit` sütununu düşürür. Kopya DB → migrate → dry-run 0 hata → yedek (`scratchpad/softmarket-pre-f5.db*`) → canlı DB.
  - Bloklar: `productFamilies`, `productShowcase`, `solutionsGrid`, `caseStudy`, `newsList` (layoutBlocks sonuna eklendi); ortak alanlar `src/blocks/list-fields.ts`: eyebrow/heading/description, `source`, `limit` (1-24), `sort` (order|newest|oldest|manual), `layout` (grid-3|grid-2|grid-4|list; showcase ek `alternating`), `showViewAll/viewAllLabel/viewAllUrl`. Elle seçim ilişkileri `maxDepth: 0` (sayfa sorgusu populate etmez). logoWall: yeni kaynaklar `allPartners|allCaseStudies|partnersAndCaseStudies` + `limit`; eski değerler aynı.
  - `src/lib/blocks/data.ts`: `cache()` + primitive anahtar, anonim (`overrideAccess:false`, `draft:false`), `pagination:false`, select/populate beyaz listesi, depth 1; `preloadBlockData` `RenderBlocks` içinde. Boş kaynak → sorgusuz boş, blok render edilmez.
  - Not: 15+ karakterli slug'larda `enum_..._appearance_animation` 63 karakteri aşıyordu; `blockSettings` animasyon select'ine `enumName` fonksiyonu eklendi (yalnız drizzle şeması, SQLite etkisiz). Blok `dbName` KULLANMA (tablo adı kökten bağımsız olup 4 koleksiyonda çakışır).
  - Sorgu sayısı (loader başına, kayıt sayısından bağımsız): families 4, products 4, solutions 3, posts 3, logos 4, caseStudy 1. 3200 prod: 9 veri bloklu sayfa toplam 29 sorgu.
  - Test: typecheck/lint/38 dosya 457 test (yeni `blocks-dynamic.test.tsx`, `blocks-dynamic-db.test.tsx`, content-import F5 ilişki testi). Ekran görüntüleri `scratchpad/f5/qa-{390,1440}-{dark,light}.png`; geçici `qa-dynamic` sayfası ve QA kayıtları silindi.

### F6 — Ana sayfa ve sistem sayfaları CMS'e
- **Kapsam:** `SiteSettings.homePage`, `pages.systemKey` + `hero` grubu, `pageType: template`, ailelere `layout`, `[locale]/[slug]` landing rotası + ayrılmış slug doğrulaması, liste sayfalarında CMS hero + alt bloklar, `content/seed/05-pages.json` (bugünkü ana sayfanın birebir blok karşılığı), sabit ana sayfanın yedeğe indirgenmesi. Migration `page_builder_pages`.
- **Kabul:** seed sonrası `/tr` ve `/en` bugünküyle görsel olarak eşdeğer. Admin'de blok sırası değişince (yayın sonrası) ana sayfa sırası değişiyor. Liste sayfası başlıkları CMS'ten, boşken i18n'den geliyor. Sitemap ve hreflang landing sayfalarını kapsıyor. Template sayfalar public değil.
- **Test:** ayrılmış slug ve EN rewrite çakışması, home çözümleme sırası (homePage → slug home → yedek), Playwright: API ile blok sırasını değiştir → yayınla → sıra değişti, import idempotent (2. koşu 0 create).
- **Risk:** `[slug]` ile `[...notFound]` ve rewrite önceliği; locale'e özel slug ile dil değiştirici.
- [x] **Uygulandı (2026-11-07).** Migration `20261107_144850_page_builder_pages`: up'ta yalnız 66 `CREATE TABLE` (pages `listing` bloğu + `_v`, `pages_hero_actions` + `_v`, ürün ailesi `layout` blok tabloları + `product_families_rels`), 154 indeks ve 185 `ADD COLUMN` (160 × `appearance_separator`, hero `aside`/`panel_title` 8+8, pages `system_key` + hero metinleri + `_v`, `site_settings.home_page_id`) + `site_settings_home_page_delete` trigger'ı (ALTER ADD FK'si `ON DELETE SET NULL` taşıyamaz; sayfa silinince ayar boşalır). Üretilen `down()` `site_settings`'i `__new_` ile yeniden kuruyordu → elle: yalnız F6 nesneleri düşer (F7 deseni); testle kilitli. Kopya DB → migrate → dry-run 0 hata → 3200 doğrulama → yedek `scratchpad/softmarket-pre-f6.db*` (+ `.snapshot.db`) → canlı DB; import 2× (10 create → 0 create/98 update).
  - Sayfa modeli (`src/lib/system-pages.ts` tek kaynak): `pages.systemKey` (`products|solutions|news|customers|careers|partners|support|contact|about`, unique, çoğaltmada boşalır) + `hero` grubu (eyebrow/title/lead/actions ≤2; yalnız sistem sayfasında görünür), `pageType: template` (anonim okuma erişimde NULL-güvenli olarak dışlanır; rota/sitemap/arama yok), `SiteSettings.homePage` (legal/template/sistem sayfaları filtreli), ailelere `layout` (ürün listesinin altında). Ana sayfa çözümü `getHomePage`: tek anonim sorguda homePage ID'si → slug `home` → `null` = `components/home/fallback-home.tsx` (eski kompozisyon, birebir). `/home` ve homePage'in kendi slug'ı `/`'a 308.
  - Liste kendisi taşınabilir blok: yeni `listing` bloğu (yalnız pages; alanı yok, görünüm ayarları var). `SystemBody`: kayıt yoksa eski düzen; kayıtta `listing` yoksa liste hero'nun hemen altında; varsa bloğun konumunda; gizli blok = liste yok. 9 rota `SystemHero` (CMS → i18n yedeği; SEO meta → hero → i18n) kullanır; iş ortakları CTA bandı yalnız kayıt yokken (seed'de `cta` bloğu).
  - Landing: `[locale]/[slug]` (ISR 3600 + statik parametreler sitemap'ten). Ayrılmış slug = tüm `CANONICAL_PATHS` ilk segmentleri + `SEGMENTS_EN` anahtar/değerleri + admin/api/arama/tr/en/_next/metadata yolları; yalnız standard/landing + sistem anahtarı olmayan sayfalarda kaydı reddeder, rota da tekrar kontrol eder. `/[slug]` next-intl `pathnames`'e EKLENMEDİ (EN rewrite'ları etkilenmez); `LINK_ROUTES`'a yalnız yeni `slug` anahtarı eklendi. `referencePath` sayfalar için `pagePath()` (legal/sistem/home/landing, template yok). Sitemap + hreflang landing sayfalarını kapsar.
  - Ana sayfa birebir: hero `aside: families` (eski aile paneli) + sinematik pageTop dolgusu/lead/buton aralığı ve ikincil butonda ok; yeni görünüm alanı `separator` (`none|top`, ince üst çizgi); ListFrame `mt-14`; CTA `banner` boşlukları CtaBand ile eşitlendi (ürün sayfalarındaki CTA bandı +8 px). Seed `content/seed/05-pages.json` (home + 9 sistem sayfası, linkler `route`), `01-globals.json` `homePage: "home"`.
  - Revalidate düzeltmesi: `revalidatePath('/tr'|'/en', 'layout')` Next'in türetilmiş etiketlerine (`/layout`, `/(frontend)/[locale]/layout`, URL yolu) hiç uymuyordu → `revalidatePath('/', 'layout')` (taslak-güvenli kural aynı). Sitemap `force-dynamic` (Next 15.4 dosya ISR önbelleği route handler'larda etiket geçersizliğine bakmıyor).
  - Doğrulama: `.next-prod` + 3200 (DB kopyası): /tr, /en ve 9 sistem sayfası 390/1440 önce(dev)/sonra yükseklik birebir, piksel farkı %0 (eşiksiz); API ile blok sırası değişti → yayın → 3200'de değişti → geri alındı; liste başlığı CMS'ten / boşken i18n'den; landing TR/EN 200 + hreflang + sitemap, ayrılmış slug 400, template 404 ve anonim API'de yok; taslak ana sayfa anonimde görünmüyor. Sorgu: /tr MISS 20, HIT 0. typecheck/lint/44 dosya 536 test.

### F7 — Globals tam düzenlenebilirlik
- **Kapsam:** link `route` tipi (tüm link kullanımları), header logo/site adı/duyuru/utility/custom mega/çoklu CTA, footer blurb/iletişim/sosyal/yer tutucular, SiteSettings `motion` + `brand.accent` (kontrast hook'u), seed menüsünün `route`'a dönüşümü. Migration `globals_editable`.
- **Kabul:** logo ve site adı CMS'ten geliyor, seed menüsünde `/tr` sabiti yok, EN menü doğru yollara çıkıyor, düşük kontrastlı renk reddediliyor.
- **Test:** route çözümleme TR/EN, kontrast doğrulama, header/footer CMS-boş yedek testi, MCP global update.
- **Risk:** link alanı birçok tabloda kullanılıyor ve migration geniş. Çözüm: yalnız ekleme.
- [x] **Uygulandı (2026-11-07).** Migration `20261107_141523_globals_editable`: up'ta yalnız 6 `CREATE TABLE` (+11 indeks) ve 91 `ADD COLUMN` (link `route`/`route_param` 24 blok action tablosu + header/footer link tabloları; header/footer/site-settings yeni alanları). Üretilen `down()` `header_nav_items` ve `site_settings`'i `__new_` ile yeniden kuruyordu (transaction içinde `PRAGMA foreign_keys=OFF` etkisiz → locales/children/social cascade silinirdi); elle yalnız F7 nesnelerini düşüren `down()` yazıldı ve testle kilitlendi. Kopya DB → migrate → dry-run 0 hata → yedek (`scratchpad/softmarket-pre-f7.db*`) → canlı DB. Import 2× 0 create/88 update.
  - Link: `type` radyosuna `route` eklendi (internal/external/default aynı). `route` select değerleri kararlı anahtarlar (`urunler`, `destek_surum-notlari`, `yasal_slug`…; yol değil, GraphQL enum uyumu), etiketler TR yolu/EN yolu; en çok tek dinamik segmentli `CANONICAL_PATHS` (token/ID portal sayfaları hariç) + `routeParam` (slug regex). `linkTarget()` TR kanonik yolu üretir, `AppLink/localizedHref` EN'e çevirir. Header/footer/hero/CTA/mediaText aynı `linkField` → hepsi destekler; eski internal/external verisi aynen render edilir.
  - Header: `megaMenu: custom` (+ `columns` ≤4 × links + `featured` kart: başlık/açıklama/public görsel/link), `cta.secondary`, `announcement` (enabled/text/link/dismissible; normal akışta header üstünde, `announcement-bar` adası yalnız kapatma + localStorage, id = metin+link hash), `utility` (≤4 küçük link, desktop üst çubuk + mobil menü; `showSearch/showLanguage/showAccount`). Footer: `brandBlurb`, `showContact`, `showSocial`, copyright `{year}`/`{siteName}`.
  - SiteSettings: `favicon`, "Marka ve hareket" sekmesi `brand.accent` + `motion` (subtle|none → `html[data-motion]`). Logo/logoDark/site adı header/footer/metadata/OG/JSON-LD'de (yalnız public, image MIME; protected medya asla). İkonlar `src/app` → `public/` (dosya tabanlı app ikonları CMS favicon'unu ezerdi); admin `meta.icons`.
  - Kontrast kuralı (`src/lib/brand.ts`): girilen renk en az bir temada olduğu gibi geçmeli (zemin+surface üzerinde metin ve kendi buton metni beyaz/#0b0d10 ≥4,5:1); diğer tema tonu aynı hue ile HSL açıklığı kaydırılarak türetilir, hover ±%8 ve aynı kuralı sağlar. İki temada da geçmeyen orta parlaklık bandı (ör. #e11d48, #d9480f) ve hex dışı değer field `validate` ile reddedilir (admin/REST/Local API/MCP). Layout `<html style>` `--brand-{dark,light}-accent(-hover|-contrast)` yazar; `globals.css` `var(--brand-…, varsayılan)`. Boşsa eski palet.
  - Yer tutucu temizliği: `publicText()` `[BÜYÜK HARF]` kalıplarını boş sayar → iletişim/footer/JSON-LD satırı gizlenir. Seed: menü/footer/ürün CTA'ları `route` (seed'de `/tr`/`/en` ve `mailto:[COMPANY EMAIL]` yok), siteName TR/EN `SoftMarket`, nötr iletişim (İstanbul, +90 212 000 00 00, hafta içi 09–18; e-posta bilerek boş → bildirim yanlış adrese gitmez).
  - Test: `globals-editable.test.tsx` (route TR/EN, kontrast kabul/ret/format, CMS-boş yedek, eski link, yer tutucu, MCP izni), `globals-editable-db.test.ts` (gerçek SQLite: MCP API key yolu ile update + ret), `globals-editable-migration.test.ts`. 42 dosya/516 test, `.next-prod` build, 3200 Playwright 390/1440 (`scratchpad/f7/shots`), accent geçici değiştirme Local API ile doğrulandı ve geri alındı.

### F8 — Live Preview + taslak modu
- **Kapsam:** `admin.livePreview`, preview/exit rotaları (staff doğrulama, açık yönlendirme koruması), draft yükleyiciler, `RefreshRouteOnSave`, `pages` autosave. Migration `pages_autosave`.
- **Kabul:** editör kaydettiğinde iframe ≤ 2 sn içinde yenileniyor, anonim kullanıcı draft göremiyor (cookie çalınsa bile staff kontrolü var), taslak ISR'i bozmuyor.
- **Test:** preview rotası anon/customer/editor, `redirect` doğrulaması, draft sızıntısı, revalidate atlama, Playwright admin iframe akışı.
- **Risk:** güvenlik (draft sızıntısı). Bu yüzden QA en yüksek effort'ta yapılır.
- [x] **Uygulandı (2026-11-07).** Migration `20261107_190342_pages_autosave`: up yalnız `ALTER TABLE _pages_v ADD autosave` + indeks (DROP/DELETE/`__new_` yok); down yalnız indeks + kolonu düşürür (tablo yeniden kurulmaz), testle kilitli. Kopya DB → migrate → dry-run 0 hata → yedek `scratchpad/softmarket-pre-f8.db*` (+ `.snapshot.db`) → canlı DB. Yeni bağımlılık `@payloadcms/live-preview-react@3.85.1`.
  - Güvenlik modeli: `GET /api/preview?redirect=/<tr|en>/...` (`src/lib/preview-route.ts`) yalnız `payload.auth` ile doğrulanan staff (users, admin/editor) için `draftMode().enable()`; paylaşılan gizli token yok (tek başına asla yetmez). Sıra: `Sec-Fetch-Site` cross-site/same-site 403 → geçersiz redirect 400 → oturum yok 401 → customer (portal çerezi, `payload-token` içinde customer JWT, `Authorization: JWT`) 403; hiçbirinde draft çerezi yazılmaz. Redirect allow-list (`safePreviewRedirect`): yalnız `/tr|/en` + slug biçimli segmentler; `%` (kodlanmış `/`, `\`, CRLF), `//`, `\`, şema, nokta segmenti, query/hash reddedilir; Location göreli. `GET /api/exit-preview` her zaman draft modunu kapatır (aynı doğrulama, varsayılan `/tr`).
  - Draft okuma: `src/lib/preview.ts` `getPreviewUser` (istek başına `cache`) = draft modu açık **ve** istekte canlı staff oturumu (her render'da `payload.auth`); aksi halde `null` (fail-closed, Next iç hataları `unstable_rethrow`). `readAs(locale)` → staff ise `draft: true` + `overrideAccess: false` + staff user, değilse anonim yayınlı okuma. Yalnız tekil belge yükleyicileri: `getHomePage`, `getSystemPage`, `getLandingPage`, `getPage` (yasal/hakkımızda), `getFamily`, `getProductDetail` (ürün sorgusu), `getSolution`, `getCaseStudy`, `getPost`; liste/ilişkili sorgular (sürümler, indirmeler, blok listeleri) anonim kalır. Çalınan draft çerezi tek başına, customer oturumu, rolü düşen/oturumu silinen staff → yayınlı içerik.
  - Önbellek: Next draft modunda ISR anahtarı yok (render istek başına, ISR'a yazılmaz) ve `Cache-Control: private, no-cache, no-store…`; middleware `__prerender_bypass` çerezli her isteğe ayrıca `private, no-store`. Ana sayfanın `dynamic = 'error'` ayarı kaldırıldı (draft modunda bile `headers()`'ı yasaklıyordu; sayfa hâlâ SSG ●). Birim testi: hiçbir frontend rota `dynamic = 'error'|'force-static'` kullanamaz. Autosave/taslak `_pages_v`'ye yazar, revalidate kuralı (F1/F6) değişmedi: yalnız yayın/yayından kaldırma önbelleği yeniler.
  - Admin: `admin.livePreview` (`src/lib/preview-url.ts`): `pages, products, product-families, solutions, case-studies, posts`; breakpoint 390×844 / 768×1024 / 1440×900. URL = `<origin>/api/preview?redirect=<localizedHref>`; pages: homePage ID'si veya slug `home` → `/`, sistem/yasal/landing `pagePath`, template → önizleme yok; ürün aile slug'ı aranır. Origin: public `NEXT_PUBLIC_SERVER_URL` varsa o, yerelde (loopback) admin isteğinin loopback host'u (3100/3200 kendini önizler; sahte Host yok sayılır). `pages` autosave `interval: 2000` (diğer drafted koleksiyonlar elle taslak).
  - İstemci adası `components/preview/live-preview-refresh.tsx`: yalnız staff draft render'ında layout'a eklenir; `RefreshRouteOnSave` `serverURL = window.location.origin` (yalnız aynı-origin `payload-document-event` → `router.refresh()`); iframe dışında açılırsa "Önizlemeden çık" rozeti (`common.exitPreview`). Draft modunda Cloudflare beacon yüklenmez. CSP değişmedi (`frame-ancestors 'self'`, admin `frame-src 'self'` zaten aynı-origin iframe'e izin veriyor).
  - Doğrulama (`.next-prod` + 3200, DB kopyası, geçici admin/editor/customer yalnız kopyada): anonim 401, customer 3 varyant 403, sahte JWT 401, cross-site 403, 10 redirect vektörü 400, hiçbirinde `__prerender_bypass` yok; editor 307 + çerez. /tr, haber, çözüm, ürün, yalnız-taslak vaka ve landing: editor+draft taslağı görür (`private, no-store`), draft çerezi tek başına/customer+draft/editor draftsız yayınlı görür; ardından anonim yine yayınlı + `x-nextjs-cache: HIT`; yalnız-taslak sayfalar anonimde 404. Yayın → MISS + yeni içerik (geri alındı). Playwright: editor admin'de ana sayfa → Live Preview iframe (`/api/preview?redirect=%2Ftr`) → hero başlığı yazıldı → autosave 2061 ms → iframe 92 ms sonra güncellendi; aynı anda anonim ziyaretçi yayınlıyı gördü; mobil breakpoint 390×844; posts EN → `/en/news/...`. Ekranlar `scratchpad/f8/shots`. Test: `live-preview.test.ts` (43: redirect vektörleri, hedef yollar, origin, config, mesaj sözleşmesi, middleware, rota ayarı) + `live-preview-db.test.ts` (6: migration, gate anon/customer/editor/admin, exit, draft sızıntısı, rol/oturum iptali, autosave revalidate atlama, tek autosave sürümü); 46 dosya/585 test.

### F9 — Görsel pipeline (F1 sonrası bağımsız)
- **Kapsam:** `imageSizes` + webp + focal point, `MediaImage` srcset/sizes, hero `priority`/`fetchPriority`, `media:regenerate`. Migration `media_image_sizes`.
- **Kabul:** mobil hero ≤ 180 KB, `sizes` doğru seçiliyor, protected boyut URL'leri yetkisiz kullanıcıya 404/403 dönüyor, LCP hedefi tutuyor.
- **Test:** srcset üretimi, boyut URL erişim testleri (anon/customer/staff), regenerate idempotent.
- **Risk:** disk kullanımı (~4×) ve sharp süresi. Çözüm: `withoutEnlargement` ve gereksiz boyutları atlamak.

### F10 — Editör deneyimi
- **Kapsam:** tüm admin etiketleri ve açıklamaları TR/EN, blok galeri sayfası + önizleme görselleri, `content/templates/starter`, `docs/editor-guide.md`, `AGENTS.md`'ye page builder/MCP tarifi.
- **Kabul:** admin TR'de İngilizce etiket kalmamış (test: config tarayıcısı), starter import boş DB'de çalışan site üretiyor, kılavuz her bloğu kapsıyor.
- **Test:** label tarayıcı birim testi, starter import (izole SQLite).

### F11 — Görsel QA turu 2 + perf kabul
- **Kapsam:** F0 matrisinin tekrarı, kullanıcı hata listesinin kapanışı, bütçe kapıları, e2e (katalog → teklif, dil, blok sırası, preview).
- **Kabul:** §7 bütçesinin tamamı yeşil, `docs/qa/visual-baseline.md` maddeleri kapalı.

### G — Görsel hata düzeltme turu (kullanıcı listesi gelince, F0 sonrası)
- Her madde için sayfa, ekran genişliği, beklenen ve gerçekleşen kaydedilir. Düzeltmeler küçük ve madde başına commit'lenir. Önce/sonra ekran görüntüsü alınır.

---

## 9. Ajan dağılımı (`takim-lideri`; yazan ≠ denetleyen)

| Faz | Yazan (effort) | QA (effort) |
|---|---|---|
| F0 | GPT 6.1 Terra (High): perf/DB/timeout · Claude Sonnet 5.5 (Medium): ekran görüntüsü matrisi | GPT 6.1 Sol (Medium) |
| F1 | GPT 6.1 Terra (Medium) | Claude Opus alt ajan (Medium) |
| F2 | Claude Sonnet 5.5 (Medium) | GPT 6.1 Terra (High) |
| F3 | Claude Opus alt ajan (High): şema/renderer · GPT 6.1 Sol (Medium): migration/import/test | GPT 6.1 Terra (High) |
| F4 | Claude Sonnet 5.5 (Medium): UI · GPT 6.1 Sol (Medium): migration/test | GPT 6.1 Terra (High) |
| F5 | GPT 6.1 Terra (High): veri yükleyiciler · Claude Sonnet 5.5 (Medium): UI | GPT 6.1 Sol (High) + Claude Opus (Low) çapraz okuma |
| F6 | Claude Opus alt ajan (High): sayfa modeli/rota · GPT 6.1 Sol (Medium): seed/migration/test | GPT 6.1 Terra (High) |
| F7 | Claude Opus alt ajan (Medium): şema · Claude Sonnet 5.5 (Medium): header/footer UI · GPT 6.1 Sol (Medium): migration/seed | GPT 6.1 Terra (High) |
| F8 | Claude Opus alt ajan (High) | GPT 6.1 Terra (High), sıfır bağlam güvenlik incelemesi |
| F9 | GPT 6.1 Terra (High) | Claude Sonnet 5.5 (Medium) + Opus (Low) erişim kontrolü |
| F10 | Claude Haiku 5.5 (Low): etiket/çeviri/kılavuz · Claude Sonnet 5.5 (Low): önizleme görselleri | GPT 6.1 Sol (Medium) |
| F11 / G | Claude Sonnet 5.5 (Medium): düzeltmeler · GPT 6.1 Terra (Medium): perf doğrulama | GPT 6.1 Sol (High) |

Kota dengesi: Claude ağırlıklı fazlar (F2–F4, F6–F7) GPT ağırlıklı fazlarla (F1, F5, F9) dönüşümlü yürür. Tıkanıklıkta lider danışmanlık ister ama kod yazmaz.

---

## 10. Riskler (özet)
- **Veri kaybı (SQLite yeniden kurulum):** yalnız ekleme, kopya DB, SQL incelemesi.
- **Taslak sızıntısı veya cache bozulması:** staff doğrulaması ve yayın durumuna bağlı revalidation.
- **Blok sayısı arttıkça admin config/bundle şişmesi:** `blockReferences` spike'ı ve koleksiyon başına alt kümeler.
- **Genellik ↔ sadelik:** blok seçenekleri bilinçli olarak az tutulur (tema, boşluk, hizalama, genişlik, animasyon, anchor). Serbest renk, font ve piksel ayarı yok.
- **Browser testleri:** macOS MachPort sınırı (bilinen); kabul ölçümleri izinli hostta yapılır.

## 11. Açık sorular (kullanıcıya)
1. "Genel şablon" her şirket için **ayrı kurulum** (tek site/tek DB) mu, yoksa aynı kurulumda **çok siteli (multi-tenant)** yapı mı gerekiyor? Plan ayrı kurulumu varsayıyor.
2. Marka rengi (kobalt yerine) ve logo admin'den değiştirilebilsin mi (kontrast denetimli), yoksa renk kod/token dosyasında mı kalsın?
3. Liste sayfalarında (Ürünler, Haberler, Referanslar…) yalnız üst hero + alt bloklar yeterli mi, yoksa listenin kendisi de taşınabilir bir "Liste" bloğu olsun mu?
4. Hero'da self-host video (MP4/WebM) istiyor musunuz? Mobilde yalnız poster gösterilir ve bütçeyi korumak için masaüstünde yüklenir.
5. Live Preview için autosave (yaklaşık 2 sn aralık, SQLite yazma yükü) açılsın mı, yoksa "Kaydet → önizleme yenilenir" yeterli mi?
