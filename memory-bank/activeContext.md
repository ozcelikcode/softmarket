## Header and footer editing rollback (2026-11-18)

- The owner cancelled the visual globals project. Header and footer use the standard Payload global form and save directly to the live row, with revalidation on every save. G2–G7 are cancelled.
- The owner also cancelled the English-first conversion. Turkish stays the default locale. New code is written in English.
- The release uses `20261118_142532_revert_globals_chrome_drafts` after the existing G1 and licensing migrations. Resolve any pending drafts in G1 before the release and back up published version history before migrating.

## Licensing L6b admin actions (security center)

- §5.4 endpoints (POST, admin panel session + same origin + JSON, 2 KiB): `/api/licenses/:id/{suspend,revoke,restore,reactivate}`, `/api/license-activations/:id/deactivate`, `/api/security-events/:id/{acknowledge,resolve,false-positive,block}`, `/api/security-blocks/add`, `/api/security-blocks/:id/lift`, `/api/globals/licensing-settings/rotate-signing-key`. Core `src/lib/licensing/admin/actions.ts`, HTTP `endpoints.ts`.
- One serial BEGIN IMMEDIATE transaction per action: requestId receipt (`security-audit.nonce`, retry = `replayed`), preconditions re-read (`expected` status/changedAt -> 409 `stale`), exactly one status-log row (L1 hooks, source admin) and exactly one audit row. Revoke needs reason + last 6 chars of the public id and revokes active devices; restore only for rule (L5 core) or admin manual suspensions, `reactivate` for the rest; revoked is terminal.
- Manual suspend/restore customer e-mails via the L5 queue; block add/lift invalidates the API blocks cache; self-block needs `confirmSelf`; rotation reuses `provisionSigningKeyTx`, returns kid only, raises a high event. Panel saves of licensing settings write a `settings.update` audit row.
- L6b follow-ups: `licenses.status` is locked for all user-facing updates (field access `nobodyField`, read-only with TR+EN hint; only action endpoints, payment code and the rule engine change it, one log row each; L1 tests moved to server-side transitions), and refused admin actions of identified callers write coalesced `security-audit` `denied` rows (`src/lib/licensing/admin/denied-audit.ts`: reason code, `count=n http=s` note, IP prefix only, one row per key per 10 min; anonymous 401s unaudited; no schema change, no security event).
- UI: license sidebar "Lisans işlemleri" (status, devices, history, actions), action columns + "Add block" in `/admin/guvenlik`, rotate button in the signing keys tab; admin panel session only. Record: "L6b implementation record" in `docs/plan-licensing-security.md`.
- L6b security/quality audit fixed idempotent replay abuse across differing payloads/actions/targets and cross-admin `requestId` collisions (`security-audit.nonce` bound to actor + request digest, 409 `idempotency_conflict`), CIDR host-bit leakage and duplicate subnets in `canonicalCidr`, the `blocks-cache` in-flight `invalidate()` race, empty `Authorization` header / zero-or-leading-zero `:id` / non-canonical `Origin` edge cases in `endpoints.ts`, short `publicId` handling in `revokeConfirmation`, and first-item truncation in `settings-audit.ts`.
- Open: direct panel edit of `licenses.status` is still allowed (logged); no `denied` audit rows; L7 portal/legal and L8 next.

## Licensing L5 rules engine, sweep and notification queue

- Pure rules in `src/lib/licensing/rules/` (ipSpread, geoSpread, impossibleTravel, activationBurst, activationChurn, cloneSuspected) and a pure decision step. `pnpm licensing:sweep [--dry-run] [--retention]` with `deploy/licensing-sweep.{service,timer}` every 5 minutes.
- Rules never revoke. Automatic suspension only in `suspend` mode after a valid elapsed `rules.observeUntil`, for active unsuppressed non-expired licenses, with the circuit breaker closed (`maxAutoSuspendsPerHour`, N+1th trips a critical event, open 24 h or until triaged; same-hour re-trip re-opens triaged breaker and re-arms alert). The L1 hook re-checks and logs the transition (source `rule`). Each hit is one BEGIN IMMEDIATE transaction; concurrent sweeps are idempotent.
- `restoreRuleSuspension` is the core for the L6b endpoint (409 unless the last transition is that rule suspension); suppression is derived from the restore row or false-positive event.
- Durable e-mail queue on `security-events.notify_*` + `detail` markers: batched PII-free admin alerts, daily digest, customer suspended/re-enabled e-mails in TR/EN. Retention cleanup nightly (04:00 Europe/Istanbul) in 1,000-row batches, preserving open high/critical events, active suppressions, block-linked events, recently lifted blocks, newer logs/activations, and leap-day boundaries. No schema change or migration.
- Record: "L5 implementation record" in `docs/plan-licensing-security.md`.
- L5 security/quality audit fixed same-hour circuit breaker re-trip bypass, retention deletion of open high/critical events / active suppressions / block-linked events / recently lifted blocks / newer status-log & activation rows / leap-day clamping, expired-license auto-suspension and revoked-license expiry events, invalid `minSeverityImmediate` fallback, `CHANGE_` contact-email filtering, blank customer e-mail skipping, `impossibleTravel` equal-timestamp tie-breaking, same-ms rule `dedupe_key` collision, `restore` malformed `detail` handling, unbounded retention settings, and batched/guarded alert marker writes.

## Licensing L4 updates and downloads

- Signed update discovery and link issuance share L3 authentication, durable nonce batching and rate limits. Unsigned file GET and HEAD recheck entitlement against current SQLite records and serve only eligible original uploads.
- Download tokens last five minutes and allow five GETs per token in the issuing process. Descriptor-based path checks reject symlinks and hard links. Streaming supports one byte range and aggregates download events by activation and trusted IP prefix.
- Client behavior is documented in `docs/licensing/client-api.md`. The L4 plan record tracks verification, including the open HTTP check on Linux.

## Licensing L6a security center (read-only)

- Admin custom view `/admin/guvenlik` with tabs Overview, Events, Blocks, Status transitions; counters (open high events, active blocks, suspended licenses, recent activations), filters in the URL, 50/25 rows per page, links to the Payload documents. Nav link with an open-high badge for admins only. Files in `src/admin/security/`, labels in `src/lib/security-center-labels.ts`, styles `.sc-*` in `src/app/(payload)/custom.scss`.
- Access: server-side admin cookie-session check inside the view (editor redirected to `/admin`, anonymous to login) and again in every loader; reads use the Local API with the admin user and `overrideAccess: false`, always with `select`. No keys, customer e-mail, device material or full hashes are shown; `detail` is redacted. No schema, migration, dependency or client JS.
- A custom view under a new key needs its own `DefaultTemplate` wrapper (Payload adds none). Actions (suspend, revoke, block, triage, key rotation) and the rules engine stay for L6b/L5.
- Gates: typecheck, lint, full Vitest 104 files / 1,711 tests (before the final template wrapper; the affected files re-run green). Browser check on an isolated copy (port 3550): anonymous, editor and admin sessions, light and dark, filter submit, mobile width. Record: "L6a implementation record" in `docs/plan-licensing-security.md`.

## Licensing L3 client API

- Signed device activation, refresh and deactivation are implemented under `/api/v1/licensing`. The L2 public key diagnostic shares the prefix and global rate limits. Clients pin the issuer and signing keys, use fresh nonces and hold a verified lease for up to 14 days by default.
- The existing SQLite writer queue protects device seats and durable nonce claims. Waiting validations share a commit with per-request savepoints. Last-seen and event aggregation have a separate bounded flush path.
- Refund and dispute append payment-sourced status history atomically. Refund revokes active devices and dispute prevents lease refresh. The panel-admin license detail lookup uses a virtual field because Payload 3.93 cannot build GraphQL for a native join to a GraphQL-disabled collection.
- Details and remaining deployment verification are in the L3 record in `docs/plan-licensing-security.md` and `docs/licensing/load-report.md`.

## Licensing L2 crypto and key lifecycle

- Audit fixes bind offline leases to the enrolled license and activation, restrict issuance by retired keys, reject weak public keys and ambiguous metadata, and protect vault rotation against a wrong master. The request verifier can pass the raw decimal timestamp to the canonical builder.

- Node Ed25519 lease JWS and raw-body signing strings live in `src/lib/licensing/crypto/`. HKDF/HMAC domains cover fingerprints, monthly IP hashes and downloads. IPv4 /24 and IPv6 /48 prefixes are the only address fragments retained.
- `pnpm licensing:keygen` writes the encrypted key and public metadata atomically. `--rotate` keeps the old public key eligible for 90 days. `--register-env` registers the public half of the configured environment override. `GET /api/v1/licensing/keys` reads public metadata only and returns 503 when disabled or uninitialized.
- Panel admins can save non-secret licensing settings in a same-origin session. Signing metadata remains read-only in the panel. See the L2 implementation record in `docs/plan-licensing-security.md`.

## Licensing L1 schema (`licensing_core`) — 2026-11-17 (independent audit, no commit, live DB not migrated)

- New collections `license-activations`, `license-status-log`, `security-events`, `security-blocks`, `security-audit` (admin panel session read only, nobody writes through any API, no GraphQL, not in MCP) and global `licensing-settings` (panel admin read, server-only write). Rule suspensions require `mode=suspend` and a valid elapsed `observeUntil`. Enum source `src/lib/licensing/constants.ts`.
- `licenses`: `publicId`, `maxDevices`, server-stamped `statusReason/statusSource/statusChangedAt`; API key (MCP) cannot set/change `status`; every Payload status change logs one row in the same transaction (`src/lib/licensing/transitions.ts`); delete refused (409) with history. `products.licensing.{enabled,code}` (code unique, immutable, panel admin only, not in import).
- Migration `20261117_200700_licensing_core`: additive up (9 tables, 2 hand-written partial unique indexes, 9 ADD COLUMN and a collision-checked `public_id` backfill), guarded down without rebuild. Copy DB: 723 tables row-equal, integrity/FK ok, import dry-run ok, down+up identical schema.
- Audit fixes cover panel authentication, lock isolation, projected and bulk license transitions, draft code validation and uniqueness. Raw-SQL refund/dispute history and summary updates remain L3 work.
- Gates: Typecheck, lint and `git diff --check` pass. Focused Vitest passed 58 tests in 5 files. Full Vitest passed 1,599 tests in 97 files. Partial-chain migration tests (page-builder, p7, blocks-static, block-motion, blocks-appearance, integrations) now also apply `licensing_core`.

## Lisans API + güvenlik merkezi + hosting planı — 2026-11-17 (yalnız plan, kod/şema yok, commit yok)

- `docs/plan-licensing-security.md`: program ↔ site lisans API'si `/api/v1/licensing/*` (aynı süreç, öneri `lisans.<alan>` alt alan adı), cihaz Ed25519 anahtarıyla imzalı istek + sunucu imzalı kira JWS (çevrimdışı tolerans 14 gün) + yanıt imzası/nonce, koltuk = aktif cihaz, kademeli kural motoru (gözlem → bildirim → otomatik askı; iptal yalnız admin), `/admin/guvenlik` güvenlik merkezi, KVKK minimizasyonu. Yeni koleksiyonlar: `license-activations`, `security-events`, `security-blocks`, `license-status-log`, `security-audit`; global `licensing-settings`.
- Fazlar L0 spike → L1 tek şema fazı (`licensing_core`) → L2 kripto → L3 API → L4 ∥ L5 → L6 merkez → L7 ∥ L8 ∥ L9 → L10 QA (+ opsiyonel L11). 24–30 gün. 6 açık soru, onay bekleniyor.
- `docs/plan-hosting.md`: alt alan adı olur; paylaşımlı (Passenger) hosting koşullu, lisans/ödeme için önerilmez (tek süreç, build, Litestream yok); öneri VPS'te kalmak.

## Entegrasyon güvenlik denetimi — 2026-11-17

- Sır yazımları transaction içinde; kısa sırların son dört karakteri gizli. Okunamayan SMTP şifresi gönderimi başarısız kılar. Eksik şirket bilgisi satış hukuk kapısını kapatır; hukuk özeti görünür satır/paragraf sonlarını kapsar. Migration down port/TLS ayarını korur. Typecheck/lint temiz, tam test 91 dosya/1531 test; canlı DB ve 3100 korunuyor.

