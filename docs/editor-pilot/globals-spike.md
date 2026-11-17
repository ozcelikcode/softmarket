# G0 — Global görsel editör doğrulaması (2026-11-17)

**Durum: tamamlanmadı.** Aşağıdaki sonuçlar birbirinden bağımsızdır; kaynak kod yolu ve Local API kanıtı, gerçek admin/Chromium veya public HTML kanıtı yerine geçmez. Plan worktree'de yoktu; salt okunur `/Users/ozcelik/dev/softmarket/docs/plan-visual-globals.md` kullanıldı. Dal `spike/globals-g0`, Payload 3.93.0. Deneysel kod ve migration yalnız bu worktree'dedir, ana dala alınmamalıdır. DB'ler SQLite `.backup` ile canlıdan oluşturulan `/private/tmp/.../scratchpad/softmarket-g0.db` ve `/private/tmp/g0-fresh.db` kopyalarıdır. Canlıya migration uygulanmadı.

## 1. Global Live Preview host — kaynak yolu evet, tarayıcıda doğrulama hayır

Geçici `src/editor/canvas/admin/g0-probe.tsx` tüm istenen hook'ları çağırıyor; `Header.ts` içinde global `admin.livePreview.openByDefault` ve `admin.components.elements.beforeDocumentControls` tanımlandı. `pnpm generate:importmap && pnpm typecheck` başarılı. Bu yalnız tip/derleme kanıtıdır, hook'ların gerçek etkileşimde çalıştığını ispatlamaz.

Payload kaynak yolu: `@payloadcms/next/dist/views/Document/renderDocumentSlots.js:27` global slotu seçer; `Document/index.js:331,351,354` globalSlug, LivePreviewProvider ve tercih yoksa openByDefault'u taşır. `@payloadcms/ui/dist/views/Edit/index.js:451-460,530` global görünümünü Form içine koyar; `elements/DocumentControls/index.js:222` slotu basar. `forms/Form/index.js:531-563,621-623` üç satır eylemini sağlar; `providers/LivePreview/index.js:69,203` iframeRef'i verir, `elements/LivePreview/Window/index.js:113` iframe'e bağlar. `scripts/g0-request.ts` çıktısında `enabled:true, open:true` vardır. Bunlar satır ekleme/taşıma/silmenin, iframe ref'in dolmasının veya önceki kullanıcı tercihinin etkisinin gerçek UI testini karşılamaz.

Chromium `@playwright/test` launch, `--no-sandbox` ile de `bootstrap_check_in ... Permission denied (1100)` nedeniyle kapanıyor. 3510 Next dev `EMFILE: too many open files, watch` uyarılarıyla `/tr` için 404 verdi; dolayısıyla admin HTTP/host doğrulaması da alınamadı. **G1–G4 etkisi:** mimari kaynakta destekleniyor, fakat gerçek global form mutasyonları ve host için tarayıcı kabul testi G1/G2 öncesi zorunlu; madde 1 için kesin evet denemez.

## 2. previewPath — evet, gerçek admin isteği henüz doğrulanmadı

`node --env-file=.env --import tsx scripts/g0-request.ts` (geçici Header config ile) çıktısı: `param:/tr/urunler`, `enabled:true`, `open:true`, `url:http://127.0.0.1:3510/api/preview?redirect=%2Ftr%2Furunler`. Bu, Payload `createLocalReq` ve gerçek `handleLivePreview` ile oluşturulmuş temsilî istektir. `@payloadcms/next/dist/views/Root/index.js:97-122` admin query'yi `urlSuffix`e koyar; `utilities/initReq.js:72` bunu `createLocalReq`e aktarır; `payload/dist/utilities/createLocalReq.js:24-55` URL'den `searchParams` üretir; `ui/dist/utilities/handleLivePreview.js` globalConfig ve aynı req'i callback'e geçirir. Dolayısıyla gösterilen normal kod yolunda erişilebilir. `safePreviewRedirect` ile doğrulama yine zorunlu. **G1–G4 etkisi:** `previewPath` kullanılabilir; `usePreferences` zorunlu yedek olarak görünmüyor. Gerçek giriş/refresh ve query'nin locale geçişlerinde korunması G2 E2E ile doğrulanmalı.

