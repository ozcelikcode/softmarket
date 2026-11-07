import { contentStaticParams } from '@/lib/static-params'

export const revalidate = 3600
export async function generateStaticParams({ params }: { params: Record<string, string> }) {
  return contentStaticParams('/urunler/[family]', params)
}

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { RichContent } from '@/components/blocks/rich-text'
import { SetAlternates } from '@/components/layout/set-alternates'
import { EmptyState } from '@/components/sections/empty-state'
import { JsonLd } from '@/components/sections/json-ld'
import { PageHero } from '@/components/sections/page-hero'
import { ProductCard } from '@/components/sections/product-card'
import { Container } from '@/components/ui/container'
import { NamedIcon } from '@/components/ui/icon'
import { MediaImage } from '@/components/ui/media-image'
import { Reveal } from '@/components/ui/reveal'
import { Section } from '@/components/ui/section'
import { SectionHeading } from '@/components/ui/heading'
import { getCatalogProducts, getFamily, getSlugVariants, mediaOf } from '@/lib/content'
import { alternateHrefs, enc, initLocale } from '@/lib/page-utils'
import { breadcrumbJsonLd, buildMetadata, seoText } from '@/lib/seo'

type Props = { params: Promise<{ locale: string; family: string }> }

const variantPaths = async (id: number) => {
  const slugs = await getSlugVariants('product-families', id)
  return Object.fromEntries(Object.entries(slugs).map(([l, s]) => [l, `/urunler/${enc(s!)}`]))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const { family: slug } = await params
  const family = await getFamily(locale, slug)
  if (!family) notFound()
  const seo = seoText(family.meta, family.title, family.tagline)
  return buildMetadata({
    locale, path: `/urunler/${enc(slug)}`, ...seo,
    image: mediaOf(family.meta?.image)?.url ?? mediaOf(family.image)?.url,
    variants: await variantPaths(family.id),
  })
}

export default async function FamilyPage({ params }: Props) {
  const locale = await initLocale(params)
  const { family: slug } = await params
  const family = await getFamily(locale, slug)
  if (!family) notFound()
  const [t, c, products, variants] = await Promise.all([
    getTranslations({ locale, namespace: 'products' }),
    getTranslations({ locale, namespace: 'common' }),
    getCatalogProducts(locale, { familyId: family.id }),
    variantPaths(family.id),
  ])
  const trail = [
    { label: c('home'), href: '/' },
    { label: t('title'), href: '/urunler' },
    { label: family.title, href: `/urunler/${enc(slug)}` },
  ]
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, trail)} />
      <SetAlternates hrefs={alternateHrefs(variants)} />
      <PageHero
        locale={locale} crumbLabel={c('breadcrumb')} crumbs={trail}
        eyebrow={t('title')} title={family.title} lead={family.tagline}
        aside={mediaOf(family.image) ? (
          <div className="overflow-hidden rounded-xl border border-border bg-surface"><MediaImage media={family.image} priority className="aspect-[16/10]" /></div>
        ) : undefined}
      />
      {family.description ? (
        <Section theme="light" spacing="sm">
          <Container size="narrow" className="max-w-[52rem]"><RichContent data={family.description} locale={locale} /></Container>
        </Section>
      ) : null}
      <Section theme="light" tone="raised" spacing="md" className="border-t border-border">
        <Container>
          <SectionHeading title={t('familyProducts')} className="mb-10" />
          {products.length ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {products.map((p, i) => (
                <Reveal key={p.id} delay={(i % 3) * 0.05} className="h-full">
                  <ProductCard
                    title={p.title} description={p.tagline ?? p.summary ?? undefined}
                    href={`/urunler/${enc(slug)}/${enc(p.slug!)}`} locale={locale}
                    icon={<NamedIcon name={family.icon} />}
                    image={mediaOf(p.heroImage) ? <MediaImage media={p.heroImage} /> : undefined}
                  />
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
