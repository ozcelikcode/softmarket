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

/** Allow only browser navigation schemes and local paths, including CMS input. */
export function safeHref(value: string | null | undefined): string | null {
  if (!value || /[\s\u0000-\u001f\u007f\\]/u.test(value)) return null
  if (value.startsWith('//')) return null
  if (/^(?:\/|#|\?)/.test(value)) return value
  try {
    const url = new URL(value)
    // CMS templates can contain bracketed mail placeholders, including URL-encoded ones.
    if (url.protocol === 'mailto:' && /[\s\u0000-\u001f\u007f\[\]<>{}]/u.test(decodeURIComponent(url.pathname))) return null
    return ['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol) ? value : null
  } catch {
    return null
  }
}

/** CMS template placeholders such as "[ŞİRKET ADRESİ]" or "[COMPANY PHONE]" are never rendered. */
const PLACEHOLDER = /\[\p{Lu}[\p{Lu}\d _-]+\]/u

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
