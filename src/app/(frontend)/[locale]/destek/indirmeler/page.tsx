import { DynamicSecurity } from '@/components/security/dynamic-security'

export const dynamic = 'force-dynamic'
export const revalidate = 0

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { SupportFrame } from '@/components/sections/support-frame'
import { AppLink } from '@/components/ui/app-link'
import { initLocale } from '@/lib/page-utils'
import { buildMetadata } from '@/lib/seo'
import type { Query } from '@/lib/support-query'

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Query> }
import { SupportFilters } from '@/components/sections/support-filters'
import { getDownloads, getReleases, getSupportProducts } from '@/lib/support'
import { boundedQuery } from '@/lib/support-query'
import { mediaOf, relOf } from '@/lib/content'
import type { Product, Release } from '@/payload-types'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'supportCenter' })
  return buildMetadata({ locale, path: '/destek/indirmeler', title: t('downloads') })
}

async function DownloadsPage({ params, searchParams }: Props) {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'supportCenter' })
  const q = await searchParams
  const products = await getSupportProducts(locale)
  const product = boundedQuery(q.urun),
    release = boundedQuery(q.surum, 12),
    os = boundedQuery(q.os, 20)
  if (product === null || release === null || os === null) notFound()
  const selected = products.find((p) => p.slug === product)
  if (product && !selected) notFound()
  if (os && !['windows', 'macos', 'linux', 'web', 'android', 'ios', 'other'].includes(os))
    notFound()
  const releases = await getReleases(locale, selected?.id)
  const selectedRelease = releases.find((r) => String(r.id) === release)
  if (release && !selectedRelease) notFound()
  const downloads = await getDownloads(locale, {
    productId: selected?.id,
    releaseId: selectedRelease?.id,
    os,
  })
  return (
    <SupportFrame locale={locale} title={t('downloads')} path="/destek/indirmeler">
      <SupportFilters
        locale={locale}
        path="/destek/indirmeler"
        products={products}
        product={product}
        releases={releases}
        release={release}
        os={os}
      />
      <div className="space-y-4">
        {downloads.map((d) => {
          const file = mediaOf(d.file)
          return (
            <article key={d.id} className="rounded-lg border border-border bg-surface p-6">
              <h2 className="text-h4">{d.title}</h2>
              <p className="mt-2 text-muted">
                {relOf<Product>(d.product)?.title} · {relOf<Release>(d.release)?.version} · {d.os}{' '}
                {d.arch}
              </p>
              {d.description ? <p className="mt-2">{d.description}</p> : null}
              {file?.url ? (
                <a href={file.url} download className="mt-4 inline-block font-medium text-accent">
                  {t('download')} →
                </a>
              ) : null}
              {d.checksumSha256 ? (
                <p className="mt-3 break-all font-mono text-small text-muted">
                  SHA-256: {d.checksumSha256}
                </p>
              ) : null}
            </article>
          )
        })}
      </div>
      {!downloads.length ? <p>{t('empty')}</p> : null}
      <aside className="mt-8 rounded-lg border border-border bg-surface-2 p-6">
        <h2 className="text-h4">{t('licensed')}</h2>
        <p className="my-2 text-muted">{t('licensedNote')}</p>
        <AppLink href="/hesap/indirmeler" locale={locale} className="text-accent">
          {t('accountDownloads')} →
        </AppLink>
      </aside>
    </SupportFrame>
  )
}

export default function Page(props: Props) {
  return <DynamicSecurity><DownloadsPage {...props} /></DynamicSecurity>
}
