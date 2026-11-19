import type { CustomerUser } from '@/access'
import type { Locale } from '@/i18n/routing'
import { ORDER_NUMBER_RE } from '@/lib/payments/idempotency'
import { getPayloadClient } from '@/lib/site'

/**
 * Customer view of `orders` (P5). Every query runs AS the customer with access rules enforced
 * (`orders.access.read`), plus an explicit `customer = me` filter as defence in depth: another customer's
 * order number is indistinguishable from a missing one (null → 404). Read-only in every commerce mode (S3).
 * Staff-only fields (`requiresReview`, `notifications`, `notes`, `idempotencyKey`, provider references) are never
 * selected, and field access hides them from customers anyway.
 */

export const ORDER_STATUS_KEYS = ['pending', 'paid', 'fulfilled', 'failed', 'refunded', 'cancelled'] as const
export type PortalOrderStatus = (typeof ORDER_STATUS_KEYS)[number]

export type PortalOrderItem = { title: string; sku: string; seats: number | null; licenseType: string; durationMonths: number | null; vatRateBasisPoints: number; unitNetMinor: number; vatMinor: number; lineTotalMinor: number; licenseId: number | null }

export type PortalOrder = {
  id: number
  orderNumber: string
  status: PortalOrderStatus
  currency: 'TRY' | 'USD' | 'EUR'
  subtotalMinor: number
  vatMinor: number
  totalMinor: number
  createdAt: string
  paidAt: string | null
  fulfilledAt: string | null
  locale: 'tr' | 'en'
  items: PortalOrderItem[]
  invoice: { number: string | null; issuedAt: string | null } | null
  billing: { type: string; name: string; company: string | null; identityNumber: string | null; taxNumber: string | null; taxOffice: string | null; phone: string | null; address: string } | null
  consents: { acceptedAt: string | null; waiver: boolean } | null
  contractSnapshot: string | null
}

const as = (customer: CustomerUser, locale: Locale) => ({ locale, user: customer, overrideAccess: false as const, draft: false as const })
const asStatus = (value: unknown): PortalOrderStatus => ((ORDER_STATUS_KEYS as readonly unknown[]).includes(value) ? (value as PortalOrderStatus) : 'pending')
const idOf = (v: unknown): number | null => (typeof v === 'number' ? v : v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'number' ? (v as { id: number }).id : null)
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)

/** Masks identity numbers on screen (the full value stays in the order and in the owner's own data export). */
const maskId = (v: string | null) => (v ? `${'•'.repeat(Math.max(0, v.length - 3))}${v.slice(-3)}` : null)

type Raw = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

function toOrder(doc: Raw, withContract: boolean): PortalOrder {
  const b = doc.billing as Raw | undefined
  const c = doc.consents as Raw | undefined
  const address = [b?.addressLine, b?.district, b?.postalCode, b?.city, b?.country].filter((p) => typeof p === 'string' && p.trim()).join(', ')
  return {
    id: doc.id, orderNumber: doc.orderNumber, status: asStatus(doc.status), currency: doc.currency, subtotalMinor: doc.subtotalMinor, vatMinor: doc.vatMinor, totalMinor: doc.totalMinor,
    createdAt: doc.createdAt, paidAt: str(doc.paidAt), fulfilledAt: str(doc.fulfilledAt), locale: doc.locale === 'en' ? 'en' : 'tr',
    items: ((doc.items ?? []) as Raw[]).map((i) => ({
      title: String(i.title ?? ''), sku: String(i.sku ?? ''), seats: typeof i.seats === 'number' ? i.seats : null, licenseType: String(i.licenseType ?? ''), durationMonths: typeof i.durationMonths === 'number' ? i.durationMonths : null,
      vatRateBasisPoints: Number(i.vatRateBasisPoints ?? 0), unitNetMinor: Number(i.unitNetMinor ?? 0), vatMinor: Number(i.vatMinor ?? 0), lineTotalMinor: Number(i.lineTotalMinor ?? 0), licenseId: idOf(i.license),
    })),
    invoice: doc.invoice && (str(doc.invoice.number) || str(doc.invoice.issuedAt)) ? { number: str(doc.invoice.number), issuedAt: str(doc.invoice.issuedAt) } : null,
    billing: b ? { type: String(b.type ?? ''), name: String(b.name ?? ''), company: str(b.company), identityNumber: maskId(str(b.identityNumber)), taxNumber: maskId(str(b.taxNumber)), taxOffice: str(b.taxOffice), phone: str(b.phone), address } : null,
    consents: c ? { acceptedAt: str(c.acceptedAt), waiver: c.digitalWaiverAccepted === true } : null,
    contractSnapshot: withContract ? str(doc.contractSnapshot) : null,
  }
}

