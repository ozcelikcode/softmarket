import { safeHref } from '@/lib/utils'

/**
 * Canonical routes use Turkish folder names (src/app/(frontend)/[locale]/...).
 * English URLs are derived by translating each static segment.
 */
export const SEGMENTS_EN: Record<string, string> = {
  urunler: 'products',
  cozumler: 'solutions',
  destek: 'support',
  indirmeler: 'downloads',
  dokumantasyon: 'documentation',
  'surum-notlari': 'release-notes',
  sss: 'faq',
  talep: 'request',
  iletisim: 'contact',
  sirket: 'company',
  hakkimizda: 'about',
  yasal: 'legal',
  referanslar: 'customers',
  haberler: 'news',
  kariyer: 'careers',
  'is-ortaklari': 'partners',
  'demo-talep': 'request-demo',
  'teklif-iste': 'request-quote',
  hesap: 'account',
  lisanslar: 'licenses',
  profil: 'profile',
  giris: 'login',
  kayit: 'register',
  'sifremi-unuttum': 'forgot-password',
  'sifre-sifirla': 'reset-password',
  dogrula: 'verify',
  talepler: 'tickets',
  yeni: 'new',
  ara: 'search',
  arama: 'search',
}

export const CANONICAL_PATHS = [
  '/',
  '/urunler',
  '/urunler/[family]',
  '/urunler/[family]/[product]',
  '/cozumler',
  '/cozumler/[slug]',
  '/destek',
  '/destek/indirmeler',
  '/destek/dokumantasyon',
  '/destek/dokumantasyon/[product]',
  '/destek/dokumantasyon/[product]/[slug]',
  '/destek/surum-notlari',
  '/destek/sss',
  '/destek/talep',
  '/destek/iletisim',
  '/sirket/hakkimizda',
  '/referanslar',
  '/referanslar/[slug]',
  '/haberler',
  '/haberler/[slug]',
  '/kariyer',
  '/kariyer/[slug]',
  '/is-ortaklari',
  '/iletisim',
  '/demo-talep',
  '/teklif-iste',
  '/hesap',
  '/hesap/lisanslar',
  '/hesap/indirmeler',
  '/hesap/talepler',
  '/hesap/talepler/yeni',
  '/hesap/talepler/[id]',
  '/hesap/giris',
  '/hesap/kayit',
  '/hesap/sifremi-unuttum',
  '/hesap/sifre-sifirla',
  '/hesap/dogrula',
  '/hesap/profil',
  '/ara',
  '/yasal/[slug]',
] as const

const translate = (path: string, locale: string) =>
  locale === 'en'
    ? path
        .split('/')
        .map((s) => SEGMENTS_EN[s] ?? s)
        .join('/')
    : path

export const buildPathnames = () =>
  Object.fromEntries(CANONICAL_PATHS.map((p) => [p, { tr: p, en: translate(p, 'en') }])) as Record<
    string,
    { tr: string; en: string }
  >

function matchRoute(path: string, locale = 'tr') {
  // Prefer static routes over dynamic siblings. Only template literals are translated.
  return [...CANONICAL_PATHS]
    .sort((a, b) => (a.match(/\[/g)?.length ?? 0) - (b.match(/\[/g)?.length ?? 0))
    .find((route) => {
      const template = translate(route, locale).split('/')
      const parts = path.split('/')
      return (
        template.length === parts.length &&
        template.every((part, i) => (part.startsWith('[') ? Boolean(parts[i]) : part === parts[i]))
      )
    })
}

/** No translation identity exists for localized CMS slugs: use the nearest listing. */
export function languageSwitchPath(pathname: string): string {
  const route = matchRoute(pathname)
  if (!route) return '/'
  const index = route.indexOf('/[')
  if (index < 0) return route
  const listing = route.slice(0, index)
  return (CANONICAL_PATHS as readonly string[]).includes(listing) ? listing : '/'
}

/** Turn a canonical (Turkish) concrete path into a locale-prefixed public URL. */
export function localizedHref(path: string, locale: string): string {
  const href = safeHref(path)
  if (!href) return '#'
  if (!href.startsWith('/')) return href
  const targetLocale = locale === 'en' ? 'en' : 'tr'
  const boundary = href.search(/[?#]/)
  let pathname = boundary < 0 ? href : href.slice(0, boundary)
  const suffix = boundary < 0 ? '' : href.slice(boundary)
  let sourceLocale = 'tr'
  const prefix = pathname.match(/^\/(tr|en)(?=\/|$)/)
  if (prefix) {
    sourceLocale = prefix[1]
    pathname = pathname.slice(prefix[0].length) || '/'
  }
  pathname = pathname.replace(/\/$/, '') || '/'
  const route = matchRoute(pathname, sourceLocale)
  if (route) {
    const parts = pathname.split('/')
    pathname = translate(route, targetLocale)
      .split('/')
      .map((part, i) => (part.startsWith('[') ? parts[i] : part))
      .join('/')
  }
  return `/${targetLocale}${pathname === '/' ? '' : pathname}${suffix}`
}
