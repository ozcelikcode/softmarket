# Plan — Görsel Editör (WYSIWYG) + Animasyon Efektleri + Ürün Sayfası Kompozisyonu

> Durum: V0 ve V1 uygulandı ve doğrulandı (2026-11-08); V2–V6 taslak plan olarak bekliyor. V0 kanıtı ve uyumluluk notları belgenin sonunda.
> Kaynaklar: `memory-bank/*`, `AGENTS.md`, `docs/plan-page-builder-animation.md` (F0–F11 "Uygulandı" notları), `docs/perf/f11-acceptance.md`, mevcut kod. Danışman raporları: GPT 6 Astra (`editor-astra.md`), Gemini 4 Argon (`editor-argon.md`), oturum scratchpad'inde.

## Kullanıcı isteği ve kararı

- İstek (harfiyen): "Admin sayfasında bir ürün tanıtım sayfası eklerken de iyi bir WYSIWYG editöre ihtiyaç var. Animasyon katabilecek bir editöre ihtiyaç var. Tanıtım sayfası dümdüz olmamalı. Animasyon eklenebilir, bloklar halinde sayfadaki içerik taşınabilir olmalı. Kısacası wix.com tarzında profesyonel bir şey olmalı."
- Karar: **"Önce ikisini dene."** 2–3 günlük pilotta gerçek bir ürün sayfası üzerinde **Puck** ve **Payload-native canvas** denenir; ölçülebilir kriterlerle biri seçilir. Paralelde ortak işler yürür: (a) animasyon efekt sistemi, (b) ürün sayfasının tamamen bloklara geçişi, (c) Payload 3.85.1 → 3.93.x güvenlik güncellemesi.

## Kalıcı kurallar (her faz için geçerli; ihlal = faz reddi)

1. **Tek veri kaynağı Payload `layout` bloklarıdır.** Opak JSON blob (`puckData`, `canvasState` vb.) saklanmaz. Editörün iç modeli yalnız bellekte yaşar.
2. **MCP, `content:import` ve TR/EN korunur.** Yeni alanlar config'ten şemaya otomatik gelir; `content/seed/schema.json` yeniden üretilir, MCP allowlist'i (`src/lib/mcp.ts`) değişmez.
3. **Yayın sayfasına editör JS'i gitmez.** Puck, köprü, araç çubuğu ve admin paneli kodu public chunk'lara girmez. Kanıt: `tests/unit/client-bundle-guard.test.ts` genişletilir; ana sayfa JS gzip ≤ bugünkü 129 KB (+1 KB tolerans).
4. **Mevcut güvenlik korunur.** `/api/preview` yalnız staff, draft yanıtları `private, no-store`, `readAs()` her istekte staff doğrular, `X-Frame-Options: SAMEORIGIN`, CSP Report-Only politikası daraltılmaz.
5. **Mevcut seçenek/alan adları ve `defaultValue` değerleri değişmez.** Yalnız ekleme yapılır. Yeniden adlandırma/silme SQLite'ta `__new_` tablo yeniden kurulumu ve veri kaybı demektir.
6. **Migration'lar önce DB kopyasında çalışır, `down()` güvenlidir.** Up'ta `DROP`/`DELETE`/`__new_` yok; down yalnız kendi kolon/tablo/indeksini kaldırır. Akış: `cp data/*.db $TMPDIR/softmarket-<ad>.db` → `DATABASE_URI` kopyaya → `pnpm migrate` → `pnpm content:import --dry-run` → `sqlite-integrity` + migration testi → canlı DB yedeği (WAL/SHM dahil) → canlı migrate.
7. 3100 dev sunucusuna, canlı DB'ye ve `.next` klasörüne yalnız açık görevle dokunulur. Build `NEXT_DIST_DIR=.next-<ad>`, QA portları 3200/3300/3400, pilot portları 3510/3520.

---

## 1. Karar özeti ve danışman karşılaştırması

### 1.1 Özet

- **Veri katmanı ortak, editör katmanı yarışır.** V0–V2 her iki editörün de ihtiyaç duyduğu şema ve render temelini kurar. Pilotlar (V3a/V3b) **şema değiştirmez**, yalnız admin tarafında ayrı dosya alanlarında çalışır.
- **Animasyon editörden bağımsızdır.** Preset sözleşmesi (`motion` grubu + CSS) her iki editörde aynı alanları yazar; seçilen editör bu paneli yalnız farklı yerde gösterir.
- **Wix'e yakın deneyim, Wix'in serbestliği değil.** Blok ekle/taşı/sil, metni yerinde düzenle, efekt kartı seç, cihaz önizle, TR/EN geç ve yayınla. Serbest piksel konumlandırma yok: marka tutarlılığı, mobil uyum ve LCP bunu gerektirir (Argon "Wix sendromu" riski).
- **Seçim kuralı:** önce zorunlu kapılar (veri kaybı 0, güvenlik, public bundle), sonra ağırlıklı puan (§V4). Puan farkı <10 ise düşük bakım riski olan seçenek (native) kazanır.

### 1.2 Danışman karşılaştırması

| Konu | GPT 6 Astra | Gemini 4 Argon | Plan kararı |
|---|---|---|---|
| Birincil yol | Puck (`@puckeditor/core` 0.24, MIT) custom view + Payload blok adaptörü | Live Preview iframe üzerine on-canvas köprü (`data-block-id`, `postMessage`, araç çubuğu) | **İkisi de pilotta** (kullanıcı kararı) |
| Yedek | Payload-native canvas | Puck + çift yönlü serileştirici | Pilot sonucu belirler |
| Paket adı | `@puckeditor/core` (`@measured/puck` eski ad) | `@measured/puck` | **Astra doğru**; V3a'da tam sürüm sabitlenir (`0.24.x`, caret yok) |
| Puck ve RSC | Editör client, `Render` RSC destekli; mevcut RSC renderer korunursa 0 ek public JS | "Editördeki bileşenler client olmak zorunda, RSC ayrımını zorlaştırır" | İkisi de kısmen doğru: **public render bizim RSC registry'miz kalır**; asıl risk canvas'ta RSC/veri bloklarının gerçeğe yakın görünmesi. V3a ölçer |
| what-digital/payload-inline-visual-editor | 1.0.1, MIT, `^3.85`; iyi uyum, ~11 yıldız, olgunluk düşük; pilotta değerlendir | Yok | V3b'nin **ilk yarım günü** zaman kutulu spike |
| Animasyon veri modeli | Panel: preset/trigger/yön/süre(ms)/gecikme/easing + "yeniden oynat"; sınırlar 150–800 ms, 0–300 ms | `appearance` altına düz alanlar; süre enum `fast/normal/slow`, gecikme `0/100/200/300` | **Ayrı `motion` grubu** (ayrı "Hareket" paneli) + **enum değerler** (Argon; geçersiz değer imkânsız) + **Astra sınırları** |
| Animasyon motoru | CSS + mevcut IntersectionObserver; parallax CSS scroll-driven + `@supports`; Motion/GSAP/Lottie/Rive yalnız ada | Aynı; GSAP/Motion bütçeyi deler | **CSS-first**, yeni runtime yok. GSAP lisansı (Webflow §9) nedeniyle **hariç** |
| LCP koruması | LCP öğesi gizlenmez/geciktirilmez | `render-plan.ts` ilk blok/hero gizleyici animasyonu otomatik kapatır | **Argon'un mekanizması** `planBlocks` içinde zorunlu |
| Ürün sayfası | Sabit hero/özellik/teknik tablo `layout` dışında; bağlı bloklar `productHero/productFeatures/productSpecs`, içerik kopyalanmaz | Değinmiyor | **Astra**; sürümler/indirmeler/doküman da bağlı blok (V2) |
| Products autosave | Yalnız `pages` 2 sn autosave; `products` ayrıca ele alınmalı | Yok | V2 migration'ına eklemeli `_products_v.autosave` |
| Çeviri tuzağı | Fallback metni çeviri olarak kaydetme | Yok | Editör EN'de `fallbackLocale: false` ile okur; testle kilitli |
| Eşzamanlılık | Tek kayıt kuyruğu, MCP/admin çatışması | Yok | V5'te Payload belge kilidi + `updatedAt` karşılaştırması |
| Payload güncelleme | 3.93.0 blok erişimi + yükleme güvenliği düzeltmeleri | Yok | **V0**, her şeyden önce |
| Efor | 25–40 kişi-gün (Puck); native eklentiyle 12–22 | Yok | V5 tahmini §V5'te iki senaryo |

