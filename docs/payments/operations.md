# Payment operations (P6)

This document describes the day-to-day operation of an installation with payment mode enabled. Plan and design decisions: `docs/plan-payments.md`.

## 1. Build and startup: `PAYMENTS_ENABLED` must match in both places

- `PAYMENTS_ENABLED=true` must be present in both the **build** (`pnpm build`) and **runtime** environments. `deploy.sh` loads `/etc/softmarket.env` before building; load the same file when building manually.
- Why: when the capability is enabled, all site pages are rendered per request (payment state is read from the DB; pricing/legal pages are not cached). Next.js makes this decision **at build time**.
  - Built with capability, started without capability: the site works, the payment surface is closed (quote-only).
  - Built without capability, started with capability: the site works, but the payment surface **remains closed** (quote-only) and the log prints `PAYMENTS_ENABLED is on but this build was prerendered without it` once. Rebuild.
- Turning the capability on or off = env change + rebuild + restart.

## 2. Reconciliation timer (reconcile)

`deploy/payments-reconcile.{service,timer}`: runs `pnpm payments:reconcile` every 15 minutes. Does nothing when the capability is off (exit 0).

```bash
sudo cp deploy/payments-reconcile.service deploy/payments-reconcile.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now payments-reconcile.timer
systemctl list-timers payments-reconcile.timer          # next run
journalctl -u payments-reconcile.service -n 50           # recent output (order number + short codes only)
sudo -u softmarket env $(grep -v '^#' /etc/softmarket.env | xargs) pnpm payments:reconcile --dry-run   # dry-run preview
```

On each run, in order:

1. Reads `pending` orders older than 5 minutes from the provider; assigns licenses if paid, or marks `cancelled` if unpaid past 60 minutes.
2. Completes `paid` orders whose licenses have not yet been assigned.
3. **Refund reconciliation (P6):** for refunds whose outcome remained uncertain/pending, **only reads** from the provider (a second refund request is never sent). If the provider shows the refund, marks the order `refunded`, licenses `revoked`, and emails the customer. On an attempt not yet visible at the provider, the lock does not time-expire; investigate with the provider.
4. Retries undelivered notifications (order confirmation, license, refund, staff alert) up to 5 attempts with exponential backoff.

On error, exit code is 1 and appears in the systemd journal.

## 3. Admin actions (Order document → side panel `Sipariş işlemleri` / "Order actions")

Only users with the **admin** role and an active **panel session** see and can use this. Editors, customers, API keys, and MCP cannot perform these actions (403); unauthenticated requests return 401.

| Button | When | What happens |
|---|---|---|
| `İade et` ("Refund") | `paid` / `fulfilled` | First reads refund status from the provider (if already refunded, no new refund is issued). Then refunds the **full amount** (no partial refunds). On success, order becomes `refunded`, its licenses become `revoked`, and a refund email is sent to the customer. |
| `İptal et` ("Cancel") | `pending` | Reads status from the provider; if payment was captured, does not cancel and updates the order instead. Otherwise closes the Stripe session (on iyzico the form expires automatically) and marks the order `cancelled`. |
| `Bildirimi yeniden gönder` ("Resend notification") | Notification stopped after 5 attempts or with an error code | Resets the attempt counter and sends pending emails immediately. |

Refund outcomes:

- **Provider declined:** no money refunded, order unchanged; check the reason in the provider dashboard. Can be retried.
- **Notification delivery:** if an interruption or slow delivery occurs between SMTP send and writing the delivery mark to the database, the same email may be sent again; exactly-once delivery is not guaranteed.
- **Outcome uncertain (timeout/network error):** the refund is **not retried** (iyzico refunds have no idempotency protection; risk of double refund). Order becomes `İnceleme gerekiyor` ("Requires review") and a staff alert is sent. Reconciliation re-reads the provider; check the provider dashboard if needed.
- **Pending (Stripe):** once the provider confirms, webhook or reconciliation closes the order.

Each action appends a timestamped line to the order's `Notlar` ("Notes") field; `admin.refund` / `notify.refund` records also appear in the `Ödeme olayları` ("Payment events") list as an audit trail.

## 4. Payment disputes (chargeback)

- **Stripe:** the `charge.dispute.created` webhook sets the order's licenses to `suspended` (`Askıda` / "Suspended" in the portal) and puts the order under review. `charge.dispute.closed` does not touch licenses; manually set the license to `active` or `revoked` based on the outcome. `charge.refunded` (refund issued from the provider dashboard) reads provider status and marks the order `refunded`.
- **iyzico:** dispute/refund notifications are not documented for Checkout Form. Disputes arrive via bank or the iyzico dashboard: manually set the license to `suspended` in admin and add a note to the order. For a refund issued from the dashboard, click `İade et` on the order: the provider already shows it as refunded and the order closes without issuing a new refund.

## 5. Alert emails

- Staff alerts (`requiresReview`: amount mismatch, late payment, uncertain refund, partial refund, dispute) go to `PAYMENTS_ALERT_EMAIL`. If SMTP or the address is missing, only the order number + short code is written to the log.
- Customer emails (confirmation, license, refund) are not sent if SMTP is missing; the console adapter is intentionally skipped because it would log personal data.

## 6. Invoice number

After issuing an invoice, enter the number and date in the order's `Fatura` ("Invoice") group; the customer sees it on the order page in the portal. The list view has status, provider, currency, review, and date columns; you can filter by these fields with `Filtreler` ("Filters") and search by order number or provider reference.
