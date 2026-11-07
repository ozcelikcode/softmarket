'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

import { startMotion } from '@/lib/motion'

/** Single scroll-reveal observer for the whole site. Renders nothing; rescans on client navigation. */
export function MotionObserver() {
  const pathname = usePathname()
  const search = useSearchParams().toString()
  useEffect(
    () =>
      startMotion({
        doc: document,
        innerHeight: window.innerHeight,
        reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true,
        IntersectionObserver: window.IntersectionObserver,
      }),
    [pathname, search],
  )
  return null
}
