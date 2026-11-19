import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { PortalHeading } from '@/components/portal/portal-heading'
import { OrderBadge } from '@/components/portal/status-badge'
import { AppLink } from '@/components/ui/app-link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDate } from '@/lib/format'
import { initLocale } from '@/lib/page-utils'
import { formatMoney } from '@/lib/payments/format'
import { syncStripeReturn } from '@/lib/portal/checkout-orders'
import { getMyOrder } from '@/lib/portal/orders'
import { requireCustomer } from '@/lib/portal/require'
import { buildMetadata } from '@/lib/seo'

type Props = { params: Promise<{ locale: string; no: string }>; searchParams: Promise<{ s?: string | string[] }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const { no } = await params
  const t = await getTranslations({ locale, namespace: 'portal.orders' })
  return buildMetadata({ locale, path: `/hesap/siparisler/${encodeURIComponent(no)}`, title: t('detailTitle', { number: no }), noindex: true })
}

export default async function OrderPage({ params, searchParams }: Props) {
  const locale = await initLocale(params)
  const { no } = await params
  const customer = await requireCustomer(locale)
  let order = await getMyOrder(customer, locale, no)
  if (!order) notFound()
  const session = (await searchParams).s
  if (order.status === 'pending' && typeof session === 'string') {
    await syncStripeReturn(customer, order.id, order.orderNumber, session, await headers())
    order = (await getMyOrder(customer, locale, no)) ?? order
  }
  const [t, st] = await Promise.all([
    getTranslations({ locale, namespace: 'portal.orders' }),
    getTranslations({ locale, namespace: 'portal.orderState' }),
  ])
  const money = (minor: number) => formatMoney(minor, order.currency, locale)
  const licenseIds = order.items.map((i) => i.licenseId).filter((id): id is number => id !== null)
  const b = order.billing
  const billingRows = b ? ([
    [t('billingName'), b.name], [t('billingCompany'), b.company], [t('billingIdentity'), b.identityNumber], [t('billingTax'), b.taxNumber], [t('billingTaxOffice'), b.taxOffice], [t('billingPhone'), b.phone], [t('billingAddress'), b.address],
  ] as const).filter((row): row is readonly [string, string] => Boolean(row[1])) : []
  return (
    <>
      <PortalHeading
        title={t('detailTitle', { number: order.orderNumber })}
        actions={<Button asChild variant="secondary"><AppLink href="/hesap/siparisler" locale={locale}>{t('back')}</AppLink></Button>}
      />
      <div className="space-y-8">
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-4">
          <OrderBadge status={order.status} label={st(order.status)} />
          <p className="text-small">{t(`note.${order.status}`)}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="space-y-4">
            <h2 className="text-h4">{t('itemsTitle')}</h2>
            <dl className="space-y-1 text-small">
              <div className="flex justify-between gap-4"><dt className="text-muted">{t('placed')}</dt><dd>{formatDate(order.createdAt, locale)}</dd></div>
              {order.paidAt ? <div className="flex justify-between gap-4"><dt className="text-muted">{t('paidAt')}</dt><dd>{formatDate(order.paidAt, locale)}</dd></div> : null}
            </dl>
            <ul className="divide-y divide-border">
              {order.items.map((item) => (
                <li key={item.sku} className="py-3 text-small">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-muted">
                    {[item.sku, item.licenseType === 'perpetual' ? t('perpetual') : `${t('subscription')}${item.durationMonths ? ` · ${t('months', { count: item.durationMonths })}` : ''}`, item.seats ? t('seats', { count: item.seats }) : null].filter(Boolean).join(' · ')}
                  </p>
                </li>
              ))}
            </ul>
            <dl className="space-y-2 border-t border-border pt-4 text-small">
              <div className="flex justify-between gap-4"><dt className="text-muted">{t('net')}</dt><dd className="tabular-nums">{money(order.subtotalMinor)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">{order.vatMinor === 0 && order.items.every((i) => i.vatRateBasisPoints === 0) ? t('vatExempt') : t('vat', { rate: (order.items[0]?.vatRateBasisPoints ?? 0) / 100 })}</dt><dd className="tabular-nums">{money(order.vatMinor)}</dd></div>
              <div className="flex justify-between gap-4 border-t border-border pt-3 text-body font-semibold"><dt>{t('grandTotal')}</dt><dd className="tabular-nums" data-order-total="">{money(order.totalMinor)}</dd></div>
            </dl>
          </Card>

          <div className="space-y-6">
            <Card className="space-y-3">
              <h2 className="text-h4">{t('licenseTitle')}</h2>
              {licenseIds.length ? (
                <Button asChild><AppLink href="/hesap/lisanslar" locale={locale}>{t('viewLicense')}</AppLink></Button>
              ) : (
                <p className="text-small text-muted">{t('licensePending')}</p>
              )}
            </Card>
            <Card className="space-y-3">
              <h2 className="text-h4">{t('invoiceTitle')}</h2>
              {order.invoice ? (
                <dl className="space-y-1 text-small">
                  {order.invoice.number ? <div className="flex justify-between gap-4"><dt className="text-muted">{t('invoiceNumber')}</dt><dd>{order.invoice.number}</dd></div> : null}
                  {order.invoice.issuedAt ? <div className="flex justify-between gap-4"><dt className="text-muted">{t('invoiceDate')}</dt><dd>{formatDate(order.invoice.issuedAt, locale)}</dd></div> : null}
                </dl>
              ) : (
                <p className="text-small text-muted">{t('invoicePending')}</p>
              )}
            </Card>
            {billingRows.length ? (
              <Card className="space-y-3">
                <h2 className="text-h4">{t('billingTitle')}</h2>
                <dl className="space-y-1 text-small">
                  {billingRows.map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4"><dt className="shrink-0 text-muted">{label}</dt><dd className="text-right">{value}</dd></div>
                  ))}
                </dl>
              </Card>
            ) : null}
          </div>
        </div>

        {order.contractSnapshot ? (
          <section aria-labelledby="order-contract" className="space-y-2">
            <h2 id="order-contract" className="text-h4">{t('contractTitle')}</h2>
            <p className="text-small text-muted">
              {t('contractLead')}
              {order.consents?.acceptedAt ? ` ${t('contractAccepted', { date: formatDate(order.consents.acceptedAt, locale) })}` : ''}
              {order.consents?.waiver ? ` ${t('waiverGiven')}` : ''}
            </p>
            <div role="region" aria-label={t('contractScroll')} tabIndex={0} className="max-h-96 overflow-y-auto whitespace-pre-line rounded-md border border-border-strong bg-surface p-4 text-small focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              {order.contractSnapshot}
            </div>
          </section>
        ) : null}
      </div>
    </>
  )
}
