import { DynamicSecurity } from '@/components/security/dynamic-security'

export const dynamic = 'force-dynamic'
export const revalidate = 0

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { EmptyState } from '@/components/sections/empty-state'
import { JsonLd } from '@/components/sections/json-ld'
import { MediaCard } from '@/components/sections/media-card'
import { PageHero } from '@/components/sections/page-hero'
import { Container } from '@/components/ui/container'
import { Reveal } from '@/components/ui/reveal'
import { Section } from '@/components/ui/section'
import { getSolutions, relOf } from '@/lib/content'
import { first, initLocale } from '@/lib/page-utils'
import { breadcrumbJsonLd, buildMetadata } from '@/lib/seo'
import type { Industry } from '@/payload-types'

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'solutions' })
  return buildMetadata({ locale, path: '/cozumler', title: t('title'), description: t('lead') })
}

async function SolutionsPage({ params, searchParams }: Props) {
  const locale = await initLocale(params)
  const sector = first((await searchParams).sektor)
  const [t, c, all] = await Promise.all([
    getTranslations({ locale, namespace: 'solutions' }),
    getTranslations({ locale, namespace: 'common' }),
    getSolutions(locale),
  ])
  const solutions = sector
    ? all.filter((s) => (s.industries ?? []).some((i) => relOf<Industry>(i)?.slug === sector))
    : all
  const trail = [{ label: c('home'), href: '/' }, { label: t('title'), href: '/cozumler' }]
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, trail)} />
      <PageHero locale={locale} crumbLabel={c('breadcrumb')} crumbs={trail} title={t('title')} lead={t('lead')} />
      <Section theme="light" spacing="md">
        <Container>
          {solutions.length ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {solutions.map((s, i) => (
                <Reveal key={s.id} delay={(i % 3) * 0.05} className="h-full">
                  <MediaCard headingAs="h2" href={`/cozumler/${encodeURIComponent(s.slug!)}`} locale={locale} title={s.title} description={s.summary} image={s.heroImage} />
                </Reveal>
              ))}
            </div>
          ) : (
            <EmptyState title={t('emptyTitle')} description={t('emptyDesc')} />
          )}
        </Container>
      </Section>
    </>
  )
}

export default function Page(props: Props) {
  return <DynamicSecurity><SolutionsPage {...props} /></DynamicSecurity>
}
