import { isIP } from 'node:net'
import type { Payload } from 'payload'

import type { CommerceState } from './commerce-state'
import { buildContractSnapshot, legalDigest, loadCommerceLegalSet, snapshotSha256, type CommerceLegalSet, type SnapshotSeller } from './contract'
import { providerPhone, splitName, type CheckoutForm } from './checkout-schema'
import { generateOrderNumber, orderIdempotencyKey } from './idempotency'
import { resolveEditionOffer, type PriceOffer } from './mode'
import { errorCode, orderPagePath, type PaymentsDeps } from './runtime'
import { canTransition } from './state'
import type { Currency } from './types'

/*
 * P5 checkout core (server only; the Server Action `src/lib/portal/checkout-actions.ts` and the checkout page are thin
 * wrappers). Everything is injected (Payload, providers, clock, commerce state) so the DB tests run the complete flow
 * against a temporary SQLite database and a fake provider.
 *
 * Trust model: the form supplies ONLY the SKU, a currency code, the buyer's identity/address, the consent boxes, the
 * one-time form token and the digest of the legal texts shown. The edition, price, VAT, provider, seller facts and
 * contract text are all read on the server at submit time. A double submit of the same form token maps to the same
 * order (`orders.idempotencyKey` is unique); the second submit never contacts the provider.
 */

type Locale = 'tr' | 'en'

export type CheckoutTarget = {
  edition: { id: number; sku: string; title: string; saleMode?: unknown; pricing?: unknown; licenseType: 'perpetual' | 'subscription'; durationMonths?: number | null; seats?: number | null }
  product: { id: number; title: string; slug: string }
}

/** Edition by SKU with its PUBLISHED product (draft/unknown = null). Titles/slug in the given locale. */
export async function loadCheckoutTarget(payload: Payload, locale: Locale, sku: string): Promise<CheckoutTarget | null> {
  const { docs } = await payload.find({ collection: 'editions', where: { sku: { equals: sku } }, limit: 1, depth: 0, locale, overrideAccess: true })
  const edition = docs[0] as unknown as (CheckoutTarget['edition'] & { product?: number | { id: number } }) | undefined
  const productId = typeof edition?.product === 'object' ? edition.product?.id : edition?.product
  if (!edition || typeof productId !== 'number') return null
  try {
    // Anonymous read: only a published product resolves (publishedOrStaff access).
    const product = await payload.findByID({ collection: 'products', id: productId, locale, depth: 0, draft: false, overrideAccess: false, user: null })
    return { edition, product: { id: product.id, title: product.title, slug: product.slug ?? '' } }
  } catch {
    return null
  }
}

export const quoteHref = (sku: string, productSlug: string) =>
  `/teklif-iste?urun=${encodeURIComponent(productSlug)}&surum=${encodeURIComponent(sku)}`

export type CheckoutOffer = { taxMode: 'inclusive' | 'exclusive'; prices: PriceOffer[] }

/** Server-side offer for an edition under the current commerce state; null = not purchasable (fail-to-quote). */
export function resolveCheckoutOffer(state: CommerceState, edition: CheckoutTarget['edition']): CheckoutOffer | null {
  if (!state.checkoutOpen) return null
  const offer = resolveEditionOffer({
    gate: state.gate, edition, vatSettings: state.vatSettings, availableProviders: state.availableProviders,
    stripeEnabled: state.stripeEnabled, stripeCurrencies: state.stripeCurrencies,
  })
  if (offer.kind !== 'buy') return null
  const pricing = edition.pricing && typeof edition.pricing === 'object' ? (edition.pricing as { taxMode?: unknown }) : {}
  return { taxMode: pricing.taxMode === 'exclusive' ? 'exclusive' : 'inclusive', prices: offer.prices }
}

/** Seller facts for the contract (site-settings company + contact, order language). */
export async function readSeller(payload: Payload, locale: Locale): Promise<SnapshotSeller> {
  const settings = (await payload.findGlobal({ slug: 'site-settings', locale, depth: 0, overrideAccess: true, select: { company: true, contact: true } })) as {
    company?: Record<string, string | null | undefined>; contact?: Record<string, string | null | undefined>
  }
  const clean = (v: string | null | undefined) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
  return {
    legalName: clean(settings.company?.legalName), taxOffice: clean(settings.company?.taxOffice), taxNumber: clean(settings.company?.taxNumber),
    mersisNo: clean(settings.company?.mersisNo), kepAddress: clean(settings.company?.kepAddress),
    address: clean(settings.contact?.address), email: clean(settings.contact?.email), phone: clean(settings.contact?.phone),
  }
}

export type CheckoutCustomer = { id: number; email: string; name?: string | null; _verified?: boolean | null }

