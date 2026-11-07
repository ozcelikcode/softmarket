'use client'

import { useEffect, useRef, useState } from 'react'

import { shouldLoadHeroVideo } from '@/lib/blocks/static'

/**
 * Optional silent looping background video. Renders nothing on the server and never mounts a <video>
 * (so no video request) unless the viewport is >= 768px, reduced motion and data saver are off. The server
 * poster underneath stays the LCP image and is what mobile / reduced-motion visitors see.
 */
export function HeroVideo({ src }: { src: string }) {
  const [enabled, setEnabled] = useState(false)
  const [ready, setReady] = useState(false)
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 768px)')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    const evaluate = () =>
      setEnabled(shouldLoadHeroVideo({
        wide: wide.matches,
        reducedMotion: reduced.matches,
        saveData: connection?.saveData,
        motionOff: document.documentElement.dataset.motion === 'none',
      }))
    evaluate()
    wide.addEventListener('change', evaluate)
    reduced.addEventListener('change', evaluate)
    return () => {
      wide.removeEventListener('change', evaluate)
      reduced.removeEventListener('change', evaluate)
    }
  }, [])
  useEffect(() => {
    const el = ref.current
    if (!enabled || !el || !window.IntersectionObserver) return
    // Play only while on screen; pausing off-screen saves CPU/battery.
    const io = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) void el.play().catch(() => {})
      else el.pause()
    })
    io.observe(el)
    return () => io.disconnect()
  }, [enabled])
  if (!enabled) return null
  return (
    <video
      ref={ref}
      src={src}
      muted
      loop
      playsInline
      preload="none"
      autoPlay
      aria-hidden
      tabIndex={-1}
      onPlaying={() => setReady(true)}
      className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'}`}
    />
  )
}
