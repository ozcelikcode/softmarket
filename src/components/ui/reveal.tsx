'use client'

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'

/** Progressive enhancement: visible without JS and when reduced motion is requested. */
export function Reveal({ children, delay = 0, y = 16, className }: {
  children: ReactNode; delay?: number; y?: number; className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Already visible content (including the hero) must never flash to hidden on hydration.
    if (node.getBoundingClientRect().top < window.innerHeight * 0.9) return
    node.dataset.reveal = 'pending'
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        node.dataset.reveal = 'visible'
        observer.disconnect()
      }
    }, { rootMargin: '0px 0px -10% 0px' })
    observer.observe(node)
    return () => { observer.disconnect(); delete node.dataset.reveal }
  }, [])
  return <div ref={ref} className={className} style={{ '--reveal-y': `${y}px`, '--reveal-delay': `${delay}s` } as CSSProperties}>{children}</div>
}
