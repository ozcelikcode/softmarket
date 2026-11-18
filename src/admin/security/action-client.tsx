'use client'

import { useRouter } from 'next/navigation'
import React, { useEffect, useId, useRef, useState } from 'react'

import { SECURITY_CENTER_LABELS as L, type SecurityLabel } from '@/lib/security-center-labels'

/*
 * L6b client half of every security action (security center tables, license side panel, signing key rotation).
 * Imports nothing from the server code: it collects a reason (mandatory), an optional note and any typed confirmation,
 * then POSTs JSON to the admin-only endpoint with the panel cookie (same origin). The server decides everything and
 * answers with a short code, shown here as a message; the page is then refreshed from the server.
 * Idempotency: one `requestId` per opened dialog. A network failure keeps it, so "retry" cannot apply an action twice;
 * any answer from the server ends the dialog.
 * Accessibility: the confirmation is an inline labelled dialog region (no modal trap), focus moves to the first input
 * and back to the trigger; Escape cancels; results are announced through a polite live region.
 */

export type Lang = 'tr' | 'en'

type Option = { value: string; label: string }
export type ActionField =
  | { name: string; type: 'select'; label: SecurityLabel; options: Option[]; initial?: string }
  | { name: string; type: 'text'; label: SecurityLabel; placeholder?: string; maxLength?: number; required?: boolean }
  | { name: string; type: 'checkbox'; label: SecurityLabel; revealOnCode?: string }

type Values = Record<string, string | boolean>

/** The router exists in the admin app; static renders (tests) have none, so fall back to a full reload there. */
function useOptionalRouter(): { refresh(): void } | null {
  try {
    return useRouter()
  } catch {
    return null
  }
}

export function newRequestId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

const resultText = (lang: Lang, code: string | undefined, status: number): string => {
  const map = L.actions.results as Record<string, SecurityLabel>
  if (code && map[code]) return map[code][lang]
  return `${lang === 'en' ? 'Error' : 'Hata'} (${status}${code ? ` ${code}` : ''})`
}

