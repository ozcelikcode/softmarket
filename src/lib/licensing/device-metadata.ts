/** Omit optional client metadata that resembles credentials or network addresses. */
export function safeMetadata(value: string | null | undefined): string | null {
  if (!value || /[@:]/.test(value) || /[A-Za-z0-9_-]{43}/.test(value)
    || /(?:[a-z\d]{5}[-_\s\u2010-\u2015]+){4}[a-z\d]{5}/i.test(value)
    || /(?:\d{1,3}\.){3}\d{1,3}/.test(value)) return null
  return value
}

export function displayDeviceLabel(value: string | null): string | null {
  const label = safeMetadata(value)
  return label && !/\p{Cc}/u.test(label) ? label.trim().slice(0, 64) || null : null
}
