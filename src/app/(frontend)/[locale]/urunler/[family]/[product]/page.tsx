import { contentStaticParams } from '@/lib/static-params'

export const revalidate = 3600
export async function generateStaticParams({ params }: { params: Record<string, string> }) {
  return contentStaticParams('/urunler/[family]/[product]', params)
}

import { ArrowDownToLine, ArrowRight, Lock } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { RenderBlocks } from '@/components/blocks/render-blocks'
import { RichContent } from '@/components/blocks/rich-text'
import { SetAlternates } from '@/components/layout/set-alternates'
import { EditionCard } from '@/components/product/edition-card'
import { SpecTable } from '@/components/product/spec-table'
import { JsonLd } from '@/components/sections/json-ld'
import { FeatureGrid } from '@/components/sections/feature-grid'
import { PageHero } from '@/components/sections/page-hero'
import { AppLink } from '@/components/ui/app-link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Heading, SectionHeading } from '@/components/ui/heading'
import { NamedIcon } from '@/components/ui/icon'
import { MediaImage } from '@/components/ui/media-image'
import { Section } from '@/components/ui/section'
import { getProductDetail, getProductVariants, mediaOf } from '@/lib/content'
import { formatBytes } from '@/lib/format'
import { alternateHrefs, enc, initLocale } from '@/lib/page-utils'
import { absoluteUrl, breadcrumbJsonLd, buildMetadata, seoText, siteUrl } from '@/lib/seo'
import { safeHref } from '@/lib/utils'

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
  const [t, c, os, pt, variants] = await Promise.all([
    getTranslations({ locale, namespace: 'product' }),
    getTranslations({ locale, namespace: 'common' }),
    getTranslations({ locale, namespace: 'os' }),
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

  const hasOverview = Boolean(product.summary || product.layout?.length)
  const features = product.features ?? []
  const specs = product.specs ?? []
  const requirements = (product.systemRequirements ?? []).filter((r) => r.minimum || r.recommended)
  const groups = new Map<string, [string, string][]>()
  for (const s of specs) {
    const k = s.group ?? ''
    groups.set(k, [...(groups.get(k) ?? []), [s.label, s.value]])
  }
  const brochure = mediaOf(product.brochure)
  const docsHref = docSlug ? `/destek/dokumantasyon/${enc(productSlug)}/${enc(docSlug)}` : '/destek/dokumantasyon'

  const sections = [
    hasOverview && { id: 'genel-bakis', label: t('overview') },
    features.length > 0 && { id: 'ozellikler', label: t('features') },
    (specs.length > 0 || requirements.length > 0) && { id: 'teknik-ozellikler', label: t('specs') },
    { id: 'surumler', label: t('editions') },
    { id: 'indirmeler', label: t('downloads') },
    { id: 'dokumantasyon', label: t('docs') },
  ].filter(Boolean) as { id: string; label: string }[]

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

      <PageHero
        locale={locale} crumbLabel={c('breadcrumb')} crumbs={trail}
        eyebrow={family.title} title={product.title} lead={product.tagline ?? product.summary}
        actions={
          <>
            <Button asChild size="lg"><AppLink href={`${path}#surumler`} locale={locale}>{t('editions')}</AppLink></Button>
            {brochure && safeHref(brochure.url) ? (
              <Button asChild size="lg" variant="secondary"><a href={brochure.url!} download>{t('brochure')}<ArrowDownToLine aria-hidden /></a></Button>
            ) : null}
          </>
        }
        aside={mediaOf(product.heroImage) ? (
          <div className="overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-[0_30px_80px_-30px_color-mix(in_oklab,var(--accent)_35%,transparent)]">
            <MediaImage media={product.heroImage} priority sizes="(min-width: 1024px) 45vw, 100vw" className="aspect-[16/10] rounded-lg" />
          </div>
        ) : undefined}
      />

      <Section theme="dark" spacing="none" className="sticky top-16 z-30 border-b border-border bg-bg/85 backdrop-blur lg:top-[4.5rem]">
        <Container>
          <nav aria-label={t('nav')} className="-mx-1 flex gap-1 overflow-x-auto">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="whitespace-nowrap rounded-md px-3 py-3.5 text-small font-medium text-muted transition-colors hover:text-text">
                {s.label}
              </a>
            ))}
          </nav>
        </Container>
      </Section>

      {hasOverview ? (
        <div id="genel-bakis" className="scroll-mt-32">
          {product.summary ? (
            <Section theme="light" spacing="md">
              <Container size="narrow"><p className="text-h3 font-normal text-text text-pretty">{product.summary}</p></Container>
            </Section>
          ) : null}
          <RenderBlocks blocks={product.layout} locale={locale} />
        </div>
      ) : null}

      {features.length ? (
        <Section id="ozellikler" theme="light" tone="raised" spacing="md" className="scroll-mt-32">
          <Container>
            <SectionHeading title={t('features')} className="mb-10" />
            <FeatureGrid features={features.map((f) => ({ title: f.title, description: f.description ?? undefined, icon: f.icon ? <NamedIcon name={f.icon} /> : undefined }))} />
          </Container>
        </Section>
      ) : null}

      {specs.length || requirements.length ? (
        <Section id="teknik-ozellikler" theme="light" spacing="md" className="scroll-mt-32">
          <Container className="space-y-16">
            {specs.length ? (
              <div>
                <SectionHeading title={t('specs')} className="mb-10" />
                <SpecTable groups={[...groups].map(([title, rows]) => ({ title: title || undefined, rows }))} />
              </div>
            ) : null}
            {requirements.length ? (
              <div>
                <SectionHeading title={t('requirements')} className="mb-10" />
                <div className="grid gap-5 md:grid-cols-2">
                  {requirements.map((r, i) => (
                    <div key={r.id ?? i} className="rounded-lg border border-border bg-surface p-6">
                      <Badge variant="accent">{os(r.os)}</Badge>
                      {r.minimum ? <div className="mt-5"><p className="mb-2 text-eyebrow font-semibold uppercase text-muted">{t('minimum')}</p><RichContent data={r.minimum} locale={locale} className="text-small" /></div> : null}
                      {r.recommended ? <div className="mt-5"><p className="mb-2 text-eyebrow font-semibold uppercase text-muted">{t('recommended')}</p><RichContent data={r.recommended} locale={locale} className="text-small" /></div> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Container>
        </Section>
      ) : null}

      <Section id="surumler" theme="dark" spacing="lg" className="scroll-mt-32 overflow-hidden border-y border-border">
        <div aria-hidden className="bg-glow pointer-events-none absolute inset-0" />
        <Container className="relative">
          <SectionHeading title={t('editions')} className="mb-12" />
          {editions.length ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {editions.map((e) => <EditionCard key={e.id} edition={e} productSlug={productSlug} locale={locale} />)}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border-strong/60 p-10 text-center">
              <p className="text-muted">{t('editionsEmpty')}</p>
              <Button asChild className="mt-6"><AppLink href={`/teklif-iste?urun=${enc(productSlug)}`} locale={locale}>{t('quote')}</AppLink></Button>
            </div>
          )}
        </Container>
      </Section>

      <Section id="indirmeler" theme="light" spacing="md" className="scroll-mt-32">
        <Container>
          <SectionHeading title={t('downloads')} className="mb-10" />
          {downloads.length ? (
            <ul className="overflow-hidden rounded-lg border border-border bg-surface">
              {downloads.map((d) => {
                const file = mediaOf(d.file) as { url?: string | null; filesize?: number | null } | null
                const href = safeHref(file?.url)
                return (
                  <li key={d.id} className="flex flex-wrap items-center gap-4 border-b border-border px-5 py-4 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-text">{d.title}</p>
                      <p className="mt-0.5 text-small text-muted">
                        {[os(d.os), d.arch, formatBytes((d.file as { filesize?: number | null })?.filesize)].filter(Boolean).join(' · ')}
                      </p>
                      {d.checksumSha256 ? <p className="mt-1 break-all font-mono text-xs text-muted">{t('checksum')}: {d.checksumSha256}</p> : null}
                    </div>
                    {href ? (
                      <Button asChild variant="secondary" size="sm"><a href={href} download>{t('download')}<ArrowDownToLine aria-hidden /></a></Button>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-muted">{t('noDownloads')}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-2 px-5 py-4">
            <Lock aria-hidden className="size-4 text-muted" />
            <p className="flex-1 text-small text-muted"><span className="font-medium text-text">{t('licenseRequired')}.</span> {t('licensedNote')}</p>
            <Button asChild variant="link"><AppLink href="/hesap/indirmeler" locale={locale}>{t('portal')}<ArrowRight aria-hidden /></AppLink></Button>
          </div>
        </Container>
      </Section>

      <Section id="dokumantasyon" theme="light" tone="raised" spacing="md" className="scroll-mt-32 border-t border-border">
        <Container className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <Heading size="h3">{t('docs')}</Heading>
            <p className="mt-2 text-muted">{t('docsLead')}</p>
          </div>
          <Button asChild variant="secondary" size="lg"><AppLink href={docsHref} locale={locale}>{t('openDocs')}<ArrowRight aria-hidden /></AppLink></Button>
        </Container>
      </Section>
    </>
  )
}
