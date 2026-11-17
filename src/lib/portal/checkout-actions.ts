'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { localizedHref } from '@/i18n/paths'
import { getCommerceState } from '@/lib/commerce/state'
import { checkoutFormInput, parseCheckoutForm, CHECKOUT_TEXT_FIELDS } from '@/lib/payments/checkout-schema'
import { createCheckoutOrder, loadCheckoutTarget, quoteHref, type CheckoutCustomer } from '@/lib/payments/checkout'
import { loadPaymentsDeps } from '@/lib/payments/runtime'
import { getPayloadClient } from '@/lib/site'

import { checkoutOrigin } from './checkout-support'
import { allowAuthAttempt, requestIP, sameOrigin } from './guard'
import { loginHref } from './require'
import type { CheckoutFormState } from './schemas'
import { getCustomer } from './session'

/**
 * P5 checkout Server Action. A plain `<form action>` POST: works without JavaScript (Next answers the progressive
 * enhancement POST; success is a 303 to the hosted payment page, validation errors re-render the form with `state`).
 * Order of checks: same origin → signed-in customer → rate limit → form validation → server-side checkout core.
 * The browser never supplies an amount, VAT, provider or legal text.
 */
export async function startCheckoutAction(_prev: CheckoutFormState, data: FormData): Promise<CheckoutFormState> {
  const h = await headers()
  if (!sameOrigin(h).ok) return { status: 'error' }
  const raw = checkoutFormInput(data)
  const locale = raw.locale === 'en' ? 'en' : 'tr'
  const session = await getCustomer()
  if (!session) return redirect(loginHref(locale))
  if (!allowAuthAttempt(h, `checkout-${session.id}`, 'checkout', 10)) return { status: 'rate' }

  // Echoed back for re-population only (typed by the same buyer in this very request); never the consent boxes.
  const values = Object.fromEntries(CHECKOUT_TEXT_FIELDS.flatMap((k) => (typeof raw[k] === 'string' ? [[k, raw[k] as string]] : [])))
  const parsed = parseCheckoutForm(raw)
  if (!parsed.ok) return { status: 'invalid', errors: parsed.errors, values }

  const payload = await getPayloadClient()
  const fresh = (await payload.findByID({ collection: 'customers', id: session.id, depth: 0, overrideAccess: true, showHiddenFields: true }).catch(() => null)) as CheckoutCustomer | null
  if (!fresh) return { status: 'error', values }
  const deps = await loadPaymentsDeps(payload)
  const result = await createCheckoutOrder(
    { payload, providers: deps.providers, now: deps.now, log: deps.log, state: await getCommerceState() },
    { customer: fresh, form: parsed.data, ip: requestIP(h), userAgent: h.get('user-agent') ?? '', origin: checkoutOrigin(h) },
  )

  // redirect() throws: it must stay outside any try/catch.
  if (result.ok && result.kind === 'redirect') return redirect(result.redirectUrl)
  if (result.ok) return redirect(localizedHref(`/hesap/siparisler/${encodeURIComponent(result.orderNumber)}`, result.locale))
  switch (result.code) {
    case 'closed':
    case 'unavailable': {
      // Fail to quote: a closed/changed offer sends the buyer to the quote form for this edition.
      const target = await loadCheckoutTarget(payload, parsed.data.locale, parsed.data.sku).catch(() => null)
      return redirect(localizedHref(target ? quoteHref(parsed.data.sku, target.product.slug) : '/teklif-iste', parsed.data.locale))
    }
    case 'legal_changed': return { status: 'legal', values }
    case 'legal_unavailable': return { status: 'unavailable', values }
    case 'unverified': return { status: 'unverified', values }
    case 'rate': return { status: 'rate', values }
    case 'provider_failed': return { status: 'provider', values }
    case 'invalid': return { status: 'invalid', values }
    default: return { status: 'error', values }
  }
}
