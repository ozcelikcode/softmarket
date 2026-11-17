# ADR L0 — Lisanslama spike kararları

- **Tarih:** 2026-11-17
- **Durum:** Karar önerisi; L1–L3 uygulamasında aşağıdaki açık doğrulamalar tamamlanmalı.
- **Bağlam:** `spike/licensing-l0`, `6e9a339`, Node 24.22.2, Payload 3.93.0, Next 15.4.11, SQLite/libsql. DB, SQLite `.backup` ile ana DB'den ayrı bir `/private/tmp/.../softmarket-l0.db` dosyasına kopyalandı; deney yazımları yalnız bu kopyaya yapıldı. Ölçümler tek süreç ve tek makinededir. Geçici uygulama ve migration kodu ürün değişikliği değildir.

## 1. Admin custom view ve yetki

**Sonuç: Evet, bileşen düzeyinde; uçtan uca HTTP/tarayıcı doğrulaması eksik.** `admin.components.views.guvenlik = { path: '/guvenlik', Component: '…#View' }` ve `afterNavLinks: ['…#Nav']` ile geçici view/import map oluşturuldu. `Nav` yalnız `user.collection === 'users' && user.roles.includes('admin')` iken bağlantı döndürdü. `View`, sunucuda `initPageResult.req.user` ile aynı kontrolü yaptı; diğerlerini `redirect('/admin')` ile yönlendirdi. Payload `dist/admin/views/index.d.ts` `initPageResult.req: PayloadRequest` bildirir; `@payloadcms/next/dist/views/Root/index.js` bunu view'a geçirir. Görünürlük bir yetki sınırı değildir; view'daki kontrol zorunludur.

**Kanıt:** Geçici bileşenleri React `renderToStaticMarkup` ile gerçek rol nesnelerinde çalıştırma: `admin nav=<a href="/admin/guvenlik">L0 Security</a>`, `admin view=<main>L0 security admin only</main>`, `editor nav=` (boş), `editor view redirect=NEXT_REDIRECT;replace;/admin;307;`. `pnpm generate:importmap` her iki bileşeni oluşturdu. 3520 Next dev sunucusunda Watchpack `EMFILE: too many open files, watch` nedeniyle rotalar keşfedilemedi; istekler 404 döndü. Dolayısıyla gerçek oturumlu HTTP sonucu ve **tarayıcı doğrulaması yapılmadı**; bu test bunların yerine geçmez.

**L1–L3 etkisi:** Şema gerekmez. İlgili panel fazında gerçek admin/editor oturumuyla nav ve doğrudan URL kontrolünü Playwright/HTTP ile doğrula; sunucu `req.user` kontrolünü ve ilgili API'lerde ayrıca admin panel oturumu/origin kontrolünü koru.

## 2. Başarısız admin girişi

**Sonuç: Evet: REST için collection `afterError`; `beforeLogin`/`afterLogin` başarısız parolada çalışmaz.** `beforeOperation('login')` giriş denemesi öncesinde çalışır ama sonucun başarısız olduğunu bilemez; `afterForgotPassword` farklı operasyondur. `payload/dist/auth/operations/login.js` kullanıcı bulunmasını ve `authenticateLocalStrategy` sonucunu `beforeLogin`/`afterLogin` öncesinde kontrol eder. `handleEndpoints.js` hataları `routeError`'a aktarır; `routeError.js` collection `afterError` çağırır.

**Kanıt:** Geçici `users` kancalarıyla `payload.login` yanlış parola: `beforeOperation login`, `AuthenticationError`; `beforeLogin`, `afterLogin`, `afterForgotPassword`, `afterError` yok. Doğru parola: `beforeOperation login`, `beforeLogin`, `afterLogin`. `REST_POST(config)` gerçek Payload REST işleyicisi, `NextRequest` ve `params: {slug:['users','login']}` ile yanlış parola: `beforeOperation login`, `afterError AuthenticationError`, HTTP yanıt nesnesi `401`. Bu, ağ üzerinden HTTP testi değildir. Local API hataları `routeError` yolundan geçmez; yalnız REST'i kapsayan gözlemdir.

