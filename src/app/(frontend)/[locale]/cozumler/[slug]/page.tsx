import { contentStaticParams } from '@/lib/static-params'

export const revalidate = 3600
export async function generateStaticParams({ params }: { params: Record<string, string> }) {
  return contentStaticParams('/cozumler/[slug]', params)
}

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { RenderBlocks } from '@/components/blocks/render-blocks'
import { SetAlternates } from '@/components/layout/set-alternates'
import { JsonLd } from '@/components/sections/json-ld'
import { MediaCard } from '@/components/sections/media-card'
import { PageHero } from '@/components/sections/page-hero'
import { ProductCard } from '@/components/sections/product-card'
import { Container } from '@/components/ui/container'
import { SectionHeading } from '@/components/ui/heading'
import { NamedIcon } from '@/components/ui/icon'
import { MediaImage } from '@/components/ui/media-image'
import { Section } from '@/components/ui/section'
import { getSlugVariants, getSolution, mediaOf, relOf } from '@/lib/content'
import { alternateHrefs, enc, initLocale } from '@/lib/page-utils'
import { breadcrumbJsonLd, buildMetadata, seoText } from '@/lib/seo'
import type { CaseStudy, Product, ProductFamily } from '@/payload-types'

type Props = { params: Promise<{ locale: string; slug: string }> }

const variantPaths = async (id: number) => {
  const slugs = await getSlugVariants('solutions', id)
  return Object.fromEntries(Object.entries(slugs).map(([l, s]) => [l, `/cozumler/${enc(s!)}`]))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const { slug } = await params
  const s = await getSolution(locale, slug)
  if (!s) notFound()
  return buildMetadata({
    locale, path: `/cozumler/${enc(slug)}`, ...seoText(s.meta, s.title, s.summary),
    image: mediaOf(s.meta?.image)?.url ?? mediaOf(s.heroImage)?.url, variants: await variantPaths(s.id),
  })
}

export default async function SolutionPage({ params }: Props) {
  const locale = await initLocale(params)
  const { slug } = await params
  const s = await getSolution(locale, slug)
  if (!s) notFound()
  const [t, c, variants] = await Promise.all([
    getTranslations({ locale, namespace: 'solutions' }),
    getTranslations({ locale, namespace: 'common' }),
    variantPaths(s.id),
  ])
  const trail = [
    { label: c('home'), href: '/' },
    { label: t('title'), href: '/cozumler' },
    { label: s.title, href: `/cozumler/${enc(slug)}` },
  ]
  const products = (s.products ?? []).flatMap((p) => {
    const prod = relOf<Product>(p)
    const fam = relOf<ProductFamily>(prod?.family)
    return prod?.slug && fam?.slug ? [{ prod, fam }] : []
  })
  const cases = (s.caseStudies ?? []).flatMap((x) => { const cs = relOf<CaseStudy>(x); return cs?.slug ? [cs] : [] })
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, trail)} />
      <SetAlternates hrefs={alternateHrefs(variants)} />
      <PageHero
        locale={locale} crumbLabel={c('breadcrumb')} crumbs={trail} eyebrow={t('title')} title={s.title} lead={s.summary}
        aside={mediaOf(s.heroImage) ? <div className="overflow-hidden rounded-xl border border-border bg-surface"><MediaImage media={s.heroImage} priority className="aspect-[16/10]" /></div> : undefined}
      />
      <RenderBlocks blocks={s.layout} locale={locale} />
      {products.length ? (
        <Section theme="light" tone="raised" spacing="md" className="border-t border-border">
          <Container>
            <SectionHeading title={t('products')} className="mb-10" />
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {products.map(({ prod, fam }) => (
                <ProductCard
                  key={prod.id} title={prod.title} description={prod.tagline ?? prod.summary ?? undefined} badge={fam.title}
                  href={`/urunler/${enc(fam.slug!)}/${enc(prod.slug!)}`} locale={locale} icon={<NamedIcon name={fam.icon} />}
                  image={mediaOf(prod.heroImage) ? <MediaImage media={prod.heroImage} /> : undefined}
                />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}
      {cases.length ? (
        <Section theme="light" spacing="md" className="border-t border-border">
          <Container>
            <SectionHeading title={t('cases')} className="mb-10" />
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {cases.map((cs) => (
                <MediaCard key={cs.id} href={`/referanslar/${enc(cs.slug!)}`} locale={locale} title={cs.title} description={cs.summary} meta={cs.customerName} logo={mediaOf(cs.customerLogo) ? <MediaImage media={cs.customerLogo} className="max-h-12 w-auto object-contain" /> : undefined} />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}
    </>
  )
}