## Entegrasyon ayarları — 2026-11-17 (QA bekliyor, commit yok, canlıya uygulanmadı)

- Yeni versiyonsuz `integrations` global'i (admin; MCP yok): iyzico/Stripe test+canlı anahtarları, ortam (canlı ek onay), SMTP. Sırlar AES-256-GCM, anahtar `SOFTMARKET_SECRETS_KEY` (yoksa kayıt reddedilir; kaybolursa sırlar okunamaz). Write-only uç `POST /api/globals/integrations/secret`, test e-postası `/test-email`. Env tanımlıysa env kazanır.
- E-posta `softmarketEmailAdapter` her gönderimde env→panel ayarını okur. Yasal şirket yer tutucuları render anında dolar; `pages.legalReview` metne bağlı hukukçu onayı, `legalReady` onay ister. `site-settings.company.etbisNo` eklendi.
- Migration `20261117_092957_integrations_settings` (CREATE TABLE + 7 ADD COLUMN, korumalı down); kopyada doğrulandı. Test 91/1527, build OK. Ayrıntı `docs/plan-payments.md` "Entegrasyon ayarları kaydı".

## P6 güvenlik denetimi — 2026-11-17 (commit yok)

- Belirsiz iade kilidi süreyle açılmaz; gecikmiş sağlayıcı sonucu için tekrar iade yasak. Stripe/iyzico sunucu ve belirsiz yanıtları açık ret sayılmaz; iyzico iptal kaydı başarı/tutar/para birimiyle doğrulanır.
- Stripe iade/itiraz bildirimi sipariş kimliği henüz bağlanmadığında, iade bildirimi sağlayıcıda henüz doğrulanmadığında yeniden teslim için 500 döner. Regresyonlar `payments-p6*.test.ts`.
- Son kodla typecheck/lint temiz, tam test 89 dosya/1492 test geçti.
- İade e-postası en az bir kez teslimdir; SMTP ve işaret yazımı arasındaki kesintide tekrar olası. Kesin tek teslim sağlanmadı. İzole E2E betiği süreç grubu sonlandırdığı için bu denetimde çalıştırılmadı; sonda 404/sitemap testi eklendi.

## P6 yönetici işlemleri — 2026-11-17 (QA bekliyor, commit yok, şemasız)

- Sipariş yan paneli "Sipariş işlemleri": İade et / İptal et / Bildirimi yeniden gönder → `POST /api/orders/:id/{refund,cancel,resend-notifications}` (yalnız admin panel oturumu + aynı origin; anonim 401, editor/customer/API key/MCP 403). İade: önce `refundStatus()`, sipariş başına tek kilit (`payment-events` `admin-refund`), tek refund, tek transaction'da `refunded` + lisans `revoked`; belirsizde kör tekrar yok (`requiresReview`, reconcile yalnız okur). İade e-postası `notify.ts` tür `refund` (işaret `refund-notice` satırı). Stripe dispute → `suspended`; iyzico'da itiraz bildirimi yok. Operasyon: `docs/payments/operations.md`.
- `/yasal` static→dynamic 500 kök nedeni: capability'li derlemede yolu olmayan (boş `generateStaticParams`) rotalar ISR fallback kalıyordu, ilk runtime render `noStore` ile 500. Düzeltme: layout `commerceRenderBoundary()` + `contentStaticParams` sonda yolu (`__dynamic__`); E2E derlemede `dynamicRoutes` 0. Test 89/1488 (+1), e2e 29/29. Ayrıntı `docs/plan-payments.md` P6 kaydı.

## P5 checkout UI + portal siparişleri — 2026-11-16 (QA bekliyor, commit yok, şemasız)

