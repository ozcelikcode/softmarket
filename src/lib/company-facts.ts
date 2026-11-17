import type { Payload } from 'payload'

/*
 * Company facts (site-settings › Company & contact) and the legal-text placeholders they fill (pure helpers + one
 * server loader). Legal Markdown sources carry `[ŞİRKET UNVANI]`-style tokens; at RENDER time (legal page, sitemap,
 * readiness/legalReady, checkout contract copy) each token whose value is set is replaced inside Lexical text nodes.
 * The stored page is never changed. An empty value leaves its token in place, so the page still counts as a draft
 * (`isLegalDraft`) and payments cannot open (fail-closed). Tokens split across text nodes are not filled (draft).
 */

export type CompanyFacts = {
  legalName?: string
  mersisNo?: string
  address?: string
  taxOffice?: string
  taxNumber?: string
  kepAddress?: string
  etbisNo?: string
  phone?: string
  email?: string
}

export const COMPANY_FACT_LABELS: Record<keyof CompanyFacts, { tr: string; en: string }> = {
  legalName: { tr: 'Ticari unvan', en: 'Legal name' },
  mersisNo: { tr: 'MERSİS no', en: 'MERSIS no' },
  address: { tr: 'Adres', en: 'Address' },
  taxOffice: { tr: 'Vergi dairesi', en: 'Tax office' },
  taxNumber: { tr: 'Vergi numarası (VKN)', en: 'Tax number (VKN)' },
  kepAddress: { tr: 'KEP adresi', en: 'KEP address' },
  etbisNo: { tr: 'ETBİS kayıt no', en: 'ETBIS registration no' },
  phone: { tr: 'Telefon', en: 'Phone' },
  email: { tr: 'Genel e-posta', en: 'General e-mail' },
}

/** Required for selling online (seller identity in the distance sales texts and the contract copy). */
export const REQUIRED_COMPANY_FACTS = Object.keys(COMPANY_FACT_LABELS) as (keyof CompanyFacts)[]

const PLACEHOLDERS: ReadonlyArray<readonly [string, (f: CompanyFacts) => string | undefined]> = [
  ['[ŞİRKET UNVANI]', (f) => f.legalName],
  ['[MERSİS]', (f) => f.mersisNo],
  ['[ADRES]', (f) => f.address],
  ['[VERGİ DAİRESİ/NO]', (f) => (f.taxOffice && f.taxNumber ? `${f.taxOffice} / ${f.taxNumber}` : undefined)],
  ['[KEP]', (f) => f.kepAddress],
  ['[ETBİS NO]', (f) => f.etbisNo],
  ['[TELEFON]', (f) => f.phone],
  ['[KVKK İLETİŞİM E-POSTASI]', (f) => f.email],
]
export const COMPANY_PLACEHOLDER_TOKENS = PLACEHOLDERS.map(([token]) => token)

const clean = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim().replace(/\s*\n\s*/g, ', ') : undefined)
const prop = (obj: unknown, key: string): unknown => (obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[key] : undefined)

/** site-settings (company + contact groups, one locale) → facts. */
export function companyFactsFrom(settings: unknown): CompanyFacts {
  const company = prop(settings, 'company')
  const contact = prop(settings, 'contact')
  const facts: CompanyFacts = {
    legalName: clean(prop(company, 'legalName')),
    mersisNo: clean(prop(company, 'mersisNo')),
    address: clean(prop(contact, 'address')),
    taxOffice: clean(prop(company, 'taxOffice')),
    taxNumber: clean(prop(company, 'taxNumber')),
    kepAddress: clean(prop(company, 'kepAddress')),
    etbisNo: clean(prop(company, 'etbisNo')),
    phone: clean(prop(contact, 'phone')),
    email: clean(prop(contact, 'email')),
  }
  // A value that is itself a placeholder (`CHANGE_…`, `[…]`) counts as missing.
  for (const key of Object.keys(facts) as (keyof CompanyFacts)[]) {
    const value = facts[key]
    if (value && (value.startsWith('CHANGE_') || /[[\]]/.test(value))) delete facts[key]
  }
  return facts
}

export const missingCompanyFacts = (facts: CompanyFacts): (keyof CompanyFacts)[] => REQUIRED_COMPANY_FACTS.filter((key) => !facts[key])

export function fillPlaceholderText(text: string, facts: CompanyFacts): string {
  let out = text
  for (const [token, value] of PLACEHOLDERS) {
    const v = value(facts)
    if (v && out.includes(token)) out = out.split(token).join(v)
  }
  return out
}

/** Copy of a page layout with company tokens replaced in Lexical text nodes only (structure, ids, keys unchanged). */
export function fillLegalPlaceholders<T>(layout: T, facts: CompanyFacts): T {
  if (!Object.values(facts).some(Boolean)) return layout
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit)
    if (!value || typeof value !== 'object') return value
    const node = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(node)) out[key] = visit(child)
    if (node.type === 'text' && typeof node.text === 'string') out.text = fillPlaceholderText(node.text, facts)
    return out
  }
  return visit(layout) as T
}

/** Server read (overrideAccess, minimal projection). Read errors → empty facts (tokens stay: fail-closed). */
export async function readCompanyFacts(payload: Payload, locale: 'tr' | 'en'): Promise<CompanyFacts> {
  try {
    const settings = await payload.findGlobal({ slug: 'site-settings', locale, depth: 0, overrideAccess: true, select: { company: true, contact: true } })
    return companyFactsFrom(settings)
  } catch {
    return {}
  }
}