export function ActionForm(props: {
  lang: Lang
  url: string
  label: SecurityLabel
  question: SecurityLabel
  tone?: 'primary' | 'secondary' | 'danger'
  fields?: ActionField[]
  /** Typed confirmation: the server compares it (revoke, rotation). `hint` is shown next to the input. */
  typedConfirm?: { label: SecurityLabel; hint?: string }
  body?: (values: Values) => Record<string, unknown>
  testId?: string
}) {
  const { lang } = props
  const router = useOptionalRouter()
  const uid = useId()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [values, setValues] = useState<Values>({})
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const requestId = useRef<string>('')
  const firstInput = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => { if (open) firstInput.current?.focus() }, [open])

  const start = () => {
    const initial: Values = {}
    for (const f of props.fields ?? []) if (f.type === 'select') initial[f.name] = f.initial ?? f.options[0]?.value ?? ''
    setValues(initial)
    setRevealed(new Set())
    setMessage(null)
    requestId.current = newRequestId()
    setOpen(true)
  }
  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }

  const reason = String(values.reason ?? '').trim()
  const ready = reason.length >= 3 && (!props.typedConfirm || String(values.confirm ?? '').trim().length > 0)
    && (props.fields ?? []).every((f) => f.type !== 'text' || !f.required || String(values[f.name] ?? '').trim())

  async function submit() {
    if (!ready || busy) return
    setBusy(true)
    setMessage(null)
    const payload = {
      ...(props.body ? props.body(values) : {}),
      requestId: requestId.current,
      reason,
      ...(String(values.note ?? '').trim() ? { note: String(values.note).trim() } : {}),
      ...(props.typedConfirm ? { confirm: String(values.confirm ?? '').trim() } : {}),
    }
    let res: Response
    try {
      res = await fetch(props.url, {
        method: 'POST', credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch {
      // Same requestId on retry: the server applies the action at most once.
      setMessage({ text: L.actions.results.network[lang], ok: false })
      setBusy(false)
      return
    }
    const answer = (await res.json().catch(() => ({}))) as { code?: string; kid?: string }
    setBusy(false)
    const text = resultText(lang, answer.code, res.status) + (answer.kid ? ` ${L.actions.signing.newKid[lang]}: ${answer.kid}` : '')
    const reveal = (props.fields ?? []).find((f) => f.type === 'checkbox' && f.revealOnCode && f.revealOnCode === answer.code)
    if (reveal) {
      // The server asks for an extra confirmation: keep the dialog (and its requestId; nothing was written).
      setRevealed((prev) => new Set(prev).add(reveal.name))
      setMessage({ text, ok: false })
      return
    }
    setMessage({ text, ok: res.ok })
    setOpen(false)
    if (res.ok) {
      if (router) router.refresh()
      else window.location.reload()
    }
  }

  const set = (name: string, value: string | boolean) => setValues((prev) => ({ ...prev, [name]: value }))
  const buttonClass = (tone: 'primary' | 'secondary' | 'danger' | undefined) =>
    `btn btn--size-small ${tone === 'primary' || tone === 'danger' ? 'btn--style-primary' : 'btn--style-secondary'}${tone === 'danger' ? ' sc-btn--danger' : ''}`

  return (
    <div className="sc-action" data-sc-action={props.testId}>
      {!open ? (
        <button ref={trigger} type="button" className={buttonClass(props.tone)} onClick={start} aria-expanded={false} data-sc-action-open={props.testId}>
          {props.label[lang]}
        </button>
      ) : (
        // Not a <form>: the license panel renders inside Payload's document form, and nested forms are invalid (the
        // submit would save the document instead). Enter in a single-line input confirms here and never reaches it.
        <div className="sc-dialog" role="dialog" aria-modal="false" aria-labelledby={`${uid}-t`} aria-describedby={`${uid}-q`}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !busy) { e.stopPropagation(); close() }
            if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') { e.preventDefault(); e.stopPropagation(); void submit() }
          }}>
          <strong id={`${uid}-t`} className="sc-dialog__title">{props.label[lang]}</strong>
          <p id={`${uid}-q`} className="sc-dialog__question">{props.question[lang]}</p>
          {(props.fields ?? []).map((f, index) => {
            const id = `${uid}-${f.name}`
            if (f.type === 'checkbox') {
              if (f.revealOnCode && !revealed.has(f.name)) return null
              return (
                <label key={f.name} className="sc-dialog__check" htmlFor={id}>
                  <input id={id} type="checkbox" checked={values[f.name] === true} onChange={(e) => set(f.name, e.target.checked)} /> {f.label[lang]}
                </label>
              )
            }
            if (f.type === 'select') {
              return (
                <div key={f.name} className="sc-field">
                  <label htmlFor={id}>{f.label[lang]}</label>
                  <select id={id} value={String(values[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)}>
                    {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              )
            }
            return (
              <div key={f.name} className="sc-field">
                <label htmlFor={id}>{f.label[lang]}</label>
                <input ref={index === 0 ? firstInput : undefined} id={id} type="text" autoComplete="off" spellCheck={false} maxLength={f.maxLength ?? 64}
                  placeholder={f.placeholder} required={f.required} value={String(values[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)} />
              </div>
            )
          })}
          <div className="sc-field">
            <label htmlFor={`${uid}-reason`}>{L.actions.reason[lang]}</label>
            <input ref={(props.fields ?? []).some((f) => f.type === 'text') ? undefined : firstInput} id={`${uid}-reason`} name="reason" type="text" required minLength={3} maxLength={500}
              autoComplete="off" aria-describedby={`${uid}-reason-hint`} value={String(values.reason ?? '')} onChange={(e) => set('reason', e.target.value)} data-sc-reason="" />
            <span id={`${uid}-reason-hint`} className="sc-hint">{L.actions.reasonHint[lang]}</span>
          </div>
          <div className="sc-field">
            <label htmlFor={`${uid}-note`}>{L.actions.note[lang]}</label>
            <textarea id={`${uid}-note`} name="note" rows={2} maxLength={500} value={String(values.note ?? '')} onChange={(e) => set('note', e.target.value)} />
          </div>
          {props.typedConfirm ? (
            <div className="sc-field">
              <label htmlFor={`${uid}-confirm`}>{props.typedConfirm.label[lang]}{props.typedConfirm.hint ? <>: <code className="sc-mono">{props.typedConfirm.hint}</code></> : null}</label>
              <input id={`${uid}-confirm`} name="confirm" type="text" autoComplete="off" spellCheck={false} maxLength={40} required
                value={String(values.confirm ?? '')} onChange={(e) => set('confirm', e.target.value)} data-sc-confirm="" />
            </div>
          ) : null}
          <div className="sc-dialog__buttons">
            <button type="button" onClick={() => void submit()} className={buttonClass(props.tone === 'secondary' ? 'primary' : props.tone)} disabled={!ready || busy} data-sc-action-confirm={props.testId}>
              {busy ? L.actions.busy[lang] : `${props.label[lang]} — ${L.actions.confirm[lang]}`}
            </button>
            <button type="button" className="btn btn--style-secondary btn--size-small" disabled={busy} onClick={close}>{L.actions.cancel[lang]}</button>
          </div>
        </div>
      )}
      <p role="status" aria-live="polite" className={message ? `sc-action__msg${message.ok ? '' : ' sc-action__msg--error'}` : 'sc-action__msg sc-sr'} data-sc-message="">{message?.text ?? ''}</p>
    </div>
  )
}

/** A compact group of actions that share a row (e.g. per table row). */
export function ActionGroup({ children }: { children: React.ReactNode }) {
  return <div className="sc-action-group">{children}</div>
}
