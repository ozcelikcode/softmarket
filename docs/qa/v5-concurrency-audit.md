# V5 P1 bağımsız güvenlik/kalite denetimi — 2026-11-10

Kapsam: `6509ec6..HEAD`, `feat/visual-editor`, Next 15.4.11 / Payload 3.93.0. Şema/migration, ana repo, canlı DB ve 3100 süreci değiştirilmedi. Bütün DB yazıları testlerin kendilerinin oluşturduğu geçici SQLite/uploads üzerinde.

## Bulgular ve düzeltmeler

P0 bulunmadı. Aşağıdaki P1/P2 bulguları düzeltildi ve odaklı regresyonlar eklendi:

- **P1 — Kuyruk erken serbest kalıyordu.** Payload session kaydını fiziksel commit/rollback tamamlanmadan siler; aynı ID için ikinci bitirme çağrısı hemen dönüp sonraki yazarı başlatabiliyordu. `db-serial-transactions.ts` aynı ID'nin bitirme promise'ini paylaşır; başarısız commit temizliği bitmeden sırayı açmaz. Commit/rollback yarışı, hata, 25 timeout, null BEGIN ve yeniden ilerleme testli.
- **P1 — Timestamp tek başına koşullu yazım kimliği değildi.** Aynı milisaniyede değişen içerik önceki sürümle aynı `updatedAt` alabilir. `concurrency.ts` ham tüm-dil snapshot'ının SHA-256 özetini kullanır; saat geriye alınsa da içerik farkını yakalar. Sanal alan ilk sırada, locale flatten/populate öncesinde hesaplanır. Yazma yanıtı aynı transaction içinde DB'den yeniden okunan snapshot token'ını döndürür. Eski timestamp istemcileri 409 alır.
- **P1 — Birleştirme uzak içeriği kaybedebiliyordu.** `layout` tek alan sayılıyor, yerel dizinin tamamı uzak dizinin üzerine yazılıyordu. `admin/merge.ts` nesneleri alan, blok/dizileri sabit satır ID'siyle birleştirir; ekleme/silme/sıralamayı korur. Aynı değer, Lexical, silme/düzenleme ve uyumsuz sıralama çakışmalarında form reset/kayıt yapılmaz. Başarılı merge eski undo geçmişini temizler.
- **P1 — Flush sonrasında birleştirme tabanı eski kalıyordu.** Token ilerlerken `savedData` eskiydi; önceden kaydedilmiş yerel değişiklikler yeniden uzak değişiklikleri ezebilirdi. `host.tsx` başarılı flush'ın gönderdiği değerleri yeni taban olarak saklar.
- **P2 — Sürüm geri yükleme yanlışlıkla 409 alıyordu.** Payload geçmiş snapshot'tan sanal alan üretir; bu değer istemci önkoşulu değildir. Açık restore sürümsüz yazım sözleşmesindedir. Yeniden kullanılan Local API req üzerinde restore bayrağının sonraki normal güncellemeye sızması ayrıca engellendi.
- **P2 — Gizli sekmede 409 bildirimi kayboluyordu.** Flush, yalnız görünür sekmede çalışan yoklamayı çağırıyordu. Artık 409 doğrudan bildirilir; geç tamamlanan yanıt başka locale/belgenin token'ını veya uyarısını değiştirmez. Tokensız flush gönderilmez; versiyonsuz başarı yanıtı kabul edilmez.
- **P2 — Boş/null token koşulu sessizce kapatıyordu.** Yalnız gerçekten gönderilmeyen alan koşulsuzdur; boş/null 400 alır. Payload'ın eksik sanal alanı eski belgeden doldurması ayrı izlenir; sürümsüz MCP/import davranışı korunur.
- **P3 (giderildi) — Anonim okumada editorVersion görünüyordu.** Alan okuması staff'a sınırlandı. Kopyala/birleştir yalnız koleksiyon şemasında tanımlı yazılabilir içerik köklerini alır; metadata, sanal/readOnly/join ve bilinmeyen alanlar dışarıda kalır. Populated ilişkiler ID'ye normalleştirilir.

## Doğrulama ve kapsam sınırları

