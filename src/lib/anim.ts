import type { CSSProperties } from 'react'

import {
  MOTION_DURATION_MS,
  MOTION_EASING_VAR,
  MOTION_LEGACY,
  MOTION_NONE,
  MOTION_STAGGER_MS,
  maxStaggerSteps,
  type MotionEffect,
  type ResolvedMotion,
} from '@/fields/block-motion'

export type AnimKind = 'subtle' | 'none'
export const MAX_STAGGER_STEPS = 4

/** `data-*` attributes + CSS variables for one animated element (server markup; never a hidden state). */
export type AnimProps = {
  'data-anim'?: MotionEffect
  'data-anim-trigger'?: 'scroll-progress' | 'load' | 'hover'
  'data-anim-safe'?: ''
  'data-anim-mobile'?: ''
  style?: CSSProperties
}

/** Horizontal movement can overflow the viewport: the section clips x overflow for these. */
export const clipsX = (motion: ResolvedMotion) =>
  motion.preset === 'slide-left' || motion.preset === 'slide-right' || motion.preset === 'parallax-soft'

/**
 * Server-side props for an animated element (V1 CSS contract, `globals.css` "Motion system").
 *
 * - `data-anim="<effect>"`: `subtle` (legacy/`auto`), `fade`, `slide-*`, `zoom-in`, `parallax-soft`, `stagger`.
 * - `data-anim-trigger`: omitted for `scroll` (the single MotionObserver reveals it once); `load` = CSS keyframe,
 *   `scroll-progress` = CSS scroll-driven (`@supports`), `hover` = transform on hover/focus. Parallax is
 *   always `scroll-progress`. The observer ignores elements with a trigger.
 * - `data-anim-safe`: LCP protection, never starts below full opacity. `data-anim-mobile`: parallax < 768 px.
 * - `style`: `--i` stagger step, plus `--anim-dur|delay|ease|stagger` only when they differ from the defaults,
 *   so the default (`auto`) markup is byte-identical to the pre-V1 `{ data-anim: subtle, --i }`.
 *
 * `mode: 'container'` + `stagger` staggers the container's children; on items `stagger` is a slide-up
 * whose interval is at least `tight`. Markup carries no hidden state: JS-less and SSR content is visible.
 */
export function anim(index = 0, motion: AnimKind | ResolvedMotion = 'subtle', mode: 'item' | 'container' = 'item'): AnimProps {
  const m = typeof motion === 'string' ? (motion === 'none' ? MOTION_NONE : MOTION_LEGACY) : motion
  if (m.preset === 'none') return {}
  const itemStagger = m.preset === 'stagger' && mode === 'item'
  const effect: MotionEffect = itemStagger ? 'slide-up' : m.preset
  const stagger = itemStagger && m.stagger === 'none' ? 'tight' : m.stagger
  const steps = maxStaggerSteps(stagger)
  const step = Math.min(Math.max(Math.trunc(index) || 0, 0), steps || MAX_STAGGER_STEPS)
  const trigger = m.preset === 'parallax-soft' ? 'scroll-progress' : m.trigger === 'scroll' ? undefined : m.trigger
  const style: Record<string, string | number> = { '--i': step }
  if (m.duration !== 'base') style['--anim-dur'] = `${MOTION_DURATION_MS[m.duration]}ms`
  if (m.delay !== '0') style['--anim-delay'] = `${m.delay}ms`
  if (m.easing !== 'soft') style['--anim-ease'] = MOTION_EASING_VAR[m.easing]
  if (stagger !== 'tight') style['--anim-stagger'] = `${MOTION_STAGGER_MS[stagger]}ms`
  return {
    'data-anim': effect,
    ...(trigger ? { 'data-anim-trigger': trigger } : {}),
    ...(m.safe ? { 'data-anim-safe': '' as const } : {}),
    ...(m.mobile && m.preset === 'parallax-soft' ? { 'data-anim-mobile': '' as const } : {}),
    style: style as CSSProperties,
  }
}

/** Hero micro animation (pure CSS keyframes). `fade` fades; `slide` only translates (LCP-safe). */
export function heroIn(index: number, mode: 'fade' | 'slide' = 'fade'): { 'data-hero-in': 'fade' | 'slide'; style: CSSProperties } {
  return { 'data-hero-in': mode, style: { '--i': index } as CSSProperties }
}

const HERO_SHIFT: Partial<Record<MotionEffect, [x: string, y: string]>> = {
  'slide-up': ['0px', '16px'],
  'slide-down': ['0px', '-16px'],
  'slide-left': ['24px', '0px'],
  'slide-right': ['-24px', '0px'],
}

/**
 * Hero entrance for a resolved motion (hero is always LCP-protected, so it only ever translates the
 * heading/lead). Returns `null` when the hero must not animate; otherwise a factory for `heroIn` props
 * carrying the editor's direction/duration/delay/easing. `auto` returns the exact pre-V1 props. The hero
 * entrance always plays on load (its trigger is not used); `parallax-soft` moves the hero media instead.
 */
export function heroMotion(motion: ResolvedMotion): ((i: number, mode?: 'fade' | 'slide') => ReturnType<typeof heroIn>) | null {
  if (motion.preset === 'none') return null
  const extra: Record<string, string> = {}
  const shift = HERO_SHIFT[motion.preset]
  if (shift) {
    extra['--hero-dx'] = shift[0]
    extra['--hero-dy'] = shift[1]
  }
  if (motion.duration !== 'base') extra['--anim-dur'] = `${MOTION_DURATION_MS[motion.duration]}ms`
  if (motion.delay !== '0') extra['--anim-delay'] = `${motion.delay}ms`
  if (motion.easing !== 'soft') extra['--anim-ease'] = MOTION_EASING_VAR[motion.easing]
  if (!Object.keys(extra).length) return (i, mode) => heroIn(i, mode)
  return (i, mode) => {
    const props = heroIn(i, mode)
    return { ...props, style: { ...props.style, ...extra } as CSSProperties }
  }
}