## 3. Taslak migration — SQL evet; HTML ve footer henüz doğrulanmadı

`pnpm migrate:create g0_header_drafts` yalnız Header drafts açıkken `src/migrations/20261117_131103_g0_header_drafts.ts` üretti. Up: 13 CREATE TABLE, 37 CREATE INDEX, 6 CREATE UNIQUE INDEX, 1 ALTER TABLE ADD; `__new_`, DROP TABLE, DELETE FROM yok. `header._status text DEFAULT 'draft'` ekleniyor. Üretilen down tabloları siler; G1 için planın güvenli down koşulları ayrıca tasarlanmalı. Footer bu deneye eklenmedi; onun SQL'i ayrıca üretilip incelenmeli.

İlk kopyada `pnpm migrate`, sonra `node --env-file=.env --import tsx scripts/g0-probe.ts`: TR ve EN `publishedStatus:draft`, `draftStatus:draft`, iki okumada 4 nav öğesi ve `identical:true`; `_header_v` başlangıçta boştu. Bu örnekte `findGlobal({draft:false})` draft durumlu ana satırı filtrelemedi, fallback'e düşmedi; `draft:true` sürüm satırı yokken ana satıra düştü. Bu Local API sonucu, tüm public render yollarının eşitliği değildir.

Ayrı temiz kopyada migration sonrası `scripts/g0-hash.ts`, ardından `UPDATE header SET _status='published'` ve tekrar aynı script: `_header_v` sayısı **0**, TR ve EN içerik hash'leri durum alanı çıkarıldığında sırasıyla `fed274315cae2410db4350955a909b0192c6fed99390b1d56571a612ca634660` ve `a5057a3694739017c20ddf55be992d56c3fab94132ea2195e82c0d1b34f4c732` olarak aynı kaldı (her dilde 4 öğe). Mevcut satırı yayın durumunda temsil etmek için backfill gerekli; ilk Local API okumaları için sürüm satırı INSERT gerekmedi. Bu, admin sürüm geçmişi ve bütün frontend davranışları için INSERT'in gereksizliğini tek başına ispatlamaz.

`scripts/g0-request.ts` açık `_status:'published'` yazımından sonra `draft:true` ile yazınca public `published G0`, draft `draft G0` okundu. Ardından `scripts/g0-update.ts` ile `_status` ve `draft` verilmeden `updateGlobal` sonucu `update:draft`, `publicStatus:draft`, `publicText:no status G0`, `draftStatus:draft`, `draftText:no status G0`: ana satır değişti ve public okumada göründü. **G1 etkisi:** importer/MCP için yalnız durum değil `draft` seçeneği ve public etki de açık sözleşme/test olmalı; import yayınlamak istiyorsa `_status:'published'` açıkça göndermeli. Taslak kaydı `draft:true` olmadan güvenli değildir. 

**G1 kesin uygulama adayı, henüz kabul değil:** Header ve Footer için ayrı üretilen up SQL'lerini incele; `UPDATE header SET _status='published'` ve `UPDATE footer SET _status='published'` yalnız yeni kolona backfill ekle. İlk okuma için `_header_v` INSERT'i yapma; Footer ve gerçek admin sürüm/publish akışı da boş geçmişle sınanmalı. Migration öncesi/sonrası TR/EN public `<header>` ve `<footer>` bayt eşitliği burada ölçülemedi (`/tr` 404); G1 kabulünden önce çalışan izole sunucuda mutlaka ölçülmeli. Canlıya uygulamadan önce planın yedek ve güvenli down şartları geçerli.

## 4. Dialog top layer — doğrulanmadı

`header-shell.tsx:151` native dialog; `initSheet` `showModal()` ve native cancel kullanır. Köprü seçimi `bridge.tsx` içinde Esc ile temizler. Önerilen prototip: seçim katmanını açık dialog içine React portal ile bağla, dialog `cancel` olayında aktif düzenleme/seçim varsa `preventDefault()` ve önce bunu kapat; aktif editör işlemi yoksa varsayılan dialog kapanışı ve focus dönüşü korunsun. İlişkili köprü click olaylarının `initSheet` içindeki link/close kontrolünü yanlış tetiklememesi de sınanmalı. Chromium açılamadığı için bu bir öneridir, çalışan top-layer prototipi veya teknik engel kanıtı değildir. **G4 etkisi:** gerçek 390 px Chromium testinde tıklama, odak, Tab, iki aşamalı Esc, kapanış ve yeniden açılış geçmeden G4 kabul edilmemeli.

