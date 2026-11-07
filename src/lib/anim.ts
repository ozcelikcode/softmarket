import type { CSSProperties } from 'react'

export type AnimKind = 'subtle' | 'none'
export const MAX_STAGGER_STEPS = 4

/**
 * Server-side props for a scroll-reveal element. Markup carries no hidden state:
 * MotionObserver (client) hides off-screen `[data-anim]` elements only after hydration.
 * `index` staggers siblings (clamped, so the total stays <= 240 ms).
 */
export function anim(index = 0, kind: AnimKind = 'subtle'): { 'data-anim'?: 'subtle'; style?: CSSProperties } {
  if (kind === 'none') return {}
  const step = Math.min(Math.max(Math.trunc(index) || 0, 0), MAX_STAGGER_STEPS)
  return { 'data-anim': 'subtle', style: { '--i': step } as CSSProperties }
}

/** Hero micro animation (pure CSS keyframes). `fade` fades; `slide` only translates (LCP-safe). */
export function heroIn(index: number, mode: 'fade' | 'slide' = 'fade'): { 'data-hero-in': 'fade' | 'slide'; style: CSSProperties } {
  return { 'data-hero-in': mode, style: { '--i': index } as CSSProperties }
}
