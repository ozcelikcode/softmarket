import type { Where } from 'payload'

import type { CustomerUser } from '@/access'
import type { Locale } from '@/i18n/routing'
import { mediaOf, relOf } from '@/lib/content'
import { isUsableState, licenseState, maskLicenseKey } from '@/lib/licenses/state'
import { getPayloadClient } from '@/lib/site'
import type { Edition, Product, Release, SupportTicket } from '@/payload-types'

/**
 * Every query runs AS the customer with access rules enforced (`overrideAccess: false`);
 * the explicit customer filter is defence in depth, not the only barrier.
 */
const as = (customer: CustomerUser, locale: Locale) => ({
  locale,
  user: customer,
  overrideAccess: false as const,
  draft: false as const,
})

const idOf = (value: unknown): number | null =>
  typeof value === 'number' ? value : value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'number' ? (value as { id: number }).id : null

export type PortalLicense = {
  id: number
  maskedKey: string
  productId: number | null
  product: string
  edition: string
  sku: string
  seats: number | null
  startsAt: string | null
  expiresAt: string | null
  state: ReturnType<typeof licenseState>['state']
  daysLeft: number | null
}

export async function getMyLicenses(customer: CustomerUser, locale: Locale, now = new Date()): Promise<PortalLicense[]> {
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'licenses',
    ...as(customer, locale),
    where: { customer: { equals: customer.id } },
    sort: '-createdAt',
    // This list also decides support entitlement; an arbitrary display cap must not deny old licenses.
    limit: 0,
    pagination: false,
    depth: 1,
    select: { key: true, edition: true, product: true, startsAt: true, expiresAt: true, seats: true, status: true },
    populate: { editions: { title: true, sku: true }, products: { title: true } },
  })
  return docs.map((l) => {
    const edition = relOf<Edition>(l.edition)
    const product = relOf<Product>(l.product)
    const { state, daysLeft } = licenseState(l, now)
    return {
      id: l.id,
      maskedKey: maskLicenseKey(l.key),
      productId: idOf(l.product),
      product: product?.title ?? '',
      edition: edition?.title ?? '',
      sku: edition?.sku ?? '',
      seats: l.seats ?? null,
      startsAt: l.startsAt ?? null,
      expiresAt: l.expiresAt ?? null,
      state,
      daysLeft,
    }
  })
}

/** Products the customer may use right now (active/expiring licenses). */
export const usableProducts = (licenses: PortalLicense[]) => {
  const seen = new Map<number, string>()
  for (const l of licenses) if (l.productId && isUsableState(l.state)) seen.set(l.productId, l.product)
  return [...seen].map(([id, title]) => ({ id, title }))
}

/** The only place a full key leaves the server: owner-scoped read on explicit user action. */
export async function getMyLicenseKey(customer: CustomerUser, id: number): Promise<string | null> {
  try {
    const l = await (await getPayloadClient()).findByID({
      collection: 'licenses',
      id,
      user: customer,
      overrideAccess: false,
      depth: 0,
      select: { key: true, customer: true },
    })
    return idOf(l.customer) === customer.id ? l.key : null
  } catch {
    return null
  }
}

export type PortalDownload = {
  id: number
  title: string
  description: string | null
  product: string
  version: string
  os: string
  arch: string | null
  access: string
  url: string | null
  checksum: string | null
}

export async function getMyDownloads(customer: CustomerUser, locale: Locale, productIds: number[]): Promise<PortalDownload[]> {
  if (!productIds.length) return []
  const where: Where = { product: { in: productIds } }
  const { docs } = await (await getPayloadClient()).find({
    collection: 'downloads',
    ...as(customer, locale),
    where,
    limit: 300,
    depth: 1,
    sort: '-createdAt',
    select: { title: true, description: true, product: true, release: true, file: true, os: true, arch: true, access: true, checksumSha256: true },
    populate: { products: { title: true }, releases: { version: true }, media: { url: true } },
  })
  return docs.map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description ?? null,
    product: relOf<Product>(d.product)?.title ?? '',
    version: relOf<Release>(d.release)?.version ?? '',
    os: d.os,
    arch: d.arch ?? null,
    access: d.access,
    url: mediaOf(d.file)?.url ?? null,
    checksum: d.checksumSha256 ?? null,
  }))
}

export type PortalTicket = {
  id: number
  subject: string
  status: SupportTicket['status']
  product: string
  lastMessageAt: string | null
  createdAt: string
}

const ticketSelect = { subject: true, status: true, product: true, lastMessageAt: true, createdAt: true } as const

const toTicket = (t: Pick<SupportTicket, 'id' | 'subject' | 'status' | 'product' | 'lastMessageAt' | 'createdAt'>): PortalTicket => ({
  id: t.id,
  subject: t.subject,
  status: t.status,
  product: relOf<Product>(t.product)?.title ?? '',
  lastMessageAt: t.lastMessageAt ?? null,
  createdAt: t.createdAt,
})

export async function getMyTickets(customer: CustomerUser, locale: Locale, limit = 100): Promise<PortalTicket[]> {
  const { docs } = await (await getPayloadClient()).find({
    collection: 'support-tickets',
    ...as(customer, locale),
    where: { customer: { equals: customer.id } },
    sort: '-lastMessageAt',
    limit,
    depth: 1,
    select: ticketSelect,
    populate: { products: { title: true } },
  })
  return docs.map(toTicket)
}

export async function countOpenTickets(customer: CustomerUser): Promise<number> {
  const { totalDocs } = await (await getPayloadClient()).count({
    collection: 'support-tickets',
    user: customer,
    overrideAccess: false,
    where: { and: [{ customer: { equals: customer.id } }, { status: { in: ['open', 'pending'] } }] },
  })
  return totalDocs
}

export type PortalMessage = { id: number; author: 'customer' | 'staff'; body: string; createdAt: string }

/** Null when the ticket does not exist OR belongs to someone else (indistinguishable on purpose). */
export async function getMyTicket(customer: CustomerUser, locale: Locale, id: number) {
  const payload = await getPayloadClient()
  try {
    const ticket = await payload.findByID({
      collection: 'support-tickets',
      id,
      ...as(customer, locale),
      depth: 1,
      select: { ...ticketSelect, customer: true },
      populate: { products: { title: true } },
    })
    if (idOf(ticket.customer) !== customer.id) return null
    const { docs } = await payload.find({
      collection: 'support-ticket-messages',
      ...as(customer, locale),
      where: { ticket: { equals: id } },
      sort: 'createdAt',
      limit: 500,
      depth: 0,
      select: { author: true, body: true, createdAt: true },
    })
    return {
      ticket: toTicket(ticket),
      messages: docs.map((m): PortalMessage => ({ id: m.id, author: m.author, body: m.body, createdAt: m.createdAt })),
    }
  } catch {
    return null
  }
}
