import { z } from 'zod'

import { isValidTckn, isValidVkn } from './identity'
import { CURRENCIES } from './types'

/*
 * Checkout form validation (pure, shared by the Server Action and tests). Everything a buyer types is validated here;
 * the amount, currency list, provider and VAT are NEVER read from the form (the server recomputes them). The only
 * money-related input is the chosen currency code, which the server checks against the offer.
 */

const text = (min: number, max: number) => z.string().trim().min(min).max(max)
const optional = (max: number) => z.string().trim().max(max).optional().default('')

export const CHECKOUT_TEXT_FIELDS = [
  'sku', 'currency', 'locale', 'nonce', 'legal', 'type', 'name', 'company', 'identityNumber', 'taxNumber', 'taxOffice',
  'phone', 'addressLine', 'district', 'city', 'postalCode', 'country',
] as const

export const CHECKOUT_CONSENT_FIELDS = ['consentPre', 'consentSales', 'consentWaiver'] as const

const base = z.object({
  sku: z.string().regex(/^[A-Z0-9][A-Z0-9-]{1,63}$/),
  currency: z.enum(CURRENCIES),
  locale: z.enum(['tr', 'en']),
  /** One-time form token (idempotency): same token = same order. */
  nonce: z.string().regex(/^[A-Za-z0-9_-]{22,64}$/),
  /** Digest of the legal texts the buyer was shown. */
  legal: z.string().regex(/^[0-9a-f]{64}$/),
  type: z.enum(['individual', 'corporate']),
  name: text(2, 100).refine((v) => /\S\s+\S/.test(v)),
  company: optional(160),
  identityNumber: z.string().trim().max(20).optional().default(''),
  taxNumber: z.string().trim().max(20).optional().default(''),
  taxOffice: optional(100),
  phone: z.string().trim().regex(/^\+?[\d\s()\-.]{7,40}$/),
  addressLine: text(5, 300),
  district: optional(80),
  city: text(2, 80),
  postalCode: z.string().trim().max(16).regex(/^[\w \-]*$/).optional().default(''),
  country: z.string().trim().regex(/^[A-Za-z]{2}$/).transform((v) => v.toUpperCase()).optional().default('TR'),
  consentPre: z.literal('on'),
  consentSales: z.literal('on'),
  consentWaiver: z.literal('on').optional(),
})

export const checkoutSchema = base

export type CheckoutForm = z.infer<typeof checkoutSchema>

/** Reads the allow-listed fields of a FormData. Repeated keys are rejected (null → fails validation). */
export function checkoutFormInput(data: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of [...CHECKOUT_TEXT_FIELDS, ...CHECKOUT_CONSENT_FIELDS]) {
    const all = data.getAll(key)
    out[key] = all.length > 1 ? null : typeof all[0] === 'string' ? all[0] : undefined
  }
  return out
}

const trimmed = (raw: Record<string, unknown>, key: string) => (typeof raw[key] === 'string' ? (raw[key] as string).trim() : '')

/**
 * Buyer-type rules, evaluated on the raw input so that ALL problems are reported together (a zod refinement would be
 * skipped as soon as any other field failed). Individual: valid TCKN + the waiver (S4). Corporate: company, VKN, tax office.
 */
function buyerTypeErrors(raw: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {}
  if (raw.type === 'individual') {
    if (!isValidTckn(trimmed(raw, 'identityNumber'))) errors.identityNumber = 'invalid'
    // S4: the immediate-performance / withdrawal waiver is mandatory for individual (consumer) buyers.
    if (raw.consentWaiver !== 'on') errors.consentWaiver = 'invalid'
  } else if (raw.type === 'corporate') {
    if (trimmed(raw, 'company').length < 2) errors.company = 'invalid'
    if (!isValidVkn(trimmed(raw, 'taxNumber'))) errors.taxNumber = 'invalid'
    if (trimmed(raw, 'taxOffice').length < 2) errors.taxOffice = 'invalid'
  }
  return errors
}

export function parseCheckoutForm(raw: Record<string, unknown>): { ok: true; data: CheckoutForm } | { ok: false; errors: Record<string, string> } {
  const parsed = checkoutSchema.safeParse(raw)
  const errors = {
    ...(parsed.success ? {} : Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0] ?? 'form'), 'invalid']))),
    ...buyerTypeErrors(raw),
  }
  return parsed.success && Object.keys(errors).length === 0 ? { ok: true, data: parsed.data } : { ok: false, errors }
}

/** Phone for the provider's `gsmNumber`: digits with a leading `+`; a Turkish national number becomes `+90…`. */
export function providerPhone(phone: string, country: string): string {
  const digits = phone.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return `+${digits.slice(1).replace(/\+/g, '')}`
  if (country === 'TR') {
    const national = digits.replace(/^0+/, '').replace(/^90(?=\d{10}$)/, '')
    return `+90${national}`
  }
  return `+${digits.replace(/^0+/, '')}`
}

/** `name` → `name` + `surname` (last word) for providers that require both. */
export function splitName(full: string): { name: string; surname: string } {
  const words = full.trim().split(/\s+/)
  const surname = words.length > 1 ? words[words.length - 1]! : words[0]!
  return { name: words.length > 1 ? words.slice(0, -1).join(' ') : words[0]!, surname }
}
