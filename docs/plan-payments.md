# Plan — Optional online payments (`Teklif iste` / `Ödeme al`)

> Status: **P6 admin operations written (2026-11-17, no schema, awaiting QA: admin refund/cancel/resend, Stripe dispute → suspended, refund reconciliation, `/yasal` static→dynamic 500 fix)**; **P5 checkout UI + portal orders written (2026-11-16, no schema, awaiting QA, `checkoutReady` enabled; site unchanged as `open` is closed in default setup)**; **P3 mode gate and visibility passed independent QA (2026-11-16, open payment surfaces no-store, no schema, no checkout)**; **P1 schemaless core written**; **P4 webhook/callback/sync/fulfill/reconcile written (2026-11-16, no schema, awaiting QA, checkout still closed)**; **P2-S schema + store written (2026-11-16, awaiting QA, not applied to live DB)**: migration `20261116_141401_p2_payments_commerce`, `orders`/`payment-events`, `editions.saleMode/pricing`, `site-settings.commerce.{mode,providers,vat,quoteSince}`, `src/lib/payments/store/**`. No routes/UI/webhooks (P3–P5).
> Sources: `memory-bank/*`, `AGENTS.md`, `docs/implementation-plan.md` (initial plan §5 payment flow), `docs/plan-visual-editor.md` (V0–V6, schema order), migrations `20261106_151826_remove_online_sales` and `20261107_092304_remove_sales_legal_fields`, existing code (`Editions`, `Licenses`, `Customers`, `SiteSettings`, `src/access`, `src/lib/{licenses,portal,forms,email,mcp,csp,request-guards,legal-draft}`, `middleware.ts`, product page, `EditionCard`, portal `/hesap`).

## User request and decisions

- Request (verbatim): "Keep the payment system on the site as well. It just needs to be completely removable based on selection. In the admin panel this option will be: request a quote, accept payments. This balance needs to be set well."
- K1 **Site-wide + per-edition.** `site-settings` master switch. When "Quote only" is selected, the entire payment surface is closed: pricing, checkout, payment pages, webhook endpoints, order menus, and sales legal text links. When "Payments open" is selected, each edition is additionally marked as `Teklif iste` (Request a quote) or `Satın al` (Buy).
- K2 **Providers:** ~~iyzico (TRY) and Stripe (USD/EUR)~~ → **Updated with P0 finding:** iyzico is the primary provider for TRY/USD/EUR. The Stripe adapter is ready in code, but **disabled by default** (see below). Each can be toggled separately in Admin.

### P0 finding (2026-11-08): Stripe is unavailable in Türkiye

