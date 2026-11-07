import type { PayloadRequest } from 'payload'

import { localizedHref } from '@/i18n/paths'
import { serverUrl } from '@/lib/server-url'
import { pagePath } from '@/lib/system-pages'

/*
 * F8 Live Preview (pure helpers: imported by the Payload config and the /api/preview route).
 *
 * The admin iframe loads `/api/preview?redirect=<locale path>`. The route only enables Next draft mode for an
 * authenticated staff user (users collection, admin/editor) and only redirects to a same-origin, locale-prefixed
 * public path. Every draft read re-validates the staff session (src/lib/preview.ts), so a copied draft cookie
 * alone never reveals unpublished content.
 */

export const LIVE_PREVIEW_COLLECTIONS = [
  'pages', 'products', 'product-families', 'solutions', 'case-studies', 'posts',
] as const
export type LivePreviewCollection = (typeof LIVE_PREVIEW_COLLECTIONS)[number]

export const LIVE_PREVIEW_BREAKPOINTS = [
  { name: 'mobile', label: 'Mobil / Mobile', width: 390, height: 844 },
  { name: 'tablet', label: 'Tablet', width: 768, height: 1024 },
  { name: 'desktop', label: 'Masaüstü / Desktop', width: 1440, height: 900 },
]

export const PREVIEW_ROUTE = '/api/preview'
export const EXIT_PREVIEW_ROUTE = '/api/exit-preview'

const MAX_REDIRECT = 512
// Locale prefix + slug-like segments only: no `%` (encoded `/`, `\`, CR/LF), no dot segments, no query/hash.
const SAFE_PATH = /^\/(?:tr|en)(?:\/[a-z0-9][a-z0-9_-]*)*\/?$/i

/**
 * Same-origin, locale-prefixed relative path or null. Rejects absolute/scheme URLs, protocol-relative (`//`),
 * backslash variants, encoded separators, control characters and dot segments by allow-listing the shape.
 */
export function safePreviewRedirect(value: unknown): string | null {
  if (typeof value !== 'string' || !value || value.length > MAX_REDIRECT) return null
  if (!SAFE_PATH.test(value)) return null
  // Defence in depth: the parsed URL must stay on the placeholder origin with the identical path.
  try {
    const base = 'http://preview.invalid'
    const url = new URL(value, base)
    if (url.origin !== base || url.pathname !== value) return null
  } catch {
    return null
  }
  return value.length > 3 ? value.replace(/\/$/, '') : value
}

type Doc = Record<string, unknown>
const slugOf = (doc: Doc | null | undefined) =>
  doc && typeof doc.slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(doc.slug) ? doc.slug : null
const idOf = (value: unknown) =>
  typeof value === 'number' ? value : value && typeof value === 'object' && typeof (value as Doc).id === 'number' ? (value as Doc).id as number : null

/** Canonical (TR) path of a document for preview, or null (nothing public to show). */
export async function previewTargetPath(
  collection: string | undefined, data: Doc, lookup: {
    homePageId: () => Promise<number | null>
    familySlug: (id: number) => Promise<string | null>
  },
): Promise<string | null> {
  const slug = slugOf(data)
  switch (collection as LivePreviewCollection) {
    case 'pages': {
      if (data.pageType === 'template') return null
      const homeId = data.pageType !== 'legal' && !data.systemKey ? await lookup.homePageId() : null
      if (homeId !== null && idOf(data) === homeId) return '/'
      return pagePath(data)
    }
    case 'product-families':
      return slug ? `/urunler/${slug}` : null
    case 'products': {
      const family = data.family && typeof data.family === 'object' ? slugOf(data.family as Doc) : null
      const familyId = idOf(data.family)
      const familySlug = family ?? (familyId !== null ? await lookup.familySlug(familyId) : null)
      return slug && familySlug ? `/urunler/${familySlug}/${slug}` : null
    }
    case 'solutions':
      return slug ? `/cozumler/${slug}` : null
    case 'case-studies':
      return slug ? `/referanslar/${slug}` : null
    case 'posts':
      return slug ? `/haberler/${slug}` : null
    default:
      return null
  }
}

const LOOPBACK_HOST = /^(?:localhost|127\.0\.0\.1|\[::1\]):\d{2,5}$/

/**
 * Origin of the frontend inside the admin iframe. Admin and frontend are one Next app (frame-ancestors 'self'),
 * so the public deployment origin is used; locally (loopback NEXT_PUBLIC_SERVER_URL) the admin request's own
 * loopback host is used so 3100 and 3200 each preview themselves. Payload compares message origins with it.
 */
export function previewOrigin(req: Pick<PayloadRequest, 'host' | 'headers'> | undefined): string {
  const fallback = serverUrl('')
  const configured = serverUrl()
  if (configured !== fallback) return configured
  const host = req?.host || req?.headers?.get?.('host') || ''
  return LOOPBACK_HOST.test(host) ? `http://${host}` : fallback
}

/** `admin.livePreview.url`: `<origin>/api/preview?redirect=/<locale>/<path>` or null when not previewable. */
export async function livePreviewURL({ collectionConfig, data, locale, req }: {
  collectionConfig?: { slug: string }
  data: Doc
  locale?: { code?: string } | string
  req: PayloadRequest
}): Promise<string | null> {
  const code = (typeof locale === 'string' ? locale : locale?.code) === 'en' ? 'en' : 'tr'
  const path = await previewTargetPath(collectionConfig?.slug, data ?? {}, {
    homePageId: async () => {
      const settings = await req.payload.findGlobal({
        slug: 'site-settings', depth: 0, overrideAccess: true, req, select: { homePage: true },
      })
      return idOf((settings as { homePage?: unknown }).homePage)
    },
    familySlug: async (id) => {
      const family = await req.payload.findByID({
        collection: 'product-families', id, locale: code, depth: 0, overrideAccess: true, req,
        select: { slug: true }, disableErrors: true,
      })
      return slugOf(family as Doc | null)
    },
  })
  const redirect = path ? safePreviewRedirect(localizedHref(path, code)) : null
  return redirect ? `${previewOrigin(req)}${PREVIEW_ROUTE}?redirect=${encodeURIComponent(redirect)}` : null
}