export type CheckoutRequest = {
  customer: CheckoutCustomer
  form: CheckoutForm
  /** Verified client IP or 'unknown'. */
  ip: string
  userAgent: string
  /** Public origin for the provider return URLs. */
  origin: string
}

export type CheckoutFailure =
  | 'invalid' | 'unverified' | 'closed' | 'unavailable' | 'legal_unavailable' | 'legal_changed' | 'rate' | 'provider_failed' | 'error'

export type CheckoutResult =
  | { ok: true; kind: 'redirect'; redirectUrl: string; orderNumber: string }
  /** Same form token seen before: no new order, no provider call; go to the order page. */
  | { ok: true; kind: 'duplicate'; orderNumber: string; locale: Locale }
  | { ok: false; code: CheckoutFailure; orderNumber?: string }

export type CheckoutDeps = Pick<PaymentsDeps, 'payload' | 'providers' | 'now' | 'log'> & { state: CommerceState }

/** Pending orders one customer may open per hour (plan §4.3). */
export const MAX_PENDING_PER_HOUR = 20
const CHECKOUT_SESSION_TTL_MS = 60 * 60 * 1000

async function findByKey(payload: Payload, key: string) {
  const { docs } = await payload.find({ collection: 'orders', where: { idempotencyKey: { equals: key } }, limit: 1, depth: 0, overrideAccess: true, select: { orderNumber: true, customer: true, locale: true } })
  return docs[0] as unknown as { id: number; orderNumber: string; customer?: number | { id: number } | null; locale?: string } | undefined
}

