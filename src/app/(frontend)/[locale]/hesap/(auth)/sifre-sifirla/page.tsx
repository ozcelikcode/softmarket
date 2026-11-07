import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { AuthFrame } from '@/components/portal/auth-frame'
import { formMessages } from '@/components/portal/messages'
import { PortalForm } from '@/components/portal/portal-form'
import { AppLink } from '@/components/ui/app-link'
import { first, initLocale } from '@/lib/page-utils'
import { resetPasswordAction } from '@/lib/portal/actions'
import { buildMetadata } from '@/lib/seo'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'portal.meta' })
  return buildMetadata({ locale, path: '/hesap/sifre-sifirla', title: t('reset'), noindex: true })
}

export default async function ResetPage({ params, searchParams }: Props) {
  const locale = await initLocale(params)
  const token = first((await searchParams).token)
  const [t, f] = await Promise.all([
    getTranslations({ locale, namespace: 'portal' }),
    getTranslations({ locale, namespace: 'portal.form' }),
  ])
  const valid = typeof token === 'string' && /^[A-Za-z0-9_-]{8,200}$/.test(token)
  return (
    <AuthFrame title={t('reset.title')} lead={valid ? t('reset.lead') : undefined}>
      {valid ? (
        <PortalForm
          action={resetPasswordAction}
          id="reset"
          locale={locale}
          hidden={{ resetToken: token }}
          fields={[
            { name: 'password', label: t('fields.newPassword'), type: 'password', autoComplete: 'new-password', required: true, minLength: 10, maxLength: 128, hint: t('fields.passwordHint') },
            { name: 'confirm', label: t('fields.confirm'), type: 'password', autoComplete: 'new-password', required: true, minLength: 10, maxLength: 128 },
          ]}
          submitLabel={t('reset.submit')}
          sendingLabel={f('sending')}
          fieldError={f('fieldError')}
          messages={formMessages(f)}
        />
      ) : (
        <div role="alert">
          <p className="text-danger">{t('reset.missing')}</p>
          <AppLink href="/hesap/sifremi-unuttum" locale={locale} className="mt-3 inline-block font-medium text-accent underline">
            {t('reset.request')}
          </AppLink>
        </div>
      )}
    </AuthFrame>
  )
}
