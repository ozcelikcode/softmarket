'use client'

import { RefreshRouteOnSave } from '@payloadcms/live-preview-react'
import { useRouter } from 'next/navigation'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'

import { EXIT_PREVIEW_ROUTE, safePreviewRedirect } from '@/lib/preview-url'

// V5 visual editor: separate chunk, requested only here (staff draft request) and only inside the admin iframe.
const CanvasBridge = lazy(() => import('@/editor/canvas/bridge'))

/*
 * F8 draft-mode island (mounted by the locale layout only for a re-validated staff draft request).
 * Admin (same origin, frame-ancestors 'self') posts `payload-document-event` on save/autosave/publish;
 * the message origin must equal this window's own origin, then the server components re-render.
 * Opened outside the admin iframe, a small badge offers leaving draft mode.
 */
export function LivePreviewRefresh({ label }: { label: string }) {
  const router = useRouter()
  // While text is edited in place on the canvas, a save-triggered refresh would reset the caret: defer it.
  const editing = useRef(false)
  const pending = useRef(false)
  const refresh = useCallback(() => {
    if (editing.current) { pending.current = true; return }
    router.refresh()
  }, [router])
  useEffect(() => {
    const onEditing = (event: Event) => {
      editing.current = (event as CustomEvent<unknown>).detail === true
      if (!editing.current && pending.current) { pending.current = false; router.refresh() }
    }
    window.addEventListener('sm-canvas-editing', onEditing)
    return () => window.removeEventListener('sm-canvas-editing', onEditing)
  }, [router])
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
      {origin && !standalone && <Suspense fallback={null}><CanvasBridge /></Suspense>}
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
