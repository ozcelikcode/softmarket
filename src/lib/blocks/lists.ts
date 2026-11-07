import { LIST_LAYOUTS, LIST_SORTS, MAX_LIST_LIMIT, type ListLayout, type ListSort } from '@/blocks/list-fields'
import { safeHref } from '@/lib/utils'

/** Pure helpers shared by data loaders and list block renderers (no I/O, no React). */

export const idOf = (value: unknown): number | null => {
  const raw = value && typeof value === 'object' ? (value as { id?: unknown }).id : value
  return typeof raw === 'number' && Number.isSafeInteger(raw) && raw > 0 ? raw : null
}

/** Relationship (hasMany) value -> unique numeric IDs, order kept. Populated docs are accepted too. */
export const idsOf = (value: unknown): number[] => {
  const out: number[] = []
  if (Array.isArray(value)) for (const item of value) { const id = idOf(item); if (id !== null && !out.includes(id)) out.push(id) }
  return out
}

export const clampLimit = (value: unknown, fallback: number): number => {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback
  return Math.min(Math.max(n, 1), MAX_LIST_LIMIT)
}

export const normalizeSort = (value: unknown, fallback: ListSort): ListSort =>
  (LIST_SORTS as readonly string[]).includes(value as string) ? (value as ListSort) : fallback

export const normalizeLayout = (value: unknown, fallback: ListLayout = 'grid-3'): ListLayout =>
  (LIST_LAYOUTS as readonly string[]).includes(value as string) ? (value as ListLayout) : fallback

/** Responsive grid classes. Mobile is always one column. */
export function gridClass(layout: ListLayout | 'alternating'): string {
  switch (layout) {
    case 'grid-2': return 'grid gap-5 md:grid-cols-2'
    case 'grid-4': return 'grid gap-5 md:grid-cols-2 lg:grid-cols-4'
    case 'list': return 'grid gap-3'
    case 'alternating': return 'grid gap-10 lg:gap-14'
    default: return 'grid gap-5 md:grid-cols-2 lg:grid-cols-3'
  }
}

/** Stagger index: keep within the grid's column count so rows enter together. */
export const staggerIndex = (i: number, layout: ListLayout | 'alternating'): number =>
  layout === 'grid-2' ? i % 2 : layout === 'grid-4' ? i % 4 : layout === 'list' || layout === 'alternating' ? 0 : i % 3

/**
 * "View all" target: editor value (internal `/path` or http(s)) when safe, else the block's default.
 * Returns null when the link is switched off.
 */
export function resolveViewAll(
  block: { showViewAll?: boolean | null; viewAllUrl?: string | null; viewAllLabel?: string | null },
  defaultHref: string,
  defaultLabel: string,
): { href: string; label: string } | null {
  if (block.showViewAll === false) return null
  const custom = typeof block.viewAllUrl === 'string' ? block.viewAllUrl.trim() : ''
  const safe = custom ? safeHref(custom) : null
  const href = safe && /^(?:\/(?!\/)|https?:\/\/)/i.test(safe) ? safe : defaultHref
  return { href, label: block.viewAllLabel?.trim() || defaultLabel }
}

/** Reorders `docs` by the editor's selection order (unknown ids last, stable). */
export function orderByIds<T extends { id: number }>(docs: T[], ids: readonly number[]): T[] {
  const rank = new Map(ids.map((id, i) => [id, i]))
  return [...docs].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity))
}
