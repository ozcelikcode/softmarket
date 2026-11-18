import type { Where } from 'payload'

import {
  SECURITY_BLOCK_KINDS,
  SECURITY_EVENT_SOURCES,
  SECURITY_EVENT_TYPES,
  SECURITY_SEVERITIES,
  SECURITY_TRIAGE_STATES,
  PUBLIC_ID_RE,
} from '@/lib/licensing/constants'

/*
 * L6a security center query model. The URL is the only state (plain GET form + links, no client JS). Every value is
 * parsed against an allow-list or a strict pattern and silently falls back to the default, so a crafted query string
 * can never reach a `where` clause unvalidated. Pure module (no Payload instance), unit-tested.
 */
export const TABS = ['overview', 'events', 'blocks', 'status-log'] as const
export type Tab = (typeof TABS)[number]

export const RANGES = ['24h', '7d', '30d', 'all'] as const
export type Range = (typeof RANGES)[number]
export const BLOCK_STATES = ['active', 'expired', 'all'] as const
export type BlockState = (typeof BLOCK_STATES)[number]

export const PAGE_SIZE = { events: 50, blocks: 25, statusLog: 25 } as const
export const MAX_PAGE = 10_000
export const HIGH_SEVERITIES = ['high', 'critical'] as const

export type SecurityQuery = {
  tab: Tab
  page: number
  severity: string[]
  type: string | null
  /** `open` is the default; `all` disables the filter. */
  triage: string
  range: Range
  source: string | null
  license: string | null
  licenseInvalid: boolean
  product: number | null
  blockState: BlockState
  blockKind: string | null
}

export type RawSearchParams = Record<string, string | string[] | undefined> | undefined

const first = (v: string | string[] | undefined): string | undefined => {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : undefined
  return undefined
}
const many = (v: string | string[] | undefined): string[] => {
  if (typeof v === 'string') return [v]
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string')
  return []
}
const oneOf = <T extends string>(allowed: readonly T[], v: string | undefined): T | null => (v !== undefined && (allowed as readonly string[]).includes(v) ? (v as T) : null)

export function parseSecurityQuery(raw: RawSearchParams): SecurityQuery {
  const p = raw && typeof raw === 'object' ? raw : {}
  const pageRaw = first(p.page)?.trim() ?? ''
  const pageNum = /^\d+$/.test(pageRaw) ? Number(pageRaw) : 1
  const page = pageNum >= 1 ? Math.min(pageNum, MAX_PAGE) : 1
  const licenseRaw = first(p.license)?.trim().toLowerCase() ?? ''
  const productRaw = first(p.product)?.trim() ?? ''
  const productNum = /^\d{1,12}$/.test(productRaw) ? Number(productRaw) : 0
  const triageRaw = first(p.triage)
  return {
    tab: oneOf(TABS, first(p.tab)) ?? 'overview',
    page,
    severity: [...new Set(many(p.severity).filter((s): s is string => (SECURITY_SEVERITIES as readonly string[]).includes(s)))],
    type: oneOf(SECURITY_EVENT_TYPES, first(p.type)),
    triage: triageRaw === 'all' ? 'all' : (oneOf(SECURITY_TRIAGE_STATES, triageRaw) ?? 'open'),
    range: oneOf(RANGES, first(p.range)) ?? 'all',
    source: oneOf(SECURITY_EVENT_SOURCES, first(p.source)),
    license: PUBLIC_ID_RE.test(licenseRaw) ? licenseRaw : null,
    licenseInvalid: licenseRaw !== '' && !PUBLIC_ID_RE.test(licenseRaw),
    product: Number.isSafeInteger(productNum) && productNum >= 1 ? productNum : null,
    blockState: oneOf(BLOCK_STATES, first(p.blockState)) ?? 'active',
    blockKind: oneOf(SECURITY_BLOCK_KINDS, first(p.blockKind)),
  }
}

const RANGE_MS: Record<Exclude<Range, 'all'>, number> = { '24h': 86_400_000, '7d': 7 * 86_400_000, '30d': 30 * 86_400_000 }
export const since = (range: Range, now: Date): string | null => (range === 'all' ? null : new Date(now.getTime() - RANGE_MS[range]).toISOString())

/** Serialises the query back into a link; only non-default values are written. */
export function securityHref(base: string, q: Partial<SecurityQuery> & { tab: Tab }): string {
  const params = new URLSearchParams()
  if (q.tab !== 'overview') params.set('tab', q.tab)
  if (q.page && q.page > 1) params.set('page', String(q.page))
  for (const s of q.severity ?? []) params.append('severity', s)
  if (q.type) params.set('type', q.type)
  if (q.triage && q.triage !== 'open') params.set('triage', q.triage)
  if (q.range && q.range !== 'all') params.set('range', q.range)
  if (q.source) params.set('source', q.source)
  if (q.license) params.set('license', q.license)
  if (q.product) params.set('product', String(q.product))
  if (q.blockState && q.blockState !== 'active') params.set('blockState', q.blockState)
  if (q.blockKind) params.set('blockKind', q.blockKind)
  const s = params.toString()
  return s ? `${base}?${s}` : base
}

export function eventsWhere(q: SecurityQuery, now: Date): Where {
  const and: Where[] = []
  if (q.severity.length) and.push({ severity: { in: q.severity } })
  if (q.type) and.push({ type: { equals: q.type } })
  if (q.triage !== 'all') and.push({ triage: { equals: q.triage } })
  const from = since(q.range, now)
  if (from) and.push({ lastSeenAt: { greater_than_equal: from } })
  if (q.source) and.push({ source: { equals: q.source } })
  if (q.license) and.push({ 'license.publicId': { equals: q.license } })
  if (q.product !== null) and.push({ 'license.product': { equals: q.product } })
  return { and }
}

export function blocksWhere(q: SecurityQuery, now: Date): Where {
  const and: Where[] = []
  const nowIso = now.toISOString()
  if (q.blockState === 'active') {
    and.push({ active: { equals: true } }, { or: [{ expiresAt: { exists: false } }, { expiresAt: { greater_than: nowIso } }] })
  } else if (q.blockState === 'expired') {
    and.push({ or: [{ active: { equals: false } }, { expiresAt: { less_than_equal: nowIso } }] })
  }
  if (q.blockKind) and.push({ kind: { equals: q.blockKind } })
  return { and }
}

export function statusLogWhere(q: SecurityQuery, now: Date): Where {
  const and: Where[] = []
  const from = since(q.range, now)
  if (from) and.push({ at: { greater_than_equal: from } })
  if (q.license) and.push({ 'license.publicId': { equals: q.license } })
  if (q.product !== null) and.push({ 'license.product': { equals: q.product } })
  return { and }
}
