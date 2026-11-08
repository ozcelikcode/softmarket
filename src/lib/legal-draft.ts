import { hasPlaceholder } from '@/lib/utils'

/** Draft banner used by the legal Markdown sources (`> **TASLAK — ...` / `> **DRAFT — ...`). */
const DRAFT_BANNER = /(?:^|[^\p{L}])(?:TASLAK|DRAFT)\s*[—–-]/iu

/**
 * True while a legal page still carries an unreviewed-draft banner or `[UPPERCASE]` placeholders anywhere in its
 * blocks (awaiting legal review). Such pages stay readable but get `noindex, nofollow` and leave the sitemap. No
 * schema field: editors clear it by removing the banner/placeholders from the content.
 */
export function isLegalDraft(layout: unknown): boolean {
  if (layout == null) return false
  let text: string
  try {
    text = JSON.stringify(layout)
  } catch {
    return true
  }
  // Lexical may split a banner or placeholder into adjacent text nodes when formatting changes.
  const parts: string[] = []
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(visit); return }
    if (!value || typeof value !== 'object') return
    const node = value as Record<string, unknown>
    if (node.type === 'text' && typeof node.text === 'string') parts.push(node.text)
    for (const child of Object.values(node)) visit(child)
  }
  visit(layout)
  const joined = parts.join('')
  return DRAFT_BANNER.test(text) || hasPlaceholder(text) || DRAFT_BANNER.test(joined) || hasPlaceholder(joined)
}
