import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { PortalHeading } from '@/components/portal/portal-heading'
import { TicketBadge } from '@/components/portal/status-badge'
import { EmptyState } from '@/components/sections/empty-state'
import { AppLink } from '@/components/ui/app-link'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'
import { initLocale } from '@/lib/page-utils'
import { getMyTickets } from '@/lib/portal/data'
import { requireCustomer } from '@/lib/portal/require'
import { buildMetadata } from '@/lib/seo'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'portal.tickets' })
  return buildMetadata({ locale, path: '/hesap/talepler', title: t('title'), noindex: true })
}

const cell = 'flex items-start justify-between gap-4 px-4 py-1.5 before:shrink-0 before:text-small before:text-muted before:content-[attr(data-label)] md:table-cell md:px-4 md:py-3.5 md:before:hidden'

export default async function TicketsPage({ params }: Props) {
  const locale = await initLocale(params)
  const customer = await requireCustomer(locale)
  const [t, tickets] = await Promise.all([
    getTranslations({ locale, namespace: 'portal.tickets' }),
    getMyTickets(customer, locale),
  ])
  const create = (
    <Button asChild>
      <AppLink href="/hesap/talepler/yeni" locale={locale}>
        <Plus aria-hidden />
        {t('new')}
      </AppLink>
    </Button>
  )
  return (
    <>
      <PortalHeading title={t('title')} lead={t('lead')} actions={create} />
      {tickets.length ? (
        <div className="md:overflow-hidden md:rounded-lg md:border md:border-border md:bg-surface">
          <table className="block w-full text-left md:table">
            <caption className="sr-only">{t('caption')}</caption>
            <thead className="hidden bg-surface-2 text-small text-muted md:table-header-group">
              <tr>
                {(['subject', 'product', 'status', 'updated'] as const).map((c) => (
                  <th key={c} scope="col" className="px-4 py-3 font-medium">
                    {t(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="block space-y-3 md:table-row-group md:space-y-0 md:divide-y md:divide-border">
              {tickets.map((x) => (
                <tr key={x.id} className="block rounded-lg border border-border bg-surface py-2 md:table-row md:rounded-none md:border-0 md:py-0">
                  <td data-label={t('subject')} className={`${cell} font-medium`}>
                    <AppLink href={`/hesap/talepler/${x.id}`} locale={locale} className="text-accent hover:underline">
                      {x.subject}
                    </AppLink>
                  </td>
                  <td data-label={t('product')} className={cell}>
                    {x.product || '—'}
                  </td>
                  <td data-label={t('status')} className={cell}>
                    <TicketBadge status={x.status} label={t(x.status)} />
                  </td>
                  <td data-label={t('updated')} className={`${cell} whitespace-nowrap`}>
                    {formatDate(x.lastMessageAt ?? x.createdAt, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={t('empty')} action={create} />
      )}
    </>
  )
}
