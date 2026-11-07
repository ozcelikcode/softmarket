export type EmailLocale = 'tr' | 'en'
export const emailLocale = (user: unknown): EmailLocale =>
  user && typeof user === 'object' && (user as { preferredLocale?: unknown }).preferredLocale === 'en' ? 'en' : 'tr'

export const escapeHTML = (value: string) => value.replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** All variable content is plain text and escaped here, including table cells. */
export function emailTemplate({ locale, title, body, rows = [], action }: {
  locale: EmailLocale
  title: string
  body?: string
  rows?: ReadonlyArray<readonly [string, string]>
  action?: { label: string; url: string }
}) {
  const link = action && /^https?:\/\//i.test(action.url) ? action : undefined
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><title>${escapeHTML(title)}</title></head><body style="margin:0;background:#f7f8fa;color:#12161c;font-family:Arial,sans-serif"><main style="max-width:600px;margin:32px auto;padding:32px;background:#fff;border:1px solid #e3e6ea"><p>SoftMarket</p><h1 style="font-size:24px">${escapeHTML(title)}</h1>${body ? `<p style="line-height:1.6">${escapeHTML(body)}</p>` : ''}${rows.length ? `<table style="width:100%;border-collapse:collapse">${rows.map(([label, value]) => `<tr><th style="text-align:left;vertical-align:top;padding:10px;border-bottom:1px solid #e3e6ea">${escapeHTML(label)}</th><td style="padding:10px;border-bottom:1px solid #e3e6ea;white-space:pre-wrap;overflow-wrap:anywhere">${escapeHTML(value)}</td></tr>`).join('')}</table>` : ''}${link ? `<p><a style="color:#2f5fe0" href="${escapeHTML(link.url)}">${escapeHTML(link.label)}</a></p><p style="overflow-wrap:anywhere">${escapeHTML(link.url)}</p>` : ''}</main></body></html>`
}
