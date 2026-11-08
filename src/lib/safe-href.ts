/**
 * Allow only browser navigation schemes and local paths, including CMS input.
 * Dependency-free (no tailwind-merge) so client modules such as i18n/paths can import it.
 */
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

