import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CloudflareAnalytics, CloudflareBeacon } from '../../src/components/analytics/cloudflare'
const state = vi.hoisted(() => ({ path: '/tr/urunler' }))
vi.mock('next/navigation', () => ({ usePathname: () => state.path }))
vi.mock('next/script', () => ({ default: (props: object) => <script {...props} /> }))
describe('Cloudflare analytics boundary', () => {
  it('loads nothing when token is absent', () => expect(renderToStaticMarkup(<CloudflareAnalytics />)).toBe(''))
  it.each(['/tr/hesap','/en/account','/tr/hesap/profil','/en/account/login','/admin','/api/mcp'])('loads nothing on %s', path => {
    state.path = path
    expect(renderToStaticMarkup(<CloudflareAnalytics token="site-token" />)).toBe('')
  })
  it('uses a deferred beacon with SPA tracking disabled on public routes', () => {
    state.path = '/tr/urunler'
    const html = renderToStaticMarkup(<CloudflareBeacon token="site-token" nonce="document-nonce" />)
    expect(html).toContain('https://static.cloudflareinsights.com/beacon.min.js')
    expect(html).toContain('nonce="document-nonce"')
    expect(html).toContain('defer=""'); expect(html).toContain('&quot;spa&quot;:false')
  })
  it('escapes a token that attempts to inject an attribute', () => {
    state.path = '/tr/urunler'
    const html = renderToStaticMarkup(<CloudflareBeacon token={'x" onload="alert(1)'} />)
    expect(html).not.toContain(' onload="')
    expect(html).toContain('&quot;')
  })
})
