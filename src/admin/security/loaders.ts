import type { Payload, PayloadRequest, Where } from 'payload'

import { isAdminSessionUser } from './guard'
import { documentHref, safeDetail, shortHash, type SafeDetail } from './format'
import {
  HIGH_SEVERITIES,
  PAGE_SIZE,
  blocksWhere,
  eventsWhere,
  statusLogWhere,
  type SecurityQuery,
} from './query'
import { SECURITY_SEVERITIES } from '@/lib/licensing/constants'

/*
 * L6a data loaders for the security center (server only, read-only). Every read goes through the Local API with the
 * REQUESTING admin user and `overrideAccess: false`, so the collection access rules (`isPanelAdmin`: admin + cookie
 * session) stay the single authority; there is no overrideAccess read. Rows are SHAPED into explicit allow-listed
 * view models: raw documents never reach the page, `select` keeps sensitive columns (license key, customer e-mail,
 * device keys, fingerprint hashes) out of the query in the first place, and relation targets are resolved with a
 * projection of a few non-secret columns.
 */

export type ReadContext = {
  payload: Payload
  user: NonNullable<PayloadRequest['user']>
  headers: Headers
  lang: 'tr' | 'en'
  adminRoute: string
  now: Date
}

export type Paginated<T> = { rows: T[]; page: number; totalPages: number; totalDocs: number }
export type Ref = { id: number; href: string }
export type LicenseRef = Ref & { publicId: string; status: string | null; product: { id: number; title: string } | null }
export type ActivationRef = Ref & { publicId: string }

export type EventRow = {
  id: number
  href: string
  type: string
  severity: string
  source: string
  count: number
  triage: string
  actionTaken: string | null
  firstSeenAt: string | null
  lastSeenAt: string | null
  ipPrefix: string
  ipHash: string
  country: string
  ruleKey: string
  detail: SafeDetail
  license: LicenseRef | null
  activation: ActivationRef | null
  customer: Ref | null
  order: Ref | null
  actor: Ref | null
}

export type BlockRow = {
  id: number
  href: string
  kind: string
  value: string
  scope: string
  source: string
  reason: string
  state: 'active' | 'expired' | 'lifted'
  createdAt: string | null
  expiresAt: string | null
  liftedAt: string | null
  liftReason: string
  event: Ref | null
}

export type TransitionRow = {
  id: number
  href: string
  from: string
  to: string
  reason: string | null
  source: string
  ruleKey: string
  note: string
  at: string | null
  license: LicenseRef | null
  event: Ref | null
  order: Ref | null
  actor: Ref | null
}

export type SuspendedLicenseRow = {
  id: number
  href: string
  publicId: string
  statusReason: string | null
  statusSource: string | null
  statusChangedAt: string | null
  product: { id: number; title: string } | null
}

export type ActivationRow = {
  id: number
  href: string
  publicId: string
  status: string
  deviceLabel: string
  platform: string | null
  appVersion: string
  lastIpPrefix: string
  activatedAt: string | null
  lastSeenAt: string | null
  license: LicenseRef | null
}

export type Summary = {
  openHigh: number | null
  openTotal: number | null
  last24h: number | null
  activeBlocks: number | null
  suspended: number | null
  activations24h: number | null
  activationsActive: number | null
  openBySeverity: Record<string, number | null>
}

export type Overview = {
  summary: Summary
  recentHigh: EventRow[] | null
  suspended: SuspendedLicenseRow[] | null
  activations: ActivationRow[] | null
  transitions: TransitionRow[] | null
  /** True when at least one query failed (the page then shows a neutral notice; no error text is exposed). */
  partial: boolean
}

type Doc = Record<string, unknown>
/**
 * Options of every read. Defense in depth: besides the collection access rules (`isPanelAdmin`), a loader refuses to
 * build a query for anyone but an admin cookie session, so a licenses read (which customers and API keys may do for
 * their own scope) can never feed this page by mistake.
 */