export async function createCheckoutOrder(deps: CheckoutDeps, req: CheckoutRequest): Promise<CheckoutResult> {
  const { payload, state, log } = deps
  const { customer, form } = req
  const locale: Locale = form.locale
  const key = orderIdempotencyKey(customer.id, form.nonce)
  if (!key) return { ok: false, code: 'invalid' }

  // 1. Same form submitted again (double click, back button, retry): one order, no second provider call.
  const existing = await findByKey(payload, key)
  if (existing) {
    const owner = typeof existing.customer === 'object' ? existing.customer?.id : existing.customer
    if (owner !== customer.id) return { ok: false, code: 'error' }
    return { ok: true, kind: 'duplicate', orderNumber: existing.orderNumber, locale: existing.locale === 'en' ? 'en' : 'tr' }
  }

  if (customer._verified !== true) return { ok: false, code: 'unverified' }
  if (!state.checkoutOpen) return { ok: false, code: 'closed' }

  // 2. Edition, price and VAT are recomputed here; nothing money-related comes from the form.
  const target = await loadCheckoutTarget(payload, locale, form.sku)
  if (!target) return { ok: false, code: 'unavailable' }
  const offer = resolveCheckoutOffer(state, target.edition)
  const price = offer?.prices.find((p) => p.currency === (form.currency as Currency))
  if (!offer || !price) return { ok: false, code: 'unavailable' }
  const provider = deps.providers[price.provider]
  if (!provider || !state.availableProviders.includes(price.provider)) return { ok: false, code: 'unavailable' }

  // 3. Legal texts: shown and accepted texts must be the current published ones.
  const legal = await loadCommerceLegalSet(payload, locale)
  if (!legal) return { ok: false, code: 'legal_unavailable' }
  if (legalDigest(legal) !== form.legal) return { ok: false, code: 'legal_changed' }

  // 4. Per-customer pending order cap (flood guard); the form-token/IP limiter sits in the action.
  const hourAgo = new Date(deps.now().getTime() - 60 * 60 * 1000).toISOString()
  const { totalDocs: recent } = await payload.count({ collection: 'orders', overrideAccess: true, where: { and: [{ customer: { equals: customer.id } }, { status: { equals: 'pending' } }, { createdAt: { greater_than: hourAgo } }] } })
  if (recent >= MAX_PENDING_PER_HOUR) return { ok: false, code: 'rate' }

  const acceptedAt = deps.now()
  const orderNumber = generateOrderNumber(acceptedAt)
  const seller = await readSeller(payload, locale)
  const corporate = form.type === 'corporate'
  const billing = {
    type: form.type, name: form.name, ...(corporate ? { company: form.company, taxNumber: form.taxNumber, taxOffice: form.taxOffice } : { identityNumber: form.identityNumber }),
    email: customer.email, phone: form.phone, addressLine: form.addressLine, district: form.district || undefined, city: form.city, postalCode: form.postalCode || undefined, country: form.country,
  }
  const snapshot = buildContractSnapshot({
    locale, orderNumber, acceptedAt, seller, waiverAccepted: form.consentWaiver === 'on', legal: legal as CommerceLegalSet,
    buyer: { ...billing, identityNumber: billing.type === 'individual' ? form.identityNumber : undefined, taxNumber: corporate ? form.taxNumber : undefined },
    item: { title: target.edition.title, sku: target.edition.sku, licenseType: target.edition.licenseType, durationMonths: target.edition.durationMonths, seats: target.edition.seats },
    amounts: price, taxMode: offer.taxMode,
  })
  // The snapshot masks the TCKN; billing and contract access are restricted to admins and the owner.

  // 5. Order first (pending, no provider reference yet), then the provider session. A crash in between leaves a
  //    pending order without `providerRef` that the reconcile job cancels (`checkout_not_started`).
  let orderId: number
  try {
    const order = await payload.create({
      collection: 'orders', overrideAccess: true, depth: 0, select: { orderNumber: true },
      data: {
        orderNumber, customer: customer.id, status: 'pending', currency: price.currency, locale, provider: price.provider, providerEnv: provider.env,
        idempotencyKey: key,
        items: [{
          edition: target.edition.id, sku: target.edition.sku, title: target.edition.title, licenseType: target.edition.licenseType,
          durationMonths: target.edition.durationMonths ?? undefined, seats: target.edition.seats ?? 1, taxMode: offer.taxMode,
          unitNetMinor: price.netMinor, vatRateBasisPoints: price.vatRateBasisPoints, vatMinor: price.vatMinor, lineTotalMinor: price.totalMinor,
        }],
        subtotalMinor: price.netMinor, vatMinor: price.vatMinor, totalMinor: price.totalMinor,
        billing,
        consents: {
          preInformationVersion: legal.preInformation.updatedAt, distanceSalesVersion: legal.distanceSales.updatedAt,
          digitalWaiverAccepted: form.consentWaiver === 'on', acceptedAt: acceptedAt.toISOString(),
          ip: req.ip.slice(0, 64), userAgent: req.userAgent.slice(0, 200), snapshotSha256: snapshotSha256(snapshot),
        },
        contractSnapshot: snapshot,
      } as never,
    })
    orderId = order.id as number
  } catch (error) {
    // Concurrent double submit: the other request won the unique index (Payload reports it as a localized
    // ValidationError, so the message is not inspected: any failed create re-checks the key).
    const winner = await findByKey(payload, key).catch(() => undefined)
    if (winner) return { ok: true, kind: 'duplicate', orderNumber: winner.orderNumber, locale }
    log.error(`checkout order create failed code=${errorCode(error)}`)
    return { ok: false, code: 'error' }
  }

  // 6. Provider session (hosted page; card data never reaches this server).
  const { name, surname } = splitName(form.name)
  const returnUrl = `${req.origin}${orderPagePath(locale, orderNumber)}`
  try {
    const session = await provider.createCheckout({
      orderNumber, idempotencyKey: key, currency: price.currency, totalMinor: price.totalMinor, locale,
      item: { sku: target.edition.sku, title: target.edition.title },
      buyer: {
        id: String(customer.id), name, surname, email: customer.email, identityNumber: corporate ? form.taxNumber : form.identityNumber,
        gsmNumber: providerPhone(form.phone, form.country), address: form.addressLine, city: form.city, country: form.country,
        ...(form.postalCode ? { zipCode: form.postalCode } : {}), ip: isIP(req.ip) ? req.ip : '127.0.0.1',
      },
      urls: { callbackUrl: `${req.origin}/api/payments/${price.provider}/callback`, successUrl: `${returnUrl}?s={CHECKOUT_SESSION_ID}`, cancelUrl: returnUrl },
      expiresAt: new Date(acceptedAt.getTime() + CHECKOUT_SESSION_TTL_MS),
    })
    await payload.update({ collection: 'orders', id: orderId, overrideAccess: true, depth: 0, select: { orderNumber: true }, data: { providerRef: session.providerRef, providerEnv: session.providerEnv } as never })
    log.info(`checkout started order=${orderNumber} provider=${price.provider}`)
    return { ok: true, kind: 'redirect', redirectUrl: session.redirectUrl, orderNumber }
  } catch (error) {
    const code = errorCode(error)
    log.error(`checkout provider failed order=${orderNumber} code=${code}`)
    if (canTransition('pending', 'failed')) {
      try {
        await payload.update({ collection: 'orders', id: orderId, overrideAccess: true, depth: 0, select: { orderNumber: true }, data: { status: 'failed', failureReason: `checkout_${code}`.slice(0, 40) } as never })
      } catch {
        log.error(`checkout order close failed order=${orderNumber}`)
      }
    }
    return { ok: false, code: 'provider_failed', orderNumber }
  }
}
