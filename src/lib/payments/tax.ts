import { isValidMinor, MAX_AMOUNT_MINOR, mulDivRoundHalfUp } from './money'
import { CURRENCIES, type Currency } from './types'

/**
 * VAT (KDV) per currency — user decision S1: the accountant decides; admin sets a rate or
 * "exempt" PER CURRENCY. Default is EMPTY, and an empty rule means "no calculation, no sale"
 * (fail-closed): payments cannot open for that currency until VAT is configured.
 *
 * Rates are integer basis points (20% = 2000) so no floating point is involved.
 */

export type VatRule = { kind: 'rate'; rateBasisPoints: number } | { kind: 'exempt' }
export type TaxMode = 'inclusive' | 'exclusive'

export type AmountBreakdown = {
  currency: Currency
  netMinor: number
  vatMinor: number
  totalMinor: number
  /** 0 when exempt. */
  vatRateBasisPoints: number
  exempt: boolean
}

const MAX_RATE_BP = 10_000

/**
 * Reads a VAT rule from untyped settings (schema does not exist yet, P2-S).
 * Expected shape: `{ TRY: { kind: 'rate', rateBasisPoints: 2000 }, USD: { kind: 'exempt' } }`.
 * Anything missing or malformed → null (= not configured).
 */
export function readVatRule(settings: unknown, currency: Currency): VatRule | null {
  if (!settings || typeof settings !== 'object') return null
  const raw = (settings as Record<string, unknown>)[currency]
  if (!raw || typeof raw !== 'object') return null
  const rule = raw as Record<string, unknown>
  if (rule.kind === 'exempt') return { kind: 'exempt' }
  if (rule.kind === 'rate') {
    const bp = rule.rateBasisPoints
    if (typeof bp === 'number' && Number.isSafeInteger(bp) && bp >= 0 && bp <= MAX_RATE_BP) {
      return { kind: 'rate', rateBasisPoints: bp }
    }
  }
  return null
}

/** Currencies with a valid VAT rule — only these can be sold. */
export function vatReadyCurrencies(settings: unknown): Currency[] {
  return CURRENCIES.filter((c) => readVatRule(settings, c) !== null)
}

/**
 * Computes net/VAT/total from the admin price.
 * - inclusive: price is the gross total; net = round(total / (1 + rate)), vat = total − net.
 * - exclusive: price is net; vat = round(net × rate), total = net + vat.
 * - exempt: vat = 0, total = net = price.
 * Returns null (fail-closed) for missing rule, invalid/zero price or overflow.
 */
export function computeAmounts(input: {
  currency: Currency
  priceMinor: unknown
  taxMode: TaxMode
  rule: VatRule | null
}): AmountBreakdown | null {
  const { currency, priceMinor, taxMode, rule } = input
  if (!rule) return null
  if (!isValidMinor(priceMinor) || priceMinor === 0) return null
  if (taxMode !== 'inclusive' && taxMode !== 'exclusive') return null

  if (rule.kind === 'exempt') {
    return { currency, netMinor: priceMinor, vatMinor: 0, totalMinor: priceMinor, vatRateBasisPoints: 0, exempt: true }
  }

  if (rule.kind !== 'rate' || !Number.isSafeInteger(rule.rateBasisPoints) || rule.rateBasisPoints < 0 || rule.rateBasisPoints > MAX_RATE_BP) return null
  const bp = rule.rateBasisPoints
  let netMinor: number
  let vatMinor: number
  let totalMinor: number
  if (taxMode === 'inclusive') {
    totalMinor = priceMinor
    netMinor = mulDivRoundHalfUp(priceMinor, MAX_RATE_BP, MAX_RATE_BP + bp)
    vatMinor = totalMinor - netMinor
  } else {
    netMinor = priceMinor
    vatMinor = mulDivRoundHalfUp(priceMinor, bp, MAX_RATE_BP)
    totalMinor = netMinor + vatMinor
  }
  if (totalMinor > MAX_AMOUNT_MINOR) return null
  return { currency, netMinor, vatMinor, totalMinor, vatRateBasisPoints: bp, exempt: false }
}
