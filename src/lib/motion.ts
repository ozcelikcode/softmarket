/** Scroll-reveal core: one IntersectionObserver for every `[data-anim]` element. Framework-free and testable. */

export type MotionEnv = {
  doc: Pick<Document, 'querySelectorAll' | 'documentElement'>
  innerHeight: number
  reducedMotion: boolean
  IntersectionObserver?: typeof IntersectionObserver
}

const VISIBLE_FRACTION = 0.92

export function motionDisabled(env: Pick<MotionEnv, 'doc' | 'reducedMotion'>) {
  return env.reducedMotion || env.doc.documentElement.dataset.motion === 'none'
}

/**
 * Hides off-screen `[data-anim]` elements (data-anim-state="pending") and reveals each once when it enters
 * the viewport. Elements already on screen are left untouched, so above-the-fold content never flashes.
 * Returns a cleanup that makes any still-pending element visible.
 */
export function startMotion(env: MotionEnv): () => void {
  if (!env.IntersectionObserver || motionDisabled(env)) return () => {}
  const nodes = Array.from(env.doc.querySelectorAll<HTMLElement>('[data-anim]:not([data-anim-state])'))
  const pending = new Set<HTMLElement>()
  let observer: IntersectionObserver | undefined
  const cleanup = () => {
    // Restore visibility even if an observer/polyfill fails while disconnecting.
    for (const el of pending) el.dataset.animState = 'visible'
    pending.clear()
    try { observer?.disconnect() } catch { /* Animation is optional. */ }
  }
  try {
    observer = new env.IntersectionObserver(
      (entries) => {
        try {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue
            const el = entry.target as HTMLElement
            el.dataset.animState = 'visible'
            pending.delete(el)
            observer?.unobserve(el)
          }
        } catch { cleanup() }
      },
      { rootMargin: `0px 0px -${Math.round((1 - VISIBLE_FRACTION) * 100)}% 0px` },
    )
    for (const el of nodes) {
      if (el.getBoundingClientRect().top < env.innerHeight * VISIBLE_FRACTION) continue
      el.dataset.animState = 'pending'
      pending.add(el)
      observer.observe(el)
    }
  } catch { cleanup() }
  return cleanup
}
