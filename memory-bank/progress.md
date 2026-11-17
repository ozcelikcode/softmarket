## Lisans API / güvenlik merkezi / hosting planı — 2026-11-17 (yalnız plan)

- Yazıldı: `docs/plan-licensing-security.md` (tehdit modeli, API sözleşmesi, veri modeli, L0–L11 fazları, ajan dağılımı, 6 açık soru) ve `docs/plan-hosting.md` (alt alan adı olur; Passenger paylaşımlı hosting koşullu/önerilmez). Kod, şema, migration, commit yok. Bulgu: `admin-actions.ts` lisans durumunu ham SQL ile değiştiriyor; durum günlüğü bu yollara da bağlanmalı (L3).

## Entegrasyon güvenlik denetimi — 2026-11-17

- Sır güncellemesinde eşzamanlı kayıp, kısa sır gösterimi, okunamayan SMTP'de sahte başarı, eksik şirket bilgisiyle satış açılması, hukuk özetinde satır sınırı ve migration down'da port/TLS kaybı düzeltildi. Typecheck/lint temiz, tam test 91 dosya/1531 test geçti; canlıya migration yapılmadı.

## Entegrasyon ayarları — 2026-11-17 (QA bekliyor, commit yok, canlıya uygulanmadı)

- Yeni versiyonsuz `integrations` global'i (admin; MCP yok): iyzico/Stripe test+canlı anahtarları, ortam (canlı ek onay), SMTP. Sırlar AES-256-GCM, anahtar `SOFTMARKET_SECRETS_KEY` (yoksa kayıt reddedilir; kaybolursa sırlar okunamaz). Write-only uç `POST /api/globals/integrations/secret`, test e-postası `/test-email`. Env tanımlıysa env kazanır.
- E-posta `softmarketEmailAdapter` her gönderimde env→panel ayarını okur. Yasal şirket yer tutucuları render anında dolar; `pages.legalReview` metne bağlı hukukçu onayı, `legalReady` onay ister. `site-settings.company.etbisNo` eklendi.
- Migration `20261117_092957_integrations_settings` (CREATE TABLE + 7 ADD COLUMN, korumalı down); kopyada doğrulandı. Test 91/1527, build OK. Ayrıntı `docs/plan-payments.md` "Entegrasyon ayarları kaydı".

## P6 güvenlik denetimi — 2026-11-17 (commit yok)

- Belirsiz iade kilidi süreyle açılmaz; gecikmiş sağlayıcı sonucu için tekrar iade yasak. Stripe/iyzico sunucu ve belirsiz yanıtları açık ret sayılmaz; iyzico iptal kaydı başarı/tutar/para birimiyle doğrulanır.
- Stripe iade/itiraz bildirimi sipariş kimliği henüz bağlanmadığında, iade bildirimi sağlayıcıda henüz doğrulanmadığında yeniden teslim için 500 döner. Regresyonlar `payments-p6*.test.ts`.
- Son kodla typecheck/lint temiz, tam test 89 dosya/1492 test geçti.
- İade e-postası en az bir kez teslimdir; SMTP ve işaret yazımı arasındaki kesintide tekrar olası. Kesin tek teslim sağlanmadı. İzole E2E betiği süreç grubu sonlandırdığı için bu denetimde çalıştırılmadı; sonda 404/sitemap testi eklendi.

## P6 yönetici işlemleri — 2026-11-17 (QA bekliyor, commit yok, şemasız)

- Sipariş yan paneli "Sipariş işlemleri": İade et / İptal et / Bildirimi yeniden gönder → `POST /api/orders/:id/{refund,cancel,resend-notifications}` (yalnız admin panel oturumu + aynı origin; anonim 401, editor/customer/API key/MCP 403). İade: önce `refundStatus()`, sipariş başına tek kilit (`payment-events` `admin-refund`), tek refund, tek transaction'da `refunded` + lisans `revoked`; belirsizde kör tekrar yok (`requiresReview`, reconcile yalnız okur). İade e-postası `notify.ts` tür `refund` (işaret `refund-notice` satırı). Stripe dispute → `suspended`; iyzico'da itiraz bildirimi yok. Operasyon: `docs/payments/operations.md`.
- `/yasal` static→dynamic 500 kök nedeni: capability'li derlemede yolu olmayan (boş `generateStaticParams`) rotalar ISR fallback kalıyordu, ilk runtime render `noStore` ile 500. Düzeltme: layout `commerceRenderBoundary()` + `contentStaticParams` sonda yolu (`__dynamic__`); E2E derlemede `dynamicRoutes` 0. Test 89/1488 (+1), e2e 29/29. Ayrıntı `docs/plan-payments.md` P6 kaydı.

## P5 checkout UI + portal siparişleri — 2026-11-16 (QA bekliyor, commit yok, şemasız)

