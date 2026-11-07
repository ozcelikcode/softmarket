import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/content', () => ({
  mediaOf: (value: unknown) => (value && typeof value === 'object' && 'url' in value ? value : null),
  relOf: (value: unknown) => value,
}))
vi.mock('@/lib/site', () => ({ resolveLink: () => null }))
vi.mock('@/components/blocks/rich-text', () => ({ RichContent: ({ data }: { data?: { t?: string } }) => <div className="rich-text">{data?.t}</div> }))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }))

import { layoutBlocks } from '@/blocks'
import { HeroBlock } from '@/components/blocks/hero-block'
import { HeroVideo } from '@/components/blocks/hero-video'
import { blockRegistry } from '@/components/blocks/registry'
import { RenderBlocks, type LayoutBlock } from '@/components/blocks/render-blocks'
import { TabsIsland } from '@/components/blocks/tabs-island'
import { VideoFacade } from '@/components/blocks/video-facade'
import { BLOCK_DEFAULTS } from '@/fields/block-settings'
import { planBlocks } from '@/lib/blocks/render-plan'
import { aspectClass, autoplayUrl, nextTabIndex, shouldLoadHeroVideo, spacerClass } from '@/lib/blocks/static'
import { csp } from './helpers/csp'

const img = (name: string) => ({ url: `/api/media/file/${name}.png`, alt: name, width: 1600, height: 900 })
const NEW = ['media', 'testimonial', 'tabs', 'spacer', 'divider'] as const
const html = async (block: Record<string, unknown>, locale = 'tr') => {
  const [planned] = planBlocks([block as unknown as LayoutBlock])
  const Block = blockRegistry[planned.block.blockType as keyof typeof blockRegistry] as (p: unknown) => unknown
  return renderToStaticMarkup((await Block({ block: planned.block, locale, ctx: planned.ctx })) as never)
}

describe('F4 block registration', () => {
  it('new blocks have defaults, a renderer, TR/EN labels, a group and a preview image', () => {
    for (const slug of NEW) {
      const block = layoutBlocks.find((b) => b.slug === slug)!
      expect(block, slug).toBeTruthy()
      expect(BLOCK_DEFAULTS[slug], slug).toBeTruthy()
      expect(blockRegistry[slug], slug).toBeTypeOf('function')
      expect(block.labels?.singular).toMatchObject({ tr: expect.any(String), en: expect.any(String) })
      expect(block.admin?.group).toBeTruthy()
      expect(block.imageURL).toBe(`/admin/blocks/${slug}.webp`)
    }
  })
  it('hero offers mediaBackground and an optional video upload without changing existing option values', () => {
    const hero = layoutBlocks.find((b) => b.slug === 'hero')!
    const variant = hero.fields.find((f) => 'name' in f && f.name === 'variant') as { options: { value: string }[]; defaultValue: string }
    expect(variant.options.map((o) => o.value)).toEqual(['default', 'split', 'centered', 'minimal', 'mediaBackground'])
    expect(variant.defaultValue).toBe('default')
    expect(hero.fields.some((f) => 'name' in f && f.name === 'video')).toBe(true)
  })
})

