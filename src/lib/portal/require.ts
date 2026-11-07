import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import type { CustomerUser } from '@/access'
import { localizedHref } from '@/i18n/paths'

import { PORTAL_HOME, sanitizeNext } from './redirect'
import { getCustomer } from './session'

/** Login URL carrying a validated, site-internal `next` (never an absolute or foreign URL). */
export const loginHref = (locale: string, next?: string) => {
  const safe = next ? sanitizeNext(next) : PORTAL_HOME
  const base = localizedHref('/hesap/giris', locale)
  return safe === PORTAL_HOME ? base : `${base}?next=${encodeURIComponent(safe)}`
}

/** Portal pages and the portal layout: anonymous, staff-only and foreign tokens all end at the login page. */
export async function requireCustomer(locale: string): Promise<CustomerUser> {
  const customer = await getCustomer()
  if (customer) return customer
  const current = (await headers()).get('x-sm-path') ?? undefined
  return redirect(loginHref(locale, current))
}
