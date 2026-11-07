'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

import { AppLink } from '@/components/ui/app-link'
import { Button } from '@/components/ui/button'
import type { PortalFormState } from '@/lib/portal/schemas'

import { Turnstile } from './turnstile'

export type PortalField = {
  name: string
  label: string
  type?: 'text' | 'email' | 'password' | 'tel' | 'textarea' | 'select' | 'checkbox'
  autoComplete?: string
  required?: boolean
  minLength?: number
  maxLength?: number
  rows?: number
  hint?: string
  defaultValue?: string
  options?: { value: string; label: string }[]
  /** Checkbox only: link shown under the label. */
  link?: { href: string; label: string }
  inputMode?: 'numeric' | 'tel'
}

type Props = {
  action: (state: PortalFormState, data: FormData) => Promise<PortalFormState>
  id: string
  locale: string
  fields: PortalField[]
  hidden?: Record<string, string>
  submitLabel: string
  /** Status key -> message. `success` is rendered as a calm status block. */
  messages: Partial<Record<PortalFormState['status'], string>>
  fieldError: string
  sendingLabel: string
  honeypotLabel?: string
  turnstileSiteKey?: string
  /** Replace the form with the success message (e.g. "check your email"). */
  replaceOnSuccess?: { title: string }
  resetOnSuccess?: boolean
  className?: string
}

const inputClass =
  'mt-1 block w-full rounded-md border border-border-strong bg-surface px-3 py-2.5 text-text placeholder:text-muted aria-[invalid=true]:border-danger'

export function PortalForm(props: Props) {
  const { action, id, locale, fields, hidden = {}, submitLabel, messages, fieldError, sendingLabel } = props
  // React 19 resets uncontrolled fields after an action; keep what the user typed (never passwords).
  const [values, setValues] = useState<Record<string, string>>({})
  const secret = new Set(fields.filter((f) => f.type === 'password').map((f) => f.name))
  const [state, formAction, pending] = useActionState(
    async (previous: PortalFormState, data: FormData) => {
      setValues(
        Object.fromEntries(
          [...data.entries()].filter((e): e is [string, string] => typeof e[1] === 'string' && !secret.has(e[0])),
        ),
      )
      return action(previous, data)
    },
    { status: 'idle' } as PortalFormState,
  )
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state.status === 'idle') return
    if (state.status === 'success' && props.resetOnSuccess) ref.current?.reset()
    const target =
      ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      ref.current?.querySelector<HTMLElement>('[data-status]')
    target?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  if (state.status === 'success' && props.replaceOnSuccess) {
    return (
      <div role="status" tabIndex={-1} ref={(el) => el?.focus()} className="rounded-lg border border-border bg-surface p-6">
        <p className="text-h4">{props.replaceOnSuccess.title}</p>
        <p className="mt-2 text-muted">{messages.success}</p>
      </div>
    )
  }

  const message = state.status !== 'idle' ? messages[state.status] : undefined
  const failed = state.status !== 'idle' && state.status !== 'success'
  const attrs = (name: string, hint?: string) => ({
    id: `${id}-${name}`,
    name,
    'aria-invalid': Boolean(state.errors?.[name]),
    'aria-describedby':
      [state.errors?.[name] ? `${id}-${name}-error` : '', hint ? `${id}-${name}-hint` : ''].filter(Boolean).join(' ') ||
      undefined,
  })

  return (
    <form ref={ref} action={formAction} noValidate={false} className={props.className ?? 'space-y-5'}>
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input type="hidden" name="locale" value={locale} />
      {message ? (
        <p
          data-status
          tabIndex={-1}
          role={failed ? 'alert' : 'status'}
          className={
            failed
              ? 'rounded-md border border-danger bg-danger/5 p-4 text-danger'
              : 'rounded-md border border-success bg-success/5 p-4 text-success'
          }
        >
          {message}
        </p>
      ) : null}
      {fields.map((f) => {
        const type = f.type ?? 'text'
        return (
          <div key={f.name}>
            {type === 'checkbox' ? (
              <>
                <label className="flex items-start gap-3" htmlFor={`${id}-${f.name}`}>
                  <input {...attrs(f.name, f.hint)} type="checkbox" required={f.required} defaultChecked={values[f.name] === 'on'} className="mt-1 size-4 shrink-0 accent-accent" />
                  <span>{f.label}</span>
                </label>
                {f.link ? (
                  <AppLink href={f.link.href} locale={locale} className="ml-7 mt-1 inline-block text-small text-accent underline">
                    {f.link.label}
                  </AppLink>
                ) : null}
              </>
            ) : (
              <>
                <label htmlFor={`${id}-${f.name}`} className="font-medium">
                  {f.label}
                  {f.required ? <span aria-hidden className="text-muted"> *</span> : null}
                </label>
                {type === 'textarea' ? (
                  <textarea
                    {...attrs(f.name, f.hint)}
                    className={inputClass}
                    rows={f.rows ?? 6}
                    required={f.required}
                    minLength={f.minLength}
                    maxLength={f.maxLength}
                    defaultValue={values[f.name] ?? f.defaultValue}
                  />
                ) : type === 'select' ? (
                  <select {...attrs(f.name, f.hint)} className={inputClass} required={f.required} defaultValue={values[f.name] ?? f.defaultValue ?? ''}>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    {...attrs(f.name, f.hint)}
                    type={type}
                    className={inputClass}
                    autoComplete={f.autoComplete}
                    required={f.required}
                    minLength={f.minLength}
                    maxLength={f.maxLength}
                    inputMode={f.inputMode}
                    defaultValue={values[f.name] ?? f.defaultValue}
                  />
                )}
              </>
            )}
            {f.hint ? (
              <p id={`${id}-${f.name}-hint`} className="mt-1 text-small text-muted">
                {f.hint}
              </p>
            ) : null}
            {state.errors?.[f.name] ? (
              <p id={`${id}-${f.name}-error`} className="mt-1 text-small text-danger">
                {fieldError}
              </p>
            ) : null}
          </div>
        )
      })}
      {props.honeypotLabel ? (
        <div className="hidden" aria-hidden="true">
          <label htmlFor={`${id}-website`}>{props.honeypotLabel}</label>
          <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" maxLength={200} />
        </div>
      ) : null}
      <Turnstile siteKey={props.turnstileSiteKey} locale={locale} resetKey={state} />
      <Button type="submit" disabled={pending} aria-disabled={pending}>
        {pending ? sendingLabel : submitLabel}
      </Button>
    </form>
  )
}
