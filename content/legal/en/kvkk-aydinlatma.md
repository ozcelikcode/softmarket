> **DRAFT — Must be reviewed by legal counsel before publication.**
> Fields in square brackets must be completed before publishing.

# Data Protection Notice (KVKK)

Last updated: [YÜRÜRLÜK TARİHİ]

This notice informs you about the processing of your personal data under Law No. 6698 on the Protection of Personal Data ("KVKK") and related secondary legislation.

## 1. Data controller

| | |
|---|---|
| Company name | [ŞİRKET UNVANI] |
| Address | [ADRES] |
| Trade registry no. (MERSİS) | [MERSİS] |
| Contact e-mail for data protection | [KVKK İLETİŞİM E-POSTASI] |
| VERBİS registration | [VERBİS] |

## 2. Personal data processed

Through our website and customer portal we may process:

- **Identity and contact data:** full name, e-mail address, phone number.
- **Company data:** company name, tax number or national ID number (TCKN), tax office (if entered in your profile).
- **Customer account data:** preferred language, marketing preference, date and text version of the KVKK consent you gave, and a one-way hash of your password (never stored in plain text).
- **Form data:** information you enter in demo, quote, contact and support forms, including selected product and edition and your message.
- **Support requests:** subject, product information and messages exchanged within the request.
- **License records:** product, edition, number of seats, start and end dates, status and license key assigned to you.
- **Security data:** IP address, date and time of requests, page or action requested, form verification result, rate-limit records.
- **Cookie data:** the session identifier described in our Cookie Policy.
- **Analytics data:** aggregated visit statistics collected without cookies and not directly identifying you (Cloudflare Web Analytics). [DOĞRULA: whether the analytics tool is active and where it is hosted]

**Online purchases (only while the Company has enabled this feature; otherwise the quote process applies):**

- **Order and invoice data:** order number and date, purchased product/edition (SKU), license type, term, seat count, amount, tax and currency; invoice name or company name, billing address, Turkish ID number (individual buyer) or tax ID number and tax office (corporate buyer), e-mail and phone; invoice number. [HUKUK İNCELEMESİ: whether the Turkish ID number is mandatory for invoicing, and data minimisation]
- **Contract and consent records:** the version and summary of the pre-information and distance sales agreement texts valid at the time of the order, the consent to immediate performance (withdrawal exception), and the time and IP address of the consents.
- **Payment transaction data:** the transaction/payment ID issued by the payment institution, payment status, amount, currency, masked data such as the last four card digits and card type, and refund and chargeback records.

Card number, expiry date and security code (CVV) are entered on the payment institution's secure page; the Company does not see, process or store them.

## 2A. License and device verification data

> **Requires lawyer review.** This section is a draft based on the licensing system as implemented (L1–L6b).

When you use a software license (activation, periodic verification, device binding and device release), the following data is processed:

- **Device label:** an optional name supplied by the software when a device is activated.
- **Platform and version data:** operating system, architecture and software version.
- **Device fingerprint digest:** a digest derived from device identifiers and stored as a keyed HMAC. Raw hardware identifiers, MAC addresses and user names are not collected or stored.
- **Device public key and digest:** a device-specific public key and its thumbprint (digest).
- **Truncated IP data:** device and security event records use the network prefix (/24 for IPv4, /48 for IPv6) and, when available, a keyed digest of the address scoped to a UTC calendar month.
- **Country code (optional):** only if the Company has enabled country detection, a country code derived from the IP address.
- **Timestamps:** activation, last seen, verification and end times.

These data are processed for: (a) enforcing the license scope (seat count, validity period, device count); (b) preventing license piracy, key sharing and fraud; (c) keeping the service secure and reviewing unusual use.

Legal bases (GDPR-style equivalents): performance of a contract (Art. 6(1)(b) GDPR), where license verification is needed to deliver the licensed software; and the Company's legitimate interests (Art. 6(1)(f) GDPR) in preventing piracy, fraud and security risks, without overriding your fundamental rights and freedoms. [LEGAL REVIEW: legitimate-interest balancing assessment]

For automated rules and suspension decisions, see section 8A.

## 3. Purposes of processing

- Receiving and handling demo, quote and contact requests and getting in touch with you.
- Creating, verifying and managing your customer account; providing licenses, downloads and support.
- Tracking and answering support requests.
- Keeping license records and fulfilling contractual obligations.
- While online sales are enabled: taking orders, confirming payments, issuing licenses automatically and notifying you by e-mail, issuing invoices, handling refunds and chargebacks, keeping contract and pre-information documents for the statutory period, and preventing fraud.
- Keeping the site secure and preventing abuse and automated attacks.
- Complying with legal obligations and answering lawful requests from authorities.
- Measuring service quality using cookieless, aggregated analytics.
- Marketing communications: only where you have given separate consent.

## 4. Legal bases

Under Article 5(2) KVKK:

- The processing is necessary for establishing or performing a contract (e.g., customer account, license, support request, order and payment).
- It is expressly provided for by law or needed for compliance with a legal obligation (e.g., keeping server access logs; issuing invoices and keeping ledgers/documents; keeping distance-contract documents) [HUKUK İNCELEMESİ: statutory bases].
- It is necessary for our legitimate interests (site security, measuring service quality), provided these do not harm your fundamental rights and freedoms.

Explicit consent under Article 5(1) KVKK is requested only for marketing communications and for the explicit consent checkbox in forms. You may withdraw your consent at any time; withdrawal does not affect the lawfulness of processing carried out before it.

