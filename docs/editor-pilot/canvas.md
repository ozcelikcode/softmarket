# V3b — Payload-native canvas pilotu (özel köprü) — 2026-11-08

Dal `pilot/native-canvas` (main fc22469 üstü). what-digital eklentisi **reddedildi** (bkz. `canvas-spike.md`: site köprüsü parent olmayan aynı-origin mesajı kabul ediyor) ve worktree'den tamamen kaldırıldı. Bu pilot planın "Özel köprü (Argon tasarımı)" yoludur. Ham ölçümler: `canvas-metrics.json`; otomasyon betikleri: `canvas-e2e/*.mjs` (Playwright, 3520 + kopya DB).

## Ne yapıldı

| Parça | Dosya | Not |
|---|---|---|
| `editing` bayrağı | `src/lib/blocks/render-plan.ts` | `planBlocks(..., { editing: storedLayout })` → `ctx.edit = { id, path: 'layout.N' \| null }`. Yol, **kayıtlı** layout indeksidir (ürün kompozisyonu, `listing` filtresi, gizli bloklar indeksleri kaydırsa da doğru). Sanal (uyumluluk modu) bloklarda `path: null`. |
| İşaretler | `src/components/blocks/block-shell.tsx` (`EditableBlock`, `editField`), `render-blocks.tsx` | `display: contents` sarmalayıcı: `data-block-id`, `data-block-path`, `data-block-type`. Düz metin: hero `eyebrow/heading/subheading`, CTA `heading/body` → `data-field-path`. Ürün girişinin h1'i köprüde `title` alanına eşlenir. |
| Kapı | ana sayfa, landing (`[slug]`), ürün sayfası | `editing` yalnız `getPreviewUser()` (draft modu + her istekte doğrulanan staff) doluysa verilir. Public/ISR HTML'de işaret yok (birim + tarayıcı testi). |
| Köprü | `src/editor/canvas/bridge.tsx` (+ `bridge-loader.tsx`) | Layout'ta `LivePreviewRefresh` yanında, aynı kapıyla. `React.lazy` + mount kapısı ile ayrı chunk (ilk sürüm `next/dynamic` idi; ortak layout chunk'ına ~1 KB ekleyip 130 KB kapısını aştığı için değiştirildi). Hover çerçevesi, seçili blok araç çubuğu (↑ ↓ sürükle, Çoğalt, Gizle, Sil [iki adımlı onay], + Blok ekle), Alt+↑/↓ klavye taşıma, Esc seçimi bırakır. Düz metin `contenteditable="plaintext-only"`, yalnız `textContent`, yapıştırma düz metin, Enter = kaydet, Esc = geri al. API'ye yazmaz. |
| Admin host | `src/editor/canvas/admin-host.tsx`, `plugin.ts` | `beforeDocumentControls` (Form içinde) olarak `products` + `pages` düzenleme ekranına eklenir (`payload.config.ts` tek satır `canvasPilot()`; koleksiyon dosyası değişmedi). Mesajları Payload form API ile uygular: `moveFieldRow`, `addFieldRow`, `removeFieldRow`, `DUPLICATE_ROW`, `UPDATE` (+ `setModified`). Blok seçilince form satırı açılır, kaydırılır ve iç grupları (Görünüm, Hareket, Hareket › Gelişmiş) açılır; odak tuvalde kalır. Blok paleti: config'teki blok etiketi + `public/admin/blocks/*.webp`. |
| Protokol | `src/editor/canvas/protocol.ts`, `rules.ts` | Bkz. Güvenlik. V2 kuralları editörde aynalanır (sunucu yine yetkili). |

Kayıt zinciri değişmedi: form → autosave (2 sn) → sunucu doğrulaması/erişim → `RefreshRouteOnSave` → iframe yenilenir. Yayın Payload'un "Değişiklikleri yayınla" düğmesi. TR/EN: admin yerel ayar seçicisi formu ve önizleme URL'sini değiştirir; köprü yalnız o anki form locale'ine yazar.

**Uyumluluk modu (V2):** layout'ta bağlı blok yoksa sayfa sanal bloklarla çizilir. Sanal blok seçilince tek düğme "Bölümleri düzenlenebilir yap": 8 bağlı blok formda en üste referans olarak eklenir (içerik kopyalanmaz); ek bloklar arkada kalır.

