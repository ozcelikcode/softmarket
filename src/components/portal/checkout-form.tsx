'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useRef, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import type { CheckoutFormState } from '@/lib/portal/schemas'

/*
 * Checkout form (P5). `action` is the checkout Server Action passed straight to `useActionState`, so the form also
 * works without JavaScript: a native POST runs the action, success is a 303 to the hosted payment page, validation
 * errors re-render this form (state.values re-populates it). The buyer-type switch is pure CSS (`:has` on the radio),
 * so the corporate fields are reachable without JS too. Only the always-required fields use native `required`;
 * type-specific fields are validated on the server and reported in the error summary.
 */

export type CheckoutLabels = {
  buyerTitle: string; type: string; individual: string; corporate: string; individualHint: string; corporateHint: string
  name: string; nameHint: string; company: string; identityNumber: string; identityHint: string; taxNumber: string; taxHint: string; taxOffice: string
  phone: string; phoneHint: string; email: string; emailHint: string; addressLine: string; district: string; city: string; postalCode: string; country: string; countryHint: string
  consentPre: string; consentSales: string; consentWaiver: string; consentWaiverNote: string
  submit: string; sending: string; secure: string; errorsTitle: string; errorsLead: string; fieldError: string; consentError: string
  status: Partial<Record<CheckoutFormState['status'], string>>
}

type Props = {
  action: (state: CheckoutFormState, data: FormData) => Promise<CheckoutFormState>
  hidden: Record<string, string>
  defaults: Record<string, string>
  email: string
  labels: CheckoutLabels
  /** Server-rendered legal text boxes, placed between the buyer fields and the consent boxes. */
  children: ReactNode
  /** Changes when the legal texts change: remounts the consent boxes so they must be ticked again. */
  legalKey: string
}

const control = 'mt-1 block w-full rounded-md border border-border-strong bg-surface px-3 py-2.5 text-text placeholder:text-muted aria-[invalid=true]:border-danger'

type Ctx = { v: (name: string) => string; errors: Record<string, string>; fieldError: string; consentError: string }

const aria = (ctx: Ctx, name: string, hint?: string) => ({
  id: `co-${name}`,
  name,
  'aria-invalid': ctx.errors[name] ? true : undefined,
  'aria-describedby': [hint ? `co-${name}-hint` : '', ctx.errors[name] ? `co-${name}-error` : ''].filter(Boolean).join(' ') || undefined,
})

function Field({ ctx, name, label, hint, required, type = 'text', autoComplete, inputMode, maxLength, group }: {
  ctx: Ctx; name: string; label: string; hint?: string; required?: boolean; type?: string; autoComplete?: string; inputMode?: 'numeric' | 'tel'; maxLength?: number
  /** Type-specific field: validated on the server only (no native `required`, it may be hidden). */
  group?: boolean
}) {
  return (
    <div>
      <label htmlFor={`co-${name}`} className="font-medium">
        {label}
        {required ? <span aria-hidden className="text-muted"> *</span> : null}
      </label>
      {hint ? <p id={`co-${name}-hint`} className="text-small text-muted">{hint}</p> : null}
      <input {...aria(ctx, name, hint)} type={type} className={control} defaultValue={ctx.v(name)} required={required && !group} autoComplete={autoComplete} inputMode={inputMode} maxLength={maxLength} />
      {ctx.errors[name] ? <p id={`co-${name}-error`} className="mt-1 text-small text-danger">{ctx.fieldError}</p> : null}
    </div>
  )
}

function Consent({ ctx, name, label, note, required }: { ctx: Ctx; name: string; label: string; note?: string; required?: boolean }) {
  return (
    <div>
      <label htmlFor={`co-${name}`} className="flex items-start gap-3">
        <input {...aria(ctx, name, note)} type="checkbox" required={required} className="mt-1 size-5 shrink-0 accent-accent" />
        <span>{label}</span>
      </label>
      {note ? <p id={`co-${name}-hint`} className="ml-8 mt-1 text-small text-muted">{note}</p> : null}
      {ctx.errors[name] ? <p id={`co-${name}-error`} className="ml-8 mt-1 text-small text-danger">{ctx.consentError}</p> : null}
    </div>
  )
}

