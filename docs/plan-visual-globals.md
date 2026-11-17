# Plan: site çerçevesini görsel düzenleme (header, footer, menüler, marka)

> Durum: **taslak plan (2026-11-17)**. Kod, şema veya migration değişmedi. Uygulama G0 doğrulamasıyla başlar ve her faz sonunda kullanıcı onayı beklenir.
> Kaynaklar: `AGENTS.md`, `memory-bank/*`, `docs/plan-visual-editor.md` (Kalıcı kurallar, V3b, V5 kaydı, V5 denetim notu, P1 kapanış kaydı), `docs/editor-pilot/decision.md`, `docs/editor-guide.md` §2.10. Mevcut kod `main` 1a8969e üzerinden okundu. Payload 3.93.0 kaynakları `node_modules` içinde doğrulandı.

## Kullanıcı isteği

- Kullanıcının sözleriyle: "sitedeki header, footer ve menü gibi sitenin komponentlerinin yerleri de önizleme bölümü olacak ve önizleme üstünde değiştirilebilir olacak yani, text araçlarına mecbur kalmadan da önizlemeden wix tarzında düzenleme yapılacak."
- Yorum: V5 görsel editörü (Payload-native canvas: Live Preview iframe ve köprü) şu bileşenleri de düzenleyebilmeli: header, footer, ana menü, mega menü, mobil menü, duyuru bandı, yardımcı çubuk, logo, site adı, slogan, iletişim bilgileri ve sosyal bağlantılar. Kullanıcı bu öğeleri önizlemede seçer ve metni yerinde düzenler. Menü öğesini ekler, siler ya da sürükleyerek sıralar. Bağlantı hedefini küçük bir panelden, logoyu da medya çekmecesinden seçer.

## Kalıcı kurallar (her fazda geçerli; ihlal edilirse faz reddedilir)

1. **Tek veri kaynağı Payload global'leridir:** `header`, `footer` ve `site-settings`. Opak editör durumu saklanmaz. Mevcut alan adları, seçenekleri ve `defaultValue` değerleri değişmez. Yalnız ekleme yapılır (Header/Footer dosyalarındaki "F7: append-only" notu).
2. **Bütün yazımlar Payload formundan geçer.** Köprü API'ye yazmaz. Host (admin), mesajı allowlist ile yeniden doğrular, değişikliği Payload form API'siyle uygular (`dispatchFields`, `addFieldRow`, `moveFieldRow`, `removeFieldRow`) ve sunucu doğrulaması ile erişim zincirini kullanır. Tek istisna G3'teki "varsayılan menüyü kayda dönüştür" uç noktasıdır. Bu uç nokta staff oturumu, aynı origin ve `editorVersion` ön koşulu ister ve yalnız taslak yazar.
3. **Ziyaretçi taslağı görmez.** Header ve footer taslakları yalnız draft modunda ve her istekte yeniden doğrulanan staff oturumuyla okunur (`readAs`/`getPreviewUser`). Autosave önbelleği yenilemez. Önbellek yalnız yayınla yenilenir.
4. **Public/ISR HTML'i bayt bayt aynı kalır.** `data-chrome-*` işaretleri, rozetler ve "ziyaretçiye görünmüyor" öğeleri yalnız editing render'da basılır. Kanıt için `<header>` ve `<footer>` HTML'i, değişiklik öncesi temelle karşılaştırılır (V2 deseni).
5. **Public bundle'a editör kodu girmez.** Ana sayfa JS gzip ≤ 130 KB olmalı. Kanıt `tests/unit/client-bundle-guard.test.ts`. `src/lib/header-nav.ts` içine yalnız birkaç baytlık "sabitlenmiş panel" kontrolü eklenebilir, ölçüm farkı kayda geçer.
6. **Güvenlik korunur.** postMessage'da iki yönde `origin === location.origin` ve `event.source` eşleşmesi aranır, zod/mini strict şema kullanılır. Köprü URL değeri taşımaz. Bağlantı adresi admin panelindeki forma girilir ve sunucu doğrular (`javascript:`, `data:`, `vbscript:` ve `//` reddedilir). `/api/preview` yalnız staff'a açılır. Draft yanıtları `private, no-store` olur.
7. **Migration kuralları** (`plan-visual-editor.md` kural 6): önce DB kopyasında çalıştırılır. Up yalnız `CREATE TABLE`, `ADD COLUMN`, `CREATE INDEX` ve yeni kolona yönelik `UPDATE` (backfill) içerir. `DROP`, `DELETE` ve `__new_` yasaktır. Down yalnız kendi tablo, kolon ve indeksini kaldırır. Canlıya uygulamadan önce WAL/SHM dahil yedek ve snapshot alınır.
8. Görev açıkça istemedikçe 3100 dev sunucusuna, canlı DB'ye ve `.next` klasörüne dokunulmaz. Build `NEXT_DIST_DIR=.next-<ad>`, QA portları 3200, 3300 ve 3400'dür. Süreç öldürülmez.

---

## 1. Mevcut durum (kod gerçekliği)

