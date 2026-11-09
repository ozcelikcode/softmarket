'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'

import { INLINE_MAX, isSafeFieldPath, normalizeInline } from '@/editor/canvas/fields'
import {
  acceptMessage, BLOCK_ID_RE, BLOCK_TYPE_RE, envelope, hostMessage, type BridgeMessageBody, type HostMessage,
} from '@/editor/canvas/protocol'
import { t, VISUAL_EDITOR_LABELS } from '@/lib/visual-editor-labels'

/*
 * V5 visual editor — site side (draft-mode page inside the admin Live Preview iframe). A separate lazy chunk,
 * requested only by the staff/draft-only LivePreviewRefresh island when the page is framed. Reads the server
 * markers (`data-block-id`, `data-block-hidden`, `data-field-path`, `data-doc-field`), draws hover/selection frames,
 * the block toolbar and hidden-block badges, edits plain-text fields in place (textContent only, plain-text
 * paste) and offers keyboard selection/moves. It never calls the API: every action is a message to the admin host,
 * which validates it again and applies it to the Payload document form. Nothing is active until the parent host
 * answers (same origin AND source === window.parent).
 */

type HostState = Extract<HostMessage, { type: 'host' }>
type Rect = { top: number; left: number; width: number; height: number }
type Field = { el: HTMLElement; path: string; scope: 'block' | 'doc' }
type Editing = Field & { id: string | null; locale: 'tr' | 'en'; original: string; last: string }

const L = VISUAL_EDITOR_LABELS.canvas
const UI = 'data-canvas-ui'

const blocksOf = () => [...document.querySelectorAll<HTMLElement>('[data-block-id]')]
  .filter((el) => BLOCK_ID_RE.test(el.dataset.blockId ?? '') && BLOCK_TYPE_RE.test(el.dataset.blockType ?? ''))
const blockById = (id: string | null) => (id ? blocksOf().find((el) => el.dataset.blockId === id) : undefined)
const pageLocale = (): 'tr' | 'en' | null => {
  const lang = document.documentElement.lang
  return lang === 'tr' || lang === 'en' ? lang : null
}

/** Union rect of a block wrapper (a `display: contents` wrapper has no box of its own). */
function rectOf(el: HTMLElement): Rect | null {
  const boxes = el.style.display === 'contents' ? [...el.children] : [el]
  let top = Infinity, left = Infinity, right = -Infinity, bottom = -Infinity
  for (const child of boxes) {
    const r = child.getBoundingClientRect()
    if (!r.width && !r.height) continue
    top = Math.min(top, r.top); left = Math.min(left, r.left); right = Math.max(right, r.right); bottom = Math.max(bottom, r.bottom)
  }
  return top === Infinity ? null : { top, left, width: right - left, height: bottom - top }
}

/** Inline fields that belong to `block` (not to a nested block). */
function fieldsOf(block: HTMLElement): Field[] {
  return [...block.querySelectorAll<HTMLElement>('[data-field-path],[data-doc-field]')]
    .filter((el) => el.closest('[data-block-id]') === block)
    .flatMap((el): Field[] => {
      const path = el.dataset.fieldPath ?? el.dataset.docField
      if (!isSafeFieldPath(path)) return []
      return [{ el, path, scope: el.dataset.fieldPath ? 'block' : 'doc' }]
    })
}

function fieldAt(target: HTMLElement): Field | null {
  const el = target.closest<HTMLElement>('[data-field-path],[data-doc-field]')
  if (!el) return null
  const path = el.dataset.fieldPath ?? el.dataset.docField
  return isSafeFieldPath(path) ? { el, path, scope: el.dataset.fieldPath ? 'block' : 'doc' } : null
}

const STYLE = `
[${UI}] button{font:600 12px/1 system-ui,sans-serif;padding:7px 9px;border:0;border-radius:4px;background:#1e293b;color:#fff;cursor:pointer;min-height:28px}
[${UI}] button:hover:not(:disabled){background:#334155}
[${UI}] button:disabled{opacity:.4;cursor:not-allowed}
[${UI}] button:focus-visible{outline:2px solid #facc15;outline-offset:2px}
[${UI}] button[data-tone=primary]{background:#2563eb}
[${UI}] button[data-tone=danger]{background:#b91c1c}
[data-canvas-editing]{outline:2px dashed #2563eb!important;outline-offset:3px;cursor:text}
[data-block-id] [data-field-path]:hover,[data-block-id] [data-doc-field]:hover{outline:1px dashed rgba(37,99,235,.6);outline-offset:2px}
`

