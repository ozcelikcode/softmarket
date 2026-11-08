'use client'

import { GlobeIcon as Globe } from '@/components/ui/client-icons'
import { usePathname as usePublicPathname, useRouter } from 'next/navigation'
import { useTransition } from 'react'

import en from '@/i18n/messages/en.json'
import tr from '@/i18n/messages/tr.json'
import { localizedHref, publicLanguageSwitch } from '@/i18n/paths'
import { useAlternates } from '@/lib/alternates-store'

// Static property access keeps only these strings in the client bundle (webpack JSON tree shaking).
// No next-intl client hooks here: they would ship the ICU message parser to every page.
const LANGUAGE_LABEL = { tr: tr.common.language, en: en.common.language }

/**
 * Target-locale path published as `<link rel="alternate" hreflang>` by generateMetadata: the same
 * source as SEO alternates, available before hydration effects (SetAlternates) have run.
 */
export function hreflangPath(head: Pick<ParentNode, 'querySelectorAll'>, target: string): string | undefined {
  for (const link of Array.from(head.querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]'))) {
    if (link.getAttribute('hreflang') !== target) continue
    try {
      const { pathname } = new URL(link.getAttribute('href') ?? '', 'http://x.invalid')
      if (pathname === `/${target}` || pathname.startsWith(`/${target}/`)) return pathname
    } catch {}
  }
  return undefined
}

/** `closesSheet`: inside the mobile drawer, a click also closes the dialog (lib/header-nav initSheet). */
export function LanguageSwitcher({ className, closesSheet }: { className?: string; closesSheet?: boolean }) {
  const publicPathname = usePublicPathname()
  const { locale, path: fallbackPath } = publicLanguageSwitch(publicPathname)
  const { current } = useAlternates()
  const router = useRouter()
  const [pending, start] = useTransition()
  const next = locale === 'tr' ? 'en' : 'tr'

  return (
    <button
      type="button"
      disabled={pending}
      lang={next}
      aria-label={`${LANGUAGE_LABEL[locale]}: ${next.toUpperCase()}`}
      data-sheet-close={closesSheet ? '' : undefined}
      onClick={() =>
        start(() => {
          const known = current?.pathname === publicPathname ? current.hrefs[next] : undefined
          const alt = known ?? hreflangPath(document.head, next)
          router.replace(
            alt
              ? alt + (known ? '' : window.location.search) + window.location.hash
              : localizedHref(fallbackPath, next) + window.location.search + window.location.hash,
          )
        })
      }
      // No tailwind-merge on the client: a caller-supplied `hidden` replaces the base display instead of conflicting with it.
      className={`${className?.split(/\s+/).includes('hidden') ? '' : 'inline-flex '}h-11 min-w-11 items-center justify-center lg:h-9 lg:min-w-0 gap-1.5 rounded-md px-2.5 text-small font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text${className ? ` ${className}` : ''}`}
    >
      <Globe aria-hidden className="size-4" />
      {next.toUpperCase()}
    </button>
  )
}
