import { DynamicSecurity } from '@/components/security/dynamic-security'

export const dynamic = 'force-dynamic'
export const revalidate = 0

import { Clock, Mail, MapPin, Phone } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'

import { EmptyState } from '@/components/sections/empty-state'
import { JsonLd } from '@/components/sections/json-ld'
import { SystemBody, SystemHero, systemMeta } from '@/components/pages/system-page'
import { Container } from '@/components/ui/container'
import { LeadFormSection } from '@/components/forms/lead-form-section'
import { getContactSettings, getSystemPage, mediaOf } from '@/lib/content'
import { initLocale } from '@/lib/page-utils'
import { breadcrumbJsonLd, buildMetadata } from '@/lib/seo'
import { publicContact } from '@/lib/site'
import { safeHref } from '@/lib/utils'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const [t, page] = await Promise.all([getTranslations({ locale, namespace: 'contact' }), getSystemPage(locale, 'contact')])
  return buildMetadata({ locale, path: '/iletisim', ...systemMeta(page, { title: t('title'), lead: t('lead') }), image: mediaOf(page?.meta?.image)?.url })
}

const Row = ({
  icon,
  label,
  children,
}: {
  icon: ReactNode
  label: string
  children: ReactNode
}) => (
  <div className="flex gap-4 border-b border-border py-5 last:border-b-0">
    <span className="mt-0.5 text-accent [&_svg]:size-5">{icon}</span>
    <div className="min-w-0">
      <dt className="text-eyebrow font-semibold uppercase text-muted">{label}</dt>
      <dd className="mt-1.5 text-text [&_a]:text-accent [&_a:hover]:underline">{children}</dd>
    </div>
  </div>
)

async function ContactPage({ params }: Props) {
  const locale = await initLocale(params)
  const [t, c, settings, page] = await Promise.all([
    getTranslations({ locale, namespace: 'contact' }),
    getTranslations({ locale, namespace: 'common' }),
    getContactSettings(locale),
    getSystemPage(locale, 'contact'),
  ])
  const trail = [
    { label: c('home'), href: '/' },
    { label: t('title'), href: '/iletisim' },
  ]
  // Empty and template placeholder values ([ŞİRKET ADRESİ] …) are dropped: their rows hide.
  const ct = publicContact(settings)
  const mail = (addr?: string | null) =>
    addr && safeHref(`mailto:${addr}`) ? <a href={`mailto:${addr}`}>{addr}</a> : null
  const map = safeHref(ct.mapUrl)
  const hasAny = Boolean(
    ct.address || mail(ct.email) || mail(ct.salesEmail) || mail(ct.supportEmail) || ct.phone || ct.workingHours,
  )
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, trail)} />
      <SystemHero locale={locale} crumbLabel={c('breadcrumb')} crumbs={trail} page={page} fallback={{ title: t('title'), lead: t('lead') }} />
      <SystemBody locale={locale} page={page} listing={
        <Container className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            {hasAny ? (
              <dl className="rounded-lg border border-border bg-surface px-6">
                {ct.address ? (
                  <Row icon={<MapPin aria-hidden />} label={t('address')}>
                    <span className="whitespace-pre-line">{ct.address}</span>
                    {map && /^https?:/.test(map) ? (
                      <a
                        href={map}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block text-small"
                      >
                        {t('map')}
                      </a>
                    ) : null}
                  </Row>
                ) : null}
                {mail(ct.email) ? (
                  <Row icon={<Mail aria-hidden />} label={t('email')}>
                    {mail(ct.email)}
                  </Row>
                ) : null}
                {mail(ct.salesEmail) ? (
                  <Row icon={<Mail aria-hidden />} label={t('sales')}>
                    {mail(ct.salesEmail)}
                  </Row>
                ) : null}
                {mail(ct.supportEmail) ? (
                  <Row icon={<Mail aria-hidden />} label={t('support')}>
                    {mail(ct.supportEmail)}
                  </Row>
                ) : null}
                {ct.phone ? (
                  <Row icon={<Phone aria-hidden />} label={t('phone')}>
                    <a href={ct.phone.href}>{ct.phone.label}</a>
                  </Row>
                ) : null}
                {ct.workingHours ? (
                  <Row icon={<Clock aria-hidden />} label={t('hours')}>
                    {ct.workingHours}
                  </Row>
                ) : null}
              </dl>
            ) : (
              <EmptyState title={t('empty')} />
            )}
          </div>
          <div className="rounded-lg border border-border bg-surface p-6 sm:p-8">
            <LeadFormSection kind="contact" locale={locale} />
          </div>
        </Container>
      } />
    </>
  )
}

export default function Page(props: Props) {
  return <DynamicSecurity><ContactPage {...props} /></DynamicSecurity>
}
