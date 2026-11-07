import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'

import { PortalNav } from '@/components/portal/portal-nav'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { initLocale } from '@/lib/page-utils'
import { requireCustomer } from '@/lib/portal/require'

/** Every portal page passes through this server-side check (customers only; staff tokens never match). */
export const dynamic = 'force-dynamic'

export default async function PortalLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const locale = await initLocale(params)
  await requireCustomer(locale)
  const t = await getTranslations({ locale, namespace: 'portal.nav' })
  const items = [
    { href: '/hesap', label: t('overview') },
    { href: '/hesap/lisanslar', label: t('licenses') },
    { href: '/hesap/indirmeler', label: t('downloads') },
    { href: '/hesap/talepler', label: t('tickets') },
    { href: '/hesap/profil', label: t('profile') },
  ]
  return (
    <Section theme="light" spacing="none" className="min-h-[85vh] pb-20 pt-28 sm:pt-32">
      <Container>
        <PortalNav items={items} locale={locale} label={t('label')} />
        <div className="pt-8 sm:pt-10">{children}</div>
      </Container>
    </Section>
  )
}