- **Türkiye is not on Stripe's list of supported countries.** A Türkiye-based company cannot open a Stripe account ([stripe.com/global](https://stripe.com/global), checked 2026-11-08).
- **Result:** iyzico is the primary provider for **all currencies (TRY/USD/EUR)**. Checkout Form supports USD/EUR ([CF Initialize](https://docs.iyzico.com/en/payment-methods/checkoutform/cf-implementation/cf-initialize) `currency`: TRY, USD, EUR, GBP, NOK, CHF). Foreign-currency authorization is requested separately in the merchant agreement (§9).
- **The Stripe adapter is ready in code, disabled by default.** It is enabled with `PAYMENTS_STRIPE_ENABLED=true` only for cases like a foreign legal entity. Even then, only `PAYMENTS_STRIPE_CURRENCIES` (default USD,EUR) goes to Stripe; TRY never goes to Stripe.
- **iyzico signatures verified from official documentation:**
  - [IYZWSv2](https://docs.iyzico.com/en/getting-started/preliminaries/authentication/hmacsha256-auth): `hex(HMAC-SHA256(secretKey, randomKey + uriPath + body))`, header `IYZWSv2 base64("apiKey:…&randomKey:…&signature:…")`.
  - [Response signature](https://docs.iyzico.com/en/advanced/response-signature-validation): CF retrieve order `paymentStatus:paymentId:currency:basketId:conversationId:paidPrice:price:token`. Trailing zeros in prices are stripped. The official sample vector is used in tests.
  - [Webhook `X-IYZ-SIGNATURE-V3`](https://docs.iyzico.com/en/advanced/webhook) (HPP/CF): `hex(HMAC-SHA256(secretKey, secretKey + iyziEventType + iyziPaymentId + token + paymentConversationId + status))`.
  - [CF Retrieve](https://docs.iyzico.com/en/payment-methods/checkoutform/cf-implementation/cf-retrieve): `fraudStatus` 1 = approved, 0 = review, -1 = rejected. [Refund v2](https://docs.iyzico.com/en/advanced/refund-and-cancel): `paymentId` + `price`.
- **Stripe webhook signature** ([docs](https://docs.stripe.com/webhooks/signature)): `Stripe-Signature: t=…,v1=…`, `HMAC-SHA256(secret, "t.body")`, 300 s tolerance.
- K3 **Automatic license.** Once payment is verified, the license is assigned automatically, the customer receives an email, and sees the license in the portal. An admin can revoke the license.

## History: what was removed and will not return

Payment code was already absent in the initial commit. Only traces remained in migrations.

| Removed (migration) | Decision |
|---|---|
| `orders`, `orders_items`, `orders_webhook_events` tables (`151826` up; schema documented in `151826` down) | **Returns with a new design.** Old down() is used as reference, not executed verbatim. Amounts are **integer minor units (kuruş/cent)** instead of `numeric`. Webhook events are stored in a separate, uniquely indexed collection instead of an array. Consent proof is expanded |
| `licenses.order_id` (FK, dropped via `__new_licenses` rebuild) | **Does not return in this form.** The link is established on the new `orders_items.license_id` side. Thus no FK column is added to the existing table and down() stays safe (§2.4) |
| `editions.prices_{try,usd,eur}`, `vat_rate`, `purchasable` | Returns under new names: `saleMode` + `pricing` group. Old column names are not reused |
| `customers.billing_address_*` | **Does not return.** Billing info is stored as a point-in-time snapshot on the order. On the next order, the form is prefilled from the customer's last order |
| `site_settings.commerce_checkout_enabled` | Replaced by `commerce.mode` (`quote`/`payment`) |
| `site_settings.legal_{distance_sales,pre_information,refund}_id` (FK; dropped in `092304` up via `__new_site_settings`) | **Does not return as FKs.** Sales texts are marked with the `pages.commerceLegal` select field (no FK, DROP COLUMN works in down) |
| `stripe`, `@react-email/*` packages | **Neither returns.** A fetch client and our own signature verification suffice for Stripe (no dependency added for a default-off adapter). Existing `src/lib/email/template.ts` is used instead of React Email |

---

## 1. Mode model

### 1.1 Three-layer switch (the outermost layer wins)

| Layer | Where | Who changes | Effect |
|---|---|---|---|
| **Capability** `PAYMENTS_ENABLED=true` | env (systemd EnvironmentFile) | Operator | If `false` or absent, the payment code path **never opens**: the admin `Ödeme al` (Accept payments) option is rejected in validation, all payment routes return 404, and the drain window does not apply either. Default `false`. Nothing changes in the existing setup |
| **Site mode** `site-settings.commerce.mode` | DB | Admin only, **panel session** only (cannot be changed via API key/MCP, §4.6) | `quote` (default) / `payment` |
| **Edition** `editions.saleMode` | DB | Admin (editor cannot change) | `quote` (default) / `purchase`. Only meaningful while site mode is `payment` |

Single decision function: `src/lib/commerce/state.ts` → `getCommerceState()`. This function is server-only and works with React `cache()` + `unstable_cache` (tag `commerce`, revalidated in global afterChange). Returned value:

```text
{ capability, mode, open, providers: { iyzico: { enabled, configured, env: 'sandbox'|'live' }, stripe: {...} },
  currencies: ('TRY'|'USD'|'EUR')[], legalReady, drainUntil }
```

`open = capability && mode==='payment' && at least one provider (enabled && configured) && legalReady`. Any code touching the payment surface **only** queries this function; env or global is never read directly (forbidden by test: grep guard).

Per-edition action is determined by a pure function: `resolveEditionOffer(edition, state)`. The result is `{ kind: 'purchase', prices: [{currency, amountMinor, provider}] } | { kind: 'quote' }`. **Fail-to-quote principle:** if the price is missing, the currency's provider is disabled, a legal text is a draft, or the mode is closed, the result is `quote`. A broken `Satın al` (Buy) button never appears under any condition.

### 1.2 SiteSettings additions (new `Satış ve ödeme` (Sales & payments) tab)

| Field | Type | Default | Note |
|---|---|---|---|
| `commerce.mode` | select `quote`/`payment`; labels `Teklif iste (ödeme kapalı)` / `Ödeme al` | `quote` | Existing `commerce` group (quoteForm/demoForm) is preserved, fields are added alongside |
| `commerce.providers.iyzico.enabled` | checkbox | `false` | |
| `commerce.providers.stripe.enabled` | checkbox | `false` | |
| `commerce.quoteSince` | date, readOnly, populated by hook | — | Written on `payment → quote` transition (drain window, §1.4) |
| `commerce.status` | `ui` field (no schema) | — | Readiness checklist and provider environment (**SANDBOX/LIVE**, from env, read-only). Shows no secret values; only reports "defined/missing" |

**Secret keys are not stored in the DB.** Env vars: `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, `IYZICO_BASE_URL` (sandbox/live; environment is derived from this value), `PAYMENTS_STRIPE_ENABLED` (default `false`), `PAYMENTS_STRIPE_CURRENCIES`, `STRIPE_SECRET_KEY` (preferably restricted `rk_`; `sk_test`/`rk_test` prefix = test), `STRIPE_WEBHOOK_SECRET`. When the Stripe env is off, the Stripe toggle in admin appears "unconfigured" and cannot be enabled. Test/live selection cannot be made from admin; env determines it, admin only displays it. If sandbox keys are used in production, a red `TEST MODU` (TEST MODE) banner appears in checkout and admin.

**Readiness validation** (`validate` on `commerce.mode`, only when `payment` is selected): capability must be enabled; at least one provider must be enabled and configured; the three sales legal pages (§5) must be published and `isLegalDraft` must return false in production; `company.legalName/taxNumber/taxOffice/mersisNo` and `contact.address/email/phone` must be filled; SMTP must be configured. Missing items are returned as a TR/EN list and saving is rejected. Thus sales cannot take place with draft agreements.

### 1.3 Edition additions

| Field | Type | Default | Note |
|---|---|---|---|
| `saleMode` | select `quote`/`purchase` | `quote` | Admin condition: editable only while site mode is `payment`, otherwise description `Site yalnız teklif modunda` (Site is in quote-only mode) is shown. Value is preserved |
| `pricing.taxMode` | select `inclusive`/`exclusive` | `inclusive` | VAT included/excluded |
| `pricing.vatRate` | number 0–100, integer | `20` | |
| `pricing.try` / `.usd` / `.eur` | number, ≥0, at most 2 decimals | empty | Admin enters decimal (1250.00). Server converts to minor units with `Math.round(x*100)`. Empty price means no sales in that currency |

- Field access: for `saleMode` and `pricing`, **update = admin** (editor edits edition copy, cannot change pricing or sale mode). Read = anyone, but public queries (`site.ts`) select the `pricing` field **only when `open`**.
- At least one price is required on an edition with `purchase` selected (`validate`).
- `content:import` **continues not to accept** pricing and sale mode (AGENTS rule "Price/ID are not accepted" is preserved). Starter and seed editions stay `quote`. Test: import schema rejects a record containing `pricing`/`saleMode`.

### 1.4 Surfaces closed in "quote only" mode (acceptance checklist)

| Surface | Payments open | Quote only |
|---|---|---|
| Edition card / `productEditions` / `productHero` | Price + `Satın al` (`purchase`) or `Teklif iste` | Only `Teklif iste`, **no** price in HTML |
| `/tr/hesap/satin-al/[sku]` ↔ `/en/account/checkout/[sku]` | Open (login required) | `notFound()` 404 |
| `/hesap/siparisler[/no]` ↔ `/account/orders[/no]` | Open | 404, absent from portal menu. Open question S3: read-only view for customers with past orders |
| Webhook/callback endpoints | Open | **404** after drain. Drain: 72 hours from `quoteSince`, only events with valid signature **and** belonging to an order existing in DB are processed. If capability env is off, drain does not apply, direct 404 |
| Admin `Satış` (Sales) group (`orders`, `payment-events`) | Visible | `admin.hidden` (in-process cache; updated by global afterChange and onInit, single-process assumption). **Data is not deleted**; access rules do not change, admin can read via direct URL |
| JSON-LD `offers` | Only on `purchase` + validly priced editions | Absent |
| Sitemap | Checkout/orders absent in all modes (noindex) | Sales legal pages excluded from sitemap |
| Footer/links | Sales legal links and provider logo strip (iyzico merchant requirement) | Links pointing to sales legal pages are dropped in the resolver. `/yasal/<slug>` 404 + noindex |
| CSP | Provider origins in `form-action` only on checkout path | No extra origin (path match + env capability) |
| MCP | `orders` disabled (§4.6) | Same |
| Email | Order/refund emails | Not sent (no new orders can be created) |

Mode change triggers `revalidatePublicContent()` (global hook already exists). Edition save refreshes the product page (`revalidate.ts` coverage verified in P3).

### 1.5 Backward compatibility and data preservation

- After migration `mode=quote`, all editions `saleMode=quote`, prices are empty. **The site is pixel- and HTML-identical to today** (P3 acceptance: 0 screenshot diff, no price/checkout trace in HTML).
- `payment → quote` transition: orders, payment events, and licenses remain. Pending orders can complete during the drain window, after which the reconcile job marks them `cancelled`. Admin sees a warning "There are N pending orders" when saving.
- `quote → payment` transition: previous `saleMode` and prices return intact.
- `purchase → quote` (edition): open pending orders are unaffected; no new checkout opens.
- Automatically assigned licenses remain valid even if the mode changes; license validity is independent of mode.

---

## 2. Data model

### 2.1 `orders` (new collection, admin group `Satış` (Sales))

| Field | Note |
|---|---|
| `orderNumber` | `SM-YYMMDD-XXXXXX` (CSPRNG base32), unique. Sequential numbers are not used (volume does not leak). Used as URL and provider `conversationId`/`client_reference_id` |
| `customer` | relationship → customers, indexed. Nullable in DB (`set null` if customer is deleted; snapshot remains) |
| `status` | `pending`/`paid`/`fulfilled`/`failed`/`refunded`/`cancelled`, indexed |
| `items[]` | `edition` (rel), `sku`, `title` (snapshot, in order locale), `licenseType`, `durationMonths`, `seats`, `unitNetMinor`, `vatRate`, `vatMinor`, `lineTotalMinor`, `license` (rel → licenses, written by fulfillment). In v1: **single item, quantity 1** |
| `currency` | `TRY`/`USD`/`EUR` |
| `subtotalMinor`, `vatMinor`, `totalMinor` | Integer. `taxMode` and `vatRate` are stored on the item |
| `provider` | `iyzico`/`stripe` (derived from currency, never from client) |
| `providerEnv` | `sandbox`/`live` |
| `providerRef` | Stripe Checkout Session id / iyzico token. Unique (`provider`+`providerRef`) |
| `providerPaymentId` | Stripe PaymentIntent / iyzico paymentId |
| `idempotencyKey` | Unique. Server-generated single-use token in checkout form + customer. Double submit returns the same order. Also used as `Idempotency-Key` in Stripe requests |
| `paidAt`, `fulfilledAt`, `refundedAt`, `cancelledAt` | |
| `failureReason` | Short code (`card_declined`, `amount_mismatch`, `expired`, …). Raw provider message is not written |
| `requiresReview` | Cases such as amount/currency mismatch, edition cancelled after payment. Fulfillment is skipped, admin receives email |
| `billing` (group) | `type` (`individual`/`corporate`), `name`, `company`, `identityNumber` (TCKN 11 digits, algorithm-checked) / `taxNumber` (VKN 10 digits), `taxOffice`, `email`, `phone`, `addressLine`, `district`, `city`, `postalCode`, `country`. **Field read: admin + owner customer**; editor cannot see |
| `consents` (group, read-only) | `preInformationVersion`, `distanceSalesVersion`, `digitalWaiverAccepted` (withdrawal exception consent, §5), `acceptedAt`, `ip`, `userAgent` (first 200 chars), `snapshotSha256` |
| `contractSnapshot` | Pre-information + agreement HTML generated at consent time (order summary populated). Read-only. This is the text sent via email and stored as proof |
| `locale` | `tr`/`en` |
| `invoice` (group) | `number`, `issuedAt`, `note`. Admin enters manually; e-archive integration is out of scope |
| `notes` | Staff only |

Access: read = staff (admin+editor) or owner customer (`isOwnerCustomer`; sensitive fields restricted to admin via field access). Create = `nobody` (server only, `overrideAccess:true`). Update = admin, only `invoice`, `notes`, and `requiresReview` (other fields field-level `update: nobody`). Delete = `nobody`; orders are never deleted due to VUK/TTK retention period.

### 2.2 `payment-events` (new, hidden collection)

`provider`, `eventId`, `type`, `order` (rel, nullable), `receivedAt`, `processedAt`, `result` (`processed`/`duplicate`/`ignored`/`error`), `bodySha256`. Unique index (`provider`, `eventId`). **Raw body is not stored** (PII). Read = admin. Create/update/delete = `nobody`. Read-only under `Satış` (Sales) in Admin.

### 2.3 State machine (`src/lib/payments/state.ts`, pure)

```text
pending ──paid(verified)──▶ paid ──fulfill──▶ fulfilled
   │                         │                    │
   ├─fail──▶ failed ─┐       └──refund──▶ refunded ◀──refund──┘
   └─expire/admin──▶ cancelled ─┤
                                └─(only if provider API verifies payment, within 72h)──▶ paid  [requiresReview=true]
```

- Terminal state: `refunded`. `failed`/`cancelled → paid` exists only for out-of-order events (late successful payment) and is triggered only by the true state read back from the provider.
- `canTransition(from, to)` is a pure function. DB writes are **conditional**: `update where { id, status: { equals: from } }` inside a single transaction (SQLite `BEGIN IMMEDIATE`). If affected rows = 0, another handler won and this becomes a no-op.
- **Event = trigger, truth = provider.** Webhook, callback, return page, and reconcile job all call the same function: `syncOrderFromProvider(orderId)`. This function reads the current status from the provider using server credentials and derives the transition from there. Event order becomes irrelevant.
- Amount verification: the paid amount and currency on the provider must match `totalMinor` and `currency` exactly. If they do not match, it becomes `paid` + `requiresReview` and fulfillment is skipped.

### 2.4 License ↔ order

- `fulfillOrder(orderId)` is idempotent. For each item of a `paid` order, if `items[i].license` is empty, `licenses` create is called (`overrideAccess:true`, `startsAt=paidAt`, `customer`, `edition`). The existing `prepareLicense` hook generates the key (CSPRNG), product, seat count, and subscription end. Then `items[i].license` is written and the `paid → fulfilled` transition is performed. Everything is inside **a single transaction**; on a double call, the second call sees a populated `license` and becomes a no-op.
- Existing `notifyLicenseAssigned` (afterChange, post-commit `after()`) sends the license email. This hook is unchanged.
- On the license record, the order link is shown via a Payload `join` field (`orders` → `items.license`; no schema column). If join inside an array is unsupported, this is detected in P0 and a read-only `ui` field (with query) is used instead.
- Refund or chargeback: all licenses of the order become `revoked` (refund) or `suspended` (open dispute), and the reason is appended to `notes`. An admin can still revoke a license standalone as today; that action does not touch the order.

### 2.5 Migration strategy (single migration `p2_payments_commerce`)

- **Up only adds:** `CREATE TABLE orders`, `orders_items`, `payment_events` + indexes. `ALTER TABLE ... ADD` columns: `editions` (`sale_mode` default `'quote'`, `pricing_*`), `site_settings` (`commerce_mode` default `'quote'`, `commerce_providers_*_enabled` default `0`, `commerce_quote_since`), `pages` + `_pages_v` (`commerce_legal`). The `payload_locked_documents_rels.orders_id`/`payment_events_id` columns that Payload inevitably adds for new collections also come via `ADD ... REFERENCES` (phase8a pattern). **No `DROP`/`DELETE`/`__new_` in up**; generated SQL is manually inspected.
- **No FK columns added to existing tables** (license link is on the `orders_items` side, legal page link is on the `pages.commerce_legal` select field). The only exception is Payload's lock table.
- **Safe down():** (1) If any `orders` or `payment_events` row exists, it **throws an error and deletes nothing** (sales data is preserved). (2) If empty, drops the new tables. (3) For added columns without FKs, drops indexes first, then runs `DROP COLUMN`. (4) `payload_locked_documents_rels` FK columns cannot be dropped in SQLite; here the temp-table-preserving rebuild pattern proven in `151826` is used. This is the only place in this plan where `__new_` is used in down, and it is locked by test.
- Flow (permanent rule 6): DB copy → `pnpm migrate` → up/down/up cycle → `content:import --dry-run` → `sqlite-integrity` → `PRAGMA foreign_key_check` = 0 → live backup (incl. WAL/SHM) → live migrate.
- Test `tests/unit/payments-migration.test.ts`: copy DB, 0 old row-count diff, no forbidden statements in up SQL, down rejected when `orders` is non-empty, schema after down when empty = previous snapshot.

---

## 3. Flow

```text
Edition card "Buy" (currency selected)
  → /tr/hesap/satin-al/<SKU>?c=TRY      (portal guard: login/register, email must be verified; return path preserved)
  → Checkout page (dynamic, nonce, no-store, noindex)
       • server price + VAT breakdown (Intl, on server)
       • billing: individual/corporate, TCKN|VKN, tax office, address (prefill from last order)
       • pre-information form: order summary + text shown on page (scrollable area)
       • [ ] I have read the pre-information form   [ ] I approve the distance sales agreement
       • [ ] I consent to immediate performance of digital content, I know my right of withdrawal will end (required for individual)
  → Server action startCheckout (origin guard, rate limit, Zod, idempotency token)
       • edition re-read, resolveEditionOffer → if not purchase, 409/redirect to quote
       • amount calculated ON SERVER; client amount/currency/provider not used (only c ∈ allowed currencies)
       • order(pending) + consents + contractSnapshot (single transaction)
       • provider.createCheckout(order) → hosted URL
  → 303 redirect: iyzico Checkout Form paymentPageUrl | Stripe Checkout Session url   (card data never touches our site — SAQ-A)
  → Return:
       iyzico: browser cross-site POST {token} to callbackUrl  → /api/payments/iyzico/callback
               (due to SameSite=Lax, session cookie DOES NOT arrive; session not required) → order found by token
               → syncOrderFromProvider (CheckoutForm retrieve, server key) → 303 /hesap/siparisler/<no>
       Stripe: success_url /hesap/siparisler/<no>?s={CHECKOUT_SESSION_ID} (GET, session present)
               → page ownership check + if pending, syncOrderFromProvider (accelerator; primary source is webhook)
  → Webhook (primary source): /api/payments/stripe/webhook, /api/payments/iyzico/webhook
       signature → dedupe(payment-events) → syncOrderFromProvider → fulfillOrder
  → paid → fulfilled: license generation (generate.ts) + license email + order confirmation email (agreement copy attached/in body)
  → Portal: My Orders (status, amount, invoice no, agreement copy) + My Licenses (existing)
```

- **Currency ↔ provider mapping** is kept in one place: `providerForCurrency()` (`src/lib/payments/mode.ts`). Default **all iyzico**. Stripe takes USD/EUR in `PAYMENTS_STRIPE_CURRENCIES` only when `PAYMENTS_STRIPE_ENABLED=true`; TRY never. Default currency is TRY in TR locale, USD in EN locale; the user can choose only among currencies whose price and provider are enabled.
- Provider abstraction `src/lib/payments/providers/types.ts`:
  `createCheckout(order, urls) → { providerRef, redirectUrl, expiresAt }`, `retrieve(ref) → ProviderPaymentState`, `verifyWebhook(rawBody, headers) → VerifiedEvent | null`, `refund(order) → RefundResult`.
- **Stripe (disabled by default):** no SDK; fetch client, `Stripe-Version` pinned. Checkout Session `mode: payment`, `price_data` (server amount), `client_reference_id`, `metadata.orderId`, `expires_at` +30 min, `customer_email`. Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded/failed`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.created/closed`. Signature via our own `verifyStripeSignature` (300 s, `timingSafeEqual`).
- **iyzico:** because the official `iyzipay` package is old and callback-based, a **thin fetch client** (`IYZWSv2` HMAC auth) is used (written in P1). Checkout Form initialize `paymentPageUrl` is used. **Embedded `checkoutFormContent` script is not used** (CSP/SAQ-A). `basketItems` sum = `price`, `paidPrice` = total. Buyer fields come from the billing snapshot. Webhook signature is `X-IYZ-SIGNATURE-V3` (field order in P0 finding). The `signature` field of the retrieve response is also verified; if missing, reject. `enabledInstallments: [1]` (so installment difference does not alter `paidPrice`). Unless `fraudStatus` is 1, it is not considered paid. Webhook is trigger only; state is always read via retrieve.
- **Timeout:** pending orders older than 60 minutes are queried at the provider in the reconcile job; if unpaid, they become `cancelled`. Reconcile: `pnpm payments:reconcile` + systemd timer (15 min). This job does not touch the Next cache.
- No cart (v1): single edition, quantity 1. Multi-seat and enterprise purchases stay on `Teklif iste` (Request a quote).

---

## 4. Security

### 4.1 Card data and PCI

Card data never passes through our site: full-page redirect to the provider is performed, no iframe or third-party script is used. Target PCI-DSS **SAQ-A**. The checkout page contains no third-party JS; the Cloudflare beacon is already not loaded as it falls under the portal boundary. 3DS/SCA happens on the provider's hosted page.

### 4.2 Webhook

- Raw body is read with `await req.text()` up to 256 KB. Signature is verified first, then JSON is parsed.
- Stripe: 300 s tolerance (replay) + dedupe via `payment-events` unique index. iyzico: HMAC V3 + (`paymentId`, `status`, `eventType`) dedupe + retrieve.
- Responses: invalid signature → 400 (empty body, no details). Valid but unknown order → 200 (logged, stops retries). Processing error → 500 (provider retries). Duplicate event → 200. Mode closed and outside drain → 404.
- Routes under `src/app/(payload)/api/payments/**/route.ts` (existing `preview` pattern, Node runtime, `dynamic='force-dynamic'`). Matched before Payload catch-all.
- iyzico callback is a cross-site POST: only `token` is read, status info in body is not trusted. No origin check is performed, but processing relies solely on the server retrieve result and the response is only 303.

### 4.3 CSRF, origin, rate limit

- `startCheckout` is a server action. It passes through the existing `forbiddenActionOrigin` middleware check and uses the existing `src/lib/forms/security.ts` limiter: 5 attempts per minute per IP (Caddy verified header) and per customer, 20 pending orders per hour. Turnstile is not needed (session + email verification present); can be enabled on abuse.
- Order pages perform an ownership check (`isOwnerCustomer`). Another customer's order number returns 404 (existence is not leaked).

### 4.4 CSP

`usesNonce` already covers account paths. New `contentSecurityPolicy({ checkout: true })` adds `https://checkout.stripe.com` and iyzico sandbox/live payment page origins to `form-action` only on `/(tr|en)/(hesap|account)/(satin-al|checkout)/` and when `PAYMENTS_ENABLED=true` (Stripe origin only when `PAYMENTS_STRIPE_ENABLED=true`) (governs the JS-free POST→303 chain with Chrome `form-action`). **No provider is added** to `script-src`/`frame-src`/`connect-src`. Test: in quote mode and on all other paths, the policy remains identical to today.

### 4.5 Secret keys and logs

- Keys are kept only in env (`.env` 600, systemd `EnvironmentFile`). Placeholder `CHANGE_` is written to `.env.example`. Provider clients are server-only modules (`import 'server-only'`); the bundle guard forbids `stripe`/`iyzi`/`payments` traces in public chunks.
- Log policy: order number, status, provider ref, and error code are logged. **Email, TCKN/VKN, address, card last 4 digits, full IP, raw body, and keys are never logged.** Because the console email adapter would log the entire order email, order emails are skipped when SMTP is absent (existing pattern in license emails).

### 4.6 Permissions and MCP

| Action | admin | editor | customer | MCP (admin API key) |
|---|---|---|---|---|
| `orders` read | ✓ | ✓ (billing identity/address hidden) | own only | **closed** |
| Refund / cancel | ✓ (panel session) | ✗ | ✗ | ✗ |
| `invoice`/`notes` | ✓ | ✗ | ✗ | ✗ |
| `payment-events` | read | ✗ | ✗ | ✗ |
| `commerce.mode`, provider keys | ✓ panel | ✗ | ✗ | **✗** (field access `_strategy === 'api-key'` denied) |
| `editions.saleMode/pricing` | ✓ | ✗ | ✗ | ✓ (admin key; price change affects subsequent orders, existing orders are snapshots) |
| `licenses` | existing: create/find/update | — | own read | existing (delete disabled) |

**MCP recommendation: `orders` and `payment-events` closed.** Rationale: if personal data (TCKN/VKN, address) were transferred to an LLM provider, KVKK cross-border transfer risk would arise, and agent need is low. If needed later, a PII-free summary tool (`orderSummary`: number, status, amount, SKU) can be added as a separate phase. `mcp.test.ts` locks that `orders` is absent from the tool list and `commerce` fields cannot be written via API key.

Admin refund action: `İade et` (Refund) button in `orders` document view (admin, confirmation dialog). The button calls Payload custom endpoint `POST /api/orders/:id/refund`; the endpoint performs admin check, panel session (API key rejected), and Payload CSRF/origin check. Refund at provider (Stripe Refund; iyzico same-day `cancel`, later `refund`) is executed, status becomes `refunded` after provider confirmation (webhook/sync). v1 supports **full refund** only; partial refund is done from the provider dashboard, and sync marks status as `requiresReview`.

---

## 5. Legal framework

> This section is for technical implementation; it is not legal advice. All texts are added as **drafts** and are not published without legal counsel approval (readiness validation blocks draft markers and missing content; it does not technically verify lawyer approval).

- **Law No. 6502 + Distance Contracts Regulation:** pre-information is provided before the contract and consumer consent is obtained. The contract and pre-information are delivered via a **durable medium** (order confirmation email + `contractSnapshot` in the portal). Information and documents are retained for at least 3 years; orders are never deleted.
- **Right of withdrawal exception:** services performed immediately in an electronic environment and intangible goods delivered immediately to the consumer (exception under Art. 15 of the Regulation). For this, a **separate and explicit consent checkbox** is placed ("I consent to immediate performance, I know my right of withdrawal will end"). Consent is recorded with `consents.digitalWaiverAccepted` + version + timestamp. The box cannot be pre-checked. Consumer provisions do not apply to corporate (VKN) buyers; the text is still shown, and exception consent is not required (lawyer confirmation).
- **Versioned texts:** `pages.commerceLegal` ∈ `distanceSales|preInformation|refund` (one record each, hook validates). Version identifier is the published page version's `updatedAt`. The text at consent time + order summary (seller legal name/MERSİS/address/KEP, buyer, product, VAT-inclusive total, payment method, delivery = immediate electronic, withdrawal info) are frozen inside `contractSnapshot` and its SHA-256 is stored.
- **Files to add** (pageType `legal`, `--legal` import, with `TASLAK` (DRAFT) banner + `[PLACEHOLDER]` so they fit the existing `isLegalDraft` noindex/sitemap-excluded mechanism):
  `content/legal/tr/mesafeli-satis-sozlesmesi.md`, `on-bilgilendirme-formu.md`, `iade-ve-cayma.md`;
  `content/legal/en/distance-sales-agreement.md`, `pre-information-form.md`, `refund-and-withdrawal.md`.
  EN slugs are aligned in P7 according to the existing legal filename convention (TR filename = slug). `--legal` import writes `commerceLegal` from the filename mapping.
- **Drafts to update:** `kvkk-aydinlatma.md` (payment and billing data, processing purpose, retention period, transfer: iyzico domestic; Stripe only if enabled = **cross-border transfer**; standard contractual clauses and Board notification obligation under KVKK Art. 9 to be clarified with counsel), `gizlilik-politikasi.md`, `kullanim-kosullari.md` (purchase section), `eula.md` (paid license, license revocation upon refund).
- **e-Archive / e-Invoice:** out of scope. Billing info is collected completely, admin enters the invoice number manually, portal displays it. The invoice must be issued within the legal deadline; who issues it is asked in §9.
- **ETBİS** registration and provider merchant approval are required before sales (operational prerequisite). Elements required on the site for iyzico approval (contracts, contact, logo strip) appear only in payment mode.

---

## 6. Test strategy

| Layer | Scope |
|---|---|
| Unit (pure) | `money` (minor units, rounding, inclusive/exclusive VAT, 0.01 boundaries), `pricing` (currency ↔ provider, fail-to-quote matrix), `state` (`canTransition` table for all state pairs), `resolveEditionOffer`, `getCommerceState` (env × global × provider × legalReady), TCKN/VKN validation, orderNumber format/entropy |
| Signature | Stripe: signed fixtures generated with a known secret (`tests/fixtures/payments/stripe/*.json`): valid, bad signature, expired timestamp (replay), wrong secret. iyzico: HMAC V3 fixtures. Reject when a single byte changes in raw body |
| DB (ephemeral SQLite) | `payments-db.test.ts`: same event 2× → single license. Concurrent 2 `fulfillOrder` → single license. Out-of-order (`async_payment_succeeded` → `completed`, `expired` → late `paid`). Amount mismatch → `requiresReview`, no license. Refund → license `revoked`. Chargeback → `suspended`. Customer sees only own order. Editor cannot see billing identity. Customer/editor/anonymous rejected on create REST |
| Migration | §2.5 test |
| Quote mode "absence" test | `commerce-off.test.ts` + e2e: when `mode=quote` (and also without `PAYMENTS_ENABLED`), checkout/order/webhook/callback **404**; no price, `Satın al`, `offers` in product HTML; no sales legal link in sitemap or footer; CSP byte-identical to today's string; no `Satış` (Sales) in admin nav; no orders in MCP tool list; no `Siparişlerim` (My Orders) in portal menu. Drain window: signed + existing order 200, others 404 |
| Bundle | `client-bundle-guard.test.ts`: no trace of `stripe`, `iyzi`, `src/lib/payments` in public and checkout chunks. Home page JS ≤ 130 KB gzip preserved. Checkout page extra client JS ≤ 2 KB (consent checkboxes pure HTML `required`) |
| E2E isolated | `tests/e2e/isolated/payments.spec.ts` (existing `E2E_ISOLATED` infra, port 3400). Providers run against **local fake server** (`IYZICO_BASE_URL`/Stripe `host` override; non-production only, override rejected in production). Flow: enable payment mode → edition `purchase` → login → checkout → fake hosted page → callback/webhook → license + order in portal + email (console capture, key masked). Refund flow. Quote mode absence flow |
| Sandbox acceptance (manual, runbook) | `docs/payments/sandbox-runbook.md`: Stripe CLI `stripe listen --forward-to` + test cards (incl. 3DS), iyzico sandbox test cards and webhook URL (tunnel), success/fail/3DS/refund/cancel scenarios. Results recorded in `docs/payments/acceptance.md` |
| Perf | Product page ISR HIT preserved, query count ≤ current + 0 (price comes in edition query). Lighthouse: product page LCP/JS unchanged. Payment JS only on provider page |

---

## 7. Integration with the visual editor plan

### 7.1 Schema order (single open migration branch rule)

```text
V0 ✓ → V1-S motion → V2-S bound blocks → [V3a/V3b pilot: schema lock]  → V4 decision → P2-S payment schema → V5 …
                                            ║ parallel, schemaless: P0 verification, P1 pure core, P7 legal drafts
```

- **P2-S is created after V2-S is merged to main and the pilot schema lock is lifted (V4).** `migrate:create` is not run while V1-S/V2-S are open (lesson from snapshot JSON conflicts).
- Alternative if payments are prioritized: P2-S can enter right after V2-S and before pilots start (end of day 2); pilot branches pull via `rebase main`. Payment schema changes are forbidden in pilot branches.
- P2-S has no table overlap with V1/V2 (`orders*`, `payment_events`, `editions`, `site_settings`, `pages.commerce_legal`). Since `pages` is shared, it does not enter the same migration as V1-S's `pages_blocks_*` columns and stays sequential.
- V5 (editor) does not change schema; P3–P6 run in parallel with V5. Shared file ownership is below.

### 7.2 CTA rule on product bound blocks

- User decision "Request a quote mandatory primary action" expands as follows: **`Teklif iste` (Request a quote) is visible in every mode.** In payment mode, if the page has at least one `purchase` edition, the `productHero` primary action is `Satın al` (Buy) (scrolls to `#surumler`), and `Teklif iste` becomes secondary. Otherwise, only `Teklif iste` appears as today. If `productHero` is removed, the default hero renders with the same rule.
- `productEditions` / `EditionCard`: a `purchase` edition shows price (selected currency, "VAT incl./excl." label), primary `Satın al` (Buy), and secondary small `Kurumsal teklif iste` (Request enterprise quote) link (open question S2). A `quote` edition keeps today's card unchanged.
- Single source is the pure function `resolveProductActions(product, editions, state)`. Both the old product page (compatibility mode) and V2-R components use it. Invariant locked by tests: "at least one action is visible, and quote-only in quote mode".
- **File ownership:** `edition-card.tsx`, `src/components/blocks/product/product-hero.tsx`/`product-editions.tsx` belong to V2-R. P3 touches these files **after V2-R is merged to main**. If V2-R is delayed, P3 only modifies the existing `EditionCard`, and V2-R calls the same resolver.
- Motion (V1 `motion`) does not affect pricing/CTA. Price text is never hidden by an animation starting at `opacity:0` (already covered by the LCP rule).

---

## 8. Phases

Rules: writer ≠ reviewer. In payment phases, QA is done with **highest effort**. Schema phase proceeds alone. At the end of every phase, typecheck/lint/`pnpm test --maxWorkers=1` green, followed by Haiku commit. 3100 and live DB are used only with explicit task; build `NEXT_DIST_DIR=.next-pay`, QA ports 3200/3400.

### P0 — Verification spike (0.5–1 day, no repo code)

- **Scope:** items to verify from current docs: iyzico Checkout Form `paymentPageUrl`, retrieve, refund/cancel, webhook V3 signature field order, sandbox test cards, buyer required fields (TCKN rule), USD/EUR support; Stripe API version, Checkout Session parameters, event list, restricted key permissions, **Stripe account eligibility for a Türkiye-based company**, `stripe-mock`/host override; in Payload 3.93: `join` inside array, custom endpoint CSRF behavior, conditional `update where`; SQL generated by `migrate:create` on a copy DB with draft collections.
- **Output:** `docs/payments/p0-findings.md` (with source URLs). Any unverifiable item is marked "unverified".
- **Acceptance:** every question answered or marked risky.
- **Result (partial):** Stripe TR eligibility → **not eligible**; mapping moved to iyzico (P0 finding under K2). iyzico signature formulas verified. Remaining open: USD/EUR + `VIRTUAL` basket + `identityNumber` rule for corporate buyers in iyzico sandbox, Payload `join` inside array, conditional `update where`, `migrate:create` SQL.

### P1 — Pure core (1–1.5 days, schemaless, parallel with pilots)

- **Files (written):** `src/lib/payments/{types,errors,secret,env,money,tax,mode,state,idempotency}.ts`, `signature/{compare,iyzico,stripe}.ts`, `providers/{http,iyzico,stripe,index}.ts`; tests `tests/unit/payments-{signature,mode,money,idempotency,providers}.test.ts`. `resolveEditionOffer` in `mode.ts`. `resolveProductActions`, TCKN/VKN validation, and `server-only` guard deferred to P3/P4. Mode values in core are `quote-only|payments` and `quote|buy`; `payment`/`purchase` spellings in the plan are accepted as aliases, P2-S fixes a single spelling. VAT setting per currency is `{ kind: 'rate', rateBasisPoints } | { kind: 'exempt' }`; if empty, no sales in that currency (S1) (no `server-only` guard yet: modules using `node:crypto` may fail in client builds, but it does not protect pure modules; explicit server boundary and bundle test required before integration).
- **Acceptance:** 100% branch coverage (state/money/offer), signature fixtures pass. `src/lib/payments` has server-only import. No route or schema changes.
- **Risks:** assuming the wrong signature formula. Mitigation: P0 finding + generating fixture from official sample.

### P2-S — Schema (1 day, standalone)

- **Files:** `src/collections/{Orders,PaymentEvents}.ts`, `Editions.ts` (saleMode, pricing, field access), `Pages.ts` (`commerceLegal`), `src/globals/SiteSettings.ts` (tab, readiness validation, `quoteSince` hook), `src/access/*` (orders rules), `payload.config.ts` registration, `admin-i18n.ts` (TR/EN), `src/migrations/<ts>_p2_payments_commerce.{ts,json}` (manually inspected up, protected down), `payload-types.ts`, `content/seed/schema.json` (price rejection preserved), `src/lib/mcp.ts` (unchanged: no orders; `commerce` field guard).
- **Acceptance:** §2.5 migration test. `content:import --dry-run` on copy DB 0 errors. `admin-labels.test.ts` green. Site HTML unchanged (mode=quote). MCP tool list unchanged (69 ± 0).
- **Risks:** Drizzle generating `__new_` for the lock table → manually replaced with `ADD`. Enum name length.
- **Implemented (2026-11-16):** single spelling `quote-only|payments` and `quote|buy` (aliases removed, also quote on read). Price fields `pricing.{taxMode,tryMinor,usdMinor,eurMinor}` (integer minor unit; admin enters kuruş for now). VAT per currency `commerce.vat.{try,usd,eur}.{rule,ratePercent,rateBasisPoints}` (admin enters percent, hook writes basis points; core `readVatSettings` only reads consistent basis points). New fields staff-read-only (public HTML identical), panel-admin-write-only (API key/MCP silently dropped; edition price writable by admin MCP), excluded from seed schema via `custom.contentImport:false`. No setting added for S2 (decision is fixed behavior). `pages.commerceLegal` and the legal/company/SMTP items of readiness validation deferred to P3/P7; mode validation currently requires capability + enabled provider + at least one VAT rule.

### P3 — Mode gate and visibility (1.5–2 days)

- **Scope:** `getCommerceState`, admin hidden cache, `EditionCard` + product hero CTA (resolver), price display (server Intl), JSON-LD `offers`, footer/legal link filter, `/yasal` sales page 404, sitemap, admin readiness `ui` field, edition revalidate verification. **No checkout**; even if payment mode is enabled, `Satın al` (Buy) does not go to checkout yet (feature flag: `open` also requires `checkoutReady`, enabled in P5).
- **Acceptance:** 0 screenshot diff in quote mode (1440/390, TR/EN), no price in HTML. In payment mode (sandbox env) price and offers are correct, fail-to-quote matrix passes in e2e. ISR HIT preserved.
- **Implemented (2026-11-16, P3 implementation record; no commit, no schema/migration, not written to live DB):**
  - **Mode gate:** pure `src/lib/payments/commerce-state.ts` (`computeCommerceState`) + server loader `src/lib/commerce/state.ts` (`getCommerceState`, React `cache`). `open` = env `PAYMENTS_ENABLED=true` AND `site-settings.commerce.mode='payments'` AND at least one provider (enabled in settings + configured in env) AND valid VAT rule on at least one currency. `checkoutOpen = open && checkoutReady`; `checkoutReady` is hardcoded `false` in `src/lib/payments/flags.ts` (enabled in P5). Without env capability, DB is never touched (0 extra queries on installed quote site); read error falls back to closed state. `legalReady` (three sales texts published/not draft) joins `open` in P7; currently reported only in admin readiness list.
  - **Edition action:** pure `src/lib/payments/actions.ts` `resolveProductActions` (on top of `resolveEditionOffer`). `quote` action yields today's card IDENTICALLY (tested against frozen old component). `buy` only on validly priced offer when `open`: price (server-side `Intl.NumberFormat`, input exact decimal string; headline currency per locale TR=TRY, EN=USD; VAT incl./excl./exempt label) + `Satın al` (Buy) + S2 secondary `Kurumsal teklif iste` (Request enterprise quote). While `checkoutReady` is off, `Satın al` is a **disabled button** (no href, `aria-disabled`, "coming soon" note), no checkout link in HTML; hero primary action remains `Teklif İste`. Once flag is on, button becomes a link to `/hesap/satin-al/<SKU>` (P5 route) and hero primary becomes `Satın al`. `Teklif İste` is visible in all cases (V2 mandatory block preserved).
  - **Data:** since `editions.saleMode/pricing` is staff-only read, `getProductDetail` reads pricing via `overrideAccess` only when `open` in the same edition query (query count does not increase), strips raw fields along with resolved actions; page/blocks see only `commerce` actions. In quote mode, query is identical to today (anon, same select).
  - **JSON-LD:** `src/lib/payments/json-ld.ts`: Offer only for editions with `buy` action (edition × currency, price matches page, `valueAddedTaxIncluded`); no `offers` key in quote mode.
  - **Legal sales pages (schemaless):** `src/lib/payments/legal.ts` slug constant (TR: `mesafeli-satis-sozlesmesi`, `on-bilgilendirme-formu`, `iade-ve-cayma`; EN: `distance-sales-agreement`, `pre-information-form`, `refund-and-withdrawal`). When not `open`: `/yasal/<slug>` 404 (except staff draft preview), excluded from sitemap (`src/app/sitemap.ts`), footer/header links dropped in `resolvePublicLink`. Visible when open; `isLegalDraft` noindex/sitemap rule applies verbatim. **Schema proposal (awaiting user approval):** `pages.commerceLegal` select field from plan §5 (`distanceSales|preInformation|refund`, `index`) replaces the slug list; thus matching does not break if slug changes and readiness validation can ask definitively "are all three types published". Requires migration (single `ADD COLUMN`), not added in this phase.
  - **Admin:** read-only `ui` field `readiness` in site-settings `Satış ve ödeme` (Sales & payments) section (`src/admin/fields/commerce-readiness.tsx`, `src/lib/payments/readiness.ts`): env, provider key, provider enabled, VAT, priced buy edition, legal pages (3/3), SMTP, checkout; SANDBOX/LIVE badge; no secret values; admin-only visible. `ui` field produces no schema: `pnpm migrate:create` on copy DB "No schema changes detected" (proof). Price input: `src/admin/fields/price-minor-field.tsx` (decimal box, `1.250,00` TR / `1,250.00` EN, comma/dot tolerant, pure string/integer parsing `src/lib/payments/price-input.ts`; storage same `tryMinor/usdMinor/eurMinor`; invalid text writes -1, validator rejects). Labels TR/EN (`Editions.ts`).
  - **Revalidate:** saving edition (withPublicRevalidation) and site-settings (withGlobalRevalidation) calls `revalidatePath('/', 'layout')` (tested); ISR HIT preserved (no `headers()`/`cookies()` on page; no extra DB read in quote mode).
  - **Verification (2026-11-16):** typecheck/lint clean; `pnpm test --maxWorkers=1` 78 files / 1313 tests passed (3 new files, 96 tests). Isolated build (`.next-p3`, copy DB): in quote mode 16 product pages (TR/EN) + home + list + request-quote, DOM + JSON-LD identical to HEAD (7beb228) build excluding script/hash noise (21/21); in payment mode (copy DB + env) price/VAT label/disabled Buy/S2 link/offers correct, 0 checkout links, ISR HIT, no commerce values in anonymous REST/GraphQL. Lighthouse product page (payment mode, 3-run median): Perf 100, LCP ~1.05 s mobile, CLS 0, JS ~129.6 KB (same as HEAD).
  - **Tests:** `tests/unit/payments-p3.test.ts` (pure: state matrix, fail-to-quote, price format, JSON-LD, slug, readiness, price input, bundle boundary), `payments-p3-render.test.tsx` (quote HTML = frozen old card, page HTML unchanged with quote data, payment mode TR/EN, flag on), `payments-p3-db.test.ts` (ephemeral SQLite, all migrations: product data per mode, no anonymous Local API/REST/GraphQL leak, footer/`/yasal`/sitemap, revalidate).


#### P3 independent security/quality audit — 2026-11-16

- **P0:** none found. **P1 (fixed):** open payment HTML/RSC was being written to ISR; the same production output with `PAYMENTS_ENABLED=false` returned `HIT / 200` for product price and sales legal page. `getCommerceState` calls `unstable_noStore()` on open surfaces; Next static-render signal stays outside DB/content error catchers. **ISR HIT acceptance on payment surfaces removed for security; ISR preserved in quote mode.** Root/sitemap revalidation and `quoteSince` hook also tested.
- **P2 (fixed):** absolute and normalized legal URLs on the same origin bypassed the header/footer filter; URL normalization + origin matching added. Invalid price text persisted after form reset; external value change clears error state. Readiness list marked price/VAT/provider mismatch as ready; verified with actual offer resolver. Environment badge picked disabled provider; now shows only enabled/configured providers, reports MIXED if test/live together.
- **P3 (report):** slug list is not a permanent document type; if a sales page slug is renamed outside the list, it is not recognized automatically. `pages.commerceLegal` field proposal remains for the next phase; schema was not changed in this audit.
- Anonymous Local API/REST/GraphQL did not return commerce/pricing values. In open mode, anonymous product reads stayed published; draft cookie alone did not expose product/legal drafts; staff preview worked. Editions collection has no draft/published status. Raw `saleMode/pricing` are stripped from frontend data; privileged edition query is limited to depth 0 + explicit field select.
- Price parsing/formatting boundaries (TR/EN thousands, negative/0/upper bound, unicode/exponential/invalid input), server `-1` rejection, VAT labels, offers, and native disabled buy markup checked. Old card fixture compares actual render output byte-for-byte; full-page test compares commerce present/absent branches of the same renderer.
- Additional regressions: `payments-p3-cache.test.ts`, `payments-p3-price-field.test.tsx`; existing pure/SQLite tests expanded. Isolated production render: open mode 200 + price, DB quote and env off states product 200 + no price / sales legal page 404 (6/6); separate quote build product/home HIT 200 + no price, sales legal HIT 404 (3/3). Sandbox blocked TCP listen; Next production handler ran without opening a socket. Browser/Lighthouse not re-run.
- **Final gates:** `pnpm typecheck` and `pnpm lint`: 0 errors; `pnpm test --maxWorkers=1`: **80 files / 1339 tests, 0 failures (296 s)**. Two isolated `.next-p3-qa` builds (open/quote) with latest code succeeded, production render **9/9**, `git diff --check` clean. Temporary build/scratchpad/DB deleted, `tsconfig.json` reverted. Live DB/3100/`.next`/`memory-bank/techContext.md` preserved; no commit. **P3 committable: YES.**

### P4 — Providers, webhook, fulfillment (2.5–3 days, **critical**)

- **Files:** `src/lib/payments/providers/{stripe,iyzico}.ts`, `src/lib/payments/{sync,fulfill,events,reconcile}.ts`, `src/app/(payload)/api/payments/{stripe/webhook,iyzico/webhook,iyzico/callback}/route.ts`, `scripts/payments-reconcile.ts` + `package.json` script + `deploy/` systemd timer sample, `src/lib/email/order-*.ts`, `.env.example`.
- **Acceptance:** all §6 DB and signature tests. Concurrency test produces a single license. Drain window test. PII scan on logs (test captures logs and searches with regex for email/TCKN/key) yields 0 results.
- **Risks:** iyzico single active provider (TRY/USD/EUR): on outage checkout closes, falls back to `quote`; reconcile completes pending orders. If iyzico FX authorization is not granted, USD/EUR prices are hidden via fail-to-quote. Webhook burst under SQLite write lock (busy timeout 5000 ms + 500 → provider retries). iyzico sync API latency. Fulfillment transaction defers license afterChange email past commit (existing `after()` pattern preserved).
- **Implemented (2026-11-16, P4 implementation record; no commit, no schema/migration, not written to live DB, no requests to real provider):**
  - **Routes** (`src/app/(payload)/api/payments/{iyzico/webhook,iyzico/callback,stripe/webhook}/route.ts`, POST only, `nodejs`, `force-dynamic`; wiring `src/lib/payments/route.ts`). Without env capability, returns 404 without touching Payload/DB. While Stripe adapter is off (`PAYMENTS_STRIPE_ENABLED` ≠ true), returns 404. Because `/api` is outside middleware matcher, Server Action origin guard and page CSP do not apply to these routes (tested); origin guard only concerns POSTs with `Next-Action` header.
  - **Flow:** `events.ts` `handleProviderWebhook` → drain window (`readWebhookWindow` = `isWebhookProcessingAllowed`, DB per request) → raw body `body.ts` `readLimitedBody` (256 KB, counted while streaming, stream aborted on overflow; small/missing Content-Length not trusted, large declared rejected early; strict UTF-8, BOM preserved; Stripe signature over UTF-8 of raw bytes, iyzico signature over provider's signed fields) → P1 `verifyWebhook` → order lookup (providerRef → orderNumber → providerPaymentId) → `PaymentEventStore.record` (eventKey) → `sync.ts` `syncOrderFromProvider`: server-side `retrieve` from provider (OUTSIDE transaction) → fresh read inside BEGIN IMMEDIATE + `decideFromProvider` + conditional `UPDATE … WHERE status = from` (+ confirm) → if order is `paid` and no review, `fulfill.ts` `fulfilPaidOrder` (single transaction, single license; P2-S `fulfillOrder`) → AFTER commit + confirm, `deps.defer` (`after()` in route) runs `src/lib/email/order-confirmation.ts` (TR/EN, order locale). Review (amount/currency/ref mismatch, late payment) → `requiresReview`, no license, `order-review.ts` staff alert (`PAYMENTS_ALERT_EMAIL`; otherwise log only).
  - **Responses:** capability off/no adapter → 404. Inside window: >256 KB 413, invalid UTF-8/signature 400 (empty body). Duplicate event 200 (no second call to provider). Unknown order → `ignored`/`unknown_order`, 200. Retrieve/DB error (incl. `SQLITE_BUSY`, queue timeout) → event `error` + 500 → provider retries, next delivery reprocessed.
  - **Drain decision (S3, consistent with plan §1.4):** outside window, unsigned/malformed/oversized request → **404** (looks like closed surface does not exist). Outside window, **valid-signature** event is recorded as `ignored`/`drain_closed` without querying the provider and returns **200** (provider stops retrying, staff sees late notification). `quote-only` + empty `quoteSince` = closed. Callback outside window 404.
  - **Callback** (`handleIyzicoCallback`): only `token` (form, 16 KB limit) is read, status in body is ignored; session not queried. Missing/malformed token → static bilingual error page (400, `no-store`, `noindex`, `default-src 'none'`, input not reflected). Validly formatted token, known or unknown, → 303 `/tr/hesap`; order number absent from redirect. Known token is verified with provider; timing gap may remain.
  - **Reconcile** (`reconcile.ts`, `pnpm payments:reconcile [--dry-run] [--limit=N]`, `scripts/payments-reconcile.ts`, `deploy/payments-reconcile.{service,timer}` 15 min): pending older than 5 min → sync; verified pending after 60 min → `cancelled`/`expired`; without providerRef → `checkout_not_started`; no provider error, including unverified provider business errors, is proof of cancellation and is retried as an error. Conditional cancel protects review flag and changed reference. Non-review `paid` (interrupted fulfillment) → license. Dry-run only reads provider, does not write DB/email. No-op when capability is off. Continues to run even if mode returns to quote.
  - **Left open in audit (CLOSED, "Notification durability" below):** license assignment hook could not schedule `after()` in non-request CLI; if process exited after commit, order email could be lost.
  - **Notification durability (2026-11-16, no commit):** migration `20261116_175713_p4_order_notifications` (only 7× `ALTER TABLE orders ADD`, nullable; down 7× `DROP COLUMN`, no indexes). `orders.notifications` group (staff read, nobody write, admin readOnly): `confirmationSentAt`, `licenseSentAt`, `reviewAlertSentAt`, `attempts`, `lastError` (short code: `smtp_error|no_recipient|no_license|internal`), `nextAttemptAt`, `leaseUntil`. `src/lib/payments/notify.ts` `deliverOrderNotifications`: (1) single conditional UPDATE for 5-min lease per order (null/expired, `attempts < 5`, backoff elapsed) — concurrent second sender gets 0 rows and stops; (2) reads committed order, sends each pending message, marks `WHERE <field> IS NULL` after each success; (3) releases lease; error → `attempts+1`, `lastError`, `nextAttemptAt` = 15·2^(n−1) min. Without SMTP (or without `PAYMENTS_ALERT_EMAIL` on alert), skipped and not counted (console adapter logs recipient/key). Triggers: `afterCommit` of fulfil and review flag → `deps.defer` (`after()` in request, immediate + awaited in CLI) and final "notify" phase of reconcile (orders ≤7 days old; `--dry-run` only lists `pending:<types>`; send error `error notify_<code >` → exit 1). License email: fulfillment creates licenses with `ORDER_FULFILMENT_CONTEXT` context, `licenses` afterChange hook skips them; all licenses of the order go in a **single** email from the queue (`sendOrderLicenses`, order locale). Manually assigned licenses via Admin/MCP use `after()` as before (single email). New review period (`requires_review` 0→1) resets `reviewAlertSentAt`. Guarantee: at-least-once; a duplicate is possible only if process dies between successful send and writing the marker (or send exceeds 5-min lease). Copy DB: migrate + `integrity_check ok` + `content:import --dry-run` 0 errors; live DB has 0 orders (no backfill needed). Live sequence: `sqlite3 data/softmarket.db ".backup <backup>"` → `pnpm migrate` → `PRAGMA integrity_check` → restart process. Tests: `payments-p4-db.test.ts` +7 (CLI reconcile single license email + no duplicate; webhook + reconcile single; error→no marker→backoff→retry→gives up at 5; 3 concurrent senders → single; no SMTP → skip/don't count; staff alert single; manual assignment hook single), `payments-p4n-db.test.ts` (migration up/down data preservation); log PII scan covers these.
  - **Decisions:** (1) **`server-only` package not added:** package is not installed and throws at import outside `react-server` condition (tsx CLI, vitest); would break reconcile CLI and tests. Instead `payments-p4.test.ts` transitively scans the client import graph (`'use client'` roots, stopping at `'use server'` boundary): only pure `price-input/money/types` are reachable; `lib/email`, `lib/commerce`, route, and P4 server modules never. Only payments/email/route files import P4 modules. (2) **Without SMTP, order email is skipped** (plan §4.5; console adapter logs recipient and body), only order no is logged. (3) Provider toggle in Admin governs only new checkouts; webhook/reconcile work with any adapter configured in env (open orders still complete after disabling). (4) `createCheckout` will be wired to server action in P5; in this phase no route starts checkout, `CHECKOUT_READY=false` unchanged.
  - **Tests:** `tests/unit/payments-p4.test.ts` (10: flow boundary, client graph, middleware/origin, capability-off routes 404), `tests/unit/payments-p4-db.test.ts` (17, ephemeral SQLite + all migrations, fake provider fetch): valid/fake/tampered/missing/oversized signature, Stripe off 404 + 301 s replay + bad v1; same event 2× → single license; concurrent 3 webhooks + 2 callbacks → single license; amount and currency mismatch → review, no license; fraud review/decline; inside/outside/empty quoteSince drain; network/timeout/business error → 500 + `error`, order unchanged, processed later; `SQLITE_BUSY` → 500 → retry succeeds; callback error page/303; reconcile dry-run/real/retry/late payment; post-commit single email + skip without SMTP; log PII scan (email, 10–11 digit TCKN/VKN, license key, provider secrets) = 0. Mutation check: breaking drain branch and adding email to log broke the respective tests.
  - **Open (to be verified in sandbox/P6):** CF webhook body/field names and `iyziEventType` values in iyzico sandbox, retrieve response for abandoned/expired token (`expired_unverified` assumption), `INIT_*` intermediate states, USD/EUR authorization and `VIRTUAL` basket; iyzico webhook retry policy (how many times/intervals on non-200 responses). Stripe only maps session events; `charge.refunded`/dispute events link to orders, but session retrieve does not show refunds (P6). License revocation (`revoked`) when `refunded` arrives from provider is in P6. No idempotency key on iyzico refund: P6 refund action must not blindly retry, must reconcile via retrieve first (adapter itself never retries). In reconcile CLI, license email is skipped as it is outside `after()` (license appears in portal; order confirmation email goes out). Real two-process (web + CLI) SQLite contention is protected only by `busy_timeout` 5000 ms + conditional writes; same-process queue was used in test.

### P5 — Checkout UI, portal orders, emails (2 days)

- **Files:** `src/app/(frontend)/[locale]/hesap/(portal)/satin-al/[sku]/page.tsx`, `.../siparisler/page.tsx`, `.../siparisler/[no]/page.tsx`, `src/lib/portal/checkout-actions.ts`, `src/lib/payments/contract.ts` (snapshot generation), `src/i18n/paths.ts` (EN segments `checkout`, `orders`; `RESERVED_SLUGS` automatic), `messages/{tr,en}.json`, `csp.ts` (checkout form-action), `portal-nav` (conditional `Siparişlerim` (My Orders)).
- **Acceptance:** isolated e2e full flow (fake provider). Checkout works with JS disabled (POST→303). Checkboxes accessible via keyboard and screen reader. Bundle guard passes. `checkoutReady` enabled.
- **Implemented (2026-11-16, P5 implementation record; no commit, no schema/migration, not written to live DB, no requests to real provider):**
  - **Files:** `src/app/(frontend)/[locale]/hesap/(portal)/{satin-al/[sku],siparisler,siparisler/[no]}/page.tsx`; `src/components/portal/checkout-form.tsx` (+ `OrderBadge`); `src/lib/portal/{checkout-actions,checkout-support,checkout-orders,orders}.ts`; `src/lib/payments/{checkout,checkout-schema,contract}.ts`; `src/i18n/paths.ts` (TR `satin-al`/`siparisler`, EN `checkout`/`orders`; `RESERVED_SLUGS` automatic; only `/hesap/siparisler` added to `LINK_ROUTES`), `src/lib/csp.ts` + `middleware.ts`, `src/lib/portal/redirect.ts` (`next` return), portal layout `Siparişlerim` (My Orders), `messages/{tr,en}.json` (`portal.checkout|orders|orderState|nav.orders`), `flags.ts` (`CHECKOUT_READY = true`). Test infra: `scripts/e2e-fake-iyzico.ts`, `scripts/e2e-seed-payments.ts`, `scripts/e2e-isolated-server.sh`, `playwright.isolated.config.ts`.
  - **Flow:** product card `Satın al` (Buy) → `/hesap/satin-al/<SKU>?c=<PB>` (portal layout enforces login, `next` return preserved) → page: session + email verification, if `checkoutOpen` and edition offer (`resolveCheckoutOffer`) missing or sales texts cannot be published, **redirects to quote page** (fail-to-quote; unknown SKU 404). Form: currency links (only priced ones, GET — works without JS), individual/corporate (with CSS `:has`; accessible without JS), TCKN | VKN + tax office, address, phone, prefill from last order, pre-information + distance sales text (scrollable, keyboard-focusable `region`; plain text of published `commerceLegal` pages), return/withdrawal link, two required consents + withdrawal exception consent (required for individual, optional for corporate), server-calculated subtotal/VAT/total. Submission `startCheckoutAction`: origin guard → session → rate limit (`allowAuthAttempt`, 10/15 min per account) → zod validation → `createCheckoutOrder` → `provider.createCheckout` → **303 hosted page**. Non-success results: validation error/`rate`/`provider` status returned in form state (error summary `role=alert`, field `aria-invalid` + `aria-describedby`, focus to summary); if mode/edition closed, redirects to quote form.
  - **Security decisions:** (1) **Price on server:** form only carries SKU, currency code, identity/address, consents, form token, and digest of displayed text; edition/price/VAT/provider/seller info/contract text are re-read on server at submission (no amount field in schema; locked by test: fake `totalMinor/price` field does not affect order amount). (2) **Idempotency:** page generates single-use token; key = `orderIdempotencyKey(customer, token)` (SHA-256, bound to customer), `orders.idempotencyKey` unique. Same form second time: **no new order and no provider call**, redirects to order page (on concurrent double submit, unique index decides winner, loser re-queries key on create error). Since hosted URL is not stored, second submit does not send back to hosted page; order page says "payment pending", incomplete order cancelled by reconcile after 60 min. (3) **IDOR:** order queries run as customer (`overrideAccess:false`) + `customer = me` filter; someone else's/non-existent number same 404; `idempotencyKey`, `providerRef`, `notes`, `notifications`, `requiresReview` not selected/hidden from customer via field access; customer cannot create/update/delete orders (tested). (4) **Origin:** `sameOrigin` (Origin = Host) + existing middleware `forbiddenActionOrigin`; callback endpoints excluded (P4). (5) **Consent proof:** version = published page `updatedAt`, time, IP (trusted proxy header), UA (200), `snapshotSha256` = SHA-256 of frozen text; **digest of text shown in form** is compared against current text on server at submission, if page was republished in between, order is not opened, form refreshes with new text and consents are requested again. In contract copy, TCKN is masked except last 3 digits (`contractSnapshot` open only to admin and order owner; full number only in `billing`). (6) **Provider error:** order `failed` + `failureReason=checkout_<code>` (no raw message), generic message to user, only order no + code in logs. (7) **CSP:** `form-action` only on checkout path and when `PAYMENTS_ENABLED=true` adds `iyzipay.com`/`iyzico.com` (+subdomains; same as P1 host check), Stripe only if enabled; script/frame/connect unchanged (tested: policy identical on all other paths). Loopback fake provider origin is added only in development/test or in isolated setup on a separate E2E build.
  - **Callback → order page resolution:** P4 callback had removed order number from URL. Now 303 target is **relative** `/{lang}/hesap/siparisler?donus=1` (order locale on known token, `tr` on unknown; no number, no dependency on absolute origin setting — e2e finding of falling back to 3100). List page with `?donus` finds the **logged-in customer's** newest order and redirects to `/hesap/siparisler/<no>` (someone else's order cannot be resolved). If no session, login page returns to the same place via `next` (`sanitizeNext` recognizes order/checkout paths). Stripe `success_url` already goes to numbered page; `?s=` syncs only the customer's own pending Stripe order as an accelerator if `providerRef` matches (`checkout-orders.ts`).
  - **Portal:** `/hesap/siparisler` (list, card on mobile) and `/[no]` (status badge + description, items, subtotal/VAT/total, license link, invoice no/date, billing info — identity no masked, contract copy). S3: **remains visible read-only even if mode returns to quote**; `Siparişlerim` (My Orders) menu appears if `checkoutOpen` or customer has at least one order. Order confirmation email uses the right segment via `orderPagePath` (TR `/tr/hesap/siparisler/<no>`, EN `/en/account/orders/<no>`; tested).
  - **P3 finding fixed (cache, surfaced in P5 e2e):** `getCommerceState` called `unstable_noStore()` only when `open`. Pages built with env capability on + site mode `quote-only` were generated statically; when mode was flipped to `payments` in DB, the next refresh threw `DYNAMIC_SERVER_USAGE` **500** (incl. home page); P3 QA had only tested output built in open mode. Now **whenever capability is on** (regardless of mode), every consumer is dynamic: `unstable_noStore()` is called at the very start; during build (`NEXT_PHASE=phase-production-build`) bailout is intentionally rethrown (routes are marked dynamic, so **`PAYMENTS_ENABLED=true` must be present in the build environment** — `deploy.sh` already loads `/etc/softmarket.env` before build). In a process built without capability and started with capability, bailout cannot occur at runtime: state **falls back to closed** (site stays up, quote mode, one-time warning) and requires rebuild. With capability off, unchanged: does not touch DB, ISR preserved (tested: `payments-p3-cache.test.ts`).
  - **Isolated e2e fake provider:** loopback override under `NODE_ENV=production` (`next start`) was rejected in P1; `isLocalProviderAllowed` (`env.ts`) accepts loopback in development/test or only in a separate `SOFTMARKET_E2E_BUILD=1` build with `assertIsolatedE2E` verification. It cannot be enabled via runtime env var in a normal production build; the E2E build must not be deployed. `scripts/e2e-isolated-server.sh` starts `e2e-fake-iyzico.ts` on port 3500 (hosted page + signed initialize/retrieve + browser callback POST) and iyzico env; `e2e-seed-payments.ts` writes product/edition/clean sales texts/2 verified customers to copy DB (mode stays in quote; spec flips it via admin API).
  - **Verification:** typecheck/lint clean; full test 87 files / 1461 tests (2 failing `schema.json` sync tests fixed after regenerating for `hesap_siparisler` link route; new `payments-p5.test.ts` 24 + `payments-p5-db.test.ts` 24 tests); isolated e2e (`NEXT_DIST_DIR=.next-p5`, copy DB): **28/28** (new `payments.spec.ts` 8 scenarios: quote mode surface closed; payment mode via admin API; full flow with JS login → product → Buy → form (keyboard consent) → fake hosted page → callback → order "Completed" + license + menu; other customer 404; **JS disabled**: error summary + valid POST **303** to hosted + order completes; decline → "Failed"; mobile 390 no overflow + CSP form-action only on checkout path; return to quote: checkout redirects to quote, history visible, price disappears). Build: home page First Load JS **110 kB** (≤130), checkout 119 kB, order pages 105 kB; provider/payment leak scan in client chunks empty; quote mode (default, no env) HTML comparison: HEAD (9be9b3d) and env-less build of this code, 113/113 prerender HTML (excl. build id, no scripts) and 112 JSON-LD blocks byte-identical, prerender route set equal.
  - **Open (P6/P8/sandbox):** returning to hosted page (URL not stored on second submit); iyzico `identityNumber` sends VKN (10 digits) for corporate, must verify in sandbox whether accepted and required `ip`/`gsmNumber` format (`127.0.0.1` placeholder if IP unknown); no contract copy attachment in email (copy in portal); `TEST MODU` (TEST MODE) banner (§1.2) not added; Stripe success page sync only indirect at unit level in fake env (Stripe off); note "PAYMENTS_ENABLED in build env" should be added to deploy guide; compatibility of iyzico's actual hosted domain (`cpp.iyzipay.com` assumption) with CSP list must be verified in sandbox.

### P6 — Admin operations and operations (1–1.5 days)

- **Scope:** `İade et` (Refund) / `İptal et` (Cancel) (admin, custom endpoint + admin component), refund → license `revoked`, chargeback → `suspended`, `requiresReview` alert email, order list filters/columns, invoice no entry, reconcile timer doc.
- **Acceptance:** editor gets 403 on refund endpoint, API key 403, admin session 200. Refund e2e with fake provider. License appears `İptal edildi` (Revoked) in portal.
- **Implemented (2026-11-17, P6 implementation record; no commit, NO SCHEMA CHANGE / no migration, not written to live DB, no requests to real provider):**
  - **Files:** `src/lib/payments/{admin-actions,admin-endpoints}.ts`, `store/journal.ts`; `providers/{iyzico,stripe}.ts` + `types.ts` (`refundStatus`, `abandonCheckout`); `events.ts` (Stripe dispute/refund events), `notify.ts` (type `refund`), `reconcile.ts` (refund phase); `src/lib/email/order-refund.ts`; `src/collections/Orders.ts` (endpoints, `adminActions` ui field, list columns/search, invoice description); `src/admin/fields/order-actions{,-client}.tsx` + import map; `src/lib/commerce/state.ts` (`commerceRenderBoundary`), `[locale]/layout.tsx`, `next.config.ts` (`__SOFTMARKET_BUILD_PAYMENTS__`); `scripts/e2e-fake-iyzico.ts` (refund + reporting); `docs/payments/operations.md`, `deploy/payments-reconcile.service` note.
  - **Access:** `POST /api/orders/:id/{refund,cancel,resend-notifications}` (Payload collection endpoint; Payload authentication). Only `users` admin + `_strategy === 'local-jwt'` + NO `Authorization` header (panel cookie) + `Origin` = `Host` (Server Action rule) + `Sec-Fetch-Site` if present `same-origin`. Anonymous 401; customer, editor, users API key (incl. MCP; MCP does not expose orders tool anyway), JWT in header, missing/foreign Origin 403. Body not read; single input order id, amount = order total. Response `no-store` JSON, short codes only. Server side of admin component checks the same role/strategy; client half does not import payment code (tested).
  - **Refund protocol (P1/P4 note: no idempotency in iyzico):** (1) `refundStatus()` (iyzico Transaction Detail Reporting `GET /v2/reporting/payment/details?paymentId=` → `paymentRefundStatus` NOT/PARTIALLY/TOTALLY_REFUNDED, `cancels`; paymentId + conversationId must match, unknown value error; Stripe `GET /v1/payment_intents/:id?expand[]=latest_charge` → `amount_refunded`, `metadata.order_number` must match). Already refunded → `refund()` NOT CALLED, order closed; partial → review; no capture → reject. (2) Lock: `payment-events` row `<provider>:admin-refund:<no>` (`INSERT … ON CONFLICT(event_key) DO UPDATE … WHERE status='error'`, BEGIN IMMEDIATE) — concurrent/repeat requests see the lock, do not call refund. (3) Single `refund()` (Stripe fixed `operationIdempotencyKey`). Success → (4) single transaction: conditional `paid|fulfilled → refunded` + `refundedAt`, `orders_items` licenses `revoked` (conditional, note row), lock `processed`, `refund-notice` row; notification queue after commit+confirm. Explicit rejection (`ok:false`) → lock `error`, order unchanged, retriable. Stripe `pending` → lock stays open, webhook/reconcile closes. Timeout/network/signature/unexpected response → **no blind retry**: lock `received`, order `requiresReview` + `failureReason=refund_uncertain` + staff alert; admin re-click and reconcile only read `refundStatus()`. Absence at provider does not prove the attempt will not settle later; uncertain lock is never opened by timeout and is investigated with provider.
  - **Cancel:** `pending` only. If providerRef exists, first `retrieve`: paid/failed/expired → provider truth applied (paid order not cancelled, `already_paid`); review → reject. Then Stripe `POST /v1/checkout/sessions/:id/expire`; iyzico has no cancel API for unused CF token (`local_only`, token expires). Conditional `pending → cancelled` (`admin_cancelled`, note row). Late payment arrives via existing `cancelled → paid + requiresReview` path.
  - **Chargeback/dispute:** Stripe `charge.dispute.created` → order's `active` licenses `suspended` + review (`dispute_open`) + alert; `charge.dispute.closed` → review only (`dispute_closed`, license manual); `charge.refunded` → `reconcileRefund` (refund made from dashboard also closes). **No dispute/refund notification documented for iyzico CF:** disputes arrive via bank/iyzico dashboard, license is manually `suspended` (operations doc); refund made from dashboard is closed via `İade et` (Refund) (refundStatus already sees refund, no new refund).
  - **Notification (schemaless):** `refundSentAt` column not added. Refund email marker is `payment-events` row `<provider>:refund-notice:<no>` (received = to send, processed = sent); order-level lease/attempts/backoff (`notifications.*`) used as-is, refund transition resets counter. Reconcile notify phase finds orders awaiting refund notice by refund time (≤7 days). `requiresReview` alert email existed and was verified in P4 (new review period resets `reviewAlertSentAt`; `refund_uncertain`/`partial_refund`/`dispute_*` use this path). **Resend:** if lease is not held, `attempts/nextAttemptAt/lastError` are reset and delivery is attempted immediately; button appears only when `attempts ≥ 5` or `lastError` is present.
  - **List:** columns order no, customer, status, total, currency, provider, review, date; search order no/provider ref/payment no; Payload filters on all fields. Invoice no/date/note (existing `invoice`, admin writes) has description.
  - **Portal:** license status labels already existed (`İptal edildi`/`Askıda`, `licenseState`); verified with e2e.
  - **Task 2 — "Page changed from static to dynamic at runtime /tr/yasal/e2e-iade-cayma":** root cause: `yasal/[slug]` was an ISR route with `revalidate=3600` + `generateStaticParams`; `getCommerceState()` (first line `unstable_noStore()`) was called only on the **sales legal page** (`assertVisible`). At build time this route had **no paths at all** (`contentStaticParams` comes from sitemap entries; draft legal pages are excluded from sitemap, e2e sales texts are written to copy DB after build) → unrendered route remained as ISR fallback in `prerender-manifest.dynamicRoutes` (same situation for `[slug]`, `kariyer/[slug]`, `referanslar/[slug]`); at runtime the first sales page render set `revalidate=0` via `noStore`. Next 15.4 `base-server.js` in this case (isAppPath && isSSG && revalidate===0 && !dev) **throws → HTTP 500** (code read); catch in `getCommerceState` cannot prevent this (revalidate already 0). The same class of error could happen **on all ISR pages** once a sales legal link is added to footer/header at runtime (`site.ts` conditional call). Fix (two parts): (1) `commerceRenderBoundary()` — while capability is on (build + runtime), `[locale]/layout.tsx` calls `noStore` unconditionally on every render; (2) `contentStaticParams` in a capability build returns a **single probe path** per route instead of the real list (`__dynamic__`, slugify never produces it; returns 404 if requested) → build renders every route, hits the boundary, and marks the route dynamic; no fallback ISR can remain due to an empty list. Verification: in capability E2E build `dynamicRoutes` 4 → **0**, `routes` only `/robots.txt`; in non-capability build 113 prerender routes + 16 ISR routes (same count as P5); capability off → no-op, ISR and quote HTML identical; built without capability + process with capability (`__SOFTMARKET_BUILD_PAYMENTS__=false`) → `noStore` never called, payments closed + single warning (no 500). Consistent with P3/P5 rule (no ISR on payment surface; mode changes in DB).
  - **Verification (2026-11-17):** `pnpm typecheck`, `pnpm lint` clean; `pnpm test --maxWorkers=1` **89 files / 1488 tests** passed (after probe test, related 28 files / 711 tests re-passed; total 1489). Build: `SOFTMARKET_E2E_BUILD=1 PAYMENTS_ENABLED=true NEXT_DIST_DIR=.next-p6` succeeded; isolated e2e **29/29** (incl. new P6 scenario), "static to dynamic" in server output **0**; 3400/3500 stopped. Admin component chunk loads only on `(payload)` admin pages (app-build-manifest), no trace in `(frontend)` chunks. Non-capability prod build succeeded. `.next-p6` deleted, `tsconfig.json` reverted.
  - **QA/release (2026-11-17):** After independent QA, 89 files / 1492 tests, `pnpm test:e2e` 19/19, isolated e2e 30/30 (incl. refund + `__dynamic__` 404/sitemap), "static to dynamic" 0. Refund email is delivered at least once (intentional): if process exits between SMTP send and writing delivery marker, email may go twice; atomic single delivery is impossible with SMTP (same acceptance as P4 design).
  - **Open (sandbox/P8):** assumption that IYZWSv2 signature on iyzico reporting GET excludes query string (official SDK behavior) and how long `paymentRefundStatus` takes to update after refund must be verified in sandbox; refund v2 is always used instead of iyzico same-day `cancel` (iyzico accepts this; same-day cancel does not appear on statement, refund does — choice in P8); no iyzico dispute notification (manual); no partial refund (plan); license on dispute close left to manual decision; clearing `requiresReview` manual (admin field).
  - **Tests:** `tests/unit/payments-p6.test.ts` (12: iyzico/Stripe refundStatus mapping + signature path, abandon, event classification, render boundary 4 states + probe path + layout/next.config lock + reader location, admin component bundle boundary); `tests/unit/payments-p6-db.test.ts` (14, ephemeral SQLite, real REST handler: access matrix 3 endpoints × 8 states, admin 200; refund success + single email + no duplicate; already refunded at provider → no refund call; timeout → review, no retry, then reconcile; stale attempt release; 3 concurrent → single refund call; explicit reject; pending refund reject; cancel; dispute/closed; charge.refunded; resend; log PII scan 0). Isolated e2e +1 scenario (admin panel → `İade et` → portal `İade edildi` + license `İptal edildi`).

### P7 — Legal drafts and KVKK (0.5–1 day, parallel from P1)

- **Files:** 6 new + 4 updated Markdown in §5, `scripts/content-import` `--legal` mapping (`commerceLegal`), `docs/editor-guide.md` sales section.
- **Acceptance:** `legal-draft.test.ts` recognizes new files as drafts (noindex, excluded from sitemap). Readiness validation rejects `payment` with drafts in production. **Legal counsel approval is left to the user.**

### P8 — Independent QA, security audit, sandbox acceptance, documentation (1.5–2 days)

- **Scope:** zero-context security audit (webhook, callback, IDOR, CSRF, CSP, MCP, log/PII, env leak, rate limit). Running sandbox runbook in real provider test environments (once user keys arrive). Perf measurement. `AGENTS.md` (`Satış ve ödeme` / Sales & payments section; updating "No online payments" to "optional"), `projectbrief.md` decision, `memory-bank`, `docs/payments/acceptance.md`.
- **Acceptance:** 0 critical/high findings. All sandbox scenarios green. Quote mode absence test green. User approval.

**P8 security fixes (2026-11-19).** REST and GraphQL require staff panel sessions or customer ownership for order reads, and an admin panel session for order updates, the payment journal, and integration settings. Order provider metadata is staff-only. Commerce switches and legal approvals use the shared admin panel field guard. Users API keys cannot change staff or customer credentials.

The 72-hour quote-mode drain applies to payment notifications and browser returns. Verified Stripe refunds and disputes for existing orders continue after it while payment capability and the adapter are enabled. Signed events still ignored after the drain return an empty 200. Browser returns have independent per-token and per-IP budgets for each provider, and skip provider calls for orders outside their eligible states. Real-provider sandbox acceptance and deployment performance remain pending.

#### P8 security audit record (2026-11-19)

Scope: independent audit of webhook, callback, IDOR, CSRF, CSP, MCP, PII and rate-limit surfaces, followed by targeted fixes and regression tests. Full record and evidence: the audit and fix notes (scratchpad), not committed.

| Finding | Priority | Verdict | Fix |
|---|---|---|---|
| F-01 Users API key can read and mutate order, payment-event and integration data | P1 | Partially confirmed (P1 order exposure and mutation confirmed) | Orders need a staff panel session or customer ownership to read and an admin panel session to edit invoice, notes and requiresReview. `payment-events` and `integrations` need an admin panel session. Users API keys lose staff and customer account mutations. |
| F-02 Verified Stripe refund and dispute events dropped after the quote-mode drain | P2 | Confirmed | Verified refund and dispute events for linked orders are processed after the drain while payments capability and the adapter are enabled. Other post-drain events stay `ignored` with an empty 200. |
| F-03 Browser return sync unbounded per request | P2 | Partially confirmed (starvation and throttling impact unmeasured) | Per-token and per-IP fixed windows for iyzico and Stripe returns: two syncs per token and 60 requests per trusted IPv4 address or IPv6 /48 per minute. Maps are bounded (10,000 entries) with a shared overflow window. Terminal orders and states outside the eligible set skip provider calls. Saturation returns 429. |
| F-04 Provider identifiers and failure reasons readable by customers | P3 | Confirmed | Provider, providerEnv, providerRef, providerPaymentId and failureReason are staff-panel-only. Owners keep ordinary order and billing data. |
| F-05 Any admin JWT (including Authorization-header JWT) accepted for commerce, integration and legal approval writes | P3 | Confirmed | Commerce switches, integration settings and legal approval fields use the shared admin panel guard. |

**Sonnet QA fix:** the iyzico callback IP limiter now runs after the payments capability and drain-window checks, so a closed surface still returns 404. Regression test added.

**Verification:** typecheck; full suite 1891 tests passed; isolated e2e 30/30; MCP works with a Bearer key; REST and GraphQL refuse the API key for orders, payment-events and integrations; admin cookie session works; `content:import` and `payments:reconcile` dry runs clean.

**Residual risks**

- The admin API key can still read licenses, users, customers, support tickets, support ticket messages and form submissions through generic Payload APIs. These are credential-scope risks outside this fix. Narrowing them is a separate decision.
- Return limits are per process and reset on restart. Shared addresses share budgets, and distributed bursts still generate provider calls. Multi-process SQLite contention is unmeasured.
- Lifecycle events journaled as `ignored` before deployment stay terminal. Reconcile or the provider dashboard covers affected orders.
- iyzico disputes have no notification and still depend on manual staff review.

**Pending: real sandbox acceptance (waits for user-supplied keys)**

1. iyzico sandbox key and secret: complete, decline, 3DS, abandon/expire, cancel and refund. Verify V3 webhook fields, signatures, retry/backoff, retrieve status variants, callback behaviour and CSP redirect hops in Chromium, Safari and Firefox.
2. iyzico merchant configuration: VKN, buyer IP and phone formats, `VIRTUAL` baskets without shipping data, merchant-enabled USD/EUR alongside TRY.
3. iyzico refund reporting: IYZWSv2 signing of the reporting GET, actual `cancels[]` and refund-status shapes, reporting lag, same-day cancellation versus the refund path.
4. Stripe, only if enabled: test or restricted key and webhook secret; pinned API version, hosted checkout and 3DS, expiry, PaymentIntent charge expansion, dashboard refunds and dispute webhooks for linked orders after the drain.

### Agent assignment

| Phase | Writer (effort) | Reviewer (effort) | Note |
|---|---|---|---|
| P0 verification | GPT 6.1 Terra (High) | Claude Opus 5.5 (Medium) | Focused diagnosis; item list split into short tasks |
| P1 pure core | Claude Opus 5.5 (Medium) | GPT 6.1 Sol (High) | Fixture and state table under Sol's review |
| P2-S schema + migration | GPT 6.1 Sol (High) | Claude Opus 5.5 (Medium) | Clear migration task. Down guard and lock table SQL reviewed line by line |
| P3 mode gate (core) | Claude Opus 5.5 (Medium) | GPT 6.1 Sol (High) | |
| P3 card/hero UI | Claude Sonnet 5.5 (Medium) | GPT 6.1 Terra (High) | Visual equivalence + ISR |
| **P4 provider/webhook/state machine/fulfillment** | **Claude Opus 5.5 (High)** | GPT 6.1 Sol (High) + GPT 6.1 Terra (High, security) | The plan's single Opus High point. Terra gets short, focused audit tasks |
| P5 checkout/portal UI | Claude Sonnet 5.5 (Medium) | GPT 6.1 Sol (High) | Opus Medium writes server action and snapshot generation, Sol High reviews |
| P6 admin operations | Claude Opus 5.5 (Medium) | GPT 6.1 Sol (High) | Permission matrix tests |
| P7 legal drafts + guide | Claude Haiku 5.5 (Low) | Claude Opus 5.5 (Medium) content mapping + **legal counsel** | Legal approval on user |
| P4–P6 tests / e2e fake provider | GPT 6.1 Sol (Medium) | Claude Opus 5.5 (Medium) | |
| P8 security audit | GPT 6.1 Terra (High) | Claude Opus 5.5 (Medium) | Zero context. Short audit slices: webhook, IDOR, CSP, MCP |
| P8 sandbox acceptance + perf | GPT 6.1 Sol (High) | Claude Opus 5.5 (Medium) | With real sandbox keys |
| Documentation + memory-bank | Claude Haiku 5.5 (Low) | GPT 6.1 Sol (Medium) | |
| End-of-phase commit | Claude Haiku 5.5 (Low) | — | Only when QA is green |

Estimated total: **11–14 business days** (~8–10 calendar days if P0/P1/P7 run in parallel with pilots).

---

## 9. Required from user

**Inputs (before P4):**
1. iyzico sandbox merchant API key/secret (and live application status, USD/EUR authorization).
2. ~~Stripe test keys~~ **Not needed** (P0: TR not supported; Stripe disabled by default). Test keys + webhook secret are requested only if a foreign legal entity is established. Instead, **USD/EUR merchant authorization** from iyzico is required.
3. Company details: trade name, MERSİS, tax office/no, address, KEP, phone, email; ETBİS registration.
4. Price list (edition × currency), VAT inclusive/exclusive preference, VAT rate; who/which system will issue e-Archive invoices.
5. Refund policy (full refund period, corporate exceptions) and legal counsel approval process.
6. Working SMTP (mandatory for order/contract email; sales cannot open with the console adapter).

**Open questions (max 4):**
- **S1 VAT — foreign sales:** will VAT be applied on sales to foreign customers in USD/EUR, or is it a service export exemption (CPA)? Recommendation: `vatRate` on edition is not split per currency; if exemption is needed, add `pricing.vatExemptForeign` in P2-S.
- **S2 Should the secondary `Kurumsal teklif iste` (Request enterprise quote) link stay on a purchase edition?** Recommendation: yes (for multi-seat/corporate invoice requests).
- **S3 Upon switching to quote-only mode:** are the 72-hour webhook drain window and read-only `Sipariş geçmişi` (Order history) in the portal for customers with past orders (for contract copy access) acceptable? Recommendation: yes to both. If no, history is hidden completely in closed mode; data is not deleted.
- **S4 Buyer audience:** will there also be individual (consumer) sales, or corporate (VKN) only? Individual sales require withdrawal exception consent, collecting TCKN, and consumer texts; if corporate-only, the flow and texts simplify.

## User decisions (2026-11-08)

- **S1 VAT:** accountant will decide — per-currency VAT rate + "exempt" option in admin; default empty (payment mode cannot open without VAT configuration).
- **S2:** Secondary **`Kurumsal teklif iste`** (Request enterprise quote) link is shown on `Satın al` (Buy) editions.
- **S3:** **Safe transition** when switching to quote mode: new sales close immediately; provider webhooks continue to be processed for 72 hours; customers see their old orders read-only in the portal.
- **S4:** **Both individual (TCKN) and corporate (VKN)** sales; withdrawal right text and digital content exception consent are mandatory on individual sales.

### P1 audit boundaries

- `planFulfillment` is a pure plan, it does not prevent concurrent license generation on its own. Implementation must acquire `BEGIN IMMEDIATE` on the same SQLite connection before reading; write license, item link, and status transition in the same transaction; roll back everything if conditional link or transition fails; and defer side effects until after commit. No store implementation or race test exists yet.
- iyzico retrieve signature does not cover `fraudStatus` and `installment` fields; these are read from the verified HTTPS response. Initialize signature also does not cover the redirect URL; TLS and host checks are required. Provider redirects are rejected in the HTTP client.
- iyzico refund request has no idempotency key passed to the provider; blind retry after timeout carries double-refund risk. P4 must implement reconciliation with provider state and an atomic operation lock before retrying.
- 256 KiB limit is applied on the received string; the future HTTP handler must also bound the raw body before/during streaming and verify the signature against unchanged bytes. No sandbox/live iyzico end-to-end test was performed.

## P7 + commerceLegal record (2026-11-16)

- **Schema:** `pages.commerceLegal` select (`distanceSales|preInformation|refund`), sidebar, visible only when `pageType: legal`, not localized, `unique` + index. `beforeValidate` hook: one page per type (localized `ValidationError`), nulled on non-`legal` types. Clears duplicate value. Migration `20261116_155928_p7_commerce_legal`: `pages.commerce_legal` + `pages_commerce_legal_idx` (UNIQUE), `_pages_v.version_commerce_legal` + index; only ADD COLUMN/CREATE INDEX, down DROP INDEX + DROP COLUMN (no table rebuild).
- **Detection:** `src/lib/payments/legal.ts` checks the field first (`isCommerceLegalPage`). P3 slug constant is only a backward-compatibility fallback when the field is empty (keeps it hidden, does not count as "ready"); sitemap entries filtered by `commerce` flag, footer/header page references filtered by `commerceLegal`; absolute/normalized URL filter identical.
- **legalReady:** `evaluateLegal`: all three types, TR and EN, published and not `isLegalDraft`. `computeCommerceState({ legalReady })` included in `open` condition (false if omitted, fail-closed). Loader reads legal pages only when other layers are open; read error = closed state. Readiness list `legal` row also gates `ready`. Not added to site settings `validate` (gate is at `open` level).
- **Texts:** 6 new (TR/EN distance sales, pre-information, refund/withdrawal) + 5 updated (KVKK, privacy, cookies, terms of use, EULA); EN filenames are identical to TR (`loadLegal` requirement), so P3's EN slug names do not actually occur (fallback only). `--legal` writes `commerceLegal` from filename.

## P7 independent security/quality audit — 2026-11-16

- P1 fixed: `readLegalFacts` accepted TR fallback in EN queries; empty/hidden layout was also counted as ready. Fallback disabled; title, slug, and visible richText body required in each language. Open surfaces still no-store; quote ISR behavior preserved.
- P1 fixed: once the `TASLAK` (DRAFT) banner was removed, placeholders containing `/`, `:`, em-dash, and lowercase explanations (`[VERGİ DAİRESİ/NO]`, `[HUKUK İNCELEMESİ: …]`) slipped past; noindex/sitemap and legalReady now use the same expanded detector.
- P2 fixed: two concurrent latest drafts could take the same commerceLegal type. Published record and latest draft are checked inside the same transaction; enum is also validated in draft/autosave, empty and non-legal types become NULL. SQLite UNIQUE index is the final race boundary on the main record; multiple NULLs are valid, and historical versions must not have UNIQUE. Duplicate and version restore tested.
- P2 fixed: route/same-origin absolute URL links of renamed sales texts remained in quote mode. Local legal target is resolved from current page (error = hidden); for reference links, polymorphic relationship fields dropped by Payload SQLite's parent group projection are explicitly selected. Header/footer, 404, sitemap, and reopen-mode regressions exist.
- P2 fixed: legal sources could follow symlink files/directories and turn a private file into content; canonical directory and regular-file boundary added. `--legal` publish/upsert behavior is preserved, and the guide explains the risk of overwriting an existing approved text.
- Text consistency: TR/EN section numbers match; all bracketed placeholders trigger draft detection. EULA sales section made conditional in both languages; contradiction in KVKK order retention sentence resolved in both languages. No cross-language contradictions or fabricated person/company details found in payment transfer/retention statements. Legal accuracy review was not performed.
- P3 (process boundary): removing banner/placeholders does not prove lawyer approval. There is no recorded lawyer approval mechanism; technical check only verifies content markers. The contrary claim in the guide and plan was corrected; obtaining approval rests with the release owner.
- Migration file unchanged: two nullable columns + two indexes, up/down/data-preservation test passes. Installed libSQL SQLite **3.45.1** supports DROP COLUMN; down drops the dependent index first. No migrate/import on live DB, 3100/`.next` operations, writes to P4 files, or commits were made.
- Final gates: `pnpm typecheck` and `pnpm lint` exit 0; `pnpm test --maxWorkers=1`: **84 files / 1397 tests, all passed (314.55 s)**. No P4-caused breakage. `git diff --check` clean. **P7 migration safe for live: YES; P7 scope committable: YES** (not committed).

## Integration settings record — 2026-11-17 (no commit, not applied to live)

- **Decision:** every piece of user-provided info is entered from the panel: iyzico/Stripe keys (test+live), SMTP account, company details (+ `company.etbisNo`), VAT (already existed), lawyer approval. Remaining on server: `PAYMENTS_ENABLED` (lock), `PAYMENTS_STRIPE_ENABLED`, `PAYMENTS_STRIPE_CURRENCIES`, `PAYMENTS_ALERT_EMAIL`, `NEXT_PUBLIC_SERVER_URL` (read-only in panel).
- **Key:** separate `SOFTMARKET_SECRETS_KEY` (≥32 bytes; HKDF-SHA256 → AES-256-GCM key + 12 hex `kid`). Not derived from `PAYLOAD_SECRET`: so secrets are not lost when session secret is rotated, a leaked session secret does not open the vault, and it can be backed up separately. Without key, save returns `no_key` (409), fail-closed. Record `sm1.<kid>.<iv>.<ct>.<tag>`, random 12-byte IV, AAD = field identifier; SMTP password AAD bound to host+user (if host changes, password fails to decrypt → no send, re-entered).
- **Placement:** new unversioned `integrations` global (not `site-settings` because that is public-readable; no `_v` table, not in MCP allowlist, no revalidation). Read admin, update only admin panel session (no API key). `secrets` JSON column field access read/create/update = nobody. Environment select (sandbox/live) + virtual `confirmLive` (required on every transition to live, not persisted); base URL from allowed constants.
- **Write-only:** write `POST /api/globals/integrations/secret` (admin panel session + same origin; `guardAdminSession`), response status only. UI `ui` field: server component only passes "defined · last 4 · date · unreadable"; client input is not in Payload form state (no autosave/save/response). Last 4 not kept for SMTP password.
- **Precedence:** if any provider env var or `SMTP_HOST` is defined, env wins (panel ignored, shown in panel). Runtime: `loadPaymentsConfig`/`loadPaymentsDeps` (route, admin operations, checkout, Stripe return sync, reconcile CLI, `getCommerceState`, readiness). When capability is off, DB is not read; routes still 404 before opening Payload.
- **SMTP runtime:** `softmarketEmailAdapter` reads setting on every send (env → panel → console-style single line, no body), caches transport by setting version and rebuilds on change (no connect on init). Throws if setting cannot be read (queue retries). `isEmailConfigured(payload)` env+panel; order/refund/review emails and manual license email use this. Test email `POST /api/globals/integrations/test-email`: logged-in admin's address only, 1/min and 5/hr.
- **Legal:** company placeholders are filled at render time (page, noindex, sitemap, `readLegalFacts`, contract copy); stored text does not change; edit preview stays raw. `pages.legalReview` (localized approver/date, hidden `approvedHash`; admin panel write-only) is bound to SHA-256 of title+visible text; when text changes, approval drops, new date re-approves. `evaluateLegal`/`loadCommerceLegalSet` require approval. Readiness list: key source (panel/server/none + errors), SMTP source, missing company details (gate), approved version count.
- **Migration** `20261117_092957_integrations_settings`: up = CREATE TABLE `integrations` + 7 ADD COLUMN (`pages_locales` 3, `_pages_v_locales` 3, `site_settings.company_etbis_no`). Down: rejects if settings/secrets/approvals/ETBİS data exists; otherwise DROP TABLE/COLUMN. Migrate + integrity ok + `content:import --dry-run` 0 errors (98 updates) on copy DB. `content/seed/schema.json` regenerated (`etbisNo`).
- **Tests:** `integrations.test.ts` (21) + `integrations-db.test.ts` (12); new up added to old migration tests. Typecheck/lint 0; full test 91 files / 1527 tests passed (358 s); `NEXT_DIST_DIR=.next-int` build succeeded, no encryption code/records in client chunks (only env name in UI text); build deleted, tsconfig reverted.
- **Live sequence:** generate+back up `SOFTMARKET_SECRETS_KEY` → add to env file → `sqlite3 data/softmarket.db ".backup …"` → `pnpm migrate` → `pnpm content:import --dry-run` → rebuild/restart. Dev 3100 errors on page queries due to new columns until this migration is applied.
