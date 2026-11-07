import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'
import { JsonLd } from '@/components/sections/json-ld'
import { PageHero } from '@/components/sections/page-hero'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { breadcrumbJsonLd } from '@/lib/seo'
import type { Locale } from '@/i18n/routing'

export async function SupportFrame({
  locale,
  title,
  path,
  lead,
  crumbs = [],
  children,
}: {
  locale: Locale
  title: string
  path: string
  lead?: string
  crumbs?: { label: string; href: string }[]
  children: ReactNode
}) {
  const c = await getTranslations({ locale, namespace: 'common' })
  const t = await getTranslations({ locale, namespace: 'supportCenter' })
  const trail = [
    { label: c('home'), href: '/' },
    ...(path.startsWith('/destek/') ? [{ label: t('title'), href: '/destek' }] : []),
    ...crumbs,
    { label: title, href: path },
  ]
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, trail)} />
      <PageHero
        theme="light"
        locale={locale}
        crumbLabel={c('breadcrumb')}
        crumbs={trail}
        title={title}
        lead={lead}
      />
      <Section theme="light" spacing="md">
        <Container>{children}</Container>
      </Section>
    </>
  )
}
