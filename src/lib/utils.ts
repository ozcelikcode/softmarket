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
    return ['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol) ? value : null
  } catch {
    return null
  }
}
