import { MediaImage } from '@/components/ui/media-image'
import { AppLink } from '@/components/ui/app-link'
import type { PublicImage } from '@/lib/site'

/**
 * Site logo: the CMS logo (SiteSettings.logo / logoDark, public media) when set,
 * otherwise the built-in mark + site name. The link name is always the site name.
 */
export function Logo({
  locale,
  label,
  image,
  onClick,
}: {
  locale: string
  label: string
  image?: PublicImage | null
  onClick?: () => void
}) {
  return (
    <AppLink
      href="/"
      locale={locale}
      aria-label={label}
      onClick={onClick}
      className="inline-flex min-h-11 shrink-0 items-center gap-2.5 text-text"
    >
      {image ? (
        <MediaImage media={image} alt="" sizes="160px" className="h-8 w-auto max-w-[10rem] object-contain" />
      ) : (
        <>
          <span
            aria-hidden
            className="inline-flex size-7 items-center justify-center rounded-md bg-accent text-accent-contrast"
          >
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M3 5.5h10M3 10.5h10" />
            </svg>
          </span>
          <span className="text-[1.0625rem] font-semibold tracking-tight">{label}</span>
        </>
      )}
    </AppLink>
  )
}
