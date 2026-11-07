import { contentStaticParams } from '@/lib/static-params'

export const revalidate = 3600
export async function generateStaticParams({ params }: { params: Record<string, string> }) {
  return contentStaticParams('/destek/dokumantasyon/[product]', params)
}

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { SetAlternates } from '@/components/layout/set-alternates'
import { SupportFrame } from '@/components/sections/support-frame'
import { DocSidebar } from '@/components/sections/doc-sidebar'
import { AppLink } from '@/components/ui/app-link'
import { alternateHrefs, initLocale } from '@/lib/page-utils'
import { buildMetadata } from '@/lib/seo'
import { getDocTree, getSupportProducts, orderDocTree, supportVariants } from '@/lib/support'

type Props = { params: Promise<{ locale: string; product: string }> }
async function load(params: Props['params']) {
  const locale = await initLocale(params)
  const { product: slug } = await params
  const product = (await getSupportProducts(locale)).find((p) => p.slug === slug)
  if (!product) notFound()
  return { locale, product, slug }
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, product, slug } = await load(params)
  return buildMetadata({
    locale,
    path: `/destek/dokumantasyon/${encodeURIComponent(slug)}`,
    title: product.title,
    variants: await supportVariants(product.id),
  })
}
export default async function ProductDocumentation({ params }: Props) {
  const { locale, product, slug } = await load(params)
  const t = await getTranslations({ locale, namespace: 'supportCenter' })
  const [docs, variants] = await Promise.all([
    getDocTree(locale, product.id),
    supportVariants(product.id),
  ])
  const path = `/destek/dokumantasyon/${encodeURIComponent(slug)}`
  return (
    <>
      <SetAlternates hrefs={alternateHrefs(variants)} />
      <SupportFrame
        locale={locale}
        title={product.title}
        path={path}
        crumbs={[{ label: t('documentation'), href: '/destek/dokumantasyon' }]}
      >
        <div className="grid items-start gap-10 lg:grid-cols-[18rem_1fr]">
          <DocSidebar docs={docs} product={slug} locale={locale} label={t('docNav')} />
          <div>
            <h2 className="mb-6 text-h3">{t('documentation')}</h2>
            <ul className="space-y-4">
              {orderDocTree(docs).map((d) => (
                <li key={d.id}>
                  <AppLink
                    locale={locale}
                    href={`${path}/${encodeURIComponent(d.slug!)}`}
                    className="text-accent"
                  >
                    {d.title} →
                  </AppLink>
                </li>
              ))}
            </ul>
            {!docs.length ? <p>{t('empty')}</p> : null}
          </div>
        </div>
      </SupportFrame>
    </>
  )
}
