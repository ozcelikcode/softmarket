import { ArrowRight, Download, KeyRound, LifeBuoy, UserRound } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { LicenseBadge, TicketBadge } from '@/components/portal/status-badge'
import { AppLink } from '@/components/ui/app-link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Heading } from '@/components/ui/heading'
import { formatDate } from '@/lib/format'
import { isUsableState } from '@/lib/licenses/state'
import { initLocale } from '@/lib/page-utils'
import { countOpenTickets, getMyLicenses, getMyTickets } from '@/lib/portal/data'
import { requireCustomer } from '@/lib/portal/require'
import { buildMetadata } from '@/lib/seo'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'portal.overview' })
  return buildMetadata({ locale, path: '/hesap', title: t('title'), noindex: true })
}

export default async function OverviewPage({ params }: Props) {
  const locale = await initLocale(params)
  const customer = await requireCustomer(locale)
  const [t, nav, ls, ts, licenses, tickets, open] = await Promise.all([
    getTranslations({ locale, namespace: 'portal.overview' }),
    getTranslations({ locale, namespace: 'portal.nav' }),
    getTranslations({ locale, namespace: 'portal.licenseState' }),
    getTranslations({ locale, namespace: 'portal.tickets' }),
    getMyLicenses(customer, locale),
    getMyTickets(customer, locale, 5),
    countOpenTickets(customer),
  ])
  const active = licenses.filter((l) => isUsableState(l.state))
  const expiring = licenses
    .filter((l) => l.state === 'expiring')
    .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0))
    .slice(0, 5)
  const stats = [
    { label: t('activeLicenses'), value: active.length },
    { label: t('openTickets'), value: open },
    { label: t('expiring'), value: licenses.filter((l) => l.state === 'expiring').length },
  ]
  const quick = [
    { href: '/hesap/lisanslar', label: nav('licenses'), icon: KeyRound },
    { href: '/hesap/indirmeler', label: nav('downloads'), icon: Download },
    { href: '/hesap/talepler/yeni', label: t('newTicket'), icon: LifeBuoy },
    { href: '/hesap/profil', label: nav('profile'), icon: UserRound },
  ]
  return (
    <div className="space-y-10">
      <div>
        <Heading as="h1" size="h2">
          {t('welcome', { name: customer.name })}
        </Heading>
        <p className="mt-2 text-muted">{t('lead')}</p>
      </div>

      <dl className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <dt className="text-small text-muted">{s.label}</dt>
            <dd className="mt-1 text-h1 tabular-nums">{s.value}</dd>
          </Card>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <Heading as="h2" size="h4">
            {t('upcomingTitle')}
          </Heading>
          {expiring.length ? (
            <ul className="mt-4 divide-y divide-border">
              {expiring.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{l.product}</p>
                    <p className="text-small text-muted">
                      {l.edition} · {formatDate(l.expiresAt, locale)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <LicenseBadge state={l.state} label={ls(l.state)} />
                    <p className="mt-1 text-small text-muted">{t('daysLeft', { count: Math.max(0, l.daysLeft ?? 0) })}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-muted">{t('upcomingNone')}</p>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-4">
            <Heading as="h2" size="h4">
              {t('recentTickets')}
            </Heading>
            <AppLink href="/hesap/talepler" locale={locale} className="text-small text-accent hover:underline">
              {t('viewAll')}
            </AppLink>
          </div>
          {tickets.length ? (
            <ul className="mt-4 divide-y divide-border">
              {tickets.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-4 py-3">
                  <AppLink href={`/hesap/talepler/${x.id}`} locale={locale} className="min-w-0 truncate font-medium hover:text-accent">
                    {x.subject}
                  </AppLink>
                  <TicketBadge status={x.status} label={ts(x.status)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-muted">{t('noTickets')}</p>
          )}
        </Card>
      </div>

      <section aria-labelledby="quick-links">
        <Heading as="h2" size="h4" id="quick-links">
          {t('quick')}
        </Heading>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quick.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <AppLink
                href={href}
                locale={locale}
                className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3.5 font-medium transition-colors hover:border-border-strong hover:bg-surface-2"
              >
                <span className="flex items-center gap-3">
                  <Icon aria-hidden className="size-4 text-accent" />
                  {label}
                </span>
                <ArrowRight aria-hidden className="size-4 text-muted transition-transform group-hover:translate-x-0.5" />
              </AppLink>
            </li>
          ))}
        </ul>
        <Button asChild variant="secondary" size="sm" className="mt-4">
          <AppLink href="/teklif-iste" locale={locale}>
            {t('requestQuote')}
          </AppLink>
        </Button>
      </section>
    </div>
  )
}
