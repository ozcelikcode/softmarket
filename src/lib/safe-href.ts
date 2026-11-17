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


/**
 * G1: values that must never be stored as a link address, whatever was stored before: script/data schemes
 * (also when obfuscated with whitespace/control characters or letter case) and protocol-relative `//host`.
 */
export function isDangerousLinkUrl(value: string): boolean {
  const compact = value.replace(/[\s\u0000-\u001f\u007f]/gu, '').toLowerCase()
  return /^(?:javascript|data|vbscript):/.test(compact) || /^[\\/]{2}/.test(compact)
}

/**
 * Server rule for CMS link addresses (`linkField().url`): empty, or what `safeHref` renders (http/https/mailto/tel,
 * `/`, `#`, `?`). An unchanged existing value that is invalid but not dangerous is kept (`previousValue`): stored
 * placeholders such as `mailto:[COMPANY EMAIL]` must not block saving the rest of the document; render drops them.
 */
export function isAllowedLinkUrl(value: unknown, previousValue?: unknown): boolean {
  if (value === null || value === undefined || value === '') return true
  if (typeof value !== 'string' || isDangerousLinkUrl(value)) return false
  return safeHref(value) !== null || value === previousValue
}
