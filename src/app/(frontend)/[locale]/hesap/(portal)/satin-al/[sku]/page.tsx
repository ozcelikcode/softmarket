import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'

import { CheckoutForm, type CheckoutLabels } from '@/components/portal/checkout-form'
import { PortalHeading } from '@/components/portal/portal-heading'
import { EmptyState } from '@/components/sections/empty-state'
import { AppLink } from '@/components/ui/app-link'
import { Card } from '@/components/ui/card'
import { cx } from '@/lib/cx'
import { localizedHref } from '@/i18n/paths'
import { getCommerceState } from '@/lib/commerce/state'
import { loadCheckoutTarget, quoteHref, resolveCheckoutOffer } from '@/lib/payments/checkout'
import { legalDigest, loadCommerceLegalSet } from '@/lib/payments/contract'
import { formatMoney, splitPrices } from '@/lib/payments/format'
import { createCheckoutNonce } from '@/lib/payments/idempotency'
import { initLocale } from '@/lib/page-utils'
import { startCheckoutAction } from '@/lib/portal/checkout-actions'
import { getLastBilling } from '@/lib/portal/orders'
import { requireCustomer } from '@/lib/portal/require'
import { buildMetadata } from '@/lib/seo'
import { getPayloadClient } from '@/lib/site'

type Props = { params: Promise<{ locale: string; sku: string }>; searchParams: Promise<{ c?: string | string[] }> }

const SKU_RE = /^[A-Z0-9][A-Z0-9-]{1,63}$/

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sku } = await params
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'portal.checkout' })
  return buildMetadata({ locale, path: `/hesap/satin-al/${encodeURIComponent(sku)}`, title: t('metaTitle'), noindex: true })
}