- P5 QA: normal üretim derlemesinde loopback ödeme sağlayıcısı ortam değişkeniyle açılamaz; ayrı `SOFTMARKET_E2E_BUILD=1` derlemesi ve izole DB gerekir. E2E derlemesi dağıtılmamalıdır. Fatura verilerini içeren sözleşme kopyası editörden gizlendi; alıcı VKN görüntülemede maskelendi. Ortamı belirsiz CLI süreçleri de loopback sağlayıcıyı reddeder. Son QA: typecheck/lint temiz, 87 dosya/1462 test geçti; izole build başarılı, tarayıcılı E2E PID kısıtı nedeniyle çalıştırılmadı.
- `/hesap/satin-al/[sku]` (EN `checkout`), `/hesap/siparisler[/no]` (EN `orders`), `startCheckoutAction` + `createCheckoutOrder` (sunucuda fiyat/KDV, form jetonu idempotency, sözleşme kopyası SHA), CSP form-action yalnız checkout yolunda, `CHECKOUT_READY=true` (varsayılan kurulumda `open` kapalı; teklif modu HTML'i HEAD ile birebir). Callback 303 → göreli `/{dil}/hesap/siparisler?donus=1` → oturumdaki müşterinin son siparişi.
- P3 önbellek bulgusu düzeltildi: capability açıkken `getCommerceState` her render'ı dinamik yapar; build ortamında `PAYMENTS_ENABLED=true` gerekir (aksi halde ödeme kapalıya düşer). Izole e2e sahte iyzico (`scripts/e2e-fake-iyzico.ts`, port 3500): 28/28. Ayrıntı `docs/plan-payments.md` P5 kaydı.

## P4 bildirim denetimi — 2026-11-16 (commit yok)

- Reconcile gönderilemeyen/kilitli bildirimlerle dolu batch yüzünden hazır siparişleri atlamaz; yeni inceleme ve lisans ataması bildirim deneme bütçesini yeniler. Bildirim migration down teslim durumu varsa reddeder. İzole SQLite regresyonları eklendi; canlı DB ve 3100 sürecine dokunulmadı. Açık P2: reconcile pending/paid sorgularının sabit ilk sayfası, sürekli hatalı kayıtlarla dolarsa sonraki siparişler bekleyebilir. Güncel kapılar: typecheck/lint başarılı, tam test 85 dosya / 1407 test başarılı; commit edilebilir: hayır (açık P2).

## P4 bildirim kalıcılığı — 2026-11-16 (commit yok)

- `notify.ts`, `orders.notifications`, migration `20261116_175713_p4_order_notifications`; testler `payments-p4-db` (+7) ve `payments-p4n-db` (migration up/down). Canlı DB'ye uygulanmadı. Ayrıntı `docs/plan-payments.md` P4 kaydı.

## P4 bağımsız denetim — 2026-11-16 (commit yok)

- Callback yönlendirmesi, kapalı adaptör 404, doğrulanmamış sağlayıcı hatası ve koşullu iptal düzeltildi; CLI lisans e-postası ve kalıcı bildirim garantisi açık. Ayrıntı `docs/plan-payments.md` P4 kaydı.
- Kontroller: typecheck/lint geçti; ödeme paketi 16 dosya/439 test geçti, son P4 DB 18/18; tam paket 84 dosya, 1387 geçti/6 başarısız (`legal-draft.test.ts`, eşzamanlı P7 kapsamı). Commit edilebilir: hayır.

## P4 sağlayıcılar/webhook/fulfillment — 2026-11-16 (QA bekliyor, commit yok, şemasız)

- Rotalar `src/app/(payload)/api/payments/{iyzico/webhook,iyzico/callback,stripe/webhook}`, çekirdek `src/lib/payments/{body,runtime,events,sync,fulfill,reconcile,route}.ts`, e-posta `src/lib/email/order-{confirmation,review}.ts`, CLI `pnpm payments:reconcile`, `deploy/payments-reconcile.{service,timer}`. `checkoutReady` hâlâ false.
- Testler `tests/unit/payments-p4{,-db}.test.ts` (10 + 17): imza/boyut, tek lisans (tekrar + eşzamanlı webhook/callback), review, drain, retrieve hatası/busy → 500 + tekrar, callback, reconcile, e-posta, log PII taraması. Ayrıntı ve açıklar `docs/plan-payments.md` P4 uygulama kaydı.

## P3 bağımsız denetim — 2026-11-16 (commit yok)

- P1 kapandı: açık ödeme HTML/RSC'si ISR'dan env kapalıyken de HIT dönüyordu (production'da yeniden üretildi). Açık ödeme yüzeyleri `unstable_noStore`, teklif modu ISR; Next bailout content/DB catch dışında. Ödeme modu ISR HIT hedefi güvenlik için kaldırıldı.
- P2: aynı-origin mutlak/normalize yasal URL filtresi, hatalı fiyat girişinden sonra reset, hazırlık fiyat/KDV/sağlayıcı uyumu ve aktif sağlayıcı test/canlı/KARMA rozeti düzeltildi. Saf/SQLite ve gerçek React DOM regresyonları eklendi.
- Production render 6/6: açık fiyat; DB quote/env off fiyat yok, satış yasal 404. Anonim REST/GraphQL ve draft/staff sınırları doğrulandı. P3 sınırı: slug yeniden adlandırılırsa satış türü tanınmaz (`commerceLegal` sonraki faz). Ayrıntı `docs/plan-payments.md` P3 denetim kaydı.
- Son kapılar: typecheck/lint 0 hata, tam test 80 dosya/1339 test (296 sn), son kodla açık/quote iki build, production render 9/9, diff-check temiz. Build/scratchpad silindi, tsconfig geri alındı. Canlı DB, 3100, `.next`, techContext korunuyor; P3 commit edilebilir EVET.

## P3 mod kapısı ve görünürlük — 2026-11-16 (QA bekliyor, commit yok, şemasız, checkout yok)

- `getCommerceState` (env + site-settings.commerce + sağlayıcı/KDV; fail-closed, env yoksa DB'ye dokunmaz), `resolveProductActions`, `EditionCard` buy/quote, hero birincil eylem, fiyat biçimi (sunucu Intl, TR/EN), JSON-LD `offers`, yasal satış sayfası slug sabiti (footer/`/yasal` 404/sitemap), admin hazırlık `ui` alanı, ondalık fiyat girişi (`price-minor-field`), i18n mesajları. `checkoutReady=false`: "Satın al" devre dışı, checkout linki yok; P5 açar.
- Şema/migration yok (kopya DB `migrate:create` = "No schema changes detected"). Quote modunda ürün HTML'i P3 öncesiyle birebir aynı (dondurulmuş eski kart + build karşılaştırması). Testler: `tests/unit/payments-p3{,-render,-db}.test`. Ayrıntı `docs/plan-payments.md` P3 uygulama kaydı.
- Doğrulama: 78 dosya/1313 test yeşil; quote modunda DOM+JSON-LD HEAD ile birebir (21/21), ödeme modu kopya DB'de doğru, Lighthouse Perf 100/JS ~129,6 KB.
- Açık: `pages.commerceLegal` şema önerisi (onay bekliyor), `legalReady` P7'de `open`'a katılır, checkout P5.

## P2-S ödeme şeması + store — 2026-11-16 (QA bekliyor, commit yok, canlı DB'ye uygulanmadı)

- Migration `20261116_141401_p2_payments_commerce`: up yalnız 3 CREATE TABLE (`orders`, `orders_items`, `payment_events`) + 21 indeks + 20 ADD COLUMN (`editions` 5, `site_settings` 13, `payload_locked_documents_rels` 2). Elle güvenli down: satış/kilit satırı varsa reddeder, yoksa yalnız eklenenleri kaldırır (rebuild/DELETE yok). Kopya DB: migrate + `content:import --dry-run` 0 hata, integrity ok.
- Tek yazım: `quote-only|payments`, `quote|buy` (takma adlar kaldırıldı). Fiyat `editions.pricing.{taxMode,tryMinor,usdMinor,eurMinor}`; KDV `site-settings.commerce.vat.{try,usd,eur}` (yüzde girilir, baz puan saklanır). Yeni alanlar staff okur, admin yazar; commerce anahtarı API key ile yazılamaz; content:import reddeder (`custom.contentImport:false`).
- `orders`: okuma staff + sahip müşteri; create/delete nobody; admin yalnız invoice/notes/requiresReview. `payment-events`: okuma admin. MCP'de yok.
- Store `src/lib/payments/store/**`: BEGIN IMMEDIATE (V5 kuyruğu), koşullu `license_id IS NULL` ve `status = from` yazımları, çakışmada tam rollback, yan etkiler commit + bağımsız okuma doğrulaması sonrası. Testler `tests/unit/payments-{db,schema}.test.ts`; eski migration testlerine P2-S up eklendi.

## V5 P1 bağımsız denetim — 2026-11-10

- P1: aynı transaction ID'sinde eşzamanlı bitirme erken kilit açıyordu; bitirme promise'i paylaşıldı. Timestamp yerine ham tüm-dil snapshot SHA-256 token'ı (ilk sanal alan, DB kolonu yok); aynı ms/saat geri alma testli.
- P1/P2: blok/dizi ID bazlı merge; Lexical/değer/silme/sıra çakışmasında yazmaz. Flush tabanı güncellenir, merge eski undo'yu temizler; gecikmiş yanıt/locale, gizli sekme 409, boş/null token ve restore 409 düzeltildi. Sürümsüz API/bulk ve açık restore kasıtlı koşulsuzdur. Anonim token görünmez; kopya şema içerik alanlarıyla sınırlı.
- Odaklı 4 dosya/36 test geçti; 30 yazım + 30 okuma: 0 hata, 1579 ms, max read 190 ms. Typecheck/lint temiz; tam paket 73 dosya/1186 test: 1184 geçti, 2 kırmızı (kapsam dışı media fixture ve eski migration 60 sn timeout; aynı migration 120 sn geçici sınırda 3/3 geçti). Ana dala kabul HAYIR: build/tarayıcı E2E eksik ve standart kapı kırmızı. Commit index.lock sandbox engeliyle oluşmadı; çalışma ağacında. Verilen scratchpad DB yok: 3531 build/E2E yapılamadı. Canlı DB/3100/ana repo/şema korunuyor. Ayrıntı `docs/qa/v5-concurrency-audit.md`.

## V5 denetim düzeltmeleri (2026-11-09)

- QA P2 (Terra): EN boş fallback'te Escape, başarısız kayıtla dil geçişi, UTF-8 keepalive, dile göre undo geçmişi düzeltildi.
- P1 kapandı: sanal `editorVersion` + `beforeChange` 409 (aynı transaction), süreç içi SQLite transaction sırası (`src/lib/db-serial-transactions.ts`; libsql eşzamanlı BEGIN'de SQLITE_BUSY + görünmeyen yazım vardı), editörde Birleştir/Kopyala/Yeniden yükle. MCP/import sürümsüz geçer. İzole e2e 20/20, 71 dosya/1163 test (1 kapsam dışı kırmızı), LH JS 129,62 KB. Ayrıntı plan 'V5 P1 kapanış kaydı'.

## V5 — Görsel editör (2026-11-09, `feat/visual-editor`)

- Uygulandı: varsayılan görsel düzen, sertleştirilmiş köprü (origin+source+strict şema, id+locale, allowlist yollar), inline düz metin kapsamı, palet, çekmece odaklama, sürükle/klavye, gizli blok rozetleri, geri al/yinele, flush + çakışma, tur, TR/EN etiketler. V4 kapılarının tamamı yeşil; e2e 17/17; LH Perf 100, JS 129,62 KB.
- Açık: popup önizleme, bazı alanlar yalnız formda (tabs etiketi, testimonial isim/rol, stats değeri, zengin metin), Lexical geri alım doğrulanmadı, çakışma yoklaması 15 sn, kullanıcı 8 görev denemesi, ikinci dalga koleksiyonlar.

## content:import karar b denetimi (2026-11-08)

- P2: korunacak seed layout'u silinmeden önce ilişki/Markdown dönüşümünden geçiyordu; kullanılmayan eski referans import ve dry-run'ı hata ile durdurabiliyordu. `importer.ts` layout'u dönüşümden önce çıkarır; önce başarısız olan regresyonlar düzeltmeyle geçti.
- P3: editör kılavuzundaki koşulsuz koruma ve editörden eski seed'e dönme yönlendirmesi düzeltildi; kompozisyon seed'i istisnası ve taslak kompozisyonun import ile yayınlanması açıklandı. Ayrıntılı kapsam `activeContext.md` son maddesinde.
- `pnpm typecheck`, `pnpm lint`, `git diff --check` başarılı. `pnpm test --maxWorkers=1`: **67 dosya / 1033 test**; odaklı import/SQLite: **2 dosya / 58 test**. DB yazıları yalnız geçici SQLite/uploads üzerinde; canlı DB, dev 3100, `.next`, payments ve commit işlemi yok.

## V2 denetimi (2026-11-08)

- Zorunlu editions bloğunu tüm bağlı blokları kaldırarak/legacy restore ile atlatma, ham gizleme girdisinin sessiz temizlenmesi, çakışan blok ID'leri ve legacy ek blok LCP animasyon regresyonu düzeltildi. Ayrıntı/kanıt ve 3200 kapanış engeli `activeContext.md` başında.
- Kapılar: typecheck/lint/diff-check, 67 dosya / 1015 test, kopya DB `.next-prod` build ve TR/EN 3200 duman başarılı. Legacy/kompozisyon MISS = 24/24 sorgu; anonim erişim, draft/ISR, REST/MCP, version restore, duplicate, import idempotansı ve migration up/down testleri geçti. Canlı DB/3100/`.next`/payments/commit korunuyor.

## V2 — Ürün sayfası bağlı bloklar (2026-11-08)

- 8 ürün bölüm bloğu (yalnız products), uyumluluk/kompozisyon modu, zorunlu `productEditions` (Teklif İste; validate + taslakta da kanca + render garantisi), productHero ilk blok/h1/LCP, products autosave 2 sn, admin TR/EN etiketleri + blok önizleme görselleri, seed şeması, editör kılavuzu §7.2a.
- Migration `20261108_130717_v2_product_bound_blocks` yalnız CREATE TABLE/INDEX + ADD COLUMN; down yalnız kendi eklerini kaldırır. Kopya → yedek (`softmarket-pre-v2.db`) → canlı; eski veri farkı 0.
- typecheck/lint temiz, `pnpm test --maxWorkers=1` 66 dosya / 1005 test (yeni: product-composition, product-bound-db), typecheck/lint temiz, `.next-prod` build, 3200 duman (404 dahil), eski ürünlerde `<main>` HTML bayt bayt aynı, LH mobil ürün Perf 100.

## V1 denetimi — 2026-11-08

- Hero draft/autosave doğrulama atlatması, ilk içerik LCP koruması, bozuk admin preset kaydı, hover klavye odağı ve scroll-progress aralığı/fallback düzeltildi; ayrıntı `activeContext.md` başında. CSS değer enjeksiyonu saptanmadı; legacy `appearance.animation` ve stagger sınırları regresyonda korundu. Import şeması hero için aynı yedi seçeneği kullanır.
- Son sabit kaynak koşusu: **`pnpm typecheck`, `pnpm lint`, `pnpm test --maxWorkers=1` (59 dosya / 737 test), `NEXT_DIST_DIR=.next-prod PORT=3200 pnpm build` geçti**. Build/duman için salt okunur kaynaktan SQLite kopyası ve ayrı uploads kullanıldı. Migration up/down + `_v`/satır koruması izole SQLite'ta geçti; migration dosyası/şema değiştirilmedi.
- 3200: `/tr`, `/en`, `/tr/urunler`, `/tr/urunler/akis-yonetimi/akis-merkezi`, `/admin` 200; `/tr/olmayan` 404. SSR gizli animasyon durumu 0; public HTML'nin yüklediği 13 JS parçasında admin preset bileşeni yok. `next start` pnpm'in `node_modules/.bin/next` shim'iyle çalıştırılmalı (NODE_PATH/libsql çözümü).
- Chromium başlatılamadı: gerçek tarayıcıda no-JS/reduced-motion/klavye/sticky görsel QA bu denetimde doğrulanmadı; CSS sözleşmesi ve SSR kontrolleri geçti. 3200 kapalı; 3100 aynı PID 69553 ile açık, canlı DB/`.next` korunuyor; commit yok. `docs/plan-payments.md` kapsam dışında kaldı.

## V0 — Payload güvenlik yükseltmesi (2026-11-08)

- `payload` + tüm `@payloadcms/*` **3.85.1 → 3.93.0**, tam sabit/hizalı; Next **15.4.11**, React **19.2.6** korundu. Node minimum **24.22.1**; host **24.21.0** değiştirilmedi, test/build/migration geçici resmi **24.22.2** runtime ile yapıldı.
- Migration `20261108_093334_v0_payload_393`: **2 auth sütunu + 309 lokalize parent indeksi**; yıkıcı up yok, down yalnız kendi eklerini kaldırır. Önce kopyada up/down/veri koruma; sonra `scratchpad/softmarket-pre-v0.db{,-wal,-shm}` + `.snapshot.db` yedeği ve canlı migrate. Kopya/canlı: **680 tablo, eski veri farkı 0, integrity ok, FK 0**.
- Sürüm notları 3.86–3.93 (patch'ler dahil) incelendi: blok read/tip erişimi, upload/SVG/XML/SSRF güvenliği; API key gizleme, yeni JWT authVersion (eski oturumlarda tekrar giriş), localized draft, Lexical 0.50, Nodemailer 10, SQLite/MCP/admin/i18n/preview uyumu. Güvenlik varsayılanları gevşetilmedi. TIFF `.tif`, aktif SVG reddi, draft-only ilişki ve JWT testleri güncellendi.
- **typecheck/lint, 56 dosya/703 test, generate:types/importmap, kopya DB `.next-prod` build, 3200 duman, isolated E2E 1/1 geçti**. Taze MCP **69 araç**, TR/EN create/update + kimlik/yetki kontrolleri geçti. Import map değişmedi. Upstream mcp-handler SDK peer uyarısı sürüyor; güvenli SDK düşürülmedi. Preview 401 testi geçerli `?redirect=/tr` ile; çıplak endpoint mevcut şekilde 400.
- **3200/3400 kapalı; 3100 PID 53048 ve `.next` korundu; commit yok.** pnpm install HMR'yi bozabilir: yönetici Node >=24.22.1 sonrası dev'i yeniden başlatmalı; bu görevde restart yapılmadı. Ayrıntılı release/migration/test/dosya kaydı: `docs/plan-visual-editor.md` sonundaki V0 bölümü. **V0 tamamlandı; V1/V2/pilotlar uygulanmadı.**

- F11 perf düzeltme turu (2026-11-08): Radix mega menü/sheet → sunucu markup + `lib/header-nav.ts` + `<dialog>`; ICU/next-intl istemciden çıktı (provider yok, `has-locale`); tailwind-merge yalnız sunucu; Geist alt kümeleri (28 KB tek preload + ext unicode-range + mono 20 KB). JS 192→129 KB, font 138.7→48.3 KB, görselli LCP 3.16→2.53 s (hedef 2.5, kalan çerçeve JS). Testler 54/696, e2e header klavye 3/3. Ayrıntı `docs/perf/f11-acceptance.md`.

- F11 güvenlik/kalite denetimi (2026-11-08): izolasyon, seed yetkisi/parola gizliliği, süreç temizliği ve Lighthouse hata/medyan düzeltmeleri uygulandı. Typecheck/lint/izole build ve `pnpm test --maxWorkers=1` (52 dosya, 643/643) geçti; varsayılan paralel koşuda timeout var. Gerçek E2E kapanışının yeniden doğrulanması eski test süreçlerinin sandbox dışında kapatılmasını bekliyor; ayrıntı ve PID/kopya yolları activeContext.md başında. Canlı DB/3100/.next/commit değişmedi.

- 2026-11-07 F9 özgün medya gizliliği: `Media.beforeOperation` → `src/lib/media-upload.ts`; yeni/create ve replacement/update JPEG/PNG/WebP/TIFF/HEIC/HEIF yüklemelerinde EXIF yönü uygulanır, EXIF/GPS/XMP/IPTC atılır, ICC tutulabilir. JPEG q90/mozjpeg, PNG/WebP kayıpsız, TIFF LZW; HEIC HEVC desteği gerektirir, temizleme hatası 400. SVG/GIF/video/PDF ve mevcut dosyalar değiştirilmez; regenerate özgünü korur. Geçici SQLite/uploads üzerinde 10 yeni test (GPS JPEG, fiziksel yön/boyut, formatlar, tempFilePath, 400 ve kapsam dışı dosyalar); typecheck/lint ve 48 dosya/603 test geçti. Risk notu `docs/perf/f9-media-pipeline.md` içinde kapatıldı. Canlı DB/3100/commit işlemi yok.

- F10 kod kısmı tamamlandı (2026-11-07): TR/EN etiket sözlüğü + walker, label tarayıcı testi (dosya sistemi taraması, EN kalıntı kuralı, blok önizleme dosyası varlığı), `content/templates/starter` (01-globals, 05-pages, 10-families-products; `--dry-run` canlı DB'de 0 hata, izole boş SQLite'ta gerçek import + idempotans testi). Kalan: `docs/editor-guide.md` (ayrı ajan), blok önizleme wireframe'leri gerçek ekran görüntüsüne yükseltme (isteğe bağlı, F11), F10 QA (yazan≠denetleyen).

- F9 denetimi (2026-11-07): UUID türev adları, eski çakışan dosyalarda fail-closed erişim, SVG sandbox CSP/nosniff; regenerate orijinali koruyarak aşamalı üretir. Tam test 47 dosya/593 test, typecheck/lint, izole DB ile build; 3200 duman 200/200/200/200/404, optimizer 400; 3200 kapatıldı, 3100 korundu. Özgün JPEG/PNG EXIF/GPS içerebilir; gerçek disk dolması ve zorla kesme test edilmedi. Ayrıntı docs/perf/f9-media-pipeline.md.

- F9 görsel pipeline uygulandı (2026-11-07): Media thumb400/card768/hero1280/wide1920 WebP q74, focal/crop; büyük hedefler Payload varsayılanıyla atlanır (`withoutEnlargement:true` gereksiz orijinal kopyalar üretir). Native ortak MediaImage tüm img tüketicilerinde: srcset/sizes, container boşlukları, width/height, lazy, hero eager/high + responsive preload. `mediaRead` boyut filename'larını aynı medya kaydı + mevcut lisans filtresiyle yetkilendirir; optimizer kapalı, private/no-store. Migration `20261107_192347_media_image_sizes` (24 ADD COLUMN + 4 indeks; down rebuild yok) kopyada test edilip canlıya uygulandı; `scratchpad/softmarket-pre-f9.db{,-wal,-shm,.snapshot.db}` yedeği, eski veri farkı 0, integrity ok/FK 0. `pnpm media:regenerate` kimlik/seedPath/TR-EN/izin/orijinal baytlarını korur; kopyada 3 → 0 regenerate. Gerçek handler/SQLite anon/customer/staff + geçerli/iptal lisans testleri, 45 production HTTP dosya/rol kontrolü; F8 staff+draft protected srcset görürken anon/customer/draft çerezi tek başına yalnız public görür. Mobil dokulu fixture 390px/DPR1–3: 1.24/23.28/171.17 KB. Typecheck/lint, 47 dosya/591 test, production build ve /tr,/en,/tr/urunler,/admin 200; /tr/olmayan 404. **LCP/CLS ve tarayıcı currentSrc ölçümü doğrulanamadı:** Chromium MachPort 1100, Lighthouse port ve browser host engeli; regresyon yok iddiası yok. Kanıt/sınır: `docs/perf/f9-media-pipeline.md`. Testler/kullanıcılar yalnız DB kopyasında, canlı medya=0; 3200 kapatıldı (ECONNREFUSED); 3100 açık/.next korundu, commit yok.

- [x] 2026-11-07 F8 Live Preview + taslak modu: staff-only `/api/preview` + `/api/exit-preview` (açık yönlendirme allow-list, cross-site ret, gizli token yok), draft okuma yalnız draft modu + yeniden doğrulanan staff oturumu (`readAs`), 6 koleksiyonda `admin.livePreview` (390/768/1440), `RefreshRouteOnSave` adası, `pages` autosave 2 sn, migration `20261107_190342_pages_autosave` (additif) canlı DB'de. Draft yanıtları no-store/ISR dışı; autosave önbelleği yenilemez. Playwright iframe ≤2 sn (92 ms). 585 test. Ayrıntı: plan F8 notu.
  - F9 notu: `MediaImage`/imageSizes eklerken draft modunda staff `populate` protected medyayı da döndürebilir; görsel URL'leri yine yalnız iframe'deki staff'a gider (ISR'a yazılmaz) ama srcset üretimi `mediaOf`/visibility kontrolünü korumalı.
  - F10 notu: editör kılavuzuna Live Preview (autosave, breakpoint, template sayfalarında önizleme yok, ilişkili listelerde yalnız yayınlı kayıtlar görünür, "Önizlemeden çık") eklenmeli; admin etiketleri breakpoint adları TR/EN tek string ("Mobil / Mobile"). Diğer drafted koleksiyonlara autosave istenirse her biri ayrı `ADD COLUMN autosave` migration'ı gerektirir.
  - Açık not: CSP varsayılan Report-Only → `frame-ancestors` canlıda zorlanmıyor (önceden var). Draft sızıntısı yine yok (çapraz-site iframe'de `payload-token` SameSite=Lax gönderilmez), ama clickjacking için prod'da `CSP_ENFORCE=true` veya `X-Frame-Options: SAMEORIGIN` önerilir.

- F6 denetimi (2026-11-07): sitemap içerik sorguları `public-sitemap` etiketiyle 1 saat önbellekli, yayın/silme/global değişikliğinde geçersizlenir; yapılandırılmış ana sayfanın landing adresi sitemap dışındadır. `20261107_160000_globals_media_delete` medya FK trigger migration'ı yalnız DB kopyasında uygulandı ve test edildi; canlıya uygulanmadı.

- [x] 2026-11-07 F7 globals tam düzenlenebilir: link `route` tipi (locale'den bağımsız, `src/i18n/paths.ts` LINK_ROUTES/routePath), header custom mega/ikinci CTA/duyuru bandı (kapatılabilir ada)/utility linkleri, footer blurb/iletişim/sosyal toggle/`{year}{siteName}` telif, SiteSettings favicon + `brand.accent` (kontrast kuralı `src/lib/brand.ts`) + `motion`. Migration `20261107_141523_globals_editable` (up yalnız CREATE/ADD; üretilen yıkıcı `__new_` down elle değiştirildi) canlı DB'de; yedek `scratchpad/softmarket-pre-f7.db*`. Seed route'a dönüştü, yer tutucular temizlendi; import 2× 0 create/88 update. 42 dosya/516 test, `.next-prod` build, 3200 Playwright 390/1440 + accent Local API geçici değişim (DB kopyası) doğrulandı, geri alındı; 3200 kapalı, commit yok.
- 2026-11-07 F5 denetimi: elle seçim/limit, eski logoWall anonim yeniden okuma, otomatik logo boş sonuç/dedup ve import şeması üst sınırı düzeltildi. Typecheck/lint, 39 dosya/467 test ve SQLite kopyasıyla `.next-prod` build geçti. Farklı medya ID'leriyle sorgu sayıları sabit: aile/ürün 4, çözüm/haber/vaka 3, birleşik logo 6. Geçici SQLite'ta migration up/down transaction testi tüm eski tablo satırlarını (normal + `_v` çeviriler dahil) korudu; migration dosyası değiştirilmedi. Locale/draft, kapalı kariyer, protected medya, URL whitelist ve 63 karakter enum sınırı regresyonları geçti. 3200: /tr, /en, /tr/urunler, /tr/urunler/akis-yonetimi/akis-merkezi, /admin 200; /tr/olmayan 404. 3200 kapatıldı; 3100 PID 64423 korundu, canlı migration/commit/.next silme yok.
- [x] F5 dinamik (veri bağlı) bloklar: 5 yeni blok + logoWall kaynakları, liste kaynağı/limit/sıralama/düzen/tümünü gör, sabit sorgu + taslak sızıntı + import ilişki testleri (457 test geçti).
# İlerleme

- 2026-11-07 F10 denetimi tamamlandı: mevcut slug/SKU ve globals'ın starter tarafından ezilmesi AGENTS.md'de açıkça uyarıldı; izole test gerçek CLI transaction/rollback yolunu ve üzerine yazma riskini kanıtlıyor. Admin etiketi testleri davranış ayarlarının korunmasını, plugin erişimlerini ve MCP dışlamalarını kapsıyor. Editör kılavuzundaki yetki, yayın, şablon, medya gizliliği, lisans ve çeviri yönlendirmeleri koda uyarlandı. Typecheck/lint/613 test/izole `.next-prod` build geçti; migrate:create şema farkı/dosya üretmedi. Starter'da gerçek kişi/şirket verisi veya güvensiz link bulunmadı; uygulama erişim mantığında regresyon saptanmadı. Canlı DB/3100/.next/commit değişmedi.

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

- F11 (2026-11-07): görsel QA turu 2 (432 görüntü, sorunsuz otomatik yoklama), Lighthouse 3 koşu medyan (9 sayfa x mobil/masaüstü), INP vekili, DB sorgu/ISR ölçümü, editör kılavuzu-admin UI hizalaması, 2 yeni e2e spec (biri izole DB kopyalı). typecheck/lint/613 birim test + 15 e2e (3100) + 1 izole e2e geçti. Perf kabulü kırmızı 4 madde (görselli LCP, SEO canonical, JS 192 KB, font 70 KB) → sonraki faz. Commit yok.

- 2026-11-08 G2 (F11 yeni bulgular): yasal taslak sayfalar (`TASLAK —`/`DRAFT —` veya `[BÜYÜK HARF]`) `src/lib/legal-draft.ts` ile noindex + sitemap dışı (şema yok); ürün hero birincil Teklif İste; PageHero ritmi; sürüm notları ürün gruplu/katlı; MediaCard slug-hash kapak; footer alt satır; SEO plugin TR/EN alan etiketleri; lead form düğmesi lg. Detay: docs/qa/visual-baseline.md.
- 2026-11-08 F11 diff denetimi: yasal taslak tespiti/sitemap fail-closed ve header navigasyon, odak, mobil scroll/close yarışı düzeltildi; typecheck/lint, 54 dosya 698 test, izole build ve HTTP duman geçti. Chromium MachPort sandbox nedeniyle header E2E çalıştırılamadı; iOS doğrulanmadı.
- 2026-11-08 V1 animasyon preset sistemi: `motion` grubu + migration `blocks_motion` (yalnız ADD COLUMN, canlıda), CSS sözleşmesi + LCP koruması, admin Hareket paneli (preset kartları), editor-guide 2.6a. Testler/build/Playwright/Lighthouse yeşil; V2 (ürün bağlı bloklar) sırada.

## 2026-11-08 V2 ürün sayfası bağlı bloklar (commit ve doğrulama)
- V2: 8 ürün bağlı blok, Teklif İste zorunlu, hero ilk; eski layout birebir. Migration `20261108_130717_v2_product_bound_blocks` (yalnız ADD/CREATE), yedek scratchpad `softmarket-pre-v2.db`.
- QA düzeltmeleri: restore/hidden/duplicate-id bypass kapatıldı, `.product-anchor` offset, ValidationError TR toast (`req.t`).
- Ödeme P1 çekirdeği 16b565e (`src/lib/payments`, bağlı değil). Sonraki: V3a Puck pilotu, V3b native canvas pilotu (ayrı worktree, 3510/3520, migration yok).

## 2026-11-08 V4 karar kaydı
- V4 karar: native canvas kazandı; Puck pilot dalı ve worktree kaldırıldı, raporlar `docs/editor-pilot/` altında. Sonraki: V5 (`feat/visual-editor`).

## 2026-11-16 V5 ana dala alındı
- typecheck, lint, 73 dosya / 1188 birim test (maxWorkers=1), prod build, `test:e2e` 19 + `test:e2e:isolated` 20 (visual-editor dahil) geçti. Migration testi (~45 s, serializer'dan bağımsız; main'de aynı) zaman aşımı 240 s; content-import medya testi kendi fixture'ını üretir.

- P2-S denetimi: sipariş satırı/net/KDV toplamları tutarlılığı, payment-event commit doğrulaması ve terminal durum koruması, fulfillment commit doğrulaması ve commerce verisi bulunan migration down koruması eklendi; izole SQLite regresyonları eklendi.

## P7 commerceLegal bağımsız denetim — 2026-11-16 (tamamlandı, commit yok)

- EN fallback/boş-gizli hukuki metinle legalReady açılması, eksik yer tutucu algılama, eşzamanlı taslak tür çakışması, yeniden adlandırılmış yasal URL sızıntısı ve importer symlink okuması düzeltildi. Header/footer iç referans projeksiyonu korundu; TR/EN metin tutarlılığı düzeltmeleri yapıldı.
- Teknik taslak kontrolü hukukçu onayını doğrulamaz (P3); kılavuz ve plan açıklar. Ayrıntı `docs/plan-payments.md` P7 denetim kaydı.
- Canlı DB/3100/.next, P4 dosyaları, techContext ve commit korunuyor. Migration değişmedi; geçici SQLite up/down ve NULL/UNIQUE/sürüm testleri var. Kapı sonucu aşağıda.
- Son kapılar: `pnpm typecheck` ve `pnpm lint` exit 0; `pnpm test --maxWorkers=1`: **84 dosya / 1397 test, tamamı geçti (314,55 sn)**. P4 kaynaklı kırık yok. `git diff --check` temiz. **P7 migration canlıya güvenli: EVET; P7 kapsamı commit edilebilir: EVET** (commit atılmadı).
