import { getTranslations } from 'next-intl/server'
import type { Locale } from '@/i18n/routing'
import { getLeadForm } from '@/lib/forms/data'
import type { FormKind } from '@/lib/forms/schema'
import { getSupportProducts, getSupportEditions } from '@/lib/support'
import { quoteSelection, type Query } from '@/lib/support-query'
import { LeadForm } from './lead-form'

export async function LeadFormSection({
  kind,
  locale,
  query = {},
}: {
  kind: FormKind
  locale: Locale
  query?: Query
}) {
  const [form, products, editions, t] = await Promise.all([
    getLeadForm(kind, locale),
    getSupportProducts(locale),
    getSupportEditions(locale),
    getTranslations({ locale, namespace: 'leadForm' }),
  ])
  if (!form) return <p role="status">{t('unavailable')}</p>
  const labels = Object.fromEntries(
    [
      'name',
      'email',
      'company',
      'phone',
      'message',
      'product',
      'sku',
      'none',
      'consent',
      'privacy',
      'send',
      'sending',
      'success',
      'invalid',
      'fieldError',
      'rate',
      'verification',
      'error',
      'website',
      'noScript',
      'required',
      'emailInvalid',
      'tooShort',
      'consentRequired',
      'pickProductFirst',
      'summary',
    ].map((k) => [k, t(k)]),
  )
  const fields = Object.fromEntries(
    (form.fields ?? []).flatMap((f) => ('name' in f && f.label ? [[f.name, f.label]] : [])),
  )
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  return (
    <LeadForm
      kind={kind}
      locale={locale}
      labels={labels}
      fields={fields}
      submitLabel={form.submitButtonLabel}
      products={products.map((p) => ({ ...p, slug: p.slug! }))}
      editions={editions.map((e) => ({
        title: e.title,
        sku: e.sku,
        product: typeof e.product === 'object' ? e.product.id : e.product,
      }))}
      initial={quoteSelection(products, editions, query.urun, query.surum)}
      siteKey={siteKey && !siteKey.startsWith('CHANGE_') ? siteKey : undefined}
    />
  )
}
