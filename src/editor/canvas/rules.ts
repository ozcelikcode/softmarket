import {
  isProductBound, PRODUCT_BOUND_BLOCKS, REQUIRED_PRODUCT_BLOCKS, UNHIDEABLE_PRODUCT_BLOCKS, VIRTUAL_ID_PREFIX,
} from '@/lib/blocks/product-composition'

/*
 * V5 visual editor: editor-side mirror of the V2 product rules (the server `validate`/`beforeChange` hooks stay the
 * authority). Pure module, shared by the admin host and the bridge (via the `host` message).
 *
 * - productEditions ("Teklif İste") is required: movable, never removed/hidden/duplicated.
 * - productHero owns the h1: always first, never moved/removed/hidden/duplicated.
 * - Product-bound sections are singletons (no duplicate).
 */

export type CanvasRow = { id: string; blockType: string }
export type CanvasCollection = 'products' | 'pages'

/** First-wave collections. The architecture is collection-agnostic (second wave: solutions, case-studies, families). */
export const VISUAL_EDITOR_COLLECTIONS = ['products', 'pages'] as const satisfies readonly CanvasCollection[]
export const isCanvasCollection = (slug: unknown): slug is CanvasCollection =>
  typeof slug === 'string' && (VISUAL_EDITOR_COLLECTIONS as readonly string[]).includes(slug)

export type CanvasLocks = { remove: string[]; hide: string[]; move: string[]; duplicate: string[] }

/** Block types whose canvas actions are disabled. */
export function canvasLocks(collection: CanvasCollection): CanvasLocks {
  if (collection !== 'products') return { remove: [], hide: [], move: [], duplicate: [] }
  return {
    remove: ['productHero', ...REQUIRED_PRODUCT_BLOCKS],
    hide: [...UNHIDEABLE_PRODUCT_BLOCKS],
    move: ['productHero'],
    duplicate: [...PRODUCT_BOUND_BLOCKS],
  }
}

export type Plan = { ok: true } | { ok: false; reason: 'invalid' | 'heroFirst' | 'locked' }

/** `moveFieldRow` semantics: remove `from`, insert at `to`. */
export function planMove(collection: CanvasCollection, rows: readonly CanvasRow[], from: number, to: number): Plan {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= rows.length || to < 0 || to >= rows.length || from === to) {
    return { ok: false, reason: 'invalid' }
  }
  if (collection === 'products') {
    if (rows[from]!.blockType === 'productHero') return { ok: false, reason: 'heroFirst' }
    if (to === 0 && rows.some((r) => r.blockType === 'productHero')) return { ok: false, reason: 'heroFirst' }
  }
  return { ok: true }
}

/** Target index for "move `from` before/after `target`" in `moveFieldRow` terms. */
export function moveIndex(from: number, target: number, place: 'before' | 'after'): number {
  if (place === 'before') return from < target ? target - 1 : target
  return from < target ? target : target + 1
}

/**
 * Resolve a canvas block id against the CURRENT form rows: stored ids by identity; virtual compatibility ids
 * (`virtual:<type>`) by their singleton bound type once the sections exist in the form. -1 = not found.
 */
export function rowIndexOf(rows: readonly CanvasRow[], id: string): number {
  if (id.startsWith(VIRTUAL_ID_PREFIX)) {
    const type = id.slice(VIRTUAL_ID_PREFIX.length)
    return isProductBound(type) ? rows.findIndex((r) => r.blockType === type) : -1
  }
  return rows.findIndex((r) => r.id === id)
}

export const isVirtualId = (id: string | null | undefined): boolean => typeof id === 'string' && id.startsWith(VIRTUAL_ID_PREFIX)
export const virtualType = (id: string): string | null => (isVirtualId(id) ? id.slice(VIRTUAL_ID_PREFIX.length) : null)

/** Compatibility mode = no bound section stored yet (the page renders the virtual pre-V2 sections). */
export const needsMaterialize = (collection: CanvasCollection, rows: readonly CanvasRow[]): boolean =>
  collection === 'products' && !rows.some((r) => isProductBound(r.blockType))

/**
 * Extra rows the compatibility renderer hides (pre-V2 duplicate filter). When the sections are materialised they
 * are marked hidden, so the page keeps its look (the canvas still shows them faded, the editor can unhide them).
 */
export function compatFilteredRows(rows: readonly CanvasRow[], content: { features: boolean; specs: boolean }): number[] {
  return rows.flatMap((r, i) =>
    r.blockType === 'hero' || (r.blockType === 'featureGrid' && content.features) || (r.blockType === 'specTable' && content.specs) ? [i] : [])
}

/** Block types offered in the palette for this document. */
export function paletteTypes(collection: CanvasCollection, all: readonly string[], rows: readonly CanvasRow[], opts: { systemPage: boolean }): string[] {
  const present = new Set(rows.map((r) => r.blockType))
  return all.filter((t) => {
    if (t === 'listing') return collection === 'pages' && opts.systemPage && !present.has('listing')
    if (isProductBound(t)) return collection === 'products' && !present.has(t)
    return true
  })
}
