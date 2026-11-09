/*
 * V5 visual editor: the ONLY plain-text fields that can be edited in place on the canvas. Pure module (no React,
 * no Payload runtime): shared by the server markers (`data-field-path` / `data-doc-field`, editing renders only),
 * the site bridge and the admin host, which re-validates every message against these lists before it touches
 * the Payload form. Rich text, media, relations, links/URLs and non-localized values stay in the form panel.
 *
 * Paths are relative to the block (`items.2.title`) or to the document (`hero.title`); `*` is an array row index.
 * tests/unit/visual-editor-fields.test.tsx checks every pattern against the block/collection config (localized
 * text/textarea field) and every renderer against this list (round-trip fixtures).
 */

/** Block-relative inline fields per block type (localized `text`/`textarea` only). */
export const INLINE_BLOCK_FIELDS: Readonly<Record<string, readonly string[]>> = {
  hero: ['eyebrow', 'heading', 'subheading', 'panelTitle', 'actions.*.link.label'],
  featureGrid: ['heading', 'intro', 'items.*.title', 'items.*.description'],
  mediaText: ['heading', 'actions.*.link.label'],
  specTable: ['heading', 'groups.*.title', 'groups.*.rows.*.label', 'groups.*.rows.*.value'],
  stats: ['heading', 'items.*.label', 'items.*.description'],
  logoWall: ['heading'],
  cta: ['heading', 'body', 'actions.*.link.label'],
  faq: ['heading', 'items.*.question'],
  videoEmbed: ['heading', 'caption'],
  media: ['heading', 'items.*.caption'],
  testimonial: ['quote'],
  tabs: ['heading'],
  productFamilies: ['eyebrow', 'heading', 'description', 'viewAllLabel'],
  productShowcase: ['eyebrow', 'heading', 'description', 'viewAllLabel'],
  solutionsGrid: ['eyebrow', 'heading', 'description', 'viewAllLabel'],
  newsList: ['eyebrow', 'heading', 'description', 'viewAllLabel'],
  caseStudy: ['eyebrow', 'linkLabel'],
}

/** Document-level inline fields per collection (rendered by bound product sections / the system page hero). */
export const INLINE_DOC_FIELDS: Readonly<Record<string, readonly string[]>> = {
  products: ['title', 'tagline', 'summary', 'features.*.title', 'features.*.description'],
  pages: ['hero.eyebrow', 'hero.title', 'hero.lead'],
}

/** Longest inline value (longer text is edited in the form). */
export const INLINE_MAX = 1000

const SEGMENT = /^[a-z][A-Za-z]{0,39}$/
const INDEX = /^(?:0|[1-9]\d{0,2})$/
/** Names that must never be used as a path segment (prototype pollution through form/state lookups). */
const FORBIDDEN = new Set(['constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty'])

/** Shape check only: `name(.index.name){0,3}` with safe segments. Rejects `__proto__`, `a..b`, `0.x`, `a.b` … */
export const FIELD_PATH_RE = /^[a-z][A-Za-z]{0,39}(?:\.(?:0|[1-9]\d{0,2})\.[a-z][A-Za-z]{0,39}|\.[a-z][A-Za-z]{0,39}){0,4}$/

export function isSafeFieldPath(path: unknown): path is string {
  if (typeof path !== 'string' || path.length > 120 || !FIELD_PATH_RE.test(path)) return false
  return path.split('.').every((s) => (INDEX.test(s) || SEGMENT.test(s)) && !FORBIDDEN.has(s))
}

/** Does `path` match the pattern (`*` = one row index)? */
export function matchesPattern(pattern: string, path: string): boolean {
  const p = pattern.split('.')
  const s = path.split('.')
  return p.length === s.length && p.every((seg, i) => (seg === '*' ? INDEX.test(s[i]!) : seg === s[i]))
}

export const isInlineBlockField = (blockType: string, path: string): boolean =>
  isSafeFieldPath(path) && Object.hasOwn(INLINE_BLOCK_FIELDS, blockType) && INLINE_BLOCK_FIELDS[blockType]!.some((p) => matchesPattern(p, path))

export const isInlineDocField = (collection: string, path: string): boolean =>
  isSafeFieldPath(path) && Object.hasOwn(INLINE_DOC_FIELDS, collection) && INLINE_DOC_FIELDS[collection]!.some((p) => matchesPattern(p, path))

/** Canvas text -> stored value: one line, collapsed whitespace, no control characters. */
export const normalizeInline = (text: string): string => text.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
