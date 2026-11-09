'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { reduceFieldsToValues } from 'payload/shared'
import type { FormState } from 'payload'

/*
 * V5 visual editor (admin): save-loss and concurrency guards around Payload's own autosave (2 s debounce).
 *
 * Flush: Payload autosaves only after the debounce. When the tab is hidden or closed inside that window, the
 * last change would be lost, so `visibilitychange: hidden` / `pagehide` send the same autosave request Payload
 * makes (PATCH ?autosave=true&draft=true, the current locale, `_status: draft`) as a keepalive fetch. Bodies over
 * the keepalive limit cannot outlive the page: `beforeunload` then asks the browser to confirm leaving. The
 * request goes through the normal REST auth/access/validation chain (cookie session of the staff user).
 *
 * Conflict: the document's latest draft `updatedAt` is compared with the last one this editor saw (Payload's
 * document data after its own saves, plus our flushes). A newer value written elsewhere (MCP, another tab or
 * user) shows a "reload" warning and pauses flushing. Payload's document locking already blocks a second
 * editor from opening the document; this covers writes that do not take the lock.
 */

const KEEPALIVE_LIMIT = 60_000
const VOLATILE = new Set(['updatedAt', 'createdAt', '_status'])

/** Form values that matter for saving/history (volatile server fields removed). */
export function stableValues(fields: FormState): Record<string, unknown> {
  const values = reduceFieldsToValues(fields, true) as Record<string, unknown>
  return Object.fromEntries(Object.entries(values).filter(([k]) => !VOLATILE.has(k)))
}

type Doc = { apiBase: string; collection: string; id: string | number; locale: string }

export function autosaveURL({ apiBase, collection, id, locale }: Doc): string {
  const q = new URLSearchParams({ autosave: 'true', draft: 'true', depth: '0', 'fallback-locale': 'null', locale })
  return `${apiBase}/${encodeURIComponent(collection)}/${encodeURIComponent(String(id))}?${q}`
}

export function useAutosaveFlush({ doc, fields, modified, paused, onSaved }: {
  doc: Doc | null
  fields: FormState
  modified: boolean
  paused: boolean
  onSaved: (updatedAt: string) => void
}) {
  const state = useRef({ doc, fields, modified, paused, onSaved, last: '' })
  state.current = { ...state.current, doc, fields, modified, paused, onSaved }

  /** Send the pending changes now. `keepalive` for page exit. Resolves true when the server accepted them. */
  const flush = useCallback(async (mode: 'keepalive' | 'await'): Promise<boolean> => {
    const s = state.current
    if (!s.doc || !s.modified || s.paused) return !s.modified
    const body = JSON.stringify({ ...stableValues(s.fields), _status: 'draft' })
    if (body === s.last) return true
    if (mode === 'keepalive' && body.length > KEEPALIVE_LIMIT) return false
    s.last = body
    try {
      const res = await fetch(autosaveURL(s.doc), {
        method: 'PATCH', credentials: 'same-origin', keepalive: mode === 'keepalive', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body,
      })
      if (!res.ok) { s.last = ''; return false }
      const json = (await res.json().catch(() => null)) as { doc?: { updatedAt?: string } } | null
      if (json?.doc?.updatedAt) state.current.onSaved(json.doc.updatedAt)
      return true
    } catch {
      s.last = ''
      return false
    }
  }, [])

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') void flush('keepalive') }
    const onPageHide = () => { void flush('keepalive') }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      const s = state.current
      if (!s.doc || !s.modified || s.paused) return
      const size = JSON.stringify(stableValues(s.fields)).length
      if (size > KEEPALIVE_LIMIT) { event.preventDefault(); event.returnValue = '' }
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [flush])

  return flush
}

const later = (a?: string | null, b?: string | null) => (!a ? b ?? null : !b ? a : a > b ? a : b)

export function useConflictWatch({ doc, known, busy, intervalMs = 15_000 }: {
  doc: Omit<Doc, 'locale'> | null
  /** updatedAt values this editor produced or loaded (Payload document data, our flushes). */
  known: (string | null | undefined)[]
  /** A save is in flight (its result is not known yet). */
  busy: boolean
  intervalMs?: number
}) {
  const [conflict, setConflict] = useState<string | null>(null)
  const ref = useRef({ doc, known: null as string | null, busy, dismissed: null as string | null })
  ref.current.doc = doc
  ref.current.busy = busy
  ref.current.known = known.reduce<string | null>((acc, v) => later(acc, v ?? null), ref.current.known)

  const read = useCallback(async (): Promise<string | null> => {
    const d = ref.current.doc
    if (!d) return null
    const q = new URLSearchParams({ depth: '0', draft: 'true', 'select[updatedAt]': 'true' })
    try {
      const res = await fetch(`${d.apiBase}/${encodeURIComponent(d.collection)}/${encodeURIComponent(String(d.id))}?${q}`, { credentials: 'same-origin', cache: 'no-store' })
      if (!res.ok) return null
      const json = (await res.json()) as { updatedAt?: string }
      return typeof json.updatedAt === 'string' ? json.updatedAt : null
    } catch {
      return null
    }
  }, [])

  const check = useCallback(async () => {
    if (ref.current.busy || document.visibilityState !== 'visible') return
    const server = await read()
    const newer = () => Boolean(server && ref.current.known && server > ref.current.known && server !== ref.current.dismissed)
    if (!newer()) return
    // Our own autosave may have landed meanwhile: confirm once after it settles.
    await new Promise((r) => window.setTimeout(r, 2500))
    if (!ref.current.busy && newer()) setConflict(server)
  }, [read])

  useEffect(() => {
    if (!doc) return
    const onVisible = () => { if (document.visibilityState === 'visible') void check() }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(() => void check(), intervalMs)
    return () => {
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [check, doc, intervalMs])

  const dismiss = useCallback(() => {
    ref.current.dismissed = conflict
    ref.current.known = later(ref.current.known, conflict)
    setConflict(null)
  }, [conflict])

  return { conflict, dismiss, check }
}