const READ = (ctx: ReadContext) => {
  if (!isAdminSessionUser(ctx.user, ctx.headers)) throw new Error('security center: admin panel session required')
  return { user: ctx.user, req: { headers: ctx.headers } as PayloadRequest, overrideAccess: false, depth: 0 } as const
}

export const relId = (value: unknown): number | null => {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'number') return (value as { id: number }).id
  return null
}
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

/** Failure containment: one failing query never blanks the page, and only the error NAME is logged (never row data). */
async function settle<T>(ctx: ReadContext, label: string, run: () => Promise<T>): Promise<T | null> {
  try {
    return await run()
  } catch (error) {
    ctx.payload.logger.error(`security-center: ${label} failed (${error instanceof Error ? error.name : 'error'})`)
    return null
  }
}

async function byIds(ctx: ReadContext, collection: 'licenses' | 'license-activations' | 'products', ids: number[], select: Record<string, true>, locale?: 'tr' | 'en'): Promise<Map<number, Doc>> {
  const unique = [...new Set(ids)]
  const map = new Map<number, Doc>()
  if (!unique.length) return map
  const res = await ctx.payload.find({
    collection,
    where: { id: { in: unique } },
    limit: unique.length,
    pagination: false,
    select: select as never,
    ...(locale ? { locale } : {}),
    ...READ(ctx),
  })
  for (const doc of res.docs as unknown as Doc[]) map.set(doc.id as number, doc)
  return map
}

type Lookups = { licenses: Map<number, Doc>; products: Map<number, Doc>; activations: Map<number, Doc> }

async function resolveLookups(ctx: ReadContext, licenseIds: number[], activationIds: number[] = []): Promise<Lookups> {
  const licenses = await byIds(ctx, 'licenses', licenseIds, { publicId: true, status: true, product: true })
  const productIds = [...licenses.values()].map((l) => relId(l.product)).filter((id): id is number => id !== null)
  const [products, activations] = await Promise.all([
    byIds(ctx, 'products', productIds, { title: true }, ctx.lang),
    byIds(ctx, 'license-activations', activationIds, { publicId: true }),
  ])
  return { licenses, products, activations }
}

const ref = (ctx: ReadContext, collection: string, value: unknown): Ref | null => {
  const id = relId(value)
  return id === null ? null : { id, href: documentHref(ctx.adminRoute, collection, id) }
}

function licenseRef(ctx: ReadContext, value: unknown, lookups: Lookups): LicenseRef | null {
  const id = relId(value)
  if (id === null) return null
  const doc = lookups.licenses.get(id)
  const productId = doc ? relId(doc.product) : null
  const productDoc = productId === null ? undefined : lookups.products.get(productId)
  return {
    id,
    href: documentHref(ctx.adminRoute, 'licenses', id),
    publicId: str(doc?.publicId),
    status: strOrNull(doc?.status),
    product: productId === null ? null : { id: productId, title: str(productDoc?.title) },
  }
}

const EVENT_SELECT = {
  type: true, severity: true, source: true, count: true, triage: true, actionTaken: true,
  firstSeenAt: true, lastSeenAt: true, ipPrefix: true, ipHash: true, country: true, ruleKey: true, detail: true,
  license: true, activation: true, customer: true, order: true, actorUser: true,
} as const

