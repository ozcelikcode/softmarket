'use client'

import Script from 'next/script'
import { useNonce } from '@/components/security/nonce-provider'
import { useActionState, useEffect, useRef, useState, type FormEvent } from 'react'
import { AppLink } from '@/components/ui/app-link'
import { Button } from '@/components/ui/button'
import { submitLead } from '@/lib/forms/action'
import type { FormKind, FormState } from '@/lib/forms/schema'

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string
      remove: (id: string) => void
      reset: (id: string) => void
    }
  }
}
const inputClass =
  'mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2.5 text-text aria-[invalid=true]:border-danger'
/** Visual-only marker; the inputs carry the real `required` attribute for assistive tech. */
const RequiredMark = () => (
  <span aria-hidden="true" className="text-danger">
    {' '}
    *
  </span>
)

export function LeadForm({
  kind,
  locale,
  labels,
  fields,
  submitLabel,
  products,
  editions,
  initial,
  siteKey,
}: {
  kind: FormKind
  locale: string
  labels: Record<string, string>
  fields: Record<string, string>
  submitLabel?: string | null
  products: { id: number; title: string; slug: string }[]
  editions: { title: string; sku: string; product: number }[]
  initial: { product: string; sku: string }
  siteKey?: string
}) {
  const nonce = useNonce()
  const [state, action, pending] = useActionState(submitLead, { status: 'idle' } as FormState)
  const ref = useRef<HTMLFormElement>(null)
  const widget = useRef<HTMLDivElement>(null)
  const widgetID = useRef<string | undefined>(undefined)
  const [ready, setReady] = useState(false)
  const [product, setProduct] = useState(initial.product)
  const [sku, setSku] = useState(initial.sku)
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!ready || !siteKey || !widget.current || !window.turnstile) return
    widgetID.current = window.turnstile.render(widget.current, {
      sitekey: siteKey,
      language: locale,
    })
    return () => {
      if (widgetID.current) window.turnstile?.remove(widgetID.current)
    }
  }, [ready, siteKey, locale])
  useEffect(() => {
    if (state.status === 'idle') return
    if (widgetID.current) window.turnstile?.reset(widgetID.current)
    const invalid = ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
    ;(invalid ?? ref.current?.querySelector<HTMLElement>('[data-status]'))?.focus()
  }, [state])
  useEffect(() => {
    if (Object.keys(clientErrors).length)
      ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [clientErrors])
  // Client errors (specific messages) win while present; otherwise show the server's generic field error.
  const hasClientErrors = Object.keys(clientErrors).length > 0
  const errorText = (name: string) =>
    hasClientErrors ? clientErrors[name] : state.errors?.[name] ? labels.fieldError : undefined
  const error = (name: string) => errorText(name)
  const invalidNames = ['name', 'email', 'company', 'phone', 'product', 'sku', 'message', 'consent'].filter((n) =>
    Boolean(errorText(n)),
  )
  const feedback = (name: string) =>
    error(name) ? (
      <p id={`${kind}-${name}-error`} className="mt-1 text-small text-danger">
        {error(name)}
      </p>
    ) : null
  const clearError = (name: string) =>
    setClientErrors((prev) => {
      if (!(name in prev)) return prev
      const { [name]: _removed, ...rest } = prev
      return rest
    })
  /** Native bubbles are replaced by visible inline messages; the server still validates everything. */
  const validate = (event: FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget
    const out: Record<string, string> = {}
    for (const [name, min] of [['name', 2], ['email', 0], ['message', 10], ['consent', 0]] as const) {
      const el = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null
      if (!el) continue
      const value = el.value.trim()
      if (name === 'consent' ? !(el as HTMLInputElement).checked : !value) {
        out[name] = name === 'consent' ? labels.consentRequired : labels.required
      } else if (name === 'email' && !el.validity.valid) out[name] = labels.emailInvalid
      else if (min && value.length < min) out[name] = labels.tooShort
    }
    setClientErrors(out)
    if (Object.keys(out).length) event.preventDefault()
  }
  const attrs = (name: string) => ({
    id: `${kind}-${name}`,
    name,
    'aria-invalid': Boolean(error(name)),
    onChange: () => clearError(name),
    'aria-describedby': error(name) ? `${kind}-${name}-error` : undefined,
  })
  const label = (name: string) => fields[name] || labels[name]
  // The SKU stays the submitted value but is never shown; only the selected product's editions are listed.
  const productId = products.find((p) => p.slug === product)?.id
  const productEditions = editions.filter((e) => e.product === productId)
  if (state.status === 'success')
    return (
      <div
        role="status"
        tabIndex={-1}
        ref={(el) => el?.focus()}
        className="rounded-lg border border-border bg-surface p-6"
      >
        {labels.success}
      </div>
    )
  return (
    <form ref={ref} action={action} onSubmit={validate} noValidate className="space-y-5">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="locale" value={locale} />
      <div role="alert" aria-live="assertive" aria-atomic="true">
        {state.status !== 'idle' || hasClientErrors ? (
          <div
            data-status
            tabIndex={-1}
            className="rounded-md border border-danger p-4 text-danger"
          >
            <p>{hasClientErrors ? labels.invalid : labels[state.status]}</p>
            {invalidNames.length ? (
              <ul className="mt-2 list-disc pl-5 text-small">
                <li className="sr-only">{labels.summary}</li>
                {invalidNames.map((n) => (
                  <li key={n}>
                    <a href={`#${kind}-${n}`} className="underline">
                      {n === 'consent' ? labels.privacy : label(n)}
                    </a>
                    : {error(n)}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {(['name', 'email', 'company', 'phone'] as const).map((name) => (
          <div key={name}>
            <label htmlFor={`${kind}-${name}`} className="font-medium">
              {label(name)}
              {(name === 'name' || name === 'email') && <RequiredMark />}
            </label>
            <input
              {...attrs(name)}
              className={inputClass}
              type={name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'text'}
              autoComplete={
                { name: 'name', email: 'email', company: 'organization', phone: 'tel' }[name]
              }
              required={name === 'name' || name === 'email'}
              minLength={name === 'name' ? 2 : undefined}
              maxLength={{ name: 100, email: 254, company: 160, phone: 40 }[name]}
            />
            {feedback(name)}
          </div>
        ))}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${kind}-product`}>{label('product')}</label>
          <select
            {...attrs('product')}
            value={product}
            onChange={(e) => {
              setProduct(e.target.value)
              setSku('')
              clearError('product')
              clearError('sku')
            }}
            className={inputClass}
          >
            <option value="">{labels.none}</option>
            {products.map((p) => (
              <option key={p.id} value={p.slug}>
                {p.title}
              </option>
            ))}
          </select>
          {feedback('product')}
        </div>
        <div>
          <label htmlFor={`${kind}-sku`}>{label('sku')}</label>
          <select
            {...attrs('sku')}
            value={sku}
            onChange={(e) => {
              setSku(e.target.value)
              clearError('sku')
            }}
            disabled={!productId}
            className={inputClass}
          >
            <option value="">{productId ? labels.none : labels.pickProductFirst}</option>
            {productEditions.map((e) => (
              <option key={e.sku} value={e.sku}>
                {e.title}
              </option>
            ))}
          </select>
          {feedback('sku')}
        </div>
      </div>
      <div>
        <label htmlFor={`${kind}-message`} className="font-medium">
          {label('message')}
          <RequiredMark />
        </label>
        <textarea
          {...attrs('message')}
          className={inputClass}
          required
          minLength={10}
          maxLength={5000}
          rows={6}
        />
        {feedback('message')}
      </div>
      <div className="hidden" aria-hidden="true">
        <label htmlFor={`${kind}-website`}>{labels.website}</label>
        <input
          id={`${kind}-website`}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          maxLength={200}
        />
      </div>
      <div>
        <label className="flex items-start gap-3" htmlFor={`${kind}-consent`}>
          <input
            {...attrs('consent')}
            className="mt-1 size-4 shrink-0 accent-accent"
            type="checkbox"
            required
          />
          {label('consent')}
          <RequiredMark />
        </label>
        <AppLink
          href="/yasal/kvkk-aydinlatma"
          locale={locale}
          className="ml-7 text-small text-accent underline"
        >
          {labels.privacy}
        </AppLink>
        {feedback('consent')}
      </div>
      {siteKey ? (
        <>
          <Script nonce={nonce}
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            onReady={() => setReady(true)}
          />
          <div ref={widget} />
          <noscript>
            <p>{labels.noScript}</p>
          </noscript>
        </>
      ) : null}
      <Button type="submit" disabled={pending} aria-disabled={pending}>
        {pending ? labels.sending : submitLabel || labels.send}
      </Button>
    </form>
  )
}
