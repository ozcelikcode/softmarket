'use client'

import { RefreshRouteOnSave } from '@payloadcms/live-preview-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { EXIT_PREVIEW_ROUTE, safePreviewRedirect } from '@/lib/preview-url'

/*
 * F8 draft-mode island (mounted by the locale layout only for a re-validated staff draft request).
 * Admin (same origin, frame-ancestors 'self') posts `payload-document-event` on save/autosave/publish;
 * the message origin must equal this window's own origin, then the server components re-render.
 * Opened outside the admin iframe, a small badge offers leaving draft mode.
 */
export function LivePreviewRefresh({ label }: { label: string }) {
  const router = useRouter()
  const refresh = useCallback(() => router.refresh(), [router])
  const [origin, setOrigin] = useState<string | null>(null)
  const [standalone, setStandalone] = useState(false)
  const [exitHref, setExitHref] = useState(EXIT_PREVIEW_ROUTE)

  useEffect(() => {
    setOrigin(window.location.origin)
    setStandalone(window.self === window.top)
    const back = safePreviewRedirect(window.location.pathname)
    if (back) setExitHref(`${EXIT_PREVIEW_ROUTE}?redirect=${encodeURIComponent(back)}`)
  }, [])

  return (
    <>
      {origin && <RefreshRouteOnSave refresh={refresh} serverURL={origin} />}
      {standalone && (
        <a
          href={exitHref}
          data-preview-exit
          className="fixed bottom-4 left-4 z-50 rounded-full bg-accent px-3 py-1.5 text-small font-medium text-accent-contrast shadow-lg"
        >
          {label}
        </a>
      )}
    </>
  )
}
