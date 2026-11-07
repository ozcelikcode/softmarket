import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'

import type { Locale } from '@/i18n/routing'
import { getHeaderNav, getMegaData, type NavItem, type NavLink } from '@/lib/site'

import { MotionObserver } from '@/components/ui/motion-observer'

import { HeaderShell } from './header-shell'

export async function Header({ locale }: { locale: Locale }) {
  const [t, cms, mega] = await Promise.all([
    getTranslations({ locale, namespace: 'nav' }),
    getHeaderNav(locale),
    getMegaData(locale),
  ])
  const [c, p] = await Promise.all([
    getTranslations({ locale, namespace: 'common' }),
    getTranslations({ locale, namespace: 'portal' }),
  ])

  const links = (rows: [string, string, string?][]): NavLink[] =>
    rows.map(([label, href, description]) => ({ label, href, description }))

  const fallback: NavItem[] = [
    { label: t('products'), href: '/urunler', mega: 'products' },
    { label: t('solutions'), href: '/cozumler', mega: 'solutions' },
    {
      label: t('support'),
      href: '/destek',
      children: links([
        [t('downloads'), '/destek/indirmeler', t('downloadsDesc')],
        [t('documentation'), '/destek/dokumantasyon', t('docsDesc')],
        [t('releaseNotes'), '/destek/surum-notlari', t('releaseDesc')],
        [t('faq'), '/destek/sss', t('faqDesc')],
        [t('ticket'), '/destek/talep'],
        [t('contact'), '/destek/iletisim'],
      ]),
    },
    {
      label: t('company'),
      children: links([
        [t('about'), '/sirket/hakkimizda', t('aboutDesc')],
        [t('customers'), '/referanslar', t('customersDesc')],
        [t('news'), '/haberler', t('newsDesc')],
        [t('careers'), '/kariyer', t('careersDesc')],
        [t('partners'), '/is-ortaklari', t('partnersDesc')],
        [t('contact'), '/iletisim'],
      ]),
    },
  ]

  return (
    <>
    <Suspense fallback={null}><MotionObserver /></Suspense>
    <HeaderShell
      locale={locale}
      items={cms.items.length ? cms.items : fallback}
      cta={cms.cta ?? { label: c('requestDemo'), href: '/demo-talep' }}
      mega={mega}
      labels={{
        siteName: c('siteName'),
        search: c('search'),
        account: c('myAccount'),
        signIn: p('signIn'),
        signOut: p('signOut'),
        accountMenu: p('menuLabel'),
        menu: c('menu'),
        close: c('close'),
        allProducts: t('allProducts'),
        allSolutions: t('allSolutions'),
        catalogSoon: t('catalogSoon'),
      }}
    />
    </>
  )
}
