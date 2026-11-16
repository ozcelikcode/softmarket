'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { t, VISUAL_EDITOR_LABELS } from '@/lib/visual-editor-labels'

/*
 * V5 visual editor (admin): 4-step first-run tips (TR/EN from the admin dictionary). Shown once per browser; the
 * "seen" flag lives in localStorage and every access is guarded (private mode / blocked storage => the tour may
 * show again, never an error). Non-modal card in the corner, so the editor stays usable.
 */
export const TOUR_KEY = 'sm-visual-editor-tour-v1'

export function tourSeen(): boolean {
  try { return window.localStorage.getItem(TOUR_KEY) === '1' } catch { return false }
}
export function markTourSeen(): void {
  try { window.localStorage.setItem(TOUR_KEY, '1') } catch { /* storage unavailable: nothing to persist */ }
}

const T = VISUAL_EDITOR_LABELS.tour

export function EditorTour({ lang, onClose }: { lang: string; onClose: () => void }) {
  const [step, setStep] = useState(0)
  const primary = useRef<HTMLButtonElement>(null)
  const steps = T.steps
  const [title, body] = steps[step]!
  const last = step === steps.length - 1
  useEffect(() => { primary.current?.focus() }, [step])
  const close = () => { markTourSeen(); onClose() }
  return createPortal(
    <div role="dialog" aria-modal="false" aria-labelledby="sm-tour-title" data-canvas-tour=""
      onKeyDown={(e) => { if (e.key === 'Escape') close() }}
      style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 100001, width: 'min(380px, calc(100vw - 32px))', padding: 18, borderRadius: 8, background: 'var(--theme-elevation-0, #fff)', color: 'var(--theme-text, #111)', border: '1px solid var(--theme-elevation-150, #ddd)', boxShadow: '0 12px 40px rgba(0,0,0,.3)' }}>
      <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>{t(T.step, lang)} {step + 1}/{steps.length}</p>
      <h2 id="sm-tour-title" style={{ margin: '4px 0 8px', fontSize: 17 }}>{t(title, lang)}</h2>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{t(body, lang)}</p>
      <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn--style-secondary btn--size-small" style={{ margin: 0, marginRight: 'auto' }} onClick={close}>{t(T.close, lang)}</button>
        {step > 0 ? <button type="button" className="btn btn--style-secondary btn--size-small" style={{ margin: 0 }} onClick={() => setStep(step - 1)}>{t(T.back, lang)}</button> : null}
        <button ref={primary} type="button" className="btn btn--style-primary btn--size-small" style={{ margin: 0 }} data-canvas-tour-next=""
          onClick={() => (last ? close() : setStep(step + 1))}>{t(last ? T.done : T.next, lang)}</button>
      </div>
    </div>,
    document.body,
  )
}
