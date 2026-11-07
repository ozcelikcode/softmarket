import { describe, expect, it } from 'vitest'

import { motionDisabled, startMotion } from '@/lib/motion'

type El = { top: number; dataset: Record<string, string>; getBoundingClientRect: () => { top: number } }
const el = (top: number): El => ({ top, dataset: {}, getBoundingClientRect: () => ({ top }) })

function setup(opts: { reduced?: boolean; motion?: string; tops: number[] }) {
  const nodes = opts.tops.map(el)
  let created = 0
  let callback: (e: { isIntersecting: boolean; target: El }[]) => void = () => {}
  const unobserved: El[] = []
  class FakeIO {
    constructor(cb: typeof callback) { created++; callback = cb }
    observe() {}
    unobserve(n: El) { unobserved.push(n) }
    disconnect() {}
  }
  const env = {
    doc: { querySelectorAll: () => nodes, documentElement: { dataset: { motion: opts.motion } } },
    innerHeight: 800,
    reducedMotion: Boolean(opts.reduced),
    IntersectionObserver: FakeIO,
  } as unknown as Parameters<typeof startMotion>[0]
  return { nodes, env, fire: (n: El) => callback([{ isIntersecting: true, target: n }]), created: () => created, unobserved }
}

describe('MotionObserver core', () => {
  it('hides only off-screen elements and reveals each once with a single observer', () => {
    const t = setup({ tops: [100, 700, 1500, 2400] })
    startMotion(t.env)
    expect(t.created()).toBe(1)
    expect(t.nodes[0].dataset.animState).toBeUndefined()
    expect(t.nodes[1].dataset.animState).toBeUndefined()
    expect(t.nodes[2].dataset.animState).toBe('pending')
    t.fire(t.nodes[2])
    expect(t.nodes[2].dataset.animState).toBe('visible')
    expect(t.unobserved).toContain(t.nodes[2])
    expect(t.nodes[3].dataset.animState).toBe('pending')
  })
  it('cleanup leaves nothing hidden', () => {
    const t = setup({ tops: [1500, 2400] })
    startMotion(t.env)()
    expect(t.nodes.map((n) => n.dataset.animState)).toEqual(['visible', 'visible'])
  })
  it('does nothing under prefers-reduced-motion', () => {
    const t = setup({ reduced: true, tops: [1500] })
    startMotion(t.env)
    expect(t.created()).toBe(0)
    expect(t.nodes[0].dataset.animState).toBeUndefined()
  })
  it('does nothing when html[data-motion=none]', () => {
    const t = setup({ motion: 'none', tops: [1500] })
    expect(motionDisabled(t.env)).toBe(true)
    startMotion(t.env)
    expect(t.nodes[0].dataset.animState).toBeUndefined()
  })
  it('does nothing without IntersectionObserver', () => {
    const t = setup({ tops: [1500] })
    startMotion({ ...t.env, IntersectionObserver: undefined })
    expect(t.nodes[0].dataset.animState).toBeUndefined()
  })
  it('fails open and disconnects if observing a node throws', () => {
    const t = setup({ tops: [1500, 2400] })
    let disconnected = false
    class BrokenIO {
      observe() { throw new Error('Observer failed') }
      disconnect() { disconnected = true }
    }
    expect(() => startMotion({ ...t.env, IntersectionObserver: BrokenIO as unknown as typeof IntersectionObserver })).not.toThrow()
    expect(t.nodes.every((n) => n.dataset.animState !== 'pending')).toBe(true)
    expect(disconnected).toBe(true)
  })
  it('reveals all pending nodes if an observer callback fails', () => {
    const t = setup({ tops: [1500, 2400] })
    const Base = t.env.IntersectionObserver!
    class BrokenIO extends Base {
      unobserve() { throw new Error('Observer failed') }
    }
    startMotion({ ...t.env, IntersectionObserver: BrokenIO })
    expect(() => t.fire(t.nodes[0])).not.toThrow()
    expect(t.nodes.every((n) => n.dataset.animState !== 'pending')).toBe(true)
  })
})
