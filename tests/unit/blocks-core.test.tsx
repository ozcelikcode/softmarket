import type { Block, Field } from 'payload'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/content', () => ({
  mediaOf: (value: unknown) => (value && typeof value === 'object' && 'url' in value ? value : null),
  relOf: (value: unknown) => value,
}))
vi.mock('@/lib/site', () => ({ resolveLink: (link?: { label?: string; url?: string }) => (link?.url ? { href: link.url, label: link.label ?? '', newTab: false } : null) }))
vi.mock('@/components/blocks/rich-text', () => ({ RichContent: ({ className }: { className?: string }) => <div className={`rich-text ${className ?? ''}`} /> }))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }))

import { layoutBlocks } from '@/blocks'
import { BlockShell } from '@/components/blocks/block-shell'
import { CTABlock } from '@/components/blocks/cta-block'
import { blockRegistry, getBlockRenderer } from '@/components/blocks/registry'
import { RenderBlocks, type LayoutBlock } from '@/components/blocks/render-blocks'
import {
  BLOCK_DEFAULTS, blockSettings, collectAnchors, resolveAppearance, validateAnchor, type ResolvedAppearance,
} from '@/fields/block-settings'
import { planBlocks } from '@/lib/blocks/render-plan'
import { normalizeIconName } from '@/lib/icon-names'

const hero = (id: string, extra: Record<string, unknown> = {}) => ({ blockType: 'hero', id, heading: `Hero ${id}`, ...extra }) as LayoutBlock
const richText = (id: string, extra: Record<string, unknown> = {}) => ({ blockType: 'richText', id, content: { root: { children: [] } }, ...extra }) as unknown as LayoutBlock
const appearanceGroup = (block: Block) => {
  const collapsible = block.fields.find((f): f is Extract<Field, { type: 'collapsible' }> => f.type === 'collapsible')!
  const group = collapsible.fields[0] as Extract<Field, { type: 'group' }>
  const flat = (fields: Field[]): Field[] => fields.flatMap((f) => (f.type === 'row' ? flat(f.fields) : [f]))
  return { collapsible, group, fields: Object.fromEntries(flat(group.fields).map((f) => [(f as { name: string }).name, f as Field & { defaultValue?: unknown }])) }
}
const shellHtml = (appearance: Partial<ResolvedAppearance>, props: Partial<Parameters<typeof BlockShell>[0]> = {}) =>
  renderToStaticMarkup(
    <BlockShell blockType="faq" appearance={{ ...resolveAppearance({ blockType: 'faq' }), ...appearance }} {...props}>
      <p>body</p>
    </BlockShell>,
  )

describe('blockSettings appearance group', () => {
  it('is attached to every layout block inside a collapsed "Görünüm" collapsible', () => {
    for (const block of layoutBlocks) {
      const { collapsible, group } = appearanceGroup(block)
      expect(collapsible.label).toEqual({ tr: 'Görünüm', en: 'Appearance' })
      expect(collapsible.admin?.initCollapsed).toBe(true)
      expect('name' in group && group.name).toBe('appearance')
    }
  })
  it('defaults reproduce the pre-F3 look of each block (column defaults = renderer fallbacks)', () => {
    for (const block of layoutBlocks) {
      const { fields } = appearanceGroup(block)
      const d = BLOCK_DEFAULTS[block.slug]
      expect(fields.theme.defaultValue).toBe('auto')
      expect(fields.spacing.defaultValue).toBe(d.spacing)
      expect(fields.align.defaultValue).toBe(d.align)
      expect(fields.animation.defaultValue).toBe('subtle')
      expect(fields.hidden.defaultValue).toBe(false)
      expect(fields.anchor.defaultValue).toBeUndefined()
      expect(Boolean(fields.width)).toBe(block.slug !== 'richText')
    }
    expect(BLOCK_DEFAULTS.hero.spacing).toBe('lg')
    expect(blockSettings('richText').fields).toHaveLength(1)
  })
  it('resolves missing/legacy appearance to the old hard-coded theme, spacing and alignment', () => {
    expect(resolveAppearance({ blockType: 'hero' })).toEqual({ theme: 'dark', spacing: 'lg', align: 'start', width: 'normal', animation: 'subtle', hidden: false })
    expect(resolveAppearance({ blockType: 'faq', appearance: null }).theme).toBe('light')
    expect(resolveAppearance({ blockType: 'stats' }).theme).toBe('dark')
    expect(resolveAppearance({ blockType: 'cta', style: 'banner' })).toMatchObject({ theme: 'dark', align: 'center' })
    expect(resolveAppearance({ blockType: 'cta', style: 'card' }).theme).toBe('light')
    expect(resolveAppearance({ blockType: 'cta', style: 'split', appearance: { theme: 'auto' } }).theme).toBe('light')
    expect(resolveAppearance({ blockType: 'cta', style: 'card', appearance: { theme: 'dark' } }).theme).toBe('dark')
    expect(resolveAppearance({ blockType: 'logoWall' }).align).toBe('center')
    expect(resolveAppearance({ blockType: 'richText', appearance: { width: 'wide' } }).width).toBe('normal')
    expect(resolveAppearance({ blockType: 'hero', appearance: { spacing: 'huge', animation: 'spin', anchor: 'Bad Id', hidden: true } }))
      .toEqual({ theme: 'dark', spacing: 'lg', align: 'start', width: 'normal', animation: 'subtle', hidden: true })
    expect(resolveAppearance({ blockType: 'unknown' }).theme).toBe('light')
    expect(resolveAppearance({ blockType: 'constructor' }).theme).toBe('light')
    expect(resolveAppearance({ blockType: 'hero', appearance: { anchor: 'surumler' } }).anchor).toBeUndefined()
  })
})

