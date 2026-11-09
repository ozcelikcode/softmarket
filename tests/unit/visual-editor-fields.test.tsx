import type { Field } from 'payload'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/content', () => ({
  mediaOf: (value: unknown) => (value && typeof value === 'object' && 'url' in value ? value : null),
  relOf: (value: unknown) => value,
}))
vi.mock('@/lib/site', () => ({ resolveLink: (link?: { label?: string; url?: string }) => (link?.url && link.label ? { href: link.url, label: link.label, newTab: false } : null) }))
vi.mock('@/components/blocks/rich-text', () => ({ RichContent: () => <div className="rich-text" /> }))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }))
vi.mock('@/lib/blocks/data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/blocks/data')>()),
  loadFamilies: async () => ({ docs: [{ id: 1, title: 'Aile', slug: 'aile', tagline: 'T', icon: null, image: null }], counts: new Map([[1, 2]]) }),
  loadHeroFamilies: async () => ({ docs: [], counts: new Map() }),
  loadProducts: async () => [{ id: 1, title: 'Ürün', slug: 'urun', tagline: 'T', summary: 'S', heroImage: null, family: { slug: 'aile', title: 'Aile' } }],
  loadSolutions: async () => [{ id: 1, title: 'Çözüm', slug: 'cozum', summary: 'S', heroImage: null }],
  loadPosts: async () => [{ id: 1, title: 'Haber', slug: 'haber', excerpt: 'E', coverImage: null, category: 'news', publishedAt: '2026-01-01' }],
  loadCaseStudy: async () => ({ id: 1, title: 'Vaka', slug: 'vaka', customerName: 'Müşteri', summary: 'Özet', results: [] }),
  loadLogos: async () => [],
}))

import { layoutBlocks, productBlocks } from '@/blocks'
import { EditableBlock } from '@/components/blocks/block-shell'
import { getBlockRenderer } from '@/components/blocks/registry'
import type { LayoutBlock } from '@/components/blocks/types'
import { SystemHero } from '@/components/pages/system-page'
import { Pages } from '@/collections/Pages'
import { Products } from '@/collections/Products'
import { INLINE_BLOCK_FIELDS, INLINE_DOC_FIELDS, isInlineBlockField, isInlineDocField, matchesPattern } from '@/editor/canvas/fields'
import { planBlocks } from '@/lib/blocks/render-plan'

/*
 * V5 visual editor: inline field markers. For every block type with inline text a fixture is rendered (1) as the
 * public page: no editor attribute at all; (2) in editing mode: every `data-field-path` is allowlisted, shows the
 * stored value of exactly that path, and every allowlisted field present in the fixture is marked. (3) Round trip:
 * writing a new value to each marked path (what the admin host does through the form) and rendering again shows
 * the new value at the same marker and changes no other marker.
 */

const link = (label: string) => ({ link: { type: 'custom', url: 'https://example.test/x', label } })
const FIXTURES: Record<string, Record<string, unknown>> = {
  hero: { variant: 'split', eyebrow: 'Üst', heading: 'Başlık', subheading: 'Alt başlık', actions: [link('Birincil'), link('İkincil')] },
  featureGrid: { heading: 'Özellikler', intro: 'Giriş', items: [{ title: 'Bir', description: 'Açıklama bir' }, { title: 'İki', description: 'Açıklama iki' }] },
  mediaText: { heading: 'Medya metin', actions: [link('Detay')] },
  specTable: { heading: 'Teknik', groups: [{ title: 'Grup', rows: [{ label: 'CPU', value: '4 çekirdek' }, { label: 'RAM', value: '8 GB' }] }] },
  stats: { heading: 'Rakamlar', items: [{ value: '99', label: 'Uptime', description: 'Yıllık' }] },
  logoWall: { heading: 'Müşteriler', logos: [{ name: 'Acme' }] },
  cta: { style: 'card', heading: 'Teklif alın', body: 'Hemen yazın', actions: [link('Teklif iste')] },
  faq: { source: 'inline', heading: 'SSS', items: [{ question: 'Soru bir?', answer: {} }, { question: 'Soru iki?', answer: {} }] },
  videoEmbed: { heading: 'Video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', caption: 'Alt yazı' },
  media: { heading: 'Galeri', items: [{ image: null, caption: 'Görsel yok' }, { image: { url: '/x.png', width: 10, height: 10, alt: 'x' }, caption: 'Görsel var' }] },
  testimonial: { quote: 'Harika ürün', name: 'Ada', role: 'CTO', company: 'Acme' },
  tabs: { heading: 'Sekmeler', items: [{ label: 'A', content: {} }] },
  productFamilies: { eyebrow: 'Ürünler', heading: 'Aileler', description: 'Tüm aileler', viewAllLabel: 'Hepsini gör' },
  productShowcase: { eyebrow: 'Vitrin', heading: 'Ürünler', description: 'Seçkiler', viewAllLabel: 'Tüm ürünler' },
  solutionsGrid: { eyebrow: 'Çözüm', heading: 'Çözümler', description: 'Sektörler', viewAllLabel: 'Tüm çözümler' },
  newsList: { eyebrow: 'Blog', heading: 'Haberler', description: 'Son yazılar', viewAllLabel: 'Tüm haberler' },
  caseStudy: { eyebrow: 'Vaka', linkLabel: 'Hikâyeyi oku' },
}
/** Allowlisted fields a fixture cannot show in a unit render (async families panel). */
const NOT_RENDERED: Record<string, string[]> = { hero: ['panelTitle'], media: ['items.0.caption'] }