- P5 QA: normal üretim derlemesinde loopback ödeme sağlayıcısı ortam değişkeniyle açılamaz; ayrı `SOFTMARKET_E2E_BUILD=1` derlemesi ve izole DB gerekir. E2E derlemesi dağıtılmamalıdır. Fatura verilerini içeren sözleşme kopyası editörden gizlendi; alıcı VKN görüntülemede maskelendi. Ortamı belirsiz CLI süreçleri de loopback sağlayıcıyı reddeder. Son QA: typecheck/lint temiz, 87 dosya/1462 test geçti; izole build başarılı, tarayıcılı E2E PID kısıtı nedeniyle çalıştırılmadı.
- `/hesap/satin-al/[sku]` (EN `checkout`), `/hesap/siparisler[/no]` (EN `orders`), `startCheckoutAction` + `createCheckoutOrder` (sunucuda fiyat/KDV, form jetonu idempotency, sözleşme kopyası SHA), CSP form-action yalnız checkout yolunda, `CHECKOUT_READY=true` (varsayılan kurulumda `open` kapalı; teklif modu HTML'i HEAD ile birebir). Callback 303 → göreli `/{dil}/hesap/siparisler?donus=1` → oturumdaki müşterinin son siparişi.
- P3 önbellek bulgusu düzeltildi: capability açıkken `getCommerceState` her render'ı dinamik yapar; build ortamında `PAYMENTS_ENABLED=true` gerekir (aksi halde ödeme kapalıya düşer). Izole e2e sahte iyzico (`scripts/e2e-fake-iyzico.ts`, port 3500): 28/28. Ayrıntı `docs/plan-payments.md` P5 kaydı.

## P4 bildirim denetimi — 2026-11-16 (commit yok)

- Reconcile gönderilemeyen/kilitli bildirimlerle dolu batch yüzünden hazır siparişleri atlamaz; yeni inceleme ve lisans ataması bildirim deneme bütçesini yeniler. Bildirim migration down teslim durumu varsa reddeder. İzole SQLite regresyonları eklendi; canlı DB ve 3100 sürecine dokunulmadı. Açık P2: reconcile pending/paid sorgularının sabit ilk sayfası, sürekli hatalı kayıtlarla dolarsa sonraki siparişler bekleyebilir. Güncel kapılar: typecheck/lint başarılı, tam test 85 dosya / 1407 test başarılı; commit edilebilir: hayır (açık P2).

## P4 bildirim kalıcılığı — 2026-11-16 (commit yok)

- Kapandı (Terra P2): `orders.notifications` + `src/lib/payments/notify.ts` (lease + koşullu işaret, reconcile retry ≤5 deneme). Sipariş lisans e-postası hook yerine kuyruktan (CLI'de de gider); elle atama hook davranışı aynı. Migration `20261116_175713_p4_order_notifications` (7 ADD COLUMN), kopyada doğrulandı, canlıya uygulanmadı.

## P4 bağımsız denetim — 2026-11-16 (commit yok)

- Callback sipariş numarası taşımadan hesap sayfasına yönlenir; kapalı adaptör Payload açılmadan 404. Reconcile doğrulanmamış sağlayıcı hatasını iptal kanıtı saymaz; inceleme ve değişen referans koşullu iptalde korunur.
- Açık: lisans hook'u CLI `after()` bağlamı yokken anahtar e-postasını gönderemiyor; şemasız commit sonrası e-posta kalıcı teslim garantisi yok. Checkout açılmadan çözülmeli; ayrıntı `docs/plan-payments.md` P4 kaydı.

## P3 bağımsız denetim — 2026-11-16 (commit yok)

- P1 kapandı: açık ödeme HTML/RSC'si ISR'dan env kapalıyken de HIT dönüyordu (production'da yeniden üretildi). Açık ödeme yüzeyleri `unstable_noStore`, teklif modu ISR; Next bailout content/DB catch dışında. Ödeme modu ISR HIT hedefi güvenlik için kaldırıldı.
- P2: aynı-origin mutlak/normalize yasal URL filtresi, hatalı fiyat girişinden sonra reset, hazırlık fiyat/KDV/sağlayıcı uyumu ve aktif sağlayıcı test/canlı/KARMA rozeti düzeltildi. Saf/SQLite ve gerçek React DOM regresyonları eklendi.
- Production render 6/6: açık fiyat; DB quote/env off fiyat yok, satış yasal 404. Anonim REST/GraphQL ve draft/staff sınırları doğrulandı. P3 sınırı: slug yeniden adlandırılırsa satış türü tanınmaz (`commerceLegal` sonraki faz). Ayrıntı `docs/plan-payments.md` P3 denetim kaydı.
- Son kapılar: typecheck/lint 0 hata, tam test 80 dosya/1339 test (296 sn), son kodla açık/quote iki build, production render 9/9, diff-check temiz. Build/scratchpad silindi, tsconfig geri alındı. Canlı DB, 3100, `.next`, techContext korunuyor; P3 commit edilebilir EVET.

## P3 mod kapısı ve görünürlük — 2026-11-16 (QA bekliyor, commit yok, şemasız, checkout yok)

- `getCommerceState` (env + site-settings.commerce + sağlayıcı/KDV; fail-closed, env yoksa DB'ye dokunmaz), `resolveProductActions`, `EditionCard` buy/quote, hero birincil eylem, fiyat biçimi (sunucu Intl, TR/EN), JSON-LD `offers`, yasal satış sayfası slug sabiti (footer/`/yasal` 404/sitemap), admin hazırlık `ui` alanı, ondalık fiyat girişi (`price-minor-field`), i18n mesajları. `checkoutReady=false`: "Satın al" devre dışı, checkout linki yok; P5 açar.
- Şema/migration yok (kopya DB `migrate:create` = "No schema changes detected"). Quote modunda ürün HTML'i P3 öncesiyle birebir aynı (dondurulmuş eski kart + build karşılaştırması). Testler: `tests/unit/payments-p3{,-render,-db}.test`. Ayrıntı `docs/plan-payments.md` P3 uygulama kaydı.
- Açık: `pages.commerceLegal` şema önerisi (onay bekliyor), `legalReady` P7'de `open`'a katılır, checkout P5.

## P2-S ödeme şeması + store — 2026-11-16 (QA bekliyor, commit yok, canlı DB'ye uygulanmadı)

- Migration `20261116_141401_p2_payments_commerce`: up yalnız 3 CREATE TABLE (`orders`, `orders_items`, `payment_events`) + 21 indeks + 20 ADD COLUMN (`editions` 5, `site_settings` 13, `payload_locked_documents_rels` 2). Elle güvenli down: satış/kilit satırı varsa reddeder, yoksa yalnız eklenenleri kaldırır (rebuild/DELETE yok). Kopya DB: migrate + `content:import --dry-run` 0 hata, integrity ok.
- Tek yazım: `quote-only|payments`, `quote|buy` (takma adlar kaldırıldı). Fiyat `editions.pricing.{taxMode,tryMinor,usdMinor,eurMinor}`; KDV `site-settings.commerce.vat.{try,usd,eur}` (yüzde girilir, baz puan saklanır). Yeni alanlar staff okur, admin yazar; commerce anahtarı API key ile yazılamaz; content:import reddeder (`custom.contentImport:false`).
- `orders`: okuma staff + sahip müşteri; create/delete nobody; admin yalnız invoice/notes/requiresReview. `payment-events`: okuma admin. MCP'de yok.
- Store `src/lib/payments/store/**`: BEGIN IMMEDIATE (V5 kuyruğu), koşullu `license_id IS NULL` ve `status = from` yazımları, çakışmada tam rollback, yan etkiler commit + bağımsız okuma doğrulaması sonrası. Testler `tests/unit/payments-{db,schema}.test.ts`; eski migration testlerine P2-S up eklendi.

## V5 P1 bağımsız denetim — 2026-11-10

- P1: aynı transaction ID'sinde eşzamanlı bitirme erken kilit açıyordu; bitirme promise'i paylaşıldı. Timestamp yerine ham tüm-dil snapshot SHA-256 token'ı (ilk sanal alan, DB kolonu yok); aynı ms/saat geri alma testli.
- P1/P2: blok/dizi ID bazlı merge; Lexical/değer/silme/sıra çakışmasında yazmaz. Flush tabanı güncellenir, merge eski undo'yu temizler; gecikmiş yanıt/locale, gizli sekme 409, boş/null token ve restore 409 düzeltildi. Sürümsüz API/bulk ve açık restore kasıtlı koşulsuzdur. Anonim token görünmez; kopya şema içerik alanlarıyla sınırlı.
- Odaklı 4 dosya/36 test geçti; 30 yazım + 30 okuma: 0 hata, 1579 ms, max read 190 ms. Typecheck/lint temiz; tam paket 73 dosya/1186 test: 1184 geçti, 2 kırmızı (kapsam dışı media fixture ve eski migration 60 sn timeout; aynı migration 120 sn geçici sınırda 3/3 geçti). Ana dala kabul HAYIR: build/tarayıcı E2E eksik ve standart kapı kırmızı. Commit index.lock sandbox engeliyle oluşmadı; çalışma ağacında. Verilen scratchpad DB yok: 3531 build/E2E yapılamadı. Canlı DB/3100/ana repo/şema korunuyor. Ayrıntı `docs/qa/v5-concurrency-audit.md`.

## V5 denetim düzeltmeleri (2026-11-09)

- QA P2 (Terra): EN boş fallback'te Escape, başarısız kayıtla dil geçişi, UTF-8 keepalive, dile göre undo geçmişi düzeltildi.
- P1 kapandı: sanal `editorVersion` + `beforeChange` 409 (aynı transaction), süreç içi SQLite transaction sırası (`src/lib/db-serial-transactions.ts`; libsql eşzamanlı BEGIN'de SQLITE_BUSY + görünmeyen yazım vardı), editörde Birleştir/Kopyala/Yeniden yükle. MCP/import sürümsüz geçer. İzole e2e 20/20, 71 dosya/1163 test (1 kapsam dışı kırmızı), LH JS 129,62 KB. Ayrıntı plan 'V5 P1 kapanış kaydı'.

## V5 — Görsel editör (Payload-native canvas), dal `feat/visual-editor` (2026-11-09)

- Ürün/sayfa belgeleri doğrudan görsel editörde açılır (`openByDefault` + `beforeDocumentControls` host, dar form `custom.scss`); klasik form ziyaret başına. Kod `src/editor/canvas/**` (fields, protocol zod/mini v2, rules, history, bridge, admin/{host,reveal,sync,palette,tour}, plugin), işaretler yalnız `isEditingRender()`.
- Tüm düz metin alanları yerinde (17 blok + ürün başlık/slogan/özet/özellik + sistem hero), gizli bloklar soluk rozetli, palet görselli, MutationObserver reveal, geri al/yinele, keepalive flush, `updatedAt` çakışma uyarısı, 4 adımlı tur, uyumluluk ürünü ilk yapısal işlemde otomatik somutlaşır.
- Doğrulama: typecheck/lint, 70 dosya/1154 test (1 kırmızı ön-var: legal md git'te yok), `.next-v5` build, izole e2e 17/17, LH mobil Perf 100 / JS 129,62 KB (main 129,31) / CLS 0, MCP find + import dry-run temiz. Ayrıntı `docs/plan-visual-editor.md` V5 kaydı.
- 3530 prod sunucu açık (kopya DB `scratchpad/softmarket-v5.db`, admin `v5-admin@example.test`, parola `scratchpad/v5-cred.env`). Push yok; main'e merge kullanıcı QA'sından sonra.

## V2 güvenlik/kalite denetimi (2026-11-08)

- Kompozisyondaki bütün bağlı blokları kaldırarak uyumluluk moduna dönme açığı kapatıldı: önceki layout ile karşılaştırma, EN/draft/autosave/where toplu güncelleme/eski sürüm restore/import dahil zorunlu editions bloğunu korur. Ham girdide `beforeValidate`, son sınırda `beforeChange`; `hidden: true|"true"|1|"1"` ve çakışan blok ID'leri 400. Kısmi ID güncellemesi ve Duplicate çalışır.
- Eski layout'ta ek CMS bloklarının ayrı render-plan sınırı korundu; ilk ek bloğun LCP-safe animasyonu V2 öncesiyle aynı. Regresyonlar: `product-bound-db`, `product-composition`, yeni `product-render`, ürün draft/ilişkili liste/ISR testleri `live-preview-db`.
- Typecheck/lint/diff-check temiz; `pnpm test --maxWorkers=1`: 67 dosya / 1015 test. DB kopyasıyla `.next-prod` build ve 3200 duman geçti (TR/EN ana sayfa + ürün 200, olmayan ürün 404, tek h1, SKU teklif linkleri). Legacy ve 8 bağlı bloklu TR/EN ürünlerin MISS sorgusu aynı: 24. Migration up/down/eski satır koruması, import idempotansı, REST/MCP retleri geçti; anonim taslak/lisanslı indirme/yayınlanmamış doküman sızıntısı görülmedi.
- Canlı DB/3100/`.next`/payments/commit işlemi yok. Kanıt dizini `/private/tmp/softmarket-v2-audit-dlkms1ma`. **3200 PID 98175 kapanışı bekliyor:** sandbox SIGTERM'i reddetti, terminal kesilince süreç kaldı; kullanıcıya yalnız bu PID'yi kapatma isteği iletildi. Tarayıcıda görsel/piksel eşdeğerliği bu denetimde ölçülmedi.

## V2 — Ürün sayfası bağlı bloklar (2026-11-08)

- `products.layout` = `productBlocks` (`layoutBlocks` + `src/blocks/product-bound.ts`): productHero, productNav, productOverview, productFeatures, productSpecs (`showRequirements`), productEditions, productDownloads, productDocs. İçerik kopyalanmaz; ürün/sürüm/indirme/doküman kayıtlarından okunur (`slots.product`, `src/components/blocks/product/product-blocks.tsx`).
- `src/lib/blocks/product-composition.ts`: bağlı blok yoksa uyumluluk modu (V2 öncesi sıra + eski filtre, sanal `virtual:*` bloklar; HTML birebir aynı, 14 eski sayfa doğrulandı). Bağlı blok varsa kayıtlı sıra.
- **Teklif İste zorunlu:** `productEditions` taşınabilir, silinemez/gizlenemez (hidden kolonu yok). Layout `validate` + alan `beforeChange` kancası taslak/autosave/REST/MCP/import dahil 400 verir; renderer eksikse yine ekler. `productHero` ilk blok, gizlenemez, yoksa varsayılan giriş çizilir; `LCP_BLOCK_TYPES`'ta.
- Products autosave 2 sn. Migration `20261108_130717_v2_product_bound_blocks` (16 CREATE TABLE + 49 indeks + `_products_v.autosave`); canlıya uygulandı, yedek `scratchpad/softmarket-pre-v2.db`. Dev 3100 yeniden başlatılmadı; ürün sayfaları migrate sonrası 200 ve eskiyle aynı.
- Doğrulama: typecheck/lint temiz, `pnpm test --maxWorkers=1` 66 dosya / 1005 test (yeni: product-composition, product-bound-db); prod build 118 sayfa, 3200 duman, LH mobil ürün Perf 100 / LCP 1.21 s / CLS 0. Ayrıntı `docs/plan-visual-editor.md` V2 kaydı. Commit yok.

## V1 güvenlik/kalite denetimi (2026-11-08)

- Hero preset doğrulaması Payload taslak/autosave yolunda atlanıyordu: `Hero.ts` preset `beforeValidate` kancası REST/MCP/Local API dahil yedi seçenek sınırını uygular. Import şeması da aynı listeyle sınırlı; canlı şema/migration değiştirilmedi.
- `render-plan.ts`: gizli/dekoratif/boş/sonuç getirmeyen başlangıç blokları LCP korumasını tüketmez. Görünür içerik kesinleşene kadar adaylar korumalı kalır; Lexical kontrolü sınırlı gezinir.
- Admin kartlarında bilinmeyen preset çökmesi, hero için yasak kart eklenmesi, enum dışı önizleme zamanlaması ve eksik alan hata gösterimi düzeltildi. CSS hover klavye odağı pointer koşulundan çıkarıldı; scroll-progress tam girişte tamamlanır, fallback hem timeline hem range desteğini kontrol eder.
- Odaklı regresyonlar ve migration 1134 up/down (162 tablo; 72 `_v`) veri koruma testi geçti; gerçek REST/MCP handler reddi doğrulandı. Tam kapı sonuçları `progress.md` başındaki denetim kaydında. Canlı DB/3100/`.next`/commit işlemi yok; build ve duman DB kopyasında.

## V1 — Animasyon preset sistemi (2026-11-08)

- Yeni `motion` grubu (`src/fields/block-motion.ts`, "Hareket" collapsible; spacer/divider/listing hariç 18 blok): `preset` auto|none|fade|slide-up|slide-down|slide-left|slide-right|zoom-in|parallax-soft|stagger, `trigger` scroll|scroll-progress|load|hover, `duration` fast/base/slow (240/560/800 ms), `delay` 0/100/200/300, `easing` soft/standard/emphasized, `stagger` none/tight/relaxed (≤4 adım, ≤300 ms), `mobile` (paralaks). `appearance.animation` aynen; `none` ana anahtar. Varsayılan `auto` = eski işaretleme birebir.
- Render: `planBlocks` → `ctx.motion` (`resolveMotion`); `anim(i, motion, mode)` + `BlockShell motion`; hero `heroMotion` (yalnız translate; paralaks medyaya). CSS sözleşmesi `globals.css` "Motion system": `data-anim`, `data-anim-trigger`, `data-anim-safe`, `data-anim-mobile`, `--anim-dur|delay|ease|stagger`, efekt başına `--m-o/--m-from`; observer `[data-anim-trigger]` izlemez. LCP: ilk blok + her hero'da gizleyen efekt sunucuda `slide-up` + safe (opacity 1). Reduced-motion/`data-motion=none` her şeyi kapatır.
- Admin: `src/admin/fields/motion-preset-cards.tsx` (import map, saf CSS önizleme, Tekrar oynat; hero'da 7 güvenli kart + `validateHeroPreset`). Etiketler `admin-i18n.ts` `MOTION_LABELS`.
- Migration `20261108_100715_blocks_motion`: 1134 ADD COLUMN (162 tablo × 7); down yalnız bu kolonları düşürür. Kopyada test; canlı yedek `scratchpad/softmarket-pre-v1.db{,-wal,-shm}` + `.snapshot.db`; canlı migrate, 681 tablo eski veri farkı 0, integrity ok.
- Doğrulama: typecheck/lint, 58 dosya/728 test, prod build, 3300 (kopya DB) Playwright 27/27 (390/1440, CLS 0, reduced/none/no-JS), Lighthouse mobil /tr Perf 100, LCP 1.06 s, JS 129.4 KB. Commit yok. Ayrıntı: `docs/plan-visual-editor.md` V1 kaydı.

## V0 — Payload güvenlik yükseltmesi (2026-11-08)

- `payload` + tüm `@payloadcms/*` **3.85.1 → 3.93.0**, tam sabit/hizalı; Next **15.4.11**, React **19.2.6** korundu. Node minimum **24.22.1**; host **24.21.0** değiştirilmedi, test/build/migration geçici resmi **24.22.2** runtime ile yapıldı.
- Migration `20261108_093334_v0_payload_393`: **2 auth sütunu + 309 lokalize parent indeksi**; yıkıcı up yok, down yalnız kendi eklerini kaldırır. Önce kopyada up/down/veri koruma; sonra `scratchpad/softmarket-pre-v0.db{,-wal,-shm}` + `.snapshot.db` yedeği ve canlı migrate. Kopya/canlı: **680 tablo, eski veri farkı 0, integrity ok, FK 0**.
- Sürüm notları 3.86–3.93 (patch'ler dahil) incelendi: blok read/tip erişimi, upload/SVG/XML/SSRF güvenliği; API key gizleme, yeni JWT authVersion (eski oturumlarda tekrar giriş), localized draft, Lexical 0.50, Nodemailer 10, SQLite/MCP/admin/i18n/preview uyumu. Güvenlik varsayılanları gevşetilmedi. TIFF `.tif`, aktif SVG reddi, draft-only ilişki ve JWT testleri güncellendi.
- **typecheck/lint, 56 dosya/703 test, generate:types/importmap, kopya DB `.next-prod` build, 3200 duman, isolated E2E 1/1 geçti**. Taze MCP **69 araç**, TR/EN create/update + kimlik/yetki kontrolleri geçti. Import map değişmedi. Upstream mcp-handler SDK peer uyarısı sürüyor; güvenli SDK düşürülmedi. Preview 401 testi geçerli `?redirect=/tr` ile; çıplak endpoint mevcut şekilde 400.
- **3200/3400 kapalı; 3100 PID 53048 ve `.next` korundu; commit yok.** pnpm install HMR'yi bozabilir: yönetici Node >=24.22.1 sonrası dev'i yeniden başlatmalı; bu görevde restart yapılmadı. Ayrıntılı release/migration/test/dosya kaydı: `docs/plan-visual-editor.md` sonundaki V0 bölümü. **V0 tamamlandı; V1/V2/pilotlar uygulanmadı.**

- 2026-11-08 F11 perf düzeltme turu (JS/font/görselli LCP): header sunucu bileşeni + tek ada `header-frame.tsx` + `src/lib/header-nav.ts` (Radix NavigationMenu/Dialog yerine; mega paneller HTML'de `hidden`, aria-expanded/controls, hover-intent 80/150/300 ms, ←/→/Home/End, ↓ panele, Escape odak dönüşü; mobil menü yerel modal `<dialog data-sheet>`, `ui/sheet.tsx` silindi). `NextIntlClientProvider` kaldırıldı, istemcide next-intl kancası yok (dil seçici `publicLanguageSwitch` + statik JSON etiketi; error/global-error yalnız `feedback`); sunucu `hasLocale` → `src/i18n/has-locale.ts` (`next-intl` kök girişi provider'ı istemci referansı yapıyordu). `safeHref` → `lib/safe-href.ts`, `jsonLdString` → `lib/json-ld-string.ts`, istemci `cx` (`lib/cx.ts`), istemci lucide ikonları `ui/client-icons.tsx`. Font: `scripts/subset-fonts.sh` (fonttools) → `src/fonts/` Geist alt kümeleri: birincil Latin-1+Türkçe 28 KB tek preload, Latin-ext ayrı unicode-range yüzü, mono 20 KB preload yok, `Geist Fallback` globals.css'te. Sonuç (kopya DB, 3300, LH 3 koşu): ana sayfa JS 192→129 KB, font 138.7→48.3 KB (diğer sayfalar 28 KB), görselli LCP 3.16→2.53 s (hedef <2.5 KIRMIZI: çerçeve JS; devtools 2.24 s), CLS 0, Perf 100/97. Kalan: ana sayfada mono iniyor (hero panel font-mono). Guard: `tests/unit/client-bundle-guard.test.ts`; e2e `tests/e2e/header-keyboard.spec.ts` (3/3, `E2E_BASE_URL`). `pnpm test --maxWorkers=1` 54/696, typecheck/lint, `.next-perf` build. Ayrıntı `docs/perf/f11-acceptance.md` "Düzeltme turu sonrası". 3300 kapatıldı; 3100/.next/canlı DB'ye dokunulmadı, commit yok.

- 2026-11-08 F11 güvenlik/kalite denetimi: isolated seed `.env`/Payload importundan önce kanonik/encoded DB URI, özel temp dizin/marker, symlink/hardlink, uploads ve secret doğrular; gerçek SQLite dosyası da yazmadan önce kontrol edilir. 3400 ayrılmıştır; runtime env eksikse canlı DB varsayılanına düşmez. Salt okunur kaynak backup, erken/bounded cleanup, doğrudan Node + Next shim, Playwright graceful SIGTERM, rastgele parola/secret, trace/xtrace kapalı, doğru `roles:[admin]`. Lighthouse geçersiz koşu/rapor hataları ve çift medyan düzeltildi; docs MISS ölçümü doğrulanmadı. Typecheck/lint ve kopya DB ile `.next-prod` build geçti; son `pnpm test --maxWorkers=1`: 52 dosya, 643/643. Varsayılan paralel test koşusu mevcut ağır SQLite/medya testlerinde timeout verdi. Normal Playwright listesi 15 test, isolated dışarıda; isolated listesi 1 test. Son shell/izolasyon regresyonu 19/19. İlk gerçek E2E API akışı (önceden kullanıcısı olan kopya) geçti; eski pnpm-wrapper kapanışı yetim süreç bıraktı: yalnız bu denemeye ait 3400 PID 35377 ve 35375 sandbox sinyal engeli nedeniyle kullanıcı tarafından kapatılmayı bekliyor. Kopya: `$TMPDIR/softmarket-e2e-isolated.EYj52V`; audit kaynak DB/logları `$TMPDIR/softmarket-f11-audit-qg96e6_b` (süreç kapanınca temizlenecek); yeniden E2E + temizlik bu dış engele bağlı. Canlı DB yazımı/3100/.next/commit yok.

- 2026-11-07 F11 görsel QA turu 2 + perf kabul (kabul KARŞILANMADI): 432 ekran görüntüsü (prod 3200) temiz; baseline güncel. Mobil Lighthouse (3 koşu medyan) metin sayfaları Perf/A11y/BP 100, LCP 1.06-1.21 s, CLS 0, TBT 73-89 ms; SEO 92 (yalnız canonical, alan adı bekliyor). KIRMIZI: görselli hero LCP 3.0 s (Lantern; devtools throttling'te LCP=FCP 2.18 s), JS 192 KB gzip (>130; Radix nav-menu 16.6, ICU parser 12.5, tailwind-merge 9.3), font 70 KB + ikinci font 70 KB. INP vekili en kötü 128 ms. ISR HIT 2-8 ms; dinamik liste/iletişim 11-18 sorgu. Ayrıntı `docs/perf/f11-acceptance.md`, görsel `docs/qa/visual-baseline.md` "F11 turu 2" (en kritik: yasal sayfalarda TASLAK + `[ŞİRKET UNVANI]` yer tutucuları yayında). Küçük düzeltme: lead form `*` + `border-strong`; admin blok alanı "Blok ekle". Editör kılavuzu gerçek admin UI'siyle düzeltildi (Layout ekle→Blok ekle, Sil→Kaldır, Taslak kaydet yok/autosave, Değişiklikleri yayınla, Live Preview göz simgesi). e2e: `tests/e2e/f11-flows.spec.ts` (3100, salt okunur) + `tests/e2e/isolated/` (DB kopyası, 3400, `pnpm test:e2e:isolated`; `scripts/e2e-isolated-server.sh`, `scripts/e2e-seed-admin.ts`); varsayılan `playwright.config.ts` isolated klasörünü yok sayar. `scripts/perf-lighthouse.mjs` LH_RUNS/LH_BASE/LH_URLS/LH_PRESETS + medyan. Not: 3100 dev kazara (geniş pkill) kapandı ve `pnpm dev` ile yeniden başlatıldı.

- 2026-11-07 F9 özgün medya gizliliği: `Media.beforeOperation` → `src/lib/media-upload.ts`; yeni/create ve replacement/update JPEG/PNG/WebP/TIFF/HEIC/HEIF yüklemelerinde EXIF yönü uygulanır, EXIF/GPS/XMP/IPTC atılır, ICC tutulabilir. JPEG q90/mozjpeg, PNG/WebP kayıpsız, TIFF LZW; HEIC HEVC desteği gerektirir, temizleme hatası 400. SVG/GIF/video/PDF ve mevcut dosyalar değiştirilmez; regenerate özgünü korur. Geçici SQLite/uploads üzerinde 10 yeni test (GPS JPEG, fiziksel yön/boyut, formatlar, tempFilePath, 400 ve kapsam dışı dosyalar); typecheck/lint ve 48 dosya/603 test geçti. Risk notu `docs/perf/f9-media-pipeline.md` içinde kapatıldı. Canlı DB/3100/commit işlemi yok.

- F9 denetimi (2026-11-07): UUID türev adları, eski çakışan dosyalarda fail-closed erişim, SVG sandbox CSP/nosniff; regenerate orijinali koruyarak aşamalı üretir. Tam test 47 dosya/593 test, typecheck/lint, izole DB ile build; 3200 duman 200/200/200/200/404, optimizer 400; 3200 kapatıldı, 3100 korundu. Özgün JPEG/PNG EXIF/GPS içerebilir; gerçek disk dolması ve zorla kesme test edilmedi. Ayrıntı docs/perf/f9-media-pipeline.md.

- F9 görsel pipeline uygulandı (2026-11-07): Media thumb400/card768/hero1280/wide1920 WebP q74, focal/crop; büyük hedefler Payload varsayılanıyla atlanır (`withoutEnlargement:true` gereksiz orijinal kopyalar üretir). Native ortak MediaImage tüm img tüketicilerinde: srcset/sizes, container boşlukları, width/height, lazy, hero eager/high + responsive preload. `mediaRead` boyut filename'larını aynı medya kaydı + mevcut lisans filtresiyle yetkilendirir; optimizer kapalı, private/no-store. Migration `20261107_192347_media_image_sizes` (24 ADD COLUMN + 4 indeks; down rebuild yok) kopyada test edilip canlıya uygulandı; `scratchpad/softmarket-pre-f9.db{,-wal,-shm,.snapshot.db}` yedeği, eski veri farkı 0, integrity ok/FK 0. `pnpm media:regenerate` kimlik/seedPath/TR-EN/izin/orijinal baytlarını korur; kopyada 3 → 0 regenerate. Gerçek handler/SQLite anon/customer/staff + geçerli/iptal lisans testleri, 45 production HTTP dosya/rol kontrolü; F8 staff+draft protected srcset görürken anon/customer/draft çerezi tek başına yalnız public görür. Mobil dokulu fixture 390px/DPR1–3: 1.24/23.28/171.17 KB. Typecheck/lint, 47 dosya/591 test, production build ve /tr,/en,/tr/urunler,/admin 200; /tr/olmayan 404. **LCP/CLS ve tarayıcı currentSrc ölçümü doğrulanamadı:** Chromium MachPort 1100, Lighthouse port ve browser host engeli; regresyon yok iddiası yok. Kanıt/sınır: `docs/perf/f9-media-pipeline.md`. Testler/kullanıcılar yalnız DB kopyasında, canlı medya=0; 3200 kapatıldı (ECONNREFUSED); 3100 açık/.next korundu, commit yok.

- F8 Live Preview + taslak modu tamamlandı (2026-11-07): `/api/preview` (staff-only draftMode; anon 401, customer 403, cross-site 403, redirect allow-list 400) + `/api/exit-preview`; `src/lib/preview.ts` `getPreviewUser/readAs` (draft modu + her render'da `payload.auth` staff; aksi yayınlı) tekil yükleyicilerde; `admin.livePreview` 6 koleksiyon + 3 breakpoint (`src/lib/preview-url.ts`); `RefreshRouteOnSave` adası (aynı-origin) + "Önizlemeden çık" rozeti; `pages` autosave 2000 ms; migration `20261107_190342_pages_autosave` (yalnız ADD COLUMN + indeks) canlı DB'de, yedek `scratchpad/softmarket-pre-f8.db*` + `.snapshot.db`. Ana sayfa `dynamic='error'` kaldırıldı (draft'ta headers() yasaktı; hâlâ SSG). Middleware draft çerezinde `no-store`. Yeni bağımlılık `@payloadcms/live-preview-react@3.85.1`. 3200 doğrulama + Playwright: autosave 2061 ms, iframe 92 ms sonra güncel; anonim aynı anda yayınlı + ISR HIT. 46 dosya/585 test, `.next-prod` build. 3200 kapalı, 3100 korundu, commit yok. F9/F10 notları: plan F8 notu + progress.

- F6 denetimi (2026-11-07): sitemap içerik sorguları `public-sitemap` etiketiyle 1 saat önbellekli, yayın/silme/global değişikliğinde geçersizlenir; yapılandırılmış ana sayfanın landing adresi sitemap dışındadır. `20261107_160000_globals_media_delete` medya FK trigger migration'ı yalnız DB kopyasında uygulandı ve test edildi; canlıya uygulanmadı.

- F6 page builder tamamlandı (2026-11-07): migration `20261107_144850_page_builder_pages` (up: 66 CREATE TABLE + 154 indeks + 185 ADD COLUMN + `site_settings_home_page_delete` trigger; üretilen down `site_settings`'i `__new_` ile kuruyordu → elle güvenli down, testle kilitli; canlı DB'ye uygulandı, yedek `scratchpad/softmarket-pre-f6.db*` + `.snapshot.db`). Ana sayfa = `pages` kaydı: `getHomePage` homePage → slug `home` → `FallbackHome` (eski kompozisyon). `pages.systemKey` (9 rota) + `hero` grubu → `SystemHero`/`SystemBody` (`src/components/pages/system-page.tsx`); liste = yeni `listing` bloğu (yalnız pages; yoksa hero altında, gizli = liste yok). `pageType: template` anonimde okunmaz. Landing `[locale]/[slug]` + `RESERVED_SLUGS`/`pagePath` (`src/lib/system-pages.ts`); `/[slug]` next-intl pathnames'e eklenmedi, `LINK_ROUTES`'a `slug` anahtarı eklendi. Aile `layout`. Hero `aside: families` + `panelTitle`; görünüm `separator`; ListFrame `mt-14`; CTA banner boşlukları = CtaBand (ürün sayfası CTA +8 px). Seed `05-pages.json` + `01-globals` `homePage`. Revalidate kök neden: `revalidatePath('/tr','layout')` hiçbir türetilmiş etikete uymuyordu → `revalidatePath('/', 'layout')`; sitemap `force-dynamic` (Next 15.4 APP_ROUTE etiket kontrolü yok). 3200 doğrulaması: 24 ekran (390/1440) önce/sonra piksel farkı %0, yükseklik birebir; blok sırası API ile değişip geri alındı; /tr MISS 20 / HIT 0 sorgu. 44 dosya/536 test. 3200 kapalı, 3100 korundu, commit yok.
- F8 notları: Live Preview/draft yükleyiciler `getHomePage`/`getSystemPage`/`getLandingPage`'e `draft` parametresiyle eklenmeli (şu an anonim+published). `pages` autosave açılınca revalidate zaten yalnız publish'te. F7'deki `site_settings.favicon_id` ve `header_nav_items.featured_image_id` FK'leri de ON DELETE eylemsiz: medya silinince FK hatası olur → trigger (hero_video_delete/F6 deseni) gerekir. Landing EN slug'ı farklıysa link için `internal` referans kullanılmalı (route `slug` param tek dilli). CLI importu Next önbelleğini yenilemez.

- F7 globals tamamlandı (2026-11-07): migration `20261107_141523_globals_editable` (up: 6 CREATE TABLE + 91 ADD COLUMN; down elle yazıldı çünkü üretilen down `header_nav_items`/`site_settings`'i `__new_` ile kuruyordu → transaction'da FK OFF etkisiz, cascade veri kaybı). Link `type: route` + `route` (kararlı anahtar, ör. `urunler`, `yasal_slug`) + `routeParam`; `linkTarget()` TR kanonik yol → AppLink EN'e çevirir. Header: `megaMenu: custom` (columns + featured), `cta.secondary`, `announcement`, `utility`; Footer: `brandBlurb`, `showContact`, `showSocial`; SiteSettings: `favicon`, `brand.accent`, `motion`. Loader'lar `getSiteSettings` (depth 1, media projeksiyonu, filename gerekli → url), `siteIdentity`, `publicContact`, `publicImage` (`src/lib/site.ts`); `publicText`/`formatCopyright` (`src/lib/utils.ts`). Kontrast: renk en az bir temada olduğu gibi AA geçmeli, diğer tema/hover tonları türetilir; orta parlaklık bandı reddedilir. İkonlar `public/` altına taşındı (app dosya ikonları CMS favicon'u ezer). Duyuru/utility header'ın üstünde normal akışta (main `-mt` yalnız header'ı dengeler). Seed e-postası bilerek boş (bildirim yanlış adrese gitmesin). DB'de eski `link_url` değerleri gizli alan olarak duruyor (type=route iken okunmaz).
- (F6'da uygulandı) F6 notları: CMS sayfaları/landing için `route` seçenekleri yalnız `CANONICAL_PATHS`'ten gelir; `[locale]/[slug]` landing rotası eklenince `LINK_ROUTES`'a yeni anahtar EKLE (mevcut anahtarları değiştirme/silme). Ana sayfa bloklarındaki CTA'lar `route` kullanmalı. `referencePath` `pages` için yalnız legal/hakkımızda/home çözüyor; landing sayfaları için genişletilmeli. Header `items` boşken i18n yedeği; F6 ana sayfa seed'i de `route` ile yazılmalı.

- F5 denetimi (2026-11-07): elle seçim sırası limitten önce anonim ID/slug sorgusuyla çözülür; yalnız seçilen en çok 24 kayıt populate edilir. Eski logoWall `partners`/`caseStudies` kaynakları `maxDepth:0` + anonim ID sorgusu kullanır; mevcut kaynak değerleri, seçim sırası ve metin logoları korunur. Otomatik kaynaklarda logosuz kayıtlar sorguda elenir, okunamayan medya dedup öncesi çıkarılır. Import JSON şeması sayı alanlarının `max` değerini de uygular. Ayrıntı ve doğrulama: progress.md F5 denetimi.
- F5 dinamik bloklar tamamlandı (2026-11-07): migration `20261107_130000_blocks_dynamic_set` (yalnız CREATE + logoWall `limit` ADD COLUMN; canlı DB'ye uygulandı). Bloklar `productFamilies`, `productShowcase`, `solutionsGrid`, `caseStudy`, `newsList` + logoWall otomatik kaynaklar; loader `src/lib/blocks/data.ts` (anonim, cache, sabit sorgu, `preloadBlockData` RenderBlocks'ta); blok `dbName` KULLANMA (çakışır), uzun slug için animation `enumName`. Elle seçim ilişkileri `maxDepth:0`. Commit yok.

- F4 statik bloklar tamamlandı (2026-11-07): migration `20261107_111754_blocks_static_set` (yalnız CREATE TABLE + hero `video_id` ADD COLUMN; canlı DB'ye uygulandı, kopya DB + dry-run 0 hata). Yeni bloklar `media`, `testimonial`, `tabs`, `spacer`, `divider`; `videoEmbed` facade (iframe yalnız tıklayınca, nocookie/dnt); hero `mediaBackground` + opsiyonel sessiz video (`hero-video` ada: yalnız ≥768px, reduced-motion/saveData/`data-motion=none` kapalıyken `<video>` mount; aksi halde yalnız poster = LCP). Client adalar: `tabs-island`, `video-facade`, `hero-video`; mantık `src/lib/blocks/static.ts`. `common.playVideo` i18n anahtarı eklendi. typecheck/lint/36 dosya 420 test, `.next-prod` build, 3200 Playwright (CLS 0, ağ/klavye/JS'siz) geçti; geçici `qa-blocks` sayfası + medya silindi; 3200 kapalı, 3100'e dokunulmadı, commit yok. F5 notu: yeni bloklar `layoutBlocks` sonuna eklendi; hero `video` alanı `filterOptions mimeType contains video/`.

# Aktif Bağlam

- F10 çapraz denetimi (2026-11-07): etiket walker'ı access/hooks/defaultValue/admin.hidden ve şemayı koruyor; sanitize edilmiş plugin config erişim politikaları + MCP dışlamaları regresyon testinde doğrulandı. Starter testine CLI ile aynı gerçek yazım/rollback + Lexical dönüşümü, fiziksel DB izolasyon kontrolü ve mevcut içerik üzerine yazma kanıtı eklendi; AGENTS.md yalnız boş kurulum uyarısı içeriyor. `docs/editor-guide.md` medya koruması/metadata kapsamı, admin-only Site ayarları, globals'ın anlık kaydı, lisans koşulları, şablon kopyası türü, ortak blok yapısı ve diğer kod çelişkileri için düzeltildi. Typecheck/lint, 50 dosya/613 test ve starter yüklenmiş geçici SQLite ile `NEXT_DIST_DIR=.next-prod pnpm build` geçti (mevcut localhost canonical uyarısı). `pnpm migrate:create f10_audit`: No schema changes; dosya oluşmadı, payload-types farkı yalnız yorumlar. Canlı DB/3100/.next/commit işlemi yok.

- F10 kod kısmı (2026-11-07): admin etiketleri/açıklamaları/seçenekler/sekmeler/array satırları/gruplar TR+EN, tek sözlük `src/lib/admin-i18n.ts` (`localizeCollection/localizeGlobal`, payload.config'te uygulanır; plugin koleksiyon etiketleri `pluginLabels`). Şema değişmedi (migrate:create "No schema changes"). `tests/unit/admin-labels.test.ts` config tarayıcısı; `content/templates/starter` (+ izole SQLite testi `starter-template-db.test.ts`); AGENTS.md'de starter bölümü. Live Preview breakpoint label düz string (Payload React child). editor-guide.md ayrı ajanda; commit yok.

- F8 denetimi (2026-11-07): preview/exit-preview aynı kaynak doğrulaması Fetch Metadata veya Origin/Referer ile kapalı varsayılan; `X-Frame-Options: SAMEORIGIN` eklendi. 585 test, typecheck, lint ve kopya DB ile `.next-prod` build geçti. 3200'de personel taslağından sonra anonim ISR yayınlı içeriği verdi; yalnız draft çerezi taslağı açmadı. 3200 kapatıldı, canlı DB ve 3100'e dokunulmadı.

- F4 güvenlik/kalite denetimi (2026-11-07): `blocks_static_set.down()` hero tablo yeniden kurulumuyla çeviri/CTA verisini siliyordu; yalnız video indeksi/sütunu kaldırılır. Normal + `_v`, dört koleksiyon ve transaction regresyonu geçti. `20261107_120000_hero_video_delete` trigger migration'ı yedek alındıktan sonra canlı DB'ye bilerek uygulandı (commit `a45a9df`). İki migration testinde gerçek DB dosyası `PRAGMA database_list` ile geçici dizine doğrulanır.
- VideoEmbed kayıt/render aynı katı YouTube/Vimeo ayrıştırıcısını kullanır; ID/yol/kimlik bilgisi/port kontrolü, autoplay parametrelerini sıfırdan üretme. Hero video public MP4/WebM ve poster gerektirir; Payload upload filtresinin sunucuda da çalıştığı gerçek yazımlarla doğrulandı. Renderer public/MIME kontrolünü tekrarlar. Testimonial alt fallback'i düzeltildi. Tabs JS'siz tüm panelleri gösterir; hydration sonrası ARIA/roving tabindex, yatay oklar/Home/End (yukarı/aşağı kaydırmayı engellemez).
- F4 son doğrulama: typecheck/lint, 36 dosya/438 test, DB kopyasında `.next-prod` build geçti. F4 fixture JSON import 2× (4 create → 0 create/4 update); varsayılan seed dry-run 0 create/88 update. 3200: /tr, /en, katalog, ürün detayı, /admin 200; olmayan rota 404. Protected video HTML/Flight URL sızdırmıyor, dosya 404; public poster 200; JS'siz tabs/richText/CSP kontrolleri geçti. QA içerikleri kaldırılıp temiz build/duman tekrar geçti (QA rotaları 404); geçici DB/medya kopyaları silindi. Chromium MachPort sandbox izni nedeniyle browser etkileşimleri doğrulanamadı. 3200 kapalı, 3100 PID 45975 korunuyor; canlı migration/commit/.next silme yok.

- F3/F0 denetimi (2026-11-07): ayrılmış anchor ID'leri render sırasında da reddedilir; prototype adları güvenli varsayılan alır. Sorgu günlüğü URL yolunu yazmaz ve korelasyon kimliğini UUID v4 ile sınırlar. typecheck/lint/399 test ve DB kopyasıyla `.next-prod` build geçti; 3200 duman testi başarılı, süreç kapatıldı. 3100 ve canlı DB migration'ına dokunulmadı.

- F3 blok çekirdeği tamamlandı (2026-11-07): migration `20261107_110012_blocks_appearance` (yalnız ADD COLUMN, 80 blok tablosu, varsayılanlar eski görünüm; kopya DB + dry-run sonra canlı; import 2× 0 create/88 update). `src/fields/block-settings.ts` (`blockSettings`, `BLOCK_DEFAULTS`, `resolveAppearance`, anchor doğrulama), `components/blocks/{block-shell.tsx,registry.ts,types.ts}`, `lib/blocks/render-plan.ts` (tek h1: `RenderBlocks firstHeroH1` yalnız h1'siz CMS sayfası/F6; PageHero'lu sayfalarda hero h2). Hero `default`=sinematik + split/centered/minimal; CTA `split`; featureGrid `style` + ikon select (`lib/icon-names.ts`). Admin i18n TR varsayılan, blok TR/EN etiket + `admin.group` + `public/admin/blocks/*.webp` yer tutucu. `blockReferences` kullanılmadı (plan F3 gerekçesi). typecheck/lint/34 dosya 398 test, `.next-prod` build; 3200 1440/390 görüntü farkı ≈0 (`scratchpad/f3/`). 3200 kapalı, 3100'e dokunulmadı, commit yok.

- F0 SQLite sorgu ölçümü tamamlandı (2026-11-07): `src/lib/db-query-log.ts`, Node `instrumentation.ts` ve bayrakla etkin Payload adapter sarmalı. `SM_DB_QUERY_LOG=1` ile libSQL statement sayısı/süre + HTTP isteğine ALS bağlamı; server render `getDbQueryStats()` okuyabilir. Streaming sonrası `finish` logları `scripts/perf-isr.ts` tarafından `SM_DB_QUERY_LOG_FILE` ve istek kimliğiyle eşlenir. Bayrak kapalıyken adapter/client/HTTP emit sarılmaz. `.next-perf` build + 3300 production ölçümü: 146 route/292 HTTP 200; 122 HIT/HIT çiftinde 0/0 sorgu. Arama 33/33, katalog 17/14 (ilk 3 PRAGMA), iletişim/indirmeler 16/16, portal giriş 9/9; eşzamanlı 33/9/14 izolasyonu doğrulandı. İlk 10 route `docs/perf/baseline.md` içinde. typecheck/lint/32 dosya 376 test/diff-check geçti. 3300 kapalı; 3100'e dokunulmadı; commit yok.

- F1/F2/G denetimi (2026-11-07): yayınlı kayıt üzerine taslak kaydedildikten sonra unpublish cache temizliği atlanıyordu; `revalidate.ts` ana kayıt yayın durumunu before/afterChange arasında izler. Gerçek geçici SQLite testinde publish, ardışık taslak, unpublish, slug değişimi ve delete doğrulandı. `content.ts` seçenekleri ilkel cache anahtarlarına dönüştürür; eksik aile ilişkisi diğer sayaçları bozmaz. React cache render dışında kalıcı değildir; public sorgular anonim + draft:false kalır.
- MotionObserver gözlem/geri çağırım hatalarında görünürlüğü geri açar; pathname yanında query değişiminde de temizlenir (`Header` içinde Suspense). Portal dahil locale layout kapsamındadır. Hero aside yalnız translate; breadcrumb uzun ebeveynleri de erişilebilir metni koruyarak kısaltır. `safeHref` kodlanmış mailto yer tutucularını da reddeder; javascript/data zaten kapalı. Son QA: typecheck/lint/31 dosya 372 test ve `.next-prod` build geçti. 3200 `pnpm start`: istenen 6 rota 200, `/tr/olmayan` 404, SSR pending=0, Mono preload=0; süreç kapalı. 3100 ve `.next` sürecine müdahale yok; commit yok.
- QA komut notu: build ile typecheck eşzamanlı çalıştırılmaz (üretilen `.next-prod/types` dosyaları yenilenir). Doğrudan `node node_modules/next/dist/bin/next start`, pnpm shim'in NODE_PATH ayarını atladığından `libsql` bulamadı; repo/systemd'nin desteklenen `pnpm start` akışı geçti.

- F2 animasyon + G görsel turu (2026-11-07): `Reveal` silindi; `src/lib/anim.ts` (`anim(i)`, `heroIn`), `src/lib/motion.ts` (çekirdek), `components/ui/motion-observer.tsx` (tek IntersectionObserver, `Header` içinde bağlı; layout.tsx Terra'da olduğu için). Gizli durum yalnız JS ile `data-anim-state="pending"`; `html[data-motion="none"]` desteklenir (ayar alanı F7). Hero CSS keyframe (h1/lead yalnız translate). Header açık teması yalnız `/hesap`; tüm başlık sayfaları koyu hero. Tokenlar `globals.css` `:root` (--dur-*, --stagger). Lighthouse mobil 100, CLS 0, JS gzip ~192 KB değişmedi (motion paketi Terra). `docs/qa/visual-baseline.md` güncellendi.


- F0 tarayıcısız ölçüm kısmi (2026-11-07): `docs/perf/baseline.md`, `scripts/perf-isr.ts`; 144 sitemap URL iki GET, 122 HIT/HIT, 22 cache başlıksız, tümü 200. Üç izole build: biri `/500` prerender hatası, ikisi başarılı; doküman timeout tekrarlanmadı, kök neden doğrulanmadı. SQLite istek sayacı/testi ve sorgu ölçümü eksik. 3300 kapatıldı, 3100'e dokunulmadı.

- Güvenlik QA (2026-11-07): lisans e-postası HTTP yanıtı sonrası, bağımsız doğrulanmış kalıcı kayıt için gönderilir; SMTP yoksa anahtar konsola yazılmaz. İstek bağlamı dışındaki atamalarda bildirim zamanlanmaz. Uygulanmış `20261107_092304_remove_sales_legal_fields` üç eski ilişki değerini siler; down değerleri geri getirmez. Migration geçmişi değiştirilmedi.

Bu dosya oturumlar arası "şu an neredeyiz" bilgisini tutar. Değişince güncelle.

## Ödeme modu planı (2026-11-08)
- Plan: `docs/plan-payments.md` (taslak, kod yok). Üç katmanlı anahtar: env `PAYMENTS_ENABLED` → `site-settings.commerce.mode` (quote|payment, varsayılan quote) → `editions.saleMode` (quote|purchase). Kapalı modda ödeme yüzeyi tamamen 404/gizli olur, veri silinmez. iyzico (TRY) + Stripe (USD/EUR) hosted redirect (SAQ-A), webhook = tetik / gerçek = sağlayıcı retrieve, idempotent fulfillment ile otomatik lisans.
- Sıra: P0 doğrulama + P1 saf çekirdek + P7 yasal taslaklar V pilotlarıyla paralel; P2-S şema V4'ten sonra (V2-S'den önce asla). 4 açık soru plan §9'da; kullanıcı yanıtı bekleniyor.

## Sıradaki iş: görsel editör pilotu (2026-11-08)
- Plan: `docs/plan-visual-editor.md` (taslak, kod yok). Kullanıcı kararı "önce ikisini dene": V3a Puck (`@puckeditor/core`) ve V3b Payload-native canvas (önce what-digital eklentisi yarım gün spike) 2–3 gün pilot, ayrı worktree/dal, şema değiştirmeden; V4'te kapılar (round-trip 0 fark, Lexical, TR/EN, public bundle, güvenlik) + ağırlıklı puanla seçim.
- Sıralı şema: V0 Payload 3.85.1→3.93.x → V1-S `motion` grubu (preset/trigger/duration/delay/easing/stagger, `auto` = eski görünüm) → V2-S ürün bağlı blokları (`productHero`…`productDocs`, yalnız products; uyumluluk modu eski sayfayı aynen çizer) + `_products_v.autosave`.
- Kurallar: veri tek kaynak `layout`, editör JS public'e gitmez, alan/seçenek/defaultValue değişmez, migration önce DB kopyası + güvenli down. 3 açık soru plan §5'te; kullanıcı yanıtı bekleniyor.

## Sıradaki büyük iş: page builder + animasyon/performans planı (2026-11-07)
- Next 15.4.11: `(frontend)/[locale]` altında `notFound()` SSR'da `__next_error__` kabuğu üretir; yerelleştirilmiş 404 istemcide RSC payload'dan görünür. HTTP testi status 404 + HTML/RSC içeriğini, `smoke.spec.ts` görünür `<main>` 404'ü kontrol eder.
- globalNotFound kapatma, sade layout, header/footer/error.tsx çıkarma, passthrough app/layout + app/not-found ve OG dosyası taşıma denendi, sonuç vermedi; page-builder fazında yeniden ele alınacak.
- Plan: `docs/plan-page-builder-animation.md` (taslak, kod yok). Ana sayfa `pages` kaydına (SiteSettings.homePage) taşınır; bloklara ortak `appearance` (tema/boşluk/hizalama/animasyon/anchor), yeni katalog/kanıt blokları, sistem sayfası bağlama, Live Preview + draft, globals tam düzenlenebilir.
- Performans: content.ts `cache()`, taslakta revalidation yok, tek IntersectionObserver (`Reveal` kaldırılır), kullanılmayan `motion` kaldırılır, Media `imageSizes`+webp srcset, Mono preload yok; bütçe LCP<2.0s/CLS<0.05/INP<200ms/LH≥90.
- Fazlar F0 (ölçüm + görsel QA) → F1/F2/F9 → F3 → F4/F5/F7 → F6 → F8 → F10 → F11; G = kullanıcı görsel hata listesi turu. 5 açık soru plan §11'de; kullanıcı yanıtı bekleniyor.

## Mevcut odak (2026-11-07, UX denetimi düzeltmeleri)
- UX denetimi 13 madde uygulandı: dil değiştirici (CMS alternates + `<link hreflang>` yedeği, `hreflangPath`), footer yasal linkleri (`kvkk-aydinlatma`, `gizlilik-politikasi`, EULA; seed + fallback + form/kayıt KVKK bağlantısı), header seed (Ürünler/Çözümler mega + Destek + Şirket + CTA; seed linkleri `type: external` + site içi yol çünkü internal link yalnız `reference` çözer), buton kontrastı kök neden `cn()` (twMerge `text-small`'u renk sanıp `text-accent-contrast`'ı siliyordu → `extendTailwindMerge`), ürün detayı tek kaynak (seed'den hero/featureGrid/specTable blokları çıkarıldı + sayfa bu blokları filtreler, ek bloklar özelliklerden sonra), form sürüm listesi (yalnız seçili ürünün sürümleri, SKU görünmez, ürün seçilmeden devre dışı; sunucu `selectionErrors` ile eşleşmeyen ürün/SKU'yu `invalid` döner), istemci doğrulaması (noValidate + satır içi hata + role=alert özeti), `[locale]/[...notFound]` catch-all → header/footer'lı 404 (arama + popüler linkler; global-not-found yalnız geçersiz locale için), favicon (`src/app/favicon.ico`, `icon.svg`, `apple-icon.png`; middleware matcher `/icon` rotasını yakaladığı için statik dosya), mobil 44px hedefler, ürün sekme çubuğu fade, JSON-LD `suppressHydrationWarning` (tarayıcı nonce özniteliğini boşaltır; CSP değişmedi), indirmeler OS etiketi yerelleştirildi + sürüm seçeneği ürün adı önekli.
- Scroll-reveal zaten ilerlemeli iyileştirmeydi (SSR'da opacity yok, reduced-motion'da kapalı); birim testle kilitlendi.
- Doğrulama: typecheck, lint, 29 dosya/345 Vitest, `NEXT_DIST_DIR=.next-prod pnpm build` geçti. Playwright (3100): dil değiştirici header/footer, 404 chrome, form sürüm filtresi + boş gönderim hataları, indirme filtreleri, mobil menü, hydration konsolu temiz. Seed importları (01-globals, 10-families-products) idempotent çalıştı. Commit yok, dev sunucuya dokunulmadı.
- Not: şu an tüm slug'lar TR=EN aynı; farklı slug'lı içerikle dil değiştirici yalnız birim testle (`hreflangPath`) doğrulandı.

## Önceki odak (2026-11-07)
- 404/güvenlik denetimi: statik medya varlık sorgusu erişim filtresiyle birleştirildi; erişilemeyen ve olmayan dosyalar 404. Geçici SQLite üzerinde gerçek sorgu ve 3200 izole prod HTTP doğrulandı. İki build'de doküman timeout tekrarlanmadı; kök neden doğrulanamadı.
- 404 düzeltmesi: layout’suz kök `not-found.tsx` → `global-not-found.tsx`; Next 15.4 `experimental.globalNotFound=true` (deneysel). Çoklu kök layout + dinamik locale için bağımsız HTML 404; catch-all gerekmez, locale loading/not-found ve OG handler konumu korundu.
- Statik medya isteklerinde kayıt yoksa `mediaRead` Payload NotFound (404) üretir; mevcut dosyalarda erişim filtresi korunur.
- Doğrulama (3200 geçici prod, kapatıldı): /tr/xyz, /en/xyz, /xyz → 404 + main içinde 404; /tr ve /admin → 200; /api/media/file/yok → 404; TR/EN OG → 200 PNG. Typecheck, 317 Vitest testi, izole .next-prod build ve 3 HTTP E2E geçti. Browser smoke macOS MachPort izni nedeniyle çalışamadı; görünürlük beklentisi korunuyor. 3100 dev sürecine dokunulmadı; commit yok.
- Faz 9 denetim düzeltmeleri uygulandı: çerezsiz Header, public ISR, CMS invalidation, hata/yükleme ekranları, SEO/OG/sitemap, CSP, next/image güvenlik sınırı, CSS reveal ve form erişilebilirliği. Mimari ayrıntılar `systemPatterns.md` Faz 9 bölümünde.
- Son doğrulama: typecheck/lint başarılı; Vitest 25 dosya/310 test geçti. `NEXT_DIST_DIR=.next-prod pnpm build` başarılı; manifestte 126 cached URL, ana sayfa TTL=3600, portal cache dışında. 3101 geçici production HTTP kontrolü: TR/EN 200, ISR HIT, form/portal no-store, ayrı admin CSP; geçici süreç kapatıldı.
- Playwright baseURL 127.0.0.1:3100: 3 HTTP testi geçti; 8 browser testi Chromium başlatılamadığı için başarısız. Chromium `/private/tmp/softmarket-playwright` altına kuruldu; macOS sandbox `MachPortRendezvous bootstrap_check_in Permission denied (1100)` veriyor. UI/klavye akışları yazıldı, tarayıcıda doğrulanmadı. Tekrar: `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/softmarket-playwright pnpm test:e2e` (izinli host gerekir).
- CSP varsayılan Report-Only; public ISR HTML statik politika, dinamik sayfalar nonce. NEXT_PUBLIC_SERVER_URL halen local; production domain verilmeden build/start açık SEO uyarısı verir. `.env`, Makefile, content-import kaynakları değiştirilmedi; şema/migration/commit/dev stop yok.
- Faz 8a QA: MCP yanıt derinliği sıfırla sınırlandı ve MCP dosya yolu kapatıldı; medya importunda 25 MiB sınırı ve bağlı medya dizini reddi eklendi. CLI artık bu çalıştırmada oluşturulan medya dosyalarını hata/rollback durumunda temizler.
- Faz 8a içerik import/MCP/Cloudflare Web Analytics uygulandı. `content/seed/schema.json`, minimal `example.json`; `pnpm content:import` (varsayılan seed), `--dry-run`, `--legal`; `make seed` önce ensure-forms çalıştırır.
- Gerçek DB iki import: 3 create → 0 create/3 update; aynı aile/ürün/sürüm #1, örnekler DB'de. Yasal taslaklar yerel DB'de yayınlanmadı; dönüşüm/yayın izole SQLite testinde doğrulandı.
- MCP `/api/mcp`, yalnız admin users API anahtarı; kurulum/izinler AGENTS.md. Yeni migration `20261106_164616_phase8a_content_mcp` uygulandı.
- Cloudflare token opsiyonel, çerezsiz; admin/portal dışı; SPA ölçümü kapalı. Harici salt okunur planın güncel repo kopyası `docs/implementation-plan.md`.
- MCP: taze handler 200/69 araç, anonim HTTP 401. Çalışan dev authStrategies HMR kaydı users API key stratejisini henüz içermediğinden geçerli anahtar HTTP 401; olağan sonraki süreç başlangıcını bekler (restart yasak).
- Faz 7 tamamlandı: i18n metinleri gözden geçirildi (tr/en anahtar ağacı eşit); README güncellendi; yasal metinler `content/legal/{tr,en}` altında TASLAK. Hukuk incelemesi bekleniyor; yayın öncesi zorunlu.
- Faz 6 tamamlandı: müşteri portalı `/hesap` ↔ `/en/account` (giriş/kayıt/şifre/doğrulama, özet, lisanslar, indirmeler, talepler, profil).
- Faz 4 tamamlandı: destek merkezi, arama ve güvenli demo/teklif/iletişim/destek formları.
- Online ödeme yok: tanıtım + teklif/demo talebi.
- Lisans modülü ve müşteri portalı hedefi korunuyor; atama yetkili yönetici panel/API/MCP üzerinden.

## Son değişiklikler
- İçerik import hata düzeltmeleri: dry-run planlanmış ilişki tablosuyla docs/releases sorgularını atlar; geçersiz DB kimlikleri açık hatayla reddedilir. Yazmasız dry-run korundu; rollback sırasında yeni medya dosyaları temizlenir, mevcut dosyalar silinmez.
- Markdown dönüşümü sonrası link/autolink URL izin listesi uygulanır; ham HTML metin olarak kalır, HTML düğümleri atılır. `01-globals.json` ortak şirket/iletişim alanları eşitlendi; şema değişmedi.
- Son kontrol: typecheck/lint geçti; Vitest 23 dosya/293 test geçti. Dry-run 88 create/0 update ve 3 global güncellemesi planladı. Gerçek yerel import/build/restart/commit yapılmadı.
- `/destek` altındaki indirme, dokümantasyon (ürün/ağaç/detay), sürüm notları, SSS ve talep sayfaları TR/EN açıldı; bilgi alanları açık tema.
- `/ara` ↔ `/en/search`, header bağlantısı, query sınırları ve sayfalama; eski `/arama` yönlenir. Arama indeksi anonim erişimde kaynak yayınıyla sınırlandırılır.
- Formlar `scripts/ensure-forms.ts` / `pnpm ensure-forms` ile idempotent oluşturuldu; `softmarket-{demo,quote,contact,support}` başlıkları sabit kimliktir. TR/EN etiketler doğrulandı.
- Zod, honeypot, IP limiti, origin kontrolü, Turnstile Siteverify ve zorunlu KVKK; `form-submissions.create = nobody`, yalnız sunucu aksiyonu `overrideAccess:true` ile yazar.
- Bildirim kayıt sonrası gönderilir; başlıklar sunucuya ait, SMTP/e-posta hatası kaydı bozmaz. `FORM_NOTIFICATION_EMAIL` isteğe bağlı; yoksa site iletişim adresleri/konsol.
- Doküman alternates/hreflang, breadcrumb, FAQPage ve sitemap tamamlandı. SQLite lokalize slug tekillik kontrolü `count` yerine sınırlı `find` kullanır (Payload 3.85 locale aktarım hatası).
- Şema/migration eklenmedi; `/hesap`, Makefile ve dev süreç değiştirilmedi.
- Ödeme API/kütüphaneleri, sipariş koleksiyonu, fiyatlar ve satın alma yolları kaldırıldı.
- SKU teklif formunda dilden bağımsız sürüm kimliği olarak korundu.
- Müşterinin firma/vergi/telefonu kaldı; fatura adresi kaldırıldı.
- Lisans create anahtarı sunucuda otomatik; abonelik süresi ve admin-only yazma erişimi korundu.
- SMTP host boş/yer tutucu ise Payload konsol adaptörü.
- Migration `20261106_151826_remove_online_sales` uygulandı; yerel DB yedeği `/private/tmp/softmarket-before-sales-removal-pfstb8pj.db`.

## Sonraki adımlar
1. İzinli hostta Chromium UI/klavye e2e ve Lighthouse; production domain + CSP Report-Only gözlemi sonrası enforce. Faz 8b backup/deploy.

## Aktif kararlar
- Satış: tanıtım + teklif; tüm sürümlerde Teklif İste.
- Yerel adres `http://127.0.0.1:3100`; veri değişikliği yalnız migration.
- Dev sunucu durdurulmaz; build yalnız `NEXT_DIST_DIR=.next-prod pnpm build` ile izole edilir. Commit yalnız açık istekle.
- Karar kaydı: `progress.md` içindeki Karar evrimi.

## Desenler ve tercihler
- Yazan ≠ denetleyen. Her fazda çapraz QA.
- Ajan çıktıları büyükse `ctx_*` araçlarıyla işlenir; ham çıktı bağlama alınmaz.
- Kullanıcı SQLite ile uğraşmak istemez: migration ve seed otomatik çalışmalı.
- Kod değişikliklerinde yalnız ilgili dosyalara dokunulur; mevcut yorumlar silinmez.
- Güvenlik: müşteri asla `licenses` yazmaz; sunucu işlemleri `overrideAccess: true` ile yapar.

## Öğrenilenler
- Varsayılan `pnpm build` çalışan `.next` çıktısını bozar; dev açıkken `NEXT_DIST_DIR=.next-prod` zorunlu.
- Codex sandbox'ında DB/HTTP için `network_access=true` gerekir.
- Media `protected` varsayılanı `true`; genel görsel yüklerken `false` ayarla.
- `localhost:3000` başka projeye ait; her zaman `127.0.0.1:3100`.

## Açık sorular / bekleyen girdiler
- SMTP sunucu bilgileri.
- Yasal metinler için hukuki onay.
- Ürün ve sürüm verileri (seed için gerçek ürün bilgisi; 5-20 örnek ürün).

## SQLite geçişi (2026-11-06)
- SQLite WAL/FULL, busy timeout 5000; Payload transaction etkin, libSQL yazma transaction `BEGIN IMMEDIATE`.
- Migration: `20261106_145404_initial_sqlite`, `20261106_150000_sqlite_integrity`.
- Tek VPS: systemd, host Caddy, Litestream; kalıcı veri `data/`, `uploads/`. Yerel port 3100.

## Son doğrulama (2026-11-06)
- Faz 4 QA: proxy başlığı kimlik doğrulaması, ortak yedek limit, zorunlu Origin ve arama LIKE joker reddi eklendi; Caddy ile uygulamaya aynı `FORM_PROXY_SECRET` sağlanmalı.
- `pnpm generate:types`, `pnpm typecheck`, `pnpm lint` başarılı; `pnpm test`: 13 dosya, 138 test geçti.
- HTTP (127.0.0.1:3100): 20 TR/EN merkez/liste/arama/form isteği 200; geçersiz sorgular ve olmayan ürün/dokümanlar 404. Geçici içerikle TR/EN ürün doküman listesi ve detayları 200; alternates ve başlık çapaları doğrulandı.
- Anonim search API taslak indeksini gizledi; lisanslı indirme adı sayfada yok, dosyası 403; public dosya 200. Doğrudan anonim form-submissions POST 403.
- Native multipart Server Action: gerçek geçerli gönderim tek kayıt oluşturdu ve başarı mesajı gösterdi; test kaydı silindi. Honeypot ve başarısız e-posta sınırları ayrıca test edildi.
- `pnpm ensure-forms` iki kez çalıştı, aynı dört kimlik korundu. Geçici içerik/dosyalar temizlendi. Build, yeniden başlatma ve commit yapılmadı.
- Canlı Turnstile/SMTP kimlik bilgileriyle dış servis testi yapılmadı; production Turnstile yapılandırılmadığında gönderim kapalıdır.
- Yerel `.env` canonical URL değeri hâlâ `localhost:3100`; HTTP testleri yalnız `127.0.0.1:3100` kullandı. Form origin kontrolü canonical URL yerine mevcut hostu doğrular; `.env` değiştirilmedi.

## Faz 6 portal kararları (2026-11-06)
- Oturum çerezi Payload'ın `payload-token`'ından ayrı: `sm_customer` (prod `__Host-sm_customer`), HttpOnly/Lax, prod Secure/Path=/. Strateji HS256/imza, zorunlu exp/customer/id/sid ve canlı Payload session kontrolü yapar. Portal güncel stratejiyi doğrudan çağırır; admin token'ı portalı açmaz.
- Koruma: `(portal)/layout.tsx` + her sayfada `requireCustomer`; middleware yalnız `/hesap|/account` için `x-sm-path` başlığı ekler; `next` -> `sanitizeNext` (yalnız site içi `/hesap/*`).
- Tüm veri `user: customer, overrideAccess:false`; talep/mesaj ve metadata tek transaction içinde yazılır. Metadata yalnız sahiplik doğrulandıktan sonra aynı transaction'da `user:null, overrideAccess:true` ile yazılır. Talep koleksiyonu da ürün lisansını kontrol eder.
- Tam lisans anahtarı sayfada yok; Server Action ile tek tıkla (sahip kontrolü). Kayıt/şifre sıfırlama kullanıcı sayılamaz yanıt verir. Profil izin listesi: name, company, phone, taxNumber.
- Müşteri kayıt/giriş/şifre işlemleri doğrulanmış Server Action üzerinden; ham REST/GraphQL login/forgot/reset kapalı. Müşterinin doğrudan güncelleyebileceği alanlar da profil izin listesiyle sınırlı. Şifre değişimi/sıfırlama aynı DB yazısında eski session'ları temizler; çıkış revocation hatasını başarı saymaz.
- `kvkkConsentAt`/`kvkkConsentVersion` yalnız doğrulanmış kayıt hook'unda sunucu tarafından yazılır; yeni migration `20261106_161413_portal_security_consent` uygulandı. Mevcut hesaplara geriye dönük onay üretilmedi.
- IP bulunamadığında ortak limit; FORM_PROXY_SECRET ile doğrulanmış IP ve hesap limitleri birlikte çalışır. Enumeration için eş KDF işi + 800–900 ms taban süre; SMTP `after` ile yanıttan sonra çalışır.
- Portal sayfaları noindex/no-store; header yalnız `signedIn` boolean'ı geçirir. Portal/destek header'ının kaydırılmadan önceki açık zemin rengi düzeltildi.

## Faz 6 güvenlik QA (2026-11-06)
- `pnpm generate:types`, `pnpm typecheck`, `pnpm lint`, `pnpm test` geçti: 18 dosya/223 test. HTTP: IDOR, lisanslı dosya, profil enjeksiyonu, CSRF, yönlendirme, çıkış/şifre değişimi/sıfırlama token replay, KVKK ve rate limit doğrulandı. Taze hesap yanıt süreleri yaklaşık 0,83–0,93 s aralığında örtüştü; istatistiksel sabit süre garantisi değildir.
- Tüm geçici customer/staff/ürün/sürüm/lisans/talep/mesaj/medya/search fixture'ları ve test betikleri temizlendi; FK kontrolü temiz. Build/dev restart/commit yapılmadı.
- Payload 3.85 HMR, `authStrategies` kaydını yenilemiyor: portalda yeni exp/alg kuralları HTTP ile aktif; çalışan dev REST kaydı, sunucu sırrıyla özel imzalanmış exp'siz/HS512 test token'larını halen kabul etti. Yeni stratejinin REST'te devreye girmesi olağan sonraki süreç başlangıcını bekliyor; restart talimat gereği yapılmadı.
- Chromium kurulu fakat sandbox MachPort izni başlatmayı engelledi; uygulama içi browser host da erişilemiyor. Header HTTP markup ve SSR regresyon testleri geçti; ekran görüntüsü doğrulanmadı. Canlı SMTP/Turnstile test edilmedi.

- Faz 8a medya kimliği: `media.seedPath` unique; Payload dosya adını çakışma nedeniyle değiştirse de tekrar import aynı kaydı/dosyayı günceller. Migration `20261106_165449_phase8a_media_identity` uygulandı.

## Faz 8a son doğrulama
- `pnpm generate:types`, `pnpm typecheck`, `pnpm lint`, `pnpm test` geçti: 21 dosya / 259 test. `git diff --check` temiz.
- Gerçek ikinci import ve son tekrarlar: 0 create/3 update; aile/ürün/sürüm #1, TR/EN başlıklar ve FK kontrolü temiz. Geçici admin/MCP anahtarı silindi; users=0, pages=0; yalnız örnek katalog DB'de kaldı.
- `--dry-run --legal`: 5 legal sayfa planlandı, DB'ye yazılmadı. İzole SQLite'ta legal Markdown/locale/block/idempotency ve medya çakışma testi geçti. CLI hatalı ilişki denemesi exit 1 verdi, transaction aile kaydını da geri aldı.
- Build, dev restart ve commit yapılmadı. Canlı Cloudflare token yok; beacon sınırları SSR testinde doğrulandı. MCP dev HMR ve harici salt okunur kaynak plan sınırı yukarıda kayıtlı.
- F7 güvenlik/kalite denetimi (2026-11-07): `publicImage` yalnız açıkça `protected: false` ve image MIME olan medyayı kabul eder; duyuru gizleme durumu içerik kimliğine bağlandı. Route saldırı girdileri ve normal + `_v` eski bağlantı verisiyle migration transaction geri alma testi genişletildi. typecheck/lint/516 test, kopya DB ile `.next-prod` build ve 3200 HTTP dumanı geçti; 3200 kapatıldı, 3100 ve canlı migration'a dokunulmadı. Tarayıcıda hydration etkileşimi ayrıca doğrulanmadı.

## G2 düzeltmeleri (2026-11-08)
- Yasal sayfalar içerikte taslak işareti (`TASLAK —`/`DRAFT —` başlığı ya da `[BÜYÜK HARF]` yer tutucusu) taşıdığı sürece `noindex,nofollow` ve sitemap dışı (dil bazlı; `getSitemapEntries` her locale için `layout` sorgular). Editör içeriği temizleyince kendiliğinden açılır; footer bağlantıları kalır. `hasPlaceholder` `src/lib/utils.ts`'te dışa açıldı.
- Ürün hero: Teklif İste (`?urun=`) birincil, Sürümler ikincil. Sürüm notları: ürün grupları, son sürüm açık, eskiler `<details>`. MediaCard yer tutucu kapağı href hash'inden deterministik.
- SEO plugin `fields: localizeSeoFields` (admin-i18n.ts). Şema değişmedi.
- 2026-11-08 F11 diff güvenlik/kalite denetimi: yasal taslak Lexical metin parçalanması/büyük-küçük harf ve sitemap eksik doğrulama fail-closed; header istemci navigasyonunda yeniden bağlanır, odaklı panel hover çıkışında kapanmaz, mobil body scroll kilidi ve hızlı yeniden açmada close yarışı düzeltildi. `pnpm typecheck`, `pnpm lint`, `pnpm test --maxWorkers=1` (54/698), kopya DB ile `.next-prod` build ve 3200 HTTP duman (EULA noindex, sitemap yasal yok) geçti. Sans/mono TR+EN glifleri doğrulandı. Playwright Chromium MachPort sandbox 1100 nedeniyle başlatılamadı; iOS cihaz testi yapılmadı. 3200 kapatıldı; 3100/canlı DB/.next korunuyor, commit yok.
- Mobil menü (native dialog) Tab/Shift+Tab döngüsü initSheet içinde (header-nav.ts): Chromium fokusu tarayıcı arayüzüne bırakıyordu; e2e tam + isolated yeşil.

## 2026-11-08 V2 ürün sayfası bağlı blokları
- V2 tamamlandı: ürün sayfası 8 bağlı blok (`src/blocks/product-bound.ts`). "Teklif İste" (editions) zorunlu: taşınabilir; silinemez/gizlenemez/çoğaltılamaz (sunucu doğrulaması + render geri ekleme).
- Ürün hero tek ve her zaman ilk; aşağıdaysa sunucu sessizce başa taşır. Boş/eski layout eski düzenle birebir.
- Migration `20261108_130717_v2_product_bound_blocks` yalnız CREATE/ADD; yedek scratchpad `softmarket-pre-v2.db`. Ürün sekme anchor'ları `.product-anchor`; ValidationError'a `req.t` verilir (TR toast).
- Ödeme P1 çekirdeği commit 16b565e (`src/lib/payments`, rota/UI'ye bağlı değil).
- Sıradaki: V3a Puck pilotu ve V3b native canvas pilotu (ayrı worktree, port 3510/3520, migration yok), sonra kullanıcının 8 görevlik testi. Bilinen sınır: Payload FieldLabel locale etiketi "— Türkçe" her admin dilinde aynı.
- content:import karar b denetimi (2026-11-08): kompozisyondaki mevcut ürün + eski seed -> layout TR/EN dönüşümünden önce çıkarılır (eski ilişki/Markdown hatası import'u düşürmez); diğer alanlar güncellenir, tek uyarı, hata yok. `draft:true` aynı req/transaction ile en son taslak/autosave'ı okur; import korunmuş taslak kompozisyonu da yayınlar. Layout yapısı ortak, blok metinleri lokalize; tek dilde kompozisyon seed'i yazmadan reddedilir. Kompozisyon seed'i V2 doğrulamasına tabidir, pages etkilenmez. Geçici SQLite'ta gerçek rollback dry-run, aynı transaction'daki taslak, TR/EN metin/ayar/ID koruması ve idempotans doğrulandı (`content-import.test.ts`, `product-bound-db.test.ts`); kapı sonuçları `progress.md` başında.

## 2026-11-08 V4 görsel editör kararı
- Karar: Payload-native canvas. Puck bırakıldı (etiket `archive/pilot-puck`). Ayrıntı: `docs/editor-pilot/decision.md`.
- Sıradaki: V5 `feat/visual-editor`. Görsel editör varsayılan, form dar yan panel.

## 2026-11-16 V5 main'de
- V5 görsel editör `main`e alındı (merge dff005b, düzeltmeler d40cb7f). Eşzamanlılık: `editorVersion` anlık-görüntü hash'i + 409, süreç içi transaction sırası, istemci merge. Pilot worktree'ler kaldırıldı; etiket `archive/pilot-native-canvas` (yerel).
- Sıradaki: ödeme P2-S şeması, ikinci dalga koleksiyonlar, V6 kabul.

- P2-S denetimi: sipariş satırı/net/KDV toplamları tutarlılığı, payment-event commit doğrulaması ve terminal durum koruması, fulfillment commit doğrulaması ve commerce verisi bulunan migration down koruması eklendi; izole SQLite regresyonları eklendi.

## 2026-11-16 Ödeme P4 (commit yok)
- Webhook/callback/reconcile yazıldı (şemasız). Karar: `server-only` paketi yok (CLI/vitest'i kırar) → istemci import grafiği testi. Drain dışı imzalı olay `ignored` + 200, imzasız 404. SMTP yoksa sipariş e-postası atlanır. Sıradaki: P4 bağımsız QA, sonra P5 checkout UI; sandbox anahtarlarıyla iyzico webhook/retrieve doğrulaması.

## P7 commerceLegal bağımsız denetim — 2026-11-16 (tamamlandı, commit yok)

- EN fallback/boş-gizli hukuki metinle legalReady açılması, eksik yer tutucu algılama, eşzamanlı taslak tür çakışması, yeniden adlandırılmış yasal URL sızıntısı ve importer symlink okuması düzeltildi. Header/footer iç referans projeksiyonu korundu; TR/EN metin tutarlılığı düzeltmeleri yapıldı.
- Teknik taslak kontrolü hukukçu onayını doğrulamaz (P3); kılavuz ve plan açıklar. Ayrıntı `docs/plan-payments.md` P7 denetim kaydı.
- Canlı DB/3100/.next, P4 dosyaları, techContext ve commit korunuyor. Migration değişmedi; geçici SQLite up/down ve NULL/UNIQUE/sürüm testleri var. Kapı sonucu aşağıda.
- Son kapılar: `pnpm typecheck` ve `pnpm lint` exit 0; `pnpm test --maxWorkers=1`: **84 dosya / 1397 test, tamamı geçti (314,55 sn)**. P4 kaynaklı kırık yok. `git diff --check` temiz. **P7 migration canlıya güvenli: EVET; P7 kapsamı commit edilebilir: EVET** (commit atılmadı).
