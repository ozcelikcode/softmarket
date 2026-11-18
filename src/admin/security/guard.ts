import type { PayloadRequest } from 'payload'

import { hasPanelAdminSession, isAdminUser } from '@/access'

/*
 * L6a security center access (plan §7, ADR-L0 V1). The view is reachable only with an ADMIN PANEL SESSION: an admin of
 * the `users` collection authenticated by the `local-jwt` cookie strategy with no `Authorization` header. Editors are
 * sent back to the admin dashboard; anonymous visitors to the login page; customers never have an admin session
 * (`customers.access.admin = false`) and fall in the same "not allowed" branch. This server-side decision inside the
 * view is the boundary: the nav link below is cosmetic, and every collection read repeats the check (`isPanelAdmin`).
 */
export const SECURITY_CENTER_PATH = '/guvenlik'

export type SecurityCenterDecision = { ok: true } | { ok: false; redirectTo: string }

const hasHeadersApi = (headers: unknown): headers is Headers =>
  Boolean(headers && typeof (headers as Headers).has === 'function')

const normalizeAdminRoute = (adminRoute: string): string =>
  adminRoute === '/' ? '' : adminRoute.replace(/\/+$/, '')

export function decideSecurityCenterAccess(
  req: Pick<PayloadRequest, 'user' | 'headers'> | null | undefined,
  adminRoute = '/admin',
): SecurityCenterDecision {
  const base = normalizeAdminRoute(adminRoute)
  if (!req?.user) return { ok: false, redirectTo: `${base}/login` }
  if (!hasHeadersApi(req.headers) || !hasPanelAdminSession(req as PayloadRequest)) {
    return { ok: false, redirectTo: base || '/' }
  }
  return { ok: true }
}

/** An admin authenticated by the panel's cookie session (the loaders and nav link re-check headers too). */
export function isAdminSessionUser(
  user: PayloadRequest['user'] | undefined | null,
  headers: Headers | null | undefined,
): boolean {
  return (
    isAdminUser(user) &&
    (user as { _strategy?: string } | null)?._strategy === 'local-jwt' &&
    hasHeadersApi(headers) &&
    !headers.has('authorization')
  )
}

/** Nav link visibility (cosmetic): admins with a cookie session only. Anything else renders nothing. */
export const showSecurityNavLink = isAdminSessionUser
