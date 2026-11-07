import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import GlobalNotFound from '@/app/global-not-found'

describe('unmatched route fallback', () => {
  it('renders a meaningful 404 inside the main landmark', () => {
    const html = renderToStaticMarkup(<GlobalNotFound />)
    expect(html).toMatch(/<main\b[^>]*>[\s\S]*?>404<\/p>/)
    expect(html).toContain('Page not found')
  })
})