Not: Sürüm, yıldız ve bundle rakamları danışman beyanıdır. V0 ve V3'te npm/GitHub sürüm notlarından doğrulanır, doğrulanmayan değer plana "doğrulanmadı" diye geçer.

---

## 2. Fazlar

Zaman çizelgesi (takvim günü; paralel kulvarlar):

| Gün | Sıralı (şema) kulvar | Paralel kulvar A | Paralel kulvar B |
|---|---|---|---|
| 1 | V0 Payload 3.93 | — | — |
| 2 | V1-S motion şeması → V2-S bağlı blok şeması | V1-C CSS sözleşmesi | — |
| 3–5 | (şema kilidi) | V3a Puck pilotu + V1-UI Hareket paneli | V3b native canvas pilotu + V2-R ürün renderer |
| 6 | V4 karşılaştırma + kullanıcı kararı | | |
| 7+ | V5 seçilen editör (2–3 hafta) | V6 QA/perf/kılavuz (V5 sonu) | |

### V0 — Payload 3.85.1 → 3.93.x güvenlik güncellemesi

- **Kapsam:** tüm `@payloadcms/*` ve `payload` paketleri aynı 3.93.x sürümüne (tam sabit sürüm). 3.86–3.93 sürüm notları tek tek okunur: kırıcı değişiklik, SQLite adaptörü, MCP plugin (`overrideAuth`, araç sayısı), live-preview-react, Lexical, `payload-mcp-api-keys`. Peer bağımlılıkta Next 15.4.11 ve React 19.2.6 uyumu doğrulanır; Next yükseltmesi gerekiyorsa **durulur ve kullanıcıya sorulur** (bu planın kapsamı dışı).
- **Dosyalar:** `package.json`, `pnpm-lock.yaml`, `src/payload-types.ts`, `src/app/(payload)/admin/importMap.js`, gerekirse `src/lib/mcp.ts` ve `src/lib/preview-url.ts` uyum düzeltmesi. `techContext.md`, `AGENTS.md` ("Payload MCP (3.85.1)" başlığı) sürüm notu.
- **Migration:** `pnpm migrate:create v0_payload_393`. Beklenen: "No schema changes". Değişiklik çıkarsa (sürüm tabloları, kilit tabloları vb.) SQL kural 6'ya göre incelenir; `__new_` varsa elle güvenli up/down yazılır.
- **Kabul:** typecheck/lint, `pnpm test --maxWorkers=1` tamamı yeşil (bugün 54 dosya/696 test). `mcp.test.ts` + taze handler ile MCP araç listesi (69 ± sürüm farkı, fark kayıtlı), anonim 401, editor/customer reddi. `live-preview*.test.ts` yeşil. Kopya DB'de `.next-v0` build + 3200 duman testi (TR/EN, admin, ürün, preview 401/403). `pnpm test:e2e:isolated` yeşil. Admin etiket testi (`admin-labels.test.ts`) yeşil. Live Preview breakpoint `label` hâlâ düz string.
- **Testler:** mevcut paket. Yeni: `tests/unit/payload-version.test.ts` (tüm `@payloadcms/*` aynı sürüm).
- **Riskler:** MCP plugin iç API değişimi (Proxy sarmalı `req.payload`), HMR'nin authStrategies kaydını yenilememesi (restart gerekir: kullanıcıya bildirilir), Lexical node şema değişimi. Geri dönüş: lock dosyası git revert + DB snapshot.
- **Bağımlılık:** yok. **Her şeyden önce**, çünkü pilotlar ve what-digital eklentisi hedef sürümde denenmeli.

### V1 — Animasyon preset sistemi

Üç alt iş: **V1-S** şema (sıralı), **V1-C** CSS/render sözleşmesi, **V1-UI** admin "Hareket" paneli (paralel).

**V1-S veri modeli.** Her bloğa (`layoutBlocks`, `pageBlocks`, V2 bağlı bloklar) `appearance`'tan ayrı, eklemeli bir `motion` grubu. Tek kaynak yeni saf modül `src/fields/block-motion.ts` (`MOTION_*` sabitleri, `motionSettings()` alan fabrikası, `resolveMotion()`), `block-settings.ts` ile aynı desen.

| Alan | Tip / seçenekler | Varsayılan | Not |
|---|---|---|---|
| `motion.preset` | `auto`, `none`, `fade`, `fade-up`, `slide-left`, `slide-right`, `zoom-in`, `parallax-soft` | `auto` | `auto` = bugünkü davranış (`appearance.animation` `subtle` → fade-up 12 px). Mevcut veri birebir aynı görünür |
| `motion.trigger` | `scroll`, `load`, `hover` | `scroll` | `scroll` = görünür olunca bir kez; `load` = sayfa açılışında CSS keyframe; `hover` = kart/öğe üzerinde |
| `motion.duration` | `fast` (240 ms), `base` (560 ms), `slow` (800 ms) | `base` | Sınır 150–800 ms |
| `motion.delay` | `0`, `100`, `200`, `300` | `0` | ms |
| `motion.easing` | `soft`, `standard`, `emphasized` | `soft` | `--ease-out-soft` / `--ease-standard` / yeni token |
| `motion.stagger` | `none`, `tight` (60 ms), `relaxed` (100 ms) | `tight` | Yalnız öğeli bloklar (grid, kart); en çok 4 adım, toplam ≤ 300 ms |
| `motion.mobile` | checkbox | `false` | Yalnız `parallax-soft` için: mobilde de çalışsın mı |

