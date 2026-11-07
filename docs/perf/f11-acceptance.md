# F11 performans kabulu (2026-11-07)

Ortam: `NEXT_DIST_DIR=.next-prod pnpm build` + `next start` 127.0.0.1:3200 (canlı SQLite, yalnız okuma); görselli sayfalar için DB **kopyası** + `.next-f11` build + 3300 (kopyada `media` kaydı + hero görselli landing sayfa `/tr/f11-gorsel-test` ve ana sayfa hero görseli; canlı DB'ye yazılmadı). Lighthouse 13.6 (`scripts/perf-lighthouse.mjs`, `LH_RUNS=3` → **3 koşu medyan**), Chrome for Testing 1248, mobil = varsayılan simüle throttling (Lantern), masaüstü = `--preset=desktop`. Ham sonuçlar: `docs/perf/f11-raw/` (summary-live.json, summary-image.json, isr-query-log.tsv).

## Bütçe tablosu (plan §7)

| Metrik | Hedef | Ölçülen | Durum |
|---|---|---|---|
| LCP (metin hero; /tr, /en, katalog, ürün, çözüm, destek, haberler) | < 2.0 s | 1.06–1.21 s | YEŞİL |
| LCP (görselli hero; ana sayfa ve landing, kopya DB) | < 2.0 s | **3.01 s** (3 koşu 3007–3013 ms) | KIRMIZI |
| CLS (tüm sayfalar, görselli dahil) | < 0.05 | 0.000 | YEŞİL |
| TBT (INP vekili) mobil | < 150 ms | 73–89 ms | YEŞİL |
| INP vekili (Playwright, 390 px, CPU x4: menü, SSS x3, sekme x3, dil) | < 200 ms | en kötü 128 ms (menü) | YEŞİL |
| Lighthouse Performance (mobil) | ≥ 90 | 100 (metin) / 94 (görselli) | YEŞİL |
| Lighthouse A11y / Best Practices | ≥ 95 | 100 / 100 | YEŞİL |
| Lighthouse SEO | ≥ 95 | **92** (tek başarısız denetim `canonical`) | KIRMIZI (ortam) |
| Ana sayfa JS gzip toplam | ≤ 130 KB | **191–198 KB** (Next "First Load JS" 132–136 KB) | KIRMIZI |
| Sayfaya özel chunk | ≤ 15 KB | 0.3–0.8 KB (en büyük rota paylaşımı: global-error 11 KB, [locale]/layout 9 KB) | YEŞİL |
| CSS gzip | ≤ 30 KB | 12.5 KB (1.4 + 11.1) | YEŞİL |
| Hero görseli (mobil) | ≤ 180 KB | DPR 1,75'te seçilen `card` 768w = 10–11 KB; DPR 3'te `hero` 1280w = 100 KB (sentetik dokulu fixture; gerçek fotoğrafta değişir) | YEŞİL |
| Font preload | ≤ 1 dosya / ≤ 60 KB | 1 dosya ama **70 KB**; ayrıca ikinci font (70 KB, preload'suz) ilk yükte iniyor | KIRMIZI |
| TTFB, ISR HIT | < 50 ms | 123 rotada ikinci istek 2–8 ms (ilk soğuk `/tr` 55.7 ms) | YEŞİL |
| TTFB, MISS | < 400 ms | MISS gözlenmedi (hepsi build'de üretilmiş); dinamik 24 rota 17–107 ms, ISR MISS yerine geçmez | DOĞRULANMADI |
| DB sorgu / istek: ana sayfa ≤ 12, ürün ≤ 15 | | ana sayfa 0, ürün 0 (HIT); dinamik liste/form rotaları 11–18 (`/tr/iletisim` 18, `/tr/urunler` 16, arama 33) | SARI (ana sayfa/ürün bütçesi yeşil; dinamik sayfalar için bütçe tanımsız, 18 yüksek) |

Sonuç: §7 bütçesi **tamamen yeşil değil**; kabul için 4 kırmızı (görselli LCP, SEO, JS, font) kalıyor.

### Mobil (3 koşu medyan)

| Sayfa | Perf | A11y | BP | SEO | LCP (s) | CLS | TBT (ms) | JS gzip (KB) |
|---|---|---|---|---|---|---|---|---|
| /tr | 100 | 100 | 100 | 92 | 1.06 | 0.000 | 81 | 192 |
| /en | 100 | 100 | 100 | 92 | 1.06 | 0.000 | 80 | 192 |
| /tr/urunler | 100 | 100 | 100 | 92 | 1.21 | 0.000 | 87 | 193 |
| /tr/urunler/…/akis-merkezi | 100 | 100 | 100 | 92 | 1.06 | 0.000 | 81 | 192 |
| /tr/cozumler | 100 | 100 | 100 | 92 | 1.21 | 0.000 | 89 | 193 |
| /tr/destek | 100 | 100 | 100 | 92 | 1.06 | 0.000 | 81 | 191 |
| /tr/haberler | 100 | 100 | 100 | 92 | 1.21 | 0.000 | 88 | 197 |
| /tr (görselli) | 94 | 100 | 100 | 92 | 3.01 | 0.000 | 75 | 191 |
| /tr/f11-gorsel-test (görselli) | 94 | 100 | 100 | 92 | 3.01 | 0.000 | 73 | 192 |

### Masaüstü (3 koşu medyan)

| Sayfa | Perf | A11y | BP | SEO | LCP (s) | CLS | TBT (ms) | JS gzip (KB) |
|---|---|---|---|---|---|---|---|---|
| /tr | 100 | 100 | 100 | 92 | 0.29 | 0.000 | 0 | 192 |
| /en | 100 | 100 | 100 | 92 | 0.29 | 0.000 | 0 | 192 |
| /tr/urunler | 100 | 100 | 100 | 92 | 0.33 | 0.000 | 0 | 195 |
| /tr/urunler/…/akis-merkezi | 100 | 100 | 100 | 92 | 0.33 | 0.000 | 5 | 193 |
| /tr/cozumler | 100 | 100 | 100 | 92 | 0.33 | 0.000 | 0 | 195 |
| /tr/destek | 100 | 100 | 100 | 92 | 0.29 | 0.000 | 0 | 191 |
| /tr/haberler | 100 | 100 | 100 | 92 | 0.33 | 0.000 | 0 | 198 |
| /tr (görselli) | 100 | 100 | 100 | 92 | 0.65 | 0.000 | 0 | 192 |
| /tr/f11-gorsel-test (görselli) | 100 | 100 | 100 | 92 | 0.65 | 0.000 | 0 | 193 |

## Yorum

- **Görselli LCP 3.0 s (Lantern).** Aynı sayfa gerçek throttling'te (`--throttling-method=devtools`) LCP = FCP = 2.18 s; metin sayfası 2.16 s: görsel gecikme eklemiyor. Gözlenen yükleme zinciri hızlı (görsel `fetchpriority=high`, `loading=eager`, preload'lu, 10 KB, keşif sorunu yok). Simülasyon görseli ana-iş parçacığı/JS zincirine bağlıyor (`interactive` = LCP = 3006 ms). Deney: görsel engellenince 1.06 s, font engellenince 2.68 s. Yani bütçeyi kurtaran hamleler: (1) JS'i küçült, (2) fontu 1 dosya ve < 60 KB yap/preload'u kaldır. Gerçek kullanıcı alan verisiyle (CrUX) doğrulanmadı.
- **JS 192 KB gzip.** Dağılım: react-dom 53.7, next client 44.2, Radix NavigationMenu 16.6 (mega menü), ICU MessageFormat ayrıştırıcı 12.5 (istemcide mesaj ayrıştırma), tailwind-merge+cva 9.3, Radix primitifleri 8.2, `[locale]/layout` 9.3, `global-error` 11.2 (her sayfada). Çerçeve tabanı ~100 KB; 130 KB hedefi için ~60 KB site JS'inden en az 30 KB inmeli (mega menüyü CSS/`details` ile, mesajları sunucuda çözerek, tailwind-merge'siz). Büyük iş: ayrı faz.
- **TBT** F0'daki 6–14 ms'den 73–89 ms'ye çıktı (hâlâ yeşil). Nedeni araştırılmadı (F2 animasyon gözlemcisi/hydration şüpheli; ölçüm makinede dev sunucu açıkken alındı).
- **SEO 92:** yalnız `canonical`; canlıda alan adı (`NEXT_PUBLIC_SERVER_URL`) verilince kapanması beklenir (F0 ile aynı neden). `bf-cache` dinamik liste sayfalarında (`Cache-Control: private, no-store`) başarısız; bütçe dışı.
- **Fontlar:** `b6ea3859…woff2` (preload) 70 166 B, `4b23c4cd…woff2` 68–70 KB. İkincisi muhtemelen mono aile (hero panelindeki "Ürün aileleri", sürüm numaraları). Alt küme (latin + latin-ext) veya mono'yu sistem yığınına çekmek önerilir.
- **Dinamik rotalar:** `/tr/iletisim` (18 sorgu), `/tr/urunler`, `/tr/cozumler`, `/tr/haberler`, indirmeler, dokümantasyon listesi ISR'siz (`private, no-store`). Katalog/iletişim sorguları büyük olasılıkla globals + liste; ISR/`unstable_cache` ile 0'a inebilir.
- Build: `.next-prod` ve `.next-f11` build'leri ilk denemede zaman aşımsız geçti (doküman build timeout kök neden araştırması bu fazda yapılmadı).

## Yeniden üretme

Build ve test için `DATABASE_URI` ve `UPLOADS_DIR` değişkenlerini önce geçici DB/yükleme kopyalarına ayarlayın; aşağıdaki build komutu tek başına DB izolasyonu sağlamaz. `.next` çalışan 3100 geliştirme sunucusuna aittir; bu dizini silmeyin.

```
NEXT_DIST_DIR=.next-prod pnpm build && NEXT_DIST_DIR=.next-prod pnpm start --hostname 127.0.0.1 --port 3200
CHROME_PATH=<chrome> LH_RUNS=3 node scripts/perf-lighthouse.mjs <outDir>
# görselli sayfa: kopya DB + LH_BASE=http://127.0.0.1:3300 LH_URLS=/tr,/tr/<slug> LH_PRESETS=mobile,desktop
```

### İzole E2E güvenlik denetimi

`pnpm test:e2e:isolated` yalnız `127.0.0.1:3400` kullanır; çalışan sunucuya bağlanmaz (`reuseExistingServer:false`). Normal `pnpm test:e2e --list` isolated klasörünü hariç tutar. Kaynak `E2E_SOURCE_DB` (varsayılan `data/softmarket.db`) Python SQLite `mode=ro` ile okunur, backup API'siyle özel geçici dizine kopyalanır; kaynak yoksa oluşturulmaz. Python 3 gereklidir. Uploads bu dizinde boş oluşturulur; canlı uploads kullanılmaz. Başka bir kaynak DB ayarlıysa açıkça `E2E_SOURCE_DB` verin.

Seed `.env` yüklemez; izolasyon bayrağı/dizini, marker, kanonik DB/uploads yolları ve ayrı Payload secret olmadan Payload'ı başlatmaz. Symlink/hardlink DB ve symlink uploads reddedilir. Dosya URI'si `pathToFileURL` ile üretilir (`?`, `#`, `%`, boşluk ve tek tırnak yolu değiştiremez). Başlatılan Payload'ın gerçek DB dosyası (`PRAGMA database_list`) ve medya dizini yazmadan önce doğrulanır. Runtime Payload config de izole env eksik/yanlışsa canlı varsayılanlara düşmek yerine hata verir; 3400 portunda tüm izolasyon bayrakları kaybolsa da kontrol çalışır. Config yolu proje config'ine sabitlenir. Test admini `roles:['admin']` ve API key kapalı oluşturulur; parola/secret rastgele ve yalnız süreç ortamındadır. Parolayı içeren login gövdelerini saklamamak için isolated trace ve shell xtrace kapalıdır; kimlik bilgilerini komut satırına veya loglara yazmayın.

EXIT/INT/TERM, seed/backup hataları dahil, yalnız testin süreç grubunu sonlandırır ve kendi geçici dizinini temizler. Seed doğrudan `node --import tsx`, Next ise `node_modules/.bin/next` shim'iyle çalışır; araya ayrı süreç grupları oluşturan `pnpm exec` girmez ve Next'in gerekli NODE_PATH ayarı korunur. Playwright `gracefulShutdown: SIGTERM` kullanır; varsayılan zorla kapatma trap'i atlıyordu. SIGKILL veya makine kapanmasında trap çalışamaz; özel geçici kopya/süreç kalabilir, canlı DB'ye geçiş yapılmaz. Hata enjeksiyon testleri eksik env, URI yanıltması, symlink/hardlink, özel karakter içeren yollar, eksik kaynak, seed hatası, xtrace'de parola gizliliği ve SIGTERM temizliğini kapsar. Lighthouse koşu sayısı 1–100 tam sayı olmalıdır; hatalı/kısmi raporlar artık çıkış kodu 1 ve summary içinde hata üretir; çift sayıda koşunun medyanı iki orta değerin ortalamasıdır.

Denetim doğrulaması (2026-11-08): `pnpm typecheck`, `pnpm lint`, ayrı SQLite/uploads ile `NEXT_DIST_DIR=.next-prod pnpm build` başarılı. `pnpm test` varsayılan paralellikte mevcut ağır SQLite/medya testlerinde timeout verdi; son `pnpm test --maxWorkers=1` 52 dosya/643 test geçti. Normal Playwright listesi 15 test ve isolated dışarıda; isolated listesi 1 test. Gerçek izole E2E'nin API adımı önceden kullanıcısı olan kopyada geçti (yeni hesap admin, blok sırası ve staff/anon preview); eski wrapper kapanışı yetim süreç bıraktı. Bu denemenin süreçlerine sandbox sinyal gönderimini reddettiği için son doğrudan-shim/gracefulShutdown düzeltmesinin gerçek E2E kapanışı tekrar doğrulanamadı. Son shell/izolasyon regresyonu 19/19; 3100 süreci ve `.next` korundu, canlı DB'ye yazılmadı. Bu spec API tabanlıdır; Chromium açılmaz.
