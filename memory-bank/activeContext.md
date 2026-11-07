# Aktif Bağlam

- F1/F2/G denetimi (2026-11-07): yayınlı kayıt üzerine taslak kaydedildikten sonra unpublish cache temizliği atlanıyordu; `revalidate.ts` ana kayıt yayın durumunu before/afterChange arasında izler. Gerçek geçici SQLite testinde publish, ardışık taslak, unpublish, slug değişimi ve delete doğrulandı. `content.ts` seçenekleri ilkel cache anahtarlarına dönüştürür; eksik aile ilişkisi diğer sayaçları bozmaz. React cache render dışında kalıcı değildir; public sorgular anonim + draft:false kalır.
- MotionObserver gözlem/geri çağırım hatalarında görünürlüğü geri açar; pathname yanında query değişiminde de temizlenir (`Header` içinde Suspense). Portal dahil locale layout kapsamındadır. Hero aside yalnız translate; breadcrumb uzun ebeveynleri de erişilebilir metni koruyarak kısaltır. `safeHref` kodlanmış mailto yer tutucularını da reddeder; javascript/data zaten kapalı. Son QA: typecheck/lint/31 dosya 372 test ve `.next-prod` build geçti. 3200 `pnpm start`: istenen 6 rota 200, `/tr/olmayan` 404, SSR pending=0, Mono preload=0; süreç kapalı. 3100 ve `.next` sürecine müdahale yok; commit yok.
- QA komut notu: build ile typecheck eşzamanlı çalıştırılmaz (üretilen `.next-prod/types` dosyaları yenilenir). Doğrudan `node node_modules/next/dist/bin/next start`, pnpm shim'in NODE_PATH ayarını atladığından `libsql` bulamadı; repo/systemd'nin desteklenen `pnpm start` akışı geçti.

