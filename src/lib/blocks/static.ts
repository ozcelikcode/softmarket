import { toEmbedUrl } from '@/lib/video'

/** Pure helpers for the F4 static blocks (media, tabs, video facade, hero video, spacer). No React, no I/O. */

/** `media` block aspect value -> Tailwind class. `auto` keeps the image's own ratio (no crop). */
export const ASPECT_CLASS: Record<string, string> = {
  '16-9': 'aspect-video',
  '4-3': 'aspect-[4/3]',
  '1-1': 'aspect-square',
  '21-9': 'aspect-[21/9]',
}
export const aspectClass = (value: unknown): string | undefined =>
  typeof value === 'string' && Object.hasOwn(ASPECT_CLASS, value) ? ASPECT_CLASS[value] : undefined

/** Spacer heights (fixed, responsive). Unknown -> md. */
const SPACER_HEIGHT: Record<string, string> = {
  sm: 'h-8 sm:h-10',
  md: 'h-12 sm:h-16',
  lg: 'h-20 sm:h-28',
  xl: 'h-32 sm:h-44',
}
export const spacerClass = (value: unknown): string =>
  typeof value === 'string' && Object.hasOwn(SPACER_HEIGHT, value) ? SPACER_HEIGHT[value] : SPACER_HEIGHT.md

/**
 * WAI-ARIA tabs keyboard model (automatic activation): arrows wrap, Home/End jump.
 * Returns the index to focus/select, or null when the key is not handled.
 */
export function nextTabIndex(key: string, current: number, count: number): number | null {
  if (count < 1) return null
  switch (key) {
    case 'ArrowRight':
      return (current + 1) % count
    case 'ArrowLeft':
      return (current - 1 + count) % count
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}

/** Iframe URL used only after the visitor clicks play (embed URL from `toEmbedUrl`, host already allow-listed). */
export function autoplayUrl(embedUrl: string): string | null {
  const canonical = toEmbedUrl(embedUrl)
  if (!canonical) return null
  const url = new URL(canonical)
  url.searchParams.set('autoplay', '1')
  if (url.hostname === 'www.youtube-nocookie.com') url.searchParams.set('rel', '0')
  return url.toString()
}

export type HeroVideoEnv = {
  /** `matchMedia('(min-width: 768px)').matches` */
  wide: boolean
  /** `matchMedia('(prefers-reduced-motion: reduce)').matches` */
  reducedMotion: boolean
  /** `navigator.connection?.saveData` */
  saveData?: boolean
  /** `html[data-motion="none"]` site setting */
  motionOff?: boolean
}

/**
 * The background video may load only on desktop widths, with motion allowed and data saver off.
 * Otherwise the poster (server-rendered LCP image) stays and no video request is made.
 */
export function shouldLoadHeroVideo(env: HeroVideoEnv): boolean {
  return env.wide && !env.reducedMotion && !env.saveData && !env.motionOff
}