## 5. Mega menü sabitleme — öneri evet, çalışma testi yok

`src/lib/header-nav.ts` içindeki `close()` bütün hover/focus/outside/link/Escape yollarının ortak kapanışıdır; `open()` mevcut paneli doğrudan `setState(current,false)` ile kapatır. Minimal öneri: `close()` içinde mevcut panelin `data-canvas-pinned` işaretini kontrol et; `open()` içinde farklı tetikleyici açılırken de sabit panelin yerinden edilmesini önle. Explicit unpin ve cleanup için zorunlu kapanış yolu olmalı, aksi halde unmount temizliği bozulur. Yalnız editing render işaret basmalı; normal public davranış değişmemeli. Esc ve yeni panel seçiminin editör sözleşmesi ayrıca tanımlanmalı. Bu değişiklik uygulanıp test edilmedi. **G2 etkisi:** kaynak analizi uygulanabilirlik gösterir; pointer, focus, link, Escape, farklı tetikleyici ve cleanup regresyonları gereklidir.

## Plan revizyonu ve açık kapılar

Planın G0 kabulü sağlanmadı: 1 ve 4 gerçek UI kanıtı, 3 öncesi/sonrası HTML ve Footer, 5 davranış testi eksik. G1'e geçişi bu kanıtlarla koşullandıran açık revizyon gerekir. Özellikle `_status` gönderilmeyen global güncellemesinin ana satıra/public görünüme yazabildiği planın import/MCP metnine eklenmeli. `previewPath` için tercih yedeği varsayımı normal Payload 3.93 kod yolunda gerekli görünmüyor, gerçek admin testine kadar koşullu kalmalı.

3510'u kapatma denemesi: `kill $(lsof -ti :3510)` → `kill 5987 failed: operation not permitted`. Başka PID veya süreç grubu hedeflenmedi; 3510 süreç durumu kullanıcı tarafından kontrol edilmelidir. `pnpm dev` script'i 3100'ü sabitler; spike sunucusu `NEXT_DIST_DIR=.next-g0 pnpm exec next dev -p 3510` ile açıldı.

---

# Tarayıcı doğrulaması (Sonnet)

Tarih 2026-11-17. Gerçek Chromium (`@playwright/test`, sandbox dışı çalıştı), gerçek admin oturumu, Next dev 3510 (`NEXT_DIST_DIR=.next-g0`, `G0_DRAFTS=1`). DB: canlıdan `sqlite3 .backup` ile alınmış kopya (`scratchpad/g0/pre.db`), `.env` kopya DB'yi gösterir; canlı DB/3100/ana `.next` dokunulmadı. Terra'nın "Chromium açılmadı" engeli bu ortamda yok. Ekran görüntüleri: `/private/tmp/claude-501/-Users-ozcelik-dev-softmarket/86cb568c-5f6b-4b21-b0fe-e6a5de07c79f/scratchpad/g0/` (01–08 .png). Betikler `scripts/g0-*.{mjs,ts}`. Header/Footer `versions.drafts` yalnız `G0_DRAFTS=1` ile açılır (öncesi/sonrası ölçümü için).

| # | Madde | Sonuç |
|---|-------|-------|
| 1 | Global edit: openByDefault, beforeDocumentControls, hook'lar, satır eylemleri, iframeRef | EVET |
| 2 | Footer drafts migration + backfill | EVET (rebuild dikkati, aşağıda) |
| 3 | Migration öncesi/sonrası header/footer HTML bayt eşitliği | EVET |
| 4 | Taslak kayıt public'i değiştirmez; yayın değiştirir | EVET |
| 5 | Dialog top layer + Esc | KISMEN: dialog içi katman evet; dışı hayır; Esc `cancel` tek başına GÜVENİLMEZ, keydown yakalama evet |
| 6 | Mega menü `data-canvas-pinned` | EVET |