## 5. Transfers of personal data

Your personal data may be transferred, limited to the purposes above, to:

- **Hosting and infrastructure:** our server hosting provider [SAĞLAYICI — DOĞRULA] and the object storage provider used for encrypted backups [SAĞLAYICI VE BÖLGE — DOĞRULA].
- **Bot protection:** Cloudflare Turnstile. Some technical information from your browser is processed during verification. [HUKUK İNCELEMESİ: assessment of cross-border transfer]
- **Payment institution (while online sales are enabled):** [ÖDEME KURULUŞU — örn. iyzico], a licensed payment institution established in Türkiye, for collecting and refunding payments. The order amount, currency and the information the payer provides for the payment are shared with it; card data is entered directly with the payment institution. The payment institution may also act as a separate controller under its own notice.
- **Foreign payment provider (only if separately enabled):** if a payment provider established abroad (such as Stripe) is used, data for the related payments is transferred abroad. In that case appropriate safeguards under Article 9 KVKK (including a standard contract and notification to the Board) are put in place or explicit consent is obtained. [HUKUK İNCELEMESİ: cross-border transfer mechanism and Board notification; this item must be removed from publication until such a provider is actually enabled]
- **Invoicing and accounting:** the accountant/software provider used for invoicing and bookkeeping [SAĞLAYICI — DOĞRULA].
- **E-mail delivery:** the SMTP provider used for notification e-mails [SAĞLAYICI — DOĞRULA].
- **Public authorities:** where legally required.

## 6. Retention

- Form and request records: [SAKLAMA SÜRESİ — DOĞRULA].
- Customer account and license records: after the account or contractual relationship ends, [SAKLAMA SÜRESİ — DOĞRULA].
- Order, invoice and payment records: distance-contract documents for at least three years; invoices and ledgers/documents for the period set by tax and commercial legislation [SAKLAMA SÜRESİ — HUKUK İNCELEMESİ]. Orders are not deleted before the statutory retention period expires; after that period they are deleted or anonymised.
- Server access logs: [SAKLAMA SÜRESİ — HUKUK İNCELEMESİ].
- Backups: deleted automatically after [SAKLAMA SÜRESİ — DOĞRULA].

Data whose retention period has expired is deleted, destroyed or anonymised.

## 6A. Retention of license and security records

> **Requires lawyer review.** This section is a draft based on the licensing system as implemented (L1–L6b).

- By default, cleanup clears IP and country fields in security events after 30 days and removes eligible event rows after 180 days, both measured from the last occurrence. It keeps events with pending notifications, unresolved high or critical events, events within a false-positive suppression period, and events linked to a block.
- By default, IP and country fields in device records are kept for 90 days from the last-seen date (or activation date if unavailable) for active devices, and from the end date for inactive devices. An ended device record becomes eligible for cleanup two years after both the license and device have ended.
- Block records are deleted 90 days after they expire or are lifted.
- By default, license status history is retained for at least 10 years from both the license end and the status change. It has no IP address field. A perpetual license that is still in force has no end date for this cleanup.
- Audit records, including portal device releases, are kept for 2 years by default.
- You can submit a deletion request using the contact information in section 8. [LEGAL REVIEW: deletion and anonymisation procedure and any record-keeping obligations]
- These periods may be shortened or extended by the Company, but code-defined minimum periods are kept. [LEGAL REVIEW]

## 7. Data security

We protect your data with technical and organisational measures, including access restrictions, encrypted connections (HTTPS), server-side validation, rate limiting, role-based authorisation and regular backups.

## 8. Your rights

Under Article 11 KVKK you have the right to:

- Learn whether your personal data is processed;
- Request information if it has been processed;
- Learn the purpose of processing and whether it is used in line with that purpose;
- Know the third parties to whom data is transferred, domestically or abroad;
- Request correction if data is incomplete or inaccurate;
- Request deletion or destruction under Article 7 KVKK;
- Request that correction, deletion or destruction be notified to third parties to whom the data was transferred;
- Object to a result against you arising from analysis of processed data exclusively by automated systems;
- Claim compensation for damage caused by unlawful processing.

Send your request in writing to [KVKK İLETİŞİM E-POSTASI] or to [ADRES]. Requests are answered within thirty days at the latest, in line with the KVKK and the Communiqué on Procedures and Principles for Applications to the Data Controller.

## 8A. Automated checks, suspension and objection

> **Requires lawyer review.** This section is a draft based on the licensing system as implemented (L1–L6b).

- Automated rules may detect unusual license use (for example many activations in a short time, verifications from many different networks, or the same device appearing from different countries in a short time).
- The default rule mode records events and queues administrator notifications without changing your license. In observe mode the rules record events only.
- A rule can suspend a license only in suspension mode and after the configured monitoring period ends. These rules never revoke a license. An administrator can revoke a license with a stated reason, and a confirmed refund can also revoke it.
- Administrators can review automatic suspensions and lift a suspension caused by a false alarm.
- A suspension may take full effect on offline devices when their current lease expires. The default lease length is 14 days and the maximum is 30 days.
- If your license is suspended, you may be informed. You can object by writing to [KVKK İLETİŞİM E-POSTASI]; objections are reviewed by an administrator.
- [LEGAL REVIEW: notice obligations and objection process for automated decisions]

## 9. Effective date

This notice takes effect on [YÜRÜRLÜK TARİHİ]. Changes apply from the date they are published on the site.
