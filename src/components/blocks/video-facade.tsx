'use client'

import { PlayIcon as Play } from '@/components/ui/client-icons'
import { useState, type ReactNode } from 'react'

import { autoplayUrl } from '@/lib/blocks/static'

/**
 * Click-to-load video. The page ships a poster and a play button only; the third-party iframe
 * (youtube-nocookie / Vimeo dnt) is created after the click, so no request goes to the provider before consent-by-action.
 * The 16:9 box is reserved up front (no layout shift).
 */
export function VideoFacade({ embedUrl, title, playLabel, poster }: { embedUrl: string; title: string; playLabel: string; poster?: ReactNode }) {
  const [playing, setPlaying] = useState(false)
  const src = autoplayUrl(embedUrl)
  if (!src) return null
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-surface">
      {playing ? (
        <iframe
          src={src}
          title={title}
          sandbox="allow-scripts allow-same-origin allow-presentation"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 size-full"
        />
      ) : (
        <>
          {poster}
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`${playLabel}: ${title}`}
            className="group absolute inset-0 flex items-center justify-center bg-black/25 transition-colors hover:bg-black/15 focus-visible:outline-2 focus-visible:-outline-offset-4"
          >
            <span className="flex size-16 items-center justify-center rounded-full bg-accent text-accent-contrast shadow-lg transition-transform group-hover:scale-105 sm:size-20">
              <Play aria-hidden className="ml-1 size-7 fill-current" />
            </span>
          </button>
        </>
      )}
    </div>
  )
}