const listSelect = { orderNumber: true, status: true, currency: true, subtotalMinor: true, vatMinor: true, totalMinor: true, createdAt: true, paidAt: true, fulfilledAt: true, locale: true, items: true } as const

export async function getMyOrders(customer: CustomerUser, locale: Locale, limit = 100): Promise<PortalOrder[]> {
  const { docs } = await (await getPayloadClient()).find({
    collection: 'orders', ...as(customer, locale), where: { customer: { equals: customer.id } }, sort: '-createdAt', limit, depth: 0, select: listSelect,
  })
  return docs.map((d) => toOrder(d as Raw, false))
}

export async function countMyOrders(customer: CustomerUser): Promise<number> {
  const { totalDocs } = await (await getPayloadClient()).count({ collection: 'orders', user: customer, overrideAccess: false, where: { customer: { equals: customer.id } } })
  return totalDocs
}

/** Newest order number of the signed-in customer (used by the payment-return redirect). */
export async function getLatestOrderNumber(customer: CustomerUser): Promise<string | null> {
  const { docs } = await (await getPayloadClient()).find({
    collection: 'orders', user: customer, overrideAccess: false, where: { customer: { equals: customer.id } }, sort: '-createdAt', limit: 1, depth: 0, select: { orderNumber: true },
  })
  return str((docs[0] as Raw | undefined)?.orderNumber)
}

/** Null when the order does not exist OR belongs to someone else (indistinguishable on purpose). */
export async function getMyOrder(customer: CustomerUser, locale: Locale, orderNumber: string): Promise<PortalOrder | null> {
  if (!ORDER_NUMBER_RE.test(orderNumber)) return null
  try {
    const { docs } = await (await getPayloadClient()).find({
      collection: 'orders', ...as(customer, locale), where: { and: [{ orderNumber: { equals: orderNumber } }, { customer: { equals: customer.id } }] }, limit: 1, depth: 0,
    })
    const doc = docs[0] as Raw | undefined
    return doc && idOf(doc.customer) === customer.id ? toOrder(doc, true) : null
  } catch {
    return null
  }
}

export type LastBilling = Partial<Record<'type' | 'name' | 'company' | 'identityNumber' | 'taxNumber' | 'taxOffice' | 'phone' | 'addressLine' | 'district' | 'city' | 'postalCode' | 'country', string>>

/** Billing details of the customer's newest order, to pre-fill the next checkout (the plan stores no billing on `customers`). */
export async function getLastBilling(customer: CustomerUser): Promise<LastBilling> {
  const { docs } = await (await getPayloadClient()).find({
    collection: 'orders', user: customer, overrideAccess: false, where: { customer: { equals: customer.id } }, sort: '-createdAt', limit: 1, depth: 0, select: { billing: true },
  })
  const b = ((docs[0] as Raw | undefined)?.billing ?? {}) as Raw
  const out: LastBilling = {}
  for (const key of ['type', 'name', 'company', 'identityNumber', 'taxNumber', 'taxOffice', 'phone', 'addressLine', 'district', 'city', 'postalCode', 'country'] as const) {
    if (typeof b[key] === 'string' && b[key]) out[key] = b[key]
  }
  return out
}
