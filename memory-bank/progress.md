- [x] 2026-11-07 F8 Live Preview + taslak modu: staff-only `/api/preview` + `/api/exit-preview` (açık yönlendirme allow-list, cross-site ret, gizli token yok), draft okuma yalnız draft modu + yeniden doğrulanan staff oturumu (`readAs`), 6 koleksiyonda `admin.livePreview` (390/768/1440), `RefreshRouteOnSave` adası, `pages` autosave 2 sn, migration `20261107_190342_pages_autosave` (additif) canlı DB'de. Draft yanıtları no-store/ISR dışı; autosave önbelleği yenilemez. Playwright iframe ≤2 sn (92 ms). 585 test. Ayrıntı: plan F8 notu.
  - F9 notu: `MediaImage`/imageSizes eklerken draft modunda staff `populate` protected medyayı da döndürebilir; görsel URL'leri yine yalnız iframe'deki staff'a gider (ISR'a yazılmaz) ama srcset üretimi `mediaOf`/visibility kontrolünü korumalı.
  - F10 notu: editör kılavuzuna Live Preview (autosave, breakpoint, template sayfalarında önizleme yok, ilişkili listelerde yalnız yayınlı kayıtlar görünür, "Önizlemeden çık") eklenmeli; admin etiketleri breakpoint adları TR/EN tek string ("Mobil / Mobile"). Diğer drafted koleksiyonlara autosave istenirse her biri ayrı `ADD COLUMN autosave` migration'ı gerektirir.
  - Açık not: CSP varsayılan Report-Only → `frame-ancestors` canlıda zorlanmıyor (önceden var). Draft sızıntısı yine yok (çapraz-site iframe'de `payload-token` SameSite=Lax gönderilmez), ama clickjacking için prod'da `CSP_ENFORCE=true` veya `X-Frame-Options: SAMEORIGIN` önerilir.

- F6 denetimi (2026-11-07): sitemap içerik sorguları `public-sitemap` etiketiyle 1 saat önbellekli, yayın/silme/global değişikliğinde geçersizlenir; yapılandırılmış ana sayfanın landing adresi sitemap dışındadır. `20261107_160000_globals_media_delete` medya FK trigger migration'ı yalnız DB kopyasında uygulandı ve test edildi; canlıya uygulanmadı.

- [x] 2026-11-07 F7 globals tam düzenlenebilir: link `route` tipi (locale'den bağımsız, `src/i18n/paths.ts` LINK_ROUTES/routePath), header custom mega/ikinci CTA/duyuru bandı (kapatılabilir ada)/utility linkleri, footer blurb/iletişim/sosyal toggle/`{year}{siteName}` telif, SiteSettings favicon + `brand.accent` (kontrast kuralı `src/lib/brand.ts`) + `motion`. Migration `20261107_141523_globals_editable` (up yalnız CREATE/ADD; üretilen yıkıcı `__new_` down elle değiştirildi) canlı DB'de; yedek `scratchpad/softmarket-pre-f7.db*`. Seed route'a dönüştü, yer tutucular temizlendi; import 2× 0 create/88 update. 42 dosya/516 test, `.next-prod` build, 3200 Playwright 390/1440 + accent Local API geçici değişim (DB kopyası) doğrulandı, geri alındı; 3200 kapalı, commit yok.
- 2026-11-07 F5 denetimi: elle seçim/limit, eski logoWall anonim yeniden okuma, otomatik logo boş sonuç/dedup ve import şeması üst sınırı düzeltildi. Typecheck/lint, 39 dosya/467 test ve SQLite kopyasıyla `.next-prod` build geçti. Farklı medya ID'leriyle sorgu sayıları sabit: aile/ürün 4, çözüm/haber/vaka 3, birleşik logo 6. Geçici SQLite'ta migration up/down transaction testi tüm eski tablo satırlarını (normal + `_v` çeviriler dahil) korudu; migration dosyası değiştirilmedi. Locale/draft, kapalı kariyer, protected medya, URL whitelist ve 63 karakter enum sınırı regresyonları geçti. 3200: /tr, /en, /tr/urunler, /tr/urunler/akis-yonetimi/akis-merkezi, /admin 200; /tr/olmayan 404. 3200 kapatıldı; 3100 PID 64423 korundu, canlı migration/commit/.next silme yok.
- [x] F5 dinamik (veri bağlı) bloklar: 5 yeni blok + logoWall kaynakları, liste kaynağı/limit/sıralama/düzen/tümünü gör, sabit sorgu + taslak sızıntı + import ilişki testleri (457 test geçti).
# İlerleme

- 2026-11-07 F8 denetimi: preview ve çıkış CSRF kontrolü güçlendirildi; SAMEORIGIN frame başlığı eklendi. typecheck, lint, 585 test, izole build ve 3200 duman/gerçek draft-ISR sınaması geçti.

- [x] 2026-11-07 F6 page builder: ana sayfa CMS `pages` kaydı (homePage → `home` → yedek), 9 sistem sayfası (`systemKey` + hero + taşınabilir `listing` bloğu), landing `[locale]/[slug]` + ayrılmış slug, template gizliliği, aile `layout`, sitemap/hreflang, migration `20261107_144850_page_builder_pages` (additif up, elle güvenli down, home silme trigger'ı) canlı DB'de; seed `05-pages.json` 2× (10 → 0 create). Revalidate kök neden düzeltmesi (`'/'` layout) + dinamik sitemap. 3200 görsel eşdeğerlik %0 piksel farkı; 536 test. Ayrıntı: plan F6 notu + activeContext.

- `20261107_120000_hero_video_delete` migration'ı yedek alındıktan sonra canlı DB'ye bilerek uygulandı (commit `a45a9df`).

- 2026-11-07 F4 denetimi: migration down veri kaybı, video FK silme hatası (yeni ileri migration sonradan canlıya uygulandı), video URL doğrulaması, public video/MIME/poster sınırları, JS'siz tabs ve testimonial alt fallback düzeltildi. Typecheck/lint/438 test/izole build ve 3200 HTTP duman geçti; geçici SQLite izolasyonu, import tekrarı, protected URL/404 ve richText XSS regresyonları doğrulandı. Chromium UI MachPort izniyle engellendi. 3200 kapalı; denetim sırasında 3100'e dokunulmadı. Ayrıntı activeContext.

- 2026-11-07 F4 statik bloklar: media/testimonial/tabs/spacer/divider + videoEmbed facade + hero mediaBackground/video; migration `blocks_static_set` (additif) canlı DB'de; 420 test, build, 3200 Playwright QA (CLS 0, iframe/video ağ kontrolü, tabs klavye) geçti. Ayrıntı: plan F4 notu + activeContext.

- 2026-11-07 F3/F0 denetimi: ayrılmış anchor çakışması ve tanılama günlüğünde URL/başlık kaynaklı bilgi sızıntısı düzeltildi. Geçici DB migration up/down testi, typecheck, lint, 399 test, izole build ve 3200 HTTP duman kontrolü geçti; süreç kapatıldı.

- 2026-11-07 F3 blok çekirdeği tamamlandı (2026-11-07): migration `20261107_110012_blocks_appearance` (yalnız ADD COLUMN, 80 blok tablosu, varsayılanlar eski görünüm; kopya DB + dry-run sonra canlı; import 2× 0 create/88 update). `src/fields/block-settings.ts` (`blockSettings`, `BLOCK_DEFAULTS`, `resolveAppearance`, anchor doğrulama), `components/blocks/{block-shell.tsx,registry.ts,types.ts}`, `lib/blocks/render-plan.ts` (tek h1: `RenderBlocks firstHeroH1` yalnız h1'siz CMS sayfası/F6; PageHero'lu sayfalarda hero h2). Hero `default`=sinematik + split/centered/minimal; CTA `split`; featureGrid `style` + ikon select (`lib/icon-names.ts`). Admin i18n TR varsayılan, blok TR/EN etiket + `admin.group` + `public/admin/blocks/*.webp` yer tutucu. `blockReferences` kullanılmadı (plan F3 gerekçesi). typecheck/lint/34 dosya 398 test, `.next-prod` build; 3200 1440/390 görüntü farkı ≈0 (`scratchpad/f3/`). 3200 kapalı, 3100'e dokunulmadı, commit yok.

- F0 SQLite sorgu ölçümü tamamlandı (2026-11-07): `src/lib/db-query-log.ts`, Node `instrumentation.ts` ve bayrakla etkin Payload adapter sarmalı. `SM_DB_QUERY_LOG=1` ile libSQL statement sayısı/süre + HTTP isteğine ALS bağlamı; server render `getDbQueryStats()` okuyabilir. Streaming sonrası `finish` logları `scripts/perf-isr.ts` tarafından `SM_DB_QUERY_LOG_FILE` ve istek kimliğiyle eşlenir. Bayrak kapalıyken adapter/client/HTTP emit sarılmaz. `.next-perf` build + 3300 production ölçümü: 146 route/292 HTTP 200; 122 HIT/HIT çiftinde 0/0 sorgu. Arama 33/33, katalog 17/14 (ilk 3 PRAGMA), iletişim/indirmeler 16/16, portal giriş 9/9; eşzamanlı 33/9/14 izolasyonu doğrulandı. İlk 10 route `docs/perf/baseline.md` içinde. typecheck/lint/32 dosya 376 test/diff-check geçti. 3300 kapalı; 3100'e dokunulmadı; commit yok.

- 2026-11-07 F1/F2/G çapraz denetim: taslak sonrası unpublish invalidation, nesne seçenekli cache anahtarları, eksik aile sayaçları, observer hata/URL query temizliği, hero görseli opacity gecikmesi, uzun breadcrumb taşması ve kodlanmış mailto yer tutucuları düzeltildi. Gerçek Payload/SQLite yayın yaşam döngüsü regresyonu eklendi. Typecheck/lint/31 dosya 372 test/`.next-prod` build geçti. 3200 `pnpm start` duman: 6 rota 200, olmayan rota 404, SSR pending=0, Mono preload=0. Süreç kapatıldı; 3100/.next/commit işlemi yok.

- 2026-11-07 F0 kısmi tarayıcısız ölçüm: bundle ve 144 URL HTTP sonuçları `docs/perf/baseline.md`; SQLite sayacı ve timeout kök nedeni henüz eksik.

- Güvenlik QA (2026-11-07): lisans e-postası HTTP yanıtı sonrası, bağımsız doğrulanmış kalıcı kayıt için gönderilir; SMTP yoksa anahtar konsola yazılmaz. İstek bağlamı dışındaki atamalarda bildirim zamanlanmaz. Uygulanmış `20261107_092304_remove_sales_legal_fields` üç eski ilişki değerini siler; down değerleri geri getirmez. Migration geçmişi değiştirilmedi.

- UX denetimi düzeltmeleri (13 madde) tamamlandı: dil değiştirici bağlamı, yasal/footer linkleri, header seed + CTA, buton kontrastı (cn/twMerge kök neden), ürün sayfası tek kaynak, form sürüm filtresi + satır içi hatalar, localized 404 (catch-all), favicon seti, mobil 44px, CSP nonce hydration uyarısı, indirme filtreleri. Typecheck/lint/345 test/izole build geçti; Playwright ile 3100'de doğrulandı. Yeni test: `tests/unit/ux-audit.test.tsx`.

- 404/güvenlik QA: medya dosyası varlık kontrolü erişim filtresinden sonra yapılır; yetkisiz ve olmayan dosyalar 404. Geçici SQLite regresyon testi eklendi. İzole prod build başarılı; doküman sayfası timeout yeniden üretilemedi, kesin kök neden belirlenemedi.

- Faz 8a güvenlik QA: MCP derinlik/dosya yolu ve medya boyutu/symlink düzeltildi; canlı HTTP erişim testleri ve 264 Vitest testi geçti; CLI medya dosyaları için artık aşağıdaki telafi temizliğini uygular.

## Durum özeti
- Tamamlandı: Faz 0, Faz 1, Faz 2 (QA geçti). Faz 3 yazıldı; Faz 4 tamamlandı. Online ödeme kapsamdan çıkarıldı.
- Faz 6 (müşteri portalı) tamamlandı. Faz 7 tamamlandı (metinler, README, yasal taslaklar; hukuk incelemesi bekliyor). Faz 8a tamamlandı; kalan: Faz 8b, Faz 9.
- Commit yok; çalışma ağacı commit edilmemiş durumda.

## Çalışanlar
- Repo iskeleti, Next.js 15 + Payload CMS 3 + SQLite.
- Makefile ve pnpm script'leri (liste: `techContext.md`).
- 21 özel koleksiyon (destek mesajları dahil), 3 global; access kuralları; 3 SQLite migration.
- Tasarım sistemi: tokenlar, `<Section>` teması, Header/Footer/mega menü, `alternates` ve `LanguageSwitcher`.
- Ana sayfa, ürün katalog/detay, çözümler, kurumsal sayfalar, blok renderer (Faz 3; QA sürüyor).
- Birim testler lisans atama, erişim kuralları, şema/veri korunumu ve frontend sınırlarını kapsar.

## Kalanlar
- **Faz 7:** tamamlandı (aşağıdaki "Faz 7" bölümüne bakın).
- **Faz 8b:** gerçek seed içerik (5-20 ürün JSON), backup/deploy script'leri; import/MCP altyapısı Faz 8a'da tamamlandı.
- **Faz 9:** SEO, performans, erişilebilirlik (Lighthouse ≥ 90), e2e.

## Faz 4 — tamamlandı (2026-11-06)
- Destek merkezi, ürün/sürüm/OS filtreli public indirmeler, doküman ağacı/sidebar/detay/başlık listesi/önceki-sonraki, sürüm notları ve kategori/ürün SSS + güvenli FAQPage.
- `/ara` ↔ `/en/search`: Payload search indeksi, 2–120 karakter, sayfalama; yalnız güncel anonim kaynaklar. Ham indeks erişimi de taslak/silinmiş kayıtlara kapalı.
- Demo/teklif/iletişim/genel destek formları: CMS tanımı, idempotent TR/EN ensure betiği, ürün+SKU doğrulaması; progressive enhancement ve erişilebilir hata/odak/durum yönetimi.
- Zod uzunluk sınırları, honeypot, 5 deneme/10 dakika/IP bellek limiti, origin, Turnstile sunucu doğrulama, KVKK zorunlu. `form-submissions` public create kapalı.
- Bildirim kayıt sonrası; kullanıcı girdisi e-posta başlıklarına girmez. E-posta hatası başarılı kaydı bozmaz. SMTP yoksa konsol.
- paths, mesajlar, hreflang/alternates/breadcrumb/sitemap tamam. Şema değişikliği ve yeni migration yok.
- Payload 3.85 SQLite lokalize `count` uyumsuzluğu scoped slug doğrulamasında sınırlı `find` ile giderildi; regresyon testi eklendi.

## Eksik frontend rotaları
- Yok (portal Faz 6'da eklendi).

## Bilinen sorunlar / işletim girdileri
- Next 15.4.11: `(frontend)/[locale]` kök layout altında `notFound()` SSR'da `__next_error__` kabuğu döndürür; yerelleştirilmiş 404 RSC payload'dan istemcide görünür. HTTP testi status 404 + HTML/RSC içeriğini, `smoke.spec.ts` tarayıcıda görünür `<main>` 404'ü kontrol eder.
- Denenip sonuç vermeyenler: globalNotFound kapatma, sade layout, header/footer/error.tsx çıkarma, passthrough app/layout + app/not-found, OG dosyası taşıma. Page-builder fazında yeniden ele alınacak.
- Canlı SMTP ve Turnstile site/secret anahtarları gerekli; gerçek dış servis testi yapılmadı.
- `.env` canonical URL hâlâ `localhost:3100`; uygulama HTTP doğrulamaları `127.0.0.1:3100` üzerinden yapıldı. Mevcut localePrefix `always`: TR yolları `/tr` ile açılır, kök TR yolları yönlenir.
- Yasal metin onayı ve gerçek içerik Faz 7–8'de. Git commit yok.
- Faz 8a: content:import ve MCP eklendi; gerçek içerik/deploy Faz 8b'de.

## Karar evrimi
- **2026-11-06: Hibrit satış → tanıtım + teklif; lisans personel tarafından atanır.** Online ödeme tamamen iptal; müşteri portalı ve lisanslı indirmeler korunur.
- **Yerel port:** `localhost:3000` başka projeye ait olduğu için site `127.0.0.1:3100` üzerinde çalışır.
- **Migration:** DB push kapalı; her şema değişikliği `pnpm migrate:create` + `pnpm migrate` ile yapılır (düz `payload migrate:create` başarısız).
- **Media:** `protected` varsayılanı `true` (güvenli varsayılan); genel görseller açıkça `false` yapılır.
- **Müşteri ≠ panel kullanıcısı:** `customers.access.admin=false`; müşteri işlemleri sunucudan `overrideAccess: true` ile yapılır.
- **Lisans modeli:** yazılım içi aktivasyon API'si v1 dışı; model buna hazır tasarlandı.
- **Kapsam:** e-Fatura/e-Arşiv ve abonelik yenileme v1 dışı.
- **Ekip modeli:** `takim-lideri` skill'i; Opus lider kod yazmaz, yazan ≠ denetleyen kuralı.

## SQLite geçişi (2026-11-06)
- SQLite WAL/FULL, busy timeout 5000; Payload transaction etkin, libSQL yazma transaction `BEGIN IMMEDIATE`.
- Migration: `20261106_145404_initial_sqlite`, `20261106_150000_sqlite_integrity`.
- Tek VPS: systemd, host Caddy, Litestream; kalıcı veri `data/`, `uploads/`. Yerel port 3100.
- Karar evrimi: Postgres+Docker → SQLite+systemd (maliyet); henüz canlı veri yok.
- Doğrulama: 135 test geçti; tip ve lint geçti. Çalışan dev sürecini durdurma OS tarafından engellendi; build ve yeniden başlatma doğrulanamadı.

## Ödeme kaldırma (2026-11-06)
- Yeni migration `20261106_151826_remove_online_sales` uygulandı; eski migration dosyaları korundu.
- SKU teklif için kaldı; fiyat/vergi ve satın alınabilir alanlar, sipariş ilişkisi ve fatura adresi kaldırıldı.
- Lisans bildirim e-postası isteğe bağlı olduğu için eklenmedi; mevcut konsol SMTP fallback düzeltildi.

## Son doğrulama (2026-11-06)
- Faz 4 güvenlik QA: sahte IP başlıkları, Origin ve LIKE jokerleri düzeltildi; typecheck, lint ve 139 test geçti, HTTP kötü girdi kontrolleri yapıldı.
- `pnpm generate:types`, `pnpm typecheck`, `pnpm lint` başarılı. `pnpm test`: 13 dosya, 138 test geçti.
- HTTP: 20 TR/EN public sayfa isteği 200; geçersiz sorgular ve olmayan dinamik kaynaklar 404; sitemap 200.
- Geçici içerikle TR/EN doküman listesi/detayı, heading çapaları, hreflang, arama, filtreli indirmeler/sürüm notları/SSS doğrulandı. Taslak indeks ve lisanslı indirme adları gizli, lisanslı dosya 403, public dosya 200.
- Anonim form-submissions POST 403; native Server Action geçerli gönderimde tam bir kayıt oluşturdu ve başarı gösterdi, kayıt sonra silindi. TR/EN form etiketleri ve iki ensure çalıştırmasının aynı dört kimliği koruduğu doğrulandı.
- Geçici fixture/dosyalar temizlendi; kalıcı eklenen içerik yalnız yetkilendirilmiş dört form tanımı. Build/dev restart/commit yapılmadı; Makefile değişmedi.

## Faz 7 — tamamlandı (2026-11-06)
- i18n: tr/en anahtar ağaçları eşit; terminoloji tek sözlüğe çekildi (Teklif İste, Demo İste, Lisans, Destek, Hesabım); satın alma kalıntısı metni kaldırıldı; çoğul ICU kalıpları düzeltildi. Anahtar adları ve yer tutucular değişmedi.
- Yasal metinler `content/legal/{tr,en}/`: kvkk-aydinlatma, gizlilik-politikasi, cerez-politikasi, kullanim-kosullari, eula. TASLAK; hukuk danışmanı incelemesi zorunlu. Mesafeli satış/ön bilgilendirme gerekmediği notu eklendi (teyit bekliyor).
- README yeniden yazıldı (PostgreSQL/Docker kalıntısı kaldırıldı; komutlar Makefile ve package.json ile doğrulandı).
- Hukuk incelemesi bekleyen noktalar: Cloudflare Web Analytics etkinliği ve veri işleme yeri; Cloudflare yurt dışı aktarımı; saklama süreleri; yedek ve sunucu log süreleri; sorumluluk sınırı; yetkili mahkeme; EULA ile sözleşme önceliği; DPA ihtiyacı; VERBİS durumu.
- Build, commit ve kod değişikliği yapılmadı.

## Faz 6 — tamamlandı (2026-11-06)
- Yollar: giris/kayit/sifremi-unuttum/sifre-sifirla/dogrula, lisanslar, indirmeler, talepler(/yeni,/[id]), profil (EN: login, register, forgot-password, reset-password, verify, licenses, downloads, tickets, new, profile).
- Doğrulama: typecheck, lint, 170 test (portal.test.ts eklendi) geçti. HTTP: anonim yönlendirme, müşteri 16 sayfa 200, başkasının ticket'ı 404, staff/yanlış token reddi, lisanslı dosya yalnız sahibe 200. Chromium: giriş/çıkış, anahtar göster, talep açma/yanıt, profil, kayıt/doğrulama/sıfırlama; 1440 ve 390 ekran görüntüsü, taşma düzeltildi. Geçici veri silindi.
- Açık: KVKK onayı yalnız zorunlu kutu (kayıtta saklanmıyor, şema alanı yok); şifre değişiminde diğer oturumlar sonlanmaz; canlı SMTP/Turnstile test edilmedi (prod'da Turnstile yoksa kayıt/şifre-unuttum kapalı).
- 2026-11-06 Faz 6 güvenlik QA: KVKK/sessions açıkları, auth API/limit bypass, enumeration, doğrudan lisanssız talep, transaction/redirect/maske/tarih/header uçları düzeltildi; `20261106_161413_portal_security_consent` uygulandı; generate:types/typecheck/lint ve 18 dosya/223 test geçti; HTTP IDOR/CSRF/token replay/limit/onay/no-store doğrulandı, fixture'lar silindi; açık: dev REST authStrategies HMR kaydı exp/alg sıkılaştırması için sonraki normal süreç başlangıcını bekliyor, sandbox nedeniyle screenshot ve canlı SMTP/Turnstile doğrulanmadı; build/restart/commit yapılmadı.

## Faz 8a — içerik araçları (2026-11-06)
- JSON Schema/AJV + slug/SKU import, TR/EN ayrı yazım, bloklar, medya güvenli yolları, globals, docs.parent, ürün↔SSS ilişkileri; `--dry-run` ve transaction rollback.
- Seed yalnız 1 aile + 1 ürün + 1 sürüm. Gerçek DB ilk import 3 create; ikinci 0 create/3 update, kimlikler #1/#1/#1; kayıtlar bırakıldı. Yasal Markdown `--legal` ile import edilir; yerel taslaklar yalnız dry-run, izole test DB'sinde gerçek dönüşüm/yayın doğrulandı.
- MCP 3.85.1, `/api/mcp`, 16 içerik koleksiyonu + 3 global. Admin users API anahtarı; licenses create/find/update açık, delete kapalı. Customers/users/forms/submissions/ticket/messages/deneysel araçlar kapalı.
- Migration `20261106_164616_phase8a_content_mcp` uygulandı; önceki migration'lar değişmedi. API anahtarları admin alan erişimiyle korunur; editor rolüne geçiş anahtarı iptal eder.
- Analitik kararı: Umami Postgres gerektirdiği için Cloudflare Web Analytics; çerezsiz, analitik çerez bandı gerekmez. Token yoksa beacon yok; admin/portal hariç; otomatik SPA ölçümü kapalı.
- product.from/bestFor kullanım taraması boş; iki sözlükten kaldırıldı. TR önek bilgisi `/tr/...` olarak düzeltildi.
- Harici kaynak plan sandbox dışında salt okunur; güncel çalışma kopyası `docs/implementation-plan.md`.
- MCP taze Payload handler tools/list 200, 69 araç; anonim HTTP 401. Dev authStrategies HMR eski kaydı tuttuğu için geçerli anahtar HTTP 401; sonraki olağan süreç başlangıcı gerekli, restart yapılmadı.

- Faz 8a medya kimliği: `media.seedPath` unique; Payload dosya adını çakışma nedeniyle değiştirse de tekrar import aynı kaydı/dosyayı günceller. Migration `20261106_165449_phase8a_media_identity` uygulandı.

## Faz 8a son doğrulama
- `pnpm generate:types`, `pnpm typecheck`, `pnpm lint`, `pnpm test` geçti: 21 dosya / 259 test. `git diff --check` temiz.
- Gerçek ikinci import ve son tekrarlar: 0 create/3 update; aile/ürün/sürüm #1, TR/EN başlıklar ve FK kontrolü temiz. Geçici admin/MCP anahtarı silindi; users=0, pages=0; yalnız örnek katalog DB'de kaldı.
- `--dry-run --legal`: 5 legal sayfa planlandı, DB'ye yazılmadı. İzole SQLite'ta legal Markdown/locale/block/idempotency ve medya çakışma testi geçti. CLI hatalı ilişki denemesi exit 1 verdi, transaction aile kaydını da geri aldı.
- Build, dev restart ve commit yapılmadı. Canlı Cloudflare token yok; beacon sınırları SSR testinde doğrulandı. MCP dev HMR ve harici salt okunur kaynak plan sınırı yukarıda kayıtlı.

## İçerik import hata düzeltmeleri (2026-11-06)
- Dry-run yazmasız planlanmış referans tablosuyla yeni ürünlerin docs/releases sorgularını atlar; NaN/undefined/geçersiz DB kimliği sorguya ulaşmadan açık hata verir.
- Markdown→Lexical link/autolink URL izin listesi (http/https/mailto/tel/site içi göreli), tehlikeli linkleri metne çevirme ve ham HTML düğümlerini atma eklendi.
- CLI transaction sarmalı Payload beforeValidate aşamasında yeni dosya adlarını izler; hata/rollback durumunda yalnız yeni dosyaları siler, cleanup hatalarını raporlar. Kısmi dosya yazımı, rollback hatası, commit ve izole gerçek SQLite/medya regresyonları test edildi.
- `content/seed/01-globals.json`: lokalize olmayan şirket/iletişim değerleri TR/EN eşitlendi; schema.json gevşetilmedi.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` geçti (23 dosya/293 test). `pnpm content:import --dry-run`: 88 oluşturulacak/0 güncellenecek kayıt + 3 global; yazma yok. Gerçek yerel import/build/dev restart/commit yapılmadı.
- Seed uygulandı (2026-11-06): kök neden docs EN slug'ları ürün slug'ına eşitti (30-support.json düzeltildi) + 01-globals e-posta yer tutucuları geçersizdi; --dry-run artık gerçek yazma+ROLLBACK. Eski ornek-aile/ornek-urun/EXAMPLE-STANDARD silindi. make seed: 88 created/0 updated, 2. çalıştırma 0 created/88 updated; --legal 5 sayfa; HTTP TR/EN 200.

## Faz 9 — denetim düzeltmeleri ve doğrulama (2026-11-06)
- Kritik: Header sunucu çerez okuması kaldırıldı (herkese Hesabım); locale force-dynamic kaldırıldı. Ana sayfa/ürün-aile ve içerik detayları 3600 sn ISR; public koleksiyon/global hook'ları her iki locale layout'u ve sitemap'i invalidate eder; CLI/Next dışı bağlam güvenli.
- Kritik: locale error/loading ve provider bağımsız global-error; TR/EN tasarım tokenlarıyla. Loading'in örtük server getTranslations çağrısının bütün ağacı dinamikleştirmesi client çeviriyle önlendi.
- SEO: public origin kontrolü + production uyarısı, localhost yerine 127.0.0.1:3100 yerel fallback; x-default korunur. TR/EN next/og PNG ve OG/Twitter fallback; arama noindex/robots disallow ve sitemap dışında; tüm sitemap URL'lerinde lastmod; TechArticle JSON-LD.
- Performans/güvenlik: next/image + ölçüler/sizes/lazy, priority yalnız hero kullanımları; Payload medya URL'leri unoptimized (aynı URL'de izin değişebilir), optimizer yalnız /images/** kabul eder; /api/media/file optimizer isteği HTTP 400. Motion reveal IntersectionObserver/CSS ile değişti, reduced-motion ve JS'siz görünürlük korundu; optimizePackageImports eklendi.
- CSP Report-Only varsayılan; CSP_ENABLED/CSP_ENFORCE bayrakları, dinamik sayfalarda nonce + JSON-LD/next/script, admin ayrı relaxed politika, Turnstile/CF/video izinleri, Permissions-Policy ve COOP. Nonce + ISR Next'te birlikte desteklenmediğinden public ISR statik CSP; tüm frontend nonce uygulanmadı, teknik sınır kullanıcıya bildirildi.
- A11y: select/label ayrıldı, product/SKU hata mesajları aria-describedby ile bağlandı; skip hedefi scroll margin; mobil menü focus trap/Escape/dil geçişi testleri yazıldı. Tasarım ve Makefile değişmedi.
- Build `NEXT_DIST_DIR=.next-prod pnpm build` geçti. `●` ISR: /tr,/en; urunler/[family]/[product] ve aile; cozumler/haberler/referanslar/kariyer/yasal detayları; dokümantasyon ürün/detay; destek, şirket, referanslar/kariyer/partner listeleri, arama eski yönlendirmesi. `○`: robots; sitemap (1h). `ƒ`: query filtreli katalog/çözüm/haber/destek listeleri, arama/formlar, portal, OG, admin/API. Boş kariyer/referans detayları yeni public içerikte istekte ISR üretilebilir.
- Production HTTP (geçici 3101, sonra kapatıldı): ana sayfa HIT, s-maxage=3600; EN katalog/teklif/portal/destek 200; no-store; admin unsafe-eval yalnız ayrı politikada. `skipMiddlewareUrlNormalize=true`, Next 15'in numeric loopback → localhost EN rewrite döngüsünü çözdü. Dev 127.0.0.1:3100 durdurulmadı.
- Son kapılar: `pnpm typecheck`, `pnpm lint` geçti; `pnpm test` 25 dosya/310 test geçti. `pnpm test:e2e`: 3 HTTP geçti; 8 browser testi uygulama açılmadan macOS MachPort izni yüzünden başarısız. Chromium kurulumu tmp dizininde başarılı; UI/klavye/Lighthouse izinli hostta bekliyor. E2E artık build çalıştırmaz; .next-prod build ayrı yapılır.
- Content import betiği/kütüphanesine, .env'e ve yerel içerik verisine dokunulmadı; migration/commit yok. Açık: production domain, browser/Lighthouse doğrulaması; CSP Report-Only gözlemi sonrası enforce. Genel SMTP/Turnstile/yasal onay girdileri önceki bölümlerde.
# 2026-11-06 Faz 9 QA: kök 404 ve medya no-store düzeltildi; typecheck/lint/Vitest ve 3 HTTP testi geçti, Chromium MachPort engelli; production cache/invalidation ve protected medya canlı doğrulaması bekliyor.

## Çoklu kök layout 404 düzeltmesi (2026-11-07)
- `src/app/not-found.tsx` kök layout gerektirdiğinden production build ve dev route derlemesini bozuyordu. Bağımsız belge `global-not-found.tsx` olarak taşındı; Next 15.4 `experimental.globalNotFound` etkin (deneysel, çoklu root layout için resmi seçenek).
- Catch-all + notFound denemesi locale loading ile 200, loading olmadan curl HTML’de boş hata belgesi verdi; nihai çözüm catch-all içermez, mevcut locale loading/not-found korunur. `src/app/[locale]/opengraph-image.tsx` layout gerektirmeyen metadata handler’dır; mevcut düz URL için konumu korundu (frontend grubuna taşımak URL’ye hash eki getiriyor).
- Payload 3.85 statik dosya kontrolü, kayıt bulunmadığında erişim filtresini 403’e çeviriyordu. `mediaRead` yalnız statik isteklerde dosya kaydının yokluğunu 404 yapar; var olan medya erişim filtresi değişmez. Birim regresyonları anonim/customer/admin yokluk durumunu ve mevcut protected dosya filtresini kapsar.
- `pnpm typecheck`, `pnpm test` (27 dosya / 317 test), `NEXT_DIST_DIR=.next-prod pnpm build` başarılı (lint dahil). 3200’de curl: /tr/xyz, /en/xyz, /xyz → 404 + main içinde 404; /tr, /admin → 200; /api/media/file/yok → 404; TR/EN OG → 200 PNG.
- 3200’e özel geçici Playwright config ile 3 HTTP E2E geçti; 404/main beklentileri genişletildi, medya 404 eklendi. Origin kontrolü sabit 3100 yerine test baseURL origin’i ile tam eşitlik kullanır. Browser smoke uygulama açılmadan Chromium MachPort Permission denied (1100) nedeniyle engelli; görünürlük assertion’ı korunuyor.
- Geçici production sunucusu kapatıldı; 3100 dev, .env, DB/şema ve commit işlemlerine dokunulmadı.

- F2 + G (2026-11-07): animasyon sistemi (data-anim + tek MotionObserver, hero keyframe, token'lar) ve görsel düzeltmeler uygulandı. typecheck/lint/31 dosya 359 test geçti; prod build 3200'de Playwright: JS kapalı/reduced-motion'da gizli öğe 0, normalde kaydırma sonrası 0, CLS 0.000 (8 sayfa/genişlik), client nav yeniden tarıyor. Lighthouse mobil 100 (ilk koşu /tr TBT 274→13 ms), LCP ~1.05-1.2 s değişmedi. 3200 kapatıldı, commit yok.
- 2026-11-07 F7 denetimi: medya koruma/MIME kontrolleri kapalı varsayılan, duyuru gizleme kimliğe bağlı; route saldırı girdileri ve `_v` migration verisi regresyon testlerine eklendi. typecheck, lint, 516 test, izole build ve 3200 HTTP dumanı başarılı; canlı DB migration yok.
