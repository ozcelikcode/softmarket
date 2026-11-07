import { contentStaticParams } from '@/lib/static-params'

export const revalidate = 3600
export async function generateStaticParams({ params }: { params: Record<string, string> }) {
  return contentStaticParams('/haberler/[slug]', params)
}

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { RichContent } from '@/components/blocks/rich-text'
import { SetAlternates } from '@/components/layout/set-alternates'
import { JsonLd } from '@/components/sections/json-ld'
import { PageHero } from '@/components/sections/page-hero'
import { ProductCard } from '@/components/sections/product-card'
import { Badge } from '@/components/ui/badge'
import { Container } from '@/components/ui/container'
import { SectionHeading } from '@/components/ui/heading'
import { NamedIcon } from '@/components/ui/icon'
import { MediaImage } from '@/components/ui/media-image'
import { Section } from '@/components/ui/section'
import { getPost, getSlugVariants, mediaOf, relOf } from '@/lib/content'
import { formatDate } from '@/lib/format'
import { alternateHrefs, enc, initLocale } from '@/lib/page-utils'
import { absoluteUrl, breadcrumbJsonLd, buildMetadata, seoText, siteUrl } from '@/lib/seo'
import type { Product, ProductFamily } from '@/payload-types'

type Props = { params: Promise<{ locale: string; slug: string }> }

const variantPaths = async (id: number) => {
  const slugs = await getSlugVariants('posts', id)
  return Object.fromEntries(Object.entries(slugs).map(([l, s]) => [l, `/haberler/${enc(s!)}`]))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const { slug } = await params
  const post = await getPost(locale, slug)
  if (!post) notFound()
  return buildMetadata({
    locale, path: `/haberler/${enc(slug)}`, ...seoText(post.meta, post.title, post.excerpt),
    image: mediaOf(post.meta?.image)?.url ?? mediaOf(post.coverImage)?.url, variants: await variantPaths(post.id), type: 'article',
  })
}

export default async function PostPage({ params }: Props) {
  const locale = await initLocale(params)
  const { slug } = await params
  const post = await getPost(locale, slug)
  if (!post) notFound()
  const [t, c, variants] = await Promise.all([
    getTranslations({ locale, namespace: 'news' }),
    getTranslations({ locale, namespace: 'common' }),
    variantPaths(post.id),
  ])
  const trail = [
    { label: c('home'), href: '/' },
    { label: t('title'), href: '/haberler' },
    { label: post.title, href: `/haberler/${enc(slug)}` },
  ]
  const products = (post.products ?? []).flatMap((p) => {
    const prod = relOf<Product>(p)
    const fam = relOf<ProductFamily>(prod?.family)
    return prod?.slug && fam?.slug ? [{ prod, fam }] : []
  })
  const cover = mediaOf(post.coverImage)?.url
  const ld = {
    '@context': 'https://schema.org', '@type': 'Article', headline: post.title,
    description: post.excerpt || undefined, datePublished: post.publishedAt || undefined, dateModified: post.updatedAt,
    mainEntityOfPage: absoluteUrl(`/haberler/${enc(slug)}`, locale),
    ...(cover ? { image: cover.startsWith('http') ? cover : `${siteUrl()}${cover}` } : {}),
  }
  return (
    <>
      <JsonLd data={ld} />
      <JsonLd data={breadcrumbJsonLd(locale, trail)} />
      <SetAlternates hrefs={alternateHrefs(variants)} />
      <PageHero
        locale={locale} crumbLabel={c('breadcrumb')} crumbs={trail} title={post.title} lead={post.excerpt}
        eyebrow={<span className="inline-flex items-center gap-3">{post.category ? <Badge variant="accent">{t(`cat.${post.category}`)}</Badge> : null}<span className="font-normal normal-case tracking-normal text-muted">{formatDate(post.publishedAt, locale)}</span></span>}
      />
      <Section theme="light" spacing="md">
        <Container size="narrow" className="max-w-[52rem]">
          {cover ? <div className="mb-12 overflow-hidden rounded-xl border border-border"><MediaImage media={post.coverImage} priority className="aspect-[16/9]" /></div> : null}
          <RichContent data={post.content} locale={locale} />
        </Container>
      </Section>
      {products.length ? (
        <Section theme="light" tone="raised" spacing="md" className="border-t border-border">
          <Container>
            <SectionHeading title={t('related')} className="mb-10" />
            <div className="grid gap-5 md:grid-cols-3">
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