## 1. Global edit host (`/admin/globals/header?previewPath=%2Fen`)

Kanıt `scripts/g0-admin.mjs`, ekran `01-header-edit-livepreview.png`, `02-after-add-move.png`:
- `livePreview.openByDefault`: sayfa açılışında önizleme paneli açık, tek iframe `http://127.0.0.1:3510/api/preview?redirect=%2Fen` (`previewPath` sorgusu url fonksiyonuna ulaşıyor). Tercih çerezi olmadan açıldı.
- `beforeDocumentControls`: host render oldu (`[data-g0-host]`, düğmeler belge denetim çubuğunda, ekran 01).
- `useDocumentInfo().globalSlug` = `header`; `useAllFormFields` 211 alan (satır eklenince 225, silince 211).
- `addFieldRow({path:'navItems', schemaPath:'header.navItems', rowIndex})`: satır sayısı 4→5, form'da yeni satır. `moveFieldRow(0→son)`: etiketler `Ürünler|Çözümler|Destek|Şirket|?` → `Çözümler|Destek|Şirket|?|Ürünler`. `removeFieldRow(son)`: 5→4. Üçü de gerçekten formu değiştirdi.
- `useLivePreviewContext().iframeRef.current`: `IFRAME` elemanı; ilk render'da `null`, ~birkaç yüz ms sonra dolu (bir efekt/poll ile okunmalı, render sırasında okunmaz). `isLivePreviewing` true.
- Konsol/page hatası yok. Arayüz: drafts+autosave açıkken tek "yayınla" düğmesi (`#action-save`), "Taslak kaydet" düğmesi yok (autosave).
- Breakpoint: toolbar genişlik/yükseklik girdileri (`input.toolbar-input`) ile iframe 390 px olur (`innerWidth` 390 doğrulandı); `livePreview.breakpoints` Header'a eklendi.

## 2. Footer drafts migration

`G0_DRAFTS=1 pnpm migrate:create g0_footer_drafts` → `src/migrations/20261117_131501_g0_footer_drafts.ts`. Up: 10 CREATE TABLE, 32 CREATE INDEX, 5 CREATE UNIQUE INDEX, `ALTER TABLE footer ADD _status text DEFAULT 'draft'` + `footer__status_idx`. **Tek istisna:** `PRAGMA foreign_keys=OFF` + `__new_footer_columns_locales` oluştur, `INSERT ... SELECT`, `DROP TABLE footer_columns_locales`, RENAME. Neden: `footer_columns_locales.title` `NOT NULL` → nullable (drafts ile zorunlu yerelleştirilmiş alanlar gevşer). Kopya DB'ye 2 sütunlu, TR+EN footer içeriği yazılarak (`scripts/g0-seedfooter.ts`, 4 satır) denendi: migrate sonrası satır sayısı 4, id'ler korundu. (Header için rebuild yok.) Gözlem: boş footer ile bu rebuild sınanmış olmazdı; canlıda footer satırı dolu olabileceğinden G1 yedekten önce mutlaka dolu veriyle prova edilmeli.

İçerik hash'leri (`scripts/g0-hash.ts`, `_status/updatedAt/createdAt` hariç, id dahil), migration ÖNCESİ = migrate sonrası backfill'siz = backfill sonrası:
header tr `f77813192f9bf06b`, en `aa1e312316bed2d0`; footer tr `1284109223496625`, en `49d6b39eb08155ad`. Backfill'siz `_status=draft` iken de `findGlobal({draft:false})` içeriği döndü (globals ana satırı `_status`'a göre süzmez); backfill gerçeği temsil eder (admin "Yayınlandı" göstersin diye gerekli). `_header_v`/`_footer_v` backfill sonrası 0 satır; ilk okuma ve ilk admin yükleme için INSERT gerekmedi (admin "Durum: Yayınlandı" gösterdi, ilk autosave/yayın sürümü kendisi oluşturdu).

## 3. HTML bayt eşitliği

