import { createHash } from 'node:crypto'

/*
 * Lawyer approval of a legal page (pages.legalReview, localized, admin panel only). Removing the draft banner and
 * placeholders does not prove a legal review (P7 QA), so `legalReady` also requires this approval.
 *
 * The approval is bound to the content it was given for: when an admin sets/changes "approved by" or "approved at",
 * a SHA-256 of the page title + visible rich-text text (STORED text, before company placeholders are filled) is
 * stored next to it. Any later text change (editor, API, MCP, import) leaves the old digest behind and the page
 * counts as NOT approved until an admin records a new approval. Pure helpers; the hook lives in Pages.ts.
 */

type Node = Record<string, unknown>

/** Visible rich text of a layout in document order (text nodes of non-hidden richText blocks). */
export function legalVisibleText(layout: unknown): string {
  if (!Array.isArray(layout)) return ''
  const parts: string[] = []
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(visit)
    if (!value || typeof value !== 'object') return
    const node = value as Node
    if (node.type === 'text' && typeof node.text === 'string') parts.push(node.text)
    if (node.type === 'linebreak') parts.push('\n')
    if (Array.isArray(node.children)) node.children.forEach(visit)
    else if (node.root) visit(node.root)
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'listitem') parts.push('\n')
  }
  for (const block of layout as Node[]) {
    if (block?.blockType !== 'richText' || (block.appearance as { hidden?: unknown } | undefined)?.hidden) continue
    visit(block.content)
    parts.push('\n')
  }
  return parts.join('')
}

export function legalContentDigest(title: unknown, layout: unknown): string {
  return createHash('sha256').update(JSON.stringify([typeof title === 'string' ? title.trim() : '', legalVisibleText(layout)])).digest('hex')
}

export type LegalReview = { approvedBy?: unknown; approvedAt?: unknown; approvedHash?: unknown } | null | undefined

/** Approved = name + date set AND the stored digest matches the current title/text. */
export function isLegalApproved(doc: { title?: unknown; layout?: unknown; legalReview?: LegalReview }): boolean {
  const review = doc.legalReview
  if (!review || typeof review.approvedBy !== 'string' || !review.approvedBy.trim() || !review.approvedAt) return false
  return typeof review.approvedHash === 'string' && review.approvedHash === legalContentDigest(doc.title, doc.layout)
}

const iso = (value: unknown) => {
  if (!value) return null
  const date = new Date(value as string)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * New digest for a save: re-stamped only when the approval itself changed (name or date) or no digest exists yet;
 * otherwise the previous digest is kept (so content edits invalidate the approval). No name/date → no approval.
 */
export function nextApprovalHash(input: {
  review: LegalReview
  previous: LegalReview
  title: unknown
  layout: unknown
}): string | null | undefined {
  const by = typeof input.review?.approvedBy === 'string' ? input.review.approvedBy.trim() : ''
  const at = iso(input.review?.approvedAt)
  const prevStored = typeof input.previous?.approvedHash === 'string' ? input.previous.approvedHash : undefined
  // No approval: clear a stored digest; otherwise leave the column untouched (no-op saves stay no-ops).
  if (!by || !at) return prevStored ? null : undefined
  const prevBy = typeof input.previous?.approvedBy === 'string' ? input.previous.approvedBy.trim() : ''
  const prevHash = typeof input.previous?.approvedHash === 'string' ? input.previous.approvedHash : null
  if (by !== prevBy || at !== iso(input.previous?.approvedAt) || !prevHash) return legalContentDigest(input.title, input.layout)
  return prevHash
}
