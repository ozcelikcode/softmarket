import { hasLocale } from '@/i18n/has-locale'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { routing, type Locale } from '@/i18n/routing'
import { localizedHref } from '@/i18n/paths'

/** Validates the `[locale]` param (404 otherwise) and enables static-safe next-intl APIs. */
export async function initLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  return locale
}

/** Localized hrefs per locale for <SetAlternates>, from canonical-form variant paths. */
export function alternateHrefs(variants: Partial<Record<Locale, string>>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const l of routing.locales) if (variants[l]) out[l] = localizedHref(variants[l]!, l)
  return out
}

export const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v)
export const enc = encodeURIComponent

export const MAX_PAGE = 1000

/** Only one bounded, decimal page number is accepted; malformed queries must not become page one. */
export function parsePage(value: string | string[] | undefined): number | null {
  if (value === undefined) return 1
  if (typeof value !== 'string' || !/^[1-9]\d{0,3}$/.test(value)) return null
  const page = Number(value)
  return page <= MAX_PAGE ? page : null
}
