import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { COMMERCE_LEGAL_FILES, loadLegal } from '@/lib/content-import/importer'
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
  it.each(['[VERGİ DAİRESİ/NO]', '[HUKUK İNCELEMESİ: saklama süresi]', '[ÖDEME KURULUŞU — örn. iyzico]', '[SÜRE — DOĞRULA]'])(
    'keeps an unresolved legal token draft after the banner is removed: %s', (token) => {
      expect(isLegalDraft(text(`Metin ${token}`))).toBe(true)
    },
  )
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

describe('content/legal drafts (incl. P7 sales texts)', () => {
  const root = resolve(process.cwd(), 'content/legal')
  const names = readdirSync(resolve(root, 'tr')).filter((f) => f.endsWith('.md')).sort()
  const SALES = ['mesafeli-satis-sozlesmesi.md', 'on-bilgilendirme-formu.md', 'iade-ve-cayma.md']

  it('rejects symlink files/directories before private file contents can be imported and published', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'p7-path-'))
    try {
      for (const l of ['tr', 'en']) mkdirSync(resolve(dir, l))
      writeFileSync(resolve(dir, 'private.md'), '# Private')
      for (const l of ['tr', 'en']) symlinkSync(resolve(dir, 'private.md'), resolve(dir, l, 'test.md'))
      await expect(loadLegal(dir)).rejects.toThrow(/symlink/)
      rmSync(resolve(dir, 'en'), { recursive: true })
      symlinkSync(resolve(dir, 'tr'), resolve(dir, 'en'))
      await expect(loadLegal(dir)).rejects.toThrow(/symlink/)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it('has matching section numbers and no undetected placeholders in either locale', () => {
    for (const name of names) {
      const texts = ['tr', 'en'].map((l) => readFileSync(resolve(root, l, name), 'utf8'))
      const sections = texts.map((s) => [...s.matchAll(/^## (\d+[A-Z]?)\./gm)].map((m) => m[1]))
      expect(sections[0], name).toEqual(sections[1])
      for (const source of texts) for (const token of source.matchAll(/\[[^\]\n]+\](?!\()/g)) {
        expect(isLegalDraft(text(token[0])), `${name}: ${token[0]}`).toBe(true)
      }
    }
  })

  it('has TR and EN files under identical names, including the three sales texts', () => {
    expect(readdirSync(resolve(root, 'en')).filter((f) => f.endsWith('.md')).sort()).toEqual(names)
    for (const f of SALES) expect(names).toContain(f)
    expect(names).toHaveLength(8)
  })

  it('every file is a draft for the noindex/sitemap rule (banner + placeholders), in both locales', async () => {
    const { seed } = await loadLegal(root)
    const pages = (seed as unknown as { pages: { tr: { layout: unknown }; en: { layout: unknown } }[] }).pages
    expect(pages).toHaveLength(names.length)
    for (const page of pages) {
      expect(isLegalDraft(page.tr.layout)).toBe(true)
      expect(isLegalDraft(page.en.layout)).toBe(true)
    }
    for (const locale of ['tr', 'en']) for (const f of names) {
      const text = readFileSync(resolve(root, locale, f), 'utf8')
      expect(text.split('\n')[0], `${locale}/${f}`).toMatch(/^> \*\*(TASLAK|DRAFT) —/)
    }
  })

  it('the sales texts carry the company placeholders (never invented company data)', () => {
    for (const locale of ['tr', 'en']) for (const f of ['mesafeli-satis-sozlesmesi.md', 'on-bilgilendirme-formu.md']) {
      const text = readFileSync(resolve(root, locale, f), 'utf8')
      for (const token of ['[ŞİRKET UNVANI]', '[MERSİS]', '[ADRES]', '[VERGİ DAİRESİ/NO]', '[KEP]', '[ETBİS NO]']) expect(text, `${locale}/${f} ${token}`).toContain(token)
    }
  })

  it('the withdrawal exception (instant digital performance, explicit consent) is stated in all three texts', () => {
    for (const f of SALES) {
      expect(readFileSync(resolve(root, 'tr', f), 'utf8')).toMatch(/m\. 15/)
      expect(readFileSync(resolve(root, 'en', f), 'utf8')).toMatch(/Article 15|art\. 15|article 15/)
    }
  })

  it('--legal import marks exactly the three sales files with pages.commerceLegal (file name → kind), both locales', async () => {
    const { seed } = await loadLegal(root)
    const pages = (seed as unknown as { pages: { tr: Record<string, unknown>; en: Record<string, unknown> }[] }).pages
    const kinds = Object.fromEntries(pages.map((p) => [p.tr.slug, p.tr.commerceLegal]))
    expect(kinds).toMatchObject({ 'mesafeli-satis-sozlesmesi': 'distanceSales', 'on-bilgilendirme-formu': 'preInformation', 'iade-ve-cayma': 'refund' })
    expect(Object.values(kinds).filter(Boolean)).toHaveLength(3)
    for (const p of pages) { expect(p.en.commerceLegal).toBe(p.tr.commerceLegal); expect(p.en.slug).toBe(p.tr.slug); expect(p.tr.pageType).toBe('legal') }
    expect(Object.keys(COMMERCE_LEGAL_FILES).sort()).toEqual([...SALES].sort())
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