async function shapeEvents(ctx: ReadContext, docs: Doc[]): Promise<EventRow[]> {
  const lookups = await resolveLookups(
    ctx,
    docs.map((d) => relId(d.license)).filter((id): id is number => id !== null),
    docs.map((d) => relId(d.activation)).filter((id): id is number => id !== null),
  )
  return docs.map((d): EventRow => {
    const activationId = relId(d.activation)
    const activationDoc = activationId === null ? undefined : lookups.activations.get(activationId)
    return {
      id: d.id as number,
      href: documentHref(ctx.adminRoute, 'security-events', d.id as number),
      type: str(d.type),
      severity: str(d.severity),
      source: str(d.source),
      count: typeof d.count === 'number' ? d.count : 1,
      triage: str(d.triage) || 'open',
      actionTaken: strOrNull(d.actionTaken),
      firstSeenAt: strOrNull(d.firstSeenAt),
      lastSeenAt: strOrNull(d.lastSeenAt),
      ipPrefix: str(d.ipPrefix),
      ipHash: shortHash(str(d.ipHash)),
      country: str(d.country),
      ruleKey: str(d.ruleKey),
      detail: safeDetail(d.detail),
      license: licenseRef(ctx, d.license, lookups),
      activation: activationId === null ? null : { id: activationId, href: documentHref(ctx.adminRoute, 'license-activations', activationId), publicId: str(activationDoc?.publicId) },
      customer: ref(ctx, 'customers', d.customer),
      order: ref(ctx, 'orders', d.order),
      actor: ref(ctx, 'users', d.actorUser),
    }
  })
}

function page<T>(res: { totalDocs: number; totalPages: number; page?: number }, rows: T[]): Paginated<T> {
  return { rows, page: res.page ?? 1, totalPages: res.totalPages, totalDocs: res.totalDocs }
}

export async function loadEvents(ctx: ReadContext, q: SecurityQuery): Promise<Paginated<EventRow>> {
  const res = await ctx.payload.find({
    collection: 'security-events',
    where: eventsWhere(q, ctx.now),
    sort: ['-lastSeenAt', '-id'],
    page: q.page,
    limit: PAGE_SIZE.events,
    select: EVENT_SELECT,
    ...READ(ctx),
  })
  return page(res, await shapeEvents(ctx, res.docs as unknown as Doc[]))
}

const blockState = (d: Doc, now: Date): BlockRow['state'] => {
  if (d.active === false || d.liftedAt) return 'lifted'
  const exp = strOrNull(d.expiresAt)
  return exp && new Date(exp).getTime() <= now.getTime() ? 'expired' : 'active'
}

export async function loadBlocks(ctx: ReadContext, q: SecurityQuery): Promise<Paginated<BlockRow>> {
  const res = await ctx.payload.find({
    collection: 'security-blocks',
    where: blocksWhere(q, ctx.now),
    sort: ['-createdAt', '-id'],
    page: q.page,
    limit: PAGE_SIZE.blocks,
    select: { kind: true, value: true, scope: true, source: true, reason: true, active: true, expiresAt: true, liftedAt: true, liftReason: true, event: true, createdAt: true },
    ...READ(ctx),
  })
  const rows = (res.docs as unknown as Doc[]).map((d): BlockRow => ({
    id: d.id as number,
    href: documentHref(ctx.adminRoute, 'security-blocks', d.id as number),
    kind: str(d.kind),
    // Never expose raw/full fingerprint hashes in the block list; display the shortened prefix like ipHash.
    value: d.kind === 'fingerprint' ? shortHash(str(d.value)) : str(d.value),
    scope: str(d.scope),
    source: str(d.source),
    reason: str(d.reason),
    state: blockState(d, ctx.now),
    createdAt: strOrNull(d.createdAt),
    expiresAt: strOrNull(d.expiresAt),
    liftedAt: strOrNull(d.liftedAt),
    liftReason: str(d.liftReason),
    event: ref(ctx, 'security-events', d.event),
  }))
  return page(res, rows)
}

async function shapeTransitions(ctx: ReadContext, docs: Doc[]): Promise<TransitionRow[]> {
  const lookups = await resolveLookups(ctx, docs.map((d) => relId(d.license)).filter((id): id is number => id !== null))
  return docs.map((d): TransitionRow => ({
    id: d.id as number,
    href: documentHref(ctx.adminRoute, 'license-status-log', d.id as number),
    from: str(d.from),
    to: str(d.to),
    reason: strOrNull(d.reason),
    source: str(d.source),
    ruleKey: str(d.ruleKey),
    note: str(d.note).slice(0, 160),
    at: strOrNull(d.at),
    license: licenseRef(ctx, d.license, lookups),
    event: ref(ctx, 'security-events', d.event),
    order: ref(ctx, 'orders', d.order),
    actor: ref(ctx, 'users', d.actorUser),
  }))
}