| Konu | Bugün | Plan için sonucu |
|---|---|---|
| Global'ler | `header` (navItems ≤8 → children / megaMenu `products\|solutions\|custom` → columns ≤4 → links ≤8 + featured; cta.link/secondary; announcement; utility.links ≤4 + 3 anahtar), `footer` (columns ≤6 → links; legalLinks; copyright; brandBlurb; showContact/showSocial; newsletter), `site-settings` (siteName, tagline, logo, logoDark, favicon, contact, social[] … commerce/company/legal). **Hiçbirinde `versions` yok.** | Live Preview'da her kayıt anında yayına girer. Taslak için şema değişikliği gerekir (G1). |
| Erişim | header ve footer: `update: isAdminOrEditor`. site-settings: `update: isAdmin`. | Editör rolü logo, site adı ve sosyal bağlantıları değiştiremez. Bunlar canvas'ta salt okunur rozetle gösterilir. |
| Bağlantı alanı | `linkField()`: `type` `internal\|external\|route` (istekteki "custom" = `external`), `reference` (LINKABLE_COLLECTIONS, 9 koleksiyon), `route` (LINK_ROUTES) + `routeParam`, `url` (lokalize). **`url` alanında sunucu doğrulaması yok.** Güvenlik yalnız render'daki `safeHref` ile sağlanıyor. | G1'de şemasız `validate` eklenir: `https?:`, `mailto:`, `tel:` ve `/` ile başlayan göreli yol kabul edilir. Mevcut seed verisinde test edilir. |
| Yükleyiciler | `getHeaderNav`/`getFooterData` (`src/lib/site.ts`): `draft:false`, anonim. Bağlantıyı çözemeyen satırı, yayında olmayan hedefi ve ödeme kapalıyken satış yasal sayfasını (`resolvePublicLink` + `isSalesLegalTarget`, P3/P7) **atar**. Boş başlıklı kolonu atar. Satır `id`'si `NavItem`'a taşınmaz. | Render edilen öğe kayıtlı satıra eşlenemiyor. Editing render satır kimliğini taşımalı ve atılan öğeleri rozetle göstermeli (G2). |
| Yedekler | navItems boşsa i18n'den sabit menü, CTA boşsa `requestDemo → /demo-talep`, footer kolonları veya legal boşsa i18n yedeği kullanılır. | Bu öğelerin kaydı yok. Düzenlenebilmeleri için önce kayda dönüştürülmeleri gerekir (G3). |
| Mega menü | Paneller HTML'de gizli durur. `initMegaNav` hover/click gecikmesiyle açar. Dışarı tıklama, odak kaybı ve panel içindeki link tıklaması menüyü kapatır. | Önizlemede açık tutma gerekir. Bunun için `data-canvas-pinned` kontrolü kullanılır (G2). |
| Mobil menü | Native `<dialog>` + `showModal()`: top layer, sayfa inert, Esc kapatır (`initSheet`). | Köprünün seçim katmanı dialog'un altında ve inert kalır. Dialog açıkken katman dialog'un içine bağlanmalı (G4). |
| Duyuru bandı | Kapatma `localStorage` (`sm-announcement-dismissed`) ile hatırlanır. | Editing render'da her zaman görünür olmalı. |
| Payload 3.93 global Live Preview | `isLivePreviewEnabled` root `livePreview.globals` ya da global `admin.livePreview` değerini okur. Document view (`@payloadcms/next/dist/views/Document`) globals için de `openByDefault`'u uygular. `livePreviewURL` fonksiyonu `globalConfig` alır. Global kontrol slotu `admin.components.elements.beforeDocumentControls` yolundadır (koleksiyonda `edit.beforeDocumentControls`). Globals `versions.drafts.autosave` destekler. `lockDocuments` globals için vardır. | Teknik yol açık. Form API'nin global görünümde aynı çalıştığı G0'da kanıtlanır. |
| Önbellek | `withGlobalRevalidation`: header, footer ve site-settings'in **her** değişikliği `revalidatePath('/', 'layout')` çağırır. Ödeme yeteneği açıkken `commerceRenderBoundary()` her sayfayı istek başına render eder. | Taslak eklenince yenileme yalnız yayında çalışmalı. Aksi halde autosave her 2 saniyede tüm siteyi geçersiz kılar. |
| Import ve MCP | `content:import` globals için `updateGlobal` çağırır ve `_status` göndermez. MCP: header, footer ve site-settings için find/update. | Taslaklı global'de `_status: 'published'` zorunlu hale gelir. Importer ve AGENTS tarifi güncellenir. |
| V5 eşzamanlılığı | `editorVersion` sanal alanı ve `guardEditorVersion` yalnız koleksiyon kancalarıyla (`findByID`) çalışıyor. `db-serial-transactions` süreç içinde transaction'ları sıraya koyuyor. | Global eşdeğeri gerekir: `GlobalBeforeChangeHook` + `findGlobal({ draft:true, req })` (G1). |

---

## 2. Karar özeti

### 2.1 Mimari seçim: **(c), ama aşamalı ve tek yazım yolu ile**

| Seçenek | Artı | Eksi |
|---|---|---|
| (a) Global başına ayrı Live Preview + köprünün genişletilmesi | Veri bütünlüğü net: bir Payload formu bir global'i yazar. Taslak, yayın, kilit ve 409 V5 deseniyle birebir uyumlu. | Kullanıcı sayfa ile çerçeve arasında ekran değiştirir. |
| (b) Sayfa editöründe header/footer doğrudan seçilir ve global'e yazılır | Tek tuval (Wix hissi). | Sayfa formu global alanlarını tutamaz. İkinci bir yazım yolu gerekir (form dışı REST): form doğrulaması, geri al/yinele, autosave, 409 ve TR/EN form state'i iki kez kurulur. Sayfa taslağı ile çerçeve taslağı farklı yayınlanır. "Bu sayfayı yayınla" düğmesinin tüm siteyi değiştirmediği kafa karıştırır. |
| **(c) Önerilen** | — | — |

**Öneri:**
- **Yazım tek yoldan yapılır, yol (a)'dır.** "Site çerçevesi" editörü `header`, `footer` ve (yalnız admin) `site-settings` global görünümlerini Live Preview tuvaliyle açar (`openByDefault`). V5 host'u global kapsamında çalışır. Tuvalde **sayfa gövdesi soluk ve kilitlidir** ("Sayfa içeriği: bu ekranda düzenlenmez → Sayfayı aç"). Çerçeve bölgeleri ise canlıdır.
- **Tek tuval hissini (b)'nin hafif hali verir.** Sayfa veya ürün editöründe header ve footer bölgeleri üzerine gelince **"Site geneli · Tüm sayfalarda"** rozetiyle çerçevelenir. Tıklanınca "Üst menüyü düzenle ↗" kısayolu çıkar. Kısayol bekleyen sayfa kaydını flush eder ve aynı önizleme yolunda global editörü açar (`previewPath`). Global editörde "← Sayfaya dön" düğmesi bulunur. Kullanıcı aynı görüntüde kalır. Değişen tek şey hangi formun yazdığıdır, bu da üst çubukta büyük etiketle gösterilir: **"Düzenlenen: Üst menü (tüm sayfalar)"**.
- Global editörde bir bölgeden diğerine geçiş tek tıklıktır. Footer'a tıklamak `/admin/globals/footer?previewPath=…` adresine, logoya tıklamak (admin için) site-settings'e götürür. Önce bekleyen değişiklik flush edilir.
- Gerekçe: V5'in "tüm yazım form → sunucu" kuralı, 409 eşzamanlılığı ve TR/EN form disiplini bozulmadan Wix'e yakın akış sağlanır. Doğrudan (b) yolu sonraki sürüm olarak açık kalır (§8 soru 1).

### 2.2 Taslak ve yayın: **header ve footer'a `versions.drafts` (autosave 2 sn) eklenir**

- Taslak olmazsa canvas'taki her autosave anında canlıya yansır. Wix tarzı deneme yapılamaz ve bu kabul edilemez.
- `Header`/`Footer`: `versions: { drafts: { autosave: { interval: 2000 } }, max: 50 }`. Payload bunun karşılığında `_status` kolonu, `_header_v*` ve `_footer_v*` tablolarını üretir. Migration yalnız ekleme yapar (G1).
- **Mevcut satırın durumu kritik:** `ADD COLUMN _status DEFAULT 'draft'` mevcut global satırını "taslak" yapabilir. G0, Payload 3.93'te `findGlobal({ draft:false })` çağrısının `_status='draft'` olan ana satırı nasıl ele aldığını kopya DB'de kanıtlar. Migration `UPDATE header SET _status='published'` (yalnız yeni kolon) yapar ve gerekiyorsa başlangıç yayın sürümü satırını `INSERT` eder. Kabul ölçütü: migration öncesi ve sonrası public header/footer HTML'i bayt bayt aynıdır.
- Yayın: Payload'un global "Değişiklikleri yayınla" düğmesi kullanılır. `withGlobalRevalidation`, drafts'lı global için yalnız `_status === 'published'` yazımında yeniler. Taslak ve autosave yenileme yapmaz (koleksiyondaki `withPublicRevalidation` mantığı).
- **site-settings'e ilk dalgada taslak eklenmez.** Bu global'in okuyucuları ödeme durumu (`commerce/state.ts`, `payments/runtime.ts`), checkout, `company-facts` ve yasal hazırlıktır. Taslak, bunların tamamının denetimini gerektirir. Logo, site adı, slogan, sosyal bağlantılar ve iletişim canvas'ta **yalnız admin** tarafından, **"Kaydet = hemen yayın"** onay iletişim kutusuyla düzenlenir. Bu ekranda autosave yoktur ve kırmızı rozet görünür. Taslak desteği kullanıcı onaylarsa ayrı faz olur (§8 soru 2).
- Önizleme: staff draft isteğinde `getHeaderNav`/`getFooterData` `draft:true` ve staff `user` ile okur. Sayfa editörü de çerçeve taslağını gösterir. Taslak varsa çerçeve bölgesinde "Yayınlanmamış çerçeve değişikliği var" rozeti çıkar.

