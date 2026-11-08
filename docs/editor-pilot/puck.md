# V3a — Puck pilotu raporu (2026-11-08)

Dal `pilot/puck` (main `fc22469`). Sayısal sonuçlar: `docs/editor-pilot/puck-metrics.json`. Pilot kodu atılabilir kalitededir (plan §V3a, "Pilot ortak kuralları").

## Ne yapıldı

- **Bağımlılık:** `@puckeditor/core` **0.24.0** (tam sürüm; MIT; peer `react ^18 || ^19`; React 19.2.6 / Next 15.4.11 ile build ve çalışma doğrulandı). Paket `exports` içinde `react-server` koşulu var; editör yalnız client bileşende kullanılır. Puck CSS olarak `no-external.css` (rsms.me font isteği yok, CSP temiz).
- **Admin:** `products` belge ekranında **"Görsel düzenle"** sekmesi (`src/admin/views/visual-puck.tsx`, Payload edit view; `Products.ts`'e tek satır, import map yeniden üretildi). Sekme, tam ekran editör rotasına gider: `/admin/visual-puck/<collection>/<id>`.
- **Editör rotası:** `src/app/(puck)/` kendi root layout'u (site `globals.css` + Geist). `/admin` altında olduğu için locale middleware'i atlar; `(frontend)` ağacıyla ortak dosya yok. Sunucu yükleyicisi `src/editor/puck/load.ts`: yalnız `users` admin/editor; anonim → `/admin/login?redirect=…`, customer ve desteklenmeyen koleksiyon → 404. Okumalar staff kullanıcıyla, `overrideAccess:false`, `draft:true`, `fallbackLocale:false`. Rota `products` ve `pages` için çalışır (sekme yalnız `products`'ta; ana sayfa ölçümü için `pages/6` URL'den açılır).
- **Adaptör** `src/editor/puck/adapter.ts` (saf): `payloadToPuck(layout, locale)` / `puckToPayload(data)`, `blockType ↔ type`, `id ↔ props.id`; diğer tüm anahtarlar (gösterilmeyen alanlar, `blockName`, satır id'leri, Lexical JSON) `props` içinde aynen taşınır. Ürün uyumluluk modu: editör 8 bağlı bölümü somutlaştırır (`materializeProductLayout`); kullanıcı dokunmazsa kayıtta geri çıkarılır (`compactProductLayout`) → layout uyumluluk modunda kalır, round-trip 0 fark. Opak `puckData` saklanmaz.
- **Alan üretimi** `schema.ts` (sunucu, Payload `Block.fields` → serileştirilebilir şema) + `config.tsx` (client, şema → Puck alanları): text/textarea/number/select/radio/checkbox(radio Evet/Hayır)/group(object)/array. `row`/`collapsible`/adsız `tabs` düzleştirilir; Görünüm ve **Hareket** grupları kendi panelleriyle gelir (preset/tetikleyici/süre/gecikme/easing/stagger/mobil düzenlenebilir). upload/relationship/richText/hasMany: **salt okunur kart** (özet + "Payload formunda düzenlenir"), değer birebir geçer; Lexical asla dönüştürülmez. Lokalize alan etiketlerinde dil işareti (`Başlık · TR`). Inline (canvas üstünde) düzenleme yalnız üst düzey düz metinlerde (`heading`, `subheading`, `eyebrow`, `intro`, `body`, `quote`, `panelTitle`).
- **V2 kuralları:** `productEditions` (Teklif İste) için Puck `permissions.delete=false` (sil düğmesi yok, otomasyonda 0 düğme) ve çoğaltma kapalı; bağlı bloklar çoğaltılamaz. Kayıttan önce istemcide `validateProductLayout(normalizeProductLayout())`; sunucu doğrulaması (beforeValidate/beforeChange) yine çalışır (EN'de zorunlu başlık eksikken yayın 400 → hata panelde `layout.6.heading: Bu alan gereklidir.` biçiminde gösterilir).
- **Kayıt** `editor.tsx`: Payload REST + staff çerezi. Otomatik kayıt 2 sn (`?draft=true&autosave=true`), "Taslak kaydet" (`?draft=true`, `_status:draft`), "Yayınla" (`_status:published`). Dil değişiminde önce mevcut dil kaydedilir, diğer dil `fallback-locale=none` ile sunucudan yeniden okunur (yapı ortak, metin dile özel). Kaydedilmemiş değişiklikte `beforeunload` uyarısı. Üst çubuk: TR/EN, 390/768/1440 (Puck viewport), geri al/yinele (Puck), Taslak kaydet, Önizle (mevcut `/api/preview` staff draft modu), Yayınla, Kapat. Puck UI dizesi Türkçe (`dictionary`).
- **Canvas** `canvas.tsx`: yayın blokları sunucu bileşeni olduğu için client-safe benzerleri yazıldı; aynı ilkel bileşenler ve sınıflar (`BlockShell`, `Section`, `Heading`, `FeatureGrid`, `SpecTable`, `Badge`, `buttonVariants`) ve aynı render planı (`planBlocks` → görünüm + hareket çözümü). Ürün bölümleri düzenlenen ürünün verisinden (başlık, özet, özellikler, teknik özellikler, sürümler, indirmeler) çizilir. Canlı veri blokları yer tutucu kart. Gizli blok soluk + rozet, varsayılan dışı hareket "Hareket: Yukarı kayma · yavaş" rozeti. Canvas `data-motion="none"` (düzenlerken içerik kaymaz).

## Kapılar (V4)

| Kapı | Sonuç | Kanıt |
|---|---|---|
| Veri round-trip (ürün + ana sayfa, TR/EN, 0 fark) | **Geçti** | `tests/unit/puck-roundtrip-db.test.ts`: fixture ürün/sayfa + `PUCK_PILOT_DB=<kopya>` ile kopyadaki **8 ürün + 15 sayfa** (temiz kopya ve düzenlenmiş kopya) → 0 fark. UI: Playwright `products/1` ve `pages/6` Taslak kaydet TR+EN → REST layout birebir |
| Lexical korunumu | **Geçti** | richText, tabs, faq cevapları, systemRequirements node JSON birebir |
| TR/EN | **Geçti** (0 sızıntı) | EN başlık değişti → TR aynı; EN boş `body` boş kaldı; blok id/sıra iki dilde ortak |
| Public bundle | **Geçti** | `.next-pilot-puck`: 48 public entry / 65 chunk'ta Puck izi 0 (`client-bundle-guard` genişletildi: kaynak + build kuralı). `/tr` JS aktarımı **124,6 KB** (≤ 130), ürün sayfası 124,8 KB |
| Güvenlik | **Geçti** | anonim 307 → login; customer 404 (loader testi `forbidden`); staff 200 + `private, no-store` + `X-Frame-Options: SAMEORIGIN`; başka koleksiyon 404. postMessage köprüsü yok (Puck aynı belgede). Mevcut preview testleri yeşil |
| MCP/import | **Kaldı** | Editör yayını sonrası MCP `findProducts` çalıştı; fakat kompozisyon sonrası `content:import --dry-run` reddediliyor. Plan V4 "Hatasız" şartı koyuyor; editörden bağımsız olması bu zorunlu kapıyı geçirmez. Ayrıntı ve yeniden doğrulama aşağıda. |

## Ölçümler

- **Canvas'ta gerçek görünüm:** blok tipine göre **23/29 (%79)**. Gerçek: hero, featureGrid, mediaText, specTable, stats, logoWall (elle logo), cta, faq (satır içi), richText, videoEmbed (kapak), media, testimonial, tabs (ilk sekme), spacer, divider + 8 bağlı ürün bölümü. Yer tutucu: productFamilies, productShowcase, solutionsGrid, caseStudy, newsList, listing (+ koleksiyondan gelen logoWall/faq). Ürün sayfasında 10/10 (%100), ana sayfada 2/7 (%29; hero'nun aile paneli de yer tutucu).
- **Editör açılış (prod, 3510):** ürün 465–483 ms, ana sayfa 196 ms (iframe + ilk blok görünene kadar). Dev ilk açılış 1,4 sn.
- **Bundle:** editör rotası Next raporu 195 KB sayfa / 315 KB first load; yalnız editöre ait JS gzip 208 KB + CSS 14 KB. Public sayfalarda değişiklik yok.
- **Bağımlılık:** 1 doğrudan, lockfile'a **60 paket** (dnd-kit 0.4.0 ×7, tiptap ×22, prosemirror ×13, happy-dom, zustand, tanstack virtual…), core 2,9 MB. Puck 0.x; 0.24.0 2026-10-29'da yayımlandı, sürüm temposu yüksek (sık canary). Payload iç API importu: `useDocumentInfo`, `useAuth` (2, public `@payloadcms/ui`). Fork gerekmedi.
- **8 görev (Playwright otomasyonu, prod, ürün 2; insan düşünme süresi yok):** T1 CTA ekle 1,8 sn ✓ (soldan canvas'a sürükle) · T2 Sürümler'i Özellikler'in üstüne 3,4 sn ✓ (Ana hat panelinde sürükle) · T3 İndirmeler'i sil 0,5 sn ✓ (Sürümler'de sil düğmesi yok) · T4 başlığı yerinde düzenle 0,8 sn ✓ · T5 "Yukarı kayma" + "Yavaş (800 ms)" 0,4 sn ✓ · T6 EN'e geç + çevir 3,3 sn ✓ · T7 390/1440 1,5 sn ✓ · T8 yayınla 0,2 sn ✓. Yayın sonrası `/tr/urunler/…/talep-masasi` yeni sırayı, `slide-up`/yavaş CTA'yı ve Teklif İste bağlantılarını çizdi. V4 puanı için kullanıcının kendi denemesi esastır.
- Doğrulama: typecheck, lint temiz; `pnpm test --maxWorkers=1` 68 dosya / 1029 test (1 atlanan = yalnız `PUCK_PILOT_DB` ile koşan kopya testi; ayrıca temiz ve düzenlenmiş kopyada 7/7). Worktree'de git dışı boş `content/seed/media` klasörü gerekir (content-import testi). `NEXT_DIST_DIR=.next-pilot-puck pnpm build` başarılı.
- Ekran görüntüleri: scratchpad `puck/*.png` (open, T1–T8, T7-390, rt-pages-6).

## Bilinen sorunlar / sınırlar

1. Medya ve ilişki seçimi editörde yok (salt okunur kart; Payload formunda yapılır). Zengin metin canvas'ta Lexical JSX ile gösterilir ama yalnız Payload formunda düzenlenir.
2. Payload `admin.condition` değerlendirilmez: koşullu alanların hepsi görünür (ör. bağlantı grubunda `reference/route/url` birlikte).
3. Canlı veri blokları yer tutucu; gerçek görünüm için "Önizle" (Live Preview/draft) kullanılır. Staff-only blok önizleme uç noktası denenmedi.
4. Ürün sayfası kompozisyon moduna geçince seed `content:import` o ürün için reddediyor (yukarıda; V2 kuralı).
5. Ürün hero'su her zaman ilk: Ana hat'ta başka yere sürüklenirse kayıtta sunucu başa alır (canvas yeniden yüklenene kadar eski sırada görünür). Bağlı bölümler katalogda kalır; ikinci kez eklenirse kayıt hata mesajıyla reddedilir (palette gizleme yok).
6. Dil değişimi bir kayıt + yeniden yükleme demektir; geri al geçmişi dil değişiminde sıfırlanır.
7. Yeni dizi satırlarının id'si ilk kayıtta sunucuda üretilir; aynı oturumda tekrar kayıtta yenisi üretilir (o satırın diğer dilde verisi henüz olmadığı için kayıp yok, ama V5'te istemci id'si verilmeli).
8. Eşzamanlılık (belge kilidi, MCP yazımıyla çakışma) pilot kapsamı dışında.
9. `scripts/perf-lighthouse.mjs` bu makinede Chrome bulamadı; JS ağırlığı Playwright ile (sıkıştırılmış aktarım) ölçüldü.

## V5 efor tahmini (Puck seçilirse)

**≈ 12 iş günü (10–15)**: medya/ilişki Payload drawer köprüsü 2 · Lexical yan panel (Payload RichText alanını çekmecede çalıştırma) 2–3 · `admin.condition` karşılığı (`resolveFields`) 1 · canlı veri blokları için staff-only önizleme parçası 2 · `pages` + ikinci dalga koleksiyonlar, sekme kaydı 1 · eşzamanlılık/kilit + autosave kuyruğu 1 · klavye ile taşıma, erişilebilirlik, rehber turu 1 · seed/import kompozisyon kararı 0,5 · e2e (8 görev), bundle/güvenlik testleri 1,5. Risk: Puck 0.x sürüm temposu (sabitleme + her yükseltmede editör e2e'si), iki ayrı render ağacı (yayın RSC + canvas client benzeri) bakım maliyeti.

## Dosyalar

`src/editor/puck/{adapter.ts,schema.ts,config.tsx,canvas.tsx,editor.tsx,load.ts}`, `src/app/(puck)/layout.tsx`, `src/app/(puck)/admin/visual-puck/[collection]/[id]/page.tsx`, `src/admin/views/visual-puck.tsx`, `src/collections/Products.ts` (tek satır), `src/app/(payload)/admin/importMap.js`, `tests/unit/puck-roundtrip-db.test.ts`, `tests/unit/client-bundle-guard.test.ts`. `git diff main -- src/migrations src/blocks src/fields src/collections` = yalnız Products.ts'teki tek satır.

## Bağımsız güvenlik/kalite denetimi — GPT, 2026-11-08

Kapsam: `main fc22469..370c9df`. Şema/migration değiştirilmedi. 3510 ve ana repo/3100 korunuyor; aşağıdaki production doğrulaması ayrı SQLite backup + uploads ile `.next-pilot-puck-qa`, 3511 üzerinde yapıldı. Üstteki görev süreleri ve UI ölçümleri ilk pilotun tarihsel sonuçlarıdır; bu denetimde tekrar ölçülmedi.

### Bulgular ve düzeltmeler

- **P0:** saptanmadı.
- **P1 — paralel kayıtların birbirini ezmesi** (`src/editor/puck/editor.tsx:87`): `await inflight.current` üzerinde bekleyen iki çağrı aynı anda devam ediyordu. Kontrollü yanıt testinde ilk yanıt sonrası hem B hem C PATCH'i birlikte başladı. Kuyruk kuyruğu çağrı anında rezerve ediliyor; taslak/yayın/autosave aynı sıradan geçiyor.
- **P1 — eski autosave ile geri almanın/son düzenlemenin kaybolması** (`editor.tsx:132`, `editor.tsx:172`): kaydedilmiş değere geri dönünce eski zamanlayıcı iptal edilmiyordu; unmount sonrası da çalışıyordu. Zamanlayıcı her değişimde ve unmount'ta temizleniyor, sıradaki autosave en güncel değeri kullanıyor; bekleyen yazı varken yapılan undo da sonradan kaydediliyor.
- **P1 — dil geçişinde kayıp ve geç gelen yanıt yarışı** (`editor.tsx:142`, `editor.tsx:191`): kayıt/GET beklenirken düzenleme ve ikinci dil geçişi açıktı. Geçiş kilidi + `inert` ile geçiş tamamlanana kadar giriş durur; eski kayıtlar tamamlanır, yeni dil fallback olmadan okunur. Ağ/JSON hatasında eski dil korunur ve kilit açılır. Testler DOM'da mock Puck ile; gerçek iframe/klavye turu aşağıdaki sınıra tabidir.

P2/P3 ürün kodunda düzeltilmedi:

- **P2 — nested array çoğaltma kayıt yapamıyor** (`config.tsx:74`): Puck 0.24.0 `ArrayField.uniqifyItem` yalnız slot kimliklerini yeniler; Payload satır `id`'lerini kopyalar. Gerçek SQLite'ta iki aynı satır ID'siyle taslak kaydı `_locale` doğrulamasında 400 verir. İşlem atomik; TR/EN layout değişmez. Yeni satırda sunucu ID'sini istemciye geri almama da kimlik değişimine yol açar (üstteki sınır 7).
- **P2 — EN önizleme TR'yi açar** (`load.ts:128`): iki locale'in `previewPath` değeri `/tr…`; T6 sonrası EN önizlemesi çeviriyi doğrulamaz.
- **P2 — Lexical bağlantıları canvas'tan dışarı çıkar** (`canvas.tsx:78`): normal CTA'lar span olsa da `LexicalRichText` varsayılan link converter'ı gerçek `<a>` üretir ve projenin `safeHref` sınırını kullanmaz. Statik render'da `data:text/html,…` href'i korundu. React'in javascript URL koruması mevcut; çalışan stored XSS kanıtlanmadı. Link/autolink'i inert çizmek gerekir.
- **P2 — bozuk kimlik 500 verir** (`load.ts:67`): staff ile `/admin/visual-puck/products/not-a-number` production'da 500; geçersiz ID'yi 404'e çevirmek gerekir.
- **P3 — bundle guard kaynak kuralı eksik** (`tests/unit/client-bundle-guard.test.ts:63`): yalnız `from '…'` yakalar; dinamik `import()`, `require()` ve göreli yoldan transitif importlar kaynak kuralını aşabilir. Mevcut production chunk taramasında sızıntı saptanmadı.

### V4 itirazları ve yeniden ölçüm

| Kapı/iddia | Denetim sonucu |
|---|---|
| Round-trip / Lexical / TR–EN | Genişletilmiş adaptör testi: bilinmeyen alan, nested ID, Lexical, populated upload/relationship, appearance/motion, null/boş değerler korunuyor. Bağımsız backup'ta 8 ürün + 15 sayfa TR/EN değişmeden kayıt: 0 fark. Bu kanıt eşzamanlı UI kayıt hatalarını kapsamıyordu; P1'ler ayrıca 7 DOM testiyle doğrulandı. |
| Güvenlik | Gerçek production cookie oturumu: anonim 307, customer 404, editor/admin 200, başka koleksiyon 404; hepsi private/no-store + SAMEORIGIN. Gerçek REST handler: anonim/customer PATCH 403, editions silme draft/autosave 400. Hero sırası mevcut V2 sunucu hook'unda normalize edilir. Özel `overrideAccess` yazma yolu veya opak editor blob yok. |
| CSRF | Yeni kayıt endpoint'i yok; mevcut Payload PATCH kullanılıyor. Yabancı origin PATCH preflight yanıtında `Access-Control-Allow-Origin` yok. Payload config'teki CSRF listesi boş (ana dalda da aynı); bu ölçüm tarayıcı CORS engelini doğrular, sunucuda ayrıca Origin allowlist olduğu iddiası değildir. |
| Public bundle | QA build: 48 giriş / 65 JS chunk / Puck izi 0. HTTP gzip script gövdesi, modern tarayıcı için `nomodule` hariç: ana sayfa **122,6 KB**, ürün **122,9 KB** (ondalık KB). Manifest JS gzip toplamı **110,1 KB**; eski 107,6 değeri aynı yöntemle yeniden üretilemedi. Eşik ≤130 KB geçiyor. |
| MCP/import | **Kaldı.** Ayrı kopyada `content:import --dry-run`: `products:belge-rotasi`, `layout` hatası, exit 1. Plan değişmeden "koşullu geçti" denemez; V4 aday kabulü açık. MCP find bu turda yeniden çağrılmadı. |
| Canvas eşdeğerliği | 23/29 = %79,3, hedef %80'in altında; ana sayfa 2/7. "Gerçek" sınıflaması piksel eşdeğerliği kanıtı değildir (video kapak, tabs yalnız ilk panel). Bu ağırlıklı puan kriteridir, tek başına zorunlu kapı değildir. |
| UI/süre ölçümleri | Yeni production UI turu çalıştırılamadı: Chromium `MachPortRendezvousServer` Permission denied (1100). Önceki Playwright görev süreleri kullanıcı testi/memnuniyet puanı yerine geçmez. |

Kanıtlar: `/private/tmp/softmarket-puck-qa-el4vwpfl/` (`build.log`, `http.json`, `bundle.json`, `roundtrip.log`, `tests.log`, `bundle-guard.log`, `import.log`, `browser-error.log`). Ham kimlik bilgileri rapora/repoya eklenmedi.

Son komutlar: `pnpm typecheck`, `pnpm lint` temiz; `pnpm test --maxWorkers=1` **69 dosya / 1039 geçti, 1 atlandı**; DB backup ile ayrıca **10/10**; QA build ve bundle guard **54/54** geçti. 3511 kapatıldı (`ECONNREFUSED`), geçici build klasörü kaldırıldı. 3510 aynı PID 70299 ile çalışıyor; düzeltmeleri içeren build'e geçirilmedi. Commit isteği denendi ama `git add` ortak worktree Git dizininde `index.lock` oluşturamadı: sandbox `Operation not permitted`. Değişiklikler çalışma ağacında; commit mesajı: `fix: prevent lost edits in Puck pilot save lifecycle`.
