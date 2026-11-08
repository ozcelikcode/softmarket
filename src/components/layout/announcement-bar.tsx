'use client'

import { XIcon as X } from '@/components/ui/client-icons'
import { useEffect, useState, type ReactNode } from 'react'

const KEY = 'sm-announcement-dismissed'

/**
 * Minimal island around the server-rendered announcement. Without JS the bar is simply shown
 * (no dead close button). Dismissal is remembered per announcement id (text + link hash).
 */
export function AnnouncementBar({
  id,
  dismissible,
  closeLabel,
  children,
}: {
  id: string
  dismissible: boolean
  closeLabel: string
  children: ReactNode
}) {
  const [dismissedId, setDismissedId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      setDismissedId(dismissible && window.localStorage.getItem(KEY) === id ? id : null)
    } catch {
      // Storage blocked: keep the bar visible.
    }
    setReady(true)
  }, [id, dismissible])

  if (dismissible && dismissedId === id) return null
  return (
    <div data-theme="dark" className="relative z-50 bg-accent text-accent-contrast">
      <div className="mx-auto flex min-h-10 max-w-[var(--container-wide)] items-center justify-center gap-3 px-12 py-2 text-center text-small font-medium">
        {children}
      </div>
      {dismissible && ready ? (
        <button
          type="button"
          aria-label={closeLabel}
          onClick={() => {
            setDismissedId(id)
            try {
              window.localStorage.setItem(KEY, id)
            } catch {
              // Not persisted; hidden for this page view only.
            }
          }}
          className="absolute right-2 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-md transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          <X aria-hidden className="size-4" />
        </button>
      ) : null}
    </div>
  )
}
