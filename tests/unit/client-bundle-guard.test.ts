import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ usePathname: () => '/tr', useRouter: () => ({ replace: vi.fn() }) }))
vi.mock('@/components/layout/language-switcher', () => ({ LanguageSwitcher: () => null }))

import { HeaderShell } from '@/components/layout/header-shell'
import { hasLocale } from '@/i18n/has-locale'
import { publicLanguageSwitch } from '@/i18n/paths'

/**
 * F11 perf fix guards: client islands must not pull the ICU parser (next-intl hooks/provider) or
 * tailwind-merge (`@/lib/utils`) into the browser bundle, and server code must not import the
 * `next-intl` root entry (its react-server build registers NextIntlClientProvider as a client reference).
 */
const SRC = join(process.cwd(), 'src')
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? (n === '(payload)' ? [] : files(p)) : /\.tsx?$/.test(n) ? [p] : []
  })
const code = (p: string) => readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')

describe('client bundle guard', () => {
  const all = files(SRC)
  const clients = all.filter((p) => /^\s*['"]use client['"]/.test(readFileSync(p, 'utf8')))
  // Client modules on every public page (layout + error boundaries); page-level islands may use Button.
  const shared = clients.filter((p) => /(layout\/|error\.tsx|global-error\.tsx|motion-observer|alternates-store|json-ld|nonce-provider)/.test(p))

  it('finds the shared client islands', () => {
    expect(shared.length).toBeGreaterThanOrEqual(6)
  })

  it.each(clients.map((p) => [p.slice(SRC.length + 1), p]))('%s uses no next-intl client API', (_, p) => {
    expect(code(p)).not.toMatch(/from ['"](next-intl|use-intl)(\/navigation|\/routing)?['"]/)
    expect(code(p)).not.toMatch(/from ['"]@\/i18n\/navigation['"]/)
  })

  it.each(shared.map((p) => [p.slice(SRC.length + 1), p]))('%s does not import tailwind-merge (cn) or cva', (_, p) => {
    expect(code(p)).not.toMatch(/from ['"](@\/lib\/utils|tailwind-merge|class-variance-authority|@\/components\/ui\/(button|container|section))['"]/)
  })

  it('no source module imports the next-intl root entry', () => {
    expect(all.filter((p) => /from ['"]next-intl['"]/.test(code(p))).map((p) => p.slice(SRC.length + 1))).toEqual([])
  })

  it('the [locale] layout renders no NextIntlClientProvider', () => {
    expect(code(join(SRC, 'app/(frontend)/[locale]/layout.tsx'))).not.toContain('NextIntlClientProvider')
  })
})

describe('client-safe i18n helpers', () => {
  it('hasLocale matches next-intl semantics', () => {
    expect(hasLocale(['tr', 'en'], 'en')).toBe(true)
    expect(hasLocale(['tr', 'en'], 'de')).toBe(false)
    expect(hasLocale(['tr', 'en'], undefined)).toBe(false)
  })

  it.each([
    ['/tr', 'tr', '/'],
    ['/en', 'en', '/'],
    ['/tr/urunler', 'tr', '/urunler'],
    ['/en/products/a/b', 'en', '/urunler'],
    ['/tr/destek/dokumantasyon/x/y', 'tr', '/destek/dokumantasyon'],
    ['/en/support/release-notes', 'en', '/destek/surum-notlari'],
    ['/tr/hesap/talepler/12', 'tr', '/hesap/talepler'],
    ['/tr/bir-landing', 'tr', '/'],
    ['/en/company/about/', 'en', '/sirket/hakkimizda'],
  ])('publicLanguageSwitch(%s)', (path, locale, target) => {
    expect(publicLanguageSwitch(path)).toEqual({ locale, path: target })
  })
})

describe('server-rendered header (no Radix)', () => {
  const html = renderToStaticMarkup(createElement(HeaderShell, {
    locale: 'tr',
    items: [
      { label: 'Ürünler', href: '/urunler', mega: 'products' },
      { label: 'Destek', href: '/destek' },
      { label: 'Şirket', children: [{ label: 'Hakkımızda', href: '/sirket/hakkimizda' }] },
    ],
    cta: { label: 'Demo', href: '/demo-talep' },
    mega: { families: [{ title: 'Aile', href: '/urunler/aile', products: [{ label: 'Ürün', href: '/urunler/aile/urun' }] }], solutions: [] },
    labels: { siteName: 'SoftMarket', search: 'Ara', account: 'Hesap', signIn: 'Giriş', signOut: 'Çıkış', accountMenu: 'Hesap', menu: 'Menü', close: 'Kapat', allProducts: 'Tüm ürünler', allSolutions: 'Tüm çözümler', catalogSoon: 'Yakında' },
  }))

  it('renders triggers with aria-expanded/controls and hidden panels in the HTML', () => {
    const triggers = [...html.matchAll(/<button[^>]*data-mega-trigger[^>]*>/g)].map((m) => m[0])
    expect(triggers).toHaveLength(2)
    for (const t of triggers) {
      expect(t).toContain('aria-expanded="false"')
      const id = t.match(/aria-controls="([^"]+)"/)![1]
      expect(html).toMatch(new RegExp(`<div id="${id}" data-state="closed" hidden=""`))
    }
    // Panel links are server HTML (crawlable, no client render).
    expect(html).toContain('href="/tr/urunler/aile/urun"')
    expect(html).toContain('href="/tr/sirket/hakkimizda"')
    expect(html).toMatch(/<a[^>]*data-mega-top[^>]*href="\/tr\/destek"|<a[^>]*href="\/tr\/destek"[^>]*data-mega-top/)
  })

  it('renders the mobile drawer as a closed, labelled native dialog', () => {
    expect(html).toMatch(/<button[^>]*aria-haspopup="dialog"[^>]*aria-expanded="false"[^>]*aria-controls="site-mobile-nav"/)
    expect(html).toMatch(/<dialog id="site-mobile-nav"[^>]*aria-labelledby="site-mobile-nav-title"/)
    expect(html).not.toMatch(/<dialog[^>]*\sopen(?:=|\s|>)/)
    expect(html).not.toContain('radix')
  })
})
