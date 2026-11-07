import { contentStaticParams } from '@/lib/static-params'

export const revalidate = 3600
export async function generateStaticParams({ params }: { params: Record<string, string> }) {
  return contentStaticParams('/destek/dokumantasyon/[product]/[slug]', params)
}

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { RichContent } from '@/components/blocks/rich-text'
import { SetAlternates } from '@/components/layout/set-alternates'
import { SupportFrame } from '@/components/sections/support-frame'
import { DocSidebar } from '@/components/sections/doc-sidebar'
import { AppLink } from '@/components/ui/app-link'
import { alternateHrefs, initLocale } from '@/lib/page-utils'
import { JsonLd } from '@/components/sections/json-ld'
import { absoluteUrl, buildMetadata, seoText } from '@/lib/seo'
import {
  getDoc,
  getDocTree,
  getSupportProducts,
  orderDocTree,
  supportVariants,
} from '@/lib/support'
import { prepareDocContent } from '@/lib/doc-content'

type Props = { params: Promise<{ locale: string; product: string; slug: string }> }
async function load(params: Props['params']) {
  const locale = await initLocale(params)
  const { product: productSlug, slug } = await params
  const product = (await getSupportProducts(locale)).find((p) => p.slug === productSlug)
  if (!product) notFound()
  const doc = await getDoc(locale, product.id, slug)
  if (!doc) notFound()
  return { locale, product, doc, productSlug, slug }
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, product, doc, productSlug, slug } = await load(params)
  return buildMetadata({
    locale,
    path: `/destek/dokumantasyon/${encodeURIComponent(productSlug)}/${encodeURIComponent(slug)}`,
    ...seoText(doc.meta, doc.title, doc.excerpt),
    variants: await supportVariants(product.id, doc.id),
  })
}
export default async function DocumentationDetail({ params }: Props) {
  const { locale, product, doc, productSlug, slug } = await load(params)
  const t = await getTranslations({ locale, namespace: 'supportCenter' })
  const [docs, variants] = await Promise.all([
    getDocTree(locale, product.id),
    supportVariants(product.id, doc.id),
  ])
  const tree = orderDocTree(docs)
  const index = tree.findIndex((d) => d.id === doc.id)
  const previous = index > 0 ? tree[index - 1] : null,
    next = index >= 0 ? tree[index + 1] : null
  const { data, headings } = prepareDocContent(doc.content)
  const base = `/destek/dokumantasyon/${encodeURIComponent(productSlug)}`
  return (
    <>
      <SetAlternates hrefs={alternateHrefs(variants)} />
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'TechArticle',
        headline: doc.title, description: doc.excerpt || undefined, inLanguage: locale,
        dateModified: doc.updatedAt, datePublished: doc.createdAt,
        mainEntityOfPage: absoluteUrl(`${base}/${encodeURIComponent(slug)}`, locale),
        about: { '@type': 'SoftwareApplication', name: product.title },
      }} />
      <SupportFrame
        locale={locale}
        title={doc.title}
        lead={doc.excerpt ?? undefined}
        path={`${base}/${encodeURIComponent(slug)}`}
        crumbs={[
          { label: t('documentation'), href: '/destek/dokumantasyon' },
          { label: product.title, href: base },
        ]}
      >
        <div className="grid items-start gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_12rem]">
          <DocSidebar
            docs={docs}
            product={productSlug}
            locale={locale}
            current={doc.id}
            label={t('docNav')}
          />
          <article className="min-w-0">
            {headings.length ? (
              <nav
                aria-label={t('toc')}
                className="mb-8 rounded-lg border border-border p-5 xl:hidden"
              >
                <h2 className="font-semibold">{t('toc')}</h2>
                <ul className="mt-2 space-y-2">
                  {headings.map((h) => (
                    <li key={h.id}>
                      <a href={`#${h.id}`} className="text-small text-accent">
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
            <RichContent
              locale={locale}
              data={data}
              className="[&_h2]:scroll-mt-24 [&_h3]:scroll-mt-24 [&_h4]:scroll-mt-24 [&_h5]:scroll-mt-24 [&_h6]:scroll-mt-24"
            />
            <nav
              aria-label={t('docNav')}
              className="mt-12 flex flex-wrap justify-between gap-6 border-t border-border pt-6"
            >
              {previous ? (
                <AppLink
                  locale={locale}
                  href={`${base}/${encodeURIComponent(previous.slug!)}`}
                  className="text-accent"
                >
                  ← {t('previous')}: {previous.title}
                </AppLink>
              ) : (
                <span />
              )}
              {next ? (
                <AppLink
                  locale={locale}
                  href={`${base}/${encodeURIComponent(next.slug!)}`}
                  className="text-accent"
                >
                  {t('next')}: {next.title} →
                </AppLink>
              ) : null}
            </nav>
          </article>
          {headings.length ? (
            <nav aria-label={t('toc')} className="sticky top-24 hidden xl:block">
              <h2 className="font-semibold">{t('toc')}</h2>
              <ul className="mt-3 space-y-3">
                {headings.map((h) => (
                  <li key={h.id}>
                    <a href={`#${h.id}`} className="text-small text-muted hover:text-accent">
                      {h.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      </SupportFrame>
    </>
  )
}