const STATUS_LOG_SELECT = { license: true, from: true, to: true, reason: true, source: true, ruleKey: true, note: true, at: true, event: true, order: true, actorUser: true } as const

export async function loadStatusLog(ctx: ReadContext, q: SecurityQuery, limit: number = PAGE_SIZE.statusLog, pageNo: number = q.page): Promise<Paginated<TransitionRow>> {
  const res = await ctx.payload.find({
    collection: 'license-status-log',
    where: statusLogWhere(q, ctx.now),
    sort: ['-at', '-id'],
    page: pageNo,
    limit,
    select: STATUS_LOG_SELECT,
    ...READ(ctx),
  })
  return page(res, await shapeTransitions(ctx, res.docs as unknown as Doc[]))
}

export async function loadProductOptions(ctx: ReadContext): Promise<{ id: number; title: string }[]> {
  const res = await ctx.payload.find({
    collection: 'products', limit: 200, pagination: false, sort: 'title', locale: ctx.lang, select: { title: true }, ...READ(ctx),
  })
  return (res.docs as unknown as Doc[]).map((d) => ({ id: d.id as number, title: str(d.title) || `#${String(d.id)}` }))
}

const count = (ctx: ReadContext, collection: 'security-events' | 'security-blocks' | 'licenses' | 'license-activations', where: Where) =>
  settle(ctx, `count ${collection}`, async () => (await ctx.payload.count({ collection, where, ...READ(ctx) })).totalDocs)

export async function loadSummary(ctx: ReadContext): Promise<Summary> {
  const nowIso = ctx.now.toISOString()
  const dayAgo = new Date(ctx.now.getTime() - 86_400_000).toISOString()
  const openHigh: Where = { and: [{ triage: { equals: 'open' } }, { severity: { in: [...HIGH_SEVERITIES] } }] }
  const [openHighN, openTotal, last24h, activeBlocks, suspended, activations24h, activationsActive, ...bySeverity] = await Promise.all([
    count(ctx, 'security-events', openHigh),
    count(ctx, 'security-events', { triage: { equals: 'open' } }),
    count(ctx, 'security-events', { lastSeenAt: { greater_than_equal: dayAgo } }),
    count(ctx, 'security-blocks', { and: [{ active: { equals: true } }, { or: [{ expiresAt: { exists: false } }, { expiresAt: { greater_than: nowIso } }] }] }),
    count(ctx, 'licenses', { status: { equals: 'suspended' } }),
    count(ctx, 'license-activations', { activatedAt: { greater_than_equal: dayAgo } }),
    count(ctx, 'license-activations', { status: { equals: 'active' } }),
    ...SECURITY_SEVERITIES.map((s) => count(ctx, 'security-events', { and: [{ triage: { equals: 'open' } }, { severity: { equals: s } }] })),
  ])
  return {
    openHigh: openHighN,
    openTotal,
    last24h,
    activeBlocks,
    suspended,
    activations24h,
    activationsActive,
    openBySeverity: Object.fromEntries(SECURITY_SEVERITIES.map((s, i) => [s, bySeverity[i] ?? null])),
  }
}

/** Open high/critical events, newest first (used by the overview and by the nav badge count). */
export async function loadRecentHigh(ctx: ReadContext, limit = 5): Promise<EventRow[]> {
  const res = await ctx.payload.find({
    collection: 'security-events',
    where: { and: [{ triage: { equals: 'open' } }, { severity: { in: [...HIGH_SEVERITIES] } }] },
    sort: ['-lastSeenAt', '-id'],
    limit,
    select: EVENT_SELECT,
    ...READ(ctx),
  })
  return shapeEvents(ctx, res.docs as unknown as Doc[])
}

