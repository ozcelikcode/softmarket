import { contentStaticParams } from '@/lib/static-params'

export const revalidate = 3600
export async function generateStaticParams({ params }: { params: Record<string, string> }) {
  return contentStaticParams('/referanslar/[slug]', params)
}

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { RenderBlocks } from '@/components/blocks/render-blocks'
import { RichContent } from '@/components/blocks/rich-text'
import { SetAlternates } from '@/components/layout/set-alternates'
import { JsonLd } from '@/components/sections/json-ld'
import { PageHero } from '@/components/sections/page-hero'
import { ProductCard } from '@/components/sections/product-card'
import { Container } from '@/components/ui/container'
import { SectionHeading } from '@/components/ui/heading'
import { NamedIcon } from '@/components/ui/icon'
import { MediaImage } from '@/components/ui/media-image'
import { Section } from '@/components/ui/section'
import { getCaseStudy, getSlugVariants, mediaOf, relOf } from '@/lib/content'
import { alternateHrefs, enc, initLocale } from '@/lib/page-utils'
import { breadcrumbJsonLd, buildMetadata, seoText } from '@/lib/seo'
import type { Product, ProductFamily } from '@/payload-types'

type Props = { params: Promise<{ locale: string; slug: string }> }

const variantPaths = async (id: number) => {
  const slugs = await getSlugVariants('case-studies', id)
  return Object.fromEntries(Object.entries(slugs).map(([l, s]) => [l, `/referanslar/${enc(s!)}`]))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const { slug } = await params
  const cs = await getCaseStudy(locale, slug)
  if (!cs) notFound()
  return buildMetadata({
    locale, path: `/referanslar/${enc(slug)}`, ...seoText(cs.meta, cs.title, cs.summary),
    image: mediaOf(cs.meta?.image)?.url, variants: await variantPaths(cs.id), type: 'article',
  })
}

export default async function CaseStudyPage({ params }: Props) {
  const locale = await initLocale(params)
  const { slug } = await params
  const cs = await getCaseStudy(locale, slug)
  if (!cs) notFound()
  const [t, c, variants] = await Promise.all([
    getTranslations({ locale, namespace: 'customers' }),
    getTranslations({ locale, namespace: 'common' }),
    variantPaths(cs.id),
  ])
  const trail = [
    { label: c('home'), href: '/' },
    { label: t('title'), href: '/referanslar' },
    { label: cs.title, href: `/referanslar/${enc(slug)}` },
  ]
  const products = (cs.products ?? []).flatMap((p) => {
    const prod = relOf<Product>(p)
    const fam = relOf<ProductFamily>(prod?.family)
    return prod?.slug && fam?.slug ? [{ prod, fam }] : []
  })
  const q = cs.testimonial
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, trail)} />
      <SetAlternates hrefs={alternateHrefs(variants)} />
      <PageHero
        locale={locale} crumbLabel={c('breadcrumb')} crumbs={trail} eyebrow={cs.customerName} title={cs.title} lead={cs.summary}
        aside={mediaOf(cs.customerLogo) ? <div className="flex h-40 items-center justify-center rounded-xl border border-border bg-surface p-8"><MediaImage media={cs.customerLogo} className="max-h-full w-auto object-contain" /></div> : undefined}
      />
      {cs.results?.length ? (
        <Section theme="dark" spacing="sm" className="border-b border-border">
          <Container>
            <h2 className="sr-only">{t('results')}</h2>
            <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {cs.results.map((r, i) => (
                <div key={r.id ?? i} className="bg-surface p-7">
                  <dd className="font-mono text-h1 text-text">{r.value}</dd>
                  <dt className="mt-2 text-small text-muted">{r.label}</dt>
                </div>
              ))}
            </dl>
          </Container>
        </Section>
      ) : null}
      {cs.challenge || cs.solution ? (
        <Section theme="light" spacing="md">
          <Container className="grid gap-12 lg:grid-cols-2">
            {cs.challenge ? <div><SectionHeading title={t('challenge')} size="h2" className="mb-6" /><RichContent data={cs.challenge} locale={locale} /></div> : null}
            {cs.solution ? <div><SectionHeading title={t('solution')} size="h2" className="mb-6" /><RichContent data={cs.solution} locale={locale} /></div> : null}
          </Container>
        </Section>
      ) : null}
      {q?.quote ? (
        <Section theme="light" tone="raised" spacing="md" className="border-y border-border">
          <Container size="narrow">
            <figure>
              <blockquote className="text-h2 font-normal text-text text-balance">&ldquo;{q.quote}&rdquo;</blockquote>
              {q.author ? <figcaption className="mt-6 text-small text-muted"><span className="font-medium text-text">{q.author}</span>{q.role ? `, ${q.role}` : ''}</figcaption> : null}
            </figure>
          </Container>
        </Section>
      ) : null}
      <RenderBlocks blocks={cs.layout} locale={locale} />
      {products.length ? (
        <Section theme="light" spacing="md">
          <Container>
            <SectionHeading title={t('products')} className="mb-10" />
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {products.map(({ prod, fam }) => (
                <ProductCard key={prod.id} title={prod.title} description={prod.tagline ?? undefined} badge={fam.title} href={`/urunler/${enc(fam.slug!)}/${enc(prod.slug!)}`} locale={locale} icon={<NamedIcon name={fam.icon} />} />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}
    </>
  )
}
