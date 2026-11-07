import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { AuthFrame } from '@/components/portal/auth-frame'
import { formMessages, turnstileKey } from '@/components/portal/messages'
import { PortalForm } from '@/components/portal/portal-form'
import { AppLink } from '@/components/ui/app-link'
import { localizedHref } from '@/i18n/paths'
import { initLocale } from '@/lib/page-utils'
import { registerAction } from '@/lib/portal/actions'
import { getCustomer } from '@/lib/portal/session'
import { buildMetadata } from '@/lib/seo'

type Props = { params: Promise<{ locale: string }> }
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'portal.meta' })
  return buildMetadata({ locale, path: '/hesap/kayit', title: t('register'), noindex: true })
}

export default async function RegisterPage({ params }: Props) {
  const locale = await initLocale(params)
  if (await getCustomer()) redirect(localizedHref('/hesap', locale))
  const [t, f] = await Promise.all([
    getTranslations({ locale, namespace: 'portal' }),
    getTranslations({ locale, namespace: 'portal.form' }),
  ])
  return (
    <AuthFrame
      title={t('register.title')}
      lead={t('register.lead')}
      footer={
        <p>
          {t('register.haveAccount')}{' '}
          <AppLink href="/hesap/giris" locale={locale} className="font-medium text-accent underline">
            {t('register.signIn')}
          </AppLink>
        </p>
      }
    >
      <PortalForm
        action={registerAction}
        id="register"
        locale={locale}
        fields={[
          { name: 'name', label: t('fields.name'), autoComplete: 'name', required: true, minLength: 2, maxLength: 100 },
          { name: 'company', label: t('fields.company'), autoComplete: 'organization', maxLength: 160 },
          { name: 'email', label: t('fields.email'), type: 'email', autoComplete: 'email', required: true, maxLength: 254 },
          { name: 'password', label: t('fields.password'), type: 'password', autoComplete: 'new-password', required: true, minLength: 10, maxLength: 128, hint: t('fields.passwordHint') },
          { name: 'confirm', label: t('fields.confirm'), type: 'password', autoComplete: 'new-password', required: true, minLength: 10, maxLength: 128 },
          { name: 'consent', label: t('register.consent'), type: 'checkbox', required: true, link: { href: '/yasal/kvkk', label: t('register.privacy') } },
        ]}
        submitLabel={t('register.submit')}
        sendingLabel={f('sending')}
        fieldError={f('fieldError')}
        honeypotLabel={f('website')}
        turnstileSiteKey={turnstileKey()}
        replaceOnSuccess={{ title: t('register.successTitle') }}
        messages={formMessages(f, { success: t('register.success') })}
      />
    </AuthFrame>
  )
}
