import { routing } from '@/i18n/routing'
export function generateStaticParams() { return routing.locales.map((locale) => ({ locale })) }

import { ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { EmptyState } from '@/components/sections/empty-state'
import { JsonLd } from '@/components/sections/json-ld'
import { PageHero } from '@/components/sections/page-hero'
import { AppLink } from '@/components/ui/app-link'
import { Badge } from '@/components/ui/badge'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { getCareers } from '@/lib/content'
import { initLocale } from '@/lib/page-utils'
import { breadcrumbJsonLd, buildMetadata } from '@/lib/seo'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'careers' })
  return buildMetadata({ locale, path: '/kariyer', title: t('title'), description: t('lead') })
}

export default async function CareersPage({ params }: Props) {
  const locale = await initLocale(params)
  const [t, c, jobs] = await Promise.all([
    getTranslations({ locale, namespace: 'careers' }),
    getTranslations({ locale, namespace: 'common' }),
    getCareers(locale),
  ])
  const trail = [{ label: c('home'), href: '/' }, { label: t('title'), href: '/kariyer' }]
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, trail)} />
      <PageHero locale={locale} crumbLabel={c('breadcrumb')} crumbs={trail} title={t('title')} lead={t('lead')} />
      <Section theme="light" spacing="md">
        <Container size="narrow" className="max-w-[56rem]">
          {jobs.length ? (
            <ul className="overflow-hidden rounded-lg border border-border bg-surface">
              {jobs.map((j) => (
                <li key={j.id} className="border-b border-border last:border-b-0">
                  <AppLink href={`/kariyer/${encodeURIComponent(j.slug!)}`} locale={locale} className="group flex items-center gap-4 px-6 py-5 transition-colors hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-h4 text-text">{j.title}</h2>
                      {j.summary ? <p className="mt-1 line-clamp-2 text-small text-muted">{j.summary}</p> : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {j.department ? <Badge>{j.department}</Badge> : null}
                        {j.location ? <Badge>{j.location}</Badge> : null}
                        {j.employmentType ? <Badge>{t(`type_${j.employmentType}`)}</Badge> : null}
                        {j.workMode ? <Badge>{t(`mode_${j.workMode}`)}</Badge> : null}
                      </div>
                    </div>
                    <ArrowRight aria-hidden className="size-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                  </AppLink>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={t('emptyTitle')} description={t('emptyDesc')} />
          )}
        </Container>
      </Section>
    </>
  )
}