export default async function CheckoutPage({ params, searchParams }: Props) {
  const locale = await initLocale(params)
  const { sku } = await params
  const customer = await requireCustomer(locale)
  if (!SKU_RE.test(sku)) notFound()
  const [t, payload, state] = await Promise.all([
    getTranslations({ locale, namespace: 'portal.checkout' }),
    getPayloadClient(),
    getCommerceState(),
  ])
  const target = await loadCheckoutTarget(payload, locale, sku)
  if (!target) notFound()
  // Fail to quote: payments closed, edition not for sale, no usable price, or the sales texts are not publishable.
  const toQuote = () => redirect(localizedHref(quoteHref(sku, target.product.slug), locale))
  const offer = resolveCheckoutOffer(state, target.edition)
  if (!offer) return toQuote()
  const legal = await loadCommerceLegalSet(payload, locale)
  if (!legal) return toQuote()

  const fresh = (await payload.findByID({ collection: 'customers', id: customer.id, depth: 0, overrideAccess: true, showHiddenFields: true })) as unknown as { email: string; name?: string; company?: string; phone?: string; taxNumber?: string; _verified?: boolean }
  if (fresh._verified !== true) {
    return (
      <>
        <PortalHeading title={t('title')} />
        <EmptyState title={t('unverifiedTitle')} description={t('unverifiedText')} />
      </>
    )
  }

  const requested = Array.isArray((await searchParams).c) ? undefined : (await searchParams).c
  const selected = offer.prices.find((price) => price.currency === requested) ?? splitPrices(offer.prices, locale)!.primary
  const last = await getLastBilling(customer)
  const defaults: Record<string, string> = {
    type: last.type ?? 'individual', name: last.name ?? fresh.name ?? '', company: last.company ?? fresh.company ?? '', identityNumber: last.identityNumber ?? '',
    taxNumber: last.taxNumber ?? (fresh.taxNumber && /^\d{10}$/.test(fresh.taxNumber) ? fresh.taxNumber : ''), taxOffice: last.taxOffice ?? '',
    phone: last.phone ?? fresh.phone ?? '', addressLine: last.addressLine ?? '', district: last.district ?? '', city: last.city ?? '', postalCode: last.postalCode ?? '', country: last.country ?? (locale === 'en' ? '' : 'TR'),
  }
  const digest = legalDigest(legal)
  const f = (key: string) => t(key as never)
  const labels: CheckoutLabels = {
    buyerTitle: t('buyerTitle'), type: t('type'), individual: t('individual'), corporate: t('corporate'), individualHint: t('individualHint'), corporateHint: t('corporateHint'),
    name: t('name'), nameHint: t('nameHint'), company: t('company'), identityNumber: t('identityNumber'), identityHint: t('identityHint'), taxNumber: t('taxNumber'), taxHint: t('taxHint'), taxOffice: t('taxOffice'),
    phone: t('phone'), phoneHint: t('phoneHint'), email: t('email'), emailHint: t('emailHint'), addressLine: t('addressLine'), district: t('district'), city: t('city'), postalCode: t('postalCode'), country: t('country'), countryHint: t('countryHint'),
    consentPre: t('consentPre'), consentSales: t('consentSales'), consentWaiver: t('consentWaiver'), consentWaiverNote: t('consentWaiverNote'),
    submit: t('submit'), sending: t('sending'), secure: t('secure'), errorsTitle: t('errorsTitle'), errorsLead: t('errorsLead'), fieldError: t('fieldError'), consentError: t('consentError'),
    status: Object.fromEntries((['invalid', 'rate', 'error', 'unverified', 'legal', 'provider', 'unavailable'] as const).map((k) => [k, f(`status.${k}`)])),
  }
  const { edition } = target
  const facts = [
    [t('edition'), edition.title],
    [t('licenseType'), edition.licenseType === 'perpetual' ? t('perpetual') : `${t('subscription')}${edition.durationMonths ? ` · ${t('months', { count: edition.durationMonths })}` : ''}`],
    edition.seats ? [t('seats'), String(edition.seats)] : null,
  ].filter((row): row is string[] => Boolean(row))
  const legalBoxes = [
    { doc: legal.preInformation, title: t('preInfoTitle') },
    { doc: legal.distanceSales, title: t('salesTitle') },
  ]
  return (
    <>
      <PortalHeading title={t('title')} lead={t('lead')} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <aside aria-labelledby="co-summary-title" className="lg:order-2 lg:sticky lg:top-28">
          <Card className="space-y-5">
            <h2 id="co-summary-title" className="text-h4">{t('summaryTitle')}</h2>
            <p className="text-small text-muted">{target.product.title}</p>
            <dl className="space-y-2 text-small">
              {facts.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4"><dt className="text-muted">{label}</dt><dd className="text-right font-medium">{value}</dd></div>
              ))}
            </dl>
            {offer.prices.length > 1 ? (
              <nav aria-label={t('currencyTitle')}>
                <p className="text-small font-medium">{t('currencyTitle')}</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {offer.prices.map((price) => (
                    <li key={price.currency}>
                      <AppLink
                        href={`/hesap/satin-al/${encodeURIComponent(sku)}?c=${price.currency}`}
                        locale={locale}
                        aria-current={price.currency === selected.currency ? 'true' : undefined}
                        className={cx('inline-flex h-10 items-center rounded-md border px-3 text-small font-medium', price.currency === selected.currency ? 'border-accent bg-accent/5 text-text' : 'border-border-strong text-muted hover:text-text')}
                      >
                        {price.currency}
                        {price.currency === selected.currency ? <span className="sr-only"> ({t('currencyCurrent')})</span> : null}
                      </AppLink>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-small text-muted">{t('currencyHint')}</p>
              </nav>
            ) : null}
            <dl className="space-y-2 border-t border-border pt-4 text-small">
              <div className="flex justify-between gap-4"><dt className="text-muted">{t('net')}</dt><dd className="tabular-nums">{formatMoney(selected.netMinor, selected.currency, locale)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">{selected.exempt ? t('vatExempt') : t('vat', { rate: selected.vatRateBasisPoints / 100 })}</dt><dd className="tabular-nums">{formatMoney(selected.vatMinor, selected.currency, locale)}</dd></div>
              <div className="flex justify-between gap-4 border-t border-border pt-3 text-body font-semibold"><dt>{t('total')}</dt><dd className="tabular-nums" data-checkout-total="">{formatMoney(selected.totalMinor, selected.currency, locale)}</dd></div>
            </dl>
            <p className="text-small text-muted">{selected.exempt ? t('vatExempt') : offer.taxMode === 'exclusive' ? t('taxExclusive') : t('taxInclusive')}</p>
            <AppLink href={quoteHref(sku, target.product.slug)} locale={locale} className="inline-block text-small text-accent underline underline-offset-4">{t('quoteAlt')}</AppLink>
          </Card>
        </aside>
        <div className="lg:order-1">
          <CheckoutForm
            action={startCheckoutAction}
            hidden={{ sku, currency: selected.currency, locale, nonce: createCheckoutNonce(), legal: digest }}
            defaults={defaults}
            email={fresh.email}
            labels={labels}
            legalKey={digest}
          >
            <section aria-labelledby="co-legal-title" className="space-y-4">
              <h2 id="co-legal-title" className="text-h4">{t('legalTitle')}</h2>
              <p className="text-small text-muted">{t('legalLead')}</p>
              {legalBoxes.map(({ doc, title }) => (
                <div key={doc.kind}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 id={`co-legal-${doc.kind}`} className="font-medium">{title}</h3>
                    <AppLink href={`/yasal/${encodeURIComponent(doc.slug)}`} locale={locale} target="_blank" className="text-small text-accent underline underline-offset-4">{t('fullText')}</AppLink>
                  </div>
                  <div role="region" aria-labelledby={`co-legal-${doc.kind}`} tabIndex={0} className="mt-2 max-h-64 overflow-y-auto whitespace-pre-line rounded-md border border-border-strong bg-surface p-4 text-small focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                    {doc.text}
                  </div>
                </div>
              ))}
              <AppLink href={`/yasal/${encodeURIComponent(legal.refund.slug)}`} locale={locale} target="_blank" className="inline-block text-small text-accent underline underline-offset-4">{t('refundLink')}</AppLink>
            </section>
          </CheckoutForm>
        </div>
      </div>
    </>
  )
}