`scripts/g0-capture.mjs` + `scripts/g0-cmp.mjs`. Sayfalar: `/tr`, `/en`, `/tr/urunler/akis-yonetimi/akis-merkezi`, `/en/products/akis-yonetimi/akis-merkezi`. ÖNCE (migration yok, drafts kapalı) iki yakalama kendi içinde bayt eşit. SONRA (migrate + backfill + drafts açık) her sayfanın `<header>` ve `<footer>` HTML'i **ham bayt eşit** (header 22089/22162, footer 4631/4643 bayt; tam sayfa uzunlukları da aynı: 443924/444469/437039/438294). Normalizasyon (nonce, `/_next/static`) fark üretmedi, fark yok. Dolu footer (Kolon A/B, yasal link) ile ölçüldü.

## 4. Taslak / yayın (`scripts/g0-draft.mjs`, ekran 03, 04)

Admin'de TR "Menü öğesi 01" etiketi `G0 Taslak` yapıldı, yayınlanmadan: autosave sonrası admin durumu "Değişiklik yapıldı", yeniden yüklemede "Taslak", alan değeri korunmuş; public `/tr` HTML'inde `G0 Taslak` **yok** (ana satır `published` kaldı). "Değişiklikleri yayınla" → durum "Yayınlandı", public HTML'de `G0 Taslak` **var** (dev'de; ISR yenileme G1'de `afterChange` ile test edilmeli).

Local API `updateGlobal` (`scripts/g0-update.ts`, ana satır `published` iken) matrisi:
- A `_status`/`draft` yok: `_status` mevcut değeri korur (`published`), içerik public'e yazılır (backfill sonrası mevcut davranış korunur).
- B `draft:true`: ana satır/public değişmez, yalnız sürüm.
- C `data._status:'published'`: yayın.
- D `data._status:'draft'` ama `draft:true` yok: **ana satır `draft` olur ve içerik yine public'te görünür** (public okuma `_status` süzmez).
- E ana satır `draft` iken `_status` verilmeden güncelleme: `draft` kalır, public'te görünür.
- Her güncelleme `_header_v` sürümü ekler (8 sürüm). Terra'nın "_status göndermeden ana satırı draft yapabilir" gözlemi yalnız ana satır zaten `draft` ise (backfill yoksa) geçerli; backfill sonrası `_status`'suz yazma yayında kalır.

## 5. Dialog top layer (390 px önizleme iframe'i; `scripts/g0-iframe.mjs`, `g0-esc.mjs`, ekran 05, 06)

- Menü düğmesi iframe'de `showModal()` açtı. Dialog içine eklenen katman (`position:fixed`, dialog çocuğu): `elementFromPoint` kendisi, **tıklanabilir** (click kaydı alındı).
- `popover="manual"` + `showPopover()` ile body'ye eklenen katman: görünür (ekran 05) ama **tıklanamaz** (modal arka planı inert); body'ye düz eklenen katman da tıklanamaz. Sonuç: köprü/seçim katmanı dialog çocuğu olmalı (portal hedefi dialog).
- Esc: yalnız `cancel` + `preventDefault`: Chromium kapatma koruması nedeniyle 3. ardışık Esc'te `cancel` `cancelable=false` olur ve dialog kapanır (log: `cancel(true) cancel(true) cancel(false) close`). Güvenilmez. **Çalışan yöntem:** `document` üzerinde yakalama (capture) `keydown` Escape: düzenleme/seçim varken `preventDefault()` → dialog 3 ardışık Esc'te de açık kaldı (aktivasyonla ya da aktivasyonsuz); düzenleme yokken Esc doğal `cancel`→`close`, `body` kilidi açılır, odak menü düğmesine döner, yeniden açma çalışır.

## 6. Mega menü sabitleme (`scripts/g0-mega.mjs`, ekran 07, 08)

