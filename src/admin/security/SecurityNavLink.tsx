import { headers as getNextHeaders } from 'next/headers'
import Link from 'next/link'
import type { PayloadRequest, ServerProps } from 'payload'
import React from 'react'

import { SECURITY_CENTER_LABELS as L } from '@/lib/security-center-labels'

import { SECURITY_CENTER_PATH, showSecurityNavLink } from './guard'
import { countOpenHighEvents } from './loaders'

async function resolveRequestHeaders(req?: Pick<PayloadRequest, 'headers'>): Promise<Headers | null> {
  if (req?.headers && typeof req.headers.has === 'function') return req.headers
  try {
    return await getNextHeaders()
  } catch {
    return null
  }
}

/*
 * L6a nav link (admin `afterNavLinks`). Cosmetic only: it renders for an admin with a cookie session and nothing for
 * anyone else; the view and every collection read enforce the real boundary. The badge is the number of open
 * high/critical events, read with the admin's own access (omitted when unreadable or zero).
 */
export async function SecurityNavLink({ user, payload, i18n, req }: ServerProps & { req?: Pick<PayloadRequest, 'headers'> }) {
  const reqHeaders = await resolveRequestHeaders(req)
  if (!showSecurityNavLink(user, reqHeaders)) return null
  const lang = i18n?.language === 'en' ? 'en' : 'tr'
  const rawAdmin = payload.config.routes.admin
  const adminBase = rawAdmin === '/' ? '' : rawAdmin.replace(/\/+$/, '')
  const href = `${adminBase}${SECURITY_CENTER_PATH}`
  const open = await countOpenHighEvents(payload, user!, reqHeaders)
  return (
    <Link className="nav__link sc-nav-link" href={href} prefetch={false}>
      <span className="nav__link-indicator" />
      <span className="nav__link-label">{L.nav[lang]}</span>
      {open ? <span className="sc-nav-badge" role="status" aria-label={`${L.navBadge[lang]}: ${open}`}>{open > 99 ? '99+' : open}</span> : null}
    </Link>
  )
}

export default SecurityNavLink
