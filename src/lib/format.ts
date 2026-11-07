export function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'tr-TR', { dateStyle: 'long' }).format(d)
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`
}
