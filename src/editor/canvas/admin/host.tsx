'use client'

import {
  useAllFormFields, useAuth, useConfig, useDocumentInfo, useForm, useFormBackgroundProcessing, useFormModified,
  useFormProcessing, useLivePreviewContext, useLocale, usePreferences, useRouteTransition, useTranslation,
} from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import type { FormState } from 'payload'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { BlockPalette, type PaletteBlock } from '@/editor/canvas/admin/palette'
import { revealRow } from '@/editor/canvas/admin/reveal'
import { stableValues, useAutosaveFlush, useConflictWatch } from '@/editor/canvas/admin/sync'
import { EditorTour, tourSeen } from '@/editor/canvas/admin/tour'
import { INLINE_MAX, isInlineBlockField, isInlineDocField } from '@/editor/canvas/fields'
import { emptyHistory, record, redo as redoStep, undo as undoStep, type History } from '@/editor/canvas/history'
import { acceptMessage, bridgeMessage, envelope, type BridgeMessage, type HostMessageBody } from '@/editor/canvas/protocol'
import {
  canvasLocks, compatFilteredRows, isCanvasCollection, isVirtualId, moveIndex, needsMaterialize, paletteTypes, planMove,
  rowIndexOf, type CanvasCollection, type CanvasRow,
} from '@/editor/canvas/rules'
import { PRODUCT_BOUND_BLOCKS } from '@/lib/blocks/product-composition'
import { t, VISUAL_EDITOR_LABELS } from '@/lib/visual-editor-labels'

/*
 * V5 visual editor — admin side. Rendered by Payload inside the document Form (`beforeDocumentControls` of
 * products/pages, see plugin.ts), so it uses only the public `@payloadcms/ui` hooks. It
 *  - shows the editor bar (visual/classic switch, undo/redo, 390/768/1440, TR/EN, save state, tips),
 *  - listens to the Live Preview iframe (same origin AND event.source === iframe.contentWindow, strict schema)
 *    and applies each message through the Payload form API, re-validating ids, field paths, locale and the V2
 *    product rules against the CURRENT form state,
 *  - opens the selected block's row and groups in the form, the block palette and the first-run tour,
 *  - flushes pending changes when the tab hides/closes and warns about writes made elsewhere.
 * Saving stays Payload's: autosave -> server validation/access -> RefreshRouteOnSave in the iframe.
 */

const V = VISUAL_EDITOR_LABELS
const DEVICES = [
  { name: 'mobile', label: '390' },
  { name: 'tablet', label: '768' },
  { name: 'desktop', label: '1440' },
  { name: 'responsive', label: null },
] as const
const LOCALES = ['tr', 'en'] as const

type ClientField = { type?: string; name?: string; fields?: ClientField[]; tabs?: { fields?: ClientField[] }[]; blocks?: ClientBlock[]; blockReferences?: (string | ClientBlock)[] }
type ClientBlock = { slug: string; labels?: { singular?: unknown }; imageURL?: string; admin?: { group?: unknown } }
type Row = { id: string; blockType?: string; collapsed?: boolean }

function findLayoutField(fields: ClientField[] | undefined): ClientField | undefined {
  for (const f of fields ?? []) {
    if (f.type === 'blocks' && f.name === 'layout') return f
    const nested = f.type === 'tabs' ? (f.tabs ?? []).flatMap((tab) => tab.fields ?? []) : f.fields
    if (nested && !f.name) {
      const hit = findLayoutField(nested)
      if (hit) return hit
    }
  }
  return undefined
}

const labelOf = (label: unknown, lang: string, fallback: string): string => {
  if (typeof label === 'string') return label
  if (label && typeof label === 'object') {
    const map = label as Record<string, unknown>
    const v = map[lang] ?? map.tr ?? Object.values(map)[0]
    if (typeof v === 'string') return v
  }
  return fallback
}

const rowsOf = (fields: FormState): CanvasRow[] =>
  ((fields.layout?.rows ?? []) as Row[]).map((r) => ({ id: r.id, blockType: r.blockType ?? '' }))