- F2 animasyon + G görsel turu (2026-11-07): `Reveal` silindi; `src/lib/anim.ts` (`anim(i)`, `heroIn`), `src/lib/motion.ts` (çekirdek), `components/ui/motion-observer.tsx` (tek IntersectionObserver, `Header` içinde bağlı; layout.tsx Terra'da olduğu için). Gizli durum yalnız JS ile `data-anim-state="pending"`; `html[data-motion="none"]` desteklenir (ayar alanı F7). Hero CSS keyframe (h1/lead yalnız translate). Header açık teması yalnız `/hesap`; tüm başlık sayfaları koyu hero. Tokenlar `globals.css` `:root` (--dur-*, --stagger). Lighthouse mobil 100, CLS 0, JS gzip ~192 KB değişmedi (motion paketi Terra). `docs/qa/visual-baseline.md` güncellendi.


- F0 tarayıcısız ölçüm kısmi (2026-11-07): `docs/perf/baseline.md`, `scripts/perf-isr.ts`; 144 sitemap URL iki GET, 122 HIT/HIT, 22 cache başlıksız, tümü 200. Üç izole build: biri `/500` prerender hatası, ikisi başarılı; doküman timeout tekrarlanmadı, kök neden doğrulanmadı. SQLite istek sayacı/testi ve sorgu ölçümü eksik. 3300 kapatıldı, 3100'e dokunulmadı.

- Güvenlik QA (2026-11-07): lisans e-postası HTTP yanıtı sonrası, bağımsız doğrulanmış kalıcı kayıt için gönderilir; SMTP yoksa anahtar konsola yazılmaz. İstek bağlamı dışındaki atamalarda bildirim zamanlanmaz. Uygulanmış `20261107_092304_remove_sales_legal_fields` üç eski ilişki değerini siler; down değerleri geri getirmez. Migration geçmişi değiştirilmedi.

Bu dosya oturumlar arası "şu an neredeyiz" bilgisini tutar. Değişince güncelle.

## Sıradaki büyük iş: page builder + animasyon/performans planı (2026-11-07)
- Next 15.4.11: `(frontend)/[locale]` altında `notFound()` SSR'da `__next_error__` kabuğu üretir; yerelleştirilmiş 404 istemcide RSC payload'dan görünür. HTTP testi status 404 + HTML/RSC içeriğini, `smoke.spec.ts` görünür `<main>` 404'ü kontrol eder.
- globalNotFound kapatma, sade layout, header/footer/error.tsx çıkarma, passthrough app/layout + app/not-found ve OG dosyası taşıma denendi, sonuç vermedi; page-builder fazında yeniden ele alınacak.
- Plan: `docs/plan-page-builder-animation.md` (taslak, kod yok). Ana sayfa `pages` kaydına (SiteSettings.homePage) taşınır; bloklara ortak `appearance` (tema/boşluk/hizalama/animasyon/anchor), yeni katalog/kanıt blokları, sistem sayfası bağlama, Live Preview + draft, globals tam düzenlenebilir.
- Performans: content.ts `cache()`, taslakta revalidation yok, tek IntersectionObserver (`Reveal` kaldırılır), kullanılmayan `motion` kaldırılır, Media `imageSizes`+webp srcset, Mono preload yok; bütçe LCP<2.0s/CLS<0.05/INP<200ms/LH≥90.
- Fazlar F0 (ölçüm + görsel QA) → F1/F2/F9 → F3 → F4/F5/F7 → F6 → F8 → F10 → F11; G = kullanıcı görsel hata listesi turu. 5 açık soru plan §11'de; kullanıcı yanıtı bekleniyor.

## Mevcut odak (2026-11-07, UX denetimi düzeltmeleri)
- UX denetimi 13 madde uygulandı: dil değiştirici (CMS alternates + `<link hreflang>` yedeği, `hreflangPath`), footer yasal linkleri (`kvkk-aydinlatma`, `gizlilik-politikasi`, EULA; seed + fallback + form/kayıt KVKK bağlantısı), header seed (Ürünler/Çözümler mega + Destek + Şirket + CTA; seed linkleri `type: external` + site içi yol çünkü internal link yalnız `reference` çözer), buton kontrastı kök neden `cn()` (twMerge `text-small`'u renk sanıp `text-accent-contrast`'ı siliyordu → `extendTailwindMerge`), ürün detayı tek kaynak (seed'den hero/featureGrid/specTable blokları çıkarıldı + sayfa bu blokları filtreler, ek bloklar özelliklerden sonra), form sürüm listesi (yalnız seçili ürünün sürümleri, SKU görünmez, ürün seçilmeden devre dışı; sunucu `selectionErrors` ile eşleşmeyen ürün/SKU'yu `invalid` döner), istemci doğrulaması (noValidate + satır içi hata + role=alert özeti), `[locale]/[...notFound]` catch-all → header/footer'lı 404 (arama + popüler linkler; global-not-found yalnız geçersiz locale için), favicon (`src/app/favicon.ico`, `icon.svg`, `apple-icon.png`; middleware matcher `/icon` rotasını yakaladığı için statik dosya), mobil 44px hedefler, ürün sekme çubuğu fade, JSON-LD `suppressHydrationWarning` (tarayıcı nonce özniteliğini boşaltır; CSP değişmedi), indirmeler OS etiketi yerelleştirildi + sürüm seçeneği ürün adı önekli.
- Scroll-reveal zaten ilerlemeli iyileştirmeydi (SSR'da opacity yok, reduced-motion'da kapalı); birim testle kilitlendi.
- Doğrulama: typecheck, lint, 29 dosya/345 Vitest, `NEXT_DIST_DIR=.next-prod pnpm build` geçti. Playwright (3100): dil değiştirici header/footer, 404 chrome, form sürüm filtresi + boş gönderim hataları, indirme filtreleri, mobil menü, hydration konsolu temiz. Seed importları (01-globals, 10-families-products) idempotent çalıştı. Commit yok, dev sunucuya dokunulmadı.
- Not: şu an tüm slug'lar TR=EN aynı; farklı slug'lı içerikle dil değiştirici yalnız birim testle (`hreflangPath`) doğrulandı.

## Önceki odak (2026-11-07)
- 404/güvenlik denetimi: statik medya varlık sorgusu erişim filtresiyle birleştirildi; erişilemeyen ve olmayan dosyalar 404. Geçici SQLite üzerinde gerçek sorgu ve 3200 izole prod HTTP doğrulandı. İki build'de doküman timeout tekrarlanmadı; kök neden doğrulanamadı.
- 404 düzeltmesi: layout’suz kök `not-found.tsx` → `global-not-found.tsx`; Next 15.4 `experimental.globalNotFound=true` (deneysel). Çoklu kök layout + dinamik locale için bağımsız HTML 404; catch-all gerekmez, locale loading/not-found ve OG handler konumu korundu.
- Statik medya isteklerinde kayıt yoksa `mediaRead` Payload NotFound (404) üretir; mevcut dosyalarda erişim filtresi korunur.
- Doğrulama (3200 geçici prod, kapatıldı): /tr/xyz, /en/xyz, /xyz → 404 + main içinde 404; /tr ve /admin → 200; /api/media/file/yok → 404; TR/EN OG → 200 PNG. Typecheck, 317 Vitest testi, izole .next-prod build ve 3 HTTP E2E geçti. Browser smoke macOS MachPort izni nedeniyle çalışamadı; görünürlük beklentisi korunuyor. 3100 dev sürecine dokunulmadı; commit yok.
- Faz 9 denetim düzeltmeleri uygulandı: çerezsiz Header, public ISR, CMS invalidation, hata/yükleme ekranları, SEO/OG/sitemap, CSP, next/image güvenlik sınırı, CSS reveal ve form erişilebilirliği. Mimari ayrıntılar `systemPatterns.md` Faz 9 bölümünde.
- Son doğrulama: typecheck/lint başarılı; Vitest 25 dosya/310 test geçti. `NEXT_DIST_DIR=.next-prod pnpm build` başarılı; manifestte 126 cached URL, ana sayfa TTL=3600, portal cache dışında. 3101 geçici production HTTP kontrolü: TR/EN 200, ISR HIT, form/portal no-store, ayrı admin CSP; geçici süreç kapatıldı.
- Playwright baseURL 127.0.0.1:3100: 3 HTTP testi geçti; 8 browser testi Chromium başlatılamadığı için başarısız. Chromium `/private/tmp/softmarket-playwright` altına kuruldu; macOS sandbox `MachPortRendezvous bootstrap_check_in Permission denied (1100)` veriyor. UI/klavye akışları yazıldı, tarayıcıda doğrulanmadı. Tekrar: `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/softmarket-playwright pnpm test:e2e` (izinli host gerekir).
- CSP varsayılan Report-Only; public ISR HTML statik politika, dinamik sayfalar nonce. NEXT_PUBLIC_SERVER_URL halen local; production domain verilmeden build/start açık SEO uyarısı verir. `.env`, Makefile, content-import kaynakları değiştirilmedi; şema/migration/commit/dev stop yok.
- Faz 8a QA: MCP yanıt derinliği sıfırla sınırlandı ve MCP dosya yolu kapatıldı; medya importunda 25 MiB sınırı ve bağlı medya dizini reddi eklendi. CLI artık bu çalıştırmada oluşturulan medya dosyalarını hata/rollback durumunda temizler.
- Faz 8a içerik import/MCP/Cloudflare Web Analytics uygulandı. `content/seed/schema.json`, minimal `example.json`; `pnpm content:import` (varsayılan seed), `--dry-run`, `--legal`; `make seed` önce ensure-forms çalıştırır.
- Gerçek DB iki import: 3 create → 0 create/3 update; aynı aile/ürün/sürüm #1, örnekler DB'de. Yasal taslaklar yerel DB'de yayınlanmadı; dönüşüm/yayın izole SQLite testinde doğrulandı.
- MCP `/api/mcp`, yalnız admin users API anahtarı; kurulum/izinler AGENTS.md. Yeni migration `20261106_164616_phase8a_content_mcp` uygulandı.
- Cloudflare token opsiyonel, çerezsiz; admin/portal dışı; SPA ölçümü kapalı. Harici salt okunur planın güncel repo kopyası `docs/implementation-plan.md`.
- MCP: taze handler 200/69 araç, anonim HTTP 401. Çalışan dev authStrategies HMR kaydı users API key stratejisini henüz içermediğinden geçerli anahtar HTTP 401; olağan sonraki süreç başlangıcını bekler (restart yasak).
- Faz 7 tamamlandı: i18n metinleri gözden geçirildi (tr/en anahtar ağacı eşit); README güncellendi; yasal metinler `content/legal/{tr,en}` altında TASLAK. Hukuk incelemesi bekleniyor; yayın öncesi zorunlu.
- Faz 6 tamamlandı: müşteri portalı `/hesap` ↔ `/en/account` (giriş/kayıt/şifre/doğrulama, özet, lisanslar, indirmeler, talepler, profil).
- Faz 4 tamamlandı: destek merkezi, arama ve güvenli demo/teklif/iletişim/destek formları.
- Online ödeme yok: tanıtım + teklif/demo talebi.
- Lisans modülü ve müşteri portalı hedefi korunuyor; atama yetkili yönetici panel/API/MCP üzerinden.

## Son değişiklikler
- İçerik import hata düzeltmeleri: dry-run planlanmış ilişki tablosuyla docs/releases sorgularını atlar; geçersiz DB kimlikleri açık hatayla reddedilir. Yazmasız dry-run korundu; rollback sırasında yeni medya dosyaları temizlenir, mevcut dosyalar silinmez.
- Markdown dönüşümü sonrası link/autolink URL izin listesi uygulanır; ham HTML metin olarak kalır, HTML düğümleri atılır. `01-globals.json` ortak şirket/iletişim alanları eşitlendi; şema değişmedi.
- Son kontrol: typecheck/lint geçti; Vitest 23 dosya/293 test geçti. Dry-run 88 create/0 update ve 3 global güncellemesi planladı. Gerçek yerel import/build/restart/commit yapılmadı.
- `/destek` altındaki indirme, dokümantasyon (ürün/ağaç/detay), sürüm notları, SSS ve talep sayfaları TR/EN açıldı; bilgi alanları açık tema.
- `/ara` ↔ `/en/search`, header bağlantısı, query sınırları ve sayfalama; eski `/arama` yönlenir. Arama indeksi anonim erişimde kaynak yayınıyla sınırlandırılır.
- Formlar `scripts/ensure-forms.ts` / `pnpm ensure-forms` ile idempotent oluşturuldu; `softmarket-{demo,quote,contact,support}` başlıkları sabit kimliktir. TR/EN etiketler doğrulandı.
- Zod, honeypot, IP limiti, origin kontrolü, Turnstile Siteverify ve zorunlu KVKK; `form-submissions.create = nobody`, yalnız sunucu aksiyonu `overrideAccess:true` ile yazar.
- Bildirim kayıt sonrası gönderilir; başlıklar sunucuya ait, SMTP/e-posta hatası kaydı bozmaz. `FORM_NOTIFICATION_EMAIL` isteğe bağlı; yoksa site iletişim adresleri/konsol.
- Doküman alternates/hreflang, breadcrumb, FAQPage ve sitemap tamamlandı. SQLite lokalize slug tekillik kontrolü `count` yerine sınırlı `find` kullanır (Payload 3.85 locale aktarım hatası).
- Şema/migration eklenmedi; `/hesap`, Makefile ve dev süreç değiştirilmedi.
- Ödeme API/kütüphaneleri, sipariş koleksiyonu, fiyatlar ve satın alma yolları kaldırıldı.
- SKU teklif formunda dilden bağımsız sürüm kimliği olarak korundu.
- Müşterinin firma/vergi/telefonu kaldı; fatura adresi kaldırıldı.
- Lisans create anahtarı sunucuda otomatik; abonelik süresi ve admin-only yazma erişimi korundu.
- SMTP host boş/yer tutucu ise Payload konsol adaptörü.
- Migration `20261106_151826_remove_online_sales` uygulandı; yerel DB yedeği `/private/tmp/softmarket-before-sales-removal-pfstb8pj.db`.

## Sonraki adımlar
1. İzinli hostta Chromium UI/klavye e2e ve Lighthouse; production domain + CSP Report-Only gözlemi sonrası enforce. Faz 8b backup/deploy.

## Aktif kararlar
- Satış: tanıtım + teklif; tüm sürümlerde Teklif İste.
- Yerel adres `http://127.0.0.1:3100`; veri değişikliği yalnız migration.
- Dev sunucu durdurulmaz; build yalnız `NEXT_DIST_DIR=.next-prod pnpm build` ile izole edilir. Commit yalnız açık istekle.
- Karar kaydı: `progress.md` içindeki Karar evrimi.

## Desenler ve tercihler
- Yazan ≠ denetleyen. Her fazda çapraz QA.
- Ajan çıktıları büyükse `ctx_*` araçlarıyla işlenir; ham çıktı bağlama alınmaz.
- Kullanıcı SQLite ile uğraşmak istemez: migration ve seed otomatik çalışmalı.
- Kod değişikliklerinde yalnız ilgili dosyalara dokunulur; mevcut yorumlar silinmez.
- Güvenlik: müşteri asla `licenses` yazmaz; sunucu işlemleri `overrideAccess: true` ile yapar.

## Öğrenilenler
- Varsayılan `pnpm build` çalışan `.next` çıktısını bozar; dev açıkken `NEXT_DIST_DIR=.next-prod` zorunlu.
- Codex sandbox'ında DB/HTTP için `network_access=true` gerekir.
- Media `protected` varsayılanı `true`; genel görsel yüklerken `false` ayarla.
- `localhost:3000` başka projeye ait; her zaman `127.0.0.1:3100`.

## Açık sorular / bekleyen girdiler
- SMTP sunucu bilgileri.
- Yasal metinler için hukuki onay.
- Ürün ve sürüm verileri (seed için gerçek ürün bilgisi; 5-20 örnek ürün).

## SQLite geçişi (2026-11-06)
- SQLite WAL/FULL, busy timeout 5000; Payload transaction etkin, libSQL yazma transaction `BEGIN IMMEDIATE`.
- Migration: `20261106_145404_initial_sqlite`, `20261106_150000_sqlite_integrity`.
- Tek VPS: systemd, host Caddy, Litestream; kalıcı veri `data/`, `uploads/`. Yerel port 3100.

## Son doğrulama (2026-11-06)
- Faz 4 QA: proxy başlığı kimlik doğrulaması, ortak yedek limit, zorunlu Origin ve arama LIKE joker reddi eklendi; Caddy ile uygulamaya aynı `FORM_PROXY_SECRET` sağlanmalı.
- `pnpm generate:types`, `pnpm typecheck`, `pnpm lint` başarılı; `pnpm test`: 13 dosya, 138 test geçti.
- HTTP (127.0.0.1:3100): 20 TR/EN merkez/liste/arama/form isteği 200; geçersiz sorgular ve olmayan ürün/dokümanlar 404. Geçici içerikle TR/EN ürün doküman listesi ve detayları 200; alternates ve başlık çapaları doğrulandı.
- Anonim search API taslak indeksini gizledi; lisanslı indirme adı sayfada yok, dosyası 403; public dosya 200. Doğrudan anonim form-submissions POST 403.
- Native multipart Server Action: gerçek geçerli gönderim tek kayıt oluşturdu ve başarı mesajı gösterdi; test kaydı silindi. Honeypot ve başarısız e-posta sınırları ayrıca test edildi.
- `pnpm ensure-forms` iki kez çalıştı, aynı dört kimlik korundu. Geçici içerik/dosyalar temizlendi. Build, yeniden başlatma ve commit yapılmadı.
- Canlı Turnstile/SMTP kimlik bilgileriyle dış servis testi yapılmadı; production Turnstile yapılandırılmadığında gönderim kapalıdır.
- Yerel `.env` canonical URL değeri hâlâ `localhost:3100`; HTTP testleri yalnız `127.0.0.1:3100` kullandı. Form origin kontrolü canonical URL yerine mevcut hostu doğrular; `.env` değiştirilmedi.

## Faz 6 portal kararları (2026-11-06)
- Oturum çerezi Payload'ın `payload-token`'ından ayrı: `sm_customer` (prod `__Host-sm_customer`), HttpOnly/Lax, prod Secure/Path=/. Strateji HS256/imza, zorunlu exp/customer/id/sid ve canlı Payload session kontrolü yapar. Portal güncel stratejiyi doğrudan çağırır; admin token'ı portalı açmaz.
- Koruma: `(portal)/layout.tsx` + her sayfada `requireCustomer`; middleware yalnız `/hesap|/account` için `x-sm-path` başlığı ekler; `next` -> `sanitizeNext` (yalnız site içi `/hesap/*`).
- Tüm veri `user: customer, overrideAccess:false`; talep/mesaj ve metadata tek transaction içinde yazılır. Metadata yalnız sahiplik doğrulandıktan sonra aynı transaction'da `user:null, overrideAccess:true` ile yazılır. Talep koleksiyonu da ürün lisansını kontrol eder.
- Tam lisans anahtarı sayfada yok; Server Action ile tek tıkla (sahip kontrolü). Kayıt/şifre sıfırlama kullanıcı sayılamaz yanıt verir. Profil izin listesi: name, company, phone, taxNumber.
- Müşteri kayıt/giriş/şifre işlemleri doğrulanmış Server Action üzerinden; ham REST/GraphQL login/forgot/reset kapalı. Müşterinin doğrudan güncelleyebileceği alanlar da profil izin listesiyle sınırlı. Şifre değişimi/sıfırlama aynı DB yazısında eski session'ları temizler; çıkış revocation hatasını başarı saymaz.
- `kvkkConsentAt`/`kvkkConsentVersion` yalnız doğrulanmış kayıt hook'unda sunucu tarafından yazılır; yeni migration `20261106_161413_portal_security_consent` uygulandı. Mevcut hesaplara geriye dönük onay üretilmedi.
- IP bulunamadığında ortak limit; FORM_PROXY_SECRET ile doğrulanmış IP ve hesap limitleri birlikte çalışır. Enumeration için eş KDF işi + 800–900 ms taban süre; SMTP `after` ile yanıttan sonra çalışır.
- Portal sayfaları noindex/no-store; header yalnız `signedIn` boolean'ı geçirir. Portal/destek header'ının kaydırılmadan önceki açık zemin rengi düzeltildi.

## Faz 6 güvenlik QA (2026-11-06)
- `pnpm generate:types`, `pnpm typecheck`, `pnpm lint`, `pnpm test` geçti: 18 dosya/223 test. HTTP: IDOR, lisanslı dosya, profil enjeksiyonu, CSRF, yönlendirme, çıkış/şifre değişimi/sıfırlama token replay, KVKK ve rate limit doğrulandı. Taze hesap yanıt süreleri yaklaşık 0,83–0,93 s aralığında örtüştü; istatistiksel sabit süre garantisi değildir.
- Tüm geçici customer/staff/ürün/sürüm/lisans/talep/mesaj/medya/search fixture'ları ve test betikleri temizlendi; FK kontrolü temiz. Build/dev restart/commit yapılmadı.
- Payload 3.85 HMR, `authStrategies` kaydını yenilemiyor: portalda yeni exp/alg kuralları HTTP ile aktif; çalışan dev REST kaydı, sunucu sırrıyla özel imzalanmış exp'siz/HS512 test token'larını halen kabul etti. Yeni stratejinin REST'te devreye girmesi olağan sonraki süreç başlangıcını bekliyor; restart talimat gereği yapılmadı.
- Chromium kurulu fakat sandbox MachPort izni başlatmayı engelledi; uygulama içi browser host da erişilemiyor. Header HTTP markup ve SSR regresyon testleri geçti; ekran görüntüsü doğrulanmadı. Canlı SMTP/Turnstile test edilmedi.

- Faz 8a medya kimliği: `media.seedPath` unique; Payload dosya adını çakışma nedeniyle değiştirse de tekrar import aynı kaydı/dosyayı günceller. Migration `20261106_165449_phase8a_media_identity` uygulandı.

## Faz 8a son doğrulama
- `pnpm generate:types`, `pnpm typecheck`, `pnpm lint`, `pnpm test` geçti: 21 dosya / 259 test. `git diff --check` temiz.
- Gerçek ikinci import ve son tekrarlar: 0 create/3 update; aile/ürün/sürüm #1, TR/EN başlıklar ve FK kontrolü temiz. Geçici admin/MCP anahtarı silindi; users=0, pages=0; yalnız örnek katalog DB'de kaldı.
- `--dry-run --legal`: 5 legal sayfa planlandı, DB'ye yazılmadı. İzole SQLite'ta legal Markdown/locale/block/idempotency ve medya çakışma testi geçti. CLI hatalı ilişki denemesi exit 1 verdi, transaction aile kaydını da geri aldı.
- Build, dev restart ve commit yapılmadı. Canlı Cloudflare token yok; beacon sınırları SSR testinde doğrulandı. MCP dev HMR ve harici salt okunur kaynak plan sınırı yukarıda kayıtlı.
