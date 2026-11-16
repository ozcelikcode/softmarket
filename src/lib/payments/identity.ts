/*
 * Buyer identity checks for orders.billing (S4: individual = TCKN, corporate = VKN + company + tax office).
 * Pure; used by the Orders schema validation and later by the checkout form (P5).
 */

/** T.C. kimlik no: 11 digits, first not 0, digit 10 and 11 checksums. */
export function isValidTckn(value: unknown): boolean {
  if (typeof value !== 'string' || !/^[1-9]\d{10}$/.test(value)) return false
  const d = [...value].map(Number)
  const odd = d[0] + d[2] + d[4] + d[6] + d[8]
  const even = d[1] + d[3] + d[5] + d[7]
  if ((((odd * 7 - even) % 10) + 10) % 10 !== d[9]) return false
  return d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10]
}

/**
 * Vergi kimlik no: 10 digits. Only the format is enforced: the GİB check-digit rule is not applied until it is
 * verified against official samples (a wrong checksum would block real corporate buyers).
 */
export function isValidVkn(value: unknown): boolean {
  return typeof value === 'string' && /^\d{10}$/.test(value)
}

export const BUYER_TYPES = ['individual', 'corporate'] as const
export type BuyerType = (typeof BUYER_TYPES)[number]
