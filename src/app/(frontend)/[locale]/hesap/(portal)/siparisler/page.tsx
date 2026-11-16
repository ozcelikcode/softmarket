import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { PortalHeading } from '@/components/portal/portal-heading'
import { OrderBadge } from '@/components/portal/status-badge'
import { EmptyState } from '@/components/sections/empty-state'
import { AppLink } from '@/components/ui/app-link'
import { Button } from '@/components/ui/button'
import { localizedHref } from '@/i18n/paths'
import { formatDate } from '@/lib/format'
import { initLocale } from '@/lib/page-utils'
import { formatMoney } from '@/lib/payments/format'
import { getLatestOrderNumber, getMyOrders } from '@/lib/portal/orders'
import { requireCustomer } from '@/lib/portal/require'
import { buildMetadata } from '@/lib/seo'

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ donus?: string | string[] }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'portal.orders' })
  return buildMetadata({ locale, path: '/hesap/siparisler', title: t('title'), noindex: true })
}

const cell = 'flex items-start justify-between gap-4 px-4 py-1.5 before:shrink-0 before:text-small before:text-muted before:content-[attr(data-label)] md:table-cell md:px-4 md:py-3.5 md:before:hidden'

/**
 * Orders are read-only and stay visible in every commerce mode (S3). `?donus=1` is the payment return: the iyzico
 * callback (cross-site, no session, no order number) sends the browser here and the SIGNED-IN customer's newest order
 * is resolved from the session, so the number never travels through the cross-site hop.
 */
export default async function OrdersPage({ params, searchParams }: Props) {
  const locale = await initLocale(params)
  const customer = await requireCustomer(locale)
  if ((await searchParams).donus) {
    const latest = await getLatestOrderNumber(customer)
    if (latest) redirect(localizedHref(`/hesap/siparisler/${encodeURIComponent(latest)}`, locale))
  }
  const [t, st, orders] = await Promise.all([
    getTranslations({ locale, namespace: 'portal.orders' }),
    getTranslations({ locale, namespace: 'portal.orderState' }),
    getMyOrders(customer, locale),
  ])
  return (
    <>
      <PortalHeading title={t('title')} lead={t('lead')} />
      {orders.length ? (
        <div className="md:overflow-hidden md:rounded-lg md:border md:border-border md:bg-surface">
          <table className="block w-full text-left md:table">
            <caption className="sr-only">{t('caption')}</caption>
            <thead className="hidden bg-surface-2 text-small text-muted md:table-header-group">
              <tr>
                {(['number', 'date', 'product', 'total', 'status'] as const).map((c) => (
                  <th key={c} scope="col" className="px-4 py-3 font-medium">{t(c)}</th>
                ))}
                <th scope="col" className="px-4 py-3"><span className="sr-only">{t('open')}</span></th>
              </tr>
            </thead>
            <tbody className="block space-y-3 md:table-row-group md:space-y-0 md:divide-y md:divide-border">
              {orders.map((o) => (
                <tr key={o.id} className="block rounded-lg border border-border bg-surface py-2 md:table-row md:rounded-none md:border-0 md:py-0">
                  <td data-label={t('number')} className={`${cell} font-medium`}>
                    <AppLink href={`/hesap/siparisler/${encodeURIComponent(o.orderNumber)}`} locale={locale} className="text-accent underline underline-offset-4">{o.orderNumber}</AppLink>
                  </td>
                  <td data-label={t('date')} className={`${cell} whitespace-nowrap`}>{formatDate(o.createdAt, locale)}</td>
                  <td data-label={t('product')} className={cell}>{o.items.map((i) => i.title).join(', ')}</td>
                  <td data-label={t('total')} className={`${cell} whitespace-nowrap tabular-nums`}>{formatMoney(o.totalMinor, o.currency, locale)}</td>
                  <td data-label={t('status')} className={cell}><OrderBadge status={o.status} label={st(o.status)} /></td>
                  <td className={`${cell} md:text-right`}>
                    <AppLink href={`/hesap/siparisler/${encodeURIComponent(o.orderNumber)}`} locale={locale} className="text-small text-accent underline underline-offset-4">
                      {t('open')}<span className="sr-only"> {o.orderNumber}</span>
                    </AppLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title={t('empty')}
          description={t('emptyText')}
          action={<Button asChild><AppLink href="/urunler" locale={locale}>{t('browse')}</AppLink></Button>}
        />
      )}
    </>
  )
}
