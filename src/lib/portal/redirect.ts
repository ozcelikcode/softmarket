import { SEGMENTS_EN } from '@/i18n/paths'

export const PORTAL_HOME = '/hesap'
const AUTH_SEGMENTS = new Set(['giris', 'kayit', 'sifremi-unuttum', 'sifre-sifirla', 'dogrula'])
const FROM_EN = Object.fromEntries(
  Object.entries(SEGMENTS_EN).filter(([tr]) => tr !== 'arama').map(([tr, en]) => [en, tr]),
)
const BASE = 'http://portal.invalid'

/** `/en/account/licenses` or `/tr/hesap/lisanslar` -> `/hesap/lisanslar` (canonical, locale-free). */
export function canonicalPortalPath(pathname: string): string {
  const parts = pathname.replace(/^\/(?:tr|en)(?=\/|$)/, '').split('/')
  return parts.map((part, i) => (i === 1 && part === 'account' ? 'hesap' : i > 1 ? (FROM_EN[part] ?? part) : part)).join('/') || '/'
}

/**
 * `next` after login must be a site-internal portal path. Anything else (absolute URL, `//host`,
 * backslashes, encoded separators, dot segments, non-portal or auth pages) falls back to /hesap.
 * Returns a canonical (Turkish) path that is then localised with `localizedHref`.
 */
export function sanitizeNext(raw: unknown): string {
  if (typeof raw !== 'string') return PORTAL_HOME
  const value = raw.trim()
  if (!value || value.length > 300 || !value.startsWith('/') || value.startsWith('//')) return PORTAL_HOME
  if (/[\\\s\u0000-\u001f\u007f]/u.test(value) || /%(?:2f|5c|2e|00|0[9ad])/i.test(value)) return PORTAL_HOME
  if (/(?:^|\/)\.{1,2}(?:\/|[?#]|$)/.test(value)) return PORTAL_HOME
  let url: URL
  try {
    url = new URL(value, BASE)
  } catch {
    return PORTAL_HOME
  }
  if (url.origin !== BASE) return PORTAL_HOME
  const path = canonicalPortalPath(url.pathname).replace(/\/$/, '')
  if (path !== PORTAL_HOME && !path.startsWith(`${PORTAL_HOME}/`)) return PORTAL_HOME
  if (!/^\/hesap(?:\/(?:lisanslar|indirmeler|profil|talepler(?:\/(?:yeni|[1-9]\d*))?))?$/.test(path)) return PORTAL_HOME
  const second = path.split('/')[2]
  if (second && AUTH_SEGMENTS.has(second)) return PORTAL_HOME
  const search = /^\?[\w\-=&.]*$/.test(url.search) ? url.search : ''
  return `${path}${search}`
}
