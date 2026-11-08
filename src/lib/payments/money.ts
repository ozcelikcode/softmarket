import type { Currency } from './types'

/**
 * Integer minor-unit arithmetic (kuruş/cent). No floating point is ever used for amounts:
 * decimal strings are parsed digit-wise, and results are checked with Number.isSafeInteger.
 */

export const CURRENCY_EXPONENT: Record<Currency, number> = { TRY: 2, USD: 2, EUR: 2 }

/** Upper bound per amount (≈ 10 million in major units) — far above any licence price, catches unit mistakes. */
export const MAX_AMOUNT_MINOR = 1_000_000_000

export function isValidMinor(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= MAX_AMOUNT_MINOR
}

const DECIMAL_RE = /^(\d{1,12})(?:[.,](\d+))?$/

/**
 * Parses "1250", "1250.5", "1250,50" or a JSON number into minor units. Returns null when invalid,
 * negative, has more fraction digits than the currency allows (after trimming trailing zeros), or overflows.
 */
export function decimalToMinor(input: string | number, currency: Currency): number | null {
  let text: string
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) return null
    text = String(input)
    if (/e/i.test(text)) return null
  } else {
    text = input.trim()
  }
  const match = DECIMAL_RE.exec(text)
  if (!match) return null
  const exponent = CURRENCY_EXPONENT[currency]
  const fraction = (match[2] ?? '').replace(/0+$/, '')
  if (fraction.length > exponent) return null
  const minor = Number(match[1]) * 10 ** exponent + Number(fraction.padEnd(exponent, '0') || '0')
  return isValidMinor(minor) ? minor : null
}

/** 1250 (TRY) → "12.50". Always a fixed number of fraction digits; dot separator (API format). */
export function minorToDecimal(minor: number, currency: Currency): string {
  if (!isValidMinor(minor)) throw new RangeError('invalid minor amount')
  const exponent = CURRENCY_EXPONENT[currency]
  const base = 10 ** exponent
  const major = Math.floor(minor / base)
  const rest = String(minor % base).padStart(exponent, '0')
  return exponent === 0 ? String(major) : `${major}.${rest}`
}

/** a * b / c with half-up rounding (non-negative operands), computed in BigInt so products never lose precision. */
export function mulDivRoundHalfUp(a: number, b: number, c: number): number {
  if (![a, b, c].every((v) => Number.isSafeInteger(v) && v >= 0) || c === 0) throw new RangeError('invalid operands')
  const n = BigInt(a) * BigInt(b)
  const d = BigInt(c)
  const result = (n * 2n + d) / (d * 2n)
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('overflow')
  return Number(result)
}
