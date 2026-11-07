import { describe, expect, it } from 'vitest'

import {
  LICENSE_KEY_ALPHABET,
  generateLicenseKey,
  isValidLicenseKeyFormat,
  normalizeLicenseKey,
} from '../../src/lib/licenses/generate'
import { addMonths, isLicenseValid } from '../../src/lib/licenses/validity'

describe('generateLicenseKey', () => {
  it('produces XXXXX-XXXXX-XXXXX-XXXXX-XXXXX from the unambiguous alphabet', () => {
    const key = generateLicenseKey()
    expect(key).toMatch(/^[A-Z0-9]{5}(-[A-Z0-9]{5}){4}$/)
    for (const ch of key.replace(/-/g, '')) expect(LICENSE_KEY_ALPHABET).toContain(ch)
    expect(isValidLicenseKeyFormat(key)).toBe(true)
  })

  it('never uses confusable characters', () => {
    for (const ch of ['0', 'O', '1', 'I', 'L', 'U']) expect(LICENSE_KEY_ALPHABET).not.toContain(ch)
    const many = Array.from({ length: 500 }, () => generateLicenseKey()).join('')
    expect(many).not.toMatch(/[01OILU]/)
  })

  it('is unique across many generations', () => {
    const keys = new Set(Array.from({ length: 10_000 }, () => generateLicenseKey()))
    expect(keys.size).toBe(10_000)
  })

  it('supports custom group layout', () => {
    expect(generateLicenseKey({ groups: 3, groupLength: 4, separator: '.' })).toMatch(
      /^[A-Z0-9]{4}\.[A-Z0-9]{4}\.[A-Z0-9]{4}$/,
    )
  })

  it('rejects biased bytes (rejection sampling)', () => {
    // 240..255 must be skipped; 0 maps to 'A', 29 maps to '9'.
    let call = 0
    const source = (size: number) => {
      call++
      const bytes = new Uint8Array(size)
      bytes.fill(call === 1 ? 255 : 0)
      bytes[0] = call === 1 ? 240 : 29
      return bytes
    }
    const key = generateLicenseKey({ groups: 1, groupLength: 3, randomBytes: source })
    expect(call).toBe(2)
    expect(key).toBe('9AA')
  })

  it('validates options', () => {
    expect(() => generateLicenseKey({ groups: 0 })).toThrow(RangeError)
    expect(() => generateLicenseKey({ groupLength: 1.5 })).toThrow(RangeError)
  })
})

describe('normalizeLicenseKey / isValidLicenseKeyFormat', () => {
  it('normalises case and whitespace', () => {
    const key = generateLicenseKey()
    expect(normalizeLicenseKey(` ${key.toLowerCase()} `)).toBe(key)
    expect(isValidLicenseKeyFormat(key.toLowerCase())).toBe(true)
  })

  it('rejects malformed keys', () => {
    expect(isValidLicenseKeyFormat('ABCDE-ABCDE')).toBe(false)
    expect(isValidLicenseKeyFormat('ABCD0-ABCDE-ABCDE-ABCDE-ABCDE')).toBe(false)
    expect(isValidLicenseKeyFormat('')).toBe(false)
  })
})

describe('license validity', () => {
  const now = new Date('2026-06-15T00:00:00Z')

  it('accepts active perpetual and unexpired subscription licenses', () => {
    expect(isLicenseValid({ status: 'active', startsAt: '2026-01-01T00:00:00Z' }, now)).toBe(true)
    expect(
      isLicenseValid({ status: 'active', startsAt: '2026-01-01', expiresAt: '2027-01-01' }, now),
    ).toBe(true)
  })

  it('rejects expired, future, and non-active licenses', () => {
    expect(isLicenseValid({ status: 'active', startsAt: '2026-01-01', expiresAt: '2026-06-15T00:00:00Z' }, now)).toBe(false)
    expect(isLicenseValid({ status: 'active', startsAt: '2026-07-01' }, now)).toBe(false)
    expect(isLicenseValid({ status: 'revoked' }, now)).toBe(false)
  })

  it('fails closed for missing or invalid dates', () => {
    expect(isLicenseValid({ status: 'active' }, now)).toBe(false)
    expect(isLicenseValid({ status: 'active', startsAt: 'bad' }, now)).toBe(false)
    expect(isLicenseValid({ status: 'active', startsAt: '2026-01-01', expiresAt: 'bad' }, now)).toBe(false)
  })

  it('adds calendar months with month-end clamping', () => {
    expect(addMonths(new Date('2026-01-31T10:00:00Z'), 1).toISOString()).toBe('2026-02-28T10:00:00.000Z')
    expect(addMonths(new Date('2026-03-15T00:00:00Z'), 12).toISOString()).toBe('2027-03-15T00:00:00.000Z')
  })
})
