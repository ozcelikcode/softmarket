import { Download } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { PortalHeading } from '@/components/portal/portal-heading'
import { EmptyState } from '@/components/sections/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Heading } from '@/components/ui/heading'
import { initLocale } from '@/lib/page-utils'
import { getMyDownloads, getMyLicenses, usableProducts, type PortalDownload } from '@/lib/portal/data'
import { requireCustomer } from '@/lib/portal/require'
import { buildMetadata } from '@/lib/seo'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'portal.downloads' })
  return buildMetadata({ locale, path: '/hesap/indirmeler', title: t('title'), noindex: true })
}

const OS_ORDER = ['windows', 'macos', 'linux', 'web', 'android', 'ios', 'other']

export default async function DownloadsPage({ params }: Props) {
  const locale = await initLocale(params)
  const customer = await requireCustomer(locale)
  const [t, os, licenses] = await Promise.all([
    getTranslations({ locale, namespace: 'portal.downloads' }),
    getTranslations({ locale, namespace: 'os' }),
    getMyLicenses(customer, locale),
  ])
  const downloads = await getMyDownloads(customer, locale, usableProducts(licenses).map((p) => p.id))

  // product -> version -> files (by OS)
  const groups = new Map<string, Map<string, PortalDownload[]>>()
  for (const d of downloads) {
    const versions = groups.get(d.product) ?? new Map<string, PortalDownload[]>()
    const key = d.version || t('untitled')
    versions.set(key, [...(versions.get(key) ?? []), d])
    groups.set(d.product, versions)
  }
  return (
    <>
      <PortalHeading title={t('title')} lead={t('lead')} />
      {downloads.length ? (
        <div className="space-y-10">
          {[...groups].map(([product, versions]) => (
            <section key={product} aria-labelledby={`p-${product}`}>
              <Heading as="h2" size="h3" id={`p-${product}`}>
                {product}
              </Heading>
              <div className="mt-4 space-y-6">
                {[...versions].map(([version, files]) => (
                  <div key={version} className="overflow-hidden rounded-lg border border-border bg-surface">
                    <h3 className="border-b border-border bg-surface-2 px-5 py-3 text-h4">{version}</h3>
                    <ul className="divide-y divide-border">
                      {[...files]
                        .sort((a, b) => OS_ORDER.indexOf(a.os) - OS_ORDER.indexOf(b.os))
                        .map((d) => (
                          <li key={d.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                            <div className="min-w-0">
                              <p className="font-medium">{d.title}</p>
                              <p className="mt-1 flex flex-wrap items-center gap-2 text-small text-muted">
                                <Badge>{os.has(d.os) ? os(d.os) : d.os}</Badge>
                                {d.arch ? <span>{d.arch}</span> : null}
                                <Badge variant={d.access === 'licensed' ? 'accent' : 'neutral'}>
                                  {d.access === 'licensed' ? t('licensed') : t('public')}
                                </Badge>
                              </p>
                              {d.description ? <p className="mt-2 text-small text-muted">{d.description}</p> : null}
                              {d.checksum ? (
                                <p className="mt-2 break-all font-mono text-xs text-muted">
                                  {t('checksum')}: {d.checksum}
                                </p>
                              ) : null}
                            </div>
                            {d.url ? (
                              <Button asChild size="sm" variant="secondary">
                                <a href={d.url} download>
                                  <Download aria-hidden />
                                  {t('download')}
                                </a>
                              </Button>
                            ) : null}
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState title={t('empty')} description={t('emptyText')} />
      )}
    </>
  )
}
