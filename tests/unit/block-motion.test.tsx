import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Block, Field } from 'payload'
import { parse, type Node } from 'postcss'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { layoutBlocks, pageBlocks } from '@/blocks'
import { BlockShell } from '@/components/blocks/block-shell'
import type { LayoutBlock } from '@/components/blocks/types'
import {
  HERO_PRESETS, HIDING_PRESETS, MOTION_DEFAULTS, MOTION_DELAYS, MOTION_DURATIONS, MOTION_EASINGS, MOTION_PRESETS, MOTION_STAGGERS,
  MOTION_TRIGGERS, motionEnumName, resolveMotion, validateHeroPreset, type ResolvedMotion,
} from '@/fields/block-motion'
import { resolveAppearance } from '@/fields/block-settings'
import { MOTION_LABELS } from '@/lib/admin-i18n'
import { anim, heroIn, heroMotion } from '@/lib/anim'
import { planBlocks } from '@/lib/blocks/render-plan'
import { OBSERVED } from '@/lib/motion'

/*
 * V1 motion presets (plan-visual-editor §V1): field model, preset -> data-attr/CSS mapping, LCP protection,
 * reduced-motion / data-motion=none precedence, JS-less visibility and legacy (`auto`) compatibility.
 */

const CSS = readFileSync(join(process.cwd(), 'src/app/(frontend)/globals.css'), 'utf8')
const MOTION_CSS = CSS.slice(CSS.indexOf('Motion system'))
const block = (blockType: string, motion: Record<string, unknown> = {}, appearance: Record<string, unknown> = {}) =>
  ({ blockType, id: `${blockType}-${JSON.stringify(motion)}`, motion, appearance,
    ...(blockType === 'richText' ? { content: { root: { children: [{ type: 'text', text: 'Content' }] } } } : {}),
  }) as unknown as LayoutBlock
const motionOf = (b: Block) => {
  const collapsible = b.fields.find((f): f is Extract<Field, { type: 'collapsible' }> => f.type === 'collapsible' && (f.label as { tr: string }).tr === 'Hareket')
  if (!collapsible) return undefined
  const group = collapsible.fields[0] as Extract<Field, { type: 'group' }>
  const flat = (fields: Field[]): Field[] => fields.flatMap((f) => (f.type === 'row' || f.type === 'collapsible' ? flat(f.fields) : [f]))
  return { collapsible, group, fields: Object.fromEntries(flat(group.fields).map((f) => [(f as { name: string }).name, f as Field & { defaultValue?: unknown; options?: { value: string }[] }])) }
}
const shell = (motion: ResolvedMotion, animate: 'container' | 'items' | 'none' = 'container') =>
  renderToStaticMarkup(
    <BlockShell blockType="faq" appearance={resolveAppearance({ blockType: 'faq' })} motion={motion} animate={animate}>
      <p>bir</p><p>iki</p>
    </BlockShell>,
  )
const EFFECTS = MOTION_PRESETS.filter((p) => p !== 'auto' && p !== 'none')

