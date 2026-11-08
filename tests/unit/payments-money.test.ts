import { describe, expect, it } from 'vitest'

import { decimalToMinor, isValidMinor, MAX_AMOUNT_MINOR, minorToDecimal, mulDivRoundHalfUp } from '../../src/lib/payments/money'
import { computeAmounts, readVatRule, vatReadyCurrencies } from '../../src/lib/payments/tax'

describe('minor units', () => {
  it('parses decimals without floating point', () => {
    expect(decimalToMinor('1250', 'TRY')).toBe(125_000)
    expect(decimalToMinor('1250,5', 'TRY')).toBe(125_050)
    expect(decimalToMinor('1250.50', 'TRY')).toBe(125_050)
    expect(decimalToMinor('0.01', 'USD')).toBe(1)
    expect(decimalToMinor('10.500', 'EUR')).toBe(1050)
    expect(decimalToMinor(10.5, 'TRY')).toBe(1050)
    expect(decimalToMinor(0.1 + 0.2, 'TRY')).toBeNull() // 0.30000000000000004 → too many digits
  })

  it('rejects invalid input', () => {
    for (const bad of ['', '-1', '1.001', '1e3', 'abc', '1.2.3', ' ', '12,345.00']) expect(decimalToMinor(bad, 'TRY')).toBeNull()
    expect(decimalToMinor(-1, 'TRY')).toBeNull()
    expect(decimalToMinor(Number.NaN, 'TRY')).toBeNull()
    expect(decimalToMinor(1e21, 'TRY')).toBeNull()
    expect(decimalToMinor('99999999999', 'TRY')).toBeNull() // > MAX_AMOUNT_MINOR
  })

  it('formats minor units with fixed fraction digits', () => {
    expect(minorToDecimal(125_050, 'TRY')).toBe('1250.50')
    expect(minorToDecimal(1, 'USD')).toBe('0.01')
    expect(minorToDecimal(0, 'EUR')).toBe('0.00')
    expect(() => minorToDecimal(1.5, 'TRY')).toThrow()
    expect(() => minorToDecimal(-1, 'TRY')).toThrow()
  })

  it('validates minor amounts', () => {
    expect(isValidMinor(0)).toBe(true)
    expect(isValidMinor(MAX_AMOUNT_MINOR)).toBe(true)
    expect(isValidMinor(MAX_AMOUNT_MINOR + 1)).toBe(false)
    expect(isValidMinor(1.5)).toBe(false)
    expect(isValidMinor('100')).toBe(false)
  })

  it('rounds half up in BigInt', () => {
    expect(mulDivRoundHalfUp(5, 1, 2)).toBe(3)
    expect(mulDivRoundHalfUp(4, 1, 3)).toBe(1)
    expect(mulDivRoundHalfUp(Number.MAX_SAFE_INTEGER, 1, 1)).toBe(Number.MAX_SAFE_INTEGER)
    expect(() => mulDivRoundHalfUp(1, 1, 0)).toThrow()
  })
})

describe('VAT (S1: per currency, empty = no sale)', () => {
  const twenty = { kind: 'rate' as const, rateBasisPoints: 2000 }

  it('inclusive: net = round(total / 1.2), vat = total − net', () => {
    expect(computeAmounts({ currency: 'TRY', priceMinor: 120_00, taxMode: 'inclusive', rule: twenty })).toEqual({
      currency: 'TRY', netMinor: 100_00, vatMinor: 20_00, totalMinor: 120_00, vatRateBasisPoints: 2000, exempt: false,
    })
    // 99.99 / 1.2 = 83.325 → 83.33 (half up); vat 16.66; sum is exact.
    const r = computeAmounts({ currency: 'TRY', priceMinor: 9999, taxMode: 'inclusive', rule: twenty })!
    expect([r.netMinor, r.vatMinor, r.totalMinor]).toEqual([8333, 1666, 9999])
  })

  it('exclusive: vat = round(net × rate), total = net + vat', () => {
    const r = computeAmounts({ currency: 'USD', priceMinor: 8333, taxMode: 'exclusive', rule: twenty })!
    expect([r.netMinor, r.vatMinor, r.totalMinor]).toEqual([8333, 1667, 10000])
    const one = computeAmounts({ currency: 'TRY', priceMinor: 1, taxMode: 'exclusive', rule: { kind: 'rate', rateBasisPoints: 100 } })!
    expect([one.netMinor, one.vatMinor, one.totalMinor]).toEqual([1, 0, 1])
  })

  it('exempt: no VAT', () => {
    expect(computeAmounts({ currency: 'EUR', priceMinor: 5000, taxMode: 'exclusive', rule: { kind: 'exempt' } })).toMatchObject({
      netMinor: 5000, vatMinor: 0, totalMinor: 5000, exempt: true,
    })
  })

  it('fails closed: missing rule, zero/invalid price, bad tax mode, overflow', () => {
    expect(computeAmounts({ currency: 'TRY', priceMinor: 100, taxMode: 'inclusive', rule: null })).toBeNull()
    expect(computeAmounts({ currency: 'TRY', priceMinor: 0, taxMode: 'inclusive', rule: twenty })).toBeNull()
    expect(computeAmounts({ currency: 'TRY', priceMinor: 10.5, taxMode: 'inclusive', rule: twenty })).toBeNull()
    expect(computeAmounts({ currency: 'TRY', priceMinor: '100', taxMode: 'inclusive', rule: twenty })).toBeNull()
    expect(computeAmounts({ currency: 'TRY', priceMinor: 100, taxMode: 'gross' as never, rule: twenty })).toBeNull()
    expect(computeAmounts({ currency: 'TRY', priceMinor: MAX_AMOUNT_MINOR, taxMode: 'exclusive', rule: twenty })).toBeNull()
  })

  it('reads rules from untyped settings; default empty = nothing ready', () => {
    expect(vatReadyCurrencies(undefined)).toEqual([])
    expect(vatReadyCurrencies({})).toEqual([])
    expect(readVatRule({ TRY: { kind: 'rate', rateBasisPoints: 20 } }, 'TRY')).toEqual({ kind: 'rate', rateBasisPoints: 20 })
    expect(readVatRule({ TRY: { kind: 'rate', rateBasisPoints: 20.5 } }, 'TRY')).toBeNull()
    expect(readVatRule({ TRY: { kind: 'rate', rateBasisPoints: 10_001 } }, 'TRY')).toBeNull()
    expect(readVatRule({ TRY: { kind: 'rate' } }, 'TRY')).toBeNull()
    expect(readVatRule({ TRY: 'exempt' }, 'TRY')).toBeNull()
    expect(vatReadyCurrencies({ TRY: { kind: 'rate', rateBasisPoints: 2000 }, EUR: { kind: 'exempt' } })).toEqual(['TRY', 'EUR'])
  })
})
