import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
import { MediaImage } from '@/components/ui/media-image'
import { NonceProvider } from '@/components/security/nonce-provider'
import { JsonLd } from '@/components/sections/json-ld'

it.each([true, false, undefined])('never passes mutable Payload media URLs through the shared image optimizer (protected=%s)', (protectedValue) => {
  const html = renderToStaticMarkup(<MediaImage media={{ url: '/api/media/file/test.png', alt: 'Screen', width: 1200, height: 800, protected: protectedValue }} />)
  expect(html).toContain('src="/api/media/file/test.png"')
  expect(html).not.toContain('/_next/image')
  expect(html).toContain('width="1200"')
  expect(html).toContain('loading="lazy"')
})

describe('JSON-LD nonce', () => {
  it('renders the dynamic boundary nonce and escapes executable markup', () => {
    const html = renderToStaticMarkup(<NonceProvider nonce="request-nonce"><JsonLd data={{ headline: '</script><script>evil()</script>' }} /></NonceProvider>)
    expect(html).toContain('nonce="request-nonce"')
    expect(html).not.toContain('<script>evil()')
    expect(html).toContain('\\u003c/script>')
  })
  it('keeps statically cached JSON-LD free of request-specific values', () => {
    const html = renderToStaticMarkup(<JsonLd data={{ '@type': 'TechArticle' }} />)
    expect(html).not.toContain('nonce=')
    expect(html).toContain('TechArticle')
  })
})
