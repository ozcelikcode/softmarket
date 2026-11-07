import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { AuthFrame } from '@/components/portal/auth-frame'
import { formMessages, turnstileKey } from '@/components/portal/messages'
import { PortalForm } from '@/components/portal/portal-form'
import { AppLink } from '@/components/ui/app-link'
import { initLocale } from '@/lib/page-utils'
import { forgotPasswordAction } from '@/lib/portal/actions'
import { buildMetadata } from '@/lib/seo'

type Props = { params: Promise<{ locale: string }> }
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'portal.meta' })
  return buildMetadata({ locale, path: '/hesap/sifremi-unuttum', title: t('forgot'), noindex: true })
}

export default async function ForgotPage({ params }: Props) {
  const locale = await initLocale(params)
  const [t, f] = await Promise.all([
    getTranslations({ locale, namespace: 'portal' }),
    getTranslations({ locale, namespace: 'portal.form' }),
  ])
  return (
    <AuthFrame
      title={t('forgot.title')}
      lead={t('forgot.lead')}
      footer={
        <AppLink href="/hesap/giris" locale={locale} className="font-medium text-accent underline">
          {t('forgot.back')}
        </AppLink>
      }
    >
      <PortalForm
        action={forgotPasswordAction}
        id="forgot"
        locale={locale}
        fields={[{ name: 'email', label: t('fields.email'), type: 'email', autoComplete: 'email', required: true, maxLength: 254 }]}
        submitLabel={t('forgot.submit')}
        sendingLabel={f('sending')}
        fieldError={f('fieldError')}
        honeypotLabel={f('website')}
        turnstileSiteKey={turnstileKey()}
        replaceOnSuccess={{ title: t('forgot.successTitle') }}
        messages={formMessages(f, { success: t('forgot.success') })}
      />
    </AuthFrame>
  )
}