describe('motion field model', () => {
  it('adds a collapsed "Hareket" group next to "Görünüm" on every content block (not spacer/divider/listing)', () => {
    const withMotion = pageBlocks.filter((b) => motionOf(b)).map((b) => b.slug).sort()
    expect(withMotion).toEqual(pageBlocks.map((b) => b.slug).filter((s) => !['spacer', 'divider', 'listing'].includes(s)).sort())
    for (const b of layoutBlocks.filter((x) => motionOf(x))) {
      const m = motionOf(b)!
      expect(m.collapsible.admin?.initCollapsed).toBe(true)
      expect((m.group as { name?: string }).name).toBe('motion')
      const labels = b.fields.filter((f) => f.type === 'collapsible').map((f) => (f.label as { tr: string }).tr)
      expect(labels.indexOf('Hareket')).toBe(labels.indexOf('Görünüm') + 1)
      for (const [name, value] of Object.entries(MOTION_DEFAULTS)) expect(m.fields[name].defaultValue, `${b.slug}.${name}`).toBe(value)
      // Every block (hero included) stores the full option list: the hero rule is validation, not schema.
      expect(m.fields.preset.options!.map((o) => o.value)).toEqual([...MOTION_PRESETS])
      expect(m.fields.trigger.options!.map((o) => o.value)).toEqual([...MOTION_TRIGGERS])
      expect(m.fields.duration.options!.map((o) => o.value)).toEqual([...MOTION_DURATIONS])
      expect(m.fields.delay.options!.map((o) => o.value)).toEqual([...MOTION_DELAYS])
      expect(m.fields.easing.options!.map((o) => o.value)).toEqual([...MOTION_EASINGS])
      expect(m.fields.stagger.options!.map((o) => o.value)).toEqual([...MOTION_STAGGERS])
      expect((m.fields.preset.admin as { components?: { Field?: string } }).components?.Field).toBe('@/admin/fields/motion-preset-cards#MotionPresetCards')
    }
  })

  it('keeps the legacy appearance.animation field untouched', () => {
    for (const b of layoutBlocks) {
      const collapsible = b.fields.find((f): f is Extract<Field, { type: 'collapsible' }> => f.type === 'collapsible')!
      const group = collapsible.fields[0] as Extract<Field, { type: 'group' }>
      const row = group.fields[0] as Extract<Field, { type: 'row' }>
      const animation = row.fields.find((f) => (f as { name?: string }).name === 'animation') as { options: { value: string }[]; defaultValue: string }
      expect(animation.options.map((o) => o.value)).toEqual(['subtle', 'none'])
      expect(animation.defaultValue).toBe('subtle')
    }
  })

  it('offers only LCP-safe cards on hero and rejects hiding presets server-side', () => {
    const hero = motionOf(layoutBlocks.find((b) => b.slug === 'hero')!)!
    expect((hero.fields.preset.admin as { custom?: { presets?: string[] } }).custom?.presets).toEqual([...HERO_PRESETS])
    for (const p of HIDING_PRESETS) expect(HERO_PRESETS).not.toContain(p)
    const validate = validateHeroPreset as unknown as (v: unknown, o: unknown) => unknown
    for (const p of HERO_PRESETS) expect(validate(p, { req: {} })).toBe(true)
    expect(validate('fade', { req: {} })).toMatch(/Hero/)
    expect(validate('zoom-in', { req: { i18n: { language: 'en' } } })).toMatch(/hero block/)
  })

  it('has TR/EN labels for every preset and option in the admin dictionary', () => {
    for (const p of MOTION_PRESETS) for (const l of MOTION_LABELS.presets[p]) expect(l.tr && l.en).toBeTruthy()
    for (const t of MOTION_TRIGGERS) expect(MOTION_LABELS.triggers[t].tr).toBeTruthy()
  })

  it('keeps enum names within the 63 character identifier limit', () => {
    const long = '_case_studies_v_blocks_product_showcase'
    for (const key of ['preset', 'trigger', 'duration', 'delay', 'easing', 'stagger']) {
      expect(motionEnumName(key)({ tableName: 'pages_blocks_hero' })).toBe(`enum_pages_blocks_hero_motion_${key}`)
      expect(motionEnumName(key)({ tableName: long }).length).toBeLessThanOrEqual(63)
    }
  })
})

