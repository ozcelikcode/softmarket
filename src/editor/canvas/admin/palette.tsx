'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { t, VISUAL_EDITOR_LABELS } from '@/lib/visual-editor-labels'

/*
 * V5 visual editor (admin): block palette. Cards with the block's preview image (`public/admin/blocks/<slug>.webp`,
 * the block config's `imageURL`), grouped by the block's admin group, with search. Modal dialog: focus starts in
 * the search box, Tab stays inside, Esc / backdrop closes and focus returns to where it was.
 */

export type PaletteBlock = { slug: string; label: string; group: string; imageURL?: string }

const P = VISUAL_EDITOR_LABELS.palette

export function BlockPalette({ blocks, lang, onPick, onClose }: {
  blocks: PaletteBlock[]
  lang: string
  onPick: (slug: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const dialog = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    search.current?.focus()
    return () => previous?.focus?.()
  }, [])

  const groups = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(lang)
    const hits = blocks.filter((b) => !q || b.label.toLocaleLowerCase(lang).includes(q) || b.slug.toLowerCase().includes(q))
    const map = new Map<string, PaletteBlock[]>()
    for (const b of hits) map.set(b.group, [...(map.get(b.group) ?? []), b])
    return [...map]
  }, [blocks, lang, query])

  const trap = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
    if (event.key !== 'Tab' || !dialog.current) return
    const focusable = [...dialog.current.querySelectorAll<HTMLElement>('button, input')]
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }

  return createPortal(
    <div data-canvas-palette="" onKeyDown={trap} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(15,23,42,.55)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="sm-palette-title"
        style={{ background: 'var(--theme-elevation-0, #fff)', color: 'var(--theme-text, #111)', borderRadius: 8, padding: 20, width: 'min(920px, 100%)', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.35)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
          <h2 id="sm-palette-title" style={{ margin: 0, fontSize: 18, flex: '0 0 auto' }}>{t(P.title, lang)}</h2>
          <input ref={search} type="search" value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t(P.search, lang)} placeholder={t(P.search, lang)}
            style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 4, border: '1px solid var(--theme-elevation-150, #ccc)', background: 'var(--theme-input-bg, #fff)', color: 'inherit' }} />
          <button type="button" className="btn btn--style-secondary btn--size-small" style={{ margin: 0 }} onClick={onClose}>{t(P.close, lang)}</button>
        </div>
        {groups.length ? groups.map(([group, items]) => (
          <section key={group} style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '.04em', opacity: 0.7, margin: '0 0 8px' }}>{group}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {items.map((b) => (
                <button key={b.slug} type="button" data-canvas-block={b.slug} onClick={() => onPick(b.slug)}
                  style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, border: '1px solid var(--theme-elevation-150, #ddd)', borderRadius: 6, background: 'transparent', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- static admin preview thumbnails */}
                  {b.imageURL ? <img src={b.imageURL} alt="" width={134} height={84} loading="lazy" style={{ width: '100%', height: 'auto', aspectRatio: '134 / 84', objectFit: 'cover', borderRadius: 4, background: 'var(--theme-elevation-50, #f3f4f6)' }} /> : null}
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{b.label}</span>
                </button>
              ))}
            </div>
          </section>
        )) : <p>{t(P.empty, lang)}</p>}
      </div>
    </div>,
    document.body,
  )
}
