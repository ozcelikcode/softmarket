import type { Payload } from 'payload'

import { hasLegalBody, isLegalDraft } from '@/lib/legal-draft'
import { isCommerceLegalKind, type LegalFact } from '@/lib/payments/legal'

/**
 * Reads the published pages marked with `pages.commerceLegal` (both locales) and derives their draft state
 * (`isLegalDraft`: draft banner or [PLACEHOLDER]). Server only, `overrideAccess` with a minimal projection;
 * throws on a read failure so callers stay fail-closed.
 */
export async function readLegalFacts(payload: Payload): Promise<LegalFact[]> {
  const facts: LegalFact[] = []
  for (const locale of ['tr', 'en'] as const) {
    const result = await payload.find({
      collection: 'pages', locale, fallbackLocale: false, depth: 0, limit: 20, pagination: false, overrideAccess: true, draft: false,
      where: { and: [{ pageType: { equals: 'legal' } }, { commerceLegal: { exists: true } }, { _status: { equals: 'published' } }] },
      select: { commerceLegal: true, layout: true, title: true, slug: true },
    })
    for (const doc of result.docs as { commerceLegal?: unknown; layout?: unknown; title?: string; slug?: string }[]) {
      if (!isCommerceLegalKind(doc.commerceLegal)) continue
      facts.push({ kind: doc.commerceLegal, locale, published: true,
        draft: !doc.title?.trim() || !doc.slug?.trim() || !hasLegalBody(doc.layout) || isLegalDraft(doc.layout) })
    }
  }
  return facts
}