describe('static blocks render', () => {
  it('media: single figure keeps ratio, grid crops to the chosen aspect, captions render', async () => {
    const one = await html({ blockType: 'media', items: [{ id: 'a', image: img('a'), caption: 'Alt yazı' }], aspect: 'auto' })
    expect(one).toContain("<figure")
    expect(one).toContain('Alt yazı')
    expect(one).toContain('h-auto')
    const grid = await html({ blockType: 'media', aspect: '16-9', items: [1, 2, 3].map((n) => ({ id: `i${n}`, image: img(`m${n}`) })) })
    expect(grid.match(/<figure/g)).toHaveLength(3)
    expect(grid).toContain('aspect-video')
    expect(grid).toContain('lg:grid-cols-3')
    expect(await html({ blockType: 'media', items: [{ id: 'x', image: 5 }] })).toBe('')
  })
  it('testimonial: quote, person, role/company, photo and logo', async () => {
    const out = await html({ blockType: 'testimonial', quote: 'Harika ürün', name: 'Ayşe Yılmaz', role: 'CTO', company: 'Acme', photo: img('p'), logo: img('l') })
    expect(out).toContain('<blockquote')
    expect(out).toContain('Harika ürün')
    expect(out).toContain('Ayşe Yılmaz')
    expect(out).toContain('CTO · Acme')
    expect(out).toContain('alt="Acme"')
    expect(out).toContain('text-center')
    expect(await html({ blockType: 'testimonial', name: 'x' })).toBe('')
  })
  it('tabs: server markup exposes every panel and links to each section without JS', async () => {
    const out = await html({ blockType: 'tabs', heading: 'Yetenekler', items: [{ id: '1', label: 'Bir', content: { t: 'ilk' } }, { id: '2', label: 'İki', content: { t: 'ikinci' } }, { id: '3', label: 'Üç' }] })
    expect(out).not.toContain('role="tablist"')
    expect(out.match(/href="#/g)).toHaveLength(3)
    expect(out).not.toContain(' hidden=""')
    expect(out).toContain('ilk')
    expect(out).toContain('ikinci')
    expect(out).toContain('aria-labelledby="tabs-0-heading"')
    expect(await html({ blockType: 'tabs', items: [] })).toBe('')
  })
  it('spacer: themed, aria-hidden, size class; divider: hr styles', async () => {
    const spacer = await html({ blockType: 'spacer', size: 'xl', appearance: { theme: 'dark', anchor: 'bosluk' } })
    expect(spacer).toContain('aria-hidden="true"')
    expect(spacer).toContain('data-theme="dark"')
    expect(spacer).toContain('id="bosluk"')
    expect(spacer).toContain(spacerClass('xl'))
    expect(spacerClass('nope')).toBe(spacerClass('md'))
    expect(await html({ blockType: 'divider', style: 'accent' })).toContain('bg-accent')
    expect(await html({ blockType: 'divider' })).toContain('bg-border')
  })
  it('aspectClass ignores prototype keys and unknown values', () => {
    expect(aspectClass('21-9')).toBe('aspect-[21/9]')
    expect(aspectClass('constructor')).toBeUndefined()
    expect(aspectClass('auto')).toBeUndefined()
  })
})

describe('tabs keyboard model', () => {
  it('arrows wrap, Home/End jump, other keys ignored', () => {
    expect(nextTabIndex('ArrowRight', 0, 3)).toBe(1)
    expect(nextTabIndex('ArrowRight', 2, 3)).toBe(0)
    expect(nextTabIndex('ArrowLeft', 0, 3)).toBe(2)
    expect(nextTabIndex('ArrowDown', 1, 3)).toBeNull()
    expect(nextTabIndex('ArrowUp', 1, 3)).toBeNull()
    expect(nextTabIndex('Home', 2, 4)).toBe(0)
    expect(nextTabIndex('End', 0, 4)).toBe(3)
    expect(nextTabIndex('Tab', 0, 4)).toBeNull()
    expect(nextTabIndex('Enter', 0, 4)).toBeNull()
    expect(nextTabIndex('End', 0, 0)).toBeNull()
  })
  it('island links to each panel and labels it before enhancement', () => {
    const out = renderToStaticMarkup(<TabsIsland tabs={[{ label: 'A', content: 'a' }, { label: 'B', content: 'b' }]} />)
    const ids = [...out.matchAll(/href="#([^"]+)"/g)].map((m) => m[1])
    expect(ids).toHaveLength(2)
    for (const id of ids) expect(out).toContain(`id="${id}"`)
    expect(out).toMatch(/aria-labelledby="[^"]+-tab-0"/)
  })
})

describe('video facade', () => {
  it('server markup has poster + play button and no iframe or provider URL', async () => {
    const out = await html({ blockType: 'videoEmbed', url: 'https://youtu.be/dQw4w9WgXcQ', heading: 'Tanıtım', poster: img('poster') })
    expect(out).not.toContain('<iframe')
    expect(out).not.toContain('youtube')
    expect(out).toContain('<button')
    expect(out).toContain('aria-label="playVideo: Tanıtım"')
    expect(out).toContain('poster.png')
    expect(out).toContain('aspect-video')
  })
  it('click URL is nocookie / dnt, autoplay, and inside the CSP frame-src allowlist', () => {
    expect(autoplayUrl('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0')
    const vimeo = autoplayUrl('https://player.vimeo.com/video/123456789?dnt=1')
    expect(vimeo).toContain('dnt=1')
    expect(vimeo).toContain('autoplay=1')
    for (const url of [autoplayUrl('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'), vimeo]) {
      const origin = new URL(url!).origin
      expect(csp().split(';').find((d) => d.trim().startsWith('frame-src'))).toContain(origin)
    }
  })
  it('renders nothing for non-YouTube/Vimeo URLs', async () => {
    expect(await html({ blockType: 'videoEmbed', url: 'https://evil.example/embed/x' })).toBe('')
  })
  it('facade with a pre-click state never contains an iframe', () => {
    expect(renderToStaticMarkup(<VideoFacade embedUrl="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" title="t" playLabel="Oynat" />)).not.toContain('iframe')
  })
  it('rejects unsafe facade URLs and rebuilds parameters from the canonical provider URL', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,evil', 'https://evil.test/embed/dQw4w9WgXcQ']) {
      expect(autoplayUrl(url)).toBeNull()
      expect(renderToStaticMarkup(<VideoFacade embedUrl={url} title="t" playLabel="Oynat" />)).toBe('')
    }
    expect(autoplayUrl('https://player.vimeo.com/video/123456789?dnt=0&url=https://evil.test'))
      .toBe('https://player.vimeo.com/video/123456789?dnt=1&autoplay=1')
  })
})

describe('hero mediaBackground + video', () => {
  const base = { blockType: 'hero', id: 'h', variant: 'mediaBackground', heading: 'Başlık', media: img('poster'), video: { url: '/api/media/file/loop.mp4', mimeType: 'video/mp4', protected: false, visibility: 'public' } }
  it('server markup is the poster only: LCP image prioritized, no <video>, no video URL', () => {
    const out = renderToStaticMarkup(
      <RenderBlocks blocks={[base as unknown as LayoutBlock]} locale="tr" firstHeroH1 />,
    )
    expect(out).toContain('poster.png')
    expect(out).toContain('rel="preload" as="image" href="/api/media/file/poster.png"')
    expect(out).not.toContain('loading="lazy"')
    expect(out).toContain('<h1')
    expect(out).not.toContain('<video')
    expect(out).not.toContain('loop.mp4')
  })
  it('without a poster it falls back to the glow background', () => {
    const [planned] = planBlocks([{ ...base, media: null } as unknown as LayoutBlock])
    const out = renderToStaticMarkup(HeroBlock({ block: planned.block as never, locale: 'tr', ctx: planned.ctx }) as never)
    expect(out).toContain('bg-glow')
    expect(out).not.toContain('loop.mp4')
  })
  it('video loads only on wide viewports with motion allowed and data saver off', () => {
    const ok = { wide: true, reducedMotion: false }
    expect(shouldLoadHeroVideo(ok)).toBe(true)
    expect(shouldLoadHeroVideo({ ...ok, wide: false })).toBe(false)
    expect(shouldLoadHeroVideo({ ...ok, reducedMotion: true })).toBe(false)
    expect(shouldLoadHeroVideo({ ...ok, saveData: true })).toBe(false)
    expect(shouldLoadHeroVideo({ ...ok, motionOff: true })).toBe(false)
  })
  it('HeroVideo island renders nothing before hydration', () => {
    expect(renderToStaticMarkup(<HeroVideo src="/x.mp4" />)).toBe('')
  })
})
