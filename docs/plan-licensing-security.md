# Plan — Program ↔ Site Lisans API'si, Otomatik/Manuel İptal ve Güvenlik Merkezi

> Durum: **taslak plan (2026-11-17)**. Kod, şema veya migration değişmedi. Uygulama L0 spike'ıyla başlar; her faz sonunda kullanıcı onayı beklenir.
> Kaynaklar: `AGENTS.md`, `memory-bank/*`, `docs/plan-payments.md` (§2.4 lisans↔sipariş, §4 güvenlik, P4 fulfill, P6 iade→`revoked`, dispute→`suspended`), `docs/plan-visual-editor.md` (Kalıcı kurallar), `docs/plan-visual-globals.md` (G0–G7 sırası). Kod `main` 1a8969e üzerinden okundu: `src/collections/{Licenses,Customers,Downloads,Orders,PaymentEvents}.ts`, `src/lib/licenses/*`, `src/access/*`, `src/lib/secrets/crypto.ts`, `src/lib/integrations/vault.ts`, `src/lib/payments/{admin-endpoints,admin-actions,fulfill}.ts`, `src/lib/forms/security.ts`, `src/lib/request-guards.ts`, `src/middleware.ts`, `src/lib/db-serial-transactions.ts`, `deploy/*`, `scripts/deploy.sh`.
> Hosting ve alt alan adı fizibilitesi ayrı belgede: `docs/plan-hosting.md`.

## Kullanıcı isteği

1. "API ile de program ve site entegrasyonu yapılması gerek." Şirketin sattığı masaüstü/sunucu yazılımları sitedeki lisans sistemiyle konuşacak: aktivasyon, doğrulama (periyodik + çevrimdışı tolerans), deaktivasyon, koltuk sayımı, cihaz bağlama, güncelleme kontrolü, lisanslı indirme hakkı.
2. "Lisans iptali manuel ya da otomatik olarak yapılacak." Admin elle askıya alır, iptal eder, yeniden etkinleştirir. Otomatik: iade, chargeback (mevcut), süre bitişi, kural ihlali. Otomatik kararlar geri alınabilir ve denetim izlidir.
3. "İhlal bildirimi, IP ihlali ya da şüpheli hareketler gibi şeyler bir sayfada toplanacak." Admin'de Güvenlik merkezi: olaylar, önem, filtre, olay → lisans/müşteri, tek tıkla eylem, bildirim. KVKK uyumu.
4. "Bu kritik bir mesele olduğu için hem iyi plan hem de sağlam yapılmalı, güvenlik burada çok önemli."
5. "Sub domain entegrasyonu yapılabilir mi, VPS'siz standart serverda ama." → `docs/plan-hosting.md`.

## Kalıcı kurallar (her fazda geçerli; ihlal = faz reddi)

1. **Lisans durumu tek kaynaktan değişir.** Her durum geçişi (panel, MCP, ödeme, kural motoru, sweep) `src/lib/licensing/transitions.ts` içindeki `recordLicenseTransition()` ile **aynı transaction'da** `license-status-log` satırı yazar. Ham SQL ile durum değiştiren mevcut yollar (`admin-actions.ts` `refundOrder`, `applyDispute`) da bu fonksiyonu çağırır. Günlüksüz geçiş testle yakalanır.
2. **Otomatik sistem asla `revoked` yazmaz** (iade hariç: o, mevcut P6 iş kuralıdır ve ödeme kaynağıyla günlüklenir). Kural motoru en fazla `suspended` yazar; iptal admin onayı ister.
3. **Güvenlik koleksiyonları API'den yazılamaz.** `security-events`, `security-blocks`, `license-status-log`, `security-audit`, `license-activations`: `create/update/delete = nobody`; yazım yalnız sunucu kodunda `overrideAccess: true`. Okuma yalnız admin (editor değil). Hiçbiri MCP allowlist'ine girmez.
4. **Admin eylemleri yalnız panel oturumu ile.** `guardAdminSession` deseni (`src/lib/payments/admin-endpoints.ts`): admin rolü, `_strategy === 'local-jwt'`, `Authorization` başlığı yok, same-origin + `Sec-Fetch-Site`. API key/MCP/editor/customer 403. Her eylem `security-audit` satırı yazar; gerekçe zorunlu.
5. **Kişisel veri minimizasyonu.** Tam IP, ham cihaz parmak izi, lisans anahtarı, e-posta loglara ve olay `detail` alanına yazılmaz. IP yalnız kısaltılmış önek (IPv4 /24, IPv6 /48) + anahtarlı HMAC olarak saklanır. Lisans anahtarı loglarda `maskLicenseKey` ile.
6. **Sıcak yol SQLite'ı ezmez.** Doğrulama isteği en fazla bir küçük UPDATE yapar; olaylar bellekte toplanıp toplu yazılır; reddedilen (rate limit/engel) istek DB'ye satır başına yazmaz.
7. **Migration kuralları** (`plan-visual-editor.md` kural 6): önce DB kopyası; up yalnız `CREATE TABLE`, `ADD COLUMN`, `CREATE INDEX`, yeni kolona `UPDATE` backfill. `DROP`, `DELETE`, `__new_` yasak. Down yalnız kendi tablo/kolon/indeksini kaldırır, veri varsa reddeder (P4 deseni). Canlıdan önce WAL/SHM dahil yedek.
8. **Tek şema kulvarı.** `plan-visual-globals.md` G1 ile aynı anda `migrate:create` yapılmaz; biri ana dala alınmadan diğeri başlamaz.
9. 3100, canlı DB ve `.next` yalnız açık görevle; build `NEXT_DIST_DIR=.next-<ad>`, QA portları 3200/3300/3400, yük testi izole kopya DB üzerinde 3600.
10. Admin etiketleri `src/lib/admin-i18n.ts` sözlüğüne girer (`tests/unit/admin-labels.test.ts`). Kullanıcının sağlayacağı her ayar admin panelinden girilebilir; env tanımlıysa env kazanır (integrations deseni).

---

## 1. Karar özeti

### 1.1 Mimari

