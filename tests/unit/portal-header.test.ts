import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const route = vi.hoisted(() => ({ path: '/tr/destek' }))
vi.mock('next/navigation', () => ({ usePathname: () => route.path }))
vi.mock('@/components/layout/language-switcher', () => ({ LanguageSwitcher: () => null }))
vi.mock('@/lib/portal/actions', () => ({ logoutAction: vi.fn() }))
import { HeaderShell } from '@/components/layout/header-shell'

const render = (path: string) => {
  route.path = path
  return renderToStaticMarkup(createElement(HeaderShell, {
    locale: 'tr', items: [], cta: { label: 'Demo', href: '/demo-talep' },
    mega: { families: [], solutions: [] },
    labels: { siteName: 'SoftMarket', search: 'Search', account: 'Account', signIn: 'Sign in', signOut: 'Sign out', accountMenu: 'Account menu', menu: 'Menu', close: 'Close', allProducts: 'Products', allSolutions: 'Solutions', catalogSoon: 'Soon' },
  }))
}
describe('support and portal header contrast', () => {
  it.each(['/tr/destek', '/tr/destek/dokumantasyon', '/en/support', '/en/account', '/tr/hesap/giris'])('paints a light background behind the dark logo on %s before scrolling', (path) => {
    const html = render(path)
    const header = html.match(/<header[^>]*>/)![0]
    expect(header).toContain('data-theme="light"')
    expect(header).toContain('bg-bg')
    expect(header).not.toContain('bg-transparent')
    expect(html).toContain('SoftMarket')
  })
  it('preserves the transparent dark showcase header', () => {
    expect(render('/tr').match(/<header[^>]*>/)![0]).toContain('data-theme="dark"')
    expect(render('/tr').match(/<header[^>]*>/)![0]).toContain('bg-transparent')
  })
})
