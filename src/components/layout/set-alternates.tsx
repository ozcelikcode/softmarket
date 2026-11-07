'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

import { useAlternates } from '@/lib/alternates-store'

/** Tells the language switcher where this page lives in the other locale (CMS slugs differ per language). */
export function SetAlternates({ hrefs }: { hrefs: Record<string, string> }) {
  const pathname = usePathname()
  const { setCurrent } = useAlternates()
  const key = JSON.stringify(hrefs)
  useEffect(() => {
    const value = { pathname, hrefs: JSON.parse(key) as Record<string, string> }
    setCurrent(value)
    return () => setCurrent((current) => current === value ? null : current)
  }, [key, pathname, setCurrent])
  return null
}
