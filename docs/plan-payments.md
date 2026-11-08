# Plan — Seçimli Online Ödeme ("Teklif iste" / "Ödeme al")

> Durum: **P1 şemasız çekirdek yazıldı** (`src/lib/payments/**`, rotaya/UI'ye bağlı değil). Şema ve rotalar kullanıcı onayı ve §9'daki girdilerden sonra başlar.
> Kaynaklar: `memory-bank/*`, `AGENTS.md`, `docs/implementation-plan.md` (ilk plan §5 ödeme akışı), `docs/plan-visual-editor.md` (V0–V6, şema sırası), migration'lar `20261106_151826_remove_online_sales` ve `20261107_092304_remove_sales_legal_fields`, mevcut kod (`Editions`, `Licenses`, `Customers`, `SiteSettings`, `src/access`, `src/lib/{licenses,portal,forms,email,mcp,csp,request-guards,legal-draft}`, `middleware.ts`, ürün sayfası, `EditionCard`, portal `/hesap`).

## Kullanıcı isteği ve kararları

- İstek (harfiyen): "Ödeme sistemi de sitede dursun. Sadece seçime göre tamamen kaldırılabilir olmalı. Admin panelde bu seçenek şöyle olacak: teklif iste, ödeme al. Bu denge iyi kurulmalı."
- K1 **Site geneli + sürüm bazında.** `site-settings` ana anahtarı. "Yalnız teklif" seçiliyse ödeme yüzeyinin tamamı kapanır: fiyat, checkout, ödeme sayfaları, webhook uçları, sipariş menüleri ve satış yasal metni linkleri. "Ödeme açık" seçiliyse her sürüm ayrıca "Teklif iste" ya da "Satın al" olarak işaretlenir.
- K2 **Sağlayıcılar:** ~~iyzico (TRY) ve Stripe (USD/EUR)~~ → **P0 bulgusuyla güncellendi:** iyzico TRY/USD/EUR için birincil sağlayıcı. Stripe adaptörü kodda hazır ama **varsayılan kapalı** (aşağıya bakın). Admin'de her biri ayrı açılıp kapatılır.

### P0 bulgusu (2026-11-08): Stripe Türkiye'de yok

- **Türkiye, Stripe'ın desteklenen ülke listesinde değil.** TR merkezli şirket Stripe hesabı açamaz ([stripe.com/global](https://stripe.com/global), 2026-11-08 kontrolü).
- **Sonuç:** iyzico **tüm para birimleri (TRY/USD/EUR)** için birincil sağlayıcıdır. Checkout Form USD/EUR'yu destekler ([CF Initialize](https://docs.iyzico.com/en/payment-methods/checkoutform/cf-implementation/cf-initialize) `currency`: TRY, USD, EUR, GBP, NOK, CHF). Üye işyeri sözleşmesinde döviz yetkisi ayrıca istenir (§9).
- **Stripe adaptörü kodda hazır, varsayılan kapalı.** Yalnız yurt dışı tüzel kişilik gibi durumlarda `PAYMENTS_STRIPE_ENABLED=true` ile açılır. O zaman da yalnız `PAYMENTS_STRIPE_CURRENCIES` (varsayılan USD,EUR) Stripe'a gider; TRY hiçbir zaman Stripe'a gitmez.
- **iyzico imzaları resmi belgeden doğrulandı:**
  - [IYZWSv2](https://docs.iyzico.com/en/getting-started/preliminaries/authentication/hmacsha256-auth): `hex(HMAC-SHA256(secretKey, randomKey + uriPath + body))`, başlık `IYZWSv2 base64("apiKey:…&randomKey:…&signature:…")`.
  - [Yanıt imzası](https://docs.iyzico.com/en/advanced/response-signature-validation): CF retrieve sırası `paymentStatus:paymentId:currency:basketId:conversationId:paidPrice:price:token`. Fiyatlarda sondaki sıfırlar atılır. Resmi örnek vektör testte kullanılır.
  - [Webhook `X-IYZ-SIGNATURE-V3`](https://docs.iyzico.com/en/advanced/webhook) (HPP/CF): `hex(HMAC-SHA256(secretKey, secretKey + iyziEventType + iyziPaymentId + token + paymentConversationId + status))`.
  - [CF Retrieve](https://docs.iyzico.com/en/payment-methods/checkoutform/cf-implementation/cf-retrieve): `fraudStatus` 1 = onay, 0 = inceleme, -1 = ret. [İade v2](https://docs.iyzico.com/en/advanced/refund-and-cancel): `paymentId` + `price`.
- **Stripe webhook imzası** ([belge](https://docs.stripe.com/webhooks/signature)): `Stripe-Signature: t=…,v1=…`, `HMAC-SHA256(secret, "t.body")`, 300 sn tolerans.
- K3 **Otomatik lisans.** Ödeme doğrulanınca lisans otomatik atanır, müşteri e-posta alır ve lisansı portalda görür. Yönetici lisansı iptal edebilir.

## Geçmiş: ne silindi, ne geri gelir

İlk commit'te ödeme kodu zaten yoktu. Yalnız migration'larda iz kaldı.

| Silinen (migration) | Karar |
|---|---|
| `orders`, `orders_items`, `orders_webhook_events` tabloları (`151826` up; şema `151826` down'unda belgeli) | **Yeni tasarımla geri gelir.** Eski down() referans olarak kullanılır, aynen çalıştırılmaz. Tutarlar `numeric` yerine **tam sayı kuruş/cent**. Webhook olayları dizi yerine ayrı, tekil indeksli koleksiyonda tutulur. Onay kanıtı genişletilir |
| `licenses.order_id` (FK, `__new_licenses` yeniden kurulumu ile silindi) | **Bu haliyle geri gelmez.** Bağ yeni `orders_items.license_id` tarafında kurulur. Böylece mevcut tabloya FK kolonu eklenmez ve down() güvenli kalır (§2.4) |
| `editions.prices_{try,usd,eur}`, `vat_rate`, `purchasable` | Yeni adlarla gelir: `saleMode` + `pricing` grubu. Eski kolon adları yeniden kullanılmaz |
| `customers.billing_address_*` | **Geri gelmez.** Fatura bilgisi siparişte anlık kopya olarak saklanır. Bir sonraki siparişte form, müşterinin son siparişinden ön doldurulur |
| `site_settings.commerce_checkout_enabled` | `commerce.mode` (`quote`/`payment`) ile değiştirilir |
| `site_settings.legal_{distance_sales,pre_information,refund}_id` (FK; `092304` up `__new_site_settings` ile silindi) | **FK olarak geri gelmez.** Satış metinleri `pages.commerceLegal` seçim alanıyla işaretlenir (FK yok, down'da DROP COLUMN çalışır) |
| `stripe`, `@react-email/*` paketleri | **Hiçbiri geri gelmez.** Stripe için fetch istemcisi ve kendi imza doğrulamamız yeterli (varsayılan kapalı adaptöre bağımlılık eklenmez). React Email yerine mevcut `src/lib/email/template.ts` kullanılır |

---

## 1. Mod modeli

### 1.1 Üç katmanlı anahtar (en dıştaki kazanır)

| Katman | Nerede | Kim değiştirir | Etki |
|---|---|---|---|
| **Yetenek** `PAYMENTS_ENABLED=true` | env (systemd EnvironmentFile) | Operatör | `false` ya da yoksa ödeme kodu yolu **hiç açılmaz**: admin "Ödeme al" seçeneği doğrulamada reddedilir, tüm ödeme rotaları 404 döner, drain penceresi de uygulanmaz. Varsayılan `false`. Mevcut kurulumda hiçbir şey değişmez |
| **Site modu** `site-settings.commerce.mode` | DB | Yalnız admin, yalnız **panel oturumu** (API key/MCP ile değiştirilemez, §4.6) | `quote` (varsayılan) / `payment` |
| **Sürüm** `editions.saleMode` | DB | Admin (editor değiştiremez) | `quote` (varsayılan) / `purchase`. Yalnız site modu `payment` iken anlam taşır |

Tek karar fonksiyonu: `src/lib/commerce/state.ts` → `getCommerceState()`. Bu fonksiyon server-only'dir ve React `cache()` + `unstable_cache` (tag `commerce`, global afterChange'de yenilenir) ile çalışır. Döndürdüğü değer:

```
{ capability, mode, open, providers: { iyzico: { enabled, configured, env: 'sandbox'|'live' }, stripe: {...} },
  currencies: ('TRY'|'USD'|'EUR')[], legalReady, drainUntil }
```

`open = capability && mode==='payment' && en az bir sağlayıcı (enabled && configured) && legalReady`. Ödeme yüzeyine dokunan her kod **yalnız** bu fonksiyonu sorar; env veya global doğrudan okunmaz (testle yasak: grep guard).

Sürüm başına eylem saf fonksiyonla belirlenir: `resolveEditionOffer(edition, state)`. Sonuç `{ kind: 'purchase', prices: [{currency, amountMinor, provider}] } | { kind: 'quote' }` olur. **Fail-to-quote ilkesi:** fiyat eksikse, para biriminin sağlayıcısı kapalıysa, yasal metin taslaksa ya da mod kapalıysa sonuç `quote` olur. Bozuk bir "Satın al" düğmesi hiçbir koşulda görünmez.

### 1.2 SiteSettings eklemeleri (yeni sekme "Satış ve ödeme")

| Alan | Tip | Varsayılan | Not |
|---|---|---|---|
| `commerce.mode` | select `quote`/`payment`; etiketler "Teklif iste (ödeme kapalı)" / "Ödeme al" | `quote` | Mevcut `commerce` grubu (quoteForm/demoForm) korunur, alanlar yanına eklenir |
| `commerce.providers.iyzico.enabled` | checkbox | `false` | |
| `commerce.providers.stripe.enabled` | checkbox | `false` | |
| `commerce.quoteSince` | date, readOnly, hook doldurur | — | `payment → quote` geçişinde yazılır (drain penceresi, §1.4) |
| `commerce.status` | `ui` alanı (şema yok) | — | Hazırlık kontrol listesi ve sağlayıcı ortamı (**SANDBOX/LIVE**, env'den, salt okunur). Gizli değer göstermez; yalnız "tanımlı/eksik" bilgisi verir |

**Gizli anahtarlar DB'de tutulmaz.** Env değişkenleri: `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, `IYZICO_BASE_URL` (sandbox/live; ortam bu değerden türetilir), `PAYMENTS_STRIPE_ENABLED` (varsayılan `false`), `PAYMENTS_STRIPE_CURRENCIES`, `STRIPE_SECRET_KEY` (tercihen restricted `rk_`; `sk_test`/`rk_test` öneki = test), `STRIPE_WEBHOOK_SECRET`. Stripe env'i kapalıyken admin'deki Stripe anahtarı "yapılandırılmamış" görünür ve açılamaz. Test/live seçimi admin'den yapılamaz; env belirler, admin yalnız görür. Production'da sandbox anahtar kullanılıyorsa checkout ve admin'de kırmızı "TEST MODU" bandı çıkar.

**Hazırlık doğrulaması** (`validate` on `commerce.mode`, yalnız `payment` seçilirken): yetenek açık olmalı; en az bir sağlayıcı enabled ve configured olmalı; üç satış yasal sayfası (§5) yayınlı olmalı ve production'da `isLegalDraft` false dönmeli; `company.legalName/taxNumber/taxOffice/mersisNo` ve `contact.address/email/phone` dolu olmalı; SMTP yapılandırılmış olmalı. Eksikler TR/EN liste halinde döner ve kayıt reddedilir. Böylece taslak sözleşmeyle satış yapılamaz.

### 1.3 Edition eklemeleri

| Alan | Tip | Varsayılan | Not |
|---|---|---|---|
| `saleMode` | select `quote`/`purchase` | `quote` | Admin koşulu: yalnız site modu `payment` iken düzenlenir, aksi halde "Site yalnız teklif modunda" açıklaması görünür. Değer korunur |
| `pricing.taxMode` | select `inclusive`/`exclusive` | `inclusive` | KDV dahil/hariç |
| `pricing.vatRate` | number 0–100, tam sayı | `20` | |
| `pricing.try` / `.usd` / `.eur` | number, ≥0, en çok 2 ondalık | boş | Admin ondalık girer (1250,00). Sunucu `Math.round(x*100)` ile minor units'e çevirir. Boş fiyat o para biriminde satış yok demektir |

- Field access: `saleMode` ve `pricing` için **update = admin** (editor sürüm metnini düzenler, fiyat ve satış modunu değiştiremez). Read = anyone, ama public sorgular (`site.ts`) `pricing` alanını **yalnız `open` iken** seçer.
- `purchase` seçilmiş sürümde en az bir fiyat zorunludur (`validate`).
- `content:import` fiyat ve satış modunu **kabul etmeye devam etmez** (AGENTS kuralı "Fiyat/ID kabul edilmez" korunur). Starter ve seed sürümleri `quote` kalır. Test: import şeması `pricing`/`saleMode` içeren kaydı reddeder.

### 1.4 "Yalnız teklif" modunda kapanan yüzey (kabul listesi)

| Yüzey | Ödeme açık | Yalnız teklif |
|---|---|---|
| Sürüm kartı / `productEditions` / `productHero` | Fiyat + "Satın al" (purchase) ya da "Teklif iste" | Yalnız "Teklif iste", fiyat HTML'de **yok** |
| `/tr/hesap/satin-al/[sku]` ↔ `/en/account/checkout/[sku]` | Açık (giriş zorunlu) | `notFound()` 404 |
| `/hesap/siparisler[/no]` ↔ `/account/orders[/no]` | Açık | 404, portal menüsünde yok. Açık soru S3: geçmiş siparişi olan müşteriye salt-okunur görünüm |
| Webhook/callback uçları | Açık | Drain sonrası **404**. Drain: `quoteSince`'ten itibaren 72 saat, yalnız imzası geçerli **ve** DB'de var olan siparişe ait olaylar işlenir. Yetenek env'i kapalıysa drain uygulanmaz, doğrudan 404 |
| Admin "Satış" grubu (`orders`, `payment-events`) | Görünür | `admin.hidden` (süreç içi önbellek; global afterChange ve onInit günceller, tek süreç varsayımı). **Veri silinmez**; erişim kuralları değişmez, admin doğrudan URL ile okuyabilir |
| JSON-LD `offers` | Yalnız `purchase` + geçerli fiyatlı sürümlerde | Yok |
| Sitemap | Checkout/sipariş hiçbir modda yok (noindex) | Satış yasal sayfaları sitemap dışı |
| Footer/linkler | Satış yasal linkleri ve sağlayıcı logo bandı (iyzico üye işyeri şartı) | Satış yasal sayfalarına giden linkler resolver'da düşer. `/yasal/<slug>` 404 + noindex |
| CSP | Yalnız checkout yolunda `form-action`'a sağlayıcı origin'leri | Ek origin yok (yol eşleşmesi + env yeteneği) |
| MCP | `orders` kapalı (§4.6) | Aynı |
| E-posta | Sipariş/iade e-postaları | Gönderilmez (yeni sipariş oluşamaz) |

Mod değişimi `revalidatePublicContent()` tetikler (global hook zaten var). Edition kaydı ürün sayfasını yeniler (P3'te `revalidate.ts` kapsamı doğrulanır).

### 1.5 Geriye uyum ve veri korunumu

- Migration sonrası `mode=quote`, tüm sürümler `saleMode=quote`, fiyatlar boştur. **Site bugünküyle piksel ve HTML olarak aynıdır** (P3 kabulü: ekran görüntüsü farkı 0, HTML'de fiyat/checkout izi yok).
- `payment → quote` geçişi: siparişler, ödeme olayları ve lisanslar kalır. Pending siparişler drain süresince tamamlanabilir, sonra reconcile işi bunları `cancelled` yapar. Admin kaydederken "N bekleyen sipariş var" uyarısı görür.
- `quote → payment` geçişi: önceki `saleMode` ve fiyatlar aynen geri gelir.
- `purchase → quote` (sürüm): açık pending siparişler etkilenmez; yeni checkout açılmaz.
- Otomatik atanmış lisanslar mod değişse de geçerli kalır; lisans geçerliliği moddan bağımsızdır.

---

## 2. Veri modeli

### 2.1 `orders` (yeni koleksiyon, admin grubu "Satış")

| Alan | Not |
|---|---|
| `orderNumber` | `SM-YYMMDD-XXXXXX` (CSPRNG base32), unique. Sıralı sayı kullanılmaz (hacim sızmaz). URL ve sağlayıcı `conversationId`/`client_reference_id` olarak kullanılır |
| `customer` | relationship → customers, index. DB'de nullable (müşteri silinirse `set null`; snapshot kalır) |
| `status` | `pending`/`paid`/`fulfilled`/`failed`/`refunded`/`cancelled`, index |
| `items[]` | `edition` (rel), `sku`, `title` (anlık, sipariş dilinde), `licenseType`, `durationMonths`, `seats`, `unitNetMinor`, `vatRate`, `vatMinor`, `lineTotalMinor`, `license` (rel → licenses, fulfillment yazar). v1'de **tek kalem, adet 1** |
| `currency` | `TRY`/`USD`/`EUR` |
| `subtotalMinor`, `vatMinor`, `totalMinor` | Tam sayı. `taxMode` ve `vatRate` kalemde saklanır |
| `provider` | `iyzico`/`stripe` (para biriminden türetilir, istemciden gelmez) |
| `providerEnv` | `sandbox`/`live` |
| `providerRef` | Stripe Checkout Session id / iyzico token. Unique (`provider`+`providerRef`) |
| `providerPaymentId` | Stripe PaymentIntent / iyzico paymentId |
| `idempotencyKey` | Unique. Checkout formundaki sunucu üretimi tek kullanımlık jeton + müşteri. Çift gönderim aynı siparişi döndürür. Stripe isteğinde `Idempotency-Key` olarak da kullanılır |
| `paidAt`, `fulfilledAt`, `refundedAt`, `cancelledAt` | |
| `failureReason` | Kısa kod (`card_declined`, `amount_mismatch`, `expired`, …). Ham sağlayıcı mesajı yazılmaz |
| `requiresReview` | Tutar/para birimi uyuşmazlığı, ödeme sonrası iptal edilmiş sürüm gibi durumlar. Fulfillment yapılmaz, admin'e e-posta gider |
| `billing` (grup) | `type` (`individual`/`corporate`), `name`, `company`, `identityNumber` (TCKN 11, algoritma kontrollü) / `taxNumber` (VKN 10), `taxOffice`, `email`, `phone`, `addressLine`, `district`, `city`, `postalCode`, `country`. **Field read: admin + sahip müşteri**; editor görmez |
| `consents` (grup, salt okunur) | `preInformationVersion`, `distanceSalesVersion`, `digitalWaiverAccepted` (cayma istisnası onayı, §5), `acceptedAt`, `ip`, `userAgent` (ilk 200 karakter), `snapshotSha256` |
| `contractSnapshot` | Onay anında üretilen ön bilgilendirme + sözleşme HTML'i (sipariş özeti doldurulmuş). Salt okunur. E-postayla gönderilen ve kanıt olarak saklanan metin budur |
| `locale` | `tr`/`en` |
| `invoice` (grup) | `number`, `issuedAt`, `note`. Admin elle girer; e-arşiv entegrasyonu kapsam dışı |
| `notes` | Yalnız staff |

Erişim: read = staff (admin+editor) veya sahip müşteri (`isOwnerCustomer`; hassas alanlar field access ile admin'e kısıtlı). Create = `nobody` (yalnız sunucu, `overrideAccess:true`). Update = admin, yalnız `invoice`, `notes` ve `requiresReview` (diğer alanlar field-level `update: nobody`). Delete = `nobody`; VUK/TTK saklama süresi nedeniyle siparişler silinmez.

### 2.2 `payment-events` (yeni, gizli koleksiyon)

`provider`, `eventId`, `type`, `order` (rel, nullable), `receivedAt`, `processedAt`, `result` (`processed`/`duplicate`/`ignored`/`error`), `bodySha256`. Tekil indeks (`provider`, `eventId`). **Ham gövde saklanmaz** (PII). Read = admin. Create/update/delete = `nobody`. Admin'de "Satış" altında salt okunur.

### 2.3 Durum makinesi (`src/lib/payments/state.ts`, saf)

```
pending ──paid(doğrulanmış)──▶ paid ──fulfill──▶ fulfilled
   │                            │                    │
   ├─fail──▶ failed ─┐          └──refund──▶ refunded ◀──refund──┘
   └─expire/admin──▶ cancelled ─┤
                                └─(yalnız sağlayıcı API'si ödemeyi doğrularsa, 72 saat içinde)──▶ paid  [requiresReview=true]
```

- Terminal durum: `refunded`. `failed`/`cancelled → paid` yalnız sıra dışı olaylar için vardır (geç gelen başarılı ödeme) ve yalnız sağlayıcıdan geri okunan gerçek durumla tetiklenir.
- `canTransition(from, to)` saf fonksiyondur. DB'ye yazım **koşullu** yapılır: `update where { id, status: { equals: from } }` tek transaction içinde (SQLite `BEGIN IMMEDIATE`). Etkilenen satır 0 ise başka bir işleyici kazanmıştır ve no-op olur.
- **Olay = tetik, gerçek = sağlayıcı.** Webhook, callback, dönüş sayfası ve reconcile işi aynı fonksiyonu çağırır: `syncOrderFromProvider(orderId)`. Bu fonksiyon sağlayıcıdan güncel durumu sunucu kimliğiyle okur ve geçişi oradan türetir. Olayların sırası önemsizleşir.
- Tutar doğrulaması: sağlayıcıdaki ödenen tutar ve para birimi `totalMinor` ve `currency` ile birebir eşleşmelidir. Eşleşmezse `paid` + `requiresReview` olur, fulfillment yapılmaz.

### 2.4 Lisans ↔ sipariş

- `fulfillOrder(orderId)` idempotenttir. `paid` siparişin her kalemi için `items[i].license` boşsa `licenses` create çağrılır (`overrideAccess:true`, `startsAt=paidAt`, `customer`, `edition`). Mevcut `prepareLicense` hook'u anahtarı (CSPRNG), ürünü, koltuğu ve abonelik bitişini üretir. Ardından `items[i].license` yazılır ve `paid → fulfilled` geçişi yapılır. Hepsi **tek transaction** içindedir; çift çağrıda ikinci çağrı dolu `license` görür ve no-op olur.
- Mevcut `notifyLicenseAssigned` (afterChange, commit sonrası `after()`) lisans e-postasını gönderir. Bu hook değişmez.
- Lisans kaydında sipariş bağlantısı Payload `join` alanıyla gösterilir (`orders` → `items.license`; şema kolonu yok). Array içinde join desteklenmiyorsa P0'da tespit edilir ve yerine salt okunur `ui` alanı (sorgu ile) kullanılır.
- İade veya chargeback: siparişin tüm lisansları `revoked` (iade) ya da `suspended` (itiraz açık) olur, `notes` alanına sebep eklenir. Yönetici bugünkü gibi lisansı tek başına da iptal edebilir; bu işlem siparişe dokunmaz.

### 2.5 Migration stratejisi (tek migration `p2_payments_commerce`)

- **Up yalnız ekleme yapar:** `CREATE TABLE orders`, `orders_items`, `payment_events` + indeksler. `ALTER TABLE ... ADD` kolonları: `editions` (`sale_mode` default `'quote'`, `pricing_*`), `site_settings` (`commerce_mode` default `'quote'`, `commerce_providers_*_enabled` default `0`, `commerce_quote_since`), `pages` + `_pages_v` (`commerce_legal`). Payload'ın yeni koleksiyonlar için kaçınılmaz eklediği `payload_locked_documents_rels.orders_id`/`payment_events_id` kolonları da `ADD ... REFERENCES` ile gelir (phase8a deseni). **Up'ta `DROP`/`DELETE`/`__new_` yoktur**; üretilen SQL elle denetlenir.
- **Mevcut tablolara FK kolonu eklenmez** (lisans bağı `orders_items` tarafında, yasal sayfa bağı `pages.commerce_legal` seçim alanında). Tek istisna Payload'ın kilit tablosudur.
- **Güvenli down():** (1) `orders` ya da `payment_events` satırı varsa **hata fırlatır ve hiçbir şey silmez** (satış verisi korunur). (2) Boşsa yeni tabloları düşürür. (3) FK içermeyen eklenen kolonlar için önce indeks, sonra `DROP COLUMN` çalışır. (4) `payload_locked_documents_rels` FK kolonları SQLite'ta DROP edilemez; burada `151826`'da kanıtlanmış temp-table korumalı yeniden kurulum deseni kullanılır. Bu planda `__new_` kullanılan tek yer down'daki bu adımdır ve testle kilitlenir.
- Akış (kalıcı kural 6): DB kopyası → `pnpm migrate` → up/down/up döngüsü → `content:import --dry-run` → `sqlite-integrity` → `PRAGMA foreign_key_check` = 0 → canlı yedek (WAL/SHM dahil) → canlı migrate.
- Test `tests/unit/payments-migration.test.ts`: kopya DB, eski satır sayısı farkı 0, up SQL'de yasak ifade yok, dolu `orders` varken down reddi, boşken down sonrası şema = önceki snapshot.

---

## 3. Akış

```
Sürüm kartı "Satın al" (para birimi seçili)
  → /tr/hesap/satin-al/<SKU>?c=TRY      (portal guard: giriş/kayıt, e-posta doğrulanmış olmalı; dönüş yolu korunur)
  → Checkout sayfası (dinamik, nonce, no-store, noindex)
       • sunucu fiyatı + KDV dökümü (Intl, sunucuda)
       • fatura: bireysel/kurumsal, TCKN|VKN, vergi dairesi, adres (son siparişten ön doldurma)
       • ön bilgilendirme formu: sipariş özeti + metin sayfada gösterilir (kaydırılabilir alan)
       • [ ] ön bilgilendirme formunu okudum   [ ] mesafeli satış sözleşmesini onaylıyorum
       • [ ] dijital içeriğin anında ifasına onay veriyorum, cayma hakkımın sona ereceğini biliyorum (bireysel için zorunlu)
  → Server action startCheckout (origin guard, rate limit, Zod, idempotency jetonu)
       • edition yeniden okunur, resolveEditionOffer → purchase değilse 409/quote'a yönlendir
       • tutar SUNUCUDA hesaplanır; istemci tutarı/para birimi/sağlayıcısı kullanılmaz (yalnız c ∈ izinli para birimleri)
       • order(pending) + consents + contractSnapshot (tek transaction)
       • provider.createCheckout(order) → hosted URL
  → 303 redirect: iyzico Checkout Form paymentPageUrl | Stripe Checkout Session url   (kart verisi sitemize hiç gelmez — SAQ-A)
  → Dönüş:
       iyzico: tarayıcı callbackUrl'e cross-site POST {token}  → /api/payments/iyzico/callback
               (SameSite=Lax nedeniyle oturum çerezi GELMEZ; oturum aranmaz) → token ile sipariş bulunur
               → syncOrderFromProvider (CheckoutForm retrieve, sunucu anahtarı) → 303 /hesap/siparisler/<no>
       Stripe: success_url /hesap/siparisler/<no>?s={CHECKOUT_SESSION_ID} (GET, oturum var)
               → sayfa sahiplik kontrolü + pending ise syncOrderFromProvider (hızlandırma; asıl kaynak webhook)
  → Webhook (asıl kaynak): /api/payments/stripe/webhook, /api/payments/iyzico/webhook
       imza → dedupe(payment-events) → syncOrderFromProvider → fulfillOrder
  → paid → fulfilled: lisans üretimi (generate.ts) + lisans e-postası + sipariş onayı e-postası (sözleşme kopyası ekli/gövdede)
  → Portal: Siparişlerim (durum, tutar, fatura no, sözleşme kopyası) + Lisanslarım (mevcut)
```

- **Para birimi ↔ sağlayıcı eşlemesi** tek yerde tutulur: `providerForCurrency()` (`src/lib/payments/mode.ts`). Varsayılan **hepsi iyzico**. Stripe yalnız `PAYMENTS_STRIPE_ENABLED=true` iken `PAYMENTS_STRIPE_CURRENCIES` içindeki USD/EUR'yu alır; TRY asla. Varsayılan para birimi TR dilinde TRY, EN dilinde USD'dir; kullanıcı yalnız fiyatı ve sağlayıcısı açık para birimleri arasında seçebilir.
- Sağlayıcı soyutlaması `src/lib/payments/providers/types.ts`:
  `createCheckout(order, urls) → { providerRef, redirectUrl, expiresAt }`, `retrieve(ref) → ProviderPaymentState`, `verifyWebhook(rawBody, headers) → VerifiedEvent | null`, `refund(order) → RefundResult`.
- **Stripe (varsayılan kapalı):** SDK yok; fetch istemcisi, `Stripe-Version` sabitlenir. Checkout Session `mode: payment`, `price_data` (sunucu tutarı), `client_reference_id`, `metadata.orderId`, `expires_at` +30 dk, `customer_email`. Olaylar: `checkout.session.completed`, `checkout.session.async_payment_succeeded/failed`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.created/closed`. İmza kendi `verifyStripeSignature` (300 sn, `timingSafeEqual`).
- **iyzico:** resmi `iyzipay` paketi eski ve callback tabanlı olduğu için **ince fetch istemcisi** (`IYZWSv2` HMAC kimlik doğrulama) kullanılır (P1'de yazıldı). Checkout Form initialize `paymentPageUrl` kullanılır. **Gömülü `checkoutFormContent` script'i kullanılmaz** (CSP/SAQ-A). `basketItems` toplamı = `price`, `paidPrice` = toplam. Buyer alanları fatura snapshot'ından gelir. Webhook imzası `X-IYZ-SIGNATURE-V3` (alan sırası P0 bulgusunda). Retrieve yanıtının `signature` alanı da doğrulanır; eksikse ret. `enabledInstallments: [1]` (taksit farkı `paidPrice`'ı değiştirmesin). `fraudStatus` 1 değilse ödendi sayılmaz. Webhook yalnız tetiktir; durum her zaman retrieve ile okunur.
- **Zaman aşımı:** 60 dakikadan eski pending siparişler reconcile işinde sağlayıcıya sorulur; ödeme yoksa `cancelled` olur. Reconcile: `pnpm payments:reconcile` + systemd timer (15 dk). Bu iş Next önbelleğine dokunmaz.
- Sepet yoktur (v1): tek sürüm, adet 1. Çoklu koltuk ve kurumsal alım "Teklif iste"de kalır.

---

## 4. Güvenlik

### 4.1 Kart verisi ve PCI

Kart verisi sitemizden geçmez: sağlayıcıya tam sayfa yönlendirme yapılır, iframe ya da üçüncü taraf script kullanılmaz. Hedef PCI-DSS **SAQ-A**. Checkout sayfası üçüncü taraf JS içermez; Cloudflare beacon da portal kapsamında olduğundan zaten yüklenmez. 3DS/SCA sağlayıcının hosted sayfasında gerçekleşir.

### 4.2 Webhook

- Ham gövde `await req.text()` ile en çok 256 KB okunur. Önce imza doğrulanır, sonra JSON parse edilir.
- Stripe: 300 sn tolerans (replay) + `payment-events` tekil indeksiyle dedupe. iyzico: HMAC V3 + (`paymentId`, `status`, `eventType`) dedupe + retrieve.
- Yanıtlar: geçersiz imza → 400 (gövde boş, ayrıntı yok). Geçerli ama bilinmeyen sipariş → 200 (log, tekrar denemeyi durdurur). İşleme hatası → 500 (sağlayıcı tekrar dener). Tekrarlanan olay → 200. Mod kapalı ve drain dışı → 404.
- Rotalar `src/app/(payload)/api/payments/**/route.ts` altında (mevcut `preview` deseni, Node runtime, `dynamic='force-dynamic'`). Payload catch-all'dan önce eşleşir.
- iyzico callback cross-site POST'tur: yalnız `token` alınır, gövdedeki durum bilgisine güvenilmez. Origin kontrolü yapılmaz ama işlem tamamen sunucu retrieve sonucuna dayanır ve yanıt yalnız 303'tür.

### 4.3 CSRF, origin, rate limit

- `startCheckout` server action'dır. Mevcut `forbiddenActionOrigin` middleware kontrolünden geçer ve mevcut `src/lib/forms/security.ts` sınırlayıcısını kullanır: IP başına (Caddy doğrulanmış başlık) ve müşteri başına dakikada 5 deneme, saatte 20 pending sipariş. Turnstile gerekmez (oturum + e-posta doğrulaması var); kötüye kullanımda açılabilir.
- Sipariş sayfaları sahiplik kontrolü yapar (`isOwnerCustomer`). Başka bir müşterinin sipariş numarası 404 döner (varlık sızdırılmaz).

### 4.4 CSP

`usesNonce` hesap yollarını zaten kapsar. Yeni `contentSecurityPolicy({ checkout: true })` yalnız `/(tr|en)/(hesap|account)/(satin-al|checkout)/` yolunda ve `PAYMENTS_ENABLED=true` iken `form-action`'a `https://checkout.stripe.com` ile iyzico sandbox/live ödeme sayfası origin'lerini ekler (Stripe origin'i yalnız `PAYMENTS_STRIPE_ENABLED=true` iken) (JS'siz POST→303 zincirini Chrome `form-action` ile denetler). `script-src`/`frame-src`/`connect-src`'ye **sağlayıcı eklenmez**. Test: quote modunda ve diğer tüm yollarda politika bugünküyle aynı kalır.

### 4.5 Gizli anahtarlar ve loglar

- Anahtarlar yalnız env'de tutulur (`.env` 600, systemd `EnvironmentFile`). `.env.example`'a yer tutucu `CHANGE_` yazılır. Sağlayıcı istemcileri server-only modüllerdir (`import 'server-only'`); bundle guard `stripe`/`iyzi`/`payments` izini public chunk'ta yasaklar.
- Log politikası: sipariş numarası, durum, sağlayıcı ref ve hata kodu loglanır. **E-posta, TCKN/VKN, adres, kart son 4 hane, tam IP, ham gövde ve anahtar loglanmaz.** Konsol e-posta adaptörü sipariş e-postasını da tümüyle loglayacağı için SMTP yokken sipariş e-postaları atlanır (lisans e-postasındaki mevcut desen).

### 4.6 Yetkiler ve MCP

| İşlem | admin | editor | customer | MCP (admin API key) |
|---|---|---|---|---|
| `orders` okuma | ✓ | ✓ (fatura kimliği/adres gizli) | yalnız kendi | **kapalı** |
| İade / iptal | ✓ (panel oturumu) | ✗ | ✗ | ✗ |
| `invoice`/`notes` | ✓ | ✗ | ✗ | ✗ |
| `payment-events` | okuma | ✗ | ✗ | ✗ |
| `commerce.mode`, sağlayıcı anahtarları | ✓ panel | ✗ | ✗ | **✗** (field access `_strategy === 'api-key'` reddi) |
| `editions.saleMode/pricing` | ✓ | ✗ | ✗ | ✓ (admin anahtarı; fiyat değişikliği sonraki siparişleri etkiler, mevcut siparişler snapshot) |
| `licenses` | mevcut: create/find/update | — | kendi okuma | mevcut (delete kapalı) |

**MCP önerisi: `orders` ve `payment-events` kapalı.** Gerekçe: kişisel veri (TCKN/VKN, adres) bir LLM sağlayıcısına aktarılırsa KVKK yurt dışı aktarım riski doğar, ajan ihtiyacı da düşüktür. İleride gerekirse PII'siz özet aracı (`orderSummary`: numara, durum, tutar, SKU) ayrı bir faz olarak eklenebilir. `mcp.test.ts`, araç listesinde `orders` olmadığını ve `commerce` alanının API key ile yazılamadığını kilitler.

Admin iade işlemi: `orders` belge görünümünde "İade et" düğmesi (admin, onay diyaloğu). Düğme Payload custom endpoint `POST /api/orders/:id/refund` çağırır; endpoint admin kontrolü, panel oturumu (API key reddi) ve Payload CSRF/origin kontrolü yapar. Sağlayıcıda iade (Stripe Refund; iyzico aynı gün `cancel`, sonrası `refund`) yapılır, durum sağlayıcı onayından (webhook/sync) sonra `refunded` olur. v1 yalnız **tam iade** destekler; kısmi iade sağlayıcı panelinden yapılır, sync durumu `requiresReview` olarak işaretler.

---

## 5. Yasal çerçeve

> Bu bölüm teknik uygulama içindir; hukuki görüş değildir. Metinlerin tamamı **taslak** olarak eklenir ve hukuk danışmanı onayı olmadan yayınlanmaz (hazırlık doğrulaması bunu zorlar).

- **6502 sayılı Kanun + Mesafeli Sözleşmeler Yönetmeliği:** ön bilgilendirme sözleşmeden önce yapılır ve tüketici onayı alınır. Sözleşme ve ön bilgilendirme **kalıcı veri saklayıcısı** ile iletilir (sipariş onay e-postası + portalda `contractSnapshot`). Bilgi ve belgeler en az 3 yıl saklanır; siparişler silinmez.
- **Cayma hakkı istisnası:** elektronik ortamda anında ifa edilen hizmetler ve tüketiciye anında teslim edilen gayrimaddi mallar (Yönetmelik md. 15 kapsamındaki istisna). Bunun için **ayrı ve açık onay kutusu** konur ("anında ifaya onay veriyorum, cayma hakkımın sona ereceğini biliyorum"). Onay `consents.digitalWaiverAccepted` + sürüm + zaman damgası ile kaydedilir. Kutu önceden işaretli gelemez. Kurumsal (VKN) alıcıda tüketici hükümleri uygulanmaz; metin yine gösterilir, istisna onayı zorunlu tutulmaz (hukukçu teyidi).
- **Sürümlü metinler:** `pages.commerceLegal` ∈ `distanceSales|preInformation|refund` (her biri tek kayıt, hook doğrular). Sürüm kimliği yayınlanan sayfa sürümünün `updatedAt`'idir. Onay anındaki metin + sipariş özeti (satıcı unvanı/MERSİS/adres/KEP, alıcı, ürün, KDV dahil toplam, ödeme yöntemi, teslim = anında elektronik, cayma bilgisi) `contractSnapshot` içinde dondurulur ve SHA-256'sı saklanır.
- **Eklenecek dosyalar** (pageType `legal`, `--legal` importu, TASLAK bandı + `[PLACEHOLDER]` ile, böylece mevcut `isLegalDraft` noindex/sitemap dışı mekanizmasına uyar):
  `content/legal/tr/mesafeli-satis-sozlesmesi.md`, `on-bilgilendirme-formu.md`, `iade-ve-cayma.md`;
  `content/legal/en/distance-sales-agreement.md`, `pre-information-form.md`, `refund-and-withdrawal.md`.
  EN slug'ları mevcut legal dosya adı düzenine (TR dosya adı = slug) göre P7'de hizalanır. `--legal` importu `commerceLegal` değerini dosya adı eşlemesinden yazar.
- **Güncellenecek taslaklar:** `kvkk-aydinlatma.md` (ödeme ve fatura verisi, işleme amacı, saklama süresi, aktarım: iyzico yurt içi; Stripe yalnız açılırsa **yurt dışı aktarım**; KVKK md. 9 kapsamında standart sözleşme ve Kurul'a bildirim yükümlülüğü hukukçuyla netleşir), `gizlilik-politikasi.md`, `kullanim-kosullari.md` (satın alma bölümü), `eula.md` (ücretli lisans, iade halinde lisansın iptali).
- **e-Arşiv/e-Fatura:** kapsam dışıdır. Fatura bilgisi eksiksiz toplanır, admin fatura numarasını elle girer, portal gösterir. Fatura yasal süre içinde kesilmelidir; kimin keseceği §9'da sorulur.
- **ETBİS** kaydı ve sağlayıcı üye işyeri onayı satıştan önce gereklidir (operasyonel ön koşul). iyzico onayı için sitede istenen öğeler (sözleşmeler, iletişim, logo bandı) yalnız ödeme modunda görünür.

---

## 6. Test stratejisi

| Katman | Kapsam |
|---|---|
| Birim (saf) | `money` (minor units, yuvarlama, dahil/hariç KDV, 0,01 sınırları), `pricing` (para birimi ↔ sağlayıcı, fail-to-quote matrisi), `state` (tüm durum çiftleri için `canTransition` tablosu), `resolveEditionOffer`, `getCommerceState` (env × global × sağlayıcı × legalReady), TCKN/VKN doğrulama, orderNumber biçimi/entropisi |
| İmza | Stripe: bilinen secret ile üretilmiş imzalı fixture'lar (`tests/fixtures/payments/stripe/*.json`): geçerli, bozuk imza, süresi geçmiş zaman damgası (replay), farklı secret. iyzico: HMAC V3 fixture'ları. Ham gövdede tek bayt değişince ret |
| DB (geçici SQLite) | `payments-db.test.ts`: aynı olay 2× → tek lisans. Eşzamanlı 2 `fulfillOrder` → tek lisans. Sıra dışı (`async_payment_succeeded` → `completed`, `expired` → geç `paid`). Tutar uyuşmazlığı → `requiresReview`, lisans yok. İade → lisans `revoked`. Chargeback → `suspended`. Müşteri yalnız kendi siparişini görür. Editor fatura kimliğini göremez. Create REST ile müşteri/editor/anonim reddi |
| Migration | §2.5 testi |
| Quote modu "yokluk" testi | `commerce-off.test.ts` + e2e: `mode=quote` (ve ayrıca `PAYMENTS_ENABLED` yok) iken checkout/sipariş/webhook/callback **404**; ürün HTML'inde fiyat, `Satın al`, `offers` yok; sitemap ve footer'da satış yasal linki yok; CSP bugünkü string ile birebir aynı; admin nav'da "Satış" yok; MCP araç listesinde orders yok; portal menüsünde "Siparişlerim" yok. Drain penceresi: imzalı + mevcut sipariş 200, diğerleri 404 |
| Bundle | `client-bundle-guard.test.ts`: public ve checkout chunk'larında `stripe`, `iyzi`, `src/lib/payments` izi yok. Ana sayfa JS ≤ 130 KB gzip korunur. Checkout sayfası ek istemci JS'i ≤ 2 KB (onay kutuları saf HTML `required`) |
| E2E izole | `tests/e2e/isolated/payments.spec.ts` (mevcut `E2E_ISOLATED` altyapısı, port 3400). Sağlayıcılar **yerel sahte sunucu** ile çalışır (`IYZICO_BASE_URL`/Stripe `host` override; yalnız non-production, production'da override reddedilir). Akış: ödeme modu aç → sürüm `purchase` → giriş → checkout → sahte hosted sayfa → callback/webhook → portalda lisans + sipariş + e-posta (konsol yakalama, anahtar maskeli). İade akışı. Quote modu yokluk akışı |
| Sandbox kabulü (elle, runbook) | `docs/payments/sandbox-runbook.md`: Stripe CLI `stripe listen --forward-to` + test kartları (3DS dahil), iyzico sandbox test kartları ve webhook URL'i (tünel), başarılı/başarısız/3DS/iade/iptal senaryoları. Sonuçlar `docs/payments/acceptance.md`'ye yazılır |
| Perf | Ürün sayfası ISR HIT korunur, sorgu sayısı ≤ mevcut + 0 (fiyat edition sorgusunda gelir). Lighthouse: ürün sayfası LCP/JS değişmez. Ödeme JS'i yalnız sağlayıcı sayfasında |

---

## 7. Görsel editör planıyla entegrasyon

### 7.1 Şema sırası (tek açık migration dalı kuralı)

```
V0 ✓ → V1-S motion → V2-S bağlı bloklar → [V3a/V3b pilot: şema kilidi]  → V4 karar → P2-S ödeme şeması → V5 …
                                           ║ paralel, şemasız: P0 doğrulama, P1 saf çekirdek, P7 yasal taslaklar
```

- **P2-S, V2-S ana dala alındıktan ve pilot şema kilidi kalktıktan (V4) sonra** oluşturulur. V1-S/V2-S açıkken `migrate:create` çalıştırılmaz (snapshot JSON çakışması dersi).
- Ödeme önceliklendirilirse alternatif: P2-S, V2-S'den hemen sonra ve pilotlar başlamadan önce (gün 2 sonu) girebilir; pilot dalları `rebase main` ile alır. Pilot dallarında ödeme şeması değişikliği yasaktır.
- P2-S'nin tablo kesişimi V1/V2 ile yoktur (`orders*`, `payment_events`, `editions`, `site_settings`, `pages.commerce_legal`). `pages` ortak olduğundan V1-S'nin `pages_blocks_*` kolonlarıyla aynı migration'a girmez, sıralı kalır.
- V5 (editör) şema değiştirmez; P3–P6 V5 ile paralel yürür. Ortak dosya sahipliği aşağıdadır.

### 7.2 Ürün bağlı bloklarda CTA kuralı

- Kullanıcı kararı "Teklif İste zorunlu birincil eylem" şöyle genişler: **"Teklif iste" her modda görünür.** Ödeme modunda sayfada en az bir `purchase` sürümü varsa `productHero` birincil eylemi "Satın al"dır (`#surumler`'e gider), "Teklif iste" ikincil olur. Aksi halde bugünkü gibi yalnız "Teklif iste" görünür. `productHero` kaldırılırsa varsayılan hero aynı kuralla çizilir.
- `productEditions` / `EditionCard`: `purchase` sürümde fiyat (seçili para birimi, "KDV dahil/hariç" etiketi), birincil "Satın al" ve ikincil küçük "Kurumsal teklif iste" bağlantısı (açık soru S2) bulunur. `quote` sürümde bugünkü kart aynen kalır.
- Tek kaynak `resolveProductActions(product, editions, state)` saf fonksiyonudur. Hem eski ürün sayfası (uyumluluk modu) hem V2-R bileşenleri onu kullanır. Değişmez kural testlerle kilitlenir: "en az bir eylem görünür ve quote modunda yalnız quote".
- **Dosya sahipliği:** `edition-card.tsx`, `src/components/blocks/product/product-hero.tsx`/`product-editions.tsx` V2-R'ye aittir. P3 bu dosyalara **V2-R ana dala alındıktan sonra** dokunur. V2-R geç kalırsa P3 yalnız mevcut `EditionCard`'ı değiştirir, V2-R aynı resolver'ı çağırır.
- Hareket (V1 `motion`) fiyat/CTA'yı etkilemez. Fiyat metni `opacity:0`'dan başlayan bir animasyonla gizlenmez (LCP kuralı zaten kapsar).

---

## 8. Fazlar

Kurallar: yazan ≠ denetleyen. Ödeme fazlarında QA **en yüksek effort** ile yapılır. Şema fazı tek başına ilerler. Her faz sonunda typecheck/lint/`pnpm test --maxWorkers=1` yeşil, ardından Haiku commit. 3100 ve canlı DB yalnız açık görevle kullanılır; build `NEXT_DIST_DIR=.next-pay`, QA portları 3200/3400.

### P0 — Doğrulama spike'ı (0,5–1 gün, repo kodu yok)

- **Kapsam:** güncel dokümandan doğrulanacaklar: iyzico Checkout Form `paymentPageUrl`, retrieve, refund/cancel, webhook V3 imza alan sırası, sandbox test kartları, buyer zorunlu alanları (TCKN kuralı), USD/EUR desteği; Stripe API sürümü, Checkout Session parametreleri, olay listesi, restricted key izinleri, **Türkiye merkezli şirket için Stripe hesabı uygunluğu**, `stripe-mock`/host override; Payload 3.93'te array içi `join`, custom endpoint CSRF davranışı, koşullu `update where`; kopya DB'de taslak koleksiyonlarla `migrate:create`'in ürettiği SQL.
- **Çıktı:** `docs/payments/p0-findings.md` (kaynak URL'leriyle). Doğrulanamayan her madde "doğrulanmadı" olarak işaretlenir.
- **Kabul:** her soru yanıtlı ya da riskli olarak işaretli.
- **Sonuç (kısmi):** Stripe TR uygunluğu → **uygun değil**; eşleme iyzico'ya alındı (K2 altındaki P0 bulgusu). iyzico imza formülleri doğrulandı. Açık kalanlar: iyzico sandbox'ta USD/EUR + `VIRTUAL` sepet + kurumsal alıcıda `identityNumber` kuralı, Payload array içi `join`, koşullu `update where`, `migrate:create` SQL'i.

### P1 — Saf çekirdek (1–1,5 gün, şemasız, pilotlarla paralel)

- **Dosyalar (yazıldı):** `src/lib/payments/{types,errors,secret,env,money,tax,mode,state,idempotency}.ts`, `signature/{compare,iyzico,stripe}.ts`, `providers/{http,iyzico,stripe,index}.ts`; testler `tests/unit/payments-{signature,mode,money,idempotency,providers}.test.ts`. `resolveEditionOffer` `mode.ts` içinde. `resolveProductActions`, TCKN/VKN doğrulaması ve `server-only` guard'ı P3/P4'e kaldı. Mod değerleri çekirdekte `quote-only|payments` ve `quote|buy`; plandaki `payment`/`purchase` yazımları takma ad olarak kabul edilir, P2-S tek yazımı sabitler. KDV ayarı para birimi başına `{ kind: 'rate', rateBasisPoints } | { kind: 'exempt' }`; boşsa o para biriminde satış yok (S1) (`server-only` guard henüz yok: `node:crypto` kullanan modüller istemci derlemesinde hata verebilir, ancak saf modülleri korumaz; entegrasyondan önce açık sunucu sınırı ve bundle testi zorunlu).
- **Kabul:** %100 dal kapsamı (state/money/offer), imza fixture'ları geçer. `src/lib/payments` server-only importu var. Hiçbir rota ya da şema değişmez.
- **Riskler:** imza formülünün yanlış varsayılması. Önlem: P0 bulgusu + fixture'ın resmi örnekten üretilmesi.

### P2-S — Şema (1 gün, tek başına)

- **Dosyalar:** `src/collections/{Orders,PaymentEvents}.ts`, `Editions.ts` (saleMode, pricing, field access), `Pages.ts` (`commerceLegal`), `src/globals/SiteSettings.ts` (sekme, hazırlık doğrulaması, `quoteSince` hook'u), `src/access/*` (orders kuralları), `payload.config.ts` kayıt, `admin-i18n.ts` (TR/EN), `src/migrations/<ts>_p2_payments_commerce.{ts,json}` (elle denetimli up, korumalı down), `payload-types.ts`, `content/seed/schema.json` (fiyat reddi korunur), `src/lib/mcp.ts` (değişmez: orders yok; `commerce` field guard).
- **Kabul:** §2.5 migration testi. Kopya DB'de `content:import --dry-run` 0 hata. `admin-labels.test.ts` yeşil. Site HTML'i değişmez (mode=quote). MCP araç listesi değişmez (69 ± 0).
- **Riskler:** Drizzle'ın kilit tablosu için `__new_` üretmesi → elle `ADD` ile değiştirilir. Enum ad uzunluğu.

### P3 — Mod kapısı ve görünürlük (1,5–2 gün)

- **Kapsam:** `getCommerceState`, admin hidden önbelleği, `EditionCard` + ürün hero CTA (resolver), fiyat gösterimi (sunucu Intl), JSON-LD `offers`, footer/legal link filtresi, `/yasal` satış sayfası 404'ü, sitemap, admin hazırlık `ui` alanı, edition revalidate doğrulaması. **Checkout yok**; ödeme modu açılsa bile "Satın al" henüz checkout'a gitmez (feature flag: `open` ayrıca `checkoutReady` ister, P5'te açılır).
- **Kabul:** quote modunda ekran görüntüsü farkı 0 (1440/390, TR/EN), HTML'de fiyat yok. Ödeme modunda (sandbox env) fiyat ve offers doğru, fail-to-quote matrisi e2e'de geçer. ISR HIT korunur.

### P4 — Sağlayıcılar, webhook, fulfillment (2,5–3 gün, **kritik**)

- **Dosyalar:** `src/lib/payments/providers/{stripe,iyzico}.ts`, `src/lib/payments/{sync,fulfill,events,reconcile}.ts`, `src/app/(payload)/api/payments/{stripe/webhook,iyzico/webhook,iyzico/callback}/route.ts`, `scripts/payments-reconcile.ts` + `package.json` script + `deploy/` systemd timer örneği, `src/lib/email/order-*.ts`, `.env.example`.
- **Kabul:** §6 DB ve imza testlerinin tamamı. Eşzamanlılık testi tek lisans üretir. Drain penceresi testi. Loglarda PII taraması (test, log yakalayıp regex ile e-posta/TCKN/anahtar arar) 0 sonuç verir.
- **Riskler:** iyzico tek aktif sağlayıcı (TRY/USD/EUR): kesintide checkout kapanır, `quote`'a düşer; pending siparişleri reconcile tamamlar. iyzico döviz yetkisi gelmezse USD/EUR fiyatları fail-to-quote ile gizlenir. SQLite yazma kilidi altında webhook patlaması (busy timeout 5000 ms + 500 → sağlayıcı yeniden dener). iyzico sync API gecikmesi. Fulfillment transaction'ı lisans afterChange e-postasını commit sonrasına bırakır (mevcut `after()` deseni korunur).

### P5 — Checkout UI, portal siparişleri, e-postalar (2 gün)

- **Dosyalar:** `src/app/(frontend)/[locale]/hesap/(portal)/satin-al/[sku]/page.tsx`, `.../siparisler/page.tsx`, `.../siparisler/[no]/page.tsx`, `src/lib/portal/checkout-actions.ts`, `src/lib/payments/contract.ts` (snapshot üretimi), `src/i18n/paths.ts` (EN segmentleri `checkout`, `orders`; RESERVED_SLUGS kendiliğinden), `messages/{tr,en}.json`, `csp.ts` (checkout form-action), `portal-nav` (koşullu "Siparişlerim").
- **Kabul:** izole e2e tam akış (sahte sağlayıcı). JS kapalıyken checkout çalışır (POST→303). Klavye ve ekran okuyucu ile onay kutuları erişilebilir. Bundle guard geçer. `checkoutReady` açılır.

### P6 — Yönetici işlemleri ve operasyon (1–1,5 gün)

- **Kapsam:** "İade et"/"İptal et" (admin, custom endpoint + admin bileşeni), iade → lisans `revoked`, chargeback → `suspended`, `requiresReview` uyarı e-postası, sipariş listesi filtreleri/kolonları, fatura no girişi, reconcile timer belgesi.
- **Kabul:** editor iade endpoint'ine 403, API key 403, admin oturumu 200. Sahte sağlayıcıyla iade e2e. Lisans portalda "iptal edildi" görünür.

### P7 — Yasal taslaklar ve KVKK (0,5–1 gün, P1'den itibaren paralel)

- **Dosyalar:** §5'teki 6 yeni + 4 güncellenen Markdown, `scripts/content-import` `--legal` eşlemesi (`commerceLegal`), `docs/editor-guide.md` satış bölümü.
- **Kabul:** `legal-draft.test.ts` yeni dosyaları taslak olarak tanır (noindex, sitemap dışı). Hazırlık doğrulaması production'da taslakla `payment`'ı reddeder. **Hukukçu onayı kullanıcıya bırakılır.**

### P8 — Bağımsız QA, güvenlik denetimi, sandbox kabulü, dokümantasyon (1,5–2 gün)

- **Kapsam:** sıfır bağlamla güvenlik denetimi (webhook, callback, IDOR, CSRF, CSP, MCP, log/PII, env sızıntısı, rate limit). Sandbox runbook'unun gerçek sağlayıcı test ortamlarında koşulması (kullanıcı anahtarları gelince). Perf ölçümü. `AGENTS.md` ("Satış ve ödeme" bölümü; "Online ödeme yok" ifadesinin "seçimli" olarak güncellenmesi), `projectbrief.md` kararı, `memory-bank`, `docs/payments/acceptance.md`.
- **Kabul:** kritik/yüksek bulgu 0. Sandbox senaryolarının tamamı yeşil. Quote modu yokluk testi yeşil. Kullanıcı onayı.

### Ajan dağılımı

| Faz | Yazan (effort) | Denetleyen (effort) | Not |
|---|---|---|---|
| P0 doğrulama | GPT 6.1 Terra (High) | Claude Opus 5.5 (Medium) | Odaklı teşhis; madde listesi kısa görevlere bölünür |
| P1 saf çekirdek | Claude Opus 5.5 (Medium) | GPT 6.1 Sol (High) | Fixture ve durum tablosu Sol'un denetiminde |
| P2-S şema + migration | GPT 6.1 Sol (High) | Claude Opus 5.5 (Medium) | Net migration görevi. Down koruması ve kilit tablosu SQL'i satır satır denetlenir |
| P3 mod kapısı (çekirdek) | Claude Opus 5.5 (Medium) | GPT 6.1 Sol (High) | |
| P3 kart/hero görseli | Claude Sonnet 5.5 (Medium) | GPT 6.1 Terra (High) | Görsel eşdeğerlik + ISR |
| **P4 sağlayıcı/webhook/durum makinesi/fulfillment** | **Claude Opus 5.5 (High)** | GPT 6.1 Sol (High) + GPT 6.1 Terra (High, güvenlik) | Planın tek Opus High noktası. Terra'ya kısa, odaklı denetim görevleri verilir |
| P5 checkout/portal UI | Claude Sonnet 5.5 (Medium) | GPT 6.1 Sol (High) | Server action ve snapshot üretimi Opus Medium yazar, Sol High denetler |
| P6 yönetici işlemleri | Claude Opus 5.5 (Medium) | GPT 6.1 Sol (High) | Yetki matrisi testleri |
| P7 yasal taslak + kılavuz | Claude Haiku 5.5 (Low) | Claude Opus 5.5 (Medium) içerik eşlemesi + **hukukçu** | Hukuki onay kullanıcıda |
| P4–P6 testleri / e2e sahte sağlayıcı | GPT 6.1 Sol (Medium) | Claude Opus 5.5 (Medium) | |
| P8 güvenlik denetimi | GPT 6.1 Terra (High) | Claude Opus 5.5 (Medium) | Sıfır bağlam. Kısa denetim parçaları: webhook, IDOR, CSP, MCP |
| P8 sandbox kabul + perf | GPT 6.1 Sol (High) | Claude Opus 5.5 (Medium) | Gerçek sandbox anahtarlarıyla |
| Dokümantasyon + memory-bank | Claude Haiku 5.5 (Low) | GPT 6.1 Sol (Medium) | |
| Faz sonu commit | Claude Haiku 5.5 (Low) | — | Yalnız QA yeşilken |

Tahmini toplam: **11–14 iş günü** (P0/P1/P7 pilotlarla paralel yürürse takvimde ~8–10 gün).

---

## 9. Kullanıcıdan gerekenler

**Girdiler (P4 öncesi):**
1. iyzico sandbox üye işyeri API key/secret (ve live başvuru durumu, USD/EUR yetkisi).
2. ~~Stripe test anahtarları~~ **Gerekmez** (P0: TR desteklenmiyor; Stripe varsayılan kapalı). Yalnız yurt dışı tüzel kişilik kurulursa test anahtarları + webhook secret istenir. Bunun yerine iyzico'dan **USD/EUR üye işyeri yetkisi** gerekir.
3. Şirket bilgileri: ticaret unvanı, MERSİS, vergi dairesi/no, adres, KEP, telefon, e-posta; ETBİS kaydı.
4. Fiyat listesi (sürüm × para birimi), KDV dahil/hariç tercihi, KDV oranı; e-arşiv faturayı kimin/hangi sistemle keseceği.
5. İade politikası (tam iade süresi, kurumsal istisnalar) ve hukuk danışmanı onay süreci.
6. Çalışan SMTP (sipariş/sözleşme e-postası için zorunlu; konsol adaptörüyle satış açılmaz).

**Açık sorular (en fazla 4):**
- **S1 KDV — yurt dışı satış:** USD/EUR ile yurt dışındaki müşterilere satışta KDV uygulanacak mı, yoksa hizmet ihracatı istisnası mı (mali müşavir)? Öneri: sürümdeki `vatRate` para birimi başına ayrılmaz; istisna gerekiyorsa P2-S'ye `pricing.vatExemptForeign` eklenir.
- **S2 Satın al sürümünde ikincil "Kurumsal teklif iste" bağlantısı kalsın mı?** Öneri: evet (çoklu koltuk/kurumsal fatura talepleri için).
- **S3 Yalnız teklif moduna geçince:** 72 saatlik webhook drain penceresi ve geçmiş siparişi olan müşteriye portalda salt-okunur "Sipariş geçmişi" (sözleşme kopyası erişimi için) kabul mü? Öneri: ikisi de evet. Hayır denirse geçmiş, kapalı modda tamamen gizlenir; veri silinmez.
- **S4 Alıcı kitlesi:** bireysel (tüketici) satış da olacak mı, yoksa yalnız kurumsal (VKN) mı? Bireysel satış cayma istisnası onayını, TCKN toplamayı ve tüketici metinlerini zorunlu kılar; yalnız kurumsal ise akış ve metinler sadeleşir.

## Kullanıcı kararları (2026-11-08)

- **S1 KDV:** muhasebeci karar verecek — admin'de para birimi başına KDV oranı + "istisna" seçeneği; varsayılan boş (ödeme modu, KDV ayarı yapılmadan açılamaz).
- **S2:** "Satın al" sürümlerinde ikincil **"Kurumsal teklif iste"** bağlantısı görünür.
- **S3:** Teklif moduna geçişte **güvenli geçiş**: yeni satış hemen kapanır; sağlayıcı webhook'ları 72 saat işlenmeye devam eder; müşteriler eski siparişlerini portalda salt-okunur görür.
- **S4:** **Hem bireysel (TCKN) hem kurumsal (VKN)** satış; bireysel satışta cayma hakkı metni ve dijital içerik istisnası onayı zorunlu.

### P1 denetim sınırları

- `planFulfillment` saf bir plandır, tek başına eşzamanlı lisans üretimini engellemez. Uygulama aynı SQLite bağlantısında okumadan önce `BEGIN IMMEDIATE` almalı; lisans, kalem bağlantısı ve durum geçişini aynı transaction'da yazmalı, koşullu bağlantı veya geçiş başarısızsa tümünü geri almalı ve yan etkileri commit sonrasına bırakmalıdır. Henüz store uygulaması veya yarış testi yoktur.
- iyzico retrieve imzası `fraudStatus` ve `installment` alanlarını kapsamaz; bunlar doğrulanmış HTTPS yanıtından okunur. Initialize imzası da yönlendirme URL'sini kapsamaz; TLS ve host kontrolü gereklidir. Sağlayıcı yönlendirmeleri HTTP istemcisinde reddedilir.
- iyzico iade isteğinde sağlayıcıya aktarılmış bir idempotency anahtarı yoktur; zaman aşımından sonra kör tekrar çift iade riski taşır. P4, yeniden denemeden önce sağlayıcı durumu ile uzlaştırma ve atomik işlem kilidi uygulamalıdır.
- 256 KiB sınırı alınmış string üzerinde uygulanır; gelecekteki HTTP handler ham gövdeyi okumadan önce/akış sırasında da sınırlandırmalı ve imzayı değişmemiş baytlarla doğrulamalıdır. Sandbox/canlı iyzico uçtan uca testi yapılmadı.