export function CheckoutForm({ action, hidden, defaults, email, labels, children, legalKey }: Props) {
  const [state, formAction, pending] = useActionState(action, { status: 'idle' } as CheckoutFormState)
  const router = useRouter()
  const summary = useRef<HTMLDivElement>(null)
  const v = (name: string) => state.values?.[name] ?? defaults[name] ?? ''
  const errors = state.errors ?? {}
  const errorKeys = Object.keys(errors)
  const message = state.status !== 'idle' ? labels.status[state.status] : undefined

  useEffect(() => {
    if (state.status === 'idle') return
    // The legal texts changed on the server: fetch them again (form values stay; consents must be re-ticked).
    if (state.status === 'legal') router.refresh()
    summary.current?.focus()
  }, [state, router])

  const ctx: Ctx = { v, errors, fieldError: labels.fieldError, consentError: labels.consentError }

  return (
    <form action={formAction} className="group/form space-y-8" aria-describedby={message || errorKeys.length ? 'co-summary' : undefined}>
      {Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      {message || errorKeys.length ? (
        <div ref={summary} id="co-summary" tabIndex={-1} role="alert" className="rounded-md border border-danger bg-danger/5 p-4 text-danger">
          {message ? <p className="font-medium">{message}</p> : null}
          {errorKeys.length ? (
            <>
              <p className="mt-1">{labels.errorsLead}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {errorKeys.map((key) => (
                  <li key={key}><a href={`#co-${key}`} className="underline">{(labels as unknown as Record<string, string>)[key] ?? key}</a></li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      <fieldset className="space-y-5">
        <legend className="mb-1 text-h4 text-text">{labels.buyerTitle}</legend>
        <div role="radiogroup" aria-label={labels.type} className="grid gap-3 sm:grid-cols-2">
          {([['individual', labels.individual], ['corporate', labels.corporate]] as const).map(([value, text]) => (
            <label key={value} className="flex cursor-pointer items-center gap-3 rounded-md border border-border-strong px-4 py-3 has-[:checked]:border-accent has-[:checked]:bg-accent/5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
              <input id={`co-type-${value}`} type="radio" name="type" value={value} defaultChecked={(v('type') || 'individual') === value} className="size-4 accent-accent" />
              <span className="font-medium">{text}</span>
            </label>
          ))}
        </div>
        <Field ctx={ctx} name="name" label={labels.name} hint={labels.nameHint} required autoComplete="name" maxLength={100} />
        <div className="space-y-5 group-has-[#co-type-corporate:checked]/form:hidden">
          <Field ctx={ctx} name="identityNumber" label={labels.identityNumber} hint={`${labels.individualHint} ${labels.identityHint}`} inputMode="numeric" maxLength={11} group />
        </div>
        <div className="hidden space-y-5 group-has-[#co-type-corporate:checked]/form:block">
          <p className="text-small text-muted">{labels.corporateHint}</p>
          <Field ctx={ctx} name="company" label={labels.company} autoComplete="organization" maxLength={160} group />
          <Field ctx={ctx} name="taxNumber" label={labels.taxNumber} hint={labels.taxHint} inputMode="numeric" maxLength={10} group />
          <Field ctx={ctx} name="taxOffice" label={labels.taxOffice} maxLength={100} group />
        </div>
        <div>
          <label htmlFor="co-email" className="font-medium">{labels.email}</label>
          <p id="co-email-hint" className="text-small text-muted">{labels.emailHint}</p>
          <input id="co-email" type="email" value={email} readOnly aria-describedby="co-email-hint" className={`${control} bg-surface-2`} />
        </div>
        <Field ctx={ctx} name="phone" label={labels.phone} hint={labels.phoneHint} required type="tel" autoComplete="tel" inputMode="tel" maxLength={40} />
        <div>
          <label htmlFor="co-addressLine" className="font-medium">{labels.addressLine}<span aria-hidden className="text-muted"> *</span></label>
          <textarea {...aria(ctx, 'addressLine')} className={control} rows={3} required maxLength={300} defaultValue={v('addressLine')} autoComplete="street-address" />
          {errors.addressLine ? <p id="co-addressLine-error" className="mt-1 text-small text-danger">{labels.fieldError}</p> : null}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field ctx={ctx} name="district" label={labels.district} autoComplete="address-level3" maxLength={80} />
          <Field ctx={ctx} name="city" label={labels.city} required autoComplete="address-level1" maxLength={80} />
          <Field ctx={ctx} name="postalCode" label={labels.postalCode} autoComplete="postal-code" maxLength={16} />
          <Field ctx={ctx} name="country" label={labels.country} hint={labels.countryHint} required autoComplete="country" maxLength={2} />
        </div>
      </fieldset>

      {children}

      <fieldset key={legalKey} className="space-y-4">
        <legend className="sr-only">{labels.consentPre}</legend>
        <Consent ctx={ctx} name="consentPre" label={labels.consentPre} required />
        <Consent ctx={ctx} name="consentSales" label={labels.consentSales} required />
        <Consent ctx={ctx} name="consentWaiver" label={labels.consentWaiver} note={labels.consentWaiverNote} />
      </fieldset>

      <div>
        <Button type="submit" size="lg" disabled={pending} aria-disabled={pending} className="w-full sm:w-auto">
          {pending ? labels.sending : labels.submit}
        </Button>
        <p className="mt-3 text-small text-muted">{labels.secure}</p>
      </div>
    </form>
  )
}
