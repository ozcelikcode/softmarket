'use client'

import { Globe } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { usePathname as usePublicPathname, useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { usePathname } from '@/i18n/navigation'
import { languageSwitchPath, localizedHref } from '@/i18n/paths'
import { routing } from '@/i18n/routing'
import { useAlternates } from '@/lib/alternates-store'
import { cn } from '@/lib/utils'

export function LanguageSwitcher({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const locale = useLocale()
  const t = useTranslations('common')
  const pathname = usePathname()
  const publicPathname = usePublicPathname()
  const { current } = useAlternates()
  const router = useRouter()
  const [pending, start] = useTransition()
  const next = routing.locales.find((l) => l !== locale) ?? routing.defaultLocale

  return (
    <button
      type="button"
      disabled={pending}
      lang={next}
      aria-label={`${t('language')}: ${next.toUpperCase()}`}
      onClick={() =>
        start(() => {
          onNavigate?.()
          const alt = current?.pathname === publicPathname ? current.hrefs[next] : undefined
          router.replace(
            alt
              ? alt + window.location.hash
              : localizedHref(languageSwitchPath(pathname), next) + window.location.search + window.location.hash,
          )
        })
      }
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-small font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text',
        className,
      )}
    >
      <Globe aria-hidden className="size-4" />
      {next.toUpperCase()}
    </button>
  )
}
