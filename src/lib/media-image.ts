import type { Media } from '@/payload-types'
import { safeHref } from '@/lib/utils'

export type ReadableMedia = Pick<Media, 'url' | 'alt' | 'width' | 'height' | 'mimeType' | 'protected' | 'visibility' | 'sizes' | 'focalX' | 'focalY'>

/** Only consume populated, access-checked relations. Never reconstruct URLs from IDs/filenames. */
export function mediaOf(value: unknown): ReadableMedia | null {
  if (!value || typeof value !== 'object') return null
  const m = value as ReadableMedia
  return typeof m.url === 'string' && safeHref(m.url) && /^(?:https?:\/\/|\/)/i.test(m.url) ? m : null
}

export function imageCandidates(media: ReadableMedia) {
  if (!media.url) return []
  const candidates = Object.values(media.sizes ?? {}).filter(s =>
    s?.url && safeHref(s.url) && /^(?:https?:\/\/|\/)/i.test(s.url) && s.width && s.height && s.mimeType === 'image/webp',
  ).map(s => ({ url: s!.url!, width: s!.width! }))
  // Keep the original as a fallback only when there are no generated sizes.
  // Large originals must not win a high-DPR mobile selection over bounded WebP.
  return [...new Map(candidates.map(s => [s.width, s])).values()].sort((a, b) => a.width - b.width)
}
