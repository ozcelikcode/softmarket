import { draftMode, headers } from 'next/headers'
import { unstable_rethrow } from 'next/navigation'
import { cache } from 'react'

import { isAdminOrEditorUser, type StaffUser } from '@/access/roles'
import type { Locale } from '@/i18n/routing'
import { getPayloadClient } from '@/lib/site'

/*
 * F8 draft reads. Draft data is returned only when BOTH hold for the current request:
 *   1. Next draft mode is enabled (valid `__prerender_bypass` cookie, set only by /api/preview), and
 *   2. the request carries a live staff session (users collection, role admin/editor), re-validated here.
 * A copied draft cookie without a staff session, a customer session or any failure falls back to the
 * anonymous, published-only read. Draft-mode responses are rendered per request and never written to ISR.
 */

/** Staff user of a draft-mode request, otherwise null (fail-closed). Cached per request. */
export const getPreviewUser = cache(async (): Promise<StaffUser | null> => {
  try {
    const draft = await draftMode()
    // Outside draft mode `headers()` is never read, so static/ISR rendering is unaffected.
    if (!draft.isEnabled) return null
    const payload = await getPayloadClient()
    const { user } = await payload.auth({ headers: await headers() })
    return isAdminOrEditorUser(user) ? (user as StaffUser) : null
  } catch (error) {
    unstable_rethrow(error)
    return null
  }
})

/** Local API read options: staff draft read in preview, otherwise anonymous published-only. */
export async function readAs(locale: Locale) {
  const user = await getPreviewUser()
  return user
    ? { locale, overrideAccess: false as const, user, draft: true as const }
    : { locale, overrideAccess: false as const, user: null, draft: false as const }
}
