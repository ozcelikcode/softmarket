'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { localizedHref } from '@/i18n/paths'
import { releasePortalDevice, type ReleaseCode } from '@/lib/licensing/portal-devices'
import { isPublicId } from '@/lib/licensing/public-id'
import { getPayloadClient } from '@/lib/site'

import type { DeviceNotice } from './device-notices'
import { allowCustomerAction, sameOrigin } from './guard'
import { loginHref } from './require'
import { getCustomer } from './session'

const noticeOf = (code: ReleaseCode): DeviceNotice => (code === 'replayed' ? 'released' : code === 'not_found' ? 'error' : code)

/**
 * L7a: the customer releases one of their own devices. A plain `<form action>` POST works without JavaScript.
 * Order: same origin -> signed-in customer -> per-customer rate limit ->
 * server-side core that re-checks ownership under the write lock. A foreign or unknown license/device is
 * indistinguishable from an error (no existence leak).
 */
export async function releaseDeviceAction(data: FormData): Promise<void> {
  if (!(data instanceof FormData)) return redirect('/tr/hesap/lisanslar?cihaz=error')
  const locale = data.get('locale') === 'en' ? 'en' : 'tr'
  const license = String(data.get('license') ?? '')
  const activation = String(data.get('device') ?? '')
  const token = String(data.get('token') ?? '')
  const back = (notice: DeviceNotice, withLicense: boolean): never => {
    const base = withLicense && isPublicId(license) ? `/hesap/lisanslar/${license}` : '/hesap/lisanslar'
    return redirect(`${localizedHref(base, locale)}?cihaz=${notice}`)
  }
  const h = await headers()
  const site = h.get('sec-fetch-site')
  const scheme = h.get('x-forwarded-proto')
  // Next supplies the request scheme locally; Caddy sets it for proxied requests.
  if ((site !== null && site !== 'same-origin') || (scheme !== 'http' && scheme !== 'https')
    || h.get('origin') !== `${scheme}://${h.get('host')}` || !sameOrigin(h).ok) return back('error', false)
  const customer = await getCustomer()
  if (!customer) return redirect(loginHref(locale))
  if (!allowCustomerAction(customer.id, 'device-release', 10)) return back('rate', false)
  let notice: DeviceNotice = 'error'
  let owned = false
  try {
    const payload = await getPayloadClient()
    const result = await releasePortalDevice(payload, { customerId: Number(customer.id), license, activation, token })
    notice = noticeOf(result.code)
    owned = result.code !== 'not_found'
  } catch {
    notice = 'error'
  }
  // redirect() throws and must stay outside the try/catch.
  return back(notice, owned)
}
