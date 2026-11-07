import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { formMessages } from '@/components/portal/messages'
import { PortalForm } from '@/components/portal/portal-form'
import { PortalHeading } from '@/components/portal/portal-heading'
import { Button } from '@/components/ui/button'
import { Heading } from '@/components/ui/heading'
import { initLocale } from '@/lib/page-utils'
import { changePasswordAction, logoutAction, updateProfileAction } from '@/lib/portal/actions'
import { requireCustomer } from '@/lib/portal/require'
import { buildMetadata } from '@/lib/seo'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'portal.profile' })
  return buildMetadata({ locale, path: '/hesap/profil', title: t('title'), noindex: true })
}

export default async function ProfilePage({ params }: Props) {
  const locale = await initLocale(params)
  const customer = await requireCustomer(locale)
  const [t, p, f] = await Promise.all([
    getTranslations({ locale, namespace: 'portal.profile' }),
    getTranslations({ locale, namespace: 'portal' }),
    getTranslations({ locale, namespace: 'portal.form' }),
  ])
  const card = 'rounded-lg border border-border bg-surface p-6 sm:p-8'
  return (
    <>
      <PortalHeading title={t('title')} lead={t('lead')} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="account" className={card}>
          <Heading as="h2" size="h4" id="account" className="mb-5">
            {t('account')}
          </Heading>
          <PortalForm
            action={updateProfileAction}
            id="profile"
            locale={locale}
            fields={[
              { name: 'name', label: p('fields.name'), autoComplete: 'name', required: true, minLength: 2, maxLength: 100, defaultValue: customer.name },
              { name: 'company', label: p('fields.company'), autoComplete: 'organization', maxLength: 160, defaultValue: customer.company ?? '' },
              { name: 'phone', label: p('fields.phone'), type: 'tel', autoComplete: 'tel', maxLength: 40, defaultValue: customer.phone ?? '' },
              { name: 'taxNumber', label: p('fields.taxNumber'), maxLength: 11, inputMode: 'numeric', hint: p('fields.taxHint'), defaultValue: customer.taxNumber ?? '' },
            ]}
            submitLabel={t('save')}
            sendingLabel={f('sending')}
            fieldError={f('fieldError')}
            messages={formMessages(f, { success: t('saved') })}
          />
          <p className="mt-6 border-t border-border pt-4 text-small text-muted">
            {p('fields.email')}: <span className="text-text">{customer.email}</span>
          </p>
        </section>

        <div className="space-y-6">
          <section aria-labelledby="password" className={card}>
            <Heading as="h2" size="h4" id="password" className="mb-5">
              {t('password')}
            </Heading>
            <PortalForm
              action={changePasswordAction}
              id="password-form"
              locale={locale}
              resetOnSuccess
              fields={[
                { name: 'current', label: p('fields.currentPassword'), type: 'password', autoComplete: 'current-password', required: true, maxLength: 128 },
                { name: 'password', label: p('fields.newPassword'), type: 'password', autoComplete: 'new-password', required: true, minLength: 10, maxLength: 128, hint: p('fields.passwordHint') },
                { name: 'confirm', label: p('fields.confirm'), type: 'password', autoComplete: 'new-password', required: true, minLength: 10, maxLength: 128 },
              ]}
              submitLabel={t('passwordSave')}
              sendingLabel={f('sending')}
              fieldError={f('fieldError')}
              messages={formMessages(f, { success: t('passwordSaved') })}
            />
          </section>
          <section aria-labelledby="session" className={card}>
            <Heading as="h2" size="h4" id="session">
              {t('signOutTitle')}
            </Heading>
            <p className="mb-4 mt-2 text-muted">{t('signOutText')}</p>
            <form action={logoutAction}>
              <input type="hidden" name="locale" value={locale} />
              <Button type="submit" variant="secondary">
                {p('signOut')}
              </Button>
            </form>
          </section>
        </div>
      </div>
    </>
  )
}