- **Aynı Next/Payload süreci, ayrı API ad alanı.** Rotalar `src/app/(payload)/api/v1/licensing/**/route.ts` (ödeme webhook'larıyla aynı desen: Node runtime, `dynamic='force-dynamic'`, Payload catch-all'dan önce eşleşir). Ayrı süreç yok: SQLite tek yazar ve `db-serial-transactions` süreç içidir; ikinci süreç bu garantiyi bozar.
- **Programlar için ayrı ana bilgisayar adı:** `lisans.<alan-adi>` (öneri). Caddy bu host'ta yalnız `/api/v1/licensing/*` yolunu aynı sürece geçirir, geri kalan 404. Çerez yok, CORS yok (masaüstü istemci tarayıcı değildir). Programa gömülen URL pazarlama sitesinden bağımsız kalır; ileride sunucu taşınırsa programlar etkilenmez. Ayrıntı `docs/plan-hosting.md`.
- **Kimlik doğrulama = lisans anahtarı (bir kez) + cihaz anahtar çifti (her istek).** Aktivasyonda program cihazda bir Ed25519 anahtar çifti üretir (özel anahtar OS anahtar deposunda: Windows DPAPI/CNG, macOS Keychain, Linux dosya 0600/TPM varsa). Sunucu açık anahtarı aktivasyona bağlar. Sonraki her istek bu anahtarla imzalanır; lisans anahtarı tekrar gönderilmez. Sızan lisans anahtarı mevcut cihazı taklit etmeye yetmez; yeni cihaz ancak koltuk harcayarak eklenir ve olay üretir.
- **Sunucu imzalı kira (lease) belgesi.** Başarılı aktivasyon/doğrulama, sunucunun Ed25519 anahtarıyla imzalı kısa ömürlü JWS döner. Program bunu gömülü açık anahtar(lar)la **çevrimdışı** doğrular. `refreshAfter` (varsayılan 24 saat) geçince yeniler; çevrimdışıysa `exp`'e (varsayılan 14 gün, ayarlanabilir üst sınır 30 gün) kadar çalışır.
- **Yanıt imzası + istek nonce bağlama.** Tüm API yanıtları (hata dahil) sunucu anahtarıyla imzalanır ve isteğin nonce'unu içerir. Kullanıcının kurduğu sahte kök sertifikayla TLS'i kıran MITM "geçerli" yanıt üretemez; eski yanıt tekrar oynatılamaz. TLS sertifika sabitleme yapılmaz (Let's Encrypt yenilemesi kırar); sabitlenen şey imza açık anahtarıdır.
- **Klon tespiti için dönen sayaç.** Her doğrulama yanıtı yeni bir `ctr` verir; program bir sonraki istekte onu geri yollar. Aynı aktivasyonu kopyalayan iki makine kısa sürede ayrışır → `activation.clone_suspected`.
- **Kural motoru kademeli:** gözlem (yalnız olay) → bildirim → askıya alma (otomatik, geri alınabilir) → iptal (yalnız admin onayıyla). Varsayılan ilk 30 gün **gözlem modu** (Açık soru 2).
- **Güvenlik merkezi** Payload admin custom view `/admin/guvenlik` (yalnız admin; nav linki yalnız admin'e görünür), veriyi admin-only GET uçlarından okur, eylemleri admin-only POST uçlarıyla yapar.

### 1.2 Gizli anahtarlar

| Sır | Konum | Not |
|---|---|---|
| Lisans imza özel anahtarı (Ed25519, PKCS8) | `integrations` vault deseninde yeni sır kimliği `licensing-signing-ed25519` (AES-256-GCM, `SOFTMARKET_SECRETS_KEY`, AAD `softmarket:integrations:licensing-signing-ed25519`); env `SOFTMARKET_LICENSE_SIGNING_KEY` tanımlıysa env kazanır | Panelde **asla okunamaz**; yalnız "Anahtar çifti üret / döndür" (iki adımlı onay, admin panel oturumu). Panel ele geçse bile özel anahtar dışarı çıkmaz; saldırgan yalnız döndürebilir (olay + e-posta). |
| Önceki açık anahtarlar | `licensing-settings.signingKeys[]` (kid, publicKey, createdAt, retiredAt) | Döndürmede eski kid 90 gün "yalnız doğrulama" kalır; programlar birden çok kid gömer. |
| HMAC biber (pepper) | `SOFTMARKET_SECRETS_KEY`'den HKDF: `info = "licensing/fp/v1"` (parmak izi), `"licensing/ip/<YYYY-MM>"` (IP, aylık döner), `"licensing/dl/v1"` (indirme bağlantısı) | Yeni env yok. IP hash anahtarı aylık döner: 1 aydan eski IP hash'leri birbirine bağlanamaz (takma adlaştırma güçlenir). |

`SOFTMARKET_SECRETS_KEY` kaybı = imza anahtarı ve biber kaybı → tüm cihazlar yeniden aktivasyon ister. Operasyon belgesine yedekleme prosedürü yazılır (L10).

### 1.3 Kapsam dışı (v1)

- Kayan (floating/eşzamanlı) koltuk; koltuk = aktif cihaz (Açık soru 3).
- Hava boşluklu (air-gapped) dosyayla aktivasyon (Açık soru 1; istenirse L11).
- Bakım/güncelleme hakkı süresi (`maintenanceUntil`); v1'de güncelleme hakkı = geçerli lisans.
- Admin 2FA (Açık soru 6; v1 önerisi Caddy/Cloudflare ile `/admin` IP kısıtı).
- İstemci kurcalamasının teknik olarak önlenmesi: sunucu yamalanmış programı engelleyemez (bkz. §2 kalıntı risk).

---

## 2. Tehdit modeli (STRIDE)

Varlıklar: lisans anahtarı, cihaz özel anahtarı, sunucu imza anahtarı, `SOFTMARKET_SECRETS_KEY`, admin oturumu/API anahtarı, müşteri kişisel verisi (IP, cihaz adı), SQLite yazma kapasitesi, gelir (korsanlık).

| # | Tehdit | STRIDE | Senaryo | Önlem | Kalıntı risk |
|---|---|---|---|---|---|
| T1 | Anahtar paylaşımı/korsanlık | S, E | Müşteri anahtarı forumda paylaşır | Koltuk sınırı (atomik sayım), her yeni cihaz olay; IP önek dağılımı, aktivasyon döngüsü, yeniden bağlama kuralları; otomatik askı; admin iptal; iptalde tüm aktivasyonlar `revoked` | Koltuk dolana dek ilk N cihaz çalışır; kira süresi (≤14 gün) boyunca çevrimdışı çalışma |
| T2 | Aktivasyon klonu | S | Aktive makinenin disk imajı çoğaltılır (cihaz anahtarı + parmak izi aynı) | Dönen sayaç `ctr` → ayrışma; aynı aktivasyondan eşzamanlı farklı IP önekleri; `clone_suspected` | Biri hep çevrimdışıysa tespit gecikir |
| T3 | İstemci kurcalama | T, E | Program yamalanır, kontrol atlanır; gömülü açık anahtar değiştirilir | Sunucu tarafı hak kontrolü: güncelleme ve lisanslı indirme yalnız geçerli imzalı istekle; program içi doğrulamayı dağıt/obfüske et (istemci kılavuzu) | **Engellenemez**; yalnız maliyet artırılır. Kabul edilmiş risk |
| T4 | Replay | S, T | Yakalanan `validate`/`deactivate` isteği tekrar gönderilir | İmzalı `SM-Timestamp` (±300 sn) + `SM-Nonce`; okuma uçlarında bellek içi nonce önbelleği (TTL 600 sn); durum değiştiren uçlarda nonce DB'de tekil (`license-activations` ilgili satırı / `security-audit.nonce`); yanıt imzası istek nonce'unu içerir | Süreç yeniden başlarsa okuma nonce önbelleği boşalır; okuma ucunun tekrarı yalnız aynı cihaza bağlı yeni kira üretir (zararsız) |
| T5 | MITM | I, T | Kurumsal proxy veya kullanıcı kök sertifikasıyla TLS kırılır, "geçerli" yanıt enjekte edilir | Yanıt imzası (Ed25519, gömülü kid listesi), nonce bağlama; HSTS mevcut | Program açık anahtarı değiştirilirse T3'e döner |
| T6 | API anahtarı sızıntısı | I, E | Programa gömülü paylaşılan "vendor API key" | **Paylaşılan istemci sırrı yok.** Kimlik cihaz anahtarı + lisans anahtarı. Admin MCP anahtarı sızarsa: MCP `licenses.status` değiştiremez (yeni field access reddi), yeni koleksiyonlar MCP'de yok; MCP ile lisans oluşturma `license.created_via_mcp` bilgi olayı | MCP ile lisans oluşturma açık kalır (mevcut iş akışı) |
| T7 | Brute force | S | Rastgele anahtar denemesi | Anahtar 122,7 bit; IP önek başına geçersiz anahtar sayacı → süreli otomatik IP engeli (1 sa → 24 sa, kademeli); yanıt ayrımı yok (`invalid_license` tek kod) | Dağıtık botnet engeli aşar ama entropi pratikte imkânsız kılar |
| T8 | DoS / SQLite yazma kilidi | D | Yoğun istek yazma kuyruğunu doldurur (`write queue timeout` 5 sn) | Uygulama içi token bucket (IP önek, lisans, aktivasyon, küresel); gövde ≤ 8 KB; imza doğrulaması DB'den önce; validate günde ~1 UPDATE/cihaz; olay tamponu 10 sn toplu yazım, 500 anahtar üstünde düşür + sayaç; engel listesi bellekte; isteğe bağlı Cloudflare WAF kuralı | Hacimsel L3/L4 saldırı uygulama dışında (Cloudflare/VPS sağlayıcısı) |
| T9 | Admin hesabının ele geçirilmesi | E | Parola avı, oturum çalma → toplu iptal veya imza anahtarı döndürme | `maxLoginAttempts` 5 (mevcut); yeni IP öneğinden admin girişi olay + e-posta; anahtar döndürme ve toplu eylemler iki adımlı onay + e-posta; özel anahtar okunamaz; `/admin` IP kısıtı önerisi; denetim izi | 2FA yok (Açık soru 6) |
| T10 | Yanlış pozitif → meşru müşteri kilitlenir | D | Şirket VPN'i/NAT yüzünden IP dağılımı kuralı tetiklenir | Gözlem modu; askıda bile mevcut kira `exp`'e kadar çalışır; askı e-postası destek bağlantısıyla; tek tık geri alma (önceki durumu günlükten geri yükler) + kural için 30 gün bastırma; küresel devre kesici (saatte en çok N otomatik askı, aşılırsa kural motoru gözleme düşer + kritik olay) | Kurallar bilinçli olarak gevşek varsayılanla gelir |
| T11 | KVKK ihlali | I | IP/cihaz verisinin aşırı saklanması, yurt dışı aktarım | Minimizasyon (§6), saklama süreleri + temizlik işi, aydınlatma metni + EULA güncellemesi, MCP'de yok (LLM sağlayıcısına aktarım yok), loglarda PII yok | Hukukçu onayı gerekir (P7 `legalReview` deseni) |
| T12 | Sunucu imza anahtarı sızıntısı | S, E | Sunucu ele geçer, saldırgan sınırsız geçerli kira üretir | Vault şifreli; env alternatifi 0600; döndürme + eski kid'i **iptal listesi**ne alma (`/keys` yanıtında `revokedKids`); program güncellemesiyle yeni kid | Döndürme sonrası çevrimdışı programlar eski kirayı `exp`'e kadar kabul eder |
| T13 | Bilgi sızdırma (enumerasyon) | I | Hata kodlarından anahtarın varlığı/müşteri çıkarılır | Anahtar yok / ürün uyuşmuyor / müşteri doğrulanmamış = aynı `invalid_license` 401; durum ayrıntısı (`license_suspended` vb.) yalnız anahtarın sahipliği kanıtlandıktan sonra; yanıtlarda müşteri adı/e-posta yok | — |
| T14 | Portal üzerinden koltuk takası kötüye kullanımı | E | Müşteri her gün cihazı deaktive edip başka makineye aktarır (dönen lisans) | Self-servis deaktivasyon kotası (varsayılan 30 günde 3, ayarlanabilir) + `activation.churn` kuralı | — |
| T15 | Lisanslı indirme bağlantısı paylaşımı | I | İmzalı URL forumda paylaşılır | TTL 5 dk, aktivasyona ve indirme kimliğine bağlı HMAC, IP öneği kayıtlı, aynı belirteçle en çok 5 kullanım (Range devamı için), olay | TTL içinde paylaşım |

---

## 3. API sözleşmesi (`/api/v1/licensing`)

### 3.1 Genel

- Taban: `https://lisans.<alan-adi>/api/v1/licensing` (ana alan adından da aynı yol çalışır; programlar alt alan adını kullanır).
- Yalnız `POST` (uçlar arası tek tip imzalama) ve `GET /keys`. `Content-Type: application/json`, gövde ≤ 8 KB (`req.text()` ile sınırlı okuma, sonra zod strict parse; bilinmeyen alan 400).
- Tüm yanıtlar: `Cache-Control: no-store`, `X-Robots-Tag: noindex`, `Date`, `SM-Key-Id`, `SM-Response-Signature`. CORS başlığı yok.
- Zaman: Unix saniye. Saat kayması ±300 sn (ayarlanabilir 60–900). Kayma hatasında yanıt `serverTime` içerir; program saatini değil, isteğin zamanını düzeltip tekrar dener.
- Sürümleme: kırıcı değişiklik `/api/v2`; v1 en az 24 ay desteklenir. Yanıtlara alan eklemek kırıcı değildir (program bilinmeyen alanı yok sayar).

### 3.2 İstek imzası (cihaz anahtarı)

Başlıklar: `SM-Activation` (`act_…`; aktivasyonda `-`), `SM-Timestamp`, `SM-Nonce` (16 bayt rastgele, base64url), `SM-Signature` (Ed25519, 64 bayt, base64url).

Kanonik dize (UTF-8, `\n` ayraç, sonda `\n` yok):

```
SM1-REQ
<METHOD>
<path, sorgu dizesi olmadan, ör. /api/v1/licensing/validate>
<SM-Timestamp>
<SM-Nonce>
<SM-Activation>
<lowercase hex SHA-256(ham gövde baytları)>
```

`/activate`'te imza gövdedeki `devicePublicKey` ile doğrulanır (sahiplik kanıtı); diğer uçlarda aktivasyona kayıtlı açık anahtarla. Sunucu doğrulama sırası: boyut → başlık biçimi → saat → engel listesi (bellek) → rate limit (bellek) → imza → nonce → DB.

### 3.3 Yanıt imzası

`SM-Response-Signature` = Ed25519(sunucu, kanonik):

```
SM1-RES
<HTTP status>
<istekteki SM-Nonce; yoksa ->
<lowercase hex SHA-256(yanıt gövdesi)>
```

Program: `SM-Key-Id` gömülü kid listesinde olmalı ve `revokedKids` içinde olmamalı; nonce kendi gönderdiğiyle aynı olmalı; aksi halde yanıt yok sayılır (ağ hatası gibi davranılır).

### 3.4 Kira belgesi (lease, JWS compact)

Başlık `{ "alg": "EdDSA", "kid": "<kid>", "typ": "sm-lease+jwt" }`. Yük:

| Alan | Anlam |
|---|---|
| `iss` | `https://lisans.<alan-adi>` |
| `aud` | ürünün `licensingCode` değeri (ör. `studio-pro`) |
| `sub` | `act_<activationPublicId>` |
| `lid` | `lic_<licensePublicId>` (sıralı DB id'si açığa çıkmaz) |
| `sku`, `seats` | sürüm SKU'su, lisans koltuk sınırı |
| `fp` | programın gönderdiği parmak izi değeri (programın kendi hesapladığı hash) |
| `dkt` | cihaz açık anahtarının SHA-256 parmak izi (base64url) |
| `iat`, `nbf`, `exp` | `exp` = `iat + leaseDays` (çevrimdışı tolerans sonu); lisans `expiresAt` daha erkense `exp` ona kırpılır |
| `rfa` | `refreshAfter` = `iat + refreshHours` |
| `lexp` | lisans bitişi (ISO) veya `null` (süresiz) |
| `ctr` | dönen sayaç (programın bir sonraki istekte geri yollayacağı) |
| `st` | `active` (yalnız geçerli lisansa kira verilir) |
| `v` | `1` |

### 3.5 Uçlar

| Uç | Gövde (zod strict) | Başarı | Notlar |
|---|---|---|---|
| `GET /keys` | — | `{ keys: [{kid, alg:"EdDSA", x}], revokedKids: [] }` | Herkese açık, `Cache-Control: public, max-age=3600`; programın kid listesini güncellemesi için değil, teşhis içindir (güven gömülü listeden gelir). |
| `POST /activate` | `licenseKey`, `productCode`, `fingerprint` (base64url 32 bayt), `devicePublicKey` (base64url 32 bayt), `deviceLabel?` (≤64, kontrol karakteri yok), `platform` (`windows|macos|linux|other`), `arch?`, `appVersion` (semver ≤32) | 200 `{ activationId, lease, refreshAfter, serverTime }` | Tek transaction: lisans bul (normalize anahtar), ürün eşleşmesi, `isLicenseValid`, engel kontrolü, **aynı (lisans, fpHash) aktifse**: aynı açık anahtar → idempotent aynı aktivasyon; farklı açık anahtar → yeniden bağlama (eski satır `deactivated/rebind`, koltuk harcanmaz, kota: 30 günde 3); değilse koltuk sayımı `count(active) < maxDevices ?? seats` → yeni satır. Koltuk doluysa 409 `seat_limit` + `{ used, max }` ve olay. |
| `POST /validate` | `ctr`, `fingerprint`, `appVersion` | 200 `{ lease, refreshAfter, serverTime }` | Aktivasyon `active` + lisans geçerli + fp eşleşir → yeni kira; `lastSeenAt`/IP/`ctr` UPDATE yalnız son yazımdan ≥ `seenWriteMinutes` (varsayılan 60) geçtiyse **veya** `ctr` değiştiyse (her başarılı validate yeni `ctr` üretir → pratikte 1 UPDATE/istek, istekler günde ~1/cihaz). `ctr` = mevcut veya bir önceki → kabul; daha eski → kabul ama `clone_suspected` olayı (düşük; tekrarlarsa yüksek). |
| `POST /deactivate` | `reason?` (`user|uninstall|transfer`) | 200 `{ deactivated: true }` | Koltuğu boşaltır; aynı nonce ikinci kez 200 ve aynı sonuç (idempotent). |
| `POST /updates` | `channel` (`stable|beta|lts`), `currentVersion`, `os`, `arch?` | 200 `{ latest: { version, releaseDate, channel, notesUrl, mandatory:false, downloads:[{id, os, arch, size, sha256?}] } \| null }` | `releases` ürün + kanal, `releaseDate ≤ now`, semver büyük olan. `downloads` yalnız bu ürünün `access` public veya licensed kayıtları (licensed için geçerli lisans zaten kanıtlı). |
| `POST /downloads/link` | `downloadId` | 200 `{ url, expiresAt }` | `url` = `/api/v1/licensing/dl/<token>`; token = `base64url(payload).base64url(HMAC)`; payload `{ d: downloadId, a: activationId, e: exp(+300 sn), n: rastgele }`. |
| `GET /dl/<token>` | — | 200/206 dosya akışı | HMAC + exp + aktivasyon hâlâ aktif + indirme ürünü = lisans ürünü; `media` dosyasını güvenli yol çözümüyle (yalnız `UPLOADS_DIR` içi, symlink yok) akıtır, `Range` destekli, `Content-Disposition: attachment`, `Cache-Control: private, no-store`. Token başına en çok 5 kullanım (bellek sayacı). Bu uç imzasızdır (indirme yöneticileri başlık ekleyemez); güvenliği belirtecin kendisidir. |

### 3.6 Hata sözleşmesi

Gövde: `{ "error": { "code": "<kod>", "retryAfter"?: <sn> }, "serverTime": <unix> }`. Mesaj metni yok; program yerelleştirilmiş metni kendi gösterir.

| HTTP | Kod | Ne zaman | Bilgi sızıntısı kuralı |
|---|---|---|---|
| 400 | `bad_request` | Biçim/şema/boyut | Hangi alanın hatalı olduğu söylenmez |
| 400 | `clock_skew` | Saat penceresi dışı | `serverTime` döner |
| 401 | `invalid_signature` | İmza/nonce/aktivasyon bulunamadı | Aktivasyonun varlığı ayırt edilmez |
| 401 | `invalid_license` | Anahtar yok, ürün uyuşmuyor | Tek kod |
| 403 | `license_suspended` / `license_revoked` / `license_expired` / `license_not_started` | Anahtar sahipliği kanıtlı | — |
| 403 | `activation_revoked` | Admin/müşteri bu cihazı kaldırdı | — |
| 403 | `blocked` | Engel listesi | Neyin engellendiği söylenmez |
| 409 | `seat_limit` | Koltuk dolu | `used`/`max` döner (sahibine faydalı) |
| 409 | `rebind_limit` | Yeniden bağlama kotası doldu | — |
| 429 | `rate_limited` | Limit | `Retry-After` |
| 503 | `unavailable` | API kapalı (`licensing-settings.apiEnabled=false`) veya imza anahtarı yok | Program çevrimdışı tolerans moduna geçer |
| 500 | `internal` | — | Ayrıntı yok |

Kural: imzası doğrulanamayan her yanıt dahil, program **hiçbir hatayı "lisans geçersiz" diye kalıcılaştırmaz**; yalnız imzalı 403 `license_*`/`activation_revoked` yerel kirayı siler.

### 3.7 Rate limit (varsayılanlar `licensing-settings`'ten)

| Anahtar | Uç | Varsayılan | Aşımda |
|---|---|---|---|
| IP öneki | tüm uçlar | 60/dk | 429 + aggregate olay `api.rate_limited` |
| IP öneki | `invalid_license` | 10/saat | otomatik süreli IP öneki engeli 1 sa; 24 sa içinde tekrarında 24 sa (`security-blocks`, kaynak `rule`) |
| Lisans | `activate` | 10/gün | 429 + `activation.burst` |
| Aktivasyon | `validate`/`updates`/`downloads/link` | 30/saat | 429 |
| Aktivasyon | `invalid_signature` | 5/saat | olay `api.bad_signature` (yüksek) |
| Küresel | tüm | 200/sn | 503 + kritik olay (süreç koruması) |

Uygulama: `src/lib/licensing/rate-limit.ts`, `createRateLimiter` deseninin token-bucket sürümü (bounded Map, `globalThis` tekil). IP kaynağı `requestIP()` (Caddy doğrulamalı başlık); `unknown` ise tüm istekler ortak kovaya düşer (fail-closed, mevcut kural). Bellek içi olduğu için **tek süreç varsayımı** zorunlu (bkz. `docs/plan-hosting.md`).

### 3.8 Örnek istemci akışı

```
Kurulum/ilk açılış:
  1. Cihazda Ed25519 çifti üret, OS deposuna koy.
  2. fp = base64url(SHA-256("sm-fp-v1|" + productCode + "|" + kararlı donanım kimlikleri)) — ham seri no gönderilmez.
  3. POST /activate (imzalı). 200 → kira + activationId'yi güvenli sakla.
Her açılışta (çevrimdışı):
  4. Kira imzası (gömülü kid), aud == productCode, fp == yerel fp, dkt == yerel açık anahtar, now < exp.
  5. Geçerliyse çalış; now > rfa ise arka planda 6.
Arka plan:
  6. POST /validate { ctr } → yeni kira. Ağ yok/503/imzasız yanıt → eski kirayla devam, üstel bekleme.
  7. İmzalı 403 license_* → kirayı sil, lisans ekranına dön.
Kaldırma:
  8. POST /deactivate; başarısızsa kullanıcıya "portaldan cihazı kaldırın" de.
```

`curl` ve imza üretimi örneği, doğrulama algoritmasının adım adım tanımı ve **test vektörleri** (sabit anahtar çifti, sabit nonce/zaman → beklenen imza) L9'da `docs/licensing/client-integration.md` içine yazılır; referans doğrulayıcı TypeScript (Node `crypto`) + C# (.NET `System.Security.Cryptography` Ed25519 yoksa NSec/BouncyCastle notu) örnekleri.

---

## 4. Veri modeli

Tümü `group: 'Güvenlik'` (admin-i18n'de TR/EN), `admin.hidden` yalnız editor'a (custom view kullanılır, liste görünümleri admin'e açık kalır).

### 4.1 `licenses` eklemeleri (ADD COLUMN)

| Alan | Tür | Not |
|---|---|---|
| `publicId` | text, unique, readOnly | Backfill uses 12 random bytes in hex and retries collisions before creating the unique index. `prepareLicense` generates IDs for new licenses. |
| `maxDevices` | number, min 1 | Boş = `seats` |
| `statusReason` | select (`manual`, `payment_refund`, `payment_dispute`, `rule_*`, `expiry`, `restore`) | Son geçişin nedeni (günlüğün özeti) |
| `statusChangedAt` | date | |
| `statusSource` | select (`admin`, `mcp`, `payment`, `rule`, `system`, `import`) | |
| `activations` | join → `license-activations.license` | Şema kolonu yok |

`status` alanı: MCP (`_strategy === 'api-key'`) yazamaz (field access; mevcut commerce deseni). Panelde alan kalır ama doğrudan değişiklik `beforeChange` kancasında yakalanır, gerekçe alanı (`statusNote`, sanal/virtual değil — `ui` + kanca `req.context`) yoksa "Lisans işlemleri" panelini kullanın uyarısıyla 400. Önerilen yol yan paneldeki eylem düğmeleri.

### 4.2 `products` eklemeleri

| Alan | Tür | Not |
|---|---|---|
| `licensing.enabled` | checkbox, varsayılan false | API yalnız açık ürünlerde |
| `licensing.code` | text, unique, `^[a-z0-9][a-z0-9-]{2,40}$` | Kiradaki `aud`; bir kez ayarlanınca değiştirilemez (kanca) — programlara gömülür |

### 4.3 `license-activations` (yeni)

| Alan | Tür | Not |
|---|---|---|
| `publicId` | text unique | `act_` öneki API'de |
| `license` | rel licenses, index | |
| `customer`, `product` | rel, index | Denormalize (sorgu ve portal) |
| `status` | select `active|deactivated|revoked`, index | |
| `endReason` | select `user|admin|customer_portal|rebind|license_revoked|rule` | |
| `devicePublicKey` | text (base64url 32 B) | |
| `deviceKeyThumbprint` | text, index | |
| `fingerprintHash` | text (HMAC-SHA256 hex), index | Ham fp saklanmaz |
| `deviceLabel` | text ≤64 | Müşteri portalda yeniden adlandırabilir; boşsa "Cihaz 1" |
| `platform`, `arch`, `appVersion` | select/text | |
| `counter` | text (16 B base64url) | Son verilen `ctr`; önceki değer `prevCounter` |
| `activatedAt`, `lastSeenAt`, `endedAt` | date | |
| `lastIpPrefix` | text | `203.0.113.0/24`; 90 gün sonra/sonlanmadan 90 gün sonra NULL |
| `lastIpHash` | text | Aylık anahtar; aynı temizlik |
| `lastCountry` | text(2) | Yalnız ülke kaynağı açıksa (Açık soru 4) |
| `endNonce` | text | Deaktivasyon idempotency |

Migration'da ek SQL (CREATE INDEX, kural 7'ye uygun): `CREATE UNIQUE INDEX license_activations_one_active_fp ON license_activations(license_id, fingerprint_hash) WHERE status = 'active'` ve `… _thumb ON (device_key_thumbprint) WHERE status='active'`. Koltuk sayımı yine serial transaction içinde; indeks son savunma hattı.

### 4.4 `security-events` (yeni, append-only + sunucu tarafı triage)

| Alan | Tür | Not |
|---|---|---|
| `type` | select (§5.1 kataloğu), index | |
| `severity` | select `info|low|medium|high|critical`, index | |
| `source` | select `api|portal|admin|webhook|system|rule` | |
| `firstSeenAt`, `lastSeenAt` | date, index | |
| `count` | number | Toplama: aynı `dedupeKey` |
| `dedupeKey` | text unique | `type|subject|zaman kovası (ör. 1 sa)` |
| `license`, `customer`, `activation`, `order`, `actorUser` | rel, index | Olay → ilgili kayıt bağlantısı |
| `ipPrefix`, `ipHash`, `country` | text | 30 gün sonra NULL |
| `detail` | json | Zod şemalı, olay türüne göre allowlist anahtarlar; PII yok |
| `ruleKey` | text | Tetikleyen kural |
| `actionTaken` | select `none|notified|throttled|blocked|suspended` | Otomatik eylem |
| `triage` | select `open|acknowledged|resolved|false_positive`, index | Yalnız admin uçları değiştirir |
| `triagedBy`, `triagedAt`, `triageNote` | | Her değişiklik `security-audit`'e de yazılır |
| `notifyState`, `notifyAttempts`, `notifyNextAt`, `notifyLastError` | | Kalıcı bildirim kuyruğu (P4 `orders.notifications` lease deseni) |

Erişim: read admin; create/update/delete nobody. Panel liste görünümü salt okunur (PaymentEvents `readOnly` deseni).

### 4.5 `security-blocks` (engel listesi)

`kind` (`ip_prefix|cidr|activation|license|fingerprint`), `value` (önek/CIDR metni ya da kayıt id/hash; IP için yalnız önek, tam IP yok), `scope` (`api|portal|all`), `active` (index), `expiresAt` (boş = süresiz, yalnız admin), `source` (`admin|rule`), `reason`, `event` (rel), `createdBy`, `liftedAt`, `liftedBy`, `liftReason`. Bellek önbelleği 30 sn + süreç içi yazımda anında. Admin kendi IP'sini içeren CIDR engelini iki adımlı onayla ekleyebilir (uyarı). Erişim: read admin; yazım yalnız uçlar.

### 4.6 `license-status-log` (durum geçiş günlüğü)

`license` (index), `from`, `to`, `reason` (statusReason değerleri), `source` (`admin|mcp|payment|rule|system|import|customer`), `actorUser`, `order`, `event`, `ruleKey`, `note` (≤500, PII uyarısı), `at` (index), `revertOf` (rel kendisi; geri alma hangi geçişi geri aldı), `revertible` (bool). Append-only; update/delete nobody. Saklama: lisans ömrü + 10 yıl (ticari kayıt; IP içermez).

### 4.7 `security-audit` (admin ve sistem eylemleri)

`action` (`license.suspend|revoke|reactivate|restore`, `activation.deactivate`, `block.add|lift`, `event.triage`, `settings.update`, `signing_key.rotate`, `bulk.*`), `actorUser`, `actorKind` (`admin|system|rule`), `target` (polymorphic rel: licenses, license-activations, security-blocks, security-events), `reason`, `note`, `at`, `ipPrefix` (admin), `result` (`ok|denied|error`). Saklama 2 yıl.

### 4.8 `licensing-settings` (yeni global, versiyonsuz, yalnız admin, MCP yok)

Sekmeler: **Genel** (`apiEnabled`, `publicHost` (ör. `lisans.alanadi.com`), `refreshHours` 24, `leaseDays` 14 (≤30), `clockSkewSeconds` 300, `seenWriteMinutes` 60), **Limitler** (§3.7 tablosu), **Kurallar** (her kural: `mode` `off|observe|notify|suspend`, eşikler, pencere, bastırma günü; `observeUntil` tarihi; devre kesici `maxAutoSuspendsPerHour` 5), **Self-servis** (portal deaktivasyon kotası, yeniden bağlama kotası), **Bildirim** (`alertEmails[]`, `minSeverityImmediate` `high`, `dailyDigest` bool + saat, müşteriye askı e-postası bool), **Saklama** (§6 süreleri, alt sınırlar kod sabiti), **İmza anahtarları** (`signingKeys[]` salt okunur + "üret/döndür" düğmesi → uç), **Ülke kaynağı** (`none|cloudflare_header`; Açık soru 4). Değişiklikler `security-audit` `settings.update` (eski/yeni değer özeti).

### 4.9 Migration planı

Tek migration `licensing_core` (L1): 5 CREATE TABLE (+ Payload ilişki/locale tabloları), `licenses` 5 ADD COLUMN + backfill, `products` 2 ADD COLUMN, global tablo, 2 kısmi UNIQUE INDEX. Down: veri varsa (`license_activations`/`security_events` satırı) reddeder; yoksa yalnız kendi nesnelerini kaldırır. Kopya DB → `pnpm migrate` → `content:import --dry-run` → `starter-template-db` → integrity/FK → migration up/down/up testi.

---

## 5. Olaylar, kural motoru, otomatik/manuel iptal

### 5.1 Olay kataloğu (`src/lib/licensing/events/catalog.ts`, tek kaynak)

| Tür | Varsayılan önem | Kaynak |
|---|---|---|
| `activation.created` / `activation.rebind` / `activation.ended` | info | api/portal/admin |
| `activation.seat_limit` | low | api |
| `activation.burst` (lisans başına kısa sürede çok aktivasyon) | medium | rule |
| `activation.churn` (aktivasyon/deaktivasyon döngüsü) | medium | rule |
| `activation.clone_suspected` | low → high (tekrar) | api/rule |
| `license.ip_spread` (24 sa'te farklı IP öneki > N) | medium | rule |
| `license.geo_spread` / `license.impossible_travel` | medium/high | rule (ülke kaynağı açıksa) |
| `license.status_changed` | info (iptal: medium) | tüm |
| `license.expired` (bir kez) | info | sweep |
| `license.created_via_mcp` | info | admin |
| `api.invalid_license` (aggregate) | low → high (eşik) | api |
| `api.bad_signature` / `api.replay` / `api.clock_skew` (aggregate) | medium/high/info | api |
| `api.rate_limited` (aggregate) | low | api |
| `api.blocked_request` (aggregate) | info | api |
| `auth.admin_login_failed` / `auth.admin_locked` / `auth.admin_new_network` | medium/high/high | admin |
| `auth.portal_login_failed` (aggregate) / `auth.portal_locked` | low/medium | portal |
| `webhook.bad_signature` (mevcut `payment-events` reddi) | high | webhook |
| `system.rule_circuit_open` / `system.signing_key_rotated` / `system.events_dropped` | critical/high/high | system |

### 5.2 Olay yazıcı

`src/lib/licensing/events/writer.ts`: `emit(event)` senkron, belleğe koyar; 10 sn'de bir (ve 200 kayıtta) tek transaction'da `INSERT … ON CONFLICT(dedupe_key) DO UPDATE SET count = count + excluded.count, last_seen_at = …`. Tampon 500 farklı anahtarı aşarsa yeni anahtarlar düşer, `system.events_dropped` sayacı artar. `high`/`critical` olaylar ayrıca hemen yazılır (bildirim gecikmesin). Süreç kapanışında (SIGTERM) son flush. Kural motoru girdi olarak bu tablonun yanında `license-activations`'ı okur.

### 5.3 Kural motoru

- Senkron kurallar (istekte): koltuk sınırı (reddet, askı değil), rebind kotası, engel listesi, rate limit.
- Asenkron kurallar (`pnpm licensing:sweep`, 5 dk timer): `ip_spread`, `geo_spread`, `impossible_travel`, `activation.burst`, `activation.churn`, `clone_suspected` tekrarı, `invalid_license` → IP engeli, süre bitişi günlüğü, saklama temizliği, bildirim kuyruğu.
- Kural sonucu → `mode`'a göre: `observe` (yalnız olay), `notify` (olay + admin e-postası), `suspend` (olay + otomatik askı + admin ve müşteri e-postası). `suspend` koşulları: lisans `active`, son 30 gün içinde aynı kural için bastırma yok, ödeme kaynaklı askı yok, küresel devre kesici kapalı, `observeUntil` geçmiş.
- **Otomatik askı = API'de yeni kira yok + yeni aktivasyon yok**; mevcut kiralar `exp`'e kadar çalışır, portal ve lisanslı web indirmesi kapanır (mevcut `validLicenseWhere` zaten `active` ister).
- **Geri alma (Restore):** olay veya lisans panelinde "Yanlış alarm — geri al": son `license-status-log` satırı bu kuralın askısıysa, `from` değerine geri döner (`reason: restore`, `revertOf`), olay `false_positive`, kural + lisans için 30 gün bastırma, müşteriye "yeniden etkin" e-postası. Arada başka bir geçiş (ödeme, admin) olduysa geri alma reddedilir (409) ve admin manuel işlem yapar.
- **İptal:** yalnız admin, gerekçe zorunlu, iki adımlı onay; tüm aktif aktivasyonlar `revoked` (`endReason: license_revoked`).
- **Süre bitişi:** durum yazılmaz (tarih tek gerçek; `isLicenseValid` zaten bitişi uygular). Sweep bir kez `license.expired` olayı (dedupe: lisans + `expiresAt`) + müşteriye bilgi e-postası (isteğe bağlı) üretir; durum değişmediği için `license-status-log` satırı yazılmaz. Kiradaki `exp` zaten lisans bitişine kırpılır. Yenileme admin `expiresAt` uzatmasıyla otomatik geri döner.
- **Ödeme entegrasyonu:** `refundOrder` ve `applyDispute` ham SQL'inden sonra aynı `tx` içinde `recordLicenseTransitions(tx, ids, …, source:'payment', order)` + etkilenen aktivasyonlar (`refund` → `revoked`; dispute → değişmez, askı API'de etkili). İtiraz kazanılırsa admin "Askıyı kaldır" (`restore`) kullanır; Stripe `charge.dispute.closed` otomasyonu ayrı iş (L5'te değerlendirilir, P6 kodu sahibine danışılır).

### 5.4 Admin eylem uçları (hepsi `guardAdminSession` + gövde `{ reason, note?, confirm? }` ≤ 2 KB)

`POST /api/licenses/:id/{suspend,revoke,reactivate,restore}`, `POST /api/license-activations/:id/deactivate`, `POST /api/security-events/:id/{acknowledge,resolve,false-positive}` (`false-positive` isteğe bağlı `restore: true`), `POST /api/security-events/:id/block` (olaydaki IP öneği/aktivasyon/lisans için süreli engel), `POST /api/security-blocks` + `/:id/lift`, `POST /api/globals/licensing-settings/rotate-signing-key` (`confirm` = "DÖNDÜR" metni), `GET /api/security/summary|events|blocks|audit|risky-licenses` (admin, panel oturumu, sayfalı, `no-store`). Toplu eylem v1'de yok (tek tek; risk azaltımı).

---

## 6. KVKK, gözlemlenebilirlik, saklama

- **Toplanan veri:** cihaz etiketi (müşteri kontrolünde), platform/sürüm, parmak izi HMAC'i, cihaz açık anahtarı, IP öneği + aylık anahtarlı IP HMAC'i, (opsiyonel) ülke kodu, zaman damgaları. Ham donanım kimliği, MAC, kullanıcı adı, tam IP **toplanmaz/saklanmaz**.
- **Hukuki dayanak (taslak, hukukçu onayına):** sözleşmenin ifası (lisans doğrulama) + meşru menfaat (dolandırıcılık/korsanlık önleme). Aydınlatma metni (`content/legal/{tr,en}/kvkk.md`, `gizlilik.md`) ve EULA'ya "aktivasyon ve doğrulama verileri" bölümü; P7 `legalReview` onayı. VERBİS kaydı güncellemesi kullanıcıya hatırlatılır.
- **Saklama (varsayılan, admin artırabilir/azaltabilir; kod alt sınırı parantezde):**
  - `security-events` ham IP alanları 30 gün (7) → NULL; olay satırı 180 gün (30) → silinir.
  - `license-activations` IP alanları: aktifken son 90 gün; sonlanınca 90 gün sonra NULL; satır (IP'siz) lisans ömrü + 2 yıl.
  - `security-blocks` sona ermiş + 90 gün → silinir.
  - `license-status-log` lisans ömrü + 10 yıl; `security-audit` 2 yıl.
  - Temizlik `licensing:sweep` içinde, gece bir kez, 1000'lik partiler, her parti ayrı kısa transaction.
- **Loglar:** yalnız kodlar ve kısa kimlikler (`act_…` son 6, `lid` son 6, maskeli anahtar). Tam IP, e-posta, parmak izi, gövde loglanmaz. Test: log yakalama ile regex taraması.
- **Müşteri hakları:** portalda cihaz listesi ve deaktivasyon; silme talebinde aktivasyon IP alanları anında NULL, aktivasyon satırları anonimleştirilir (müşteri bağlantısı lisans üzerinden kalır, lisans silinmez — ticari kayıt).
- **Gözlem:** Güvenlik merkezi özet kartları (son 24 sa olay/önem, açık yüksek olay, aktif engel, otomatik askı sayısı, API istek/ret oranı — bellek sayaçları, süreç başına), `GET /api/security/summary`.

---

## 7. Güvenlik merkezi (admin custom view)

- Konum: `admin.components.views.securityCenter` → `/admin/guvenlik`; nav: `afterNavLinks` bileşeni yalnız `isAdminUser` ise render. Görünüm sunucu tarafında da rolü doğrular (editor doğrudan URL ile 403/redirect).
- Dosyalar: `src/admin/security/{SecurityCenterView.tsx, Summary.tsx, EventsTable.tsx, EventDrawer.tsx, BlocksTable.tsx, AuditTable.tsx, RiskyLicenses.tsx, actions.ts}`; stil mevcut admin token'ları; bağımlılık eklenmez.
- **Sekmeler:** Özet · Olaylar · Riskli lisanslar · Engeller · Denetim izi · Ayarlar (→ `licensing-settings`).
- **Olaylar filtresi:** tür, önem (çoklu), triage, tarih aralığı, kaynak, lisans/müşteri araması (id/maskeli anahtar son grup/e-posta tam eşleşme — sunucuda). Sayfalama 50, varsayılan sıralama `lastSeenAt desc`, varsayılan filtre `triage=open`.
- **Olay çekmecesi:** ayrıntı (allowlist alanları), bağlantılar (lisans, müşteri, aktivasyon, sipariş — Payload belge linkleri), zaman çizelgesi (aynı lisansın son 20 olayı + status-log), eylemler: Onayla · Çözüldü · Yanlış alarm (+geri al) · Lisansı askıya al · Lisansı iptal et (iki adım) · Cihazı kaldır · IP önekini/aktivasyonu engelle (süre seçimi 1 sa/24 sa/7 gün/süresiz). Her eylem gerekçe ister.
- **Lisans belge görünümü:** yan panel "Lisans işlemleri" (P6 "Sipariş işlemleri" deseni): durum rozeti + neden, Askıya al/İptal/Yeniden etkinleştir/Geri al, aktivasyon listesi (cihaz etiketi, platform, son görülme, IP öneki, kaldır), son 10 status-log satırı.
- **Bildirim:** `high`+ anında e-posta (`alertEmails`, yoksa `PAYMENTS_ALERT_EMAIL` → site-settings iletişim), günlük özet (isteğe bağlı), nav'da açık yüksek olay sayısı rozeti. E-posta içeriği PII'siz: tür, önem, maskeli kimlik, panel bağlantısı. Kuyruk en az bir kez teslim (P4 notu: SMTP ile işaret arasında kesintide tekrar olası).

---

## 8. Mevcut sistemle entegrasyon

| Alan | Değişiklik |
|---|---|
| P4 fulfill | Değişmez; yeni lisans `publicId` alır; `license.status_changed` gerekmez (create). |
| P6 iade/dispute | `admin-actions.ts` ham SQL'ine aynı tx'te günlük + aktivasyon `revoked` (iade). Regresyon `payments-p6*.test.ts` yeşil kalmalı. |
| Müşteri portalı | `/hesap/lisanslar` (EN `licenses`): lisans başına cihaz listesi (etiket, platform, son görülme gün düzeyinde, IP gösterilmez), "Bu cihazı kaldır" (server action, `forbiddenActionOrigin` + müşteri başına limit + kota), etiket yeniden adlandırma. Askıdaki lisansta neden metni (genel) + destek talebi bağlantısı. |
| İndirmeler | Web indirmesi değişmez (`downloadsRead`/`mediaRead`). API yolu ayrı (`/dl/<token>`), aynı dosyayı akıtır. |
| E-posta | Yeni şablonlar: müşteriye askı/geri alma/iptal/yeni cihaz eklendi (isteğe bağlı) — `src/lib/email/licensing-*.ts`, `softmarketEmailAdapter`. |
| MCP | `src/lib/mcp.ts` allowlist: yeni koleksiyon/global **eklenmez**; `licenses` create/find/update kalır, `status` alanı API key ile yazılamaz (field access) → `mcp.test.ts` kilitler. AGENTS.md MCP bölümüne not. |
| Ödeme webhook rotaları | İmza reddinde `emit('webhook.bad_signature')` (aggregate); yanıt değişmez. |
| Login | Admin: `users` `hooks.afterLogin` (yeni ağ öneği → olay), başarısız giriş için L0'da Payload 3.93 hook noktası doğrulanır (`afterError`/`beforeOperation('login')`). Portal: `src/lib/portal/actions.ts` mevcut giriş akışına `emit`. |
| Content import / starter | Yeni alanlar opsiyonel; seed değişmez, `schema.json` yeniden üretilir; `products.licensing` seed'de yok. |
| Caddy / deploy | `deploy/Caddyfile` alt alan adı bloğu; `deploy/licensing-sweep.{service,timer}`; `.env.example` yeni değişken yok (opsiyonel `SOFTMARKET_LICENSE_SIGNING_KEY`). |

---

## 9. Fazlar

Toplam tahmin: **24–30 iş günü** (L11 hariç). Şema yalnız L1'de. Her faz sonunda çapraz QA + kullanıcı onayı.

### L0 — Spike ve ADR (1 gün, şemasız, atılabilir dal)

- **Kapsam:** (1) Payload 3.93 admin custom view + `afterNavLinks` rol filtresi + view içinde sunucu rol kontrolü; (2) admin başarısız giriş için hook noktası; (3) Node 24 `crypto` ile Ed25519 JWS (bağımlılıksız) — `jose` gerekip gerekmediği; (4) kopya DB'de 100 eşzamanlı "validate benzeri" tx (serial queue) gecikme ölçümü; (5) Next 15 route handler'da ham gövde + `Range` dosya akışı; (6) partial unique index'in Drizzle/Payload migration ile birlikte yaşaması.
- **Çıktı:** `docs/licensing/adr-l0.md` (evet/hayır + kanıt komutu + plana etkisi).
- **Kabul:** 6 maddenin kanıtı; (4)'te p95 > 250 ms ise L3 tasarımı (yazım birleştirme) revize edilir.

### L1 — Şema (2–2,5 gün, **şema VAR**)

- **Kapsam:** §4.1–4.8 koleksiyon/global/alanlar, `src/access` yardımcıları (`nobody` mevcut), admin-i18n, `generate:types`, `generate:importmap`, migration `licensing_core` (§4.9), `prepareLicense` `publicId`, `products.licensing.code` değişmezlik kancası, `licenses.status` MCP field access, `recordLicenseTransition()` iskeleti + `Licenses.beforeChange` günlük kancası.
- **Kabul:** anonim/customer/editor/API key ile yeni koleksiyonlara REST/GraphQL okuma-yazma 401/403; admin okuma var, yazma 403; migration kopyada up/down/up, satır farkı 0, integrity/FK ok, SQL'de yasak ifade yok; seed + starter import idempotent; panelden durum değişikliği günlük satırı yazar; MCP `status` yazımı reddedilir.
- **Testler:** `tests/unit/licensing-access.test.ts`, `licensing-migration.test.ts`, `licensing-transitions-db.test.ts`, `mcp.test.ts` genişletme, `admin-labels.test.ts` yeşil.
- **Riskler:** G1 ile migration çakışması (kural 8); partial index'in Payload'ın sonraki `migrate:create` diff'inde "fark" sayılması (L0 madde 6).

### L2 — Kripto ve kira çekirdeği (2 gün, şemasız) — **kritik**

- **Kapsam:** `src/lib/licensing/crypto/{keys.ts, jws.ts, canonical.ts, hmac.ts, ip.ts}` (saf, `server-only`); vault sır kimliği `licensing-signing-ed25519` + env önceliği; `pnpm licensing:keygen` (yalnız kurulum; vault'a yazar, çıktı yalnız kid + açık anahtar); döndürme fonksiyonu; `GET /keys`.
- **Kabul:** test vektörleri sabit (RFC 8032 + kendi kanonik dizelerimiz); bozuk imza, yanlış kid, `revokedKids`, `alg` değişikliği (`none`/HS256) reddi; özel anahtar hiçbir yanıtta/logda yok (tarama testi); anahtar yoksa API 503.
- **Testler:** `licensing-crypto.test.ts` (vektörler, negatifler), `licensing-keys-db.test.ts`.

### L3 — İstemci API'si (3,5–4,5 gün, şemasız) — **kritik**

- **Kapsam:** `activate`, `validate`, `deactivate` rotaları; `src/lib/licensing/{api/guard.ts, rate-limit.ts, nonce.ts, blocks-cache.ts, activation-service.ts, errors.ts, respond.ts}`; olay yazıcı (§5.2); payments entegrasyonu (§5.3 son madde); IP önek/HMAC; `licenses.activations` join.
- **Kabul:** §3 sözleşmesinin tamamı testli; koltuk sınırı eşzamanlı 20 aktivasyonda tam N; idempotent tekrar aktivasyon; rebind kotası; replay (aynı nonce) 401; ±skew; imzasız/yanlış imzalı yanıt testi istemci simülatörüyle; enumerasyon testi (yok/uyuşmaz ürün aynı yanıt ve benzer süre ±20 ms); iade → aktivasyonlar `revoked` + günlük; dispute → günlük + API 403 `license_suspended`.
- **Yük testi** (`scripts/licensing-load.ts`, izole kopya DB, port 3600, prod build): 100 eşzamanlı `validate` × 10 tur → hata 0, `write queue timeout` 0, p95 < 300 ms, p99 < 800 ms; 1000 istek/10 sn tek IP → 429'lar, DB yazımı aggregate satırlarla sınırlı (satır sayısı ölçülür); 50 eşzamanlı aktivasyon + paralel admin yazımı → SQLITE_BUSY 0.
- **Testler:** `licensing-api.test.ts`, `licensing-api-db.test.ts`, `licensing-seats-concurrency.test.ts`, `licensing-load` raporu `docs/licensing/load-report.md`.

### L4 — Güncelleme ve lisanslı indirme (1,5–2 gün, şemasız)

- **Kapsam:** `updates`, `downloads/link`, `dl/<token>`; güvenli yol çözümü; Range; kullanım sayacı; olaylar.
- **Kabul:** yol geçişi (`../`, symlink, mutlak yol) reddi; başka ürünün indirmesi 403; süresi dolmuş/değiştirilmiş token 401; deaktive aktivasyonla token 403; 206 doğru `Content-Range`; büyük dosyada bellek sabit (stream).
- **Testler:** `licensing-updates.test.ts`, `licensing-download-db.test.ts`.

### L5 — Kural motoru, sweep, bildirim kuyruğu (2,5–3 gün, şemasız) — **kritik**

- **Kapsam:** `src/lib/licensing/rules/*` (her kural saf fonksiyon: girdi pencere verisi → karar), `scripts/licensing-sweep.ts` (`pnpm licensing:sweep`), `deploy/licensing-sweep.{service,timer}` (5 dk), gözlem modu, devre kesici, bastırma, restore, saklama temizliği, e-posta kuyruğu (§7 bildirim), müşteri e-posta şablonları.
- **Kabul:** her kural için eşik altı/üstü/bastırılmış/gözlem testleri; devre kesici N+1'inci askıda açılır ve kritik olay üretir; restore yalnız son geçiş kuralın askısıysa; ödeme askısını kural geri alamaz; sweep idempotent ve 10k aktivasyonda < 30 sn; temizlik yalnız süresi dolanları siler; e-posta en az bir kez, deneme bütçesi ≤5.
- **Testler:** `licensing-rules.test.ts`, `licensing-sweep-db.test.ts`, `licensing-retention-db.test.ts`, `licensing-notify-db.test.ts`.

### L6 — Güvenlik merkezi + admin eylemleri (3–4 gün, şemasız)

- **Kapsam:** §5.4 uçları, §7 görünüm ve lisans yan paneli, `licensing-settings` imza anahtarı düğmesi, nav rozeti.
- **Kabul:** editor/customer/API key/MCP/cross-site her uçta 401/403 (P6 matrisi); her eylem `security-audit` satırı; iki adımlı onaylar; filtreler sunucuda; 10k olayda liste < 500 ms; a11y (klavye, odak, kontrast); public bundle'a admin kodu girmez (`client-bundle-guard`).
- **Testler:** `licensing-admin-endpoints.test.ts`, `security-center-view.test.tsx` (React DOM), e2e `tests/e2e/security-center.spec.ts` (izole: olay üret → askıya al → geri al).

### L7 — Portal, e-postalar, KVKK metinleri (1,5–2 gün, şemasız)

- **Kapsam:** §8 portal satırı; TR/EN i18n; yasal taslak güncellemeleri (`content/legal/*`, `legalReview` yeniden onay ister); `docs/editor-guide.md` lisans bölümü.
- **Kabul:** müşteri yalnız kendi cihazlarını görür (başka müşterinin aktivasyon id'si 404); kota; askı metni PII'siz; legal değişiklik `legalReady`'yi hukukçu onayına kadar düşürür (mevcut davranış).
- **Testler:** `portal-devices.test.ts`, e2e portal cihaz kaldırma.

### L8 — Kimlik ve webhook anomalileri (1–1,5 gün, şemasız)

- **Kapsam:** admin/portal giriş olayları, yeni ağdan admin girişi e-postası, webhook imza reddi olayı.
- **Kabul:** başarısız giriş sayımı aggregate; kilitlenme olayı; webhook yanıtları birebir aynı (regresyon).

### L9 — İstemci entegrasyon kılavuzu ve referans doğrulayıcı (1,5–2 gün, şemasız)

- **Kapsam:** `docs/licensing/client-integration.md` (akış, curl, kanonik dize, kira doğrulama algoritması, hata tablosu, çevrimdışı davranış, anahtar depolama önerileri, obfüskasyon önerileri), `docs/licensing/test-vectors.json`, `scripts/licensing-sim.ts` (sahte istemci: activate/validate/deactivate/updates/download), C# ve TypeScript doğrulayıcı örnekleri.
- **Kabul:** simülatör izole sunucuya karşı uçtan uca geçer; vektörler L2 testleriyle aynı dosyadan beslenir.

### L10 — QA, güvenlik denetimi, deploy (2 gün)

- **Kapsam:** tehdit modeli tablosunun madde madde doğrulaması, bağımsız pentest tarzı denetim (rate limit atlatma, imza karışıklığı, IDOR, CSRF, SSRF yok, yol geçişi), Caddy alt alan adı bloğu + `deploy/` birimleri, `docs/licensing/operations.md` (anahtar döndürme, `SOFTMARKET_SECRETS_KEY` yedeği, olay müdahalesi, yanlış pozitif prosedürü), AGENTS.md + memory-bank.
- **Kabul:** typecheck/lint/test/build yeşil; izole e2e yeşil; yük raporu hedefleri; açık P1/P2 yok.

### L11 — (opsiyonel) Dosyayla çevrimdışı aktivasyon (2 gün, şemasız)

Program imzalı istek dosyası üretir → müşteri portala yükler → portal imzalı kira dosyası verir (uzun `leaseDays` ayrı üst sınır). Açık soru 1'e bağlı.

---

## 10. Sıra ve paralellik

- **Sıra:** L0 → L1 (şema) → L2 → L3 → (L4 ∥ L5) → L6 → (L7 ∥ L8 ∥ L9) → L10 → [L11].
- **Görsel çerçeve planı ile:** G0 şu an `../softmarket-g0` worktree'sinde. L0 şemasızdır, G0/G2–G7 ile paralel yürüyebilir. **L1 ve G1 aynı anda `migrate:create` yapmaz**: G1 ana dala alınmadan L1 başlamaz (ya da kullanıcı önceliği tersine çevirirse G1 L1'i bekler). Ortak dosyalar: `src/payload.config.ts` (koleksiyon listesi, admin bileşenleri), `src/lib/admin-i18n.ts`, `src/payload-types.ts`, `src/app/(payload)/admin/importMap.js` — birleştirmede yeniden üretilir, elle çözülmez.
- **Ödeme kodu:** L3 `admin-actions.ts`'e dokunur; o sırada P-serisi açık işi varsa dosya sahibiyle sıralanır.
- `generate:types`/`generate:importmap` yalnız L1 ve L6'da. Build ile typecheck aynı anda çalışmaz; SQLite testleri `--maxWorkers=1`.

## 11. Ajan dağılımı

Kurallar: yazan ≠ denetleyen. Claude yazarsa GPT Sol/Terra (High) denetler; GPT yazarsa Claude Sonnet (Medium) veya Gemini Hydrogen (High) denetler; kritik güvenlik çekirdeği Claude Opus (Medium); GPT backend'de dolanırsa Opus (Medium) devralır; UI Sonnet (Medium). **Fable kullanılmaz.** Her faz sonunda kullanıcı onayı.

| Faz | Yazan (effort) | Denetleyen (effort) | Not |
|---|---|---|---|
| L0 spike | GPT Terra (High) | Claude Opus (Medium) | Zaman kutusu 1 gün |
| L1 şema + migration | Claude Opus (Medium) | GPT Sol (High) | Migration SQL'i ve erişim matrisi |
| L2 kripto çekirdeği | Claude Opus (Medium) | GPT Terra (High) + Gemini Hydrogen (High) kripto incelemesi | En kritik iş; iki bağımsız denetçi |
| L3 istemci API'si | Claude Opus (Medium) | GPT Terra (High) | Yük testi Terra çalıştırır |
| L4 güncelleme/indirme | GPT Terra (High) | Claude Opus (Medium) | Yol geçişi ve stream |
| L5 kural motoru/sweep | Claude Opus (Medium) | GPT Sol (High) | Yanlış pozitif senaryoları |
| L6 uçlar | Claude Opus (Medium) | GPT Sol (High) | Yetki matrisi |
| L6 görünüm/UI | Claude Sonnet (Medium) | GPT Sol (High) | a11y, bundle guard |
| L7 portal + e-posta | Claude Sonnet (Medium) | GPT Sol (High) | Yasal metin: Claude Haiku (Low) taslak → kullanıcı/hukukçu |
| L8 anomaliler | GPT Sol (Medium) | Claude Sonnet (Medium) | |
| L9 kılavuz + referans | Claude Opus (Medium) (algoritma/vektör), Claude Haiku (Low) (metin) | GPT Terra (High) | Vektörler L2 testinden |
| L10 denetim | GPT Terra (High) + Gemini Hydrogen (High) | Claude Opus (Medium) özet | Bulgu → ilgili faz yazarı düzeltir |
| Commit | Claude Haiku (Low) | — | Yalnız QA yeşil ve kullanıcı isteyince |

## 12. En büyük riskler

1. **Yanlış pozitifle meşru müşterinin kilitlenmesi** (kurumsal NAT/VPN, disk imajıyla kurulum). Önlem: gözlem modu, kira toleransı, tek tık geri alma, bastırma, devre kesici.
2. **SQLite yazma baskısı / DoS.** Önlem: bellek içi limit ve engel, aggregate olay yazımı, günde ~1 yazım/cihaz, yük testi kabul kapısı. Kalıntı: hacimsel saldırı → Cloudflare/sağlayıcı.
3. **Tek süreç varsayımı.** Rate limit, nonce, olay tamponu, serial queue süreç içidir. Paylaşımlı hosting'de Passenger çoklu süreç açarsa bu garantiler bozulur (`docs/plan-hosting.md`).
4. **İmza anahtarı veya `SOFTMARKET_SECRETS_KEY` kaybı/sızıntısı.** Kayıp = tüm cihazların yeniden aktivasyonu; sızıntı = sahte kira. Önlem: vault + env, döndürme, `revokedKids`, yedekleme prosedürü, çoklu kid gömme.
5. **İstemci kurcalaması teknik olarak önlenemez.** Sunucu yalnız güncelleme/indirme/destek hakkını korur; programın kendi korumasının kalitesi şirketin yazılım ekibine bağlıdır (L9 kılavuzu).

Ek: P6 ödeme koduna dokunma (regresyon), G1 ile migration sırası, KVKK metinlerinin hukukçu onayı gecikmesi, Payload custom view iç API'sinin sürüm değişikliklerinde kırılması.

## 13. Kullanıcıya açık sorular (önerilerle)

1. **İnterneti hiç olmayan (air-gapped) müşteri sunucuları var mı?** Varsa dosyayla aktivasyon (L11, +2 gün). **Öneri:** v1'de 14 gün çevrimdışı tolerans yeterli; ihtiyaç varsa L11 sonra.
2. **Otomatik askıya alma ilk günden açık mı olsun?** **Öneri:** ilk 30 gün yalnız gözlem + e-posta; veriye bakıp eşikleri birlikte ayarladıktan sonra admin panelinden "askıya al" moduna geçilir. İptal her zaman admin onaylı.
3. **Koltuk = cihaz mı, eşzamanlı kullanım mı?** **Öneri:** koltuk = aktif cihaz (bugünkü `seats` alanının en doğal karşılığı); kayan lisans ayrı faz.
4. **Ülke/konum bilgisi kullanılsın mı?** "İmkânsız seyahat" ülke bilgisi ister. **Öneri:** site Cloudflare arkasındaysa yalnız `CF-IPCountry` ülke kodu; değilse v1'de konum yok (KVKK yükü ve MaxMind lisansı gerekmez).
5. **Barındırma ve alt alan adı:** VPS'te kalınsın mı, alt alan adı ne olsun? **Öneri:** lisans API'si için VPS (ayrıntı `docs/plan-hosting.md`) + `lisans.<alan-adi>` alt alan adı, ilk sürümden itibaren programlara gömülü.
6. **Admin hesabı ek koruması:** **Öneri:** v1'de `/admin` erişimini Caddy'de ofis IP'leri veya Cloudflare Access ile sınırlamak; TOTP 2FA ayrı küçük faz (yaklaşık 2 gün).

## Kullanıcı kararları (2026-11-17)

- Sıra: **önce visual-globals G1**, sonra lisans L1. L0 (şemasız spike) G1 ile paralel yürür.
- Otomatik kurallar: **ilk 30 gün yalnız izleme** (olay + e-posta, askıya alma yok); eşikler veriye göre ayarlanınca admin panelinden açılır. İptal her zaman admin onayıyla.
- Koltuk: **cihaz başına** (müşteri portaldan cihaz kaldırıp koltuk boşaltır).
- Barınma: **VPS + `lisans.<alan-adı>`** alt alan adı (DNS + Caddy bloğu). Paylaşımlı hosting hedeflenmez.
- Sorulmayan maddeler öneriyle varsayıldı: v1'de 14 gün internetsiz tolerans (L11 dosyayla aktivasyon sonra), ülke bilgisi yalnız Cloudflare `CF-IPCountry` varsa, `/admin` için IP/Cloudflare Access sınırlaması önerisi + TOTP ayrı küçük faz.

## L0 result and plan revision (2026-11-17)

Details and evidence: `docs/licensing/adr-l0.md` (Terra spike plus the browser/HTTP verification).

- **No `jose` dependency.** Node `crypto` Ed25519 compact JWS reproduces the RFC 8037 A.4/A.5 vectors. Implement without a dependency; carry the RFC vector and negative tests (tamper, wrong alg, wrong `kid`, malformed base64url, oversize, critical headers, claim/time checks) into product tests.
- **Failed admin login: `users.hooks.afterError`.** Verified over real HTTP and the admin UI form (both hit `POST /api/users/login`; wrong password gives 401 and fires `afterError` with `AuthenticationError`). `beforeLogin`/`afterLogin` do not run on failure. Limits: Local API `payload.login` and GraphQL do not go through this hook (test separately if in scope); filter by route and error name; never log password, email or body; a logging failure must not change the 401; Payload's own `maxLoginAttempts` lockout stays the enforcement, the hook only feeds security-center events.
- **Admin custom view access model.** Register via `admin.components.views` and `afterNavLinks`; component paths are relative to `importMap.baseDir` (`/l0/view#View` style, not `/src/...`). Real browser results: admin sees nav link and view; editor has no nav link and a direct URL redirects to `/admin` (server-side `req.user` check in the view, final URL asserted, not an HTTP 403); anonymous is sent to `/admin/login`. The nav link is cosmetic: the server check in the view and admin checks on every data endpoint are the boundary. Cover with Playwright for all three sessions.
- **Partial unique index management.** drizzle/Payload migrations do not know partial indexes: a table rebuild (for example making a nullable column required) generates `DROP TABLE` + rename and silently drops them, never recreating. Policy: create them in hand-written migration SQL with explicit down; review every generated migration for `__new_<table>` on tables with partial indexes and re-create manually; add a CI test that migrates a fresh SQLite and asserts the index exists, rejects a duplicate active row, accepts inactive duplicates. App-level checks inside the transaction stay as defense in depth.
- **Raw body and Range.** `req.arrayBuffer()` preserves bytes (hex and SHA-256 identical over real HTTP); Range gives 206/Content-Range, `If-Range` mismatch gives 200 full body, unsatisfiable gives 416. Licensing routes live under `src/app/(payload)/api/` (the next-intl middleware matcher excludes `api`). L3 adds suffix/multiple range, HEAD, weak ETag and abort tests.
- **L3 revision: split writes by criticality.** Measured serial transaction queue (100 concurrent `BEGIN IMMEDIATE` update+insert): p95 about 550 ms (Terra 559.5 ms, repeat 550.4 ms; p50 about 292 ms, p99 about 573 ms), roughly 5.5 ms per serialized write, so bursts near 900 writers would hit the 5 s queue timeout.
  1. Observational writes (`lastSeenAt`, informational events): in-memory coalescing per activation with a periodic flush (for example every 30-60 s, one transaction per batch), a bounded buffer with a maximum age and size, and a flush on graceful shutdown (SIGTERM/exit). A crash may lose up to one interval of observations; this is accepted and documented.
  2. Security-critical writes (activation, seat claim/release, state transition, revocation, nonce/replay record): separate path, synchronous, atomic, never buffered, and committed before the response is returned.
  3. Re-measure on the target VPS with representative load and other writers before fixing flush intervals.

## L1 implementation record (2026-11-17; no commit, live DB not migrated)

Schema-only phase `licensing_core`. No API routes, crypto, rule engine or security-center UI (L2-L6).

- **Collections** (`src/collections/{LicenseActivations,LicenseStatusLog,SecurityEvents,SecurityBlocks,SecurityAudit}.ts`, group `Security`, shared shape `src/lib/licensing/collection-helpers.ts`): read = admin **panel session** (`isPanelAdmin`: admin, `local-jwt`, no Authorization header), create/update/delete = `nobody` (server code uses `overrideAccess`), `graphQL: false`, `disableDuplicate`, no versions or document locks, all fields read-only in the admin, nav hidden for non-admins, not in the MCP allow-list, no public revalidation. Enum values in `src/lib/licensing/constants.ts` (single source; stored as text, adding a value needs no migration).
- **Global** `licensing-settings` (`src/globals/LicensingSettings.ts`): panel admin read and server-only writes, no versions, document locks, GraphQL or MCP. All importable fields opt out of content import. Tabs General/Limits/Rules/Self-service/Notifications/Retention/Signing keys (country source lives in General). Safe defaults: `apiEnabled=false`; every rule `mode=notify` (no `revoke` mode exists); the license transition hook permits automatic suspension only in `suspend` mode after a valid `rules.observeUntil` has elapsed. An empty date keeps automatic suspension disabled; `leaseDays` <= 30; retention floors `RETENTION_FLOORS` (status log >= 10 years). `signingKeys[]` (kid, publicKey, createdAt, retiredAt, revokedAt) has field access create/update = nobody (L2 endpoint writes it).
- **`licenses`**: `publicId` (unique, 12 CSPRNG bytes hex, generated in `prepareLicense`, field access create/update nobody), `maxDevices` (positive safe integer, empty = seats), `statusReason`/`statusSource`/`statusChangedAt` (server-stamped, read = admin only, write = nobody). `status` field access create/update = panel admin: a users API key (MCP or REST) cannot set or change it (silently stripped by Payload field access; MCP create gets the default `active`). `beforeDelete` refuses (409) when status log or activation rows exist.
- **Transition log** `src/lib/licensing/transitions.ts`: `stampLicenseTransition` (beforeChange) + `logLicenseTransition` (afterChange, same operation transaction) + `recordLicenseTransition(req, input)`. Source: declared `req.context.licenseTransition.source`, else `admin` (panel session) / `mcp` (API key) / `system` (no user); reason defaults to `manual` for admin. Projection cannot affect logging. A failed log insert rolls back the whole bulk update. Raw-SQL refunds and disputes still skip the log and can leave older status summary values on the license. L3 will integrate these paths (§5.3).
- **`products.licensing`** (`enabled`, `code`): read = staff, create/update = panel admin, not in content:import (seed schema unchanged). `code` `^[a-z0-9][a-z0-9-]{2,40}$`, unique, empty stored as NULL, immutable and not clearable once stored (field `beforeChange`; also drafts/autosave, Local API, version restore); `enabled` requires a valid code. Drafts reserve codes across products.
- **Migration** `20261117_200700_licensing_core`: up = 9 CREATE TABLE, 59 CREATE INDEX, 5 generated CREATE UNIQUE INDEX + 2 hand-written partial unique indexes (`license_activations_one_active_fp` on (license_id, fingerprint_hash), `license_activations_one_active_thumb` on (device_key_thumbprint), both `WHERE status = 'active'`), 9 ADD COLUMN and a collision-checked backfill of `licenses.public_id` before its unique index. Up uses additive DDL. Down guards licensing rows, saved settings, product licensing values and license metadata before making schema changes. `migrate:create --skip-empty` found no schema diff.
- **Copy DB** (`.backup` of `data/softmarket.db`): migrate OK; 723 pre-existing tables row-hash equal; integrity `ok`; FK check empty; `content:import --dry-run` 0 created / 98 updated, rolled back, no row change; `migrate:down` restored the original SQLite schema and the second `migrate` preserved the original row hashes.
- **Tests**: `licensing-migration.test.ts` (static SQL rules, up/down/up hashes, backfill, partial index behaviour, guarded down), `licensing-access.test.ts` (REST/Local API/GraphQL matrix, settings bounds, field access, product code rules, partial indexes after the full chain), `licensing-transitions-db.test.ts` (log per change, context sources, atomic rollback, API-key status block, delete guard), `mcp.test.ts` and `admin-labels.test.ts` extended.
- **Deviations / narrower choices**: security collections and settings are readable only with a panel session (not with an admin API key) and have no GraphQL; `licenses.activations` join deferred to L3 (plan L3 scope); settings-change audit (`settings.update`) deferred to L6; the panel "reason required" (`statusNote`) for direct status edits is not enforced yet (L6 action panel); `security-audit.nonce` (unique, plan T4) and `signingKeys[].revokedAt` (T12) added now so later phases stay schema-free; license delete guard added.

## L2 implementation record

- **Crypto and leases.** `src/lib/licensing/crypto/` uses Node Ed25519 for signing and verification. The v1 verifier caps tokens at 4,096 bytes and checks all three compact segments, canonical unpadded base64url, compact JSON without duplicate names or trailing bytes, and the exact `alg`, `kid` and `typ` headers. It verifies against a trusted key, checks both revocation sources and the retirement deadline, and requires the expected issuer, product, activation ID, license ID, fingerprint and device key. On subsequent offline checks the expected IDs come from the saved authenticated activation. A retired key can verify leases issued at or before retirement during the overlap. Lease claims use Unix seconds. The builder caps the offline expiry at the earlier of the configured duration and license expiry. The expiry remains authoritative if it is earlier than the refresh time.
- **Canonical signing and HMAC.** `SM1-REQ` and `SM1-RES` bind the exact body bytes and nonce. HKDF-SHA256 uses the shared vault master input, salt `softmarket/secrets`, and the plan's independent fingerprint, download and UTC calendar-month IP purpose strings. Fingerprint HMAC uses the decoded fingerprint bytes and is stored as lowercase hex. IP HMAC uses the normalized address and returns base64url. IPv4 and its mapped IPv6 forms share the same hash and /24 prefix. Native IPv6 uses /48.
- **Storage and lifecycle.** `pnpm licensing:keygen` provisions a generated Ed25519 key on the configured deployment database. It stores PKCS#8 as AES-256-GCM ciphertext in the existing `integrations.secrets` JSON vault with AAD `softmarket:integrations:licensing-signing-ed25519`. Rotation refuses to overwrite an existing signing record that the supplied master cannot decrypt. The CLI emits JSON with only `kid` and `publicKey`. The `kid` is the base64url SHA-256 of the raw public key. Key generation and rotation save the vault record and public metadata in one transaction. `--rotate` is required to replace an active key. The old public key remains eligible for verification for 90 days after retirement. The server revocation function stamps `revokedAt` and keeps the kid available for deny lists.
- **Environment precedence.** `SOFTMARKET_LICENSE_SIGNING_KEY` accepts Ed25519 PKCS#8 PEM or unpadded base64url PKCS#8 DER. Blank values and `CHANGE_` placeholders are treated as unset, as in integration settings. A configured value must match the active public metadata. Invalid or mismatched values fail closed. `pnpm licensing:keygen --register-env` records the environment key's public metadata without copying its private bytes to the vault. It removes a superseded vault signing record in the same transaction. Add `--rotate` when replacing an active key. This registration mode allows the public endpoint to avoid consulting the private environment value or vault.
- **Public endpoint.** `GET /api/v1/licensing/keys` returns `{ keys: [{ kid, alg: "EdDSA", x }], revokedKids }` with `Cache-Control: public, max-age=3600`, `Date` and `X-Robots-Tag: noindex`. Disabled, uninitialized and unreadable settings return `503`, `no-store` and `{ error: { code: "unavailable" }, serverTime }`. The endpoint continues to publish revocations if there are only revoked keys. It is an unsigned diagnostic exception to §3.1. Trust comes from pinned keys. Cached diagnostics can lag a revocation by up to one hour.
- **Settings access.** The existing global form saves non-secret settings for an admin authenticated through a `local-jwt` panel session with a same-origin request and no `Authorization` header. Anonymous, customer, editor, API-key and bearer requests are denied. Payload field access keeps `signingKeys` server-written. Existing TR/EN labels are retained.
- **Verification and scope.** `licensing-crypto.test.ts` covers fixed RFC 8032 and RFC 8037 vectors, canonical strings, claim and time validation, HMAC, IP privacy and malformed tokens. `licensing-keys-db.test.ts` exercises the route handler, CLI, precedence, concurrent bootstrap, overlap, revocation, transaction rollback and scans of captured HTTP responses and logs. `licensing-access.test.ts` exercises the settings matrix and permission discovery. L2 uses the L1 schema. Client activation endpoints and the admin key action and audit flow remain in their planned phases.
- **Checks.** `pnpm generate:types` produced identical types. Typecheck, lint and the full Vitest suite passed, with 1,628 tests in 99 files. The suite used temporary SQLite databases.

## L3 implementation record

- **Client API.** The Node handlers under `src/app/(payload)/api/v1/licensing/` implement raw JSON `POST /activate`, `POST /validate` and `POST /deactivate` with a streaming 8 KiB cap, strict field validation, Ed25519 device proof and signed, nonce-bound responses. The L2 unsigned `GET /keys` diagnostic shares network admission limits. The POST routes require enabled settings, a configured issuer host, an active signer and the fingerprint pepper. Unknown keys, product mismatches, disabled products and unverified owners share `invalid_license` on activation. The client contract and offline workflow are in `docs/licensing/client-api.md`.
- **Durability and seats.** The shared SQLite serializer and `BEGIN IMMEDIATE` guard check eligibility, count active device rows, enforce the rebind quota and mutate device state atomically. L1's partial unique indexes remain the backstop. Each authenticated, admitted operation claims the unique `security-audit.nonce` within the write transaction. A distinct commit receipt is checked before returning success. Skew is checked before authentication and again under the write lock. §3.5's exact, authenticated deactivate retry is acknowledged within the clock window without releasing another seat or writing a second receipt. Other admitted replays get the uniform 401. Counters rotate on refresh and survive process restart.
- **Write performance.** Validation requests already waiting for the writer lock share a commit in groups of at most 16. A per-request savepoint confines a failed refresh, and each response waits for confirmed durability. The queue starts immediately and has no fill timer. Last-seen/IP/version writes are debounced by settings and coalesced separately with events. The event writer aggregates by hour, flushes in 10 seconds or at 200 pending event keys, and bounds outstanding event and last-seen keys at 500 each. High severity triggers a prompt flush for a new key. Next's graceful close awaits scheduled batches. Abrupt process termination can lose pending observations.
- **Abuse and privacy.** Prefix, activation, license and process buckets use admin-editable limits. Trusted IP attribution uses the authenticated proxy headers. Unknown addresses share a rate bucket without a database-wide address block. Trusted-prefix invalid-license bursts can create expiring blocks as specified by §3.7. L3 records clone and burst events without changing license status. L1 continues to guard automatic transitions. Fingerprints persist as HMACs and address metadata as /24 or /48 prefixes plus month-scoped hashes. Logs use fixed codes and security events omit arbitrary request details.
- **Payments and access.** Refund and dispute now stamp the license status summary and call `recordLicenseTransition` in the order transaction. Refund also revokes active devices. Dispute leaves the devices active and the API denies lease refresh with `license_suspended`. A failed history insert rolls back the local order and device changes while keeping the original provider refund lock. Payload 3.93 fails GraphQL schema construction on a native join to a GraphQL-disabled collection. The `licenses.activations` virtual lookup gives panel admins a bounded list on license details and keeps the underlying security collection outside GraphQL and MCP.
- **Verification.** Typecheck, lint, and the full Vitest suite passed (102 files, 1,672 tests). The isolated production build compiled all four routes. The isolated load harness completed 1,000 validations with p95 70.2 ms and p99 75.9 ms. The single-prefix flood produced one aggregate row for 931 rejected requests. The 50-device burst allocated exactly three seats alongside a staff write. See `docs/licensing/load-report.md`. The sandbox rejected binding port 3600, so the production HTTP and VPS measurements remain open. §9 assigns updates, download tokens and Range verification to L4. L3 reuses the L1 schema.

## L4 implementation record

- **Signed operations.** `POST /updates` selects the highest newer SemVer for the device's licensed product in the requested channel, with `releaseDate <= now`. It returns only eligible download metadata for the requested OS and architecture. `POST /downloads/link` accepts a positive integer `downloadId`. Both POSTs reuse L3's strict raw-body authentication, skew, nonce receipts, batched commits and configured activation budget. Missing, foreign, future, ambiguously referenced or unavailable downloads share `403 download_unavailable`.
- **File URLs.** The relative URL carries `base64url(payload).base64url(HMAC-SHA256)` under the L2 download key. The payload is `{d, a, e, n}` with a 128-bit random nonce. A bounded first-party process registry binds the token to the license, product, download row, and opened file identity. Expiry is 300 seconds. Each of up to five admitted GETs is counted synchronously, including aborted transfers. Restarting the API process discards every outstanding link. Network and activation admission thresholds come from `licensing-settings`. The token lifetime and use cap are protocol constants.
- **Current entitlement and path confinement.** GET and HEAD are unsigned and recheck the current license, activation, product, blocks and download-to-media relation before responding. Only safe basenames of protected original uploads are accepted. The operator-configured root is resolved once with `realpath`, because `scripts/deploy.sh` makes `releases/<id>/uploads` a symlink to `shared/uploads`. Linux then walks that physical directory with directory descriptors and opens the leaf with `O_NOFOLLOW`. The opened descriptor's real name must equal the catalog filename byte for byte, which rejects case or normalization aliases on insensitive volumes. macOS uses `O_NOFOLLOW_ANY`. Symlinks, hard links, image-derivative collisions and non-regular files are denied. Device, inode, size and nanosecond change/modify times identify the opened file. The same descriptor supplies the range and streams the bytes with bounded read-ahead and closes on cancellation.
- **Range decisions.** Full GETs return 200. Single closed, open-ended and suffix ranges return 206 with the actual byte range. Malformed, multi-range and unsatisfiable requests return 416 with `Content-Range: bytes */<size>`. HEAD returns full representation headers. HEAD and 416 responses spend zero uses. A mismatched, weak or date `If-Range` returns 200 with the full file. File responses are private and no-store with transformations disabled. [HTTP Semantics, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#name-range-requests)
- **Events and privacy.** `download.link_issued` and `download.started` reuse the L3 writer and aggregate per activation, IP prefix and hour. Address metadata is limited to the trusted prefix and monthly HMAC. Logs omit full IPs, raw fingerprints, license keys and bearer URLs. Next request logging excludes the bearer route. The event and audit options use the L1 text columns. L4 requires no migration.
- **Verification.** Typecheck and lint passed. The full Vitest run passed 1,747 tests across 106 files, including 36 new L4 tests. The isolated route-handler tests use migrated temporary SQLite and uploads. They cover the entitlement matrix, replay and settings, token binding and concurrent reuse, path confinement, Range and validators, header safety, bounded file reads and descriptor cleanup, disabled-mode 503, and telemetry redaction. Local socket binding returned `EPERM`. HTTP through Next and Caddy on the target Linux host remains to be verified.
- Open for L10: verify the /proc/self/fd real-name check and the symlinked uploads root on the Linux VPS.

## L5 implementation record (rules engine, sweep, notification queue)

Scope: §5.3 asynchronous rules, the sweep, monitor-only mode, circuit breaker, suppression, the restore core, §6 retention and the §7 e-mail queue. No schema change and no migration (one new stored enum value `system.daily_digest`, a plain text column value; `pnpm generate:types` updated the union). Admin HTTP endpoints (restore, triage, block) remain L6b.

- **Rules** (`src/lib/licensing/rules/rules.ts`): one pure function per rule, per-license window data in, `{ hit, metric, threshold }` out; no I/O, `now` injected. Window: an observation counts when `now - windowHours < at`. `ipSpread` hits when distinct /24 or /48 prefixes are **greater than** the threshold (plan "> N"); all others hit when the metric **reaches** it. Defaults (licensing-settings, `RULE_DEFAULTS` now in `constants.ts`): ipSpread 10 / 24 h, geoSpread 3 countries / 24 h, impossibleTravel 1 change of the same device's country within 2 h over a 24 h look-back, activationBurst 5 activations / 1 h, activationChurn 6 client/customer ends (`user`, `rebind`, `customer_portal`) / 720 h, cloneSuspected 3 aggregated L3 clone signals / 24 h. Every rule starts in `notify`; `suppressDays` 30. An invalid threshold or window never hits; country rules are skipped while `countrySource = none`. Inputs (`window.ts`) come from two scans per sweep: license-activations (activation/end/last-seen, prefix, country) and non-rule security events (prefix, country, clone counts) of **active** licenses since the longest enabled window. Rule events are never rule input. The L3 event writer now also stores the configured country code on events (column existed).
- **Decision** (`decide.ts`, pure): off -> nothing; inactive license -> nothing; suppressed -> nothing; observe -> event only; notify -> event + admin e-mail; suspend -> automatic suspension only when `rules.observeUntil` is a canonical ISO date strictly in the past, `maxAutoSuspendsPerHour > 0`, the breaker is closed and fewer than the limit rule suspensions happened in the last hour; otherwise it degrades to notify with outcome `monitor_only`, `auto_suspend_disabled`, `circuit_open` or `circuit_tripped`. There is no revoke outcome. Rules never touch activations: suspended devices keep their lease until `exp` (§5.3).
- **Apply and idempotency** (`apply.ts`): each hit is one short BEGIN IMMEDIATE transaction through the serial writer queue that re-reads license status, suppression, the hourly suspension count and the breaker state. The rule event is an episode: an open/acknowledged event of the same rule and license seen within max(windowHours, 24 h) is extended (last seen, metric, outcome); a stronger outcome (notified -> suspended) re-arms the admin alert once. Resolved or false-positive events end the episode. The suspension is a Local API `update` with the transaction's `req` and context `{ source: 'rule', reason: rule_*, ruleKey, event }`, so the L1 hooks stamp the license and append exactly one `license-status-log` row and re-check mode and observeUntil from the database; a refusal (409) rolls back the transaction and the hit is recorded again as `monitor_only` (tested with forged in-memory settings). Concurrent or repeated sweeps produce one suspension, one log row and one event (tested with two parallel sweeps plus a third run). `--dry-run` writes nothing, sends nothing and reports the decisions.
- **Circuit breaker**: the (N+1)th automatic suspension within a rolling hour is not executed; one critical `system.rule_circuit_open` event (dedupe per hour, admin e-mail queued) is recorded and all later suspend-mode hits degrade to notify while an open breaker event was seen within 24 h. Triage of that event (L6b) closes it earlier. `maxAutoSuspendsPerHour = 0` disables automatic suspension without tripping.
- **Restore and suppression** (`restore.ts`, core for the L6b endpoint): in one transaction, refuses with 409 (`not_rule_suspension`) unless the license is `suspended` and its latest status row is a rule suspension; returns to the row's `from` status (source `admin`, reason `restore`, `revertOf`, rule key, event), marks the event `false_positive` with `detail.restoredAt`, re-arms the notification (customer "re-enabled" e-mail only if the suspension e-mail was sent) and writes one `security-audit` `license.restore` row. A payment or admin transition after the rule suspension blocks the restore. Suppression is derived, no new rows: a `restore` status row with that rule key or a `false_positive` rule event within the rule's `suppressDays` suppresses the rule for that license (no event, no e-mail, no suspension).
- **Notification queue** (`notify.ts`, the P4 lease pattern on existing `security-events` columns): `notify_state` pending/sent/failed/skipped, `notify_next_at` as lease (5 min) or backoff deadline, `notify_attempts` (budget 5, backoff 15/30/60/120 min), `notify_last_error` short code, per-message markers in `detail` (`notifyAdminWant`/`notifyAdminDone`, `notifyDigestDone`, `notifyCustomerSuspendedAt`, `notifyCustomerRestoredAt`). One conditional `UPDATE … RETURNING` claims up to 50 due rows; admin alerts of all claimed rows go out as one message; markers are written right after each send; release is guarded by the lease. No SMTP: nothing claimed or counted. No alert recipient: deferred 15 min without counting. Rows pending for 7 days since their last change become `skipped`. At least once: a duplicate is possible only if the process dies between a send and its marker. Sources: rule episodes (notify/suspend modes), the breaker, restores, the daily digest, and L3/API events at or above `minSeverityImmediate` (open, seen within 24 h) that nothing queued yet.
- **E-mails** (`src/lib/email/licensing.ts`): recipients `notifications.alertEmails`, else `PAYMENTS_ALERT_EMAIL`, else site-settings `contact.email`. Admin alert and digest (counts only; one row per Europe/Istanbul day at `digestHour` when `dailyDigest` is on) carry event id, type, severity, count, outcome, rule and the license public ID's last 6 characters, plus the security-center link; no IP, e-mail, key or fingerprint. Customer e-mails (suspended / re-enabled) in TR and EN by `preferredLocale`, with the product name, the masked key and the portal licenses link; switched off by `customerSuspensionEmail`. No separate expiry e-mail (no setting exists).
- **Expiry**: one `license.expired` info event per license and `expiresAt` (dedupe key, licenses that expired in the last 30 days); status is never written.
- **Retention** (`retention.ts`): batches of 1,000 rows, each batch a short transaction, in sweeps that start in the 04:00 Europe/Istanbul hour or with `--retention`. Event IP fields after `eventIpDays` (30), events after `eventDays` (180, never a row with a pending notification), activation IP fields after `activationIpDays` (90) since last seen (active) or end, ended activations and status history `activationRowYears` (2) / `statusLogYears` (10) after the license ended (expiry, or the revocation time; perpetual running licenses keep everything), blocks `blockDays` (90) after expiry or lift, audit after `auditYears` (2). Settings below `RETENTION_FLOORS` are clamped to the floor.
- **Operation**: `pnpm licensing:sweep [--dry-run] [--retention]`; `deploy/licensing-sweep.{service,timer}` (oneshot, every 5 minutes, 240 s timeout). Output and logs: counts, rule keys, outcomes, numeric ids, short error codes. Exit 1 when a hit failed. An unreadable stored setting makes the sweep abort before any action (fail closed).
- **Tests**: `licensing-rules.test.ts` (16: boundaries of every rule, invalid configs, decision matrix incl. monitor-only cases and "no revoke", settings normalisation, queue message selection, TR/EN templates), `licensing-sweep-db.test.ts` (15: monitor-only matrix, unreadable setting, forged settings vs L1 guard, suspend once + log once + no revocation under concurrent sweeps, escalation re-arm, breaker trip/stay-open/close, limit 0, episodes, restore + suppression, restore refused after payment/admin transitions, dry run, expiry, rule inputs, 10k activations in about 1.4 s, privacy scan of logs/report/events/admin e-mail), `licensing-notify-db.test.ts` (11: no-SMTP skip, single batched alert, concurrent lease, backoff and budget, at-least-once markers, held lease, recipient fallbacks, customer TR/EN + masked key, severity enqueue, digest, max age), `licensing-retention-db.test.ts` (5).
- **Deviations / open questions**: impossible travel uses hourly aggregated event rows plus the device's last-seen snapshot, so it only sees country changes that reach the database (no per-request history); both country rules stay inert without a country source. "Invalid-license -> IP block" stays synchronous in L3 (§3.7) and is not repeated in the sweep. Stripe `charge.dispute.closed` automation is not added (P6 owner decision still open). The breaker cool-down (24 h) and episode gap (max(window, 24 h)) are code constants, not settings. Digest and retention hours use Europe/Istanbul.

## L6a implementation record (read-only security center)

Scope: the read-only half of §7. Admin action endpoints (§5.4: suspend, revoke, reactivate, restore, deactivate, block add/lift, triage, signing-key rotation), the rules engine and the sweep stay in later phases; the view renders no action buttons and says so in a footnote. No schema change, no migration, no new dependency, no client JavaScript.

- **Route and registration.** `admin.components.views.securityCenter` (`path: '/guvenlik'`, `exact: true`) serves `/admin/guvenlik`; `admin.components.afterNavLinks` adds the nav link. Component paths use the repository's `@/admin/...#Name` style (resolved by the generated import map, regenerated with `pnpm generate:importmap`). Payload renders a custom view under a new key WITHOUT a template (no nav or header), so the view wraps itself in `DefaultTemplate` from `@payloadcms/next/templates` with the same props the root view passes, then renders plain HTML inside `Gutter`.
- **Guard design.** `src/admin/security/guard.ts`: `decideSecurityCenterAccess(req)` runs first inside the view, on the server, before any query. No user -> `/admin/login`; anything that is not an admin cookie session (`hasPanelAdminSession`: role admin, `_strategy === 'local-jwt'`, no `Authorization` header) -> `/admin` (editors, customers, API-key or bearer admins). `isAdminSessionUser` also gates the nav link (cosmetic: nothing is rendered for anyone else) and is re-checked inside every loader read, so a `licenses` read that customers and API keys may do for their own scope can never feed the page. The redirect is a 307 inside the RSC flow, so assertions use the final URL and absent content, not an HTTP 403.
- **Data access.** `src/admin/security/loaders.ts` reads only through the Local API with the requesting admin user and `overrideAccess: false` (no `overrideAccess` read anywhere), so `isPanelAdmin` on the five security collections stays authoritative. Every query uses `select`, so `licenses.key`, customer e-mail, device public key, thumbprint, fingerprint hash, last IP hash, counters and nonces are never loaded. Rows are shaped into explicit view models; relation targets (license publicId and status, product title, activation publicId) come from batched projected lookups; customers, orders, actors and events are links by numeric id only. Filters by license and product use Payload relation paths (`license.publicId`, `license.product`) so there is no id pre-lookup.
- **What is shown.** Overview: counters (open high/critical events, open events, events in 24 h, active blocks, suspended licenses, activations in 24 h, active devices) each linking to the filtered list or collection, open events per severity, latest high-severity events, suspended licenses, latest status transitions, latest activations, shortcuts to the Payload lists (events, blocks, audit trail, status log, activations, licenses, licensing settings). Events tab: filters severity (multi), type, status (default `open`), time range, source, license public ID, product; 50 per page, `lastSeenAt` descending. Blocks tab: active / expired-or-lifted / all, kind; 25 per page. Status transitions tab: range, license, product; 25 per page. Active = `active` and not expired (`expiresAt` empty or in the future).
- **Privacy.** Only stored values: IP prefix and a 10-character shortened HMAC (never the full hash, never an address). `security-events.detail` is flattened to top-level primitives, capped (20 entries, 120 characters), and entries whose key looks secret-like or whose value looks like an e-mail address or a full IP are replaced by a redaction marker (`safeDetail`). Nothing from the signing vault or `licensing-settings.signingKeys` is read. Text from the database is rendered as escaped React text.
- **State and failure handling.** The URL is the only state (plain GET form, links; every parameter allow-listed or pattern-checked in `query.ts`, page capped at 10,000). One failing query shows a neutral notice and an em dash for the counter; only the error name is logged, never row data.
- **UI.** `.sc-*` styles in `src/app/(payload)/custom.scss` use only Payload theme tokens (`--theme-elevation-*`, `--theme-success/warning/error-*`, `--base`), so light and dark follow `html[data-theme]`. Severity and state are always badges with text. Tables sit in focusable scroll regions with captions; tabs are a labelled `nav` with `aria-current`; the filter form is a `fieldset` with real labels; focus rings and reduced motion are handled. Nav badge: number of open high/critical events (omitted at zero or when unreadable).
- **i18n.** `src/lib/security-center-labels.ts` (leaf module, TR/EN), re-exported by `src/lib/admin-i18n.ts` as `SECURITY_CENTER_LABELS`; `admin-labels.test.ts` audits it; `security-center-view.test.tsx` requires a label for every stored enum value. The admin language (`req.i18n`) selects the text; the document title is the static `meta.title`.
- **Tests.** `tests/unit/security-center-view.test.tsx` (guard matrix, nav filter, query parsing and where building, display helpers, label coverage, rendered view with a fake Payload that asserts the user and `overrideAccess: false` on every call) and `tests/unit/security-center-db.test.tsx` (real temporary SQLite: counters, every filter, paging, block states, transitions, editor/customer/API-key/cookieless-admin refusal, and a leak scan of view models and rendered HTML for the license key, full hashes, device material and e-mail addresses). `admin-labels.test.ts` extended.
- **Deviations / notes.** Tabs "Riskli lisanslar", "Denetim izi" and "Ayarlar" of §7 are not separate tabs yet: the audit trail and settings are linked to their Payload screens (the rule engine that produces risk is L5; audit rows start with L6b actions). The nav badge costs one indexed `count` per admin page render. `securityCenter` is a view key, not a collection: no importMap collection entries and nothing in the MCP allow-list changed.
- **Verification.** Typecheck and lint clean; full Vitest passed before the final template wrapper (104 files, 1,711 tests; baseline 102 files, 1,672): the security-center view test has 23 tests, the DB test 13 tests, `admin-labels` +1; after the wrapper the three affected files (view, DB, client-bundle-guard) were re-run green (97 tests). Browser check on a `.backup` copy (`NEXT_DIST_DIR=.next-l6a`, port 3550, throwaway admin/editor/customer and sample rows in the copy only, build log in the scratchpad): anonymous -> `/admin/login`; editor has no nav link and `/admin/guvenlik` ends at `/admin` with no view content; admin sees the nav link with the open-high badge and all four tabs; a real filter submit (critical, 24 h) returned the expected single row and kept the form state; an invalid license ID shows the inline hint; no horizontal page scroll at 1440 and 390 px; light and dark themes verified (screenshots in the scratchpad `l6a/` folder: `light-*.png`, `dark-*.png`, `light-mobile.png`). Not covered: the English admin language in a browser (covered by unit tests only) and screen-reader testing.
- **Handover to L6b.** Actions will extend the existing tables (a per-row action column or a document drawer) and must use the §5.4 endpoints with `guardAdminSession`; this view must stay a pure reader. The `Ref`/`LicenseRef` view models and `loadEvents`/`loadBlocks`/`loadStatusLog` are reusable by those endpoints' read side.

## L6b implementation record (admin actions)

Scope: §5.4 admin actions and the action half of §7 (license side panel, event/block actions, signing-key button). No schema change, no migration, no new dependency, no new stored enum value. L7 (portal, legal texts) and L8 (identity anomalies) are out of scope.

- **Endpoints** (`src/lib/licensing/admin/endpoints.ts`, registered as Payload collection/global endpoints through `routes.ts`, POST only): `/api/licenses/:id/{suspend,revoke,restore,reactivate}`, `/api/license-activations/:id/deactivate` (`mode: release|revoke`), `/api/security-events/:id/{acknowledge,resolve,false-positive,block}`, `/api/security-blocks/add`, `/api/security-blocks/:id/lift`, `/api/globals/licensing-settings/rotate-signing-key`. Block creation lives at `/add` rather than the collection root so Payload's own (closed) create route is untouched.
- **Guard.** `guardAdminSession` (P6): anonymous 401; customer, editor, users API key (MCP), JWT in an `Authorization` header and cross-site (`Origin` ≠ `Host` or `Sec-Fetch-Site` ≠ `same-origin`) 403. In addition `Content-Type: application/json` is required (415; a cross-site form cannot send it without a preflight) and the body is read with a 2 KiB streaming cap (413). Body: `requestId` (16–64 `[A-Za-z0-9_-]`), `reason` (3–500 characters, mandatory, control characters refused), optional `note` (≤ 500), per action `expected { status, changedAt }` (license actions), `expectedTriage` (events), `confirm` (revoke: last six characters of the license public ID, case-insensitive; rotation: `DÖNDÜR` or `ROTATE`), block fields (`kind`, `value`, `activation`, `license`, `scope api|all`, `durationHours 1|24|168|null`, `confirmSelf`). Responses are `no-store` JSON with short codes; logs carry the action, numeric target id, code and actor id only.
- **Transaction and audit design** (`actions.ts`). Each action is one `withPaymentTransaction` (the shared serial writer queue, `BEGIN IMMEDIATE`): (1) the receipt `security-audit.nonce = admin:<action>:<target>:<requestId>` is looked up under the write lock and a retry of a committed request returns `200 replayed` without writing; (2) preconditions are re-read (status and `statusChangedAt` against `expected` → `409 stale`, allowed transitions → `409 invalid_transition`, triage state, block/device state, latest status-log row); (3) the change: license status through the Local API with the transaction's `req` and `req.context.licenseTransition = { source: 'admin', reason: 'manual'|'restore', actorUser, note, event, revertOf }`, so the L1 hooks stamp the summary and append exactly one `license-status-log` row; everything else as conditional SQL on the same connection; (4) exactly one `security-audit` row (actor, `actorKind admin`, action, polymorphic target, reason, note, admin IP prefix /24 or /48, `result ok`, nonce). The commit is confirmed by reading the receipt outside the transaction; post-commit effects run only then. Refusals roll back and write nothing (no `denied` audit rows in v1). Two concurrent admins on the same license produce one suspension, one log row and one audit row (tested with four parallel requests, two sharing a requestId).
- **License actions.** `suspend` (active → suspended, reason `manual`, revertible) also inserts a `license.status_changed` event (`source admin`, `action_taken suspended`, triage `resolved`, customer set, `notify_state pending`) so the L5 queue sends the customer suspension e-mail when `customerSuspensionEmail` is on; the status log row links that event. `revoke` (active|suspended → revoked) requires the typed confirmation and reason, records a medium `license.status_changed` event (no customer e-mail) and revokes every active device (`end_reason license_revoked`) in the same transaction; revoked is terminal for all actions. `restore` undoes the latest suspension only when that row is a rule suspension (wraps the L5 core, now `restoreRuleSuspensionTx`, sharing the transaction, nonce and IP prefix; event `false_positive`, suppression) or an admin manual suspension (back to the row's `from`, reason `restore`, `revertOf`, `detail.restoredAt` + re-armed notification on the suspension event → customer "re-enabled" e-mail only if the suspension e-mail went out); anything else is `409 not_restorable`. `reactivate` lifts the remaining suspensions (payment dispute won, system, direct panel edit) with reason `manual`; for rule/manual suspensions it answers `409 use_restore` so suppression and e-mails stay consistent. Nothing reachable by the rule engine can revoke.
- **Devices.** `deactivate` sets `deactivated` (release) or `revoked` with `end_reason admin` only when the row is still `active` (`409 not_active` otherwise); both free the seat; no status-log row (license status unchanged). Re-activation is prevented by a fingerprint block, not by the device revoke.
- **Events.** acknowledge (open), resolve and false-positive (open|acknowledged) with `expectedTriage`; the audit note records `from -> to`. `false-positive` with `restore: true` restores only the rule suspension this event caused (the license's latest status row must reference it, else `409 not_rule_suspension`); the restore core writes the single audit row (`license.restore`). Any triage of an open `system.rule_circuit_open` event closes the breaker early (L5 only counts `triage = open`).
- **Blocks.** Kinds: `ip_prefix` (canonical stored privacy prefix, /24 or /48), `cidr` (normalised, IPv4 ≥ /16, IPv6 ≥ /32), `activation` (public id), `fingerprint` (HMAC copied server-side from the device row, never sent to the browser), `license` (public id). From an event the value comes from the event row (prefix/activation/license). Durations 1 h, 24 h, 7 days or none (admins only). An active unexpired duplicate is `409 already_blocked`; a block that covers the admin's own trusted address (`requestIP` via the authenticated proxy headers) needs `confirmSelf: true` (`409 self_block_confirmation_required`, nothing written). Add and lift invalidate the API process's blocks cache (`createBlocksCache().invalidate()`, `invalidateLicensingBlocks(payload)`), so the change applies to the next request instead of after 30 s.
- **Signing key.** Rotation (or first generation) reuses the L2 service in the same transaction (`provisionSigningKeyTx`; `provisionSigningKey` now wraps it), returns only `{ code, kid }`, writes the audit row (`note: kid <kid>`) and a high `system.signing_key_rotated` event (open, admin alert queued). Environment-managed keys answer `409 environment_key_configured`; a missing or wrong master key `409 vault_key_required|vault_key_unreadable`. Tests scan responses, logs, audit and event rows for PEM, PKCS#8 prefixes, vault records and the master.
- **Settings audit.** A panel admin's save of `licensing-settings` writes one `settings.update` row in the same operation transaction (`settings-audit.ts`): changed paths with old → new values for numbers, booleans and short strings; arrays and anything containing `@` are named without values; server writes (key lifecycle) are not audited there.
- **UI.** License document sidebar `ui` field `licenseActions` (`src/admin/fields/license-actions.tsx`): status badge, reason, source, last change, devices (label, platform, IP prefix, last seen, release/revoke), last 10 status transitions, and only the actions valid for the saved state; read with the requesting admin and `overrideAccess: false`, always with `select` (no key, device key, thumbprint, fingerprint or IP hash). Security center: an "Actions" column on event and block tables (acknowledge, resolve, false positive, false positive + restore when the row is a rule suspension of a still-suspended license, block from event; lift) and an "Add block" form on the Blocks tab, shown only when `isAdminSessionUser` (the view already redirects everyone else). Signing keys tab: active kid and the rotate button. Client widgets (`src/admin/security/{action-client,actions-ui}.tsx`) import no server code; each dialog is an inline labelled region (focus to the first field and back, Escape cancels, polite live result), keeps one requestId per dialog so a network retry cannot double-apply, and refreshes the route after success. Styles reuse Payload theme tokens (`.sc-dialog`, `.sc-panel`, `.sc-btn--danger` with a text label), so light and dark follow the admin theme. TR/EN strings in `security-center-labels.ts` (`actions.*`), audited by `admin-labels.test.ts`.
- **Tests.** `licensing-admin-endpoints-db.test.ts` (authorization matrix on all 13 routes incl. cross-site, `Sec-Fetch-Site` and JSON-only; malformed/oversized/incomplete bodies; suspend with one log + one audit + queued e-mail, replay and stale; concurrency; manual and rule restore, `use_restore`, `not_restorable`, reactivate after a dispute; revoke confirmation/reason/device revocation/terminal; device release/revoke; triage and stale; event-bound restore; breaker close; blocks cache invalidation, validation, self-block confirmation, event fingerprint block without hash exposure; rotation without private material, replay, env key; settings audit) and `licensing-admin-ui.test.tsx` (side panel and rotate button render nothing for editor, customer, API-key and bearer admins; admin markup has actions but no secrets; action columns only with `canAct`).
- **Status lock (§4.1, follow-up).** `licenses.status` is read-only for every user-facing update: field access `update` is `nobodyField` (create stays panel-admin only; MCP/API key still gets the default), the field is `readOnly` in the panel with a TR+EN hint to "Lisans işlemleri". A submitted value (panel form, REST PATCH, bulk, Local API with `overrideAccess: false`, MCP) is stripped silently while other fields save. The only writers are server code with `overrideAccess: true`, where field access does not apply: the L6b action endpoints (`source admin`), payment fulfilment/refund/dispute, and the L5 rule engine (`source rule`, still guarded by the monitor-only checks). Each keeps declaring `req.context.licenseTransition`, so exactly one `license-status-log` row per change is unchanged. Replaces the old "reason required for a direct panel edit" idea: a direct edit is no longer possible at all. A license created in the panel by an admin can still pick its initial status through a non-panel create (REST/Local API as panel admin); the panel form shows the field read-only.
- **Denied audit (follow-up).** `src/lib/licensing/admin/denied-audit.ts`: every refusal of an identified caller (user, customer, editor, API key, bearer, cross-site, 415/413/400 validation, 404, 409 stale/invalid transition/confirmation/etc.) writes a `security-audit` row `result denied` in its own transaction after the refusal. No schema change: `action` (route's audit action), `reason` = fixed response code, `note` = `count=<n> http=<status>`, `ipPrefix` /24 or /48 only, `actorUser` only for users-collection callers (`actorKind admin` for an admin, `system` otherwise), `target` when the document exists, `nonce = denied:<hash(actor-or-prefix|action|code)>:<window start ms>`. At most one row per key per 10 minutes: a repeat inside the window increments the counter of the opening row (serial writer queue, so no duplicate rows). Anonymous 401s, successful and replayed actions write nothing; failures of the audit write are logged by code and never change the response. No security event is raised: no existing event type fits repeated forbidden admin actions and a new type is a stored enum change. The security center UI is unchanged (the audit list is the Payload screen, where `result=denied` already has a label).
- **Deviations / open.** The event drawer's "suspend/revoke license" and "remove device" shortcuts link to the license document's panel instead of duplicating the actions in the table. Bulk actions remain out of scope (§5.4). `GET /api/security/*` read endpoints are not added: the view reads through the Local API (L6a).
- **Browser check** (isolated `.backup` copy, `NEXT_DIST_DIR=.next-l6b`, port 3570, throwaway admin/editor/customer, one license with two devices and two events in the copy only; build removed afterwards): the first run found that the action dialog was a `<form>` nested inside Payload's document form, so its confirm button did nothing; the dialog is now a labelled `div` region with a button and Enter handling that never reaches the document form. Second run: admin suspended and restored license 1 from the side panel (two status-log rows admin/manual and admin/restore, two audit rows, suspension event queued for the customer e-mail), acknowledged an event in `/admin/guvenlik` (audit `open -> acknowledged`); the revoke dialog shows the typed-confirmation hint; light and dark themes render; no horizontal scroll at 1440 px. Editor: the license document is not reachable (`?notFound=1`, licenses are admin-only), `/admin/guvenlik` ends at `/admin`, no action widgets, and a direct same-origin POST to `/api/licenses/1/suspend` returns `403 forbidden`. Screenshots in the scratchpad `l6b/` folder. Not covered: English admin language and screen readers in a browser (unit-tested labels only).

## L7b implementation record (legal drafts and editor guide)

Scope: documentation and legal drafts only. No `src/`, `tests/`, package, schema or migration changes. `content:import` was not run and the database was not touched. Nothing committed.

- `content/legal/tr/kvkk-aydinlatma.md`: new 2A (license and device verification data, purposes, legal basis), 6A (retention of license and security records, as §6 and the L5 record), 8A (automated rules, monitor-only default, human review, objection).
- `content/legal/tr/gizlilik-politikasi.md`: new license/device bullet group in section 1; pointer to KVKK 6A/8A in section 4 area.
- `content/legal/tr/eula.md`: new 1A (signed lease, 14-day offline default), 3B (automatic checks, suspension not revocation, objection); pointer to KVKK 2A/6A in section 8.
- `content/legal/en/*`: GDPR-style mirror of the same sections (Art. 6(1)(b) and 6(1)(f) wording).
- `docs/editor-guide.md`: new English section "Licensing and security center" (locations, actions, monitor-only and observeUntil, circuit breaker, settings, sweep timer).
- `docs/editor-guide.tr.md`: created with a one-line note and the Turkish version of the same section.
- Lawyer re-approval is required for the changed legal pages (TR and EN eula, gizlilik-politikasi, kvkk-aydinlatma). Importing them changes the `legalReview` content hash, so the approval drops and `legalReady` stays false until counsel re-approves. Every new section carries a "Hukukçu onayı gerekir" / "Requires lawyer review" note.
- The lease duration is system-wide, with a 14-day default and a 30-day maximum. Device release does not implement a deletion request. The deletion and anonymisation procedure, legitimate-interest assessment, and notice duties for automated decisions remain for review.

## L7a implementation record (customer portal devices and e-mail)

Scope: portal licenses and devices plus the customer e-mail. No schema change, no migration, no new dependency, no new stored enum value.

- **Routes.** `/hesap/lisanslar` (EN `/account/licenses`) keeps the table and adds a "Manage devices" link per license. New `/hesap/lisanslar/[id]` (EN `/account/licenses/[id]`; `id` = the license `publicId`, never the numeric id; added to `CANONICAL_PATHS`, excluded from CMS link routes). The page loads the license through the owner-scoped read (`getMyLicenseByPublicId`, `overrideAccess: false`); a foreign, unknown or malformed id is `notFound()` (404, no difference).
- **What it shows.** Product, edition, status badge with a plain-language note for suspended/revoked/expired (generic text, no reason detail, support-ticket link for suspended/revoked), expiry, seats used / `maxDevices ?? seats`, masked key, remaining release allowance, and the active devices (label or "Device N", platform, activation date, last-seen date, coarse country when stored). Never fingerprints, device keys, IP prefixes or hashes: `listPortalDevices` selects display columns only (a test greps the page and module for sensitive column names).
- **Release flow.** "Release device" is a GET link to `?kaldir=<activation publicId>` that renders a confirmation card. Its plain form posts to `releaseDeviceAction` and redirects with a notice. The action checks the full request origin, the customer session, and the per-process limit of 10 attempts per customer per 10 minutes. The list shows notices for requests refused before ownership was established. Under the shared `BEGIN IMMEDIATE` writer lock, `releasePortalDevice` verifies ownership of the license and device, rejects revoked licenses and already ended devices, and conditionally deactivates the device with `end_reason customer_portal`. Suspended and expired licenses can release existing devices without regaining entitlement.
- **Quota.** The writer reads both the current setting and the count under the same transaction. Releases with `end_reason customer_portal` in the last 30 days for that license must stay below `licensing-settings.selfService.portalDeactivationsPer30Days` (default 3, 0 disables portal release). The UI hides the buttons when nothing is left.
- **Records.** Releasing a device preserves the license status and writes one `security_events` row (`activation.ended`, source `portal`, severity info, customer/license/activation IDs, no IP, notice queued) and one `security-audit` row (`activation.deactivate`, actor kind `system`, reason `customer_portal`, `nonce = portal:<customer>:<form token>`). A retry replays the result only for the same device and a customer who still owns it. The commit is confirmed by reading the receipt and its target back.
- **E-mail.** The L5 queue sends a localized release notice with product, masked key, filtered and escaped device label, and a portal link. The current owner, activation and queued customer must match. Delivery waits for SMTP and avoids logging the recipient if SMTP is disabled after the queue's initial check. Queue kind `customerDeviceReleased`, marker `detail.notifyCustomerDeviceReleasedAt`.
- **i18n.** `portal.devices.*` and `portal.licenses.manageDevices` in `src/i18n/messages/{tr,en}.json`.
- **Tests.** `tests/unit/portal-devices-db.test.ts` (8: release writes one UPDATE + one portal event + one audit row + no status row and leaves the license status untouched; foreign customer, foreign device, malformed ids and tokens write nothing; already-ended device; quota per license, 30-day window, 0 = off; idempotent token; display-only listing; e-mail through the queue in EN with escaped label and no full key, sent once; template escaping and label cap) and `tests/unit/portal-device-action.test.ts` (8: 303 targets, cross-origin/originless refused, anonymous to login, foreign license redirect, limit/replay mapping, rate limit, TR/EN key parity, no sensitive columns in the page or module). Full suite: 112 files, 1819 tests.
- **Browser check** (isolated `.backup` copy, `NEXT_DIST_DIR=.next-l7`, port 3580, two throwaway customers in the copy only, SMTP unset): owner sees the license, two devices and 2 / 3 seats, confirms and releases one (303, notice, list shrinks, event/audit/UPDATE rows present, no status row); the other customer gets 404 on the owner's license and the owner gets 404 on the other's; no sensitive strings in the HTML. Build removed afterwards.
- **Deviations / open.** (1) No status-log row and the audit actor kind is `system`: a customer kind or a customer-visible status would need a schema/enum change. (2) The "new device activated" e-mail is NOT added: the plan marks it optional and it needs a setting (schema change) plus a hook in the L3 hot path. (3) Device label renaming is not implemented (plan §8 mentions it; the task scope did not ask for it). (4) Key reveal on the license list is unchanged.
