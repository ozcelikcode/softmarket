import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { LicenseKey } from '@/components/portal/license-key'
import { PortalHeading } from '@/components/portal/portal-heading'
import { LicenseBadge } from '@/components/portal/status-badge'
import { EmptyState } from '@/components/sections/empty-state'
import { AppLink } from '@/components/ui/app-link'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'
import { initLocale } from '@/lib/page-utils'
import { getMyLicenses } from '@/lib/portal/data'
import { requireCustomer } from '@/lib/portal/require'
import { buildMetadata } from '@/lib/seo'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'portal.licenses' })
  return buildMetadata({ locale, path: '/hesap/lisanslar', title: t('title'), noindex: true })
}

const cell = 'flex items-start justify-between gap-4 px-4 py-1.5 before:shrink-0 before:text-small before:text-muted before:content-[attr(data-label)] md:table-cell md:px-4 md:py-3.5 md:before:hidden'

export default async function LicensesPage({ params }: Props) {
  const locale = await initLocale(params)
  const customer = await requireCustomer(locale)
  const [t, ls, licenses] = await Promise.all([
    getTranslations({ locale, namespace: 'portal.licenses' }),
    getTranslations({ locale, namespace: 'portal.licenseState' }),
    getMyLicenses(customer, locale),
  ])
  const keyLabels = { reveal: t('reveal'), hide: t('hideKey'), copy: t('copy'), copied: t('copied'), error: t('keyError') }
  return (
    <>
      <PortalHeading title={t('title')} lead={t('lead')} />
      {licenses.length ? (
        <div className="md:overflow-hidden md:rounded-lg md:border md:border-border md:bg-surface">
          <table className="block w-full text-left md:table">
            <caption className="sr-only">{t('caption')}</caption>
            <thead className="hidden bg-surface-2 text-small text-muted md:table-header-group">
              <tr>
                {(['product', 'version', 'key', 'seats', 'starts', 'ends', 'status'] as const).map((c) => (
                  <th key={c} scope="col" className="px-4 py-3 font-medium">
                    {t(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="block space-y-3 md:table-row-group md:space-y-0 md:divide-y md:divide-border">
              {licenses.map((l) => (
                <tr key={l.id} className="block rounded-lg border border-border bg-surface py-2 md:table-row md:rounded-none md:border-0 md:py-0">
                  <td data-label={t('product')} className={`${cell} font-medium`}>
                    {l.product}
                  </td>
                  <td data-label={t('version')} className={cell}>
                    <span>
                      {l.edition}
                      {l.sku ? <span className="block text-small text-muted">{l.sku}</span> : null}
                    </span>
                  </td>
                  <td data-label={t('key')} className={cell}>
                    <LicenseKey id={l.id} masked={l.maskedKey} labels={keyLabels} />
                  </td>
                  <td data-label={t('seats')} className={`${cell} tabular-nums`}>
                    {l.seats ?? '—'}
                  </td>
                  <td data-label={t('starts')} className={`${cell} whitespace-nowrap`}>
                    {formatDate(l.startsAt, locale)}
                  </td>
                  <td data-label={t('ends')} className={`${cell} whitespace-nowrap`}>
                    {l.expiresAt ? formatDate(l.expiresAt, locale) : t('perpetual')}
                  </td>
                  <td data-label={t('status')} className={cell}>
                    <span className="md:block">
                      <LicenseBadge state={l.state} label={ls(l.state)} />
                      {l.state === 'expiring' ? (
                        <span className="mt-1 block text-small text-warning">
                          {t('expiringNote', { count: Math.max(0, l.daysLeft ?? 0) })}
                        </span>
                      ) : null}
                    </span>
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
          action={
            <Button asChild>
              <AppLink href="/teklif-iste" locale={locale}>
                {t('contact')}
              </AppLink>
            </Button>
          }
        />
      )}
    </>
  )
}
