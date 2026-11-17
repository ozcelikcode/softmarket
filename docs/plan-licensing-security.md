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
| `publicId` | text, unique, readOnly | Backfill: `UPDATE licenses SET public_id = lower(hex(randomblob(12))) WHERE public_id IS NULL`; create'te `prepareLicense` CSPRNG üretir |
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