describe('resolveMotion (priority chain + legacy compatibility)', () => {
  it('maps missing/auto/invalid values to the pre-V1 subtle reveal', () => {
    const legacy = { preset: 'subtle', trigger: 'scroll', duration: 'base', delay: '0', easing: 'soft', stagger: 'tight', mobile: false, safe: false }
    expect(resolveMotion({ blockType: 'faq' })).toEqual(legacy)
    expect(resolveMotion({ blockType: 'faq', motion: { preset: 'auto' } })).toEqual(legacy)
    expect(resolveMotion({ blockType: 'faq', motion: { preset: 'bounce', trigger: 'x', duration: '9s', delay: '5000', easing: 'y', stagger: 'z' } })).toEqual(legacy)
  })

  it('appearance.animation none wins over any motion preset', () => {
    for (const preset of MOTION_PRESETS) expect(resolveMotion({ blockType: 'faq', appearance: { animation: 'none' }, motion: { preset } }).preset).toBe('none')
    expect(anim(0, resolveMotion({ blockType: 'faq', appearance: { animation: 'none' }, motion: { preset: 'zoom-in' } }))).toEqual({})
  })

  it('legacy appearance values render the same markup as before V1', () => {
    for (const i of [0, 1, 2, 3, 4, 7]) {
      expect(anim(i, resolveMotion({ blockType: 'faq', appearance: { animation: 'subtle' } }))).toEqual(anim(i, 'subtle'))
      expect(anim(i, 'subtle')).toEqual({ 'data-anim': 'subtle', style: { '--i': Math.min(i, 4) } })
    }
    expect(anim(0, 'none')).toEqual({})
    expect(shell(resolveMotion({ blockType: 'faq' }))).toBe(
      renderToStaticMarkup(
        <BlockShell blockType="faq" appearance={resolveAppearance({ blockType: 'faq' })}><p>bir</p><p>iki</p></BlockShell>,
      ),
    )
  })
})

