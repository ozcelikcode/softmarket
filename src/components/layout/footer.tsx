import { getTranslations } from 'next-intl/server'

import { AppLink } from '@/components/ui/app-link'
import { Container } from '@/components/ui/container'
import type { Locale } from '@/i18n/routing'
import { getFooterData, getMegaData, getSiteSettings, type NavLink } from '@/lib/site'
import { safeHref } from '@/lib/utils'

import { LanguageSwitcher } from './language-switcher'
import { Logo } from './logo'

const SOCIAL: Record<string, string> = {
  linkedin: 'LinkedIn',
  x: 'X',
  youtube: 'YouTube',
  instagram: 'Instagram',
  facebook: 'Facebook',
  github: 'GitHub',
}

export async function Footer({ locale }: { locale: Locale }) {
  const [t, n, c, cms, mega, settings] = await Promise.all([
    getTranslations({ locale, namespace: 'footer' }),
    getTranslations({ locale, namespace: 'nav' }),
    getTranslations({ locale, namespace: 'common' }),
    getFooterData(locale),
    getMegaData(locale),
    getSiteSettings(locale),
  ])

  const l = (rows: [string, string][]): NavLink[] => rows.map(([label, href]) => ({ label, href }))
  const fallbackColumns = [
    {
      title: t('products'),
      links: mega.families.length
        ? mega.families.map((f) => ({ label: f.title, href: f.href }))
        : l([[n('allProducts'), '/urunler']]),
    },
    {
      title: t('solutions'),
      links: mega.solutions.length ? mega.solutions : l([[n('allSolutions'), '/cozumler']]),
    },
    {
      title: t('support'),
      links: l([
        [n('downloads'), '/destek/indirmeler'],
        [n('documentation'), '/destek/dokumantasyon'],
        [n('releaseNotes'), '/destek/surum-notlari'],
        [n('faq'), '/destek/sss'],
        [n('ticket'), '/destek/talep'],
      ]),
    },
    {
      title: t('company'),
      links: l([
        [n('about'), '/sirket/hakkimizda'],
        [n('customers'), '/referanslar'],
        [n('news'), '/haberler'],
        [n('careers'), '/kariyer'],
        [n('partners'), '/is-ortaklari'],
        [n('contact'), '/iletisim'],
      ]),
    },
  ]
  const columns: { title: string; links: NavLink[] }[] = cms.columns.length ? cms.columns : fallbackColumns
  const legal = cms.legal.length
    ? cms.legal
    : l([
        [t('kvkk'), '/yasal/kvkk-aydinlatma'],
        [t('privacy'), '/yasal/gizlilik-politikasi'],
        [t('cookies'), '/yasal/cerez-politikasi'],
        [t('terms'), '/yasal/kullanim-kosullari'],
        [t('eula'), '/yasal/eula'],
      ])
  const siteName = settings?.siteName || c('siteName')
  const year = new Date().getFullYear()
  const copyright = cms.copyright || `© ${year} ${siteName}. ${t('rights')}`
  const social = (settings?.social ?? []).filter((s) => safeHref(s.url))

  return (
    <footer data-theme="dark" className="border-t border-border bg-bg text-text">
      <Container size="wide" className="py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2.8fr]">
          <div className="max-w-xs">
            <Logo locale={locale} label={siteName} />
            <p className="mt-4 text-small text-muted">{settings?.tagline || c('tagline')}</p>
            {social.length ? (
              <ul aria-label={t('social')} className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
                {social.map((s) => (
                  <li key={s.platform + s.url}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center text-small text-muted transition-colors hover:text-text"
                    >
                      {SOCIAL[s.platform] ?? s.platform}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4">
            {columns.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <h2 className="text-eyebrow font-semibold uppercase text-text/80">{col.title}</h2>
                <ul className="mt-3 space-y-0.5 lg:mt-4">
                  {col.links.map((link) => (
                    <li key={link.href + link.label}>
                      <AppLink
                        href={link.href}
                        locale={locale}
                        target={link.newTab ? '_blank' : undefined}
                        className="inline-flex min-h-11 items-center text-small text-muted transition-colors hover:text-text"
                      >
                        {link.label}
                      </AppLink>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-6 border-t border-border pt-8 md:flex-row md:items-center md:justify-between">
          <p className="text-small text-muted">{copyright}</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <ul className="flex flex-wrap gap-x-6">
              {legal.map((link) => (
                <li key={link.href + link.label}>
                  <AppLink href={link.href} locale={locale} className="inline-flex min-h-11 items-center text-small text-muted transition-colors hover:text-text">
                    {link.label}
                  </AppLink>
                </li>
              ))}
            </ul>
            <LanguageSwitcher />
          </div>
        </div>
      </Container>
    </footer>
  )
}