**L1–L3 etkisi:** Plan §8'de önerilen hook noktası `users.afterError` olarak netleştirilmeli: yalnız ilgili login route/method ve `AuthenticationError`/kilitli hesap gibi açıkça tanımlanan hata türlerini süz; parola, e-posta veya ham gövdeyi loglama. REST dışı Local API/GraphQL ve değişik hata türlerini ayrıca test et; kapsam bunları da gerektiriyorsa ortak sarmalayıcı gerekir. Yanlış sayım ve olay kaydı arızasının login yanıtını değiştirmemesi test edilmeli.

## 3. Ed25519 compact JWS

**Sonuç: Evet; bu kapsam için `jose` eklemek gerekmiyor.** Node `crypto.createPrivateKey({format:'jwk', key})`, `createPublicKey`, `sign(null, input, key)`, `verify(null, input, key, signature)` ve `Buffer` base64url yeterli. [RFC 8037 Ek A.1, A.4–A.5](https://www.rfc-editor.org/rfc/rfc8037#appendix-A.4) anahtarı, korumalı `{"alg":"EdDSA"}` başlığı ve payload ile imza RFC'deki 64 baytla birebir eşleşti.

**Kanıt:** `node spike/l0/crypto.mjs` geçici deney çıktısı: `RFC8037 compact signature matches; verify=true; tampered=false`. İmzalanan baytlar ASCII `base64url(header) + '.' + base64url(payload)`; imza compact biçimde üçüncü parça. Deney dosyası ürün koduna alınmadı.

**L2 etkisi:** Bağımlılıksız uygulama tercih edilir; vektör ve negatif testler ürün testlerine taşınmalı. Kripto primitive başarısı tam JWS/JWT güvenliği değildir: tam üç parça, sıkı base64url/JSON, yalnız EdDSA ve Ed25519, `kid` seçimi/iptali, kritik başlıklar, boyut sınırı ve zaman/claim kontrolleri ayrıca tanımlanıp test edilir. Anahtar saklama ve döndürme mevcut plan kapsamındadır.

## 4. Seri transaction kuyruğu

**Sonuç: Evet; p95 sınırı aşıldı.** Gerçek `withPaymentTransaction` → `payload.db.beginTransaction()` → `serializeTransactions` kullanıldı; `BEGIN IMMEDIATE` altında her işlem bir örnek aktivasyon satırının `last_seen` alanını güncelledi ve bir olay satırı ekledi. 100 iş aynı anda `Promise.all` ile başlatıldı; süreler çağrı başlangıcından commit dönüşüne, kuyruk beklemesi dahil `performance.now()` ile ölçüldü. Her biri başarılı, kopyada `SELECT count(*) FROM l0_events` = 100.

**Kanıt:** `pnpm exec tsx spike/l0/bench.ts` → `n=100, p50=293.15 ms, p95=559.50 ms, p99=585.01 ms` (sıralı örneklerde nearest-rank). Ortam: yerel makine, tek süreç, soğuk/tek burst, gerçek ağ ve L3'ün tüm iş mantığı yok. Bu kapasite garantisi veya VPS benchmark'ı değildir; 5 saniyelik queue timeout ve çok süreçli erişim ayrı risklerdir.

**L3 etkisi:** **Plan revizyonu gerekli:** `lastSeenAt` ve gözlemsel olayları sınırları belirli batch/debounce ile birleştir; başarılı doğrulamayı her çağrıda ayrı gözlem yazımına bağlama. Aktivasyon kotası, nonce/tekrar koruması, iptal ve diğer güvenlik açısından kritik kararların atomik, kalıcı yazımını tamponlamadan ayrı tut. Çökmede kaybolabilecek gözlemleri, maksimum gecikme ve bellek sınırını açıkla; hedef VPS'te temsilî yük ve diğer yazarlarla tekrar ölç.

## 5. Ham gövde ve Range akışı

**Sonuç: Evet, route-handler fonksiyonu düzeyinde; ağ üzerinden doğrulama eksik.** Geçici Next Node route `Buffer.from(await req.arrayBuffer())` ile gövde baytlarını korudu; `createReadStream({start,end})` → `Readable.toWeb` ile akış üretti. `Range: bytes=3-7`, eşleşen güçlü `If-Range` ETag'inde 206; uyuşmayan ETag'de tam 200 döndü.

**Kanıt:** Doğrudan `POST(Request)` için `00 ff 0d 0a 41 42 43` → hex `00ff0d0a414243`, SHA-256 `944dcd7d23f81feb7e99bb23066c227011342e529b7c1f61184f2d7a59c65e02`. `GET(Request)` → `If-Range: "l0-v1"`: `206`, `Content-Range: bytes 3-7/16`, gövde `34567`; `If-Range: "old"`: `200`, tam `0123456789abcdef`. 3520 HTTP denemesi yukarıdaki Watchpack hatasıyla 404 verdi.

**L3 etkisi:** İmza ham baytlar üzerinde, parse öncesinde ve okuma sırasında boyut sınırıyla doğrulanır. İndirme uygulaması yetkilendirmeden sonra akış açmalı; güçlü gerçek ETag/Last-Modified, suffix/open-ended/malformed/unsatisfiable/multiple range, 416, HEAD, iptal ve kaynak kapatma davranışlarını HTTP entegrasyon testleriyle tanımlamalı. Bu minimal prototip tam RFC Range uygulaması değildir.

## 6. Partial unique index ve migration diff

**Sonuç: Evet, sınanan diff için korunuyor; tüm gelecek migration türleri için garanti değil.** Kopya DB'de `CREATE UNIQUE INDEX l0_active_idx ON licenses(id) WHERE status='active'` elle çalıştırıldı; `sqlite_master` indeksi doğruladı. `pnpm migrate:create l0_partial_index_test` şema farkı bulmadı (interaktif boş migration sorusu, giriş olmadan çıkış 13). Sonra geçici `licenses.l0MigrationProbe` text alanıyla `pnpm migrate:create l0_partial_index_diff` çalıştırıldı: üretilen `up` yalnız `ALTER TABLE licenses ADD l0_migration_probe text`, `down` yalnız `DROP COLUMN`; `l0_active_idx` veya `DROP INDEX` yoktu. İndeks DB'de hâlâ görünüyordu. Migration uygulanmadı, üretilen geçici dosyalar kaldırıldı.

**L1 etkisi:** Partial unique index'i L1 migration SQL'inde açık `CREATE UNIQUE INDEX ... WHERE ...` ve down'da açık drop ile yönet. Drizzle snapshot şemasıyla karşılaştırma bu canlı indeksi diff'e taşımıyor; sonraki tablo yeniden oluşturma/index değişimi manuel indeksi kaybettirebilir. Her ilgili migration sonrası `sqlite_master`/`PRAGMA index_list`, aktif çift eklemenin reddi, pasif kayıtların kabulü ve up/down/up kontrolleri zorunlu; G1 sıralaması korunur. Test yalnız örnek indeks ve ek kolon diff'ini kapsar.

## Operasyonel sınırlama

3520'de başlatılan sunucuyu durdurmak için yalnız `lsof -ti :3520` çıktısındaki PID'e `kill` denendi; sandbox `Operation not permitted` döndürdü. Bu yüzden süreç bu oturum tarafından durdurulamadı; başka süreçlere sinyal gönderilmedi. Güvenilir HTTP ve tarayıcı kontrolleri açık kalır.

---

## Browser/HTTP verification (Sonnet)

Date: 2026-11-17. Environment: production build (`NEXT_DIST_DIR=.next-l0 pnpm build && pnpm start`, port 3520; avoids the dev-server Watchpack EMFILE), the copied SQLite DB, real Chromium (Playwright from the repo), real HTTP via curl. The earlier "not verified" gaps in sections 1, 2, 5 and 6 are closed as below. Prototype sources are kept under `spike/l0/` (not product code).

### V1. Admin custom view access model

**Decision: adopt.** Register the view via `admin.components.views` and the nav link via `admin.components.afterNavLinks`. Component paths are relative to `importMap.baseDir` (here `src`), so write `/l0/view#View`, not `/src/l0/view.tsx#View`; the latter generates a broken import (`../../../src/l0/...` resolves to `src/src`).

Evidence (Chromium, real login at `/admin/login`):

| Session | Nav link `a[href="/admin/guvenlik"]` | Direct `/admin/guvenlik` |
|---|---|---|
| anonymous | none | final URL `/admin/login`, login form shown |
| admin | present (1) | view rendered (`L0 security admin only`) |
| editor | none | server `redirect('/admin')`, final URL `/admin`, view not rendered |

Rules for L1-L3: the server-side `initPageResult.req.user` check inside the view is the only boundary; the nav link is cosmetic. Any data the view loads must come from admin-gated endpoints with their own checks. Anonymous access is handled by Payload (login redirect), not by our code. Note the redirect is a 307 inside the RSC flow, so assert on final URL and absence of content, not on an HTTP 403.

### V2. Failed admin login

**Decision: use collection `users.hooks.afterError`; confirmed over real HTTP and via the admin UI.**

- `curl -X POST /api/users/login` with a wrong password returned 401 and `afterError` fired once (`AuthenticationError`, `POST`, `/api/users/login`, collection `users`).
- The admin UI login form (Chromium) posts to the same `/api/users/login`; a wrong password triggered `afterError` again (second log entry). So UI and REST share one path.
- Limits (from section 2, unchanged): `beforeLogin`/`afterLogin` do not run on failure; Local API `payload.login` does not go through `afterError`; GraphQL and non-auth error types were not tested. Hook must filter by route/method and error name, never log password/email/body, and must not throw (a logging failure must not change the 401 response).
- Lockout (`maxLoginAttempts: 5`, `lockTime`) is Payload-native; the hook counts attempts for the security center only.

### V3. Raw body and Range route handler

**Decision: adopt the `req.arrayBuffer()` raw-body pattern and the stream-based Range handler as the base, with the full RFC test matrix in L3.** Real HTTP against the production server (route placed under `src/app/(payload)/api/`, because the next-intl middleware matcher excludes `api` and would otherwise localize the path):

| Case | Result |
|---|---|
| POST body `00 ff 0d 0a 41 42 43` | hex `00ff0d0a414243`, SHA-256 `944dcd7d...9c65e02` identical to `shasum -a 256` of the file: bytes preserved |
| `Range: bytes=0-99` (file 16 bytes) | 206, `Content-Range: bytes 0-15/16`, 16 bytes (end clamped) |
| `Range: bytes=3-7` | 206, `Content-Range: bytes 3-7/16`, `34567` |
| `Range` + `If-Range: "l0-v1"` (match) | 206 |
| `Range` + `If-Range: "old"` (mismatch) | 200, full body |
| `Range: bytes=20-30` | 416, `Content-Range: bytes */16` |
| `Range: bytes=9-3` | 416 (prototype choice; RFC 9110 permits ignoring an invalid range with 200 instead) |

Not covered by the prototype (L3 tests): suffix `bytes=-N`, multiple ranges, HEAD, weak ETag, client abort/stream close.

### V4. Partial unique index vs table rebuild

**Decision: partial unique indexes are NOT protected by Payload/drizzle migrations; manage them manually and guard with tests.** Experiment: copy DB with `CREATE UNIQUE INDEX l0_active_idx ON licenses(id) WHERE status='active'`; temporary change `licenses.seats` to `required: true` (nullable to NOT NULL forces a SQLite table rebuild); `pnpm migrate:create`. Generated `up` does `CREATE TABLE __new_licenses`, copy, `DROP TABLE licenses`, `RENAME`, then recreates only the schema-known indexes (`licenses_key_idx`, `..._customer_idx`, etc.). `l0_active_idx` is silently dropped and never recreated; `down` behaves the same. (Combined with the earlier additive-column diff, which preserved it, the index survives only while the table is not rebuilt.) Temporary migration files and the schema change were removed.

L1 policy:
1. Create the partial index only in a hand-written migration step (`CREATE UNIQUE INDEX ... WHERE ...`), with an explicit drop in `down`.
2. Any later migration that touches a rebuilt table (`__new_<table>` in the generated SQL, or `DROP TABLE <table>`) must re-create the partial index by hand after the rename. Review every generated migration for `__new_` on tables that carry partial indexes.
3. Add a unit/integration test that runs all migrations on a fresh SQLite and asserts the partial index exists in `sqlite_master`, rejects a duplicate active row and accepts inactive duplicates. This test catches silent loss in CI.
4. Prefer app-level enforcement inside the transaction as defense in depth; the index is the backstop.

### V5. Serial transaction queue p95 (repeat)

Same script (`spike/l0/bench.ts`), 100 concurrent `withPaymentTransaction`, each UPDATE + INSERT: `n=100, p50=292.15 ms, p95=550.38 ms, p99=573.41 ms`. Terra's run: p50 293.15, p95 559.50, p99 585.01. Reproducible within about 2 percent. **Decision confirmed:** about 5.5 ms per serialized write; 100 simultaneous writers queue to about 0.55 s and a larger burst approaches the 5 s queue timeout (about 900 writers). L3 must batch/debounce observational writes (`lastSeenAt`, events) and keep security-critical writes (activation, seat, state transition) separate, atomic and synchronous.
