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
 * Conflict (P1): every admin save carries the form's `editorVersion` (the draft `updatedAt` it was loaded/saved
 * at); the server rejects a stale one with 409 inside the write transaction (src/editor/canvas/concurrency.ts), so
 * a change made elsewhere is never overwritten. The watcher below only makes that visible early: a failed save,
 * focus, tab return or a 15 s poll compares the latest draft `updatedAt` with the form's version and shows the
 * reload/merge warning; flushing pauses meanwhile. Payload's document lock still keeps a second user out.
 */

const KEEPALIVE_LIMIT = 60_000
export const fitsKeepalive = (body: string): boolean => new TextEncoder().encode(body).byteLength <= KEEPALIVE_LIMIT
const VOLATILE = new Set(['updatedAt', 'createdAt', '_status', 'editorVersion'])
export const VERSION_FIELD = 'editorVersion'
/** The version the form was loaded/last saved at (virtual `editorVersion` field). */
export const formVersion = (fields: FormState): string | null => {
  const v = fields[VERSION_FIELD]?.value
  return typeof v === 'string' && v ? v : null
}

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

export function useAutosaveFlush({ doc, fields, modified, paused, onSaved, onConflict }: {
  doc: Doc | null
  fields: FormState
  modified: boolean
  paused: boolean
  /** New version after an accepted flush. */
  onSaved: (version: string) => void
  /** The server rejected the flush: the document changed elsewhere (409). */
  onConflict: () => void
}) {
  const state = useRef({ doc, fields, modified, paused, onSaved, onConflict })
  state.current = { ...state.current, doc, fields, modified, paused, onSaved, onConflict }
  const inFlight = useRef<{ key: string; promise: Promise<boolean> } | null>(null)

  /** Send the pending changes now. `keepalive` for page exit. Resolves true when the server accepted them. */
  const flush = useCallback(async (mode: 'keepalive' | 'await'): Promise<boolean> => {
    const s = state.current
    if (!s.doc || !s.modified || s.paused) return !s.modified
    const body = JSON.stringify({ ...stableValues(s.fields), [VERSION_FIELD]: formVersion(s.fields), _status: 'draft' })
    if (mode === 'keepalive' && !fitsKeepalive(body)) return false
    const url = autosaveURL(s.doc)
    const key = `${url}\n${body}`
    if (inFlight.current?.key === key) return inFlight.current.promise
    const promise = (async () => {
      try {
        const res = await fetch(url, {
          method: 'PATCH', credentials: 'same-origin', keepalive: mode === 'keepalive', cache: 'no-store',
          headers: { 'Content-Type': 'application/json' }, body,
        })
        if (res.status === 409) { state.current.onConflict(); return false }
        if (!res.ok) return false
        const json = (await res.json().catch(() => null)) as { doc?: { editorVersion?: string; updatedAt?: string } } | null
        const version = json?.doc?.editorVersion ?? json?.doc?.updatedAt
        if (version) state.current.onSaved(version)
        return true
      } catch {
        return false
      }
    })()
    inFlight.current = { key, promise }
    try { return await promise } finally { if (inFlight.current?.promise === promise) inFlight.current = null }
  }, [])

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') void flush('keepalive') }
    const onPageHide = () => { void flush('keepalive') }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      const s = state.current
      if (!s.doc || !s.modified || s.paused) return
      const body = JSON.stringify({ ...stableValues(s.fields), [VERSION_FIELD]: formVersion(s.fields), _status: 'draft' })
      if (!fitsKeepalive(body)) { event.preventDefault(); event.returnValue = '' }
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

export function useConflictWatch({ doc, version, busy, intervalMs = 15_000 }: {
  doc: Omit<Doc, 'locale'> | null
  /** The form's `editorVersion` (null: not known yet / not guarded). */
  version: string | null
  /** A save is in flight (its result is not known yet). */
  busy: boolean
  intervalMs?: number
}) {
  const [conflict, setConflict] = useState<string | null>(null)
  const ref = useRef({ doc, version, busy })
  ref.current = { doc, version, busy }

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

  /** `settle`: wait for an in-flight own save first (its response updates the form version). */
  const check = useCallback(async (settle = 2500) => {
    if (document.visibilityState !== 'visible') return
    const stale = (server: string | null) => Boolean(server && ref.current.version && server !== ref.current.version && !ref.current.busy)
    if (!stale(await read())) return
    if (settle) await new Promise((r) => window.setTimeout(r, settle))
    const server = await read()
    if (stale(server)) setConflict(server)
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

  return { conflict, clear: useCallback(() => setConflict(null), []), check, report: setConflict }
}
