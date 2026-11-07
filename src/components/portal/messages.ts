import type { PortalFormState } from '@/lib/portal/schemas'

type T = (key: string) => string

/** Status -> message map from the `portal.form` namespace (pass `getTranslations({namespace:'portal.form'})`). */
export function formMessages(t: T, extra: Partial<Record<PortalFormState['status'], string>> = {}) {
  return {
    invalid: t('invalid'),
    credentials: t('credentials'),
    unverified: t('unverified'),
    rate: t('rate'),
    verification: t('verification'),
    error: t('error'),
    closed: t('closed'),
    token: t('token'),
    currentPassword: t('currentPassword'),
    ...extra,
  } satisfies Partial<Record<PortalFormState['status'], string>>
}

export const turnstileKey = (): string | undefined => {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  return key && !key.startsWith('CHANGE_') ? key : undefined
}