describe('preset -> data attributes / CSS variables', () => {
  it('never passes untrusted motion values into CSS variables', () => {
    for (const value of ['url(https://example.test/x)', '1ms; color:red', '__proto__', 'constructor', '999999', {}, null]) {
      const m = resolveMotion(block('faq', Object.fromEntries(['preset', 'trigger', 'duration', 'delay', 'easing', 'stagger', 'mobile'].map((key) => [key, value]))))
      expect(anim(0, m)).toEqual(anim(0, 'subtle'))
    }
  })
  it('maps every effect to data-anim and every trigger to data-anim-trigger', () => {
    for (const preset of EFFECTS) {
      for (const trigger of MOTION_TRIGGERS) {
        const props = anim(1, resolveMotion({ blockType: 'faq', motion: { preset, trigger } }))
        const expected = preset === 'stagger' ? 'slide-up' : preset
        expect(props['data-anim'], `${preset}/${trigger}`).toBe(expected)
        const t = preset === 'parallax-soft' ? 'scroll-progress' : trigger === 'scroll' ? undefined : trigger
        expect(props['data-anim-trigger'], `${preset}/${trigger}`).toBe(t)
        expect(props['data-anim-safe']).toBeUndefined()
      }
    }
    expect(anim(0, resolveMotion({ blockType: 'faq', motion: { preset: 'stagger' } }), 'container')['data-anim']).toBe('stagger')
  })

  it('emits only non-default timing variables', () => {
    const m = resolveMotion({ blockType: 'faq', motion: { preset: 'fade', duration: 'slow', delay: '200', easing: 'emphasized', stagger: 'relaxed' } })
    expect(anim(2, m).style).toEqual({ '--i': 2, '--anim-dur': '800ms', '--anim-delay': '200ms', '--anim-ease': 'var(--ease-emphasized)', '--anim-stagger': '100ms' })
    expect(anim(2, resolveMotion({ blockType: 'faq', motion: { preset: 'fade', duration: 'fast' } })).style).toEqual({ '--i': 2, '--anim-dur': '240ms' })
  })

  it('caps stagger at 4 steps and 300 ms in total', () => {
    for (const stagger of MOTION_STAGGERS) {
      const m = resolveMotion({ blockType: 'faq', motion: { preset: 'slide-up', stagger } })
      const ms = { none: 0, tight: 60, relaxed: 100 }[stagger]
      const steps = Math.max(...[0, 1, 2, 3, 4, 5, 9].map((i) => Number((anim(i, m).style as Record<string, number>)['--i'])))
      expect(steps).toBeLessThanOrEqual(4)
      expect(steps * ms).toBeLessThanOrEqual(300)
    }
    // `stagger` on items always staggers, at least `tight`.
    const items = anim(1, resolveMotion({ blockType: 'faq', motion: { preset: 'stagger', stagger: 'none' } }))
    expect(items.style).toEqual({ '--i': 1 })
  })

  it('marks parallax for mobile only when asked; horizontal presets clip the section', () => {
    expect(anim(0, resolveMotion({ blockType: 'faq', motion: { preset: 'parallax-soft', mobile: true } }))['data-anim-mobile']).toBe('')
    expect(anim(0, resolveMotion({ blockType: 'faq', motion: { preset: 'parallax-soft' } }))['data-anim-mobile']).toBeUndefined()
    expect(anim(0, resolveMotion({ blockType: 'faq', motion: { preset: 'fade', mobile: true } }))['data-anim-mobile']).toBeUndefined()
    expect(shell(resolveMotion({ blockType: 'faq', motion: { preset: 'slide-left' } }))).toContain('overflow-x-clip')
    expect(shell(resolveMotion({ blockType: 'faq', motion: { preset: 'slide-up' } }))).not.toContain('overflow-x-clip')
  })

  it('defines a start state for every effect in globals.css using only opacity/transform', () => {
    const lines = MOTION_CSS.split('\n')
    for (const effect of EFFECTS.filter((e) => e !== 'parallax-soft'))
      expect(lines.some((l) => l.includes(`[data-anim="${effect}"]`) && l.includes('--m-from:')), effect).toBe(true)
    expect(MOTION_CSS).toMatch(/\[data-anim="fade"\]\) \{ --m-from: none/)
    expect(MOTION_CSS).toContain('[data-anim="parallax-soft"]')
    for (const trigger of ['load', 'hover', 'scroll-progress']) expect(MOTION_CSS).toContain(`[data-anim-trigger="${trigger}"]`)
    // Keyframes and transitions only touch opacity/transform.
    for (const [, body] of MOTION_CSS.matchAll(/@keyframes [\w-]+ \{([^@]*?)\}\s*\n/g)) {
      const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1])
      expect(props.every((p) => p === 'opacity' || p === 'transform'), body).toBe(true)
    }
    for (const [, value] of MOTION_CSS.matchAll(/transition:\s*([^;]+);/g)) {
      const parts: string[] = ['']
      let depth = 0
      for (const ch of value) {
        depth += ch === '(' ? 1 : ch === ')' ? -1 : 0
        if (ch === ',' && depth === 0) parts.push('')
        else parts[parts.length - 1] += ch
      }
      const animated = parts.map((part) => part.trim().split(/\s+/)[0])
      expect(animated.every((p) => ['opacity', 'transform', 'border-color', 'background-color', 'none'].includes(p)), value).toBe(true)
    }
    expect(MOTION_CSS).not.toMatch(/(filter|box-shadow|backdrop-filter|width|height|top|left|margin)\s+var\(--(anim|dur)/)
  })

  it('scroll-progress and parallax are behind @supports and parallax is desktop-only by default', () => {
    const supports = MOTION_CSS.slice(MOTION_CSS.indexOf('@supports (animation-timeline: view())'))
    expect(supports).toContain('[data-anim-trigger="scroll-progress"]')
    expect(MOTION_CSS.indexOf('animation-timeline: view()')).toBeGreaterThan(MOTION_CSS.indexOf('@supports (animation-timeline: view())'))
    expect(supports).toMatch(/@media \(min-width: 768px\) \{\s*:where\(html:not\(\[data-motion="none"\]\)\) :where\(\[data-anim="parallax-soft"\]\)/)
    expect(supports).toContain('[data-anim="parallax-soft"][data-anim-mobile]')
  })

  it('gates scroll timelines on range support and finishes short blocks at full entry', () => {
    const ranges: string[] = []
    parse(CSS).walkAtRules('supports', (rule) => {
      if (!rule.params.includes('animation-timeline')) return
      expect(rule.params).toContain('and (animation-range: entry 0% entry 100%)')
      rule.walkDecls('animation-range', (decl) => { ranges.push(decl.value) })
    })
    expect(ranges).toContain('entry 0% entry 100%')
    expect(ranges).not.toContain('entry 0% entry 280px')
  })

  it('keeps hover keyboard focus outside the hover-pointer media condition', () => {
    let found = false
    parse(CSS).walkRules((rule) => {
      if (!rule.selector.includes('[data-anim-trigger="hover"]:focus-within')) return
      found = true
      for (let parent: Node | undefined = rule.parent; parent; parent = parent.parent) {
        if (parent.type === 'atrule') expect(parent.toString().split('{')[0]).not.toContain('(hover: hover)')
      }
    })
    expect(found).toBe(true)
  })
})

