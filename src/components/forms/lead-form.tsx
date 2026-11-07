'use client'

import Script from 'next/script'
import { useNonce } from '@/components/security/nonce-provider'
import { useActionState, useEffect, useRef, useState } from 'react'
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
  'mt-1 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-text aria-[invalid=true]:border-danger'
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
  const error = (name: string) => state.errors?.[name]
  const feedback = (name: string) =>
    error(name) ? (
      <p id={`${kind}-${name}-error`} className="mt-1 text-small text-danger">
        {labels.fieldError}
      </p>
    ) : null
  const attrs = (name: string) => ({
    id: `${kind}-${name}`,
    name,
    'aria-invalid': Boolean(error(name)),
    'aria-describedby': error(name) ? `${kind}-${name}-error` : undefined,
  })
  const label = (name: string) => fields[name] || labels[name]
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
    <form ref={ref} action={action} className="space-y-5">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="locale" value={locale} />
      {state.status !== 'idle' ? (
        <p
          data-status
          tabIndex={-1}
          role="alert"
          className="rounded-md border border-danger p-4 text-danger"
        >
          {labels[state.status]}
        </p>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        {(['name', 'email', 'company', 'phone'] as const).map((name) => (
          <div key={name}>
            <label htmlFor={`${kind}-${name}`} className="font-medium">
              {label(name)}
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
            onChange={(e) => setSku(e.target.value)}
            className={inputClass}
          >
            <option value="">{labels.none}</option>
            {editions
              .filter((e) => !product || e.product === products.find((p) => p.slug === product)?.id)
              .map((e) => (
                <option key={e.sku} value={e.sku}>
                  {e.title} ({e.sku})
                </option>
              ))}
          </select>
          {feedback('sku')}
        </div>
      </div>
      <div>
        <label htmlFor={`${kind}-message`} className="font-medium">
          {label('message')}
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
        </label>
        <AppLink
          href="/yasal/kvkk"
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