describe('anchor validation', () => {
  const validate = (value: string | null | undefined, data: unknown = {}) =>
    validateAnchor(value, { data, req: { i18n: { language: 'tr' } } } as never)
  it('accepts empty and well-formed anchors, rejects bad format and reserved page ids', () => {
    expect(validate(null)).toBe(true)
    expect(validate('')).toBe(true)
    expect(validate('ozellikler-2')).toBe(true)
    expect(validate('Bad Id')).toMatch(/küçük harf/)
    expect(validate('a'.repeat(41))).toMatch(/40/)
    expect(validate('main')).toMatch(/kullanılıyor/)
    expect(validate('genel-bakis')).toMatch(/kullanılıyor/)
  })
  it('must be unique on the page across blocks fields and nesting', () => {
    const data = { layout: [hero('a', { appearance: { anchor: 'intro' } }), richText('b', { appearance: { anchor: 'intro' } }), richText('c', { appearance: { anchor: 'ek' } })] }
    expect(collectAnchors(data)).toEqual(['intro', 'intro', 'ek'])
    expect(validate('intro', data)).toMatch(/birden fazla/)
    expect(validate('ek', data)).toBe(true)
  })
})

describe('block registry', () => {
  it('has exactly one renderer per configured layout block', () => {
    expect(Object.keys(blockRegistry).sort()).toEqual(layoutBlocks.map((b) => b.slug).sort())
    for (const b of layoutBlocks) expect(typeof getBlockRenderer(b.slug)).toBe('function')
    expect(getBlockRenderer('constructor')).toBeUndefined()
    expect(getBlockRenderer('toString')).toBeUndefined()
  })
  it('every block has TR/EN labels, a picker group and a preview image', () => {
    for (const b of layoutBlocks) {
      expect(b.labels?.singular).toMatchObject({ tr: expect.any(String), en: expect.any(String) })
      expect(b.admin?.group).toMatchObject({ tr: expect.any(String), en: expect.any(String) })
      expect(b.imageURL).toBe(`/admin/blocks/${b.slug}.webp`)
    }
  })
  it('normalizes legacy free-text icon names for the allowlist select', () => {
    expect(normalizeIconName('ShieldCheck')).toBe('shield-check')
    expect(normalizeIconName(' zap ')).toBe('zap')
    expect(normalizeIconName('not-an-icon')).toBeNull()
  })
})

describe('h1 rule and render plan', () => {
  it('keeps every hero at h2 when the page owns its h1 (PageHero pages)', () => {
    expect(planBlocks([hero('a'), hero('b')]).map((p) => p.ctx.headingAs)).toEqual(['h2', 'h2'])
  })
  it('makes only the first visible hero the h1 on CMS-driven pages', () => {
    const plan = planBlocks([richText('r'), hero('hidden', { appearance: { hidden: true } }), hero('a'), hero('b'), { blockType: 'nope', id: 'x' } as unknown as LayoutBlock], {
      firstHeroH1: true, isKnown: (t) => t !== 'nope',
    })
    expect(plan.map((p) => [p.block.id, p.ctx.headingAs, p.ctx.index, p.ctx.pageTop])).toEqual([
      ['r', 'h2', 0, true], ['a', 'h1', 1, false], ['b', 'h2', 2, false],
    ])
  })
  it('renders exactly one h1 and drops duplicate anchor ids from HTML', () => {
    const blocks = [hero('a', { appearance: { anchor: 'giris' } }), hero('b', { appearance: { anchor: 'giris' } }), richText('c')]
    const page = renderToStaticMarkup(<RenderBlocks blocks={blocks} locale="tr" firstHeroH1 />)
    expect(page.match(/<h1[\s>]/g)).toHaveLength(1)
    expect(page.match(/<h2[\s>]/g)).toHaveLength(1)
    expect(page.match(/id="giris"/g)).toHaveLength(1)
    const withPageHero = renderToStaticMarkup(<RenderBlocks blocks={blocks} locale="tr" />)
    expect(withPageHero).not.toMatch(/<h1[\s>]/)
  })
  it('skips hidden blocks and renders nothing for an empty plan', () => {
    expect(renderToStaticMarkup(<RenderBlocks blocks={[richText('c', { appearance: { hidden: true } })]} locale="tr" />)).toBe('')
  })
})