const has = (fields: FormState, path: string) => Object.hasOwn(fields, path)
const isStaff = (user: unknown) =>
  Array.isArray((user as { roles?: unknown } | null)?.roles) && ((user as { roles: unknown[] }).roles.some((r) => r === 'admin' || r === 'editor'))

type Outcome = 'done' | 'wait'

export function VisualEditorHost() {
  const { user } = useAuth()
  const { collectionSlug, id, data, initialData } = useDocumentInfo()
  const collection: CanvasCollection | null = isCanvasCollection(collectionSlug) && id != null && isStaff(user) ? collectionSlug : null
  if (!collection) return null
  return <Host collection={collection} id={id!} knownUpdatedAt={[(data as { updatedAt?: string } | undefined)?.updatedAt, (initialData as { updatedAt?: string } | undefined)?.updatedAt]} />
}

function Host({ collection, id, knownUpdatedAt }: { collection: CanvasCollection; id: string | number; knownUpdatedAt: (string | undefined)[] }) {
  const preview = useLivePreviewContext()
  const { iframeRef, isLivePreviewing, setIsLivePreviewing, breakpoint, setBreakpoint, isLivePreviewEnabled } = preview
  const [fields, dispatchFields] = useAllFormFields()
  const { moveFieldRow, removeFieldRow, addFieldRow, setModified } = useForm()
  const modified = useFormModified()
  const processing = useFormProcessing()
  const background = useFormBackgroundProcessing()
  const { config, getEntityConfig } = useConfig()
  const { i18n } = useTranslation()
  const locale = useLocale()
  const router = useRouter()
  const { startRouteTransition } = useRouteTransition()
  const lang = i18n.language === 'en' ? 'en' : 'tr'
  const localeCode = locale?.code === 'en' ? 'en' : 'tr'
  const apiBase = `${config.serverURL ?? ''}${config.routes?.api ?? '/api'}`

  const [selected, setSelected] = useState<string | null>(null)
  const [palette, setPalette] = useState<{ at: number } | null>(null)
  const [tour, setTour] = useState(false)
  const [history, setHistory] = useState<History<FormState>>(emptyHistory)
  const [flushedAt, setFlushedAt] = useState<string | null>(null)

  const fieldsRef = useRef(fields)
  fieldsRef.current = fields
  const rows = useMemo(() => rowsOf(fields), [fields])
  const rowsKey = rows.map((r) => `${r.id}:${r.blockType}`).join()

  /* ---------- block catalogue (labels, palette) ---------- */
  const blocks = useMemo(() => {
    const entity = getEntityConfig({ collectionSlug: collection }) as { fields?: ClientField[] } | undefined
    const field = findLayoutField(entity?.fields)
    const map = (config as { blocksMap?: Record<string, ClientBlock> }).blocksMap
    return [
      ...(field?.blocks ?? []),
      ...(field?.blockReferences ?? []).map((ref) => (typeof ref === 'string' ? map?.[ref] : ref)),
    ].filter((b): b is ClientBlock => Boolean(b?.slug))
  }, [collection, config, getEntityConfig])
  const labels = useMemo(() => Object.fromEntries(blocks.map((b) => [b.slug, labelOf(b.labels?.singular, lang, b.slug).slice(0, 80)])), [blocks, lang])

  /* ---------- history (form snapshots) ---------- */
  const settled = useRef<{ state: FormState; key: string } | null>(null)
  const restoring = useRef(false)
  const keyOf = (state: FormState) => JSON.stringify(stableValues(state))
  const settle = useCallback(() => {
    const now = fieldsRef.current
    const key = keyOf(now)
    const prev = settled.current
    if (!prev) { settled.current = { state: now, key }; return }
    if (prev.key === key) { settled.current = { state: now, key }; return }
    if (!restoring.current) setHistory((h) => record(h, prev.state))
    restoring.current = false
    settled.current = { state: now, key }
  }, [])
  useEffect(() => {
    // Debounced past Payload's own form-state round trip (new rows receive their sub-fields from the server).
    const timer = window.setTimeout(settle, 1200)
    return () => window.clearTimeout(timer)
  }, [fields, settle])

  const travel = useCallback((dir: 'undo' | 'redo') => {
    settle()
    const current = settled.current?.state ?? fieldsRef.current
    const step = dir === 'undo' ? undoStep(history, current) : redoStep(history, current)
    if (!step) return
    restoring.current = true
    setHistory(step.history)
    settled.current = { state: step.state, key: keyOf(step.state) }
    dispatchFields({ type: 'REPLACE_STATE', state: step.state })
    setModified(true)
  }, [dispatchFields, history, setModified, settle])

  /* ---------- messaging ---------- */
  const post = useCallback((body: HostMessageBody) => {
    iframeRef.current?.contentWindow?.postMessage(envelope(body), window.location.origin)
  }, [iframeRef])
  const notice = useCallback((label: { tr: string; en: string }) => post({ type: 'notice', message: t(label, lang) }), [lang, post])
  const locks = useMemo(() => canvasLocks(collection), [collection])

  const sendState = useCallback(() => {
    post({ type: 'host', collection, lang, locked: locks, labels, selected, canUndo: history.past.length > 0, canRedo: history.future.length > 0 })
  }, [collection, history, labels, lang, locks, post, selected])
  useEffect(() => { if (isLivePreviewing) sendState() }, [isLivePreviewing, sendState, rowsKey])

  const stopReveal = useRef<(() => void) | null>(null)
  const reveal = useCallback((index: number) => {
    stopReveal.current?.()
    const current = (fieldsRef.current.layout?.rows ?? []) as Row[]
    if (current[index]?.collapsed) {
      dispatchFields({ type: 'SET_ROW_COLLAPSED', path: 'layout', updatedRows: current.map((r, i) => (i === index ? { ...r, collapsed: false } : r)) } as never)
    }
    stopReveal.current = revealRow('layout', index)
  }, [dispatchFields])
  useEffect(() => () => stopReveal.current?.(), [])

  /** V2 compatibility product: store the 8 bound sections as references (no content copy), keep the look. */
  const materialize = useCallback(() => {
    const now = fieldsRef.current
    const current = rowsOf(now)
    const count = (path: string) => ((now[path]?.rows ?? []) as unknown[]).length
    const hide = compatFilteredRows(current, { features: count('features') > 0, specs: count('specs') > 0 })
    PRODUCT_BOUND_BLOCKS.forEach((blockType, at) => addFieldRow({ path: 'layout', schemaPath: 'layout', blockType, rowIndex: at }))
    for (const i of hide) {
      const path = `layout.${i + PRODUCT_BOUND_BLOCKS.length}.appearance.hidden`
      if (has(now, `layout.${i}.appearance.hidden`)) dispatchFields({ type: 'UPDATE', path, value: true })
    }
    setModified(true)
    notice(V.notices.materialized)
  }, [addFieldRow, dispatchFields, notice, setModified])

  const textTarget = useCallback((msg: Extract<BridgeMessage, { type: 'textBegin' | 'text' }>, now: FormState): string | null => {
    if (msg.locale !== localeCode) return null
    if (msg.scope === 'doc') return isInlineDocField(collection, msg.path) && has(now, msg.path) ? msg.path : null
    if (!msg.id || isVirtualId(msg.id)) return null
    const current = rowsOf(now)
    const index = current.findIndex((r) => r.id === msg.id)
    if (index < 0 || !isInlineBlockField(current[index]!.blockType, msg.path)) return null
    const full = `layout.${index}.${msg.path}`
    return has(now, full) ? full : null
  }, [collection, localeCode])

  const deferred = useRef<{ msg: BridgeMessage; until: number } | null>(null)
  const expectNew = useRef<Set<string> | null>(null)

  const apply = useCallback((msg: BridgeMessage): Outcome => {
    const now = fieldsRef.current
    const current = rowsOf(now)
    const indexOf = (blockId: string) => rowIndexOf(current, blockId)
    const structural = msg.type === 'move' || msg.type === 'duplicate' || msg.type === 'hide' || msg.type === 'remove' || msg.type === 'insert'
    if (structural) {
      if (needsMaterialize(collection, current)) { materialize(); return 'wait' }
      settle()
    }
    switch (msg.type) {
      case 'ready': sendState(); return 'done'
      case 'select': {
        setSelected(msg.id)
        const i = msg.id ? indexOf(msg.id) : -1
        if (i >= 0) reveal(i)
        return 'done'
      }
      case 'move': {
        const from = indexOf(msg.id)
        const target = indexOf(msg.target)
        if (from < 0 || target < 0) { notice(V.notices.invalid); return 'done' }
        const to = moveIndex(from, target, msg.place)
        if (to === from) return 'done'
        const plan = planMove(collection, current, from, to)
        if (!plan.ok) { notice(plan.reason === 'heroFirst' ? V.notices.heroFirst : V.notices.invalid); return 'done' }
        moveFieldRow({ path: 'layout', moveFromIndex: from, moveToIndex: to })
        return 'done'
      }
      case 'duplicate': {
        const i = indexOf(msg.id)
        if (i < 0 || locks.duplicate.includes(current[i]!.blockType)) { notice(V.notices.cannotDuplicate); return 'done' }
        expectNew.current = new Set(current.map((r) => r.id))
        dispatchFields({ type: 'DUPLICATE_ROW', path: 'layout', rowIndex: i })
        setModified(true)
        return 'done'
      }
      case 'hide': {
        const i = indexOf(msg.id)
        const path = `layout.${i}.appearance.hidden`
        if (i < 0 || locks.hide.includes(current[i]!.blockType)) { notice(V.notices.cannotHide); return 'done' }
        if (!has(now, path)) return 'wait' // sub-fields of a just-added row arrive with Payload's form state
        dispatchFields({ type: 'UPDATE', path, value: msg.hidden })
        setModified(true)
        return 'done'
      }
      case 'remove': {
        const i = indexOf(msg.id)
        if (i < 0 || locks.remove.includes(current[i]!.blockType)) { notice(V.notices.cannotRemove); return 'done' }
        removeFieldRow({ path: 'layout', rowIndex: i })
        if (selected === msg.id) setSelected(null)
        return 'done'
      }
      case 'insert': {
        let at = msg.after === null ? 0 : indexOf(msg.after) + 1
        if (msg.after !== null && at === 0) { notice(V.notices.invalid); return 'done' }
        if (collection === 'products' && at === 0 && current[0]?.blockType === 'productHero') at = 1
        setPalette({ at })
        return 'done'
      }
      case 'textBegin': {
        const path = textTarget(msg, now)
        const value = path ? now[path]?.value : undefined
        const ok = Boolean(path) && (value == null || (typeof value === 'string' && !value.includes('\n') && value.length <= INLINE_MAX))
        if (path && !ok) notice(V.canvas.formOnly)
        if (msg.locale !== localeCode) notice(V.notices.locale)
        post({ type: 'textGrant', path: msg.path, id: msg.id, ok, fallback: ok && !value })
        return 'done'
      }
      case 'text': {
        const path = textTarget(msg, now)
        const value = path ? now[path]?.value : undefined
        if (!path || (value != null && typeof value !== 'string') || (typeof value === 'string' && value.includes('\n'))) return 'done'
        if (value === msg.value) return 'done'
        dispatchFields({ type: 'UPDATE', path, value: msg.value })
        setModified(true)
        return 'done'
      }
      case 'textEnd': return 'done'
      case 'history': travel(msg.action); return 'done'
    }
  }, [collection, dispatchFields, localeCode, locks, materialize, moveFieldRow, notice, post, removeFieldRow, reveal, selected, sendState, setModified, settle, textTarget, travel])

  // Retry an operation that waited for the form (materialised sections / new row sub-fields).
  useEffect(() => {
    const pending = deferred.current
    if (!pending) return
    if (Date.now() > pending.until) { deferred.current = null; return }
    if (apply(pending.msg) === 'done') deferred.current = null
  }, [apply, fields])

  // Select (and open) a block the editor just added or duplicated.
  useEffect(() => {
    const before = expectNew.current
    if (!before) return
    const index = rows.findIndex((r) => !before.has(r.id))
    if (index < 0) return
    expectNew.current = null
    setSelected(rows[index]!.id)
    post({ type: 'select', id: rows[index]!.id })
    reveal(index)
  }, [post, reveal, rows])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const msg = acceptMessage(event, { origin: window.location.origin, source: iframeRef.current?.contentWindow ?? null }, bridgeMessage)
      if (!msg) return
      if (apply(msg) === 'wait') deferred.current = { msg, until: Date.now() + 5000 }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [apply, iframeRef])

  /* ---------- save guards ---------- */
  const doc = useMemo(() => ({ apiBase, collection, id }), [apiBase, collection, id])
  const { conflict, dismiss } = useConflictWatch({ doc, known: [...knownUpdatedAt, flushedAt], busy: processing || background })
  const flush = useAutosaveFlush({
    doc: useMemo(() => ({ ...doc, locale: localeCode }), [doc, localeCode]),
    fields, modified, paused: Boolean(conflict), onSaved: setFlushedAt,
  })

  const switchLocale = useCallback(async (code: 'tr' | 'en') => {
    if (code === localeCode) return
    if (await flush('await')) setModified(false)
    const params = new URLSearchParams(window.location.search)
    params.set('locale', code)
    startRouteTransition(() => router.push(`?${params}`))
  }, [flush, localeCode, router, setModified, startRouteTransition])

  // Undo/redo shortcuts in the admin (not while typing in a form input).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? '')) return
      if (event.key === 'z' || event.key === 'Z') { event.preventDefault(); travel(event.shiftKey ? 'redo' : 'undo') }
      else if (event.key === 'y') { event.preventDefault(); travel('redo') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [travel])

  // Visual editing is the default on every open: "classic form" is a per-visit choice. Payload stores the toggle as
  // the user's `editViewType` preference, so it is reset to the canvas for the next open; a classic preference
  // stored earlier (before this editor) is overridden once on mount.
  const { setPreference } = usePreferences()
  const toggled = useRef(false)
  useEffect(() => {
    if (!toggled.current && !isLivePreviewing && isLivePreviewEnabled) setIsLivePreviewing(true)
    if (!toggled.current || isLivePreviewing) return
    const timer = window.setTimeout(() => void setPreference(`collection-${collection}`, { editViewType: 'live-preview' }, true), 800)
    return () => window.clearTimeout(timer)
  }, [collection, isLivePreviewEnabled, isLivePreviewing, setIsLivePreviewing, setPreference])

  // First-run tips once the visual editor is on screen.
  useEffect(() => { if (isLivePreviewing && !tourSeen()) setTour(true) }, [isLivePreviewing])

  const paletteBlocks: PaletteBlock[] = useMemo(() => {
    const systemPage = Boolean(fields.systemKey?.value)
    const allowed = new Set(paletteTypes(collection, blocks.map((b) => b.slug), rows, { systemPage }))
    return blocks.filter((b) => allowed.has(b.slug)).map((b) => ({
      slug: b.slug, label: labels[b.slug] ?? b.slug, imageURL: b.imageURL,
      group: b.admin?.group ? labelOf(b.admin.group, lang, '') || t(V.palette.other, lang) : t(V.palette.other, lang),
    }))
  }, [blocks, collection, fields.systemKey?.value, labels, lang, rows])

  const pick = (slug: string) => {
    if (!palette) return
    expectNew.current = new Set(rows.map((r) => r.id))
    addFieldRow({ path: 'layout', schemaPath: 'layout', blockType: slug, rowIndex: Math.min(palette.at, rows.length) })
    setPalette(null)
  }

  if (!isLivePreviewEnabled) return null
  const status = background || processing ? t(V.bar.saving, lang) : modified ? t(V.bar.unsaved, lang) : t(V.bar.saved, lang)
  const btn = (active = false): React.CSSProperties => ({
    margin: 0, padding: '4px 8px', minHeight: 28, borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: 13,
    border: '1px solid var(--theme-elevation-200, #ccc)', color: 'var(--theme-text)',
    background: active ? 'var(--theme-elevation-150, #e5e7eb)' : 'var(--theme-elevation-0, #fff)', fontWeight: active ? 700 : 500,
  })
  return (
    <div data-visual-editor-bar="" role="toolbar" aria-label={t(V.bar.label, lang)}
      style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginRight: 8, fontSize: 13 }}>
      <button type="button" style={btn(!isLivePreviewing)} data-ve="mode" onClick={() => { toggled.current = true; setIsLivePreviewing(!isLivePreviewing) }}>
        {isLivePreviewing ? t(V.bar.classic, lang) : t(V.bar.visual, lang)}
      </button>
      {isLivePreviewing ? (
        <>
          <span role="group" aria-label={`${t(V.bar.undo, lang)} / ${t(V.bar.redo, lang)}`} style={{ display: 'inline-flex', gap: 2 }}>
            <button type="button" style={btn()} data-ve="undo" disabled={!history.past.length} title={`${t(V.bar.undo, lang)} (Ctrl+Z)`} aria-label={t(V.bar.undo, lang)} onClick={() => travel('undo')}>↶</button>
            <button type="button" style={btn()} data-ve="redo" disabled={!history.future.length} title={`${t(V.bar.redo, lang)} (Ctrl+Shift+Z)`} aria-label={t(V.bar.redo, lang)} onClick={() => travel('redo')}>↷</button>
          </span>
          <span role="group" aria-label={t(V.bar.device, lang)} style={{ display: 'inline-flex', gap: 2 }}>
            {DEVICES.map((d) => (
              <button key={d.name} type="button" style={btn(breakpoint === d.name)} aria-pressed={breakpoint === d.name} data-ve={`device-${d.name}`}
                onClick={() => setBreakpoint(d.name)}>{d.label ?? t(V.bar.fit, lang)}</button>
            ))}
          </span>
          <span role="group" aria-label={t(V.bar.language, lang)} style={{ display: 'inline-flex', gap: 2 }}>
            {LOCALES.map((code) => (
              <button key={code} type="button" style={btn(localeCode === code)} aria-pressed={localeCode === code} data-ve={`locale-${code}`}
                onClick={() => void switchLocale(code)}>{code.toUpperCase()}</button>
            ))}
          </span>
          <span data-ve="status" aria-live="polite" title={t(V.bar.publishHint, lang)} style={{ opacity: 0.75, whiteSpace: 'nowrap' }}>{status}</span>
          <button type="button" style={btn()} data-ve="tour" onClick={() => setTour(true)}>{t(V.bar.help, lang)}</button>
        </>
      ) : null}
      {conflict ? (
        <div role="alert" data-ve="conflict" style={{ flexBasis: '100%', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '8px 10px', borderRadius: 4, background: 'var(--theme-warning-100, #fef3c7)', color: 'var(--theme-warning-800, #78350f)' }}>
          <span style={{ flex: '1 1 260px' }}>{t(V.bar.conflict, lang)}</span>
          <button type="button" style={btn()} data-ve="reload" onClick={() => window.location.reload()}>{t(V.bar.reload, lang)}</button>
          <button type="button" style={btn()} data-ve="keep" onClick={dismiss}>{t(V.bar.keep, lang)}</button>
        </div>
      ) : null}
      {palette ? <BlockPalette blocks={paletteBlocks} lang={lang} onPick={pick} onClose={() => setPalette(null)} /> : null}
      {tour && isLivePreviewing ? <EditorTour lang={lang} onClose={() => setTour(false)} /> : null}
    </div>
  )
}

export default VisualEditorHost
