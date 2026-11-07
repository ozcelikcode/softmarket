import { cookies } from 'next/headers'
import { createLocalReq, logoutOperation } from 'payload'
import { cache } from 'react'

import { isCustomerUser, type CustomerUser } from '@/access'
import { getPayloadClient } from '@/lib/site'

import { PORTAL_COOKIE, readCookie } from './cookie'
import { portalCookieStrategy } from './strategy'

/**
 * Current portal customer or null. Only the portal cookie is considered (never `payload-token`),
 * and only a `customers` principal qualifies: an admin/editor token cannot open the portal.
 */
export const getCustomer = cache(async (): Promise<CustomerUser | null> => {
  const token = (await cookies()).get(PORTAL_COOKIE)?.value
  if (!token || !readCookie(`${PORTAL_COOKIE}=${token}`, PORTAL_COOKIE)) return null
  try {
    const payload = await getPayloadClient()
    // Invoke the current strategy directly; Payload 3.85 does not reload authStrategies on HMR.
    const { user } = await portalCookieStrategy.authenticate({
      headers: new Headers({ cookie: `${PORTAL_COOKIE}=${token}` }),
      payload,
    })
    return isCustomerUser(user) ? user : null
  } catch {
    return null
  }
})

export async function setSession(token: string, exp?: number) {
  const maxAge = exp ? Math.max(60, exp - Math.floor(Date.now() / 1000)) : 60 * 60 * 24 * 7
  ;(await cookies()).set(PORTAL_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  })
}

export async function clearSession() {
  ;(await cookies()).set(PORTAL_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
}

/** Report success only after the server-side session was revoked. */
export async function endSession() {
  const user = await getCustomer()
  if (user) {
    const payload = await getPayloadClient()
    const req = await createLocalReq({ user }, payload)
    await logoutOperation({ collection: payload.collections.customers, req })
  }
  await clearSession()
}