### 2.3 Eşzamanlılık: V5 `editorVersion`/409 deseni global'lere taşınır

- `editorVersionField` header ve footer'a eklenir (sanal, gizli, şemasız). Global `afterRead` = ham all-locale snapshot SHA-256. `guardGlobalEditorVersion` (`GlobalBeforeChangeHook`) aynı transaction'da (`req`) `findGlobal({ slug, draft:true, depth:0, overrideAccess:true, req })` okur. Sürüm uyuşmazsa `APIError` 409 döner. Sürüm taşımayan yazımlar (MCP, import, betikler) eskisi gibi geçer. Editörün sonraki kaydı 409 alır.
- Varsayılan menüyü kayda dönüştürme uç noktası aynı ön koşulu kullanır.
- Host'taki **Birleştir ve kaydet**, **Değişikliklerimi kopyala** ve **Yeniden yükle** akışı (`admin/sync.ts`, `admin/merge.ts`) global kimliğiyle çalışır (`id` yerine `globalSlug`). Satır kimliğiyle birleştirme array satırlarına aynen uygulanır.
- site-settings da aynı korumayı alır (taslaksız, ama 409 kayıp güncellemeyi önler).

### 2.4 Wix'e yakın, Wix'in serbestliği değil

- Serbest konumlandırma, yeni bölge ve yeni bileşen tipi yoktur. Yalnız mevcut alanlar düzenlenir: metin yerinde, liste ekle/sil/sırala, bağlantı, medya ve aç/kapa anahtarları. Header düzeni (logo solda, menü, CTA) değişmez.

---

## 3. Düzenlenebilir alan haritası

### 3.1 Yerinde metin (`INLINE_GLOBAL_FIELDS`, `src/editor/canvas/fields.ts`)

Kural V5 ile aynıdır: lokalize `text` (çok satırsız `textarea` de olur), tek satır, ≤ 1000 karakter, `normalizeInline`, `plaintext-only`. EN boşsa TR yedeği gösterilir, tıklanınca "Bu dilde metin yok" uyarısı çıkar ve yalnız EN'e yazılır.

| Global | Yollar |
|---|---|
| `header` | `navItems.*.link.label`, `navItems.*.children.*.link.label`, `navItems.*.children.*.description`, `navItems.*.columns.*.title`, `navItems.*.columns.*.links.*.link.label`, `navItems.*.columns.*.links.*.description`, `navItems.*.featured.title`, `navItems.*.featured.description`, `navItems.*.featured.link.label`, `cta.link.label`, `cta.secondary.label`, `announcement.text`, `announcement.link.label`, `utility.links.*.link.label` |
| `footer` | `columns.*.title`, `columns.*.links.*.link.label`, `legalLinks.*.link.label`, `brandBlurb` (boşsa slogan yedeği: yedek rozeti, yazınca yalnız brandBlurb'a yazılır) |
| `site-settings` (admin) | `siteName`, `tagline` |

- `FIELD_PATH_RE` en çok 4 ek segment kabul eder. En derin yol olan `navItems.0.columns.1.links.2.link.label` bu sınıra tam oturur. Test bunu kilitler. Regex genişletilmez.
- Global'e özgü güvenlik: `isInlineGlobalField(global, path)` kontrolü `Object.hasOwn` kullanır ve şema↔allowlist testi yapılır (V5 `visual-editor-fields.test.tsx` deseni: her yol global config'te lokalize text/textarea olmalı).
- **Yerinde düzenlenmeyenler:** `copyright` (`{year}`/`{siteName}` şablonu, tuvalde çözülmüş metin görünür). Bu alan küçük panelde ham şablonla düzenlenir. Bağlantı adresleri, medya ve ilişkiler de yerinde düzenlenmez.

### 3.2 Listeler: ekle, sil, sırala (`CHROME_LISTS`, `src/editor/canvas/chrome-rules.ts`)

| Liste yolu | maxRows | Eksen | Yeni satır şablonu |
|---|---|---|---|
| `header.navItems` | 8 | yatay (masaüstü) / dikey (mobil) | `{ link: { type:'route', route:'urunler', label:'Yeni öğe' } }` (aktif dil) |
| `header.navItems.*.children` | — (öneri: UI sınırı 12) | dikey | route bağlantısı + boş açıklama |
| `header.navItems.*.columns` | 4 | yatay | başlık + 1 bağlantı |
| `header.navItems.*.columns.*.links` | 8 | dikey | — |
| `header.utility.links` | 4 | yatay | — |
| `footer.columns` | 6 | yatay | başlık (zorunlu) + 1 bağlantı |
| `footer.columns.*.links` | — | dikey | — |
| `footer.legalLinks` | — | yatay | route `yasal_slug` |
| `site-settings.social` | — | yatay | platform seçimi zorunlu (panelden) |

- İşlemler: seçili öğenin araç çubuğunda ←/→ (yatay) ya da ↑/↓ (dikey) ile taşıma, ⠿ ile sürükleme, Çoğalt, Sil (ikinci tıkta onay) ve "+ Öğe ekle" bulunur. Taşıma **yalnız aynı liste içinde** yapılır (listeler arası taşıma: §8 soru 4).
- Klavye: Tab/↑↓/←→ seçer. Alt+ok taşır. Enter metni düzenler. Delete iki basışta siler. Esc seçimi bırakır. Odak halkası görünürdür (`outline` 2 px, vurgu rengi, WCAG 2.4.7). Taşıma sonucu `aria-live` ile duyurulur ("Ürünler 2. sıraya taşındı").
- maxRows'a ulaşan listede "+ Öğe ekle" devre dışıdır ve nedeni ipucunda yazar. Sunucu `maxRows` doğrulaması yine otoritedir.
- `navItems.*.megaMenu` (yok / products / solutions / custom) seçili menü öğesinin küçük panelinde segment düğmeleriyle değişir. `custom` seçilince kolonlar ve öne çıkan kart düzenlenebilir hale gelir.

### 3.3 Küçük paneller (admin tarafında, tuvalin üstünde konumlanır)

Popover **admin host'ta** çizilir, iframe'de çizilmez. Köprü yalnız `{ type:'panel', kind, path, rowIds, rect }` isteği gönderir. Değerler admin formuna girer, böylece iframe'e hiçbir URL veya ilişki değeri yazılmaz.

