import { DynamicSecurity } from '@/components/security/dynamic-security'

export const dynamic = 'force-dynamic'
export const revalidate = 0

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { EmptyState } from '@/components/sections/empty-state'
import { JsonLd } from '@/components/sections/json-ld'
import { MediaCard } from '@/components/sections/media-card'
import { PageHero } from '@/components/sections/page-hero'
import { AppLink } from '@/components/ui/app-link'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { anim } from '@/lib/anim'
import { getPosts } from '@/lib/content'
import { formatDate } from '@/lib/format'
import { initLocale, MAX_PAGE, parsePage } from '@/lib/page-utils'
import { breadcrumbJsonLd, buildMetadata } from '@/lib/seo'

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const page = parsePage((await searchParams).sayfa)
  if (page === null) notFound()
  if (page > 1 && page > (await getPosts(locale, { page })).totalPages) notFound()
  const t = await getTranslations({ locale, namespace: 'news' })
  return buildMetadata({ locale, path: page > 1 ? `/haberler?sayfa=${page}` : '/haberler', title: t('title'), description: t('lead') })
}

async function NewsPage({ params, searchParams }: Props) {
  const locale = await initLocale(params)
  const page = parsePage((await searchParams).sayfa)
  if (page === null) notFound()
  const [t, c, posts] = await Promise.all([
    getTranslations({ locale, namespace: 'news' }),
    getTranslations({ locale, namespace: 'common' }),
    getPosts(locale, { page }),
  ])
  if (page > 1 && page > posts.totalPages) notFound()
  const totalPages = Math.min(posts.totalPages, MAX_PAGE)
  const trail = [{ label: c('home'), href: '/' }, { label: t('title'), href: '/haberler' }]
  const href = (p: number) => (p > 1 ? `/haberler?sayfa=${p}` : '/haberler')
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, trail)} />
      <PageHero locale={locale} crumbLabel={c('breadcrumb')} crumbs={trail} title={t('title')} lead={t('lead')} />
      <Section theme="light" spacing="md">
        <Container>
          {posts.docs.length ? (
            <>
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {posts.docs.map((p, i) => (
                  <div key={p.id} {...anim(i % 3)} className="h-full">
                    <MediaCard
                      headingAs="h2"
                      href={`/haberler/${encodeURIComponent(p.slug!)}`} locale={locale} title={p.title} description={p.excerpt}
                      image={p.coverImage} badge={p.category ? t(`cat.${p.category}`) : null} meta={formatDate(p.publishedAt, locale)}
                    />
                  </div>
                ))}
              </div>
              {totalPages > 1 ? (
                <nav aria-label={t('pagination')} className="mt-12 flex items-center justify-center gap-4">
                  {page > 1 ? <Button asChild variant="secondary"><AppLink href={href(page - 1)} locale={locale}>{t('prev')}</AppLink></Button> : null}
                  <span className="text-small text-muted">{t('page', { page, total: totalPages })}</span>
                  {page < totalPages ? <Button asChild variant="secondary"><AppLink href={href(page + 1)} locale={locale}>{t('next')}</AppLink></Button> : null}
                </nav>
              ) : null}
            </>
          ) : (
            <EmptyState title={t('emptyTitle')} description={t('emptyDesc')} />
          )}
        </Container>
      </Section>
    </>
  )
}

export default function Page(props: Props) {
  return <DynamicSecurity><NewsPage {...props} /></DynamicSecurity>
}
