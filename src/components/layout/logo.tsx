import { AppLink } from '@/components/ui/app-link'

/** Wordmark placeholder; swap for the uploaded site-settings logo when available. */
export function Logo({ locale, label }: { locale: string; label: string }) {
  return (
    <AppLink
      href="/"
      locale={locale}
      aria-label={label}
      className="inline-flex items-center gap-2.5 text-text"
    >
      <span
        aria-hidden
        className="inline-flex size-7 items-center justify-center rounded-md bg-accent text-accent-contrast"
      >
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M3 5.5h10M3 10.5h10" />
        </svg>
      </span>
      <span className="text-[1.0625rem] font-semibold tracking-tight">{label}</span>
    </AppLink>
  )
}