| Panel | İçerik | Kural |
|---|---|---|
| **Bağlantı hedefi** | Sekmeler: *Site sayfası* (LINK_ROUTES listesi + gerekiyorsa `routeParam` slug alanı, `ROUTE_PARAM_PATTERN`), *Kayıt* (Payload `useListDrawer` ile LINKABLE_COLLECTIONS; sayfa, ürün, çözüm…), *Harici adres* (URL + "yeni sekmede aç") | URL sunucu `validate` ile sınanır (G1). İstemci de aynı saf fonksiyonla erken uyarı verir. `pageType: template` sayfalar listede çıkmaz (filterOptions eklemesi, şemasız). Taslak hedef seçilirse "Hedef yayında değil, ziyaretçi bu öğeyi görmez" uyarısı çıkar. Satış yasal sayfası seçilirse "Ödemeler kapalıyken gizlenir" bilgisi verilir. |
| **Mega menü** | Tip seçimi, kolon ekle/sil, öne çıkan kart görseli (medya çekmecesi) ve bağlantısı | `products`/`solutions` otomatik içeriklidir. Tuvalde "Otomatik: ürün aileleri" rozeti çıkar, içerik buradan düzenlenmez. |
| **Duyuru bandı** | Göster, ziyaretçi kapatabilir, bağlantı | Metin yerinde düzenlenir. Editing render'da `localStorage` kapatma durumu yok sayılır. |
| **Yardımcı çubuk** | Arama, dil, hesap anahtarları | Çubuk yalnız ≥ lg genişlikte görünür. 390 genişlikte "Masaüstünde görünür" notu çıkar. |
| **Logo** (admin) | `logo` / `logoDark` için medya çekmecesi (`useListDrawer({ collectionSlugs:['media'] })`, `where protected equals false`) ve yükleme (`useDocumentDrawer`) | `publicImage` korumalı veya görsel olmayan medyayı reddeder. Panel aynı kuralla uyarır. Header ve footer koyu zemindedir, `logoDark` önceliklidir; panel bunu açıklar. |
| **Sosyal bağlantılar** (admin) | Platform (6 seçenek) + URL, ekle/sil/sırala | Render yalnız `https?:` gösterir. G1'de `social.url` için `validate` (https zorunlu) eklenir. |
| **İletişim** (admin) | e-posta, telefon, adres, çalışma saatleri | Footer'daki "İletişim bilgilerini göster" anahtarı footer formundadır. Panel iki global'i açıkça ayırır. |
| **Telif metni** | Ham şablon + `{year}` `{siteName}` yardımı | — |

### 3.4 Rozet ve durumlar (yalnız editing render)

- "Ziyaretçiye görünmüyor": bağlantı çözülemedi, hedef taslak, satış yasal sayfası ve ödeme kapalı, kolon başlığı boş. Satır soluk gösterilir, rozetin nedeni yazar ve seçilebilir.
- "Varsayılan (kayıtlı değil)": i18n yedek menü, CTA, footer kolonları ve legal yedeği. İlk düzenleme denemesinde G3 dönüşüm iletişim kutusu açılır.
- "Otomatik içerik": products ve solutions mega panelleri.
- "Yalnız yönetici": editor rolünde logo, site adı, sosyal ve iletişim.
- "Site geneli · Tüm sayfalarda": sayfa veya ürün editöründe çerçeve bölgeleri.

---

## 4. Fazlar

Toplam tahmin: **12–16 iş günü** (G6 dahil). Şema tek fazdadır (G1). Her faz sonunda durulur ve kullanıcı onayı alınır.

### G0 — Doğrulama spike'ı (0,5–1 gün, şemasız, atılabilir dal)

- **Kapsam:** git worktree `../softmarket-g0`, kopya DB ve uploads, port 3510. Kanıtlanacaklar:
  1. Global görünümde `admin.livePreview.openByDefault`, `elements.beforeDocumentControls` host'u, `useDocumentInfo().globalSlug`, `useAllFormFields`/`addFieldRow`/`moveFieldRow`/`removeFieldRow` ve `useLivePreviewContext().iframeRef` çalışıyor mu?
  2. `livePreviewURL({ globalConfig, req })` içinde `req.searchParams.get('previewPath')` erişilebilir mi? Erişilemiyorsa yedek olarak kullanıcı tercihi (`usePreferences`) kullanılır.
  3. Header'a geçici `versions.drafts` ile `migrate:create` (yalnız kopyada): SQL yalnız ADD mi, `__new_` var mı? `_status` varsayılanı ve mevcut satırda `findGlobal({draft:false})` çıktısı ne? Sürüm satırı yokken `findGlobal({draft:true})` ana satıra düşüyor mu? `_status` göndermeyen `updateGlobal` (import/MCP) ne yapıyor: taslak mı, yayın mı?
  4. `<dialog>` top layer içinde köprü katmanını bağlama ve `cancel` olayını yönetme.
  5. `initMegaNav`'ın `data-canvas-pinned` ile kapanmaması.
