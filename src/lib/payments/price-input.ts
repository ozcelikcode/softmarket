import { CURRENCY_EXPONENT, decimalToMinor, isValidMinor, minorToDecimal } from './money'
import type { Currency } from './types'

/*
 * Admin price entry (user decision, P3): editors type a normal decimal amount ("1.250,00" TR, "1,250.00" EN,
 * comma or dot tolerant); storage stays integer minor units. Pure string/integer parsing: no parseFloat, no
 * Number(decimalString) arithmetic, so no floating-point error ever reaches a stored price.
 */

/**
 * Tolerant parse of a typed amount to minor units, or null when ambiguous/invalid.
 *  - spaces and NBSP are ignored; a leading currency symbol/code is not accepted (plain digits only)
 *  - both "." and "," present: the LAST one is the decimal mark, the other is grouping (groups of 3)
 *  - one separator kind repeated: grouping only ("1.250.000"), groups of 3
 *  - a single separator: 1-2 digits after it = decimal mark; exactly 3 digits after = grouping ("1.250" = 1250);
 *    more than 3 digits after = invalid
 */
export function parsePriceInput(input: string, currency: Currency = 'TRY'): number | null {
  const text = input.replace(/[\s  ]/g, '')
  if (!text || !/^[\d.,]+$/.test(text) || !/\d/.test(text)) return null
  const lastDot = text.lastIndexOf('.')
  const lastComma = text.lastIndexOf(',')
  let decimalAt = -1
  if (lastDot >= 0 && lastComma >= 0) decimalAt = Math.max(lastDot, lastComma)
  else {
    const sep = lastDot >= 0 ? '.' : lastComma >= 0 ? ',' : ''
    if (sep) {
      const parts = text.split(sep)
      if (parts.length === 2) {
        const after = parts[1]!.length
        if (after === 0) return null
        if (after <= CURRENCY_EXPONENT[currency]) decimalAt = text.indexOf(sep)
        else if (after !== 3) return null
      }
      // parts.length > 2: repeated single kind = grouping only (validated below)
    }
  }
  const intPart = decimalAt >= 0 ? text.slice(0, decimalAt) : text
  const fracPart = decimalAt >= 0 ? text.slice(decimalAt + 1) : ''
  if (/[.,]/.test(fracPart) || !intPart || fracPart.length > CURRENCY_EXPONENT[currency]) return null
  const groups = intPart.split(/[.,]/)
  if (groups.length > 1) {
    if (!/^\d{1,3}$/.test(groups[0]!) || !groups.slice(1).every((g) => /^\d{3}$/.test(g))) return null
    // grouping marks must all be the same character
    if (new Set(intPart.match(/[.,]/g)).size > 1) return null
  }
  const digits = groups.join('')
  if (decimalAt >= 0 && fracPart === '') return null
  return decimalToMinor(fracPart ? `${digits}.${fracPart}` : digits, currency)
}

/** 125000 → "1.250,00" (tr) / "1,250.00" (en). Integer math only. */
export function formatMinorForInput(minor: number, currency: Currency, locale: string): string {
  if (!isValidMinor(minor)) return ''
  const [major, fraction] = minorToDecimal(minor, currency).split('.')
  const en = locale === 'en'
  const grouped = major!.replace(/\B(?=(\d{3})+(?!\d))/g, en ? ',' : '.')
  return `${grouped}${en ? '.' : ','}${fraction}`
}
