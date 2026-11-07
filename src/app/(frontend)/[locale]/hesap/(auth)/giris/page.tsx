import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { AuthFrame } from '@/components/portal/auth-frame'
import { formMessages } from '@/components/portal/messages'
import { PortalForm } from '@/components/portal/portal-form'
import { AppLink } from '@/components/ui/app-link'
import { localizedHref } from '@/i18n/paths'
import { first, initLocale } from '@/lib/page-utils'
import { loginAction } from '@/lib/portal/actions'
import { sanitizeNext } from '@/lib/portal/redirect'
import { getCustomer } from '@/lib/portal/session'
import { buildMetadata } from '@/lib/seo'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'portal.meta' })
  return buildMetadata({ locale, path: '/hesap/giris', title: t('login'), noindex: true })
}

export default async function LoginPage({ params, searchParams }: Props) {
  const locale = await initLocale(params)
  const q = await searchParams
  const next = sanitizeNext(first(q.next))
  if (await getCustomer()) redirect(localizedHref(next, locale))
  const [t, f] = await Promise.all([
    getTranslations({ locale, namespace: 'portal' }),
    getTranslations({ locale, namespace: 'portal.form' }),
  ])
  const notice = first(q.verified) === '1' ? t('login.verified') : first(q.reset) === '1' ? t('login.reset') : null
  return (
    <AuthFrame
      title={t('login.title')}
      lead={t('login.lead')}
      footer={
        <p>
          {t('login.noAccount')}{' '}
          <AppLink href="/hesap/kayit" locale={locale} className="font-medium text-accent underline">
            {t('login.register')}
          </AppLink>
        </p>
      }
    >
      {notice ? (
        <p role="status" className="mb-5 rounded-md border border-success bg-success/5 p-4 text-success">
          {notice}
        </p>
      ) : null}
      <PortalForm
        action={loginAction}
        id="login"
        locale={locale}
        hidden={{ next }}
        fields={[
          { name: 'email', label: t('fields.email'), type: 'email', autoComplete: 'email', required: true, maxLength: 254 },
          { name: 'password', label: t('fields.password'), type: 'password', autoComplete: 'current-password', required: true, maxLength: 128 },
        ]}
        submitLabel={t('login.submit')}
        sendingLabel={f('sending')}
        fieldError={f('fieldError')}
        messages={formMessages(f)}
      />
      <p className="mt-5 text-small">
        <AppLink href="/hesap/sifremi-unuttum" locale={locale} className="text-accent underline">
          {t('login.forgot')}
        </AppLink>
      </p>
    </AuthFrame>
  )
}
