import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { AuthFrame } from '@/components/portal/auth-frame'
import { formMessages } from '@/components/portal/messages'
import { PortalForm } from '@/components/portal/portal-form'
import { AppLink } from '@/components/ui/app-link'
import { first, initLocale } from '@/lib/page-utils'
import { verifyEmailAction } from '@/lib/portal/actions'
import { buildMetadata } from '@/lib/seo'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'portal.meta' })
  return buildMetadata({ locale, path: '/hesap/dogrula', title: t('verify'), noindex: true })
}

/** The token is consumed by an explicit POST, so mail scanners that prefetch links cannot burn it. */
export default async function VerifyPage({ params, searchParams }: Props) {
  const locale = await initLocale(params)
  const token = first((await searchParams).token)
  const [t, f] = await Promise.all([
    getTranslations({ locale, namespace: 'portal' }),
    getTranslations({ locale, namespace: 'portal.form' }),
  ])
  const valid = typeof token === 'string' && /^[A-Za-z0-9_-]{8,200}$/.test(token)
  return (
    <AuthFrame title={t('verify.title')} lead={valid ? t('verify.lead') : undefined}>
      {valid ? (
        <PortalForm
          action={verifyEmailAction}
          id="verify"
          locale={locale}
          hidden={{ verifyToken: token }}
          fields={[]}
          submitLabel={t('verify.submit')}
          sendingLabel={f('sending')}
          fieldError={f('fieldError')}
          messages={formMessages(f)}
        />
      ) : (
        <div role="alert">
          <p className="text-danger">{t('verify.missing')}</p>
          <AppLink href="/hesap/giris" locale={locale} className="mt-3 inline-block font-medium text-accent underline">
            {t('login.title')}
          </AppLink>
        </div>
      )}
    </AuthFrame>
  )
}