- **Çıktı:** `docs/editor-pilot/globals-spike.md` (her madde için evet/hayır, kanıt komutu, G1–G4'e etkisi). Spike kodu ana dala alınmaz.
- **Kabul:** 5 maddenin her biri kanıtlı. Madde 1 veya 3 "hayır" çıkarsa plan revize edilir ve kullanıcıya bildirilir.

### G1 — Şema ve sunucu sözleşmeleri (1,5–2 gün, **şema VAR**)

- **Kapsam:**
  - `src/globals/Header.ts`, `Footer.ts`: `versions.drafts.autosave.interval = 2000`, `max: 50`.
  - Migration `pnpm migrate:create globals_chrome_drafts`: `CREATE TABLE _header_v*`/`_footer_v*` (+ locales ve iç içe array tabloları), `ALTER TABLE header|footer ADD _status` (+ `_header_v.autosave`), indeksler, mevcut satır için `UPDATE … SET _status='published'` ve G0 sonucuna göre başlangıç yayın sürümü `INSERT`'i. Down yalnız bunları kaldırır. Kopya DB → `pnpm migrate` → `content:import --dry-run` → integrity/FK → migration testi.
  - `src/lib/revalidate.ts`: `withGlobalRevalidation` drafts'lı global'de yalnız yayında yeniler. site-settings ve taslaksız global'ler eskisi gibi çalışır.
  - `src/editor/canvas/concurrency.ts`: `guardGlobalEditorVersion`, `savedGlobalEditorVersion` (global kancaları). `plugin.ts` → `visualEditorGlobals(['header','footer','site-settings'])`: alanı ekler, kancaları bağlar, `admin.livePreview.openByDefault`, `admin.components.elements.beforeDocumentControls` host.
  - `src/fields/link.ts`: `url` alanına `validate` (saf `isSafeLinkUrl`, `src/lib/safe-href.ts` ile ortak kural). `reference` için `filterOptions` ile `pages.pageType != template`. `SiteSettings.social.url`: https doğrulaması. Bu değişiklikler şema değildir, yalnız doğrulamadır.
  - `src/lib/content-import/importer.ts`: drafts'lı global'e `_status: 'published'`. `content/seed/schema.json` yeniden üretilir.
  - `src/lib/preview-url.ts`: `LIVE_PREVIEW_GLOBALS = ['header','footer','site-settings']`, `previewTargetPath` global için `previewPath` (yalnız `safePreviewRedirect` geçerse) ya da `/`. `payload.config.ts` `livePreview.globals`.
  - `AGENTS.md` MCP tarifi: header ve footer güncellemesi `_status: 'published'` ister, göndermezse taslak kalır (G0 sonucuna göre kesin cümle). `src/lib/mcp.ts` allowlist değişmez.
  - `pnpm generate:types`, `pnpm generate:importmap`.
- **Kabul:** migration öncesi ve sonrası 8 temsilî sayfa × TR/EN `<header>`/`<footer>` HTML'i bayt bayt aynı (`/`, `/tr/urunler`, ürün, yasal, `/en`…). Eski tabloların satır farkı 0, integrity ok, FK 0. Taslak autosave public okumayı değiştirmez ve revalidate çağırmaz (test). Yayın bir kez revalidate eder. `_status` göndermeyen MCP update davranışı testle kilitli. `content:import` 2× idempotent, globals yayınlı kalır. Eski sürümle 409 alınır, sürümsüz yazım geçer, iki eşzamanlı kayıttan biri 409 alır. `javascript:`/`data:`/`//evil` URL kaydı 400 döner. Seed ve starter template'teki tüm mevcut URL'ler geçer.
- **Testler:** `tests/unit/globals-drafts-migration.test.ts` (kopya DB, up/down/up, satır ve TR/EN koruma, SQL'de yasak ifade yok), `globals-editor-db.test.ts` (409, sürümsüz yazım, eşzamanlı, draft okuma yalnız staff), `link-url-validate.test.ts`, `revalidate` testi genişletilir, `content-import` global fixture, `starter-template-db.test.ts` yeşil.
- **Riskler:** `_status` varsayılanı yüzünden çerçevenin public'te yedeğe düşmesi (G0 + bayt testi). İç içe array sürüm tablolarının uzun adları. `max: 50` dışında budama yok. Yeni URL doğrulamasının eski kaydı engellemesi (seed testi + gerekirse yalnız yeni değerde uygulanan doğrulama).

### G2 — Render: taslak okuma ve editing işaretleri (1,5–2 gün, şemasız)

- **Kapsam:**
  - `src/lib/site.ts`: `getHeaderNav(locale, mode)` ve `getFooterData(locale, mode)`. `mode = 'public' | 'editing'` (`readAs` ile staff draft). Public yol bugünkü kodu aynen kullanır. Editing yolu her öğeye `rowPath` (`navItems.2.children.1`), `rowIds` zinciri, `hiddenReason` (`unresolved|draftTarget|salesLegal|emptyTitle`) ve `fallback: true` bilgisini ekler. Görünürlük kararı yine **public** çözümleyiciyle verilir: rozet "ziyaretçi bunu görür mü" sorusunu doğru yanıtlar. Görünüm taslak veriden gelir.
  - `src/components/layout/{header,header-shell,footer,announcement-bar,logo}.tsx`: yalnız `editing` prop'u true iken `data-chrome="header|footer|announcement|utility|mobile"`, `data-chrome-path`, `data-chrome-ids`, `data-chrome-list` (liste kapsayıcısı + eksen) ve `data-field-path` (metin) basılır. Rozetler sunucuda basılır. `AnnouncementBar` editing'de kapatma durumunu okumaz.
  - `src/app/(frontend)/[locale]/layout.tsx`: `previewUser` varsa `Header`/`Footer` editing modunda çağrılır. Public dal değişmez.
  - `src/lib/header-nav.ts`: panel `data-canvas-pinned` taşıyorsa kapanmaz (≤ 5 satır). `initSheet`: `data-canvas-pinned` dialog'da link tıklaması kapatmaz.
  - Sayfa editörü için çerçeve bölgelerinde `data-chrome-region` (G5 kullanır).
- **Kabul:** public HTML bayt bayt aynı (G1'deki 8 sayfa × 2 dil, anonim ve draft-cookie'siz staff). Ana sayfa JS gzip farkı ≤ +0,1 KB. Editing HTML'de her görünür menü/footer öğesinin `data-chrome-path`'i form state'teki satıra eşlenir (DB testi). Ödeme kapalıyken satış yasal linki editing'de rozetli, public'te yoktur. Mega panel `data-canvas-pinned` ile açık kalır. `header-keyboard.spec.ts` yeşil.
- **Testler:** `tests/unit/chrome-render.test.tsx` (public işaretsiz / editing işaretli, rozet nedenleri, yedek bayrakları), `chrome-render-db.test.ts` (geçici SQLite, TR/EN, taslak yalnız staff), `client-bundle-guard` (+ chrome editör modülleri frontend'de import edilmez), e2e `header-keyboard` regresyonu.
- **Riskler:** `React.cache` anahtarına mod eklenmesi (public ve editing aynı istekte karışmamalı). Rozetli öğelerin mobil menü düzenini bozması (yalnız editing).

### G3 — Köprü ve host çekirdeği: global kapsam (3–4 gün, şemasız) — **kritik çekirdek**

- **Kapsam:**
  - `src/editor/canvas/protocol.ts` **v3**: `scope: 'block'|'doc'|'chrome'`. Yeni bridge mesajları: `chromeReady` (bölgeler + liste özetleri), `chromeSelect`, `chromeMove { list, ids, place, targetId }`, `chromeAdd { list, ids, afterId }`, `chromeDuplicate`, `chromeRemove`, `panel { kind, path, ids, rect }`, `openGlobal { global, previewPath }`. Metin mesajları `scope:'chrome'` + `global`. Host mesajları: `host` (`target: { kind:'collection'|'global', slug }`, `editable` bölge listesi, `readOnly` nedenleri, liste limitleri), `textGrant`, `notice`. Strict şema korunur, origin+source kapısı aynı kalır. `CANVAS_VERSION` 2 → 3 (iki taraf birlikte yüklenir, eski sürümlü mesaj sessizce düşer).
  - `src/editor/canvas/fields.ts`: `INLINE_GLOBAL_FIELDS`, `isInlineGlobalField`. `chrome-rules.ts`: `CHROME_LISTS`, limitler, yeni satır şablonları, id→index çözümü (adres daima satır id zinciridir, render index'i kullanılmaz; host mevcut form state'ten çözer ve id uyuşmazsa reddeder).
  - `src/editor/canvas/admin/host.tsx`: `useDocumentInfo()`'dan `globalSlug` ile global kapsam. Sayfa gövdesi kilitli. Bölge geçişi (flush → `router.push('/admin/globals/<x>?previewPath=…')`). site-settings'te autosave yok, "Kaydet = hemen yayın" onayı. Editor rolünde site-settings bölgeleri salt okunur. Geri al/yinele (`history.ts`, dil başına anahtar `global:<slug>:<locale>`). 409 akışı (`sync.ts`, `merge.ts` global kimliği). Bağımlı tipler ortak tutulur, kopya modül açılmaz.
  - `src/editor/canvas/bridge.tsx`: `[data-chrome]` bölgelerinde hover/seçim çerçevesi, liste araç çubuğu, yatay/dikey sürükleme, klavye eksenleri, `plaintext-only` düzenleme, panel isteği. Mega/mobil durumları G4'te gelir.
  - **Varsayılan menüyü kayda dönüştür:** `POST /api/editor/chrome/materialize` (`src/app/(payload)/api/...` ya da Payload global endpoint'i). Yalnız staff oturumu, aynı origin, `editorVersion` ön koşulu. i18n `nav`/`footer` mesajlarından TR **ve** EN etiketleriyle route bağlantıları üretir ve yalnız **taslak** yazar. Ardından host `Yeniden yükle` yapar. Kullanıcıya "Varsayılan menü düzenlenebilir hale getirilecek (görünüm değişmez)" onayı sorulur.
- **Kabul (V4 kapılarının global karşılığı):** round-trip 0 fark (aç → değiştirmeden kaydet → header/footer TR/EN derin eşit, `editorVersion` ve `updatedAt` hariç). TR/EN 0 sızıntı (EN'de label yaz → TR aynı, boş EN'e TR yazılmamış, Escape boş değeri korur). Sahte postMessage 5 varyant + yanlış `global`, bilinmeyen liste, sahte satır id'si, allowlist dışı yol ve URL taşıyan mesaj reddedilir. maxRows aşılamaz (istemci + sunucu). Dönüşüm sonrası public HTML yayından önce değişmez. Yayından sonra yedek menü ile aynı linkler oluşur (href kümesi eşit).
- **Testler:** `visual-editor-chrome-fields.test.tsx` (şema↔allowlist, her yol lokalize text), `visual-editor-chrome-bridge.test.ts` (protokol v3, id çözümü, limitler, eksenler), `visual-editor-chrome-db.test.ts` (round-trip, 409, dönüşüm uç noktası yetki: anonim 401, customer/editor-API-key 403, cross-site 403), `visual-editor-merge` global vakası.
- **Riskler:** Payload form API'nin global görünümde farklı davranması (G0 ile azaltılır). Derin array yollarında `moveFieldRow` ile satır id'sinin korunması. `CANVAS_VERSION` artışında açık sekmeler (eski host ile yeni köprü uyarı verir: "Sayfayı yenileyin").

### G4 — Paneller, mega menü ve mobil menü UI (2,5–3 gün, şemasız)

- **Kapsam:** `src/editor/canvas/admin/panels/{link-target,mega-menu,announcement,utility,logo,social,contact,copyright}.tsx` (admin import map, frontend'den import yok). Popover konumu iframe `rect` + ölçek (Sığdır modu) ile hesaplanır. Odak popover'a taşınır, Esc kapatır ve odak tuvale döner (`aria-modal` değil, `role="dialog"` + odak döngüsü).
  - **Mega menü:** seçili üst öğede "Paneli aç/sabitle" düğmesi bulunur. Köprü `data-state=open` + `data-canvas-pinned` uygular. Seçim değişince panel açık kalır. "Kapat" ile sabitleme kalkar. Kolon ve öne çıkan kart düzenlemesi panel içinde yapılır. Otomatik paneller (products/solutions) rozetli ve salt okunurdur.
  - **Mobil menü:** 390 kırılımında araç çubuğunda "Mobil menüyü aç" bulunur. Köprü `showModal()` çağırır, seçim/araç çubuğu katmanını **dialog'un içine** portal eder (top layer), dialog'a `data-canvas-pinned` ekler. `cancel` olayı metin düzenleme sırasında `preventDefault` ile yutulur (Esc önce düzenlemeyi bırakır, ikinci Esc dialog'u kapatır). Native focus trap korunur. Admin popover'ları parent belgede olduğu için çakışma yoktur. Mobil liste dikey eksen kullanır. Masaüstü ve mobil aynı satırları düzenler.
  - Etiketler `src/lib/visual-editor-labels.ts` (TR/EN), `admin-labels.test.ts`.
- **Kabul:** e2e: mega panel açık tutulup kolon başlığı düzenlenir ve kaydedilir. Mobil menüde öğe sırası değiştirilir ve masaüstünde de değişir. Bağlantı hedefi route → kayıt → harici olarak değiştirilir. `javascript:` adresi panelde ve sunucuda reddedilir. Logo yalnız public görselle değişir, korumalı medya reddedilir. axe ihlali 0 (popover'lar). Klavye ile seç → taşı → düzenle → panel aç akışı fare olmadan tamamlanır.
- **Testler:** e2e `tests/e2e/isolated/visual-editor-chrome.spec.ts`, panel birim testleri (URL kuralı, limitler).
- **Riskler:** top layer içinde köprü stillerinin site stiliyle çakışması (shadow DOM yerine önekli sınıf + `all: initial` kapsayıcı). Ölçekli iframe'de popover konumu. Dialog'un kendi Esc davranışı.

### G5 — Sayfa ve ürün editöründe "Site geneli" kısayolu (1 gün, şemasız)

- **Kapsam:** pages/products tuvalinde `data-chrome-region` hover çerçevesi ve "Site geneli · Tüm sayfalarda" rozeti. Tıklanınca "Üst menüyü düzenle ↗ / Alt bilgiyi düzenle ↗" görünür. Seçim satırı açılmaz. Host bekleyen sayfa kaydını flush eder ve global editörü `previewPath=<o anki yol>` ile açar. Global editörde "← <Sayfa adı>'na dön" (`sessionStorage` dönüş yolu, yalnız `/admin/collections/(pages|products)/<id>` deseni) bulunur. Çerçeve taslağı yayınlanmamışsa rozet: "Çerçevede yayınlanmamış değişiklik".
- **Kabul:** sayfada bekleyen değişiklik kaybolmaz (flush + 409 yolu). Dönüşte aynı sayfa ve aynı kaydırma konumu gelir. Ürün editörü V2 kilitleri bozulmaz. Rozet public HTML'de yoktur.
- **Testler:** e2e senaryosu (sayfa → çerçeve → dön), `visual-editor-bridge` genişletmesi.

### G6 — site-settings marka bölgeleri (1–1,5 gün, şemasız; §8 soru 2 yanıtına bağlı)

- **Kapsam:** site-settings global görünümünde canvas: logo/logoDark (panel), siteName/tagline (yerinde), social (liste + panel), contact (panel). Autosave yok. Kaydetmeden önce onay iletişim kutusu: "Bu değişiklik kaydedince tüm sitede hemen yayınlanır." Diğer sekmeler (commerce, company, legal) formda kalır, tuvalde bölgeleri yoktur. Editor rolü için bölgeler salt okunurdur (sunucu `isAdmin` otoritedir).
- **Kabul:** admin logo ve sosyal bağlantıları değiştirir, kayıt sonrası public header/footer güncellenir (revalidate 1 kez). Editor rolünde yazım denemesi 403 alır ve canvas "Yalnız yönetici" gösterir. Commerce/legal alanları canvas işlemleriyle değişmez (DB testi: kayıt öncesi ve sonrası derin eşit).
- **Riskler:** site-settings formu büyük ve sekmelidir. Formun tamamı gönderilir, bu yüzden ödeme alanlarının kazara değişmemesi testle kilitlenir.

### G7 — QA, performans, güvenlik denetimi ve kılavuz (1,5–2 gün)

- Kopya DB ile `.next-g7` build. Lighthouse mobil 3 koşu medyanı (`/tr`, ürün): Perf, LCP, CLS 0 ve JS ≤ 130 KB (V5 değeri 129,62 KB'tan +0,2 KB'tan fazla artış olmaz).
- İzole e2e (3400): V5 senaryoları + chrome senaryoları + `header-keyboard` + `payments` (satış yasal link filtresi). Güvenlik: sahte mesaj, anonim/customer admin global görünümü, draft cookie kopyası, dönüşüm uç noktası.
- `docs/editor-guide.md` yeni bölüm "§2.11 Site çerçevesini görsel düzenle". `AGENTS.md`: globals taslak/yayın, MCP `_status`, chrome işaretleri. `memory-bank` güncellemesi.
- **Kabul:** `docs/perf/visual-globals-acceptance.md` tablosu yeşil, kullanıcı 6 görevlik deneme yapmış ve onaylamış: (1) menü öğesi ekle ve adını yaz, (2) iki öğenin yerini değiştir, (3) bir öğenin hedefini başka sayfaya çevir, (4) footer'a kolon ekle, (5) EN'e geç ve bir etiketi çevir, (6) yayınla.

---

## 5. Paralellik ve sıralama

- **Sıra:** G0 → G1 (tek şema fazı; ana dala alınmadan başka `migrate:create` yapılmaz) → G2 → G3 → (G4 ∥ G5) → G6 → G7.
- G4 ve G5 paralel yürüyebilir. Dosya sahipliği: G4 `src/editor/canvas/admin/panels/**`, `bridge.tsx`'in mega/mobil bölümü. G5 `host.tsx` yönlendirme/dönüş bölümü, `bridge.tsx`'in `data-chrome-region` bölümü. `bridge.tsx`/`host.tsx` ortak dosyalardır, birleştirmeden önce G3 sahibi gözden geçirir.
- `generate:types`/`generate:importmap` yalnız şema sahibinde (G1) ve panel bileşenleri eklendiğinde (G4) çalışır.
- Build ile typecheck aynı anda çalıştırılmaz. Ağır SQLite testleri `--maxWorkers=1`.
- Her faz sonunda çapraz QA ve kullanıcı onayı alınır, sonra sıradaki faza geçilir.

## 6. Ajan dağılımı

Kurallar: yazan ve denetleyen farklı olur. Claude yazarsa GPT Sol veya Terra High denetler. GPT yazarsa Opus Medium denetler. Ağır backend ve kritik çekirdek Opus Medium'dur. UI Sonnet Medium'dur. Tasarım ağırlıklı iş Opus Medium'dur (Sonnet High kullanılmaz). Pahalı modeller yalnız kritik işte kullanılır.

| Faz | Yazan (effort) | Denetleyen (effort) | Not |
|---|---|---|---|
| G0 spike | GPT Terra (High) | Claude Opus (Medium) | Odaklı teşhis, zaman kutusu 1 gün |
| G1 şema + migration + kancalar | Claude Opus (Medium) | GPT Sol (High) | Migration SQL'i ve `_status` semantiğini Sol denetler |
| G1 URL doğrulama + importer | GPT Sol (Medium) | Claude Opus (Medium) | Net ve testli iş |
| G2 render + işaretler | Claude Opus (Medium) | GPT Terra (High) | Bayt eşdeğerliği ve bundle ölçümü Terra'da |
| G3 protokol + host + köprü çekirdeği | Claude Opus (Medium) | GPT Sol (High) + Terra (High) güvenlik | Planın en kritik işi. Opus High yalnız G0 form API farkı bulursa |
| G3 dönüşüm uç noktası | Claude Opus (Medium) | GPT Sol (High) | Yetki ve transaction |
| G4 paneller + mega/mobil UI | Claude Sonnet (Medium); popover/etkileşim tasarımı Opus (Medium) | GPT Sol (High) | a11y ve bundle guard |
| G5 kısayol | Claude Sonnet (Medium) | GPT Sol (High) | |
| G6 site-settings | Claude Sonnet (Medium) | GPT Sol (High) | Commerce alanlarının korunduğu test şart |
| G7 testler/perf/güvenlik | GPT Terra (High) + Sol (Medium) e2e | Claude Opus (Medium) | Kısa görevlere bölünür |
| G7 kılavuz, etiketler, AGENTS, memory-bank | Claude Haiku (Low) | GPT Sol (Medium) | |
| Faz sonu commit | Claude Haiku (Low) | — | Yalnız QA yeşilken ve kullanıcı isteyince |

## 7. En büyük riskler

1. **Global'lere taslak eklemenin yan etkileri.** `_status` varsayılanı public çerçeveyi yedeğe düşürebilir. `_status` göndermeyen MCP veya import yazımı taslak kalabilir ya da yayına girebilir. Autosave her 2 saniyede tüm siteyi revalidate edebilir. Önlem: G0 kanıtı, backfill, bayt testi, publish-only revalidate testi, importer `_status`, AGENTS tarifi.
2. **Satır kimliği ve filtrelenmiş render.** Public yükleyici öğeleri atar ve yedek menü kayıtsızdır. Editing render public'ten farklı olmalı, public HTML ise değişmemelidir. Önlem: mod ayrımı, satır id zinciriyle adresleme, host tarafında id doğrulaması, bayt testi, dönüşüm uç noktası.
3. **Mega ve mobil menü etkileşimi.** Otomatik kapanma, `<dialog>` top layer/inert ve Esc çakışması public koda dokunmayı gerektirir. Önlem: `data-canvas-pinned` ile minimum yama, köprü katmanının dialog içine portal edilmesi, `header-keyboard.spec.ts` regresyonu, bundle ölçümü.

Ek riskler: Payload global edit view iç API'si (her Payload güncellemesinde chrome e2e zorunlu), site-settings formunun tamamının gönderilmesi, yeni URL doğrulamasının eski kayıtları engellemesi.

## 8. Kullanıcıya açık sorular (önerilerle)

1. **Tek tuval düzeyi:** Önerimiz şu: çerçeve kendi editöründe düzenlenir ve sayfa editöründe "Site geneli → Düzenle" kısayoluyla aynı görüntüde geçilir. Sayfa editörünün içinden doğrudan menü düzenleme (ikinci yazım yolu, +4–6 gün ve ek risk) ilk sürümde gerekli mi? **Öneri: hayır.**
2. **Logo, site adı, sosyal bağlantılar ve iletişim (site-settings):** İlk sürümde taslaksız mı olsun (kaydet = hemen yayın, yalnız admin, onay kutusuyla), yoksa site-settings'e de taslak eklensin mi (+1,5–2 gün, ödeme/yasal okuyucu denetimi)? **Öneri: taslaksız + onay.**
3. **Editör rolü:** Header ve footer'ı bugün editörler de güncelleyebiliyor. Taslak eklenince yayınlama da editörlere açık kalsın mı? **Öneri: evet** (mevcut erişim korunur).
4. **Menü taşıma kapsamı:** Bir alt menü öğesini başka bir üst menünün altına sürükleme (listeler arası taşıma) ilk sürümde gerekli mi? **Öneri: hayır.** Aynı liste içinde sıralama yeterli, listeler arası taşıma sonraki sürüm.
5. **Kayıtsız varsayılan menü/footer:** Düzenlemeye başlanınca TR ve EN etiketleriyle tek onayla kayda dönüştürülsün mü (görünüm değişmez, taslak olarak)? **Öneri: evet.**

## Kullanıcı kararları (2026-11-17)

- Sayfa editörü içinden doğrudan menü düzenleme **yok**; sayfa editöründe header/footer bölgesi "Site geneli" kısayoluyla çerçeve editörüne geçer (G5).
- Site ayarları (logo, site adı, sosyal, iletişim) **taslaksız**: kaydet = yayın, yalnız admin, kayıttan önce onay kutusu (G6).
- Header/footer yayın yetkisi **editör + admin** (bugünkü erişim korunur).
- Alt menü öğeleri yalnız **aynı liste içinde** sıralanır; menüler arası sürükleme yok.
- Kayıtsız varsayılan menü/footer, düzenlemeye başlanınca TR+EN etiketleriyle tek onayla kayda dönüştürülür (öneri kabul — soru 5 sorulmadı, öneri varsayılan alındı).

## G0 sonucu ve plan revizyonu (2026-11-17)

G0 kabul edildi (rapor: `docs/editor-pilot/globals-spike.md`). 6 maddeden 5'i geçti, mobil menü Esc yönetimi kurallı kabul. Revizyonlar:

1. Mobil menü (`<dialog>`) Esc yönetimi `cancel` olayı yerine `document` capture `keydown` (Escape) ile yapılır; önce seçim/düzenleme kapanır, sonra dialog. Chromium üçüncü ardışık Esc'te `cancel`'ı iptal edilemez yapıyor.
2. Köprü/seçim katmanı dialog'un İÇİNE mount edilir; `popover` ve body katmanı top layer altında tıklanamıyor.
3. G1 migration: Header ve Footer için `versions.drafts` + autosave; migration sonuna `UPDATE header SET _status='published'; UPDATE footer SET _status='published';` (ilk sürüm satırı INSERT gerekmez). Footer migration'ı `footer_columns_locales` tablosunu yeniden kuruyor (`title` NOT NULL → nullable): proje kuralı `__new_` yeniden kurulumu yasaklar; yönetici kararı: migration yalnız bu tablo BOŞKEN rebuild yapar, satır varsa hata fırlatıp durur (veri kaybı imkânsız). Canlıda tablo boş. Dolu veriyle prova kopya DB'de yapılır. Down yalnız sürüm tablolarını ve `_status`'u kaldırır; `title` nullability geri alınmaz.
4. Kabul: migration öncesi/sonrası public header/footer HTML'i ham bayt eşit ve içerik hash'i eşit.
5. Importer ve MCP tarifi her zaman `_status: 'published'` gönderir; taslak yazım yalnız `draft: true` ile. `beforeChange`'de `draft` olmadan gelen `_status: 'draft'` reddedilir (public okuma `_status`'a bakmadığı için taslak içerik aksi halde yayına sızar). Testli.
6. Mega menü sabitleme: yalnız editing render `data-canvas-pinned` basar; unpin/cleanup zorunlu; başka panele geçiş unpin+pin.
7. G2'de `livePreview.breakpoints` (390/768/1440) header/footer için tanımlanır. Drafts+autosave ile tek "Yayınla" düğmesi vardır. `previewPath` sorgusu çalışıyor; tercih yedeği gerekmez. `iframeRef.current` ilk render'da null — efekt/poll ile okunur.

## G1 implementation record (2026-11-17)

Status: implemented, awaiting QA. Not applied to the live DB, no commit.

- **Schema:** `Header`/`Footer` get `versions: { drafts: { autosave: { interval: 2000 } }, max: 50 }` (`src/globals/chrome-drafts.ts`). Migration `20261117_133332_globals_chrome_drafts`:
  - Up: 22 `CREATE TABLE` (`_header_v*` 13, `_footer_v*` 9), 69 `CREATE INDEX` + 11 `CREATE UNIQUE INDEX` (incl. the two recreated `footer_columns_locales` indexes and `header__status_idx`/`footer__status_idx`), 2 `ALTER TABLE … ADD _status`, 2 backfill `UPDATE … SET _status = 'published'`. No `DELETE`, `INSERT`, `PRAGMA`. No initial version row (G0).
  - The only rebuild is `footer_columns_locales` (title NOT NULL → nullable): the first statement of up() counts its rows and throws `FOOTER_REBUILD_REFUSED` before any change when the table is not empty; when empty it is recreated without copying data. The live DB table is empty (0 rows).
  - Down: refuses (`DOWN_REFUSED`) while header/footer have an unpublished draft (`latest = 1 AND version__status = 'draft'`), because that content exists only in the version tables. Otherwise it drops the 22 version tables (children first), the two `_status` indexes and columns. Published history is dropped with the tables (the current content is in the main row; take a backup first if history matters). `title` nullability is not reverted (a NOT NULL rebuild could fail on rows written after up()).
  - DB copy: 700 pre-existing tables row-hash equal after migrate, `integrity_check` ok, `foreign_key_check` empty, header/footer `_status = published`, `content:import --dry-run` and 2× real import ok (idempotent, 0 new header/footer versions).
- **`_status` safety:** global `beforeOperation` (`guardGlobalDraftStatus`; global `beforeChange` has no `draft` argument in Payload 3.93) rejects with a 400 `ValidationError` (`req.t('softmarket:…')`, TR/EN in `src/lib/validation-messages.ts`): `_status` other than `published` without `draft: true` (covers Local API, REST, MCP and the admin "Unpublish" request), restoring a draft version, and REST "restore as draft" (Payload global restore writes the main row directly). Importer sends `_status: 'published'` for drafts-enabled globals and re-writes a main row that is not published.
- **Revalidation:** `withGlobalRevalidation` revalidates a drafts-enabled global only when the result is published (the restore record's `version._status` is authoritative); draft/autosave never revalidates. `site-settings` unchanged (every save).
- **Concurrency:** `guardGlobalEditorVersion`/`savedGlobalEditorVersion` (`src/editor/canvas/concurrency.ts`), added by `visualEditor()` to header/footer with the virtual `editorVersion` field (no schema). Same token as collections (all-locale snapshot hash); stale → 409, versionless writes pass, two concurrent saves from one base → exactly one 409. `lockDocuments` stays Payload's default for globals (different-user lock only).
- **Link URL validation:** `linkField().url` validate = `isAllowedLinkUrl` (`src/lib/safe-href.ts`, same rule as `safeHref`). Dangerous values (`javascript:`/`data:`/`vbscript:`, obfuscated variants, `//`, `/\`) are always rejected; other invalid values are rejected unless unchanged (`previousValue`). Seed/starter contain no `url` values. Live DB: 16 product CTA rows with the placeholder `mailto:[ŞİRKET E-POSTA]`/`mailto:[COMPANY EMAIL]` (8 products × TR/EN) fail the rule and are grandfathered while unchanged (render already drops them). Payload does not validate drafts; publishing validates.
- **Draft reads:** `getHeaderNav(locale, previewUser)` / `getFooterData(locale, previewUser)`; `Header`/`Footer` pass `getPreviewUser()` (draft mode + re-validated staff). Anonymous reads stay `draft: false`.
- **Not in G1 (moved per G0 revision 7 / user scope):** global Live Preview config and editor host (G2/G3), `reference` `filterOptions` for template pages and `site-settings.social.url` https validation (still open).

### G1 independent audit (2026-11-17)

- Fixed public/customer `draft: true` reads and customer version-history access: chrome globals now use `publishedOrStaff` and explicit staff-only `readVersions`.
- Fixed status-less updates inheriting a pending draft and copying it into the public main row. They return 400; status-less writes without a pending draft preserve the legacy publish behavior.
- Refused projected writes (`select`, 400 before mutation): Payload 3.93 passes the projected main-row result into version persistence, truncating history, defaulting its status to draft, and skipping publication revalidation. Callers can project a subsequent read.
- Fixed invalid URL grandfathering through autosave. Publication (including version restore) compares all localized URLs and stable array row IDs against the pre-write public row, inside the same transaction and before revalidation. Drafts can still hold incomplete input; invalid publication rolls back.
- Migration SQL on the required backup copy matches the snapshot's columns, nullability, primary keys, foreign keys and indexes; integrity is `ok`, with no foreign-key violations. Up/down guards and published backfill remain unchanged. Leaving `footer_columns_locales.title` nullable on down is the intentional G0 exception.
- Final validation: backup-copy up/down/up preserves original-column row hashes for all 701 pre-existing tables. Typecheck, lint and diff-check pass; full Vitest passes 94 files / 1,558 tests (384.14 s), including 18 G1 database regressions, migration guards, URL bypasses, publish-only revalidation and editor concurrency. No open G1 findings; no commit or live migration was performed.
