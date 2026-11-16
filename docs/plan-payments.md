# Plan — Seçimli Online Ödeme ("Teklif iste" / "Ödeme al")

> Durum: **P3 mod kapısı ve görünürlük bağımsız QA geçti (2026-11-16, açık ödeme yüzeyleri no-store, şemasız, checkout yok)**; **P1 şemasız çekirdek yazıldı**; **P4 webhook/callback/sync/fulfill/reconcile yazıldı (2026-11-16, şemasız, QA bekliyor, checkout hâlâ kapalı)**; **P2-S şema + store yazıldı (2026-11-16, QA bekliyor, canlı DB'ye uygulanmadı)**: migration `20261116_141401_p2_payments_commerce`, `orders`/`payment-events`, `editions.saleMode/pricing`, `site-settings.commerce.{mode,providers,vat,quoteSince}`, `src/lib/payments/store/**`. Rota/UI/webhook yok (P3–P5).
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

> Bu bölüm teknik uygulama içindir; hukuki görüş değildir. Metinlerin tamamı **taslak** olarak eklenir ve hukuk danışmanı onayı olmadan yayınlanmaz (hazırlık doğrulaması taslak işaretlerini ve eksik içerikleri engeller; hukukçu onayını teknik olarak doğrulamaz).

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
- **Uygulandı (2026-11-16):** tek yazım `quote-only|payments` ve `quote|buy` (takma adlar kaldırıldı, okumada da quote). Fiyat alanları `pricing.{taxMode,tryMinor,usdMinor,eurMinor}` (tam sayı minor unit; admin şimdilik kuruş girer). KDV para birimi başına `commerce.vat.{try,usd,eur}.{rule,ratePercent,rateBasisPoints}` (admin yüzde girer, hook baz puanı yazar; çekirdek `readVatSettings` yalnız tutarlı baz puanı okur). Yeni alanlar yalnız staff okur (public HTML aynı), yalnız panel admin yazar (API key/MCP sessizce düşer; edition fiyatı admin MCP ile yazılabilir), `custom.contentImport:false` ile seed şemasında yok. S2 için ayar eklenmedi (karar sabit davranış). `pages.commerceLegal` ve hazırlık doğrulamasının yasal/şirket/SMTP maddeleri P3/P7'ye kaldı; mod doğrulaması şimdilik yetenek + açık sağlayıcı + en az bir KDV kuralı ister.

### P3 — Mod kapısı ve görünürlük (1,5–2 gün)

- **Kapsam:** `getCommerceState`, admin hidden önbelleği, `EditionCard` + ürün hero CTA (resolver), fiyat gösterimi (sunucu Intl), JSON-LD `offers`, footer/legal link filtresi, `/yasal` satış sayfası 404'ü, sitemap, admin hazırlık `ui` alanı, edition revalidate doğrulaması. **Checkout yok**; ödeme modu açılsa bile "Satın al" henüz checkout'a gitmez (feature flag: `open` ayrıca `checkoutReady` ister, P5'te açılır).
- **Kabul:** quote modunda ekran görüntüsü farkı 0 (1440/390, TR/EN), HTML'de fiyat yok. Ödeme modunda (sandbox env) fiyat ve offers doğru, fail-to-quote matrisi e2e'de geçer. ISR HIT korunur.
- **Uygulandı (2026-11-16, P3 uygulama kaydı; commit yok, şema/migration yok, canlı DB'ye yazılmadı):**
  - **Mod kapısı:** saf `src/lib/payments/commerce-state.ts` (`computeCommerceState`) + sunucu yükleyici `src/lib/commerce/state.ts` (`getCommerceState`, React `cache`). `open` = env `PAYMENTS_ENABLED=true` VE `site-settings.commerce.mode='payments'` VE en az bir sağlayıcı (ayarda açık + env'de tanımlı) VE en az bir para biriminde geçerli KDV kuralı. `checkoutOpen = open && checkoutReady`; `checkoutReady` `src/lib/payments/flags.ts` içinde sabit `false` (P5 açar). Env capability yoksa DB'ye hiç dokunulmaz (kurulu quote sitesinde ek sorgu 0); okuma hatası kapalı duruma düşer. `legalReady` (üç satış metni yayında/taslak değil) `open`'a P7 ile katılır; şimdilik yalnız admin hazırlık listesinde raporlanır.
  - **Sürüm eylemi:** saf `src/lib/payments/actions.ts` `resolveProductActions` (`resolveEditionOffer` üzerine). `quote` eylemi bugünkü kartı BİREBİR verir (dondurulmuş eski bileşenle test). `buy` yalnız geçerli fiyatlı teklifte, `open` iken: fiyat (sunucuda `Intl.NumberFormat`, girdi tam ondalık string; dil başına başlık para birimi TR=TRY, EN=USD; KDV dahil/hariç/istisna etiketi) + "Satın al" + S2 ikincil "Kurumsal teklif iste". `checkoutReady` kapalıyken "Satın al" **devre dışı düğme** (href yok, `aria-disabled`, "yakında" notu), checkout linki HTML'de yoktur; hero birincil eylemi "Teklif İste" kalır. Flag açık olunca düğme `/hesap/satin-al/<SKU>` (P5 rotası) linki olur ve hero birincil "Satın al" olur. "Teklif İste" her durumda görünür (V2 zorunlu blok korunur).
  - **Veri:** `editions.saleMode/pricing` staff-only okuma olduğundan `getProductDetail` fiyatı yalnız `open` iken `overrideAccess` ile aynı edition sorgusunda okur (sorgu sayısı artmaz), çözülen eylemlerle birlikte ham alanları atar; sayfa/bloklar yalnız `commerce` eylemlerini görür. Quote modunda sorgu bugünküyle aynı (anon, aynı select).
  - **JSON-LD:** `src/lib/payments/json-ld.ts`: yalnız `buy` eylemli sürümler için Offer (sürüm × para birimi, fiyat sayfadakiyle aynı, `valueAddedTaxIncluded`); quote modunda `offers` anahtarı yok.
  - **Yasal satış sayfaları (şemasız):** `src/lib/payments/legal.ts` slug sabiti (TR: `mesafeli-satis-sozlesmesi`, `on-bilgilendirme-formu`, `iade-ve-cayma`; EN: `distance-sales-agreement`, `pre-information-form`, `refund-and-withdrawal`). `open` değilken: `/yasal/<slug>` 404 (staff draft önizlemesi hariç), sitemap'ten çıkar (`src/app/sitemap.ts`), footer/header linkleri `resolvePublicLink` içinde düşer. Açıkken görünür; `isLegalDraft` noindex/sitemap kuralı aynen geçerli. **Şema önerisi (kullanıcı onayı bekliyor):** plan §5'teki `pages.commerceLegal` select alanı (`distanceSales|preInformation|refund`, `index`) slug listesinin yerine geçer; böylece slug değişse de eşleşme bozulmaz ve hazırlık doğrulaması "üç tür yayında mı" diye kesin sorabilir. Migration gerektirir (tek `ADD COLUMN`), bu faz eklemedi.
  - **Admin:** site-settings "Satış ve ödeme" bölümüne salt okunur `ui` alanı `readiness` (`src/admin/fields/commerce-readiness.tsx`, `src/lib/payments/readiness.ts`): env, sağlayıcı anahtarı, sağlayıcı açık, KDV, fiyatlı buy sürüm, yasal sayfalar (3/3), SMTP, checkout; SANDBOX/LIVE rozeti; gizli değer yok; yalnız admin görür. `ui` alanı şema üretmez: kopya DB'de `pnpm migrate:create` "No schema changes detected" (kanıt). Fiyat girişi: `src/admin/fields/price-minor-field.tsx` (ondalık kutu, `1.250,00` TR / `1,250.00` EN, virgül/nokta toleranslı, saf string/tamsayı ayrıştırma `src/lib/payments/price-input.ts`; saklama aynı `tryMinor/usdMinor/eurMinor`; geçersiz metin -1 yazar, doğrulayıcı reddeder). Etiketler TR/EN (`Editions.ts`).
  - **Revalidate:** edition (withPublicRevalidation) ve site-settings (withGlobalRevalidation) kaydı `revalidatePath('/', 'layout')` çağırır (testli); ISR HIT korunur (sayfada `headers()`/`cookies()` yok; quote modunda ek DB okuması yok).
  - **Doğrulama (2026-11-16):** typecheck/lint temiz; `pnpm test --maxWorkers=1` 78 dosya / 1313 test geçti (yeni 3 dosya, 96 test). İzole build (`.next-p3`, kopya DB): quote modunda 16 ürün sayfası (TR/EN) + ana sayfa + liste + teklif-iste, HEAD (7beb228) build'iyle script/hash gürültüsü hariç DOM + JSON-LD birebir aynı (21/21); ödeme modu (kopya DB + env) fiyat/KDV etiketi/devre dışı Satın al/S2 linki/offers doğru, checkout linki 0, ISR HIT, anonim REST/GraphQL'de commerce değeri yok. Lighthouse ürün sayfası (ödeme modu, 3 koşu medyan): Perf 100, LCP ~1,05 sn mobil, CLS 0, JS ~129,6 KB (HEAD ile aynı).
  - **Testler:** `tests/unit/payments-p3.test.ts` (saf: durum matrisi, fail-to-quote, fiyat biçimi, JSON-LD, slug, hazırlık, fiyat girişi, bundle sınırı), `payments-p3-render.test.tsx` (quote HTML = dondurulmuş eski kart, sayfa HTML'i quote verisiyle değişmez, ödeme modu TR/EN, flag açık), `payments-p3-db.test.ts` (geçici SQLite, tüm migration'lar: mod başına ürün verisi, anonim Local API/REST/GraphQL sızıntı yok, footer/`/yasal`/sitemap, revalidate).


#### P3 bağımsız güvenlik/kalite denetimi — 2026-11-16

- **P0:** saptanmadı. **P1 (düzeltildi):** açık ödeme HTML/RSC'si ISR'a yazılıyordu; aynı production çıktısı `PAYMENTS_ENABLED=false` ile ürün fiyatını ve satış yasal sayfasını `HIT / 200` döndürdü. `getCommerceState` açık yüzeylerde `unstable_noStore()` kullanır; Next statik-render sinyali DB/content hata yakalayıcılarının dışında kalır. **Ödeme yüzeylerinde ISR HIT kabulü güvenlik nedeniyle kaldırıldı; teklif modunda ISR korunur.** Root/sitemap revalidation ve `quoteSince` kancası ayrıca testli.
- **P2 (düzeltildi):** aynı origin'e mutlak ve normalize edilen yasal URL'ler header/footer filtresini geçiyordu; URL normalizasyonu + origin eşlemesi eklendi. Geçersiz fiyat metni form reset'inden sonra kalıyordu; dış değer değişikliği hata durumunu temizler. Hazırlık listesi fiyat/KDV/sağlayıcı uyumsuzluğunu hazır sayıyordu; gerçek teklif çözümleyicisiyle doğrulanır. Ortam rozeti kapalı sağlayıcıyı seçiyordu; yalnız açık/yapılandırılmış sağlayıcıları gösterir, test/canlı birlikteyse KARMA der.
- **P3 (rapor):** slug listesi kalıcı belge türü değildir; satış sayfasının slug'ı liste dışında yeniden adlandırılırsa otomatik tanınmaz. `pages.commerceLegal` alanı önerisi sonraki fazda duruyor; bu denetimde şema değiştirilmedi.
- Anonim Local API/REST/GraphQL commerce/fiyat değerlerini döndürmedi. Açık modda anonim ürün okuması yayınlı kaldı; draft çerezi tek başına ürün/yasal taslağı açmadı; staff önizlemesi çalıştı. Editions koleksiyonunda draft/yayın durumu yoktur. Ham `saleMode/pricing` frontend verisinden çıkarılıyor; ayrıcalıklı edition sorgusu depth 0 + açık alan seçimiyle sınırlı.
- Fiyat ayrıştırma/biçimleme sınırları (TR/EN binlik, negatif/0/üst sınır, unicode/üstel/geçersiz giriş), sunucuda `-1` reddi, KDV etiketleri, offers ve native disabled buy markup kontrol edildi. Eski kart fixture'ı gerçek render çıktısını bayt bayt karşılaştırıyor; tam sayfa testi aynı renderer'ın commerce var/yok dallarını karşılaştırır.
- Ek regresyonlar: `payments-p3-cache.test.ts`, `payments-p3-price-field.test.tsx`; mevcut saf/SQLite testleri genişletildi. İzole production render: açık mod 200 + fiyat, DB quote ve env off durumlarında ürün 200 + fiyat yok / satış yasal sayfası 404 (6/6); ayrı quote build ürün/ana sayfa HIT 200 + fiyat yok, satış yasal HIT 404 (3/3). Sandbox TCP dinlemeyi engelledi; Next production handler'ı soket açmadan çalıştırıldı. Tarayıcı/Lighthouse yeniden çalıştırılmadı.
- **Son kapılar:** `pnpm typecheck` ve `pnpm lint`: 0 hata; `pnpm test --maxWorkers=1`: **80 dosya / 1339 test, 0 başarısız (296 sn)**. Son kodla açık/quote iki izole `.next-p3-qa` build başarılı, production render **9/9**, `git diff --check` temiz. Geçici build/scratchpad/DB silindi, `tsconfig.json` geri alındı. Canlı DB/3100/`.next`/`memory-bank/techContext.md` korunuyor; commit yok. **P3 commit edilebilir: EVET.**

### P4 — Sağlayıcılar, webhook, fulfillment (2,5–3 gün, **kritik**)

- **Dosyalar:** `src/lib/payments/providers/{stripe,iyzico}.ts`, `src/lib/payments/{sync,fulfill,events,reconcile}.ts`, `src/app/(payload)/api/payments/{stripe/webhook,iyzico/webhook,iyzico/callback}/route.ts`, `scripts/payments-reconcile.ts` + `package.json` script + `deploy/` systemd timer örneği, `src/lib/email/order-*.ts`, `.env.example`.
- **Kabul:** §6 DB ve imza testlerinin tamamı. Eşzamanlılık testi tek lisans üretir. Drain penceresi testi. Loglarda PII taraması (test, log yakalayıp regex ile e-posta/TCKN/anahtar arar) 0 sonuç verir.
- **Riskler:** iyzico tek aktif sağlayıcı (TRY/USD/EUR): kesintide checkout kapanır, `quote`'a düşer; pending siparişleri reconcile tamamlar. iyzico döviz yetkisi gelmezse USD/EUR fiyatları fail-to-quote ile gizlenir. SQLite yazma kilidi altında webhook patlaması (busy timeout 5000 ms + 500 → sağlayıcı yeniden dener). iyzico sync API gecikmesi. Fulfillment transaction'ı lisans afterChange e-postasını commit sonrasına bırakır (mevcut `after()` deseni korunur).
- **Uygulandı (2026-11-16, P4 uygulama kaydı; commit yok, şema/migration yok, canlı DB'ye yazılmadı, gerçek sağlayıcıya istek yok):**
  - **Rotalar** (`src/app/(payload)/api/payments/{iyzico/webhook,iyzico/callback,stripe/webhook}/route.ts`, yalnız POST, `nodejs`, `force-dynamic`; bağlama `src/lib/payments/route.ts`). Env yeteneği yoksa Payload/DB'ye dokunmadan 404. Stripe adaptörü kapalıyken (`PAYMENTS_STRIPE_ENABLED` ≠ true) 404. `/api` middleware matcher dışında olduğundan Server Action origin guard'ı ve sayfa CSP'si bu rotalara uygulanmaz (testli); origin guard yalnız `Next-Action` başlıklı POST'u ilgilendirir.
  - **Akış:** `events.ts` `handleProviderWebhook` → drain penceresi (`readWebhookWindow` = `isWebhookProcessingAllowed`, her istekte DB) → ham gövde `body.ts` `readLimitedBody` (256 KB, akış okunurken sayılır, aşımda akış iptal; küçük/eksik Content-Length'e güvenilmez, büyük beyan erken ret; katı UTF-8, BOM korunur; Stripe imzası ham baytların UTF-8 karşılığı, iyzico imzası sağlayıcının imzalı alanları üzerinde) → P1 `verifyWebhook` → sipariş arama (providerRef → orderNumber → providerPaymentId) → `PaymentEventStore.record` (eventKey) → `sync.ts` `syncOrderFromProvider`: sağlayıcıdan sunucu tarafı `retrieve` (transaction DIŞINDA) → BEGIN IMMEDIATE içinde taze okuma + `decideFromProvider` + koşullu `UPDATE … WHERE status = from` (+ confirm) → sipariş `paid` ve inceleme yoksa `fulfill.ts` `fulfilPaidOrder` (tek transaction, tek lisans; P2-S `fulfillOrder`) → commit + confirm SONRASI `deps.defer` (route'ta `after()`) ile `src/lib/email/order-confirmation.ts` (TR/EN, sipariş dili). İnceleme (tutar/para birimi/referans uyuşmazlığı, geç ödeme) → `requiresReview`, lisans yok, `order-review.ts` personel uyarısı (`PAYMENTS_ALERT_EMAIL`; yoksa yalnız log).
  - **Yanıtlar:** yetenek kapalı/adaptör yok → 404. Pencere içi: >256 KB 413, geçersiz UTF-8/imza 400 (boş gövde). Tekrarlanan olay 200 (sağlayıcıya ikinci çağrı yok). Bilinmeyen sipariş → `ignored`/`unknown_order`, 200. Retrieve/DB hatası (`SQLITE_BUSY`, kuyruk zaman aşımı dahil) → olay `error` + 500 → sağlayıcı yeniden dener, sonraki teslim yeniden işlenir.
  - **Drain kararı (S3, plan §1.4 ile tutarlı):** pencere dışında imzasız/bozuk/büyük istek **404** (kapalı yüzey yokmuş gibi görünür). Pencere dışında **imzası geçerli** olay sağlayıcıya sorulmadan `ignored`/`drain_closed` kaydedilir ve **200** döner (sağlayıcı tekrar denemez, geç bildirim personelce görülür). `quote-only` + boş `quoteSince` = kapalı. Callback pencere dışında 404.
  - **Callback** (`handleIyzicoCallback`): yalnız `token` (form, 16 KB sınır) okunur, gövdedeki durum yok sayılır; oturum aranmaz. Token yok/bozuk → statik iki dilli hata sayfası (400, `no-store`, `noindex`, `default-src 'none'`, girdi yansıtılmaz). Biçimi geçerli token bilinse de bilinmese de 303 `/tr/hesap`; sipariş numarası yönlendirmede yok. Bilinen token sağlayıcıdan doğrulanır; zamanlama farkı kalabilir.
  - **Reconcile** (`reconcile.ts`, `pnpm payments:reconcile [--dry-run] [--limit=N]`, `scripts/payments-reconcile.ts`, `deploy/payments-reconcile.{service,timer}` 15 dk): 5 dk'dan eski pending → sync; 60 dk sonra doğrulanmış pending → `cancelled`/`expired`; providerRef'siz → `checkout_not_started`; doğrulanmamış sağlayıcı iş hatası dahil hiçbir sağlayıcı hatası iptal kanıtı değildir ve hata olarak tekrar denenir. Koşullu iptal inceleme işaretini ve değişen referansı korur. İnceleme dışı `paid` (yarıda kalmış fulfillment) → lisans. Dry-run yalnız sağlayıcı okur, DB/e-posta yazmaz. Yetenek kapalıyken no-op. Mod teklif'e dönse de çalışır.
  - **Denetimde açık kalan (KAPANDI, aşağıda "Bildirim kalıcılığı"):** lisans atama hook'u istek dışı CLI'de `after()` zamanlayamıyordu; commit sonrası süreç kapanırsa sipariş e-postası kaybolabiliyordu.
  - **Bildirim kalıcılığı (2026-11-16, commit yok):** migration `20261116_175713_p4_order_notifications` (yalnız 7× `ALTER TABLE orders ADD`, nullable; down 7× `DROP COLUMN`, indeks yok). `orders.notifications` grubu (staff okur, kimse yazamaz, admin readOnly): `confirmationSentAt`, `licenseSentAt`, `reviewAlertSentAt`, `attempts`, `lastError` (kısa kod: `smtp_error|no_recipient|no_license|internal`), `nextAttemptAt`, `leaseUntil`. `src/lib/payments/notify.ts` `deliverOrderNotifications`: (1) tek koşullu UPDATE ile sipariş başına 5 dk lease (boş/süresi dolmuş, `attempts < 5`, bekleme geçmiş) — eşzamanlı ikinci gönderici 0 satır alır ve durur; (2) commit edilmiş siparişi okur, bekleyen her mesajı gönderir, her başarıdan sonra `WHERE <alan> IS NULL` ile işaretler; (3) lease'i bırakır; hata → `attempts+1`, `lastError`, `nextAttemptAt` = 15·2^(n−1) dk. SMTP yoksa (uyarıda `PAYMENTS_ALERT_EMAIL` yoksa) atlanır, sayılmaz (konsol adaptörü alıcı/anahtar loglar). Tetikler: fulfil ve review işaretinin `afterCommit` → `deps.defer` (istekte `after()`, CLI'de hemen + beklenir) ve reconcile'ın son "notify" fazı (≤7 gün yaşlı siparişler; `--dry-run` yalnız `pending:<türler>` listeler; gönderim hatası `error notify_<kod>` → exit 1). Lisans e-postası: fulfillment lisansları `ORDER_FULFILMENT_CONTEXT` bağlamıyla oluşturur, `licenses` afterChange hook'u bunları atlar; siparişin tüm lisansları kuyruktan **tek** e-postayla gider (`sendOrderLicenses`, sipariş dili). Admin/MCP ile elle atanan lisans hook'u `after()` ile eskisi gibi (tek e-posta). Yeni inceleme dönemi (`requires_review` 0→1) `reviewAlertSentAt`'ı sıfırlar. Garanti: en az bir kez; yalnız başarılı gönderim ile işaret yazımı arasında süreç ölürse (ya da gönderim 5 dk lease'i aşarsa) bir tekrar olası. Kopya DB: migrate + `integrity_check ok` + `content:import --dry-run` 0 hata; canlı DB'de 0 sipariş (geri doldurma gerekmez). Canlı sıra: `sqlite3 data/softmarket.db ".backup <yedek>"` → `pnpm migrate` → `PRAGMA integrity_check` → süreci yeniden başlat. Testler: `payments-p4-db.test.ts` +7 (CLI reconcile tek lisans e-postası + tekrar yok; webhook + reconcile tek; hata→işaret yok→bekleme→yeniden deneme→5'te bırakır; 3 eşzamanlı gönderici → tek; SMTP yok → atla/sayma; personel uyarısı tek; elle atama hook tek), `payments-p4n-db.test.ts` (migration up/down veri koruma); log PII taraması bunları kapsar.
  - **Kararlar:** (1) **`server-only` paketi eklenmedi:** paket kurulu değil ve `react-server` koşulu dışında (tsx CLI, vitest) import anında hata fırlatır; reconcile CLI'yi ve testleri kırar. Yerine `payments-p4.test.ts` istemci import grafiğini (`'use client'` kökleri, `'use server'` sınırında durarak) geçişli tarar: yalnız saf `price-input/money/types` erişilebilir; `lib/email`, `lib/commerce`, rota ve P4 sunucu modülleri asla. P4 modüllerini yalnız payments/e-posta/rota dosyaları import eder. (2) **SMTP yokken sipariş e-postası atlanır** (plan §4.5; konsol adaptörü alıcıyı ve gövdeyi loglar), yalnız sipariş no loglanır. (3) Admin'deki sağlayıcı aç/kapa yalnız yeni checkout'u yönetir; webhook/reconcile env'de yapılandırılmış adaptörle çalışır (açık siparişler kapatma sonrası da tamamlanır). (4) `createCheckout` P5'te server action'a bağlanacak; bu fazda hiçbir rota checkout başlatmaz, `CHECKOUT_READY=false` değişmedi.
  - **Testler:** `tests/unit/payments-p4.test.ts` (10: akış sınırı, client graph, middleware/origin, yetenek kapalı rotalar 404), `tests/unit/payments-p4-db.test.ts` (17, geçici SQLite + tüm migration'lar, sahte sağlayıcı fetch): imza geçerli/sahte/kurcalanmış/eksik/aşırı büyük, Stripe kapalı 404 + 301 sn replay + bozuk v1; aynı olay 2× → tek lisans; eşzamanlı 3 webhook + 2 callback → tek lisans; tutar ve para birimi uyuşmazlığı → review, lisans yok; fraud review/ret; drain içi/dışı/boş quoteSince; ağ/zaman aşımı/iş hatası → 500 + `error`, sipariş değişmez, sonra işlenir; `SQLITE_BUSY` → 500 → tekrar başarılı; callback hata sayfası/303; reconcile dry-run/gerçek/tekrar/geç ödeme; e-posta commit sonrası tek sefer + SMTP yok atlama; log PII taraması (e-posta, 10–11 haneli TCKN/VKN, lisans anahtarı, sağlayıcı sırları) = 0. Mutasyon kontrolü: drain dalı ve log'a e-posta eklemek ilgili testleri kırdı.
  - **Açık (sandbox/P6'da doğrulanacak):** iyzico sandbox'ta CF webhook gövdesi/alan adları ve `iyziEventType` değerleri, terk edilmiş/süresi geçmiş token için retrieve yanıtı (`expired_unverified` varsayımı), `INIT_*` ara durumları, USD/EUR yetkisi ve `VIRTUAL` sepet; iyzico webhook tekrar politikası (200 dışı yanıtlara kaç kez/ne aralıkla). Stripe yalnız oturum olaylarını eşler; `charge.refunded`/dispute olayları siparişe bağlanır ama oturum retrieve iadeyi göstermez (P6). Sağlayıcıdan `refunded` gelince lisans iptali (`revoked`) P6'da. iyzico iadesinde idempotency anahtarı yok: P6 iade işlemi kör tekrar yapmamalı, önce retrieve ile uzlaştırmalı (adaptör kendisi asla tekrar denemez). Reconcile CLI'de lisans e-postası `after()` dışında kaldığı için atlanır (lisans portalda görünür; sipariş onay e-postası gider). Gerçek iki süreçli (web + CLI) SQLite yarışı yalnız `busy_timeout` 5000 ms + koşullu yazımla korunur; testte aynı süreç kuyruğu kullanıldı.

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

## P7 + commerceLegal kaydı (2026-11-16)

- **Şema:** `pages.commerceLegal` select (`distanceSales|preInformation|refund`), yan panel, yalnız `pageType: legal` iken görünür, localized değil, `unique` + index. `beforeValidate` kancası: tür başına tek sayfa (yerelleştirilmiş `ValidationError`), `legal` dışı türde değer null'lanır. Duplicate değeri boşaltır. Migration `20261116_155928_p7_commerce_legal`: `pages.commerce_legal` + `pages_commerce_legal_idx` (UNIQUE), `_pages_v.version_commerce_legal` + indeks; yalnız ADD COLUMN/CREATE INDEX, down DROP INDEX + DROP COLUMN (yeniden oluşturma yok).
- **Tanıma:** `src/lib/payments/legal.ts` önce alana bakar (`isCommerceLegalPage`). P3 slug sabiti yalnız alan boşken geri uyumluluk yedeğidir (gizli kalmasını sağlar, "hazır" saymaz); sitemap girişleri `commerce` bayrağı, footer/header sayfa referansı `commerceLegal` ile süzülür; mutlak/normalize URL filtresi aynı.
- **legalReady:** `evaluateLegal`: üç tür, TR ve EN, yayında ve `isLegalDraft` değil. `computeCommerceState({ legalReady })` `open` koşuluna dahil (verilmezse false, fail-closed). Yükleyici yasal sayfaları yalnız diğer katmanlar açıkken okur; okuma hatası kapalı durum. Hazırlık listesi `legal` satırı `ready`'yi de kapılar. Site ayarı `validate`'ine eklenmedi (kapı `open` seviyesinde).
- **Metinler:** 6 yeni (TR/EN mesafeli satış, ön bilgilendirme, iade/cayma) + 5 güncelleme (KVKK, gizlilik, çerez, kullanım koşulları, EULA); EN dosya adları TR ile aynıdır (loadLegal şartı), bu nedenle P3'teki EN slug adları fiilen oluşmaz (yalnız yedek). `--legal` dosya adından `commerceLegal` yazar.

## P7 bağımsız güvenlik/kalite denetimi — 2026-11-16

- P1 düzeltildi: `readLegalFacts` EN sorgusunda TR fallback kabul ediyordu; boş/gizli layout da hazır sayılıyordu. Fallback kapalı; her dilde başlık, slug ve görünür richText gövdesi zorunlu. Açık yüzeyler hâlâ no-store; teklif ISR davranışı korunuyor.
- P1 düzeltildi: TASLAK bandı kaldırılınca `/`, `:`, uzun tire ve küçük harfli açıklama içeren yer tutucular (`[VERGİ DAİRESİ/NO]`, `[HUKUK İNCELEMESİ: …]`) kaçıyordu; noindex/sitemap ve legalReady aynı genişletilmiş algılayıcıyı kullanır.
- P2 düzeltildi: eşzamanlı iki son taslak aynı commerceLegal türünü alabiliyordu. Aynı transaction içinde yayınlı kayıt ve son taslak kontrol edilir; draft/autosave'da enum da doğrulanır, boş ve legal dışı tür NULL olur. SQLite UNIQUE indeks ana kayıtta yarışın son sınırıdır; çoklu NULL doğrudur, geçmiş sürümlerde UNIQUE olmaması gereklidir. Duplicate ve sürüm geri yükleme testlidir.
- P2 düzeltildi: yeniden adlandırılmış satış metinlerinin route/aynı-origin mutlak URL bağlantıları teklif modunda kalıyordu. Yerel yasal hedef mevcut sayfadan çözülür (hata = gizli); referans bağlantıları için Payload SQLite'ın üst grup projeksiyonunda düşürdüğü polymorphic ilişki alanları açıkça seçilir. Header/footer, 404, sitemap, açık moda dönüş regresyonları var.
- P2 düzeltildi: legal kaynakları symlink dosya/dizin izleyip özel dosyayı içeriğe dönüştürebiliyordu; kanonik dizin ve normal dosya sınırı eklendi. `--legal` yayınlama/upsert davranışı korunur ve kılavuzda mevcut onaylı metni ezme riski açıklanır.
- Metin tutarlılığı: TR/EN bölüm numaraları eşit; tüm köşeli yer tutucular taslak algılamasına girer. EULA satış bölümü iki dilde koşullu yapıldı; KVKK sipariş saklama cümlesindeki çelişki iki dilde giderildi. Ödeme aktarımı/saklama ifadelerinde diller arası çelişki ve uydurma kişi/şirket bilgisi bulunmadı. Hukuki doğruluk incelemesi yapılmadı.
- P3 (süreç sınırı): bant/yer tutucu temizlemek hukukçu onayını kanıtlamaz. Kayıtlı bir hukukçu onay mekanizması yok; teknik kontrol yalnız içerik işaretlerini doğrular. Kılavuz ve planın aksi yöndeki iddiası düzeltildi; onayın alınması yayın sorumlusundadır.
- Migration dosyası değişmedi: iki nullable sütun + iki indeks, up/down/veri koruma testi geçer. Kurulu libSQL SQLite **3.45.1**, DROP COLUMN desteği var; down önce bağımlı indeksi düşürür. Canlı DB'ye migrate/import, 3100/.next işlemi, P4 dosyalarına yazma veya commit yapılmadı.
- Son kapılar: `pnpm typecheck` ve `pnpm lint` exit 0; `pnpm test --maxWorkers=1`: **84 dosya / 1397 test, tamamı geçti (314,55 sn)**. P4 kaynaklı kırık yok. `git diff --check` temiz. **P7 migration canlıya güvenli: EVET; P7 kapsamı commit edilebilir: EVET** (commit atılmadı).