- Odaklı: `visual-editor-db`, `db-serial-transactions`, `visual-editor-merge`, `visual-editor-sync`: **4 dosya, 36/36**.
- Geçici SQLite: TR/EN token eşitliği, depth/fallback bağımsızlığı, anonim token yokluğu, DB'de kolon bulunmaması, timestamp çakışması/saat geri alma, eski sürüm reddi, restore/duplicate/bulk, kurulu REST handler taslak/yayın, V2 editions zorunluluğu ve hero'nun başa normalleştirilmesi doğrulandı. Import/CLI transaction testleri tam pakete dahil.
- Yük: **30 paralel yazım + 30 anonim okuma, 0 hata, 1579 ms toplam, en yavaş okuma 190 ms** (son tam paket koşusu). Açık dış transaction içindeki Local API yazımı `req` ile çalıştı; dış anonim okuma 2 sn sınırının altında kaldı. Sonunda adapter session sayısı 0. Bu küçük yerel test üretim kapasite garantisi değildir.
- `pnpm typecheck`, `pnpm lint`, `git diff --check`: temiz.
- Son `pnpm test --maxWorkers=1`: **73 dosya; 1184 geçti / 2 başarısız / 1186 toplam**, 493,16 sn. İlgili editör/kuyruk regresyonlarının tamamı geçti. Kırmızılar: kullanıcı tarafından kapsam dışı bırakılan `content-import › rejects media outside` (bu ortamda önce `content/seed/media` ENOENT) ve `blocks-appearance-migration › reads legacy rows` 60 sn timeout. İkinci dosyanın aynı doğrulamaları yalnız geçici Vite test transform'uyla 120 sn sınırında **3/3 geçti**, 85,84 sn toplam; ilgili tek test 65,22 sn. Depodaki test sınırı/fixture değiştirilmedi. Bu süre bütçesi **P3** olarak raporlanır.
- Son kaynakta istemci/merge/kuyruk ayrı koşusu: **3 dosya / 20 test geçti**. DB dahil odaklı koşu 36/36; tam paket DB 16/16.
- **Ana dala kabul: HAYIR.** İlgili P0–P2 açık bulgu kalmadı; gerçek admin tarayıcı/merge E2E ve build doğrulaması eksik, standart tam paket kapısı yukarıdaki iki sebeple kırmızı.
- **Commit oluşmadı:** açık dosya listesiyle `git add` denemesi `/Users/ozcelik/dev/softmarket/.git/worktrees/softmarket-visual-editor/index.lock: Operation not permitted` verdi. Dosyalar stage edilmeden çalışma ağacında bırakıldı. `.env`, DB/uploads ve geçici test çıktıları listede yok.
- Kullanıcının belirttiği `/private/tmp/claude-501/-Users-ozcelik-dev-softmarket/86cb568c-5f6b-4b21-b0fe-e6a5de07c79f/scratchpad/softmarket-v5.db` bulunamadı. Alternatif kopya yolu soruldu. **3531 build/tarayıcı E2E çalıştırılmadı; sunucu başlatılmadı.** E2E'de eski timestamp beklentileri yeni token sözleşmesine güncellendi.

## Kalan P3 / işletim sözleşmeleri

- Koşullu yazım yetkilendirme sınırı değildir: token'ı tamamen çıkartan ayrıcalıklı API/Local API/MCP/import, toplu düzenleme ve açık restore kasıtlı koşulsuz yazımlardır. Belge formunun autosave/yayın/flush yolları token taşır; sunucu, her staff yazımında token zorunlu tutmaz.
- Kuyruk adapter/süreç içidir. Birden fazla Node sürecinde ortak mutex yoktur; SQLite kilidi ikinci yazarı `SQLITE_BUSY` ile reddedebilir. Tek VPS tek süreç varsayımı korunmalı. Çapraz süreç yük testi yapılmadı.
- İç içe Local API çağrıları mevcut `req` ile aynı transaction'ı paylaşır. `req` unutulursa iç BEGIN 5 sn sonra reddedilir. Manuel BEGIN sahibinin commit/rollback'i tamamen unutması otomatik olarak düzeltilmez; yazımlar timeout alır. Aktif bir transaction'ı kör zamanlayıcıyla geri almak uzun importları bozacağı için eklenmedi. Built-in işlem hata/409/doğrulama sonrası rollback ve sonraki yazım testli; gerçek süreç çökmesi/disk dolması simüle edilmedi.
- Snapshot token için tam belge gerekir; projeksiyonlu API okumalarındaki token editör önkoşulu olarak kullanılmamalıdır. Yoklama artık locale/fallback açık tam depth-0 draft okur; büyük belgelerde ek ağ/CPU maliyeti ayrıca ölçülmedi. Anonim okumalar hash hesaplamaz; normal public find/findByID kuyruk BEGIN'i açmaz.
- Gerçek admin DOM'u, GraphQL HTTP taşıması ve tarayıcı merge/reset etkileşimi bu koşuda doğrulanmadı. Snapshot'ın field-hook sırası Payload yükseltmesinde tekrar test edilmeli.

## Değişen dosyalar

`AGENTS.md`, `docs/editor-guide.md`, `docs/qa/v5-concurrency-audit.md`, `memory-bank/activeContext.md`, `memory-bank/progress.md`, `src/editor/canvas/{concurrency.ts,plugin.ts}`, `src/editor/canvas/admin/{host.tsx,sync.ts,merge.ts}`, `src/lib/{db-serial-transactions.ts,visual-editor-labels.ts}`, `src/payload-types.ts`, `tests/e2e/isolated/visual-editor.spec.ts`, `tests/unit/{db-serial-transactions,visual-editor-db,visual-editor-merge,visual-editor-sync}.test.ts`.
