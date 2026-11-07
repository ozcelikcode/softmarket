'use client'

import { useEffect, useState } from 'react'
import tr from '@/i18n/messages/tr.json'
import en from '@/i18n/messages/en.json'
import './(frontend)/globals.css'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [locale, setLocale] = useState<'tr' | 'en'>('tr')
  useEffect(() => { setLocale(window.location.pathname.startsWith('/en') ? 'en' : 'tr') }, [])
  const t = (locale === 'en' ? en : tr).feedback
  return <html lang={locale} data-theme="dark"><body className="min-h-dvh bg-bg font-sans text-text">
    <main className="mx-auto max-w-2xl px-6 py-32 text-center">
      <h1 className="text-h1">{t.title}</h1>
      <p role="alert" className="mt-5 text-lead text-muted">{t.lead}</p>
      <div className="mt-9 flex justify-center gap-3">
        <button onClick={reset} className="rounded-md bg-accent px-5 py-3 text-accent-contrast">{t.retry}</button>
        <a href={`/${locale}`} className="rounded-md border border-border px-5 py-3">{t.home}</a>
      </div>
    </main>
  </body></html>
}
