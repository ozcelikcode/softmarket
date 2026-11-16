import { decimalToMinor } from './money'
import type { VatRule } from './tax'
import { CURRENCIES, type Currency } from './types'

/*
 * P2-S schema ↔ core adapters (pure). The admin enters VAT as a PERCENT per currency
 * (site-settings.commerce.vat.<try|usd|eur>.ratePercent); a field hook stores the integer basis points next to
 * it (rateBasisPoints). The core (tax.ts) only ever sees basis points through readVatSettings().
 */

/** site-settings.commerce.vat.<group> per currency. */
export const VAT_GROUPS = { TRY: 'try', USD: 'usd', EUR: 'eur' } as const satisfies Record<Currency, string>
export const VAT_RULE_KINDS = ['rate', 'exempt'] as const

/** "20" → 2000, "18.5" → 1850, 0 → 0. More than two decimals, negative, > 100 or non-numeric → null. */
export function percentToBasisPoints(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !value.trim()) return null
  const bp = decimalToMinor(value, 'TRY')
  return bp !== null && bp <= 10_000 ? bp : null
}

const prop = (obj: unknown, key: string): unknown =>
  obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[key] : undefined

/**
 * Stored site-settings → `{ TRY: VatRule, … }` for tax.ts `readVatRule`. Fail-closed: an empty rule, a
 * missing/invalid rate, or basis points that disagree with the entered percent leave that currency out
 * (no sale in it, user decision S1).
 */
export function readVatSettings(siteSettings: unknown): Partial<Record<Currency, VatRule>> {
  const vat = prop(prop(siteSettings, 'commerce'), 'vat')
  const out: Partial<Record<Currency, VatRule>> = {}
  for (const currency of CURRENCIES) {
    const group = prop(vat, VAT_GROUPS[currency])
    const rule = prop(group, 'rule')
    if (rule === 'exempt') out[currency] = { kind: 'exempt' }
    else if (rule === 'rate') {
      const bp = prop(group, 'rateBasisPoints')
      const fromPercent = percentToBasisPoints(prop(group, 'ratePercent'))
      if (typeof bp === 'number' && fromPercent !== null && bp === fromPercent) out[currency] = { kind: 'rate', rateBasisPoints: bp }
    }
  }
  return out
}