export function CanvasBridge() {
  const [host, setHost] = useState<HostState | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [, setTick] = useState(0)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [dropAt, setDropAt] = useState<{ id: string; after: boolean } | null>(null)
  const editingRef = useRef<Editing | null>(null)
  const pendingRef = useRef<(Field & { id: string | null }) | null>(null)
  const dragRef = useRef<string | null>(null)
  const selectedRef = useRef<string | null>(null)
  selectedRef.current = selected
  const lang = host?.lang ?? (pageLocale() ?? 'tr')

  const send = useCallback((body: BridgeMessageBody) => {
    if (window.parent === window) return
    window.parent.postMessage(envelope(body), window.location.origin)
  }, [])

  const announce = useCallback(() => {
    const blocks = blocksOf().slice(0, 300).map((el) => ({ id: el.dataset.blockId!, type: el.dataset.blockType! }))
    send({ type: 'ready', blocks })
  }, [send])

  const select = useCallback((id: string | null, scroll = false) => {
    setSelected(id)
    send({ type: 'select', id })
    const el = scroll && id ? blockById(id) : undefined
    // A `display: contents` wrapper has no box: scroll its first child into view.
    if (el) (el.style.display === 'contents' ? el.firstElementChild : el)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [send])

  /* ---------- inline text ---------- */
  const finishEdit = useCallback((restore: boolean) => {
    const cur = editingRef.current
    if (!cur) return
    if (restore) {
      cur.el.textContent = cur.original
      if (cur.last !== cur.original) send({ type: 'text', scope: cur.scope, id: cur.id, path: cur.path, locale: cur.locale, value: cur.original })
    }
    cur.el.removeAttribute('contenteditable')
    cur.el.removeAttribute('data-canvas-editing')
    editingRef.current = null
    window.dispatchEvent(new CustomEvent('sm-canvas-editing', { detail: false }))
    send({ type: 'textEnd' })
  }, [send])

  const requestEdit = useCallback((field: Field) => {
    if (editingRef.current?.el === field.el) return
    finishEdit(false)
    const locale = pageLocale()
    const block = field.el.closest<HTMLElement>('[data-block-id]')
    const id = block?.dataset.blockId ?? null
    if (!locale || (field.scope === 'block' && !id)) return
    pendingRef.current = { ...field, id }
    send({ type: 'textBegin', scope: field.scope, id, path: field.path, locale })
  }, [finishEdit, send])

  const startEdit = useCallback((field: Field & { id: string | null }, fallback: boolean) => {
    const locale = pageLocale()
    if (!locale || !field.el.isConnected) return
    const original = normalizeInline(field.el.textContent ?? '')
    if (original.length > INLINE_MAX) { setNotice(t(L.formOnly, lang)); return }
    editingRef.current = { ...field, locale, original, last: original }
    window.dispatchEvent(new CustomEvent('sm-canvas-editing', { detail: true }))
    // plaintext-only: the browser never inserts markup; we still only ever read textContent.
    field.el.setAttribute('contenteditable', 'plaintext-only')
    if (field.el.contentEditable !== 'plaintext-only') field.el.setAttribute('contenteditable', 'true')
    field.el.setAttribute('data-canvas-editing', '')
    field.el.focus()
    const range = document.createRange()
    range.selectNodeContents(field.el)
    range.collapse(false)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    if (fallback) setNotice(t(L.fallback, lang))
  }, [lang])

  /* ---------- host messages ---------- */
  useEffect(() => {
    if (window.parent === window) return
    const style = document.createElement('style')
    style.setAttribute(UI, '')
    style.textContent = STYLE
    document.head.appendChild(style)
    const onMessage = (event: MessageEvent) => {
      const msg = acceptMessage(event, { origin: window.location.origin, source: window.parent }, hostMessage)
      if (!msg) return
      if (msg.type === 'host') { setHost(msg); setSelected(msg.selected) }
      else if (msg.type === 'select') setSelected(msg.id)
      else if (msg.type === 'notice') setNotice(msg.message)
      else if (msg.type === 'textGrant') {
        const pending = pendingRef.current
        pendingRef.current = null
        if (!pending || pending.path !== msg.path || pending.id !== msg.id) return
        if (msg.ok) startEdit(pending, msg.fallback)
      }
    }
    window.addEventListener('message', onMessage)
    announce()
    // Server re-render (RefreshRouteOnSave) replaces markup: re-announce when the block list changes.
    let last = blocksOf().map((el) => el.dataset.blockId).join()
    const observer = new MutationObserver(() => {
      const now = blocksOf().map((el) => el.dataset.blockId).join()
      setTick((n) => n + 1)
      if (now !== last) { last = now; announce() }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => { window.removeEventListener('message', onMessage); observer.disconnect(); style.remove() }
  }, [announce, startEdit])

  // Reposition frames on scroll/resize.
  useEffect(() => {
    if (!host) return
    let raf = 0
    const bump = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setTick((n) => n + 1)) }
    window.addEventListener('scroll', bump, { passive: true })
    window.addEventListener('resize', bump)
    return () => { window.removeEventListener('scroll', bump); window.removeEventListener('resize', bump); cancelAnimationFrame(raf) }
  }, [host])

  useEffect(() => { if (notice) { const id = window.setTimeout(() => setNotice(null), 5000); return () => window.clearTimeout(id) } }, [notice])
  useEffect(() => setConfirmRemove(false), [selected])

  /** Move `id` past its neighbour in page order (DOM order = layout order); the host resolves indices by id. */
  const moveBy = useCallback((id: string, delta: -1 | 1) => {
    const all = blocksOf()
    const at = all.findIndex((el) => el.dataset.blockId === id)
    const neighbour = all[at + delta]
    if (at < 0 || !neighbour) return
    send({ type: 'move', id, target: neighbour.dataset.blockId!, place: delta < 0 ? 'before' : 'after' })
  }, [send])

  /* ---------- pointer + keyboard ---------- */
  useEffect(() => {
    if (!host) return
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.closest(`[${UI}]`)) return
      const editing = editingRef.current
      if (editing && editing.el.contains(target)) return
      const field = fieldAt(target)
      const block = target.closest<HTMLElement>('[data-block-id]')
      if (!block && !field) return
      // Links, buttons, details/summary inside blocks never navigate or toggle while editing.
      event.preventDefault()
      if (block && block.dataset.blockId !== selectedRef.current) {
        finishEdit(false)
        select(block.dataset.blockId!)
        return
      }
      if (field) requestEdit(field)
    }
    const onKey = (event: KeyboardEvent) => {
      const cur = editingRef.current
      if (cur && event.target === cur.el) {
        if (event.key === 'Enter') { event.preventDefault(); finishEdit(false) }
        else if (event.key === 'Escape') { event.preventDefault(); finishEdit(true) }
        return
      }
      const target = event.target as HTMLElement | null
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? '')) return
      const mod = event.metaKey || event.ctrlKey
      if (mod && !event.altKey && (event.key === 'z' || event.key === 'Z' || event.key === 'y')) {
        event.preventDefault()
        send({ type: 'history', action: event.key === 'y' || event.shiftKey ? 'redo' : 'undo' })
        return
      }
      if (target?.closest(`[${UI}]`) && (event.key === 'Enter' || event.key === ' ')) return
      const sel = selectedRef.current
      const all = blocksOf()
      if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && !mod) {
        if (event.altKey) {
          if (!sel) return
          event.preventDefault()
          moveBy(sel, event.key === 'ArrowUp' ? -1 : 1)
          return
        }
        if (!sel && event.key !== 'ArrowDown') return
        event.preventDefault()
        const at = sel ? all.findIndex((el) => el.dataset.blockId === sel) : -1
        const next = all[Math.max(0, Math.min(all.length - 1, at + (event.key === 'ArrowUp' ? -1 : 1)))]
        if (next) select(next.dataset.blockId!, true)
        return
      }
      if (!sel) return
      if (event.key === 'Escape') { event.preventDefault(); select(null) }
      else if (event.key === 'Enter') {
        const block = blockById(sel)
        const first = block ? fieldsOf(block)[0] : undefined
        if (first) { event.preventDefault(); requestEdit(first) }
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        setConfirmRemove((on) => { if (on) send({ type: 'remove', id: sel }); return !on })
      }
    }
    const onInput = (event: Event) => {
      const cur = editingRef.current
      if (!cur || event.target !== cur.el) return
      const raw = cur.el.textContent ?? ''
      const value = normalizeInline(raw)
      if (value.length > INLINE_MAX) {
        cur.el.textContent = cur.last
        setNotice(t(L.tooLong, lang))
        return
      }
      if (value !== cur.last) {
        cur.last = value
        send({ type: 'text', scope: cur.scope, id: cur.id, path: cur.path, locale: cur.locale, value })
      }
    }
    const onBlur = (event: FocusEvent) => { if (editingRef.current && event.target === editingRef.current.el) finishEdit(false) }
    const onPaste = (event: ClipboardEvent) => {
      if (!editingRef.current || event.target !== editingRef.current.el) return
      event.preventDefault()
      const text = normalizeInline(event.clipboardData?.getData('text/plain') ?? '')
      document.execCommand('insertText', false, text)
    }
    const onDrop = (event: DragEvent) => { if (editingRef.current?.el.contains(event.target as Node)) event.preventDefault() }
    const onOver = (event: MouseEvent) => {
      const block = (event.target as HTMLElement).closest?.<HTMLElement>('[data-block-id]')
      setHover(block?.dataset.blockId ?? null)
    }
    const opts = true
    document.addEventListener('click', onClick, opts)
    document.addEventListener('keydown', onKey, opts)
    document.addEventListener('input', onInput, opts)
    document.addEventListener('blur', onBlur, opts)
    document.addEventListener('paste', onPaste, opts)
    document.addEventListener('drop', onDrop, opts)
    document.addEventListener('mouseover', onOver, opts)
    return () => {
      document.removeEventListener('click', onClick, opts)
      document.removeEventListener('keydown', onKey, opts)
      document.removeEventListener('input', onInput, opts)
      document.removeEventListener('blur', onBlur, opts)
      document.removeEventListener('paste', onPaste, opts)
      document.removeEventListener('drop', onDrop, opts)
      document.removeEventListener('mouseover', onOver, opts)
    }
  }, [finishEdit, host, lang, moveBy, requestEdit, select, send])

  /** Block under the pointer (canvas UI ignored) and whether the pointer is in its lower half. */
  function dropTarget(x: number, y: number): { id: string; after: boolean } | null {
    const block = document.elementsFromPoint(x, y).map((el) => (el as HTMLElement).closest?.<HTMLElement>('[data-block-id]')).find(Boolean)
    const id = block?.dataset.blockId
    if (!block || !id || id === dragRef.current) return null
    const r = rectOf(block)
    return r ? { id, after: y > r.top + r.height / 2 } : null
  }

  /** Pointer drag from the toolbar handle (mouse, pen and touch; HTML5 DnD is unreliable in iframes). */
  function startDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!selected || event.button !== 0) return
    event.preventDefault()
    dragRef.current = selected
    const move = (e: PointerEvent) => {
      setDropAt(dropTarget(e.clientX, e.clientY))
      if (e.clientY < 60) window.scrollBy(0, -24)
      else if (e.clientY > window.innerHeight - 60) window.scrollBy(0, 24)
    }
    const up = (e: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const target = dropTarget(e.clientX, e.clientY)
      const from = dragRef.current
      dragRef.current = null
      setDropAt(null)
      if (from && target) send({ type: 'move', id: from, target: target.id, place: target.after ? 'after' : 'before' })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  if (!host) return null
  const elements = blocksOf()
  const sel = blockById(selected)
  const selRect = sel ? rectOf(sel) : null
  const selType = sel?.dataset.blockType ?? ''
  const selHidden = sel?.hasAttribute('data-block-hidden') ?? false
  const hov = hover && hover !== selected ? blockById(hover) : undefined
  const hovRect = hov ? rectOf(hov) : null
  const position = sel ? elements.indexOf(sel) : -1
  const locked = (kind: keyof HostState['locked']) => host.locked[kind].includes(selType)
  const label = (type: string) => (Object.hasOwn(host.labels, type) ? host.labels[type] : type)
  const vh = window.innerHeight

  const frame = (r: Rect, color: string, dashed = false): CSSProperties => ({
    position: 'fixed', top: r.top, left: r.left, width: r.width, height: r.height, pointerEvents: 'none', zIndex: 2147483000,
    outline: `2px ${dashed ? 'dashed' : 'solid'} ${color}`, outlineOffset: -2,
  })

  return (
    <div {...{ [UI]: '' }} role="region" aria-label={t(L.region, lang)}>
      {hovRect ? <div style={frame(hovRect, '#60a5fa', true)} /> : null}
      {elements.filter((el) => el.hasAttribute('data-block-hidden')).map((el) => {
        const r = rectOf(el)
        if (!r || r.top > vh || r.top + r.height < 0) return null
        return (
          <div key={el.dataset.blockId} data-canvas-hidden-badge="" style={{ position: 'fixed', top: Math.max(4, r.top + 8), left: r.left + r.width - 8, transform: 'translateX(-100%)', zIndex: 2147483000, pointerEvents: 'none', font: '600 12px/1 system-ui,sans-serif', padding: '6px 9px', borderRadius: 999, background: '#475569', color: '#fff' }}>
            {t(L.hiddenBadge, lang)}
          </div>
        )
      })}
      {dropAt ? (() => {
        const target = blockById(dropAt.id)
        const r = target ? rectOf(target) : null
        return r ? <div style={{ position: 'fixed', left: r.left, width: r.width, top: (dropAt.after ? r.top + r.height : r.top) - 2, height: 4, background: '#2563eb', zIndex: 2147483001, pointerEvents: 'none' }} /> : null
      })() : null}
      <div aria-live="polite" style={{ position: 'fixed', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {sel ? `${t(L.selected, lang)}: ${label(selType)} (${position + 1}/${elements.length})` : ''}
      </div>
      {selRect && sel && selected ? (
        <>
          <div style={frame(selRect, '#2563eb')} />
          <div role="toolbar" aria-label={t(L.toolbar, lang)} data-canvas-toolbar=""
            style={{ position: 'fixed', top: Math.min(Math.max(4, selRect.top + 4), vh - 48), left: Math.max(4, selRect.left + 8), zIndex: 2147483001, display: 'flex', flexWrap: 'wrap', gap: 4, padding: 4, maxWidth: 'calc(100vw - 16px)', background: '#0f172a', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.3)' }}>
            <span style={{ font: '600 12px/28px system-ui,sans-serif', color: '#cbd5e1', padding: '0 6px' }}>
              {label(selType)}{locked('remove') ? ` · ${t(L.required, lang)}` : ''}
            </span>
            <button type="button" disabled={locked('move')} aria-label={t(L.up, lang)} title={t(L.up, lang)} data-canvas-action="up" onClick={() => moveBy(selected, -1)}>↑</button>
            <button type="button" disabled={locked('move')} aria-label={t(L.down, lang)} title={t(L.down, lang)} data-canvas-action="down" onClick={() => moveBy(selected, 1)}>↓</button>
            <button type="button" disabled={locked('move')} aria-label={t(L.drag, lang)} title={t(L.drag, lang)} data-canvas-action="drag"
              style={{ cursor: 'grab', touchAction: 'none' }} onPointerDown={startDrag}>⠿</button>
            {fieldsOf(sel).length ? (
              <button type="button" title={t(L.edit, lang)} data-canvas-action="edit" onClick={() => { const f = fieldsOf(sel)[0]; if (f) requestEdit(f) }}>{t(L.edit, lang).replace(/ \(.*\)$/, '')}</button>
            ) : null}
            <button type="button" disabled={locked('duplicate')} data-canvas-action="duplicate" onClick={() => send({ type: 'duplicate', id: selected })}>{t(L.duplicate, lang)}</button>
            <button type="button" disabled={locked('hide')} data-canvas-action="hide" aria-pressed={selHidden}
              onClick={() => send({ type: 'hide', id: selected, hidden: !selHidden })}>{t(selHidden ? L.show : L.hide, lang)}</button>
            <button type="button" disabled={locked('remove')} data-canvas-action="remove" data-tone={confirmRemove ? 'danger' : undefined}
              onClick={() => { if (confirmRemove) { send({ type: 'remove', id: selected }); setConfirmRemove(false) } else setConfirmRemove(true) }}>
              {t(confirmRemove ? L.confirmRemove : L.remove, lang)}
            </button>
            <button type="button" data-tone="primary" data-canvas-action="add" onClick={() => send({ type: 'insert', after: selected })}>{t(L.add, lang)}</button>
          </div>
        </>
      ) : null}
      {notice ? (
        <div role="status" style={{ position: 'fixed', bottom: 16, right: 16, maxWidth: 360, zIndex: 2147483002, font: '500 13px/1.4 system-ui,sans-serif', padding: '10px 14px', borderRadius: 6, background: '#b45309', color: '#fff' }}>{notice}</div>
      ) : null}
    </div>
  )
}

export default CanvasBridge