describe('reduced motion, data-motion=none and JS-less visibility', () => {
  it('every animating rule sits inside prefers-reduced-motion: no-preference', () => {
    const start = MOTION_CSS.indexOf('@media (prefers-reduced-motion: no-preference)')
    expect(start).toBeGreaterThan(0)
    const before = MOTION_CSS.slice(0, start).replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes [^\n]*\n/g, '')
    // Before the media block only custom properties and keyframes are declared.
    expect(before).not.toMatch(/\b(animation|transition|opacity)\s*:/)
    const after = MOTION_CSS.slice(MOTION_CSS.indexOf('.card-hover {'))
    expect(after).not.toMatch(/animation:\s*(motion|hero)/)
  })

  it('html[data-motion=none] disables load/hover/scroll-progress/parallax and the observer states', () => {
    const gated = MOTION_CSS.match(/:where\(html:not\(\[data-motion="none"\]\)\) :where\(\[data-anim/g) ?? []
    expect(gated.length).toBeGreaterThanOrEqual(6)
    expect(MOTION_CSS).toContain('html[data-motion="none"] [data-anim][data-anim-state]')
    expect(MOTION_CSS).toContain('html[data-motion="none"] [data-anim="stagger"][data-anim-state] > *')
    expect(MOTION_CSS).toContain('html[data-motion="none"] [data-hero-in] { animation: none !important; }')
  })

  it('the observer never hides CSS-triggered elements', () => {
    expect(OBSERVED).toBe('[data-anim]:not([data-anim-state]):not([data-anim-trigger])')
  })

  it('server markup never contains a hidden state for any preset/trigger', () => {
    for (const preset of MOTION_PRESETS) {
      for (const trigger of MOTION_TRIGGERS) {
        for (const animate of ['container', 'items'] as const) {
          const html = shell(resolveMotion({ blockType: 'faq', motion: { preset, trigger } }), animate)
          expect(html).toContain('<p>bir</p>')
          expect(html).not.toMatch(/data-anim-state|opacity|visibility|display:\s*none|scale\(/)
        }
      }
    }
  })
})

describe('LCP protection (render plan)', () => {
  const planned = (blocks: LayoutBlock[]) => planBlocks(blocks, { firstHeroH1: true })

  it('protects content after decorative, missing-slot and potentially empty blocks on every page type', () => {
    for (const firstHeroH1 of [true, false]) {
      for (const preceding of ['spacer', 'divider', 'listing', 'featureGrid', 'faq', 'productShowcase', 'newsList', 'media', 'videoEmbed']) {
        const plan = planBlocks([block(preceding), block('richText', { preset: 'fade', trigger: 'load' })], { firstHeroH1 })
        expect(plan[1].ctx.motion, `${firstHeroH1}/${preceding}`).toMatchObject({ preset: 'slide-up', safe: true })
      }
    }
    for (const root of [
      { children: [] },
      { type: 'text', text: 'Not rendered at root', children: [] },
      { children: [{ type: 'unknown', children: [{ type: 'text', text: 'Not rendered' }] }] },
      { children: [{ type: { toString: null }, children: [{ type: 'text', text: 'Not rendered' }] }] },
    ]) {
      const emptyText = { ...block('richText'), content: { root } } as unknown as LayoutBlock
      const plan = planned([emptyText, block('mediaText'), block('richText', { preset: 'fade', trigger: 'load' })])
      expect(plan[2].ctx.motion).toMatchObject({ preset: 'slide-up', safe: true })
    }
  })

  it('the first visible block and every hero never get an opacity/scale entrance', () => {
    for (const preset of MOTION_PRESETS) {
      for (const trigger of MOTION_TRIGGERS) {
        const plan = planned([
          block('featureGrid', { preset: 'none' }, { hidden: true }),
          block('richText', { preset, trigger }),
          block('faq', { preset, trigger }),
          block('hero', { preset, trigger }),
        ])
        for (const { block: b, ctx } of [plan[0], plan[2]]) {
          const where = `${b.blockType}/${preset}/${trigger}`
          // Hover never hides content (transform on hover only), so it needs no downgrade.
          if (trigger !== 'hover') expect(HIDING_PRESETS, where).not.toContain(ctx.motion.preset)
          const props = anim(0, ctx.motion, 'container')
          if (props['data-anim'] && props['data-anim'] !== 'subtle' && props['data-anim'] !== 'parallax-soft' && props['data-anim-trigger'] !== 'hover')
            expect(props['data-anim-safe'], where).toBe('')
          if (props['data-anim'] === 'subtle' && trigger !== 'hover') expect(trigger === 'scroll' || props['data-anim-safe'] === '', where).toBe(true)
        }
        // The second block is untouched.
        expect(plan[1].ctx.motion.safe).toBe(false)
      }
    }
  })

  it('safe start state keeps full opacity in CSS', () => {
    expect(MOTION_CSS).toContain(':where([data-anim][data-anim-safe]) { --m-o: 1; }')
  })

  it('auto on the first block keeps the pre-V1 markup (observer never hides on-screen content)', () => {
    const [first] = planned([block('faq')])
    expect(anim(0, first.ctx.motion)).toEqual(anim(0, 'subtle'))
  })

  it('hero entrance: heading/lead only slide, timings and direction come from the preset', () => {
    const [hero] = planned([block('hero', { preset: 'slide-left', duration: 'slow', delay: '100' })])
    const enter = heroMotion(hero.ctx.motion)!
    expect(enter(1, 'slide')).toEqual({ 'data-hero-in': 'slide', style: { '--i': 1, '--hero-dx': '24px', '--hero-dy': '0px', '--anim-dur': '800ms', '--anim-delay': '100ms' } })
    const [auto] = planned([block('hero')])
    expect(heroMotion(auto.ctx.motion)!(1, 'slide')).toEqual(heroIn(1, 'slide'))
    expect(heroMotion(planned([block('hero', { preset: 'none' })])[0].ctx.motion)).toBeNull()
    expect(heroMotion(planned([block('hero', {}, { animation: 'none' })])[0].ctx.motion)).toBeNull()
    const slide = MOTION_CSS.match(/@keyframes hero-slide \{([^\n]*)\}/)![1]
    expect(slide).not.toContain('opacity')
  })
})

describe('admin preset cards stay out of the public bundle', () => {
  it('only the Payload import map references src/admin', async () => {
    const { readdirSync, statSync } = await import('node:fs')
    const src = join(process.cwd(), 'src')
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
      const p = join(dir, n)
      return statSync(p).isDirectory() ? (n === '(payload)' || n === 'admin' ? [] : walk(p)) : /\.tsx?$/.test(n) ? [p] : []
    })
    const offenders = walk(src).filter((p) => /from ['"](@\/admin\/|\.\.?\/.*admin\/fields)/.test(readFileSync(p, 'utf8')))
    expect(offenders).toEqual([])
    const card = readFileSync(join(src, 'admin/fields/motion-preset-cards.tsx'), 'utf8')
    expect(card).toMatch(/^'use client'/)
    expect(card).not.toMatch(/from ['"]@\/components\//)
  })
})