describe('BlockShell', () => {
  it('applies theme, spacing, anchor and container scroll-reveal', () => {
    const html = shellHtml({ theme: 'dark', spacing: 'lg', anchor: 'sss' }, { tone: 'raised', container: { size: 'narrow' } })
    expect(html).toMatch(/^<section data-theme="dark"/)
    expect(html).toContain('id="sss"')
    expect(html).toContain('data-block="faq"')
    expect(html).toContain('scroll-mt-24')
    expect(html).toContain('py-24 sm:py-32')
    expect(html).toContain('bg-surface')
    expect(html).toMatch(/<div class="[^"]*max-w-narrow" data-anim="subtle" style="--i:0">/)
  })
  it('omits data-anim for animation none and for blocks that animate their own items', () => {
    expect(shellHtml({ animation: 'none' })).not.toContain('data-anim')
    expect(shellHtml({}, { animate: 'items' })).not.toContain('data-anim')
    expect(shellHtml({}, { animate: 'none' })).not.toContain('data-anim')
    expect(shellHtml({})).not.toContain(' id=')
  })
  it('width overrides the natural container; normal keeps natural classes', () => {
    expect(shellHtml({ width: 'wide' }, { container: { size: 'narrow', className: 'max-w-[60rem]' } })).toContain('max-w-wide')
    expect(shellHtml({ width: 'wide' }, { container: { size: 'narrow', className: 'max-w-[60rem]' } })).not.toContain('max-w-[60rem]')
    expect(shellHtml({}, { container: { size: 'narrow', className: 'max-w-[60rem]' } })).toContain('max-w-[60rem]')
  })
})

describe('blocks with legacy data (no appearance) and new options', () => {
  it('renders the old section settings for existing rows', () => {
    const faq = renderToStaticMarkup(
      <RenderBlocks locale="tr" blocks={[{ blockType: 'faq', id: 'f', source: 'inline', items: [{ question: 'Q?', answer: {} }] } as LayoutBlock]} />,
    )
    expect(faq).toMatch(/^<section data-theme="light" class="relative w-full text-text py-16 sm:py-24 bg-surface" data-block="faq"><div class="mx-auto w-full px-5 sm:px-8 max-w-narrow" data-anim="subtle"/)
    const stats = renderToStaticMarkup(<RenderBlocks locale="tr" blocks={[{ blockType: 'stats', id: 's', items: [{ value: '9', label: 'L' }] } as LayoutBlock]} />)
    expect(stats).toMatch(/^<section data-theme="dark"[^>]*border-y/)
  })
  it('hero variants: legacy default = cinematic (display heading, grid), minimal has no decoration', () => {
    const plan = (variant: string) => planBlocks([hero('h', { variant })], { firstHeroH1: true })[0]
    const cinematic = renderToStaticMarkup(<RenderBlocks locale="tr" firstHeroH1 blocks={[hero('h', { variant: 'default' })]} />)
    expect(cinematic).toContain('bg-grid')
    expect(cinematic).toMatch(/<h1 class="[^"]*text-display" data-hero-in="slide"/)
    expect(cinematic).toContain('pt-32')
    const minimal = renderToStaticMarkup(<RenderBlocks locale="tr" blocks={[hero('h', { variant: 'minimal', appearance: { animation: 'none' } })]} />)
    expect(minimal).not.toContain('bg-glow')
    expect(minimal).not.toContain('data-hero-in')
    expect(minimal).toMatch(/<h2 class="[^"]*text-h1/)
    expect(plan('centered').ctx.headingAs).toBe('h1')
  })
  it('feature grid plain style and per-item stagger follow appearance.animation', () => {
    const items = [{ title: 'A', icon: 'zap' }, { title: 'B' }]
    const plain = renderToStaticMarkup(<RenderBlocks locale="tr" blocks={[{ blockType: 'featureGrid', id: 'g', style: 'plain', items } as LayoutBlock]} />)
    expect(plain).toContain('border-t border-border pt-6')
    expect(plain).not.toContain('card-hover')
    expect(plain.match(/data-anim="subtle"/g)).toHaveLength(2)
    const still = renderToStaticMarkup(<RenderBlocks locale="tr" blocks={[{ blockType: 'featureGrid', id: 'g', items, appearance: { animation: 'none' } } as LayoutBlock]} />)
    expect(still).toContain('card-hover')
    expect(still).not.toContain('data-anim')
  })
  it('cta split style puts actions beside the text on a light card', async () => {
    const block = { blockType: 'cta', id: 'c', style: 'split', heading: 'Konuşalım', actions: [{ link: { url: '/iletisim', label: 'İletişim' } }] } as LayoutBlock
    const ctx = planBlocks([block])[0].ctx
    const html = renderToStaticMarkup(await CTABlock({ block: block as never, locale: 'tr', ctx }))
    expect(html).toMatch(/^<section data-theme="light"/)
    expect(html).toContain('lg:justify-between')
    expect(html).toContain('İletişim')
    const banner = renderToStaticMarkup(await CTABlock({ block: { ...block, style: 'banner' } as never, locale: 'tr', ctx: planBlocks([{ ...block, style: 'banner' } as LayoutBlock])[0].ctx }))
    expect(banner).toMatch(/^<section data-theme="dark"[^>]*border-t/)
    expect(banner).toContain('bg-glow')
  })
})