`src/lib/header-nav.ts` prototip (8 satır): `open()`'da mevcut panel `data-canvas-pinned` ise başka tetikleyici açılmaz; `close(restoreFocus, force=false)` pinned iken no-op; cleanup `close(false, true)` zorlar. Tarayıcı (1440 px): işaretsiz davranış aynı (tıkla aç, dış tık/Esc kapatır). İşaretliyken: dış tık, Esc, diğer tetikleyiciye tık/hover, odak kayması, kendi tetikleyicisine tık **hepsinde açık kaldı**, panel görünür. İşaret kaldırılıp dış tık yapılınca kapandı. Not: pinned panel açıkken başka panele geçiş için editörün önce `data-canvas-pinned`'i taşıması (unpin+pin) gerekir.

## G1 migration tarifi (KESİN)

1. `Header` ve `Footer`: `versions: { drafts: { autosave: { interval: 2000 } }, max: 50 }` (autosave aralığı için ürünlerdeki `PRODUCTS_AUTOSAVE_INTERVAL` ile uyumlu seç). Yalnız bu iki global.
2. İki ayrı ya da tek migration (`pnpm migrate:create ...`), spike SQL'i referans. Header: yalnız CREATE/ALTER ADD. Footer: ek olarak `footer_columns_locales` rebuild (NOT NULL gevşemesi, INSERT…SELECT; veri korunur). İkisi de sonuna **backfill**: `UPDATE header SET _status='published'; UPDATE footer SET _status='published';` (`db.run(sql\`...\`)`, aynı transaction/migration içinde, ALTER'dan sonra).
3. `_header_v` / `_footer_v` için **INSERT gerekmez** (boş geçmiş yeterli; public ve admin ilk açılış doğrulandı). İlk admin yayını/autosave ilk sürümü oluşturur.
4. Down: yeni `_status` kolonu ve `_*_v*` tablolarını düşür; footer rebuild için down'da `title NOT NULL` geri alınırken boş başlık olursa hata verir → down'ı yalnız sürüm tabloları ve `_status` düşüren, NOT NULL'u geri almayan biçimde yaz (ya da kapsamı belgeleyip yedekten dön). Canlıdan önce yedek + dolu footer ile prova şart.
5. Kabul: öncesi/sonrası ham `<header>`/`<footer>` eşitliği (`scripts/g0-capture.mjs`+`g0-cmp.mjs`), hash eşitliği.
6. Importer/MCP kuralı: **global yazımlarında her zaman `data._status: 'published'` gönder** (importer `updateGlobal`, MCP `updateHeader/updateFooter` sözleşmesine ve test'e yaz). Backfill sonrası `_status` göndermemek de yayında kalır ama ana satır bir şekilde `draft` olursa içerik yine public görünür (D/E), bu yüzden açık gönderim kuralı. Taslak yazım yalnız `draft:true` (admin autosave bunu yapar). Ek güvence önerisi: global `beforeChange`'de `draft` seçeneği yokken (`req.query.draft !== 'true'` ve admin autosave dışı) gelen `_status:'draft'`'ı reddet/`published`'a çevir; test ile.

## Plan revizyonu maddeleri

1. G0 kabulü tamam: 1,2,3,4,6 evet; 5 kısmen (aşağıdaki iki kural ile kabul).
2. G4/G2 Esc sözleşmesi: dialog Esc yönetimi `cancel`'a değil, `document` capture `keydown` Escape'e dayansın (iki aşamalı Esc: önce seçim/düzenleme kapanır, sonra dialog).
3. G4 köprü/seçim katmanı dialog içine (çocuk/portal hedefi `dialog`) mount edilsin; `popover` ve body katmanı çalışmaz.
4. G1: `footer_columns_locales` rebuild notu ve dolu footer ile prova; backfill her iki global; INSERT yok.
5. G1: importer/MCP `_status:'published'` kuralı + test (D/E durumu: global ana satır `draft` ise de public görünür).
6. G2: mega menü pin sözleşmesi (`data-canvas-pinned`, yalnız editing render, unpin/cleanup `force`), başka panele geçiş = unpin+pin; normal public davranış değişmez.
7. G2: `iframeRef` ilk render'da null; efekt/poll ile okunmalı. `previewPath` sorgusu çalışır (yedek tercih gerekmez).
8. G2: `livePreview.breakpoints` header/footer için tanımlı olmalı (390/768/1440 ürünlerdeki gibi); drafts+autosave ile "taslak kaydet" düğmesi yok, tek yayın düğmesi.
