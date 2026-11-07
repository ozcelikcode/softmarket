import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { hreflangPath } from '@/components/layout/language-switcher'
import { Reveal } from '@/components/ui/reveal'
import { selectionErrors } from '@/lib/forms/selection'
import { cn } from '@/lib/utils'

const root = process.cwd()
const css = readFileSync(path.join(root, 'src/app/(frontend)/globals.css'), 'utf8')
const seed = (file: string) => JSON.parse(readFileSync(path.join(root, 'content/seed', file), 'utf8'))

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
const token = (block: string, name: string) =>
  new RegExp(`${block}[^{]*\\{[^}]*--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)![1]

describe('primary button contrast and class merging', () => {
  it('keeps the contrast color when a custom font-size token follows', () => {
    const merged = cn('bg-accent text-accent-contrast', 'h-9 px-3.5 text-small')
    expect(merged).toContain('text-accent-contrast')
    expect(merged).toContain('text-small')
  })
  it.each([['\\[data-theme="dark"\\]'], ['\\[data-theme="light"\\]']])('accent buttons meet WCAG AA in %s', (block) => {
    for (const hover of ['accent', 'accent-hover']) {
      expect(contrast(token(block, hover), token(block, 'accent-contrast'))).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('language switcher hreflang source', () => {
  const head = (links: [string, string][]) => ({
    querySelectorAll: () => links.map(([hreflang, href]) => ({ getAttribute: (n: string) => (n === 'hreflang' ? hreflang : href) })),
  }) as unknown as ParentNode
  it('returns the target locale path of the alternate link', () => {
    const h = head([['tr', 'https://x.test/tr/urunler/a/b'], ['en', 'https://x.test/en/products/a/b-en'], ['x-default', 'https://x.test/tr/urunler/a/b']])
    expect(hreflangPath(h, 'en')).toBe('/en/products/a/b-en')
  })
  it('ignores missing or foreign-locale links', () => {
    expect(hreflangPath(head([['tr', 'https://x.test/tr']]), 'en')).toBeUndefined()
    expect(hreflangPath(head([['en', 'https://x.test/tr/yanlis']]), 'en')).toBeUndefined()
  })
})

describe('lead form product/edition pairing', () => {
  const products = [{ id: 1, slug: 'a' }, { id: 2, slug: 'b' }]
  const editions = [{ sku: 'A-1', product: 1 }, { sku: 'B-1', product: { id: 2 } }]
  it('accepts empty and matching pairs', () => {
    expect(selectionErrors(products, editions, '', '')).toEqual({})
    expect(selectionErrors(products, editions, 'a', 'A-1')).toEqual({})
    expect(selectionErrors(products, editions, 'b', 'B-1')).toEqual({})
  })
  it('flags a SKU of another product, an orphan SKU and an unknown product', () => {
    expect(selectionErrors(products, editions, 'a', 'B-1')).toEqual({ sku: 'invalid' })
    expect(selectionErrors(products, editions, '', 'A-1')).toEqual({ sku: 'invalid' })
    expect(selectionErrors(products, editions, 'zzz', '')).toEqual({ product: 'invalid' })
  })
})

describe('scroll reveal without JavaScript', () => {
  it('server markup never hides content', () => {
    const html = renderToStaticMarkup(<Reveal>icerik</Reveal>)
    expect(html).not.toContain('data-reveal')
    expect(html).not.toMatch(/opacity\s*:\s*0/)
  })
  it('pending state exists only under no-preference motion', () => {
    const pending = css.indexOf('[data-reveal="pending"]')
    const media = css.lastIndexOf('@media (prefers-reduced-motion: no-preference)', pending)
    expect(media).toBeGreaterThan(-1)
  })
})

describe('seed navigation and legal links', () => {
  const legalSlugs = ['kvkk-aydinlatma', 'gizlilik-politikasi', 'cerez-politikasi', 'kullanim-kosullari', 'eula']
  it('legal sources exist for every footer slug', () => {
    for (const l of ['tr', 'en']) for (const s of legalSlugs) expect(existsSync(path.join(root, `content/legal/${l}/${s}.md`))).toBe(true)
  })
  it.each(['tr', 'en'] as const)('globals %s: company menu, CTA and valid legal links', (l) => {
    const { header, footer } = seed('01-globals.json').globals
    const nav = header[l].navItems
    expect(nav.some((n: { megaMenu?: string }) => n.megaMenu === 'products')).toBe(true)
    expect(nav.some((n: { children?: unknown[] }) => (n.children?.length ?? 0) >= 5)).toBe(true)
    expect(header[l].cta.link.url).toMatch(l === 'en' ? /request-demo$/ : /demo-talep$/)
    const urls: string[] = footer[l].legalLinks.map((x: { link: { url: string } }) => x.link.url)
    expect(urls.map((u) => u.split('/').pop())).toEqual(legalSlugs)
  })
  it('product seed has no layout blocks duplicating collection fields', () => {
    for (const p of seed('10-families-products.json').products) for (const l of ['tr', 'en']) {
      const types = (p[l]?.layout ?? []).map((b: { blockType: string }) => b.blockType)
      expect(types).not.toContain('hero')
      expect(types).not.toContain('featureGrid')
      expect(types).not.toContain('specTable')
    }
  })
})
