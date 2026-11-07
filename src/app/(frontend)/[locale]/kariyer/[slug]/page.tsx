import { contentStaticParams } from '@/lib/static-params'

export const revalidate = 3600
export async function generateStaticParams({ params }: { params: Record<string, string> }) {
  return contentStaticParams('/kariyer/[slug]', params)
}

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { RichContent } from '@/components/blocks/rich-text'
import { SetAlternates } from '@/components/layout/set-alternates'
import { JsonLd } from '@/components/sections/json-ld'
import { PageHero } from '@/components/sections/page-hero'
import { Badge } from '@/components/ui/badge'
import { Container } from '@/components/ui/container'
import { Heading } from '@/components/ui/heading'
import { Section } from '@/components/ui/section'
import { getCareer, getContactSettings, getSlugVariants, mediaOf } from '@/lib/content'
import { alternateHrefs, enc, initLocale } from '@/lib/page-utils'
import { absoluteUrl, breadcrumbJsonLd, buildMetadata, seoText } from '@/lib/seo'
import { publicText, safeHref } from '@/lib/utils'

type Props = { params: Promise<{ locale: string; slug: string }> }

const variantPaths = async (id: number) => {
  const slugs = await getSlugVariants('careers', id)
  return Object.fromEntries(Object.entries(slugs).map(([l, s]) => [l, `/kariyer/${enc(s!)}`]))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const { slug } = await params
  const job = await getCareer(locale, slug)
  if (!job) notFound()
  return buildMetadata({
    locale, path: `/kariyer/${enc(slug)}`, ...seoText(job.meta, job.title, job.summary),
    image: mediaOf(job.meta?.image)?.url, variants: await variantPaths(job.id),
  })
}

export default async function CareerPage({ params }: Props) {
  const locale = await initLocale(params)
  const { slug } = await params
  const job = await getCareer(locale, slug)
  if (!job) notFound()
  const [t, c, settings, variants] = await Promise.all([
    getTranslations({ locale, namespace: 'careers' }),
    getTranslations({ locale, namespace: 'common' }),
    getContactSettings(locale),
    variantPaths(job.id),
  ])
  const trail = [
    { label: c('home'), href: '/' },
    { label: t('title'), href: '/kariyer' },
    { label: job.title, href: `/kariyer/${enc(slug)}` },
  ]
  const mail = settings?.contact?.email ? safeHref(`mailto:${settings.contact.email}`) : null
  const ld = {
    '@context': 'https://schema.org', '@type': 'JobPosting', title: job.title,
    description: job.summary || job.title, datePosted: job.publishedAt || undefined,
    employmentType: { 'full-time': 'FULL_TIME', 'part-time': 'PART_TIME', contract: 'CONTRACTOR', internship: 'INTERN' }[job.employmentType ?? 'full-time'],
    jobLocationType: job.workMode === 'remote' ? 'TELECOMMUTE' : undefined,
    hiringOrganization: { '@type': 'Organization', name: publicText(settings?.siteName) ?? c('siteName') },
    url: absoluteUrl(`/kariyer/${enc(slug)}`, locale),
  }
  return (
    <>
      <JsonLd data={ld} />
      <JsonLd data={breadcrumbJsonLd(locale, trail)} />
      <SetAlternates hrefs={alternateHrefs(variants)} />
      <PageHero
        locale={locale} crumbLabel={c('breadcrumb')} crumbs={trail} eyebrow={t('title')} title={job.title} lead={job.summary}
        actions={
          <div className="flex flex-wrap gap-2">
            {job.department ? <Badge>{job.department}</Badge> : null}
            {job.location ? <Badge>{job.location}</Badge> : null}
            {job.employmentType ? <Badge>{t(`type_${job.employmentType}`)}</Badge> : null}
            {job.workMode ? <Badge>{t(`mode_${job.workMode}`)}</Badge> : null}
          </div>
        }
      />
      <Section theme="light" spacing="md">
        <Container size="narrow" className="max-w-[52rem]">
          <RichContent data={job.description} locale={locale} />
          <div className="mt-14 rounded-lg border border-border bg-surface p-7">
            <Heading as="h2" size="h3">{t('apply')}</Heading>
            <p className="mt-2 text-small text-muted">{t('applyNote')}</p>
            {mail ? <a href={mail} className="mt-4 inline-block text-small font-medium text-accent underline-offset-4 hover:underline">{settings?.contact?.email}</a> : null}
          </div>
        </Container>
      </Section>
    </>
  )
}
