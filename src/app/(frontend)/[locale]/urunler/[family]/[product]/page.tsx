import { contentStaticParams } from '@/lib/static-params'

export const revalidate = 3600
export async function generateStaticParams({ params }: { params: Record<string, string> }) {
  return contentStaticParams('/urunler/[family]/[product]', params)
}

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { RenderBlocks, type LayoutBlock } from '@/components/blocks/render-blocks'
import { SetAlternates } from '@/components/layout/set-alternates'
import { JsonLd } from '@/components/sections/json-ld'
import { composeProductLayout, PRODUCT_BOUND_BLOCKS } from '@/lib/blocks/product-composition'
import { getProductDetail, getProductVariants, mediaOf } from '@/lib/content'
import { alternateHrefs, enc, initLocale } from '@/lib/page-utils'
import { absoluteUrl, breadcrumbJsonLd, buildMetadata, seoText, siteUrl } from '@/lib/seo'

type Props = { params: Promise<{ locale: string; family: string; product: string }> }

const variantPaths = async (id: number) => {
  const v = await getProductVariants(id)
  return Object.fromEntries(Object.entries(v).map(([l, parts]) => [l, `/urunler/${parts!.map(enc).join('/')}`]))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const { family, product: slug } = await params
  const data = await getProductDetail(locale, family, slug)
  if (!data) notFound()
  const { product } = data
  return buildMetadata({
    locale, path: `/urunler/${enc(family)}/${enc(slug)}`, ...seoText(product.meta, product.title, product.tagline ?? product.summary),
    image: mediaOf(product.meta?.image)?.url ?? mediaOf(product.heroImage)?.url,
    variants: await variantPaths(product.id),
  })
}

export default async function ProductPage({ params }: Props) {
  const locale = await initLocale(params)
  const { family: familySlug, product: productSlug } = await params
  const data = await getProductDetail(locale, familySlug, productSlug)
  if (!data) notFound()
  const { family, product, editions, downloads, docSlug } = data
  const [c, pt, variants] = await Promise.all([
    getTranslations({ locale, namespace: 'common' }),
    getTranslations({ locale, namespace: 'products' }),
    variantPaths(product.id),
  ])

  const path = `/urunler/${enc(familySlug)}/${enc(productSlug)}`
  const trail = [
    { label: c('home'), href: '/' },
    { label: pt('title'), href: '/urunler' },
    { label: family.title, href: `/urunler/${enc(familySlug)}` },
    { label: product.title, href: path },
  ]

  // V2: every section is a product-bound block. Empty/legacy layout = compatibility mode (pre-V2 order, extra
  // blocks after the fixed sections with the duplicate filter); see src/lib/blocks/product-composition.ts.
  const { mode, blocks, sections } = composeProductLayout(product.layout, {
    summary: Boolean(product.summary),
    features: (product.features ?? []).length > 0,
    specs: (product.specs ?? []).length > 0,
    requirements: (product.systemRequirements ?? []).some((r) => r.minimum || r.recommended),
  })

  const image = mediaOf(product.heroImage)?.url
  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.meta?.description || product.tagline || product.summary || undefined,
    url: absoluteUrl(path, locale),
    category: family.title,
    brand: { '@type': 'Brand', name: 'SoftMarket' },
    ...(image ? { image: image.startsWith('http') ? image : `${siteUrl()}${image}` } : {}),
  }

  return (
    <>
      <JsonLd data={productLd} />
      <JsonLd data={breadcrumbJsonLd(locale, trail)} />
      <SetAlternates hrefs={alternateHrefs(variants)} />

      {mode === 'compat' ? (
        <>
          <RenderBlocks blocks={blocks.slice(0, PRODUCT_BOUND_BLOCKS.length) as LayoutBlock[]} locale={locale}
            slots={{ product: { family, product, editions, downloads, docSlug, productSlug, path, trail, sections } }} />
          {/* Keep the old planning boundary: the first extra CMS block retains its LCP-safe motion. */}
          <RenderBlocks blocks={blocks.slice(PRODUCT_BOUND_BLOCKS.length) as LayoutBlock[]} locale={locale} />
        </>
      ) : (
        <RenderBlocks blocks={blocks as LayoutBlock[]} locale={locale}
          slots={{ product: { family, product, editions, downloads, docSlug, productSlug, path, trail, sections } }} />
      )}
    </>
  )
}