## Denetim düzeltmesi (2026-11-08)

Aşağıdaki ölçümler önceki build'e aittir; düzeltmeden sonra yeniden doğrulanmadı ve V4 kabulü sayılmaz. Yerinde metin her girişte form durumuna aktarılır; düzenleme sürerken önizleme yenilemesi ertelenir. Mesajlar blok kimliği ve locale taşır, form güncel satırını kimlikle bulur. 500 karakteri aşan mevcut metin formda düzenlenmelidir; sınırı aşan giriş reddedilir. Autosave tamamlanmadan sekme kapanırsa son değişikliklerin sunucuya ulaştığı garanti edilemez. Caret, hızlı kapanış ve locale değişimi gerçek tarayıcıda tekrar ölçülmelidir. MCP/import kapısı mevcut seed çakışması nedeniyle geçmemiştir.

## V4 kapıları (önceki build ölçümleri)

| Kapı | Sonuç | Kanıt |
|---|---|---|
| Veri round-trip | **GEÇTİ** — 0 fark | Editör + canvas açık, blok seçili, no-op değişiklik → autosave + yayın; TR/EN taslak belge (fallback yok) derin karşılaştırma (`updatedAt/createdAt/_status` hariç): products/5, products/4 (canvas ile kompozisyona alınmış), pages/6 (ana sayfa), pages/1 (yasal, richText) → TR 0 / EN 0. |
| Lexical korunumu | **GEÇTİ** | pages/1 Lexical JSON'u dahil tüm belge 0 fark. Canvas zengin metne yazmaz (yalnız düz metin). |
| TR/EN | **GEÇTİ** — 0 sızıntı | EN'de başlık değişti ("Flow Hub Pro"), TR başlık aynı; boş EN alanlarına TR yazılmadı (0). MCP find TR/EN aynı sonucu verdi. |
| Public bundle | **GEÇTİ** | Lighthouse mobil, 3 koşu medyan, aynı betik/aynı DB: main **129,42 KB** → pilot **129,59 KB** (+0,17). Perf 100, LCP ~1,06 s, CLS 0. Köprü chunk'ı (4,2 KB gz) + zod chunk'ı (24,8 KB gz) yalnız staff draft yüklemesinde iniyor; anonim yüklemede istenmiyor, HTML'de işaret/köprü referansı yok. `client-bundle-guard` genişletildi. |
| Güvenlik | **GEÇTİ** | Anonim preview 401 (`private, no-store`), customer 403, ikisi de işaretsiz HTML ve admin'e erişemez; staff draft `no-store`. Sahte mesajlar (aynı origin kardeş iframe → admin, admin'in kendisi, 127.0.0.1 popup, gerçek iframe'den bilinmeyen tip, parent olmayan pencere → köprü) reddedildi; gerçek parent kabul (pozitif kontrol); layout satırları 10 → 10. Bağımsız açılan draft sayfada köprü pasif. Birim: `tests/unit/canvas-pilot.test.tsx` (23). |
| MCP/import | **KISMİ** | MCP `findProducts` TR/EN hatasız (sıra + `slide-left/slow` görünüyor). `content:import --dry-run`: editör öncesi snapshot 0 hata; editör sonrası **akis-merkezi'de V2 kuralıyla red** ("kompozisyon, Sürümler olmadan eski düzene döndürülemez") — canvas 4 seed ürününü kompozisyona aldı, `content/seed` ise eski layout'u taşıyor. Bu 4 ürün çıkarılınca dry-run 0 hata (canvas ile başlığı düzenlenen/round-trip edilen ürünler dahil). Canvas geçersiz veri üretmedi; seed ile editör kompozisyonu çakışıyor (V5: seed'e geri yazma/uyarı). |
| Canvas–yayın eşdeğerliği | **GEÇTİ** — %100 | Staff draft render (işaretli, köprü pasif, F8 çıkış rozeti gizli) ile anonim render: /tr, ürün TR/EN × 390/1440'ta tam sayfa **piksel birebir**, metin ve bölüm konumları aynı. Canvas gerçek sayfadır; yer tutucu blok yok. |

## 8 görev (otomatik, products/4, insan düşünme süresi yok)

| Görev | Süre | Not |
|---|---|---|
| T0 kompozisyona geç | 2,7 sn | Eski düzenli üründe tek tık |
| T1 CTA ekle | 2,8 sn | + Blok ekle → palet (görselli) |
| T2 Sürümler'i Özellikler'in üstüne | 3,2 sn | Tutamaçtan işaretçi sürükleme (HTML5 DnD iframe'de güvenilmezdi, pointer tabanlıya geçildi) |
| T3 sil | 2,7 sn | İki adımlı onay |
| T4 başlığı yerinde düzenle | 2,3 sn | h1 → `title` |
| T5 Sola kayma + yavaş | 4,0 sn | Blok tıklanınca formda Hareket paneli açılır; kart + süre seçimi formda |
| T6 EN'e geç, başlığı çevir | 5,4 sn | |
| T7 390/1440 önizle | 2,1 sn | Live Preview kırılım seçici |
| T8 yayınla | 4,2 sn | Public sayfada sıra, başlık, işaretsiz HTML doğrulandı |

Toplam ~29 sn. V2 kilitleri tuvalde: Sürümler sil/gizle/çoğalt kapalı (taşınabilir); Giriş sil/gizle/taşı/çoğalt kapalı; İndirmeler serbest (bağlı bloklar tekil, çoğaltma kapalı). Ekran görüntüleri: scratchpad `v3b/t*.png`, `parity-*.png`. **Kullanıcının kendi 8 görev denemesi henüz yapılmadı** (V4 puanında belirleyici).

## Caret / autosave bulgusu

- Her tuşta forma yazma (`localStorage['sm-canvas-commit']='input'`, ölçüm modu): yazarken 2 sn duraklamada autosave → önizleme yenilemesi caret'i başa atıyor: 31 tuşta **22 bozuk**, metin bozuldu. **Kabul edilemez.**
- Varsayılan çözüm: metin forma yalnız **Enter/odak kaybı** ile yazılır. 31 tuş + 3 duraklama: **0 bozuk**, metin ve form değeri doğru. Yazarken başka bir değişikliğin autosave'i/yenilemesi araya girdiğinde de 0 bozuk (React, değişmeyen sunucu metnine dokunmuyor).
- Döngü: kayıttan autosave PATCH'e 2,36 sn, önizleme yenilemesine 2,42 sn; yapısal değişiklik (taşı/ekle) → tuval 2,5 sn.

## Performans / erişilebilirlik

Admin editör + canvas açılışı 0,4–0,5 sn (sıcak), blok seçimi → araç çubuğu 36–60 ms, klavye ile taşıma (Alt+↑/↓) tuvalde 2,5 sn'de görünür; araç çubuğu düğmeleri odaklanabilir, `aria-label`'lı.

## Bakım riski

Yeni bağımlılık **0** (zod zaten var). `@payloadcms/ui` public export'ları: `useAllFormFields, useConfig, useDocumentInfo, useForm, useLivePreviewContext, useLocale, useTranslation`. İçe bağımlılıklar (Payload yükseltmesinde e2e şart): `SET_ROW_COLLAPSED` eylem şekli (tipte yok, cast), `DUPLICATE_ROW/UPDATE`, `formState.layout.rows`, DOM `layout-row-N` id'si ve `.collapsible__toggle--collapsed` sınıfı (grup açma), `config.blocksMap`, `beforeDocumentControls` yuvası. Kod ~680 satır (`src/editor/canvas`).

## Bilinen sorunlar / sınırlar

1. Seed çakışması (yukarıda MCP/import): kompozisyona alınan seed ürünleri `content:import` ile yeniden yazılamaz.
2. Yerinde metin yalnız hero (üst etiket/başlık/alt başlık), CTA (başlık/metin) ve ürün başlığında; diğerleri formdan.
3. Gizlenen blok tuvalde görünmez; geri açmak formdan (Görünüm › Gizle).
4. "Görsel düzenle" giriş düğmesi yok; Live Preview (göz simgesi) açılınca tuval aktifleşir. Popup önizleme modu desteklenmiyor.
5. Hareket/Görünüm ayarı tuvalde değil, otomatik açılan form panelinde.
6. Sistem sayfaları, yasal, çözüm/referans sayfaları işaretlenmedi (pilot kapsamı: ürün + ana sayfa + landing).
7. Araç çubuğu çok uzun bloklarda görünümün üstüne sabitlenir; yapışkan ürün sekmelerinin üstüne biner.
8. Köprü chunk'ı zod'u ayrı 24,8 KB gz chunk olarak çeker (yalnız staff); V5'te `zod/mini` veya elle doğrulayıcı.
9. Kopya DB'de Terra spike ürünleri (9–11) yayında; pilot ölçümleri etkilenmedi.

## Yeniden doğrulama (QA sonrası, commit 9715277, 2026-11-08)

Yeni build, 3520 + kopya DB, Playwright/Chromium. Ürün 4 (a–c) ve 5 (T0–T8); yerinde yazım artık her girişte forma aktarılıyor.

| Ölçüm | Sonuç |
|---|---|
| a. Caret (ürün 4, 31 tuş, 220 ms aralık, her 10 tuşta 3,5 sn duraklama) | **GEÇTİ**: bozulan tuş 0, odak kaybı 0, imleç atlaması 0; metin ve form başlığı birebir; 4 autosave PATCH, 2 RSC yenileme. Ürün 5'te de aynı (31 tuş, 0 bozulma). |
| b. Hızlı kapanış (yaz, blur yok, ~0,3–0,55 sn içinde sayfadan ayrıl / sekme kapat) | **KAYDEDİLMEDİ** (iki varyantta da sunucuda eski başlık). Autosave aralığı (~2 sn) dolmadan çıkışta değişiklik kaybolur; yazım 2 sn+ beklerse kaydedilir. Payload'ın standart davranışı, canvas'a özgü değil; beforeunload/flush yok (bkz. sınırlar). |
| c. TR/EN | **GEÇTİ**: EN'de başlık değişti, TR farkı 0; boş EN alanına TR yazılmadı (0 alan). T7 sonrası enLeak = []. |
| d. Round-trip (no-op kaydet, TR+EN) | **GEÇTİ**: products/4, products/5, pages/6, pages/1 (Lexical dahil) derin fark 0 (updatedAt/createdAt/_status hariç). |
| e. Güvenlik dumanı | **GEÇTİ**: anonim `/api/preview` 401; anonim `/tr`, `/en`, ürün HTML'inde `data-block-id/path`, `data-field-path`, `data-canvas-ui` 0. T8 genel sayfada markers 0, canvasUi 0. |
| f. T1–T8 (ürün 5) | T0 2728 ms, T1 2815, T2 3187 (sürükle, ilk koşu; ikinci koşuda sıra zaten düzgün olduğundan 227 ms, geçersiz), T3 2711, T4 2281, T5 3928, T6 5279, T7 2068, T8 4209. Toplam ≈ 29 sn. Kilitler (editions kaldır/gizle, hero kaldır/taşı) devre dışı: doğru. |

Gözlemler:
- T5 (Hareket süresi) ilk denemede zaman aşımı verdi: ürün 5 başlığı çok satıra uzayınca T4 `End` tuşu satır sonuna gidip metni ortaya yazmıştı (test artefaktı); ikinci denemede ayrı bir kez, seçilen satırın Hareket grubu (`Gelişmiş` iç grubu) form panelinde 4 sn sonra bile kapalı kaldı (`reveal` 50/300 ms iç-grup açma yarışı). Üçüncü koşuda geçti (3928 ms). Aralıklı (flaky) olarak izlendi; kod değiştirilmedi.
- Ürün 5'in eski başlığı önceki (düzeltme öncesi) caret testinden bozuktu; temiz başlığa geri alındı. Kompozisyondan geri dönüş V2 kuralıyla reddedildiği için ürün 4 ve 5 artık kompozisyon modunda.

## V5 efor tahmini (native seçilirse): **6–8 iş günü**

İşaretleri tüm 29 blok tipinin düz metin alanlarına yaymak (1,5), gizli blokları tuvalde soluk gösterme (0,5), geri al/yinele (1), eşzamanlılık uyarısı + belge kilidi (1), palet arama/kategoriler + rehber tur + erişilebilirlik (1), seed/kompozisyon uyarısı (0,5), diğer koleksiyonlar (0,5), e2e/güvenlik paketi `visual-editor.spec.ts` (1–1,5), zod/mini (0,25).