const unescape = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
const get = (obj: unknown, path: string) => path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj)
const set = (obj: Record<string, unknown>, path: string, value: unknown) => {
  const keys = path.split('.')
  const copy = structuredClone(obj)
  let o: Record<string, unknown> = copy
  for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>
  o[keys.at(-1)!] = value
  return copy
}
const markers = (html: string, attr = 'data-field-path') =>
  [...html.matchAll(new RegExp(`<\\w+[^>]*${attr}="([^"]+)"[^>]*>([^<]*)<`, 'g'))].map((m) => ({ path: m[1]!, text: unescape(m[2]!) }))

async function render(block: Record<string, unknown>, editing: boolean) {
  const [planned] = planBlocks([block as LayoutBlock], { editing })
  const Component = getBlockRenderer(String(block.blockType))!
  const node = await Component({ block: planned!.block as never, locale: 'tr', ctx: planned!.ctx })
  return renderToStaticMarkup(<EditableBlock ctx={planned!.ctx} blockType={String(block.blockType)}>{node}</EditableBlock>)
}

/** Every localized text/textarea path of a config (`*` = array row). */
function textPaths(fields: Field[], prefix = ''): string[] {
  return fields.flatMap((f): string[] => {
    const named = 'name' in f ? `${prefix}${f.name}` : null
    if ((f.type === 'text' || f.type === 'textarea') && named && f.localized) return [named]
    if (f.type === 'group' && named) return textPaths(f.fields, `${named}.`)
    if (f.type === 'array' && named) return textPaths(f.fields, `${named}.*.`)
    if ((f.type === 'row' || f.type === 'collapsible') && 'fields' in f) return textPaths(f.fields, prefix)
    if (f.type === 'tabs') return f.tabs.flatMap((tab) => textPaths(tab.fields, 'name' in tab && tab.name ? `${prefix}${tab.name}.` : prefix))
    return []
  })
}

describe('inline field allowlist matches the schema', () => {
  const all = new Map([...layoutBlocks, ...productBlocks].map((b) => [b.slug, b]))
  it.each(Object.entries(INLINE_BLOCK_FIELDS))('%s: every pattern is a localized text/textarea field', (slug, patterns) => {
    const config = all.get(slug)
    expect(config, slug).toBeTruthy()
    const paths = textPaths(config!.fields)
    for (const p of patterns) expect(paths, `${slug}.${p}`).toContain(p)
  })
  it.each([['products', Products.fields], ['pages', Pages.fields]] as const)('%s document fields are localized text/textarea fields', (slug, fields) => {
    const paths = textPaths(fields as Field[])
    for (const p of INLINE_DOC_FIELDS[slug]!) expect(paths, `${slug}.${p}`).toContain(p)
  })
  it('rejects unsafe and non-allowlisted paths', () => {
    expect(isInlineBlockField('hero', 'heading')).toBe(true)
    expect(isInlineBlockField('hero', 'actions.0.link.label')).toBe(true)
    for (const bad of ['actions.0.link.url', 'appearance.anchor', '__proto__', 'constructor', 'heading.constructor', 'actions.-1.link.label', 'actions.01.link.label', 'actions.1000.link.label', 'a..b', '']) {
      expect(isInlineBlockField('hero', bad), bad).toBe(false)
    }
    expect(isInlineBlockField('toString', 'heading')).toBe(false)
    expect(isInlineBlockField('richText', 'content')).toBe(false)
    expect(isInlineDocField('products', 'slug')).toBe(false)
    expect(isInlineDocField('products', 'features.2.title')).toBe(true)
    expect(isInlineDocField('pages', 'hero.title')).toBe(true)
    expect(isInlineDocField('users', 'email')).toBe(false)
    expect(matchesPattern('items.*.title', 'items.3.title')).toBe(true)
    expect(matchesPattern('items.*.title', 'items.x.title')).toBe(false)
  })
})

