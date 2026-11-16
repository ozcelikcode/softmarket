import { hasPlaceholder } from '@/lib/utils'

/** Draft banner used by the legal Markdown sources (`> **TASLAK — ...` / `> **DRAFT — ...`). */
const DRAFT_BANNER = /(?:^|[^\p{L}])(?:TASLAK|DRAFT)\s*[—–-]/iu
// Legal templates also use slash-separated labels and review notes with mixed-case explanations.
const LEGAL_PLACEHOLDER = /\[\p{Lu}[\p{Lu}\d _/—–-]*(?:[:—–][^\[\]\r\n]*)?\]/u

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
  return DRAFT_BANNER.test(text) || hasPlaceholder(text) || LEGAL_PLACEHOLDER.test(text)
    || DRAFT_BANNER.test(joined) || hasPlaceholder(joined) || LEGAL_PLACEHOLDER.test(joined)
}

/** Only visible rich text can supply a legal body; an empty block or hidden contract is not a reviewed text. */
export function hasLegalBody(layout: unknown): boolean {
  const hasText = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(hasText)
    if (!value || typeof value !== 'object') return false
    const node = value as Record<string, unknown>
    return (node.type === 'text' && typeof node.text === 'string' && Boolean(node.text.trim()))
      || Object.values(node).some(hasText)
  }
  return Array.isArray(layout) && layout.some((block) => block?.blockType === 'richText'
    && !block.appearance?.hidden && hasText(block.content))
}
