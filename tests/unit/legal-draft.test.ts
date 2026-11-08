import { describe, expect, it } from 'vitest'

import { isLegalDraft } from '@/lib/legal-draft'

const text = (t: string) => [{ blockType: 'richText', content: { root: { children: [{ type: 'text', text: t }] } } }]

describe('isLegalDraft', () => {
  it('flags TR/EN draft banners', () => {
    expect(isLegalDraft(text('TASLAK — Yayın öncesi hukuk danışmanı tarafından incelenmelidir.'))).toBe(true)
    expect(isLegalDraft(text('DRAFT — Must be reviewed by legal counsel.'))).toBe(true)
  })
  it('flags [UPPERCASE] placeholders', () => {
    expect(isLegalDraft(text('Şirket: [ŞİRKET UNVANI]'))).toBe(true)
    expect(isLegalDraft(text('Date [EFFECTIVE DATE]'))).toBe(true)
  })
  it('recognizes formatted text split across Lexical nodes', () => {
    const split = (a: string, b: string) => [{ content: { root: { children: [{ type: 'text', text: a }, { type: 'text', text: b }] } } }]
    expect(isLegalDraft(split('Taslak ', '— İncelenecek'))).toBe(true)
    expect(isLegalDraft(split('[ŞİRKET ', 'UNVANI]'))).toBe(true)
  })
  it('passes reviewed content', () => {
    expect(isLegalDraft(text('Bu sözleşme [1] numaralı maddeyle birlikte okunur. Taslak halinde değildir.'))).toBe(false)
    expect(isLegalDraft([])).toBe(false)
    expect(isLegalDraft(null)).toBe(false)
  })
})

import { placeholderCover } from '@/lib/cover'

describe('placeholderCover', () => {
  it('is deterministic, finite and varies by slug', () => {
    const a = placeholderCover('/haberler/a')
    expect(placeholderCover('/haberler/a')).toEqual(a)
    const styles = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map((k) => placeholderCover(`/haberler/${k}`).style.backgroundImage))
    expect(styles.size).toBeGreaterThan(3)
    for (const k of styles) expect(k).not.toMatch(/undefined|NaN|-\d+%/)
  })
})
