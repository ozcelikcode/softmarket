import type { Payload } from 'payload'

import { fillLegalPlaceholders, missingCompanyFacts, readCompanyFacts } from '@/lib/company-facts'
import { isLegalApproved } from '@/lib/legal-approval'
import { hasLegalBody, isLegalDraft } from '@/lib/legal-draft'
import { isCommerceLegalKind, type LegalFact } from '@/lib/payments/legal'

/**
 * Reads the published pages marked with `pages.commerceLegal` (both locales) and derives their state: `draft`
 * (`isLegalDraft` on the text with company placeholders filled from site-settings: draft banner or a remaining
 * [PLACEHOLDER]) and `approved` (lawyer approval bound to the stored text). Server only, `overrideAccess` with a
 * minimal projection; throws on a page read failure so callers stay fail-closed.
 */
export async function readLegalFacts(payload: Payload): Promise<LegalFact[]> {
  const facts: LegalFact[] = []
  for (const locale of ['tr', 'en'] as const) {
    const result = await payload.find({
      collection: 'pages', locale, fallbackLocale: false, depth: 0, limit: 20, pagination: false, overrideAccess: true, draft: false,
      where: { and: [{ pageType: { equals: 'legal' } }, { commerceLegal: { exists: true } }, { _status: { equals: 'published' } }] },
      select: { commerceLegal: true, layout: true, title: true, slug: true, legalReview: true },
    })
    const company = result.docs.length ? await readCompanyFacts(payload, locale) : {}
    for (const doc of result.docs as { commerceLegal?: unknown; layout?: unknown; title?: string; slug?: string; legalReview?: Record<string, unknown> | null }[]) {
      if (!isCommerceLegalKind(doc.commerceLegal)) continue
      const filled = fillLegalPlaceholders(doc.layout, company)
      facts.push({ kind: doc.commerceLegal, locale, published: true,
        draft: missingCompanyFacts(company).length > 0 || !doc.title?.trim() || !doc.slug?.trim() || !hasLegalBody(filled) || isLegalDraft(filled),
        approved: isLegalApproved(doc) })
    }
  }
  return facts
}
