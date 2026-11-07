import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'

import type { Locale } from '@/i18n/routing'
import { getHeaderNav, getMegaData, getSiteSettings, siteIdentity, type NavItem, type NavLink } from '@/lib/site'

import { AppLink } from '@/components/ui/app-link'
import { Container } from '@/components/ui/container'
import { MotionObserver } from '@/components/ui/motion-observer'

import { AnnouncementBar } from './announcement-bar'
import { HeaderShell } from './header-shell'

export async function Header({ locale }: { locale: Locale }) {
  const [t, cms, mega, settings] = await Promise.all([
    getTranslations({ locale, namespace: 'nav' }),
    getHeaderNav(locale),
    getMegaData(locale),
    getSiteSettings(locale),
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

  const site = siteIdentity(settings, c('siteName'))
  const { announcement, utility } = cms

  return (
    <>
    <Suspense fallback={null}><MotionObserver /></Suspense>
    {/* Announcement + utility links sit above the sticky header in normal flow: main's negative
        top margin only offsets the header itself, so hero overlap stays unchanged. */}
    {announcement ? (
      <AnnouncementBar id={announcement.id} dismissible={announcement.dismissible} closeLabel={c('close')}>
        <p>
          {announcement.text}
          {announcement.link ? (
            <>
              {' '}
              <AppLink
                href={announcement.link.href}
                locale={locale}
                target={announcement.link.newTab ? '_blank' : undefined}
                className="whitespace-nowrap underline underline-offset-4 hover:no-underline"
              >
                {announcement.link.label} →
              </AppLink>
            </>
          ) : null}
        </p>
      </AnnouncementBar>
    ) : null}
    {utility.links.length ? (
      <div data-theme="dark" className="hidden border-b border-border bg-bg text-text lg:block">
        <Container>
          <nav aria-label={t('utility')} className="flex h-9 items-center justify-end">
            <ul className="flex items-center gap-5">
              {utility.links.map((l) => (
                <li key={l.href + l.label}>
                  <AppLink href={l.href} locale={locale} target={l.newTab ? '_blank' : undefined} className="text-small text-muted transition-colors hover:text-text">
                    {l.label}
                  </AppLink>
                </li>
              ))}
            </ul>
          </nav>
        </Container>
      </div>
    ) : null}
    <HeaderShell
      locale={locale}
      items={cms.items.length ? cms.items : fallback}
      cta={cms.cta ?? { label: c('requestDemo'), href: '/demo-talep' }}
      secondaryCta={cms.secondaryCta}
      mega={mega}
      logo={{ dark: site.logoOnDark, light: site.logoOnLight }}
      utility={{ links: utility.links, search: utility.showSearch, language: utility.showLanguage, account: utility.showAccount }}
      labels={{
        siteName: site.name,
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
        utility: t('utility'),
      }}
    />
    </>
  )
}
