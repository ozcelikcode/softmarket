import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * Custom type-scale tokens (globals.css `--text-*`) are font sizes, not colors: without this
 * twMerge treats `text-small` as a color and silently drops e.g. `text-accent-contrast`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['display', 'h1', 'h2', 'h3', 'h4', 'lead', 'body', 'small', 'eyebrow'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export { safeHref } from './safe-href'

/** CMS template placeholders such as "[ŞİRKET ADRESİ]" or "[COMPANY PHONE]" are never rendered. */
const PLACEHOLDER = /\[\p{Lu}[\p{Lu}\d _-]+\]/u

/** True when the text contains a `[UPPERCASE]` template placeholder. */
export function hasPlaceholder(value: string): boolean {
  return PLACEHOLDER.test(value)
}

/** Trimmed public CMS text, or null when empty or a template placeholder (section is hidden). */
export function publicText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text && !PLACEHOLDER.test(text) ? text : null
}

/** Footer copyright with {year} / {siteName} placeholders. */
export function formatCopyright(template: string, values: { year: number; siteName: string }): string {
  return template.replace(/\{(year|siteName)\}/g, (_, key: 'year' | 'siteName') => String(values[key]))
}