- Kolonlar: `motion_preset` vb. Uzun blok tablo adlarında enum adı 63 karakteri aşar: `appearanceEnumName` desenindeki kısaltıcı (`motionEnumName`) zorunlu (F3 `productFamilies` dersi).
- `appearance.animation` (`subtle|none`) **aynen kalır** ve ana anahtardır: `none` ise `motion` yok sayılır. Etiketi "Animasyon (aç/kapat)" olarak güncellenebilir (etiket şema değildir).
- **Öncelik zinciri (devre kesici):** `prefers-reduced-motion: reduce` → `html[data-motion="none"]` (site ayarı) → `appearance.animation: none` → `motion.preset`. İlk eşleşen kazanır.
- Migration `v1_block_motion`: yalnız `ADD COLUMN` (5 koleksiyon `pages/products/solutions/case-studies/product-families` × normal + `_v` × tüm blok tabloları). Kolon varsayılanları = tablo varsayılanları; mevcut satırlar `auto` alır. Down yalnız bu kolonları düşürür. Test: `tests/unit/block-motion-migration.test.ts` (kopya DB, up/down veri koruma, SQL'de yasak ifade yok).

**V1-C CSS sözleşmesi ve render.**
- `BlockShell` ve `anim()` sunucuda yalnız öznitelik basar: `data-anim="<preset>"` (`auto` → `subtle`, geriye uyum), `data-anim-trigger`, `style="--anim-dur;--anim-delay;--anim-ease;--i"`. JS'siz ve SSR HTML'de içerik daima görünür.
- `globals.css` motion bölümü: her preset için `[data-anim="<preset>"][data-anim-state="pending"]` başlangıç durumu (yalnız `opacity` + `transform`). `scroll` mevcut tek `MotionObserver` ile çalışır; yeni gözlemci yok.
- `load`: CSS keyframe `backwards` (hero deseni). `hover`: `:hover`/`:focus-within`, yalnız transform. `parallax-soft`: `@supports (animation-timeline: view())` + `prefers-reduced-motion: no-preference` + varsayılan `@media (min-width: 768px)`. Desteklemeyen tarayıcı statik görür, JS yok.
- **LCP koruması (`src/lib/blocks/render-plan.ts`, zorunlu):** `pageTop` bloğu, ilk görünür blok ve her `hero`/`productHero` için preset `fade`/`zoom-in`/`fade-up` ise translate-only'ye düşürülür. `load` tetikleyicisi bu bloklarda `opacity 0`'dan başlamaz. `priority` görseli taşıyan blok gizlenmez. `planBlocks` testleri bunu kilitler.
- `html[data-motion="none"]` kuralları yeni preset seçicilerini kapsar.
- Yasak: layout özellikleri, `filter: blur`, `box-shadow` ve `backdrop-filter` animasyonu; sayı sayacı; JS animasyon kütüphanesi (Motion/GSAP). Lottie/Rive bu planın kapsamı dışında.

**V1-UI admin "Hareket" paneli.**
- Her blokta "Görünüm"ün yanında ayrı collapsible "Hareket". `motion.preset` için özel admin alan bileşeni (`src/admin/fields/motion-preset-cards.tsx`, Payload `admin.components.Field`): ikon + ad + 1 satır açıklama içeren **preset kartları**. Kartın üstünde saf CSS **canlı mini önizleme** (gri kutu, seçili süre/easing/gecikme ile) ve "Tekrar oynat" düğmesi.
- Ayrıntılar (tetikleyici, süre, gecikme, easing, stagger, mobil) kartların altında "Gelişmiş" bölümünde.
- Blok tipine göre filtre: hero/bağlı hero kartlarında yalnız LCP güvenli presetler gösterilir. Sunucu tarafında `validate` aynı kuralı uygular (admin atlatılırsa render-plan zaten düşürür).
- Etiketler `src/lib/admin-i18n.ts` sözlüğüne TR/EN girilir; `admin-labels.test.ts` yeşil.
- Bileşen admin import map'inde yaşar, `(frontend)` ağacından import edilmez (bundle guard).

**Kabul (V1):** mevcut tüm sayfaların 1440/390 ekran görüntüsü farkı ≈0 (`auto` = eski görünüm). Her preset × tetikleyici için Playwright: reduced-motion emülasyonunda transform yok, `data-motion=none`'da statik, JS kapalıyken içerik görünür. İlk blokta `opacity:0` hiçbir koşulda yok. CLS 0, TBT değişmez, CSS gzip artışı ≤ 2 KB. MCP `updatePages` ile `motion` yazılıp okunur; `content:import` fixture 2× idempotent; `schema.json` senkron testi yeşil.
**Testler:** `motion.test.ts` genişlet, yeni `block-motion.test.ts` (resolveMotion, öncelik zinciri, LCP düşürme), migration testi, e2e `tests/e2e/motion-presets.spec.ts`.
**Riskler:** enum ad uzunluğu, aşırı animasyon (preset sayısı sabit, serbest değer yok), Safari scroll-driven desteği (`@supports` ile statik).
**Bağımlılık:** V1-S → V0 sonrası. V1-C ve V1-UI → V1-S sonrası, pilotlarla paralel.

### V2 — Ürün sayfası bağlı bloklar (kompozisyon)

**Hedef:** `src/app/(frontend)/[locale]/urunler/[family]/[product]/page.tsx` bugün hero, sekme çubuğu, genel bakış, özellikler, teknik özellikler, sürümler, indirmeler ve dokümantasyon bölümlerini sabit sırayla çiziyor. `layout` yalnız "ek bloklar" olarak sona ekleniyor ve hero/featureGrid/specTable tekrarları filtreleniyor. Hedefte her bölüm taşınabilir, gizlenebilir ve animasyonlanabilir bir blok olur. **İçerik kopyalanmaz**: bağlı bloklar ürün alanlarını (`title/tagline/summary/heroImage/features/specs/systemRequirements/brochure`, `editions/downloads/docs` join'leri) render anında okur.

**V2-S şema:**
- Yeni bloklar (yalnız `products.layout`; `src/blocks/product-bound.ts`): `productHero`, `productNav` (yapışkan sekme çubuğu), `productOverview`, `productFeatures`, `productSpecs` (`showRequirements` checkbox, varsayılan `true`), `productEditions`, `productDownloads`, `productDocs`.
- İçerik alanı yok. Yalnız `appearance` + `motion` ve en çok bir-iki görünüm seçeneği (ör. `productHero.layout: split|centered`). Bölüm başlıkları i18n'den gelir.
- `productBlocks = [...layoutBlocks, ...productBoundBlocks]` yalnız `Products` `layoutField({ blocks: productBlocks })`. `layoutBlocks` ve `pageBlocks` değişmez, diğer koleksiyonlarda tablo oluşmaz.
- `layout` alanına `validate`: her bağlı blok en çok 1 kez. `productHero` varsa ilk görünür blok olmalı (h1 + LCP).
- `Products.versions`: `drafts.autosave: { interval: 2000 }` (canvas/Live Preview döngüsü). `draftVersions` ortak sabiti değişmez; Products kendi değerini alır.
- Migration `v2_product_bound_blocks`: `CREATE TABLE products_blocks_product_*` + `_v` + indeksler + `ALTER TABLE _products_v ADD autosave` (+ indeks). V1-S'den sonra oluşturulur, böylece tablolar `motion_*` kolonlarıyla doğar. Down yalnız bu tablo/kolonları kaldırır.

**V2-R render:**
- Saf fonksiyon `src/lib/blocks/product-composition.ts` → `composeProductLayout(layout)`:
  - **Uyumluluk modu (layout'ta hiç bağlı blok yok):** sanal varsayılan sıra `[productHero, productNav, productOverview, productFeatures, productSpecs, productEditions, productDownloads, productDocs, ...ekBloklar]` üretilir. Ek bloklara bugünkü filtre (hero/featureGrid/specTable tekrarı) aynen uygulanır. **Eski sayfalar piksel olarak aynı görünür.** Sanal blokların kararlı `id`'si (`virtual:productHero`) vardır ama DB'ye yazılmaz.
  - **Kompozisyon modu (en az bir bağlı blok):** `layout` sırası aynen render edilir. Listede olmayan bağlı bölüm görünmez (editör bilerek kaldırmıştır). Filtre uygulanmaz.
- Bağlı bloklar `RenderBlocks` → `registry` → `BlockShell` akışından geçer. Ürün verisi `BlockSlots`'un genişletilmiş hâli `slots.product` ile verilir (`listing` deseni). Sayfa bileşeni yalnız veri yükler, JSON-LD/metadata/alternates üretir ve `RenderBlocks`'u çağırır.
- `productNav` linkleri o an görünür bağlı bloklardan türetilir. Bölüm id'leri (`genel-bakis`, `ozellikler`, `teknik-ozellikler`, `surumler`, `indirmeler`, `dokumantasyon`) sabit ve zaten `RESERVED_ANCHORS` içinde.
- h1 tek: `productHero` h1, `layout`'taki `hero` blokları h2 (mevcut kural).
- "Teklif İste" `productHero` içinde zorunlu birincil eylemdir. `productHero` kaldırılırsa sayfa varsayılan hero'yu yine çizer (satış akışı korunur).
- Editör tarafı: "Görsel düzenle" ilk açılışta uyumluluk modundaki sanal listeyi **editörde** somutlaştırır. Kaydedilince `layout`'a yalnız referans bloklar yazılır, içerik kopyası yazılmaz.

**Dosyalar:** `src/blocks/product-bound.ts`, `src/blocks/index.ts` (`productBlocks` ekleme), `src/collections/Products.ts`, `src/components/blocks/product/*.tsx` (mevcut `PageHero`, `FeatureGrid`, `SpecTable`, `EditionCard` yeniden kullanılır), `registry.ts`, `types.ts`, `product-composition.ts`, ürün `page.tsx` (sadeleşir), `admin-i18n.ts`, `content/seed/schema.json`, migration + json.
**Kabul:** tüm seed ürünlerinde uyumluluk modu ekran görüntüsü farkı 0 (1440/390, TR/EN). Kompozisyon modunda hero'yu özelliklerin altına taşıma, indirmeleri kaldırma ve sürümlere `slide-left` verme senaryoları doğru render olur. ISR HIT/0 sorgu korunur, ürün sorgu sayısı ≤ 15. JSON-LD/hreflang aynı. MCP `updateProducts` ile layout'a `productEditions` eklenir/sıralanır. `content:import` fixture idempotent. Products autosave yalnız `_products_v`'ye yazar ve ISR'ı yenilemez (revalidate testi).
**Testler:** `product-composition.test.ts` (iki mod, filtre, tekil kural, nav türetme), `product-bound-db.test.ts` (geçici SQLite, TR/EN, round-trip), migration testi, e2e `product-composition.spec.ts`, `frontend-routing` regresyonu.
**Riskler:** uyumluluk ↔ kompozisyon geçişinde beklenmedik kayıp. Önlem: kompozisyon moduna geçen ilk kayıtta eksik bağlı bölümler admin'de uyarı rozetiyle gösterilir. Ek risk: sticky nav + `scroll-mt` hesapları.
**Bağımlılık:** V2-S → V1-S sonrası. V2-R → V2-S sonrası, pilotlarla paralel. Pilotlar ürün sayfasını V2-R hazır olduğunda kompozisyon modunda dener; hazır değilse uyumluluk modunda sanal liste ile başlar.

### V3a — Puck pilotu (2–3 gün, dal `pilot/puck`)

- **Kapsam:** `products` belge ekranında "Görsel düzenle" (Payload custom edit view) → tam ekran Puck. Solda blok kataloğu, ortada canvas, sağda İçerik/Görünüm/Hareket; üstte TR/EN, 390/768/1440, geri al, taslak, yayınla.
- **Adaptör (çekirdek):** `src/editor/puck/adapter.ts` → `payloadToPuck(layout, locale)` / `puckToPayload(data)`. `blockType ↔ type`, `id ↔ props.id`. Payload `Block.fields` → Puck field config otomatik üretilir (text/textarea/select/number/checkbox/array/group). `upload`/`relationship`/`richText` için Payload drawer'ını açan özel alanlar kullanılır. **Lexical Tiptap'e çevrilmez**: richText yalnız yan panelde Payload Lexical alanıyla düzenlenir. Inline metin yalnız düz metin alanlarında.
- **Canvas görünümü:** sunum blokları admin bundle'ında client-safe sürümle gösterilir. Veri/RSC blokları (productFamilies, newsList, bağlı ürün blokları) için iki seçenek denenir: (1) staff-only `/api/editor/block-preview` HTML parçası, (2) yer tutucu kart. Gerçek görünüm referansı Live Preview iframe'idir.
- **Kayıt:** Payload REST/Local API (staff oturumu, `overrideAccess:false`, draft). EN düzenlemede `fallbackLocale: false` ile okunur. Yalnız `localized` alanlar seçili dile yazılır; blok/satır id'leri iki dilde korunur.
- **Ölçülecek:** §V4 görevleri, round-trip testi, canvas eşdeğerliği (blokların yüzde kaçı gerçek görünüm), admin bundle boyutu, public bundle'da `@puckeditor` izi.
- **Dosya alanı:** yalnız `src/editor/puck/**`, `src/admin/views/visual-puck.tsx`, `docs/editor-pilot/puck.md`. Config'e tek satırlık kayıt. Yeni bağımlılık `@puckeditor/core` tam sürüm.

### V3b — Payload-native canvas pilotu (2–3 gün, dal `pilot/native-canvas`)

- **İlk yarım gün (zaman kutusu): what-digital/payload-inline-visual-editor spike.** 3.93 üzerinde kur, bir ürün sayfasında ekle/çoğalt/sil/sırala, locale ve yayın akışını dene. Kapılar: veri round-trip 0 fark, public bundle temiz, preview güvenliği bozulmuyor, kod okunabilir/fork edilebilir (lisans MIT). Geçerse kalan pilot bunun üzerine kurulur (pinned + gerekirse `vendor/` fork). Geçmezse özel köprüye geçilir.
- **Özel köprü (Argon tasarımı):**
  - `planBlocks`'a `editing` bayrağı (yalnız `getPreviewUser()` staff döndüğünde). `BlockShell` bu bayrakla `data-block-id`, `data-block-path="layout.N"` basar. Düz metin alanları `data-field-path` taşır. Public/ISR HTML'de bu öznitelikler **yok**.
  - `src/editor/canvas/bridge.tsx` (client): yalnız draft+staff iken `LivePreviewRefresh` yanında `next/dynamic` ile ayrı chunk olarak yüklenir. Hover çerçevesi, seçili blok araç çubuğu (yukarı/aşağı, sürükle, çoğalt, gizle, sil, "+ blok ekle") ve düz metin için `contenteditable` (yalnız `textContent`) sunar.
  - `src/editor/canvas/admin-host.tsx` (admin): Live Preview yanında dinleyici. Mesajı Payload form API ile satır taşı/ekle/sil ve alan değeri olarak uygular, ilgili bloğun alan çekmecesini (Görünüm/Hareket dahil) açar. Autosave (2 sn) → `RefreshRouteOnSave` → iframe yenilenir. Form API adları pilotta doğrulanır.
  - Mesaj güvenliği: iki yönde `event.origin === location.origin` ve `event.source` eşleşmesi (iframe ↔ parent). Zod şemalı allowlist mesaj tipleri. Köprü API'ye doğrudan yazmaz, tüm yazım Payload formu → sunucu doğrulaması/erişim zincirinden geçer.
- **Ölçülecek:** aynı §V4 görevleri. Ek olarak inline yazarken autosave yenilemesinin caret'i bozup bozmadığı ve 2 sn döngü gecikmesi.
- **Dosya alanı:** `src/editor/canvas/**`, `render-plan.ts`/`block-shell.tsx`'te yalnız `editing` bayrağı (küçük, V5'te ana dala alınabilir), `docs/editor-pilot/canvas.md`.

**Pilot ortak kuralları:**
- Git worktree ile ayrı dizin (`../softmarket-pilot-puck`, `../softmarket-pilot-canvas`). Her biri kendi DB + uploads kopyası (`$TMPDIR/softmarket-pilot-<ad>.db`), kendi `.next-pilot-<ad>`, portu 3510/3520. Canlı DB ve 3100 kullanılmaz.
- **Pilot dallarında migration, `src/blocks/**`, `src/fields/**`, `src/collections/**` şema değişikliği yasak.** Denetim: `git diff main -- src/migrations src/blocks src/fields src/collections` boş olmalı (tek kayıt satırı hariç).
- Pilotlar ana daldaki V1/V2 ilerlemesini `git rebase main` ile alır. Ana dala pilot dalından doğrudan merge **yapılmaz**.
- Pilot kodu atılabilir kalitededir. Çıktılar: çalışır demo, `docs/editor-pilot/<ad>.md` (ölçümler, ekran kaydı yolu, sorunlar, V5 efor tahmini), `docs/editor-pilot/<ad>-metrics.json`.

### V4 — Pilot karşılaştırması ve karar (0,5 gün)

**Zorunlu kapılar** (biri bile kalırsa aday elenir):

| Kapı | Ölçüm | Eşik |
|---|---|---|
| Veri round-trip | Kopya DB'de ürün + ana sayfa: editörde aç → değiştirmeden kaydet → `layout` TR/EN derin karşılaştırma (`updatedAt` hariç) | **0 fark** |
| Lexical korunumu | Zengin metin içeren bloklar (richText, systemRequirements, tabs) round-trip sonrası node JSON'u | Birebir aynı |
| TR/EN | EN'de metin düzenle → TR değişmemiş; boş EN alanına TR fallback yazılmamış | 0 sızıntı |
| Public bundle | `.next-pilot-*` build: frontend chunk'larında editör paketleri/köprü izi; ana sayfa JS gzip | İz yok; ≤ 130 KB |
| Güvenlik | Anonim/customer editör görünümü ve preview; `postMessage` sahte origin/source; draft `no-store`; mevcut preview testleri | Tümü reddedilir/yeşil |
| MCP/import | Editör kaydından sonra MCP `find` + `content:import --dry-run` | Hatasız |

**Ağırlıklı puan (100):**

| Ölçüt | Ağırlık | Nasıl ölçülür |
|---|---|---|
| Editör deneyimi görevleri | 35 | Teknik olmayan kullanıcı (tercihen sizin), ekran kaydıyla 8 görev: T1 blok ekle (CTA), T2 taşı (Sürümler'i Özellikler'in üstüne), T3 sil, T4 başlık metnini yerinde düzenle, T5 bir bloğa "Kayarak gel" + yavaş süre ver, T6 EN'e geç ve aynı başlığı çevir, T7 390/1440 önizle, T8 yayınla. Görev başına süre (hedef ≤ 30 sn, toplam ≤ 5 dk), hata/yardım sayısı, 1–5 memnuniyet |
| Canvas–yayın eşdeğerliği | 15 | Canvas ve yayın ekran görüntüsü; gerçek görünümle çizilen blok oranı (hedef ≥ %80) |
| Bakım riski | 20 | Yeni bağımlılık sayısı/boyutu, 0.x/olgunluk, Payload iç API'sine bağımlı import sayısı, fork gerekliliği, sürüm temposu |
| V5 eforu | 20 | Pilot raporundaki kişi-gün tahmini, Opus'un bağımsız incelemesiyle |
| Performans/erişilebilirlik | 10 | Admin editör açılış süresi, etkileşim gecikmesi, klavye ile blok taşıma |

**Karar kuralı:** kapıları geçenler arasında en yüksek puan. Fark < 10 ise native kazanır (sıfır veri dönüşümü, daha az bağımlılık). Sonuç tek sayfalık karar notu olarak `docs/editor-pilot/decision.md`'ye yazılır ve kullanıcı onayına sunulur.

### V5 — Seçilen editörün tam uygulaması

- **Ortak kapsam:** `pages` + `products` (ilk dalga). `solutions`, `case-studies`, `product-families` ikinci dalga. Tüm bloklar (21 + 8 bağlı), Hareket paneli entegrasyonu, geri al/yinele, autosave kuyruğu, eşzamanlılık (Payload belge kilidi + `updatedAt` karşılaştırması; MCP yazımıyla çatışmada kullanıcıya "yeniden yükle" uyarısı), klavye erişimi (blok seç/taşı), editör rehber turu (ilk açılışta 4 adımlık ipucu).
- **Puck seçilirse:** adaptörün tüm alan tiplerine genişletilmesi, Payload drawer köprüleri (medya/ilişki/Lexical), canvas önizleme stratejisi, `@puckeditor/core` sürüm sabitleme + güncelleme notu. Tahmin **10–15 iş günü**.
- **Native seçilirse:** köprünün (veya what-digital fork'unun) sertleştirilmesi, inline metin kapsamı, blok ekleme paleti (kart + küçük önizleme görseli `public/admin/blocks/*.webp`), çekmece odaklama, sürükle-bırak. Tahmin **6–10 iş günü**.
- **Pilot kodunun alınması:** ana daldan yeni dal `feat/visual-editor`. Kazanan pilottan yalnız gözden geçirilmiş modüller (adaptör/köprü, testler) dosya bazında taşınır ve yeniden denetlenir. Kaybeden dal `archive/pilot-<ad>` etiketiyle saklanıp silinir; raporu `docs/editor-pilot/` altında kalır.
- **Kabul:** V4 kapılarının tamamı tüm bloklarda. 8 görev hedef sürede. Mevcut e2e/izolasyon testleri yeşil. Admin'de "Görsel düzenle" yalnız staff'a görünür.
- **Testler:** adaptör/köprü birim testleri (her blok tipi için round-trip fixture), `visual-editor-db.test.ts` (geçici SQLite, TR/EN, Lexical), e2e `visual-editor.spec.ts` (8 görev otomasyonu, isolated 3400), bundle guard, güvenlik e2e (sahte postMessage, anonim erişim).
- **Riskler:** Payload admin iç API değişimi (her Payload güncellemesinde editör e2e'si zorunlu), autosave + inline caret çakışması, büyük sayfada canvas performansı.

### V6 — QA, performans, kabul ve kılavuz

- 432'lik görsel tur yeniden (`scripts/qa-screenshots.mjs`) + preset galerisi sayfası (`pageType: template`, noindex).
- Lighthouse 3 koşu medyan (`scripts/perf-lighthouse.mjs`): metin sayfaları LCP < 2.0 s korunur. Görselli LCP F11 değerinden (2.53 s) **kötüleşmez**. JS ≤ 130 KB, CLS 0, TBT < 150 ms. Animasyonlu ürün sayfasında INP vekili < 200 ms.
- Güvenlik denetimi: preview, köprü mesajları, editör görünümü erişimi, MCP, upload (3.93 düzeltmeleri dahil).
- `docs/editor-guide.md`: "Görsel düzenle", blok taşıma, Hareket paneli (preset kartları, ne zaman kullanılmaz), ürün sayfası bölümleri, TR/EN akışı, sık hatalar. `AGENTS.md`: `motion` alanları, bağlı ürün blokları, MCP tarifi (ürün layout sırası). `memory-bank` güncellemesi.
- **Kabul:** `docs/perf/visual-editor-acceptance.md` tablosu yeşil + kullanıcı onayı.

---

## 3. Paralellik ve sıralama kuralları

- **Şema değiştiren işler kesin sıralı:** V0 → V1-S → V2-S. Aynı anda iki açık migration dalı olmaz. Önceki deneyimde paralel `migrate:create` snapshot JSON'larını çakıştırdı ve üretilen down'lar `__new_` yeniden kurulumu içerdi. Her migration ana dala alınmadan sonraki `migrate:create` başlamaz.
- **Şema değiştirmeyen işler paralel:** V1-C, V1-UI, V2-R, V3a, V3b. Dosya sahipliği ayrıdır:
  - V1-C: `globals.css` motion bölümü, `src/lib/anim.ts`, `src/lib/motion.ts`
  - V1-UI: `src/admin/fields/**`, `admin-i18n.ts`
  - V2-R: `src/components/blocks/product/**`, `product-composition.ts`, ürün `page.tsx`
  - V3a: `src/editor/puck/**`
  - V3b: `src/editor/canvas/**`
  - Ortak dosyalar (`block-shell.tsx`, `render-plan.ts`, `registry.ts`, `payload.config.ts`) tek sahibe verilir (V1-C/V2-R sırayla). Pilotlar bu dosyalarda yalnız rebase ile gelen değişikliği kullanır. V3b'nin `editing` bayrağı küçük bir yamadır ve V2-R sahibine iletilir.
- `pnpm generate:types` / `generate:importmap` yalnız şema sahibinde çalışır. Pilotlar importmap'i yalnız kendi dalında yeniden üretir.
- Build ile typecheck eşzamanlı çalıştırılmaz (`.next-*/types` yarışı). Ağır SQLite testleri `--maxWorkers=1`.
- Her faz sonunda çapraz QA geçmeden sonraki şema fazı başlamaz.

---

## 4. Ajan dağılımı

Kurallar: Opus 5.5 Medium çekirdek mimari, Opus High yalnız en kritik veri yolu. Sonnet 5.5 yalnız Medium/Low (asla High). Terra odaklı teşhis/perf/QA (uzun çok adımlı fazlar verilmez). Sol migration/upgrade/test/net görevler + QA. Haiku Low etiket/çeviri/kılavuz + commit operatörü. **Yazan ≠ denetleyen**: Claude yazdıysa Sol veya Terra High denetler, GPT yazdıysa Opus Medium denetler.

| Faz | Yazan (effort) | Denetleyen (effort) | Not |
|---|---|---|---|
| V0 Payload 3.93 | GPT 6.1 Sol (High) | Claude Opus 5.5 (Medium) | Net upgrade + test; sürüm notu taraması dahil |
| V1-S motion şeması + `block-motion.ts` | Claude Opus 5.5 (Medium) | GPT 6.1 Sol (High) | Migration SQL'ini Sol denetler (kural 6) |
| V1-C CSS sözleşmesi + LCP koruması | Claude Sonnet 5.5 (Medium) | GPT 6.1 Terra (High) | Terra: LCP/CLS/reduced-motion ölçümü |
| V1-UI Hareket paneli + preset kartları | Claude Sonnet 5.5 (Medium) | GPT 6.1 Sol (High) | Bundle guard + a11y kontrolü |
| V1 etiketler TR/EN | Claude Haiku 5.5 (Low) | GPT 6.1 Sol (Medium) | `admin-i18n.ts` |
| V2-S bağlı blok şeması + autosave | Claude Opus 5.5 (Medium) | GPT 6.1 Sol (High) | |
| V2-R `composeProductLayout` + renderer | Claude Opus 5.5 (Medium) | GPT 6.1 Terra (High) | Görsel eşdeğerlik + sorgu sayısı |
| V2 blok bileşenleri (görsel) | Claude Sonnet 5.5 (Medium) | GPT 6.1 Terra (High) | Mevcut bileşenleri sarar |
| V3a Puck adaptörü | Claude Opus 5.5 (Medium) | GPT 6.1 Sol (High) | Round-trip testleri Sol'un denetiminde |
| V3a Puck UI kabuğu | Claude Sonnet 5.5 (Medium) | GPT 6.1 Sol (High) | |
| V3b what-digital spike | GPT 6.1 Terra (High) | Claude Opus 5.5 (Medium) | Yarım gün zaman kutusu, odaklı teşhis |
| V3b köprü (bridge + admin-host) | Claude Opus 5.5 (Medium) | GPT 6.1 Terra (High) | postMessage güvenliği Terra |
| V3b araç çubuğu UI | Claude Sonnet 5.5 (Medium) | GPT 6.1 Sol (High) | |
| V4 ölçüm + metrik toplama | GPT 6.1 Sol (Medium) | Claude Opus 5.5 (Medium) | Kapı testleri ve bundle ölçümü; karar notu Opus + kullanıcı |
| V5 çekirdek veri yolu (adaptör/köprü kayıt, locale, çatışma) | **Claude Opus 5.5 (High)** | GPT 6.1 Sol (High) + Terra (High) güvenlik | Planın en kritik işi; tek Opus High noktası |
| V5 UI/panel/palet | Claude Sonnet 5.5 (Medium) | GPT 6.1 Sol (High) | |
| V5 testler (fixture round-trip, e2e 8 görev) | GPT 6.1 Sol (Medium) | Claude Opus 5.5 (Medium) | |
| V6 perf/QA | GPT 6.1 Terra (High) | Claude Opus 5.5 (Medium) | Ölçüm odaklı, kısa görevlere bölünür |
| V6 kılavuz + AGENTS.md + memory-bank | Claude Haiku 5.5 (Low) | GPT 6.1 Sol (Medium) | |
| Her faz sonu commit | Claude Haiku 5.5 (Low) | — | Yalnız QA yeşilken; basit mesaj |

Kota dengesi: V1-S, V2-S/R ve V3 Claude yoğun olduğundan V4 ölçümü ve V6 GPT ağırlıklıdır.

---

## 5. Açık sorular (kullanıcıya)

1. **Serbestlik düzeyi:** Önerimiz Wix'teki serbest piksel konumlandırma yerine blok ve ızgara içinde düzenleme. İlk sürümde blok içinde iç içe sütun/slot (ör. iki sütunlu bölüm içine başka blok) de istiyor musunuz, yoksa tek seviyeli blok listesi yeterli mi?
2. **Ürün sayfasının sabit kalacak kısımları:** "Teklif İste" düğmesi her ürün sayfasında zorunlu kalsın mı? İndirmeler, Dokümantasyon ve yapışkan sekme çubuğu editörün kaldırabileceği bölümler mi olsun, yoksa yalnız yeri mi değişsin?
3. **Pilot değerlendirmesi:** 8 görevlik editör testini (yaklaşık 30–45 dakika, iki editör) sizin yapmanızı öneriyoruz. Uygun musunuz? Uygunsanız sizin memnuniyet puanınız kararda belirleyici (35 puanın tamamı) olsun mu?

## V0 uygulama kaydı — 2026-11-08

Hedef npm `latest` ve GitHub kararlı release ile doğrulandı: **3.93.0**. `payload` + 10 doğrudan `@payloadcms/*` paketi ve lock'taki geçişli Payload paketleri aynı sürümde. Next **15.4.11**, React/React-DOM **19.2.6**, TypeScript **5.7.3** korunur. `@payloadcms/next` peer aralığı `>=15.4.11 <15.5.0`'ı; UI/Lexical React aralığı `^19.2.1`'i içerir; Next yükseltmesi gerekmiyor.

### İncelenen GitHub sürüm notları ve proje etkisi

| Sürüm | Önemli değişiklik ve uygulama kararı |
|---|---|
| [3.86.0](https://github.com/payloadcms/payload/releases/tag/v3.86.0) | Form Builder çevirileri; Live Preview `openByDefault` seçeneği; URL pathname regex güvenliği ve draft reupload. Mevcut TR/EN etiketleri/preview ayarı korunur; yeni seçeneği açmak gerekmez. |
| [3.87.0](https://github.com/payloadcms/payload/releases/tag/v3.87.0) | Tab localization, count locale aktarımı, null array/blok, Drizzle lokalize blok dedup ve tablo adı uzunluk denetimi. Mevcut sınırlı `find` slug koruması korunur; şema üretimi çakışma hatası vermedi. Template preview güvenlik düzeltmesi mevcut staff-only preview ile uyumlu. |
| [3.87.1](https://github.com/payloadcms/payload/releases/tag/v3.87.1) | Next sürümüne göre HMR endpoint'i; MCP SDK **1.30.0** güvenlik düzeltmesi; Lexical link drawer durumu. AuthStrategies HMR yenilendiği varsayılmadı; dev yeniden başlatılmadı. |
| [3.88.0](https://github.com/payloadcms/payload/releases/tag/v3.88.0) | Multipart Content-Type backtracking; blok/array clipboard satır sızıntısı; MCP API key koleksiyonunun varsayılan erişimleri sıkılaşır. Projenin daha dar açık `nobody` politikaları korunur. Template Next 16 yükseltmesi bu projeye zorunlu peer değildir. |
| [3.89.0](https://github.com/payloadcms/payload/releases/tag/v3.89.0) | **Breaking:** jobs erişim varsayılanları. Projede özel jobs/deneysel MCP jobs yok. Drizzle hasMany select, isim çakışmaları; sürüm diff, read-only rich text, hızlı title girişi ve geçersiz preview URL düzeltmeleri. |
| [3.90.0](https://github.com/payloadcms/payload/releases/tag/v3.90.0) | Kritik güvenlik ve **SQL migration zorunluluğu**: auth `resetPasswordRequestedAt`. Şifre değişiminde session iptali, forgot/reset lockout-throttle; API key yalnız ilk üretimde görünür. SVG/XML doğrulama, güvenli dış fetch/origin, upload filename ve client upload receipt/prefix korumaları; multipart varsayılanı **50 MB**. Eski güvenliği gevşeten `reveal`, `allowRestrictedFileTypes`, `skipSafeFetch` açılmadı. Yerel storage kullanıldığı için cloud `_objectKey` kolonu oluşmadı; cloud CORS/prefix ayarı gerekmez. Form erişim override'ları zaten açık. Polymorphic join kısıtlarına yeni geçersiz sorgu çıkmadı. Lexical **0.50.0**: built-in içerikte veri dönüşümü gerekmez, doğrudan Lexical bağımlılığı/özel node yok. Kopya ve canlı yedekte jobs tablosu/planlanmış iş yok; yeniden kuyruklama gerekmedi. |
| [3.90.1](https://github.com/payloadcms/payload/releases/tag/v3.90.1) | Üst `where` sorgusunun iç ilişkilere taşınması düzeltildi. Özel yama gerekmedi. |
| [3.90.2](https://github.com/payloadcms/payload/releases/tag/v3.90.2) | Next/libSQL tracing include ve trailingSlash; MCP create/update TS6 strict prologue düzeltmesi. TS5.7 korunur; gerçek MCP araç çağrılarıyla doğrulandı. |
| [3.91.0](https://github.com/payloadcms/payload/releases/tag/v3.91.0) | MCP find argümanları (locale/fallbackLocale/draft/select/populate/joins/trash/pagination); SQLite batch boyutu tablo kolon sayısına göre, lokalize `_parent_id` indeksleri; draft findByID erişimi. **Breaking:** Node tabanı ve Nodemailer **10**; kendi Nodemailer transport nesnemiz yok, `transportOptions` uyumlu. Azure storage kullanılmıyor. Activity-aware admin session ve custom block view/condition düzeltmeleri alındı. |
| [3.92.0](https://github.com/payloadcms/payload/releases/tag/v3.92.0) | **Breaking:** Node `^22.23.4 || >=24.22.1`; proje engine'i **>=24.22.1 <25**. Host **24.21.0** değişmedi; kontroller resmi SHA256 doğrulanmış, geçici **24.22.2** runtime ile yapıldı. Locale-all validation, field access id, Drizzle polymorphic locale join ve admin upload callback düzeltmeleri. |
| [3.92.1](https://github.com/payloadcms/payload/releases/tag/v3.92.1) | Reset password field validation; nullable GraphQL virtual alanlar; cloud processed-upload düzeltmeleri. PostgreSQL localizeStatus migration düzeltmesi SQLite'a uygulanmaz. |
| [3.93.0](https://github.com/payloadcms/payload/releases/tag/v3.93.0) | **Güvenlik:** blok çocuklarının read access'i sorguda uygulanır; her blok alanı yalnız kendi tiplerini kabul eder; URL upload `pasteURL` kısıtları; XSL/XML yanıt politikası; Lexical HTML escaping. Lokalize paylaşılan taslak alanları korunur; config label interpolation ve drawer/create kart çevirisi, virtual-field duplicate autosave düzeltmeleri. Mevcut blok listeleri ve staff-only preview korunur. `auth.passwordHashIterations` varsayılanı değiştirilmedi. |

Geçişte ayrıca [3.85.2](https://github.com/payloadcms/payload/releases/tag/v3.85.2) (CLI/tsx, bulk blok ID, Markdown satır sonu ve güvenlik bağımlılıkları) okundu. Tüm release gövdelerinin yerel kanıtı: aşağıdaki scratchpad içinde `v0-release-notes.md` / `payload-releases.json`.

### Uyumluluk ve geri dönüş

- **JWT oturumları:** kurulu 3.93 signer/verifier kaynaklarında yeni imzalı `authVersion` başlığı zorunlu. Portal `payload.login` kullanır; uygulama kodu değişmedi. JWT testleri `JWT_AUTH_VERSION` export'unu kullanır ve eski/yanlış başlıklı token reddini kilitler. Yönetici restart'ından sonra eski admin/portal oturumları **yeniden giriş** ister.
- **Upload:** aktif SVG'nin reddedilmesi ve güvenli SVG'nin sandbox/nosniff yanıtı test edilir. TIFF fiziksel formatı/metadata temizliği korunur, yeni yüklemede kanonik uzantı `.tif` olur. Mevcut dosyalar taşınmaz. 50 MB üstü multipart yüklemeler için ayrı ve bilinçli `upload.requestSizeLimit` kararı gerekir; varsayılan gevşetilmedi.
- **Draft:** yalnız taslak olarak oluşturulmuş sayfanın `homePage` ilişki filtresinden reddi test edildi; legacy DB referansı varlığında public loader yine yayınlı `home`'a düşer. Yeni localized draft davranışını geri alan yama eklenmedi.
- **MCP:** `overrideAuth`, `req.payload` Proxy, allowlist, licenses delete yasağı ve kapalı `payload-mcp-api-keys` korunur; taze handler **69** araç. Anonim/editor/customer/session reddi; find argüman şeması, TR/EN create-update, anahtarın okunamaması/rol düşürmede iptali doğrulandı. Kök argüman biçimi AGENTS.md'de düzeltildi. Upstream `mcp-handler@1.1.0` SDK peer'i 1.26.0, Payload SDK'sı 1.30.0: önceki kurulumda da olan pnpm uyarısı açıkça kaydedildi; güvenlik SDK'sı düşürülmedi, peer hatası gizlenmedi.
- **Migration:** `20261108_093334_v0_payload_393` = **2 ADD COLUMN + 309 CREATE INDEX**. `up` DROP/DELETE/`__new_` içermez; `down` yalnız kendi 309 indeksini/2 sütununu kaldırır. Oluşturma ve ilk uygulama DB kopyasında; 680 tablonun eski sütun/satır farkı **0**, integrity **ok**, FK **0**. Yeni regresyon transaction'da up/down/up ile anahtar, session, TR/EN blok ve versiyon verisini korur. Canlıda da aynı migration uygulandı; önce `softmarket-pre-v0.db` + `-wal`/`-shm` ham yedeği ve SQLite backup API ile tutarlı `softmarket-pre-v0.snapshot.db` alındı (integrity/FK doğrulandı). Canlı uygulamadan sonra da 680 tablonun eski sütun/satır farkı **0**, integrity **ok**, FK **0**. Başka bekleyen migration uygulanmadı.
- **Scratchpad:** `/private/tmp/claude-501/-Users-ozcelik-dev-softmarket/86cb568c-5f6b-4b21-b0fe-e6a5de07c79f/scratchpad`. Paket/lock önceki kopyaları `v0-before-*`; önceki şema snapshot'ları korunur. Geri dönüşte paket/lock dosyaları birlikte geri alınır; yedek DB snapshot'ı (WAL/SHM ile ham kopya da mevcut) kapalı süreçte geri yüklenir. Çalışan DB üzerine geri yükleme yapılmaz; bu görevde geri dönüş gerekmedi.

### Son doğrulama ve işletim durumu

- `pnpm generate:types` geçti; `pnpm generate:importmap` geçti, **No new imports** (importMap dosyası değişmedi).
- `pnpm typecheck`, `pnpm lint` ve `pnpm test --maxWorkers=1`: **56 dosya / 703 test geçti**. Admin TR/EN etiketleri, Live Preview/draft, MCP, SQLite/medya/portal regresyonları dahil. İlk koşudaki uyumluluk farkları yukarıdaki test düzeltmeleriyle kapatıldı; test gevşeterek güvenlik varsayılanı kaldırılmadı.
- `NEXT_DIST_DIR=.next-prod PORT=3200 pnpm build`: kopya DB/uploads ile başarılı, **118** statik sayfa; mevcut local canonical URL uyarısı sürüyor. `tsconfig.json`/`next-env.d.ts` değişmedi.
- **3200 duman:** `/tr`, `/en`, `/tr/urunler`, `/tr/urunler/akis-yonetimi/akis-merkezi`, `/admin` **200**; POST `/api/mcp` anonim **401**; `/api/preview?redirect=/tr` anonim/same-origin **401**; `/tr/olmayan` **404**. Parametresiz `/api/preview` mevcut redirect doğrulama sırasıyla **400 Invalid redirect** döner; davranış değiştirilmedi.
- `pnpm test:e2e:isolated`: ayrı DB kopyası, **1/1 geçti** (API yayın/blok sırası + staff preview pozitif kontrolü + anonim 401; bu test browser başlatmaz). Geçici 3400 ve uploads otomatik temizlendi.
- Taze MCP testi için ayrı kopya kullanıldı; API anahtarları sadece bellekte üretildi, canlıya fixture yazılmadı. Araç listesi ve sonuçlar `v0-mcp.log`; test/build/duman/E2E kanıtları `v0-tests.log`, `v0-build.log`, `v0-smoke.json`, `v0-e2e.log`.
- Son test denetimi: migration testi sonraki V1/V2 migration'ları eklendiğinde de yalnız V0 öncesini kurar; ilişki reddi assertion'ı özellikle HTTP 400 ister. Bu iki dosyanın son odaklı tekrarı **6/6 geçti**.
- **3200/3400 kapalı** (listener yok), **3100 PID 53048** aynı ve açık; `.next` silinmedi, dev sürecine restart/sinyal/HTTP isteği yapılmadı. `pnpm install` çalışan dev HMR'sini bozabilir; bunu düzeltmek için dev'e müdahale edilmedi. **Yönetici host Node'u >=24.22.1'e yükselttikten sonra normal dev restart'ını yapmalı**; eski oturumlar tekrar giriş ister. Commit yok.

**Değişen dosyalar:** `package.json`, `pnpm-lock.yaml`, `src/payload-types.ts`, `src/migrations/index.ts`, `src/migrations/20261108_093334_v0_payload_393.{ts,json}`, `tests/unit/payload-version.test.ts`, `payload-upgrade-migration.test.ts`, `media-pipeline.test.tsx`, `media-upload.test.ts`, `page-builder-db.test.ts`, `portal.test.ts`, `AGENTS.md`, `README.md`, `memory-bank/{activeContext,progress,techContext}.md`, bu plan. Önceden kullanıcı tarafından eklenmiş plan ve activeContext değişiklikleri korundu. Uygulama erişim/preview/render/config koduna uyumluluk yaması gerekmedi.

## Kullanıcı kararları (2026-11-08)

- İç içe sütun/slot: **şimdilik yok** — tek seviyeli blok listesi; sütunlu düzenler hazır bloklarla. İç içe yapı sonraki sürüme.
- Ürün sayfası: **"Teklif İste" zorunlu** (kaldırılamaz; yalnız yeri değişebilir); İndirmeler, Dokümantasyon ve sekme çubuğu taşınabilir veya kaldırılabilir.
- Pilot kararı: 8 görevlik denemeyi **kullanıcı kendisi yapacak**; sonucu V4 karar puanında belirleyici. Pilotlar hazır olunca kullanıcıya haber verilecek.

## V1 uygulama kaydı — 2026-11-08

**Plandan sapmalar (kullanıcı isteğiyle):** preset listesi `auto, none, fade, slide-up, slide-down, slide-left, slide-right, zoom-in, parallax-soft, stagger` (plandaki `fade-up` → `slide-up`; `slide-down` ve `stagger` eklendi). Tetikleyiciye `scroll-progress` eklendi (CSS scroll-driven, `@supports`). `spacer`, `divider`, `listing` blokları `motion` almaz (görünür içerik yok / liste rotaya ait). Yön adı hareket yönüdür: `slide-left` sağdan sola gelir.

**Veri (V1-S):** `src/fields/block-motion.ts` (`MOTION_*`, `blockMotion()`, `resolveMotion()`, `motionEnumName`, `validateHeroPreset`); her blok tanımında `blockSettings()` sonrasında `blockMotion()`. Seçimler temizlenemez (`isClearable:false`). Migration `20261108_100715_blocks_motion`: **1134 `ALTER TABLE … ADD`** (162 blok tablosu × 7 kolon, varsayılanlar = alan varsayılanları; eski satırlar `auto`). Up'ta DROP/DELETE/`__new_` yok; üretilen down yalnız aynı 1134 kolonu `DROP COLUMN` eder (yeniden kurulum yok, elle yazım gerekmedi). Test: `tests/unit/block-motion-migration.test.ts` (up → varsayılanlar, down → tüm tabloların satırları birebir, tekrar up). Önceki faz DB testleri (`blocks-appearance-migration`, `blocks-static-migration`, `page-builder-db`) okuma için bu migration'ı da uygular. Kopya DB'de migrate + `content:import --dry-run` (0 hata, 98 update); canlı yedek `scratchpad/softmarket-pre-v1.db{,-wal,-shm}` + `softmarket-pre-v1.snapshot.db`; canlı migrate sonrası 681 tablonun eski kolon/satır farkı 0, integrity ok, FK 0. `payload-types.ts`, importmap (yalnız kart bileşeni), `content/seed/schema.json` yeniden üretildi.

**CSS sözleşmesi (V1-C):** `anim(index, motion, 'item'|'container')` → `data-anim="<efekt>"` (`auto` → `subtle`), `data-anim-trigger` (scroll'da yok; parallax daima `scroll-progress`), `data-anim-safe` (LCP), `data-anim-mobile`, yalnız varsayılandan farklıysa `--anim-dur|--anim-delay|--anim-ease|--anim-stagger`. Varsayılan işaretleme V1 öncesiyle bayt bayt aynı (testli). `globals.css`: efekt başına yalnız `--m-o`/`--m-from`/`--m-hover`; tüm kurallar `:where()` (`.card-hover`'ı ezmez), `prefers-reduced-motion: no-preference` içinde ve `html:not([data-motion=none])` kapılı; `load` = `motion-in` keyframe (backwards), `hover` = `(hover:hover)` transform, `scroll-progress` = `animation-timeline: view()` + `animation-range: entry 0% entry 280px`, paralaks `cover` aralığı ve varsayılan ≥768 px. Yatay efektli bölüm `overflow-x-clip`. MotionObserver `[data-anim-trigger]` öğelerini izlemez. Hero: `heroMotion()` yön/süre/gecikme/easing'i `--hero-dx/dy` ile uygular, başlık/lead yalnız kayar; `parallax-soft` hero medyasına uygulanır.

**LCP kuralı:** `planBlocks` ilk görünür blok ve her `hero` için `protect`; `fade`/`zoom-in`/`stagger` → `slide-up`, hover dışındaki tüm girişler `safe` (opacity 1'den başlar, ölçek yok). Eski `auto`+scroll değişmez (gözlemci ekrandaki öğeyi gizlemez). Hero alanı yalnız güvenli presetleri kabul eder (validate), admin hero'da 7 kart gösterir.

**Admin (V1-UI):** `src/admin/fields/motion-preset-cards.tsx` (client, yalnız import map; frontend importu testle yasak), saf CSS mini önizleme süre/gecikme/easing'i izler, "Tekrar oynat", hero/ilk blok notu. Etiketler `MOTION_LABELS` (`admin-i18n.ts`). `docs/editor-guide.md` §2.6a.

**Doğrulama:** typecheck, lint temiz; `pnpm test --maxWorkers=1` **58 dosya / 728 test** yeşil (yeni `block-motion.test.tsx` 23 test + migration testi). `NEXT_DIST_DIR=.next-prod` build (kopya DB, 122 sayfa). 3300 (kopya DB + fixture `/tr/v1-hareket-test`, `/tr/v1-ilk-blok`, content:import 2× idempotent: 2 created → 2 updated) Playwright **27/27**: 390/1440 her preset ekran görüntüsü + kaydırma videosu, CLS 0 (test sayfası ve /tr), yatay taşma 0, hero h1 DOMContentLoaded'da opacity 1, ilk blok zoom-in/load → slide-up safe opacity 1, /tr eski pending durumu (0 / 12px) ve yalnız `subtle` işaretleme, reduced-motion ve `data-motion=none` statik, JS kapalıyken tüm içerik görünür; admin panelinde 10 kart (hero 7), kart seçimi formu günceller. Lighthouse mobil (3 koşu medyan) /tr: Perf 100, LCP 1.06 s, CLS 0, TBT 10 ms, JS 129.4 KB (önce 129.0); test sayfası Perf 100, LCP 1.06 s, CLS 0. Motion CSS kaynağı gzip +0.9 KB (≤ 2 KB). Kanıtlar: scratchpad `v1/shots/`, `v1/lh/`, `v1-tests.log`. 3200/3300 kapalı; geçici QA DB/kullanıcı silindi; 3100 ve `.next` dokunulmadı. Commit yok.