export async function loadSuspendedLicenses(ctx: ReadContext, limit = 10): Promise<SuspendedLicenseRow[]> {
  const res = await ctx.payload.find({
    collection: 'licenses',
    where: { status: { equals: 'suspended' } },
    sort: ['-statusChangedAt', '-id'],
    limit,
    // Never `key`, `customer`, `notes` or any other column: only what the table prints.
    select: { publicId: true, statusReason: true, statusSource: true, statusChangedAt: true, product: true },
    ...READ(ctx),
  })
  const docs = res.docs as unknown as Doc[]
  const products = await byIds(ctx, 'products', docs.map((d) => relId(d.product)).filter((id): id is number => id !== null), { title: true }, ctx.lang)
  return docs.map((d): SuspendedLicenseRow => {
    const productId = relId(d.product)
    return {
      id: d.id as number,
      href: documentHref(ctx.adminRoute, 'licenses', d.id as number),
      publicId: str(d.publicId),
      statusReason: strOrNull(d.statusReason),
      statusSource: strOrNull(d.statusSource),
      statusChangedAt: strOrNull(d.statusChangedAt),
      product: productId === null ? null : { id: productId, title: str(products.get(productId)?.title) },
    }
  })
}

export async function loadRecentActivations(ctx: ReadContext, limit = 10): Promise<ActivationRow[]> {
  const res = await ctx.payload.find({
    collection: 'license-activations',
    sort: ['-activatedAt', '-id'],
    limit,
    // Never devicePublicKey, deviceKeyThumbprint, fingerprintHash, lastIpHash, counters or endNonce.
    select: { publicId: true, status: true, deviceLabel: true, platform: true, appVersion: true, lastIpPrefix: true, activatedAt: true, lastSeenAt: true, license: true },
    ...READ(ctx),
  })
  const docs = res.docs as unknown as Doc[]
  const lookups = await resolveLookups(ctx, docs.map((d) => relId(d.license)).filter((id): id is number => id !== null))
  return docs.map((d): ActivationRow => ({
    id: d.id as number,
    href: documentHref(ctx.adminRoute, 'license-activations', d.id as number),
    publicId: str(d.publicId),
    status: str(d.status),
    deviceLabel: str(d.deviceLabel),
    platform: strOrNull(d.platform),
    appVersion: str(d.appVersion),
    lastIpPrefix: str(d.lastIpPrefix),
    activatedAt: strOrNull(d.activatedAt),
    lastSeenAt: strOrNull(d.lastSeenAt),
    license: licenseRef(ctx, d.license, lookups),
  }))
}

export async function loadOverview(ctx: ReadContext, q: SecurityQuery): Promise<Overview> {
  const [summary, recentHigh, suspended, activations, transitions] = await Promise.all([
    loadSummary(ctx),
    settle(ctx, 'recent high events', () => loadRecentHigh(ctx)),
    settle(ctx, 'suspended licenses', () => loadSuspendedLicenses(ctx)),
    settle(ctx, 'recent activations', () => loadRecentActivations(ctx)),
    settle(ctx, 'recent transitions', async () => (await loadStatusLog(ctx, { ...q, range: 'all', license: null, product: null }, 8, 1)).rows),
  ])
  const counters = [summary.openHigh, summary.openTotal, summary.last24h, summary.activeBlocks, summary.suspended, summary.activations24h, summary.activationsActive, ...Object.values(summary.openBySeverity)]
  return { summary, recentHigh, suspended, activations, transitions, partial: counters.includes(null) || [recentHigh, suspended, activations, transitions].includes(null) }
}

/** Count for the admin nav badge: open high/critical events. `null` = unreadable (the badge is then omitted). */
export async function countOpenHighEvents(payload: Payload, user: ReadContext['user'], headers: Headers | null | undefined): Promise<number | null> {
  try {
    if (!isAdminSessionUser(user, headers)) return null
    const res = await payload.count({
      collection: 'security-events',
      where: { and: [{ triage: { equals: 'open' } }, { severity: { in: [...HIGH_SEVERITIES] } }] },
      user,
      req: { headers: headers! } as PayloadRequest,
      overrideAccess: false,
    })
    return res.totalDocs
  } catch {
    return null
  }
}
