import { DynamicSecurity } from '@/components/security/dynamic-security'

export const dynamic = 'force-dynamic'
export const revalidate = 0

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { SupportFrame } from '@/components/sections/support-frame'
import { AppLink } from '@/components/ui/app-link'
import { initLocale, parsePage } from '@/lib/page-utils'
import { buildMetadata } from '@/lib/seo'
import type { Query } from '@/lib/support-query'

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Query> }
import { SupportSearch } from '@/components/sections/support-search'
import { searchQuery } from '@/lib/support-query'
import { searchSite } from '@/lib/search'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'supportCenter' })
  return buildMetadata({ locale, path: '/ara', title: t('searchTitle'), noindex: true })
}

async function SearchPage({ params, searchParams }: Props) {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'supportCenter' })
  const q = await searchParams
  const query = searchQuery(q.q),
    page = parsePage(q.page)
  if (query === null || page === null) notFound()
  const result = query ? await searchSite(locale, query, page) : { docs: [], totalPages: 0 }
  if (page > 1 && page > result.totalPages) notFound()
  return (
    <SupportFrame locale={locale} title={t('searchTitle')} path="/ara">
      <SupportSearch locale={locale} query={query} />
      {query ? (
        <>
          <h2 className="mb-4 text-h3">{t('results')}</h2>
          <ul className="divide-y divide-border">
            {result.docs.map((r) => (
              <li key={r.id} className="py-5">
                <AppLink href={r.href} locale={locale} className="text-h4 text-accent">
                  {r.title}
                </AppLink>
              </li>
            ))}
          </ul>
          {!result.docs.length ? <p role="status">{t('searchEmpty')}</p> : null}
          <nav aria-label={t('results')} className="mt-8 flex justify-between">
            {page > 1 ? (
              <AppLink
                href={`/ara?q=${encodeURIComponent(query)}&page=${page - 1}`}
                locale={locale}
              >
                {t('previous')}
              </AppLink>
            ) : (
              <span />
            )}
            {page < result.totalPages ? (
              <AppLink
                href={`/ara?q=${encodeURIComponent(query)}&page=${page + 1}`}
                locale={locale}
              >
                {t('next')}
              </AppLink>
            ) : null}
          </nav>
        </>
      ) : null}
    </SupportFrame>
  )
}

export default function Page(props: Props) {
  return <DynamicSecurity><SearchPage {...props} /></DynamicSecurity>
}