describe.each(Object.entries(FIXTURES))('%s markers and round trip', (blockType, data) => {
  const block = { blockType, id: `id-${blockType}`, ...data }

  it('public render carries no editor attribute', async () => {
    const html = await render(block, false)
    expect(html.length).toBeGreaterThan(0)
    expect(html).not.toMatch(/data-(block-id|block-type|block-hidden|field-path|doc-field|canvas)/)
  })

  it('editing render marks exactly the allowlisted fields with their stored values', async () => {
    const html = await render(block, true)
    expect(html).toContain(`data-block-id="${block.id}"`)
    const found = markers(html)
    for (const m of found) {
      expect(isInlineBlockField(blockType, m.path), m.path).toBe(true)
      expect(m.text, m.path).toBe(String(get(block, m.path)))
    }
    const expected = INLINE_BLOCK_FIELDS[blockType]!.flatMap((pattern) => {
      const rows = (p: string, at: unknown, prefix: string): string[] => {
        const [head, ...rest] = p.split('.')
        const next = (at as Record<string, unknown> | undefined)?.[head!]
        if (!rest.length) return typeof next === 'string' && next ? [`${prefix}${head}`] : []
        if (rest[0] === '*') return Array.isArray(next) ? next.flatMap((row, i) => rows(rest.slice(1).join('.'), row, `${prefix}${head}.${i}.`)) : []
        return rows(rest.join('.'), next, `${prefix}${head}.`)
      }
      return rows(pattern, block, '')
    }).filter((p) => !(NOT_RENDERED[blockType] ?? []).includes(p))
    expect(found.map((m) => m.path).sort()).toEqual([...new Set(expected)].sort())
  })

  it('a value written to a marked path re-renders at that marker only', async () => {
    const before = markers(await render(block, true))
    for (const { path } of before) {
      const after = markers(await render(set(block, path, 'Yeni metin ✓'), true))
      expect(after.find((m) => m.path === path)?.text, path).toBe('Yeni metin ✓')
      expect(after.filter((m) => m.path !== path)).toEqual(before.filter((m) => m.path !== path))
    }
  })
})

describe('hidden blocks and document fields', () => {
  it('hidden blocks render only in editing mode, faded and flagged; they never take the h1', () => {
    const hero = { blockType: 'hero', id: 'h1', heading: 'Gizli', appearance: { hidden: true } }
    const visible = { blockType: 'hero', id: 'h2', heading: 'Görünür' }
    expect(planBlocks([hero, visible] as never, { firstHeroH1: true }).map((p) => p.block.id)).toEqual(['h2'])
    const editing = planBlocks([hero, visible] as never, { firstHeroH1: true, editing: true })
    expect(editing.map((p) => [p.block.id, p.ctx.edit, p.ctx.headingAs, p.ctx.pageTop])).toEqual([
      ['h1', { id: 'h1', hidden: true }, 'h2', false],
      ['h2', { id: 'h2', hidden: false }, 'h1', true],
    ])
    const html = renderToStaticMarkup(<EditableBlock ctx={editing[0]!.ctx} blockType="hero"><p>x</p></EditableBlock>)
    expect(html).toBe('<div data-block-id="h1" data-block-type="hero" data-block-hidden="" style="opacity:0.45"><p>x</p></div>')
  })

  it('visible blocks get the same plan with and without editing (pixel-identical canvas)', () => {
    const blocks = [{ blockType: 'spacer', id: 's' }, { blockType: 'hero', id: 'h', heading: 'H', appearance: { anchor: 'a' } }, { blockType: 'cta', id: 'c', appearance: { anchor: 'a' } }]
    const strip = (p: ReturnType<typeof planBlocks>) => p.map(({ ctx: { edit: _e, ...ctx }, key }) => ({ key, ctx }))
    expect(strip(planBlocks(blocks as never, { firstHeroH1: true, editing: true }))).toEqual(strip(planBlocks(blocks as never, { firstHeroH1: true })))
  })

  it('system page hero marks hero.* only when editing an existing record', () => {
    const page = { hero: { eyebrow: 'Ü', title: 'Başlık', lead: 'Giriş' } } as never
    const props = { locale: 'tr', crumbLabel: 'bc', crumbs: [], fallback: { title: 'X' } }
    expect(renderToStaticMarkup(<SystemHero {...props} page={page} />)).not.toContain('data-doc-field')
    const html = renderToStaticMarkup(<SystemHero {...props} page={page} editing />)
    expect(markers(html, 'data-doc-field')).toEqual([
      { path: 'hero.eyebrow', text: 'Ü' }, { path: 'hero.title', text: 'Başlık' }, { path: 'hero.lead', text: 'Giriş' },
    ])
    expect(renderToStaticMarkup(<SystemHero {...props} page={null} editing />)).not.toContain('data-doc-field')
  })
})
