import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import NotFound from '@/app/(frontend)/[locale]/not-found'
import tr from '@/i18n/messages/tr.json'
import en from '@/i18n/messages/en.json'

const request = vi.hoisted(() => ({ locale: 'tr' as 'tr' | 'en' }))
vi.mock('next-intl/server', () => ({
  getLocale: async () => request.locale,
  getTranslations: async () => {
    const messages = request.locale === 'en' ? en.notFound : tr.notFound
    return (key: keyof typeof messages) => messages[key]
  },
}))

describe('unmatched locale route fallback', () => {
  it.each(['tr', 'en'] as const)('renders a meaningful localized 404 for %s', async locale => {
    request.locale = locale
    const html = renderToStaticMarkup(await NotFound())
    expect(html).toMatch(/<p\b[^>]*>404<\/p>/)
    expect(html).toContain((locale === 'en' ? en : tr).notFound.title)
    expect(html).toContain(`href="/${locale}"`)
  })
})
