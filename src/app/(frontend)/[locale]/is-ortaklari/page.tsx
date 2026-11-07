import { routing } from '@/i18n/routing'
export function generateStaticParams() { return routing.locales.map((locale) => ({ locale })) }

import { ArrowUpRight } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { CtaBand } from '@/components/sections/cta-band'
import { EmptyState } from '@/components/sections/empty-state'
import { JsonLd } from '@/components/sections/json-ld'
import { SystemBody, SystemHero, systemMeta } from '@/components/pages/system-page'
import { AppLink } from '@/components/ui/app-link'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { MediaImage } from '@/components/ui/media-image'
import { SectionHeading } from '@/components/ui/heading'
import { getPartners, getSystemPage, mediaOf } from '@/lib/content'
import { initLocale } from '@/lib/page-utils'
import { breadcrumbJsonLd, buildMetadata } from '@/lib/seo'
import { safeHref } from '@/lib/utils'

type Props = { params: Promise<{ locale: string }> }
const TIERS = ['technology', 'solution', 'reseller', 'distributor'] as const

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const [t, page] = await Promise.all([getTranslations({ locale, namespace: 'partners' }), getSystemPage(locale, 'partners')])
  return buildMetadata({ locale, path: '/is-ortaklari', ...systemMeta(page, { title: t('title'), lead: t('lead') }), image: mediaOf(page?.meta?.image)?.url })
}

export default async function PartnersPage({ params }: Props) {
  const locale = await initLocale(params)
  const [t, c, partners, page] = await Promise.all([
    getTranslations({ locale, namespace: 'partners' }),
    getTranslations({ locale, namespace: 'common' }),
    getPartners(locale),
    getSystemPage(locale, 'partners'),
  ])
  const trail = [{ label: c('home'), href: '/' }, { label: t('title'), href: '/is-ortaklari' }]
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, trail)} />
      <SystemHero locale={locale} crumbLabel={c('breadcrumb')} crumbs={trail} page={page} fallback={{ title: t('title'), lead: t('lead') }} />
      <SystemBody locale={locale} page={page} fallback={
        <CtaBand
          title={t('becomeTitle')} lead={t('becomeLead')}
          actions={<Button asChild size="lg"><AppLink href="/iletisim" locale={locale}>{t('becomeCta')}</AppLink></Button>}
        />
      } listing={
        <Container className="space-y-16">
          {partners.length ? TIERS.map((tier) => {
            const list = partners.filter((p) => (p.tier ?? 'reseller') === tier)
            if (!list.length) return null
            return (
              <div key={tier}>
                <SectionHeading size="h2" title={t(`tier.${tier}`)} className="mb-8" />
                <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((p) => {
                    const site = safeHref(p.website)
                    return (
                      <li key={p.id} className="flex flex-col rounded-lg border border-border bg-surface p-6">
                        <div className="flex h-14 items-center">
                          {mediaOf(p.logo) ? <MediaImage media={p.logo} className="max-h-12 w-auto object-contain" /> : <span className="text-h3 text-text">{p.name}</span>}
                        </div>
                        <p className="mt-4 text-h4 text-text">{p.name}</p>
                        {p.country || p.city ? <p className="text-small text-muted">{[p.city, p.country].filter(Boolean).join(', ')}</p> : null}
                        {p.description ? <p className="mt-3 flex-1 text-small text-muted">{p.description}</p> : <span className="flex-1" />}
                        {site && /^https?:/.test(site) ? (
                          <a href={site} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-1 text-small font-medium text-accent">{t('visit')}<ArrowUpRight aria-hidden className="size-4" /></a>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          }) : <EmptyState title={t('emptyTitle')} description={t('emptyDesc')} />}
        </Container>
      } />
    </>
  )
}
