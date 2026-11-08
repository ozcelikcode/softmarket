'use client'

import NextLink from 'next/link'
import { useParams } from 'next/navigation'

import en from '@/i18n/messages/en.json'
import tr from '@/i18n/messages/tr.json'

// Loaded on every page as the segment error boundary: no next-intl hooks (ICU parser), no cva/tailwind-merge.
// Static JSON property access keeps only the `feedback` strings in the bundle. Classes = resolved
// Section/Container/Button output.
const FEEDBACK = { tr: tr.feedback, en: en.feedback }
const BUTTON = 'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = useParams<{ locale?: string }>()?.locale === 'en' ? 'en' : 'tr'
  const t = FEEDBACK[locale]
  return <section data-theme="dark" className="relative w-full bg-bg text-text py-16 sm:py-24 pb-24 pt-44">
    <div className="mx-auto w-full px-5 sm:px-8 max-w-narrow text-center">
      <h1 className="text-h1">{t.title}</h1>
      <p role="alert" className="mt-5 text-lead text-muted">{t.lead}</p>
      <div className="mt-9 flex justify-center gap-3">
        <button onClick={reset} className={`${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover h-11 px-5 text-small`}>{t.retry}</button>
        <NextLink href={`/${locale}`} className={`${BUTTON} border border-border-strong bg-transparent text-text hover:bg-surface-2 h-11 px-5 text-small`}>{t.home}</NextLink>
      </div>
    </div>
  </section>
}
