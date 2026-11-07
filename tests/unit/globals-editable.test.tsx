import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * F7: link `route` type, brand accent contrast rule, CMS header/footer chrome with i18n fallbacks,
 * legacy link data, placeholder hiding and MCP global permissions.
 */
const client = vi.hoisted(() => ({ findGlobal: vi.fn(), find: vi.fn(), findByID: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => client), UnauthorizedError: class extends Error {} }))
vi.mock('next/navigation', () => ({ usePathname: () => '/tr', useSearchParams: () => new URLSearchParams() }))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }))
vi.mock('@/components/layout/language-switcher', () => ({ LanguageSwitcher: () => null }))

import { Actions } from '@/components/blocks/actions'
import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { SiteSettings } from '@/globals/SiteSettings'
import { LINK_ROUTES, localizedHref, ROUTE_BY_KEY, routeKey, routeOptions, routePath } from '@/i18n/paths'
import { accentStyle, contrast, deriveAccent, themeRatio, validateAccent } from '@/lib/brand'
import { mcpGlobals, mcpOptions } from '@/lib/mcp'
import { getFooterData, getHeaderNav, linkTarget, publicContact, publicImage, resolveLink, siteIdentity } from '@/lib/site'
import { formatCopyright, publicText } from '@/lib/utils'

beforeEach(() => vi.resetAllMocks())

const route = (key: string, label = 'Link', routeParam?: string) => ({ type: 'route' as const, route: key, label, routeParam })
const globals = (data: Record<string, unknown>) =>
  client.findGlobal.mockImplementation(async ({ slug }: { slug: string }) => data[slug] ?? null)

describe('link route type (locale-independent, resolved through src/i18n/paths.ts)', () => {
  it('offers stable unique keys with TR/EN path labels and no token pages', () => {
    const keys = routeOptions().map((o) => o.value)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.every((k) => /^[a-z0-9_-]+$/.test(k))).toBe(true)
    expect(routeOptions().find((o) => o.value === 'urunler')?.label).toEqual({ tr: '/urunler', en: '/products' })
    expect(routeOptions().find((o) => o.value === 'yasal_slug')?.label).toEqual({ tr: '/yasal/[slug]', en: '/legal/[slug]' })
    expect(LINK_ROUTES).not.toContain('/hesap/sifre-sifirla')
    expect(LINK_ROUTES).not.toContain('/urunler/[family]/[product]')
    expect(Object.values(ROUTE_BY_KEY).map(routeKey)).toEqual(Object.keys(ROUTE_BY_KEY))
  })

  it.each([
    ['home', undefined, '/tr', '/en'],
    ['urunler', undefined, '/tr/urunler', '/en/products'],
    ['destek_surum-notlari', undefined, '/tr/destek/surum-notlari', '/en/support/release-notes'],
    ['sirket_hakkimizda', undefined, '/tr/sirket/hakkimizda', '/en/company/about'],
    ['demo-talep', undefined, '/tr/demo-talep', '/en/request-demo'],
    ['yasal_slug', 'kvkk-aydinlatma', '/tr/yasal/kvkk-aydinlatma', '/en/legal/kvkk-aydinlatma'],
    ['urunler_family', 'akis-yonetimi', '/tr/urunler/akis-yonetimi', '/en/products/akis-yonetimi'],
  ])('%s (%s) resolves to TR %s and EN %s', (key, param, tr, en) => {
    const href = linkTarget(route(key, 'x', param))!
    expect(href).not.toMatch(/^\/(tr|en)\b/)
    expect(localizedHref(href, 'tr')).toBe(tr)
    expect(localizedHref(href, 'en')).toBe(en)
  })

  it('rejects unknown keys, prototype names and unsafe or missing parameters', () => {
    for (const key of ['nope', '__proto__', 'constructor', '/urunler', '']) expect(routePath(key)).toBeNull()
    for (const param of [undefined, '', '../x', 'a/b', '//evil', '%2f%2fevil', '%2e%2e', 'Büyük', 'x?y=1', ' javascript:alert(1)']) {
      expect(routePath('yasal_slug', param)).toBeNull()
    }
    expect(resolveLink(route('yasal_slug', 'Legal'))).toBeNull()
    expect(resolveLink(route('urunler', ''))).toBeNull()
  })

  it('still renders legacy link data unchanged (internal reference, external URL incl. old /tr paths)', () => {
    expect(resolveLink({ type: 'external', url: '/tr/urunler', label: 'Ürünler' })?.href).toBe('/tr/urunler')
    expect(resolveLink({ type: 'external', url: 'https://example.com/x', label: 'Ext', newTab: true }))
      .toEqual({ label: 'Ext', href: 'https://example.com/x', newTab: true })
    expect(resolveLink({ type: 'internal', label: 'P', reference: { relationTo: 'solutions', value: { slug: 'crm' } } })?.href)
      .toBe('/cozumler/crm')
    // A stale `url` left on a route link (type switched in admin) is ignored.
    expect(resolveLink({ type: 'route', route: 'iletisim', url: 'mailto:[COMPANY EMAIL]', label: 'C' })?.href).toBe('/iletisim')
    const html = renderToStaticMarkup(
      <Actions
        locale="en"
        actions={[
          { link: { type: 'external', url: '/tr/urunler', label: 'Legacy' } },
          { link: { type: 'route', route: 'teklif-iste', label: 'Quote', appearance: 'secondary' } as never },
        ]}
      />,
    )
    expect(html).toContain('href="/en/products"')
    expect(html).toContain('href="/en/request-quote"')
  })
})

describe('brand accent contrast rule (WCAG AA 4.5:1)', () => {
  it.each(['#2f5fe0', '#4c7dff', '#0f766e', '#c2410c', '#ffd400', '#000000', '#ffffff', '#ABC'])('accepts %s and derives passing tones for both themes', (hex) => {
    const result = deriveAccent(hex)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    for (const theme of ['dark', 'light'] as const) {
      const t = result[theme]
      expect(themeRatio(t.accent, theme)).toBeGreaterThanOrEqual(4.5)
      expect(themeRatio(t.hover, theme)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(t.accent, t.contrast)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(t.hover, t.contrast)).toBeGreaterThanOrEqual(4.5)
    }
    expect(validateAccent(hex)).toBe(true)
  })

  it('keeps an entered color unchanged in the theme where it already passes', () => {
    const light = deriveAccent('#2f5fe0')
    expect(light.ok && light.light.accent).toBe('#2f5fe0')
    expect(light.ok && light.light.contrast).toBe('#ffffff')
    const dark = deriveAccent('#4c7dff')
    expect(dark.ok && dark.dark).toMatchObject({ accent: '#4c7dff', contrast: '#0b0d10' })
  })

  it.each(['#e11d48', '#d9480f'])('rejects mid-luminance %s that fails both themes', (hex) => {
    expect(deriveAccent(hex)).toMatchObject({ ok: false, reason: 'contrast' })
    expect(validateAccent(hex)).toMatch(/Kontrast yetersiz.*4,5:1/)
    expect(validateAccent(hex, 'en')).toMatch(/Insufficient contrast/)
    expect(accentStyle(hex)).toEqual({})
  })

  it.each(['blue', '#12', '#1234567', 'rgb(0,0,0)', 'url(x)', '#fff;color:red'])('rejects malformed %s (CSS injection safe)', (value) => {
    expect(validateAccent(value)).toMatch(/hex/)
    expect(accentStyle(value)).toEqual({})
  })

  it('empty accent = built-in palette, no inline variables', () => {
    expect(validateAccent(null)).toBe(true)
    expect(validateAccent('')).toBe(true)
    expect(accentStyle(null)).toEqual({})
  })

  it('emits only hex CSS variables for both themes', () => {
    const style = accentStyle('#0F766E')
    expect(Object.keys(style).sort()).toEqual([
      '--brand-dark-accent', '--brand-dark-accent-contrast', '--brand-dark-accent-hover',
      '--brand-light-accent', '--brand-light-accent-contrast', '--brand-light-accent-hover',
    ])
    expect(Object.values(style).every((v) => /^#[0-9a-f]{6}$/.test(v))).toBe(true)
    expect(style['--brand-light-accent']).toBe('#0f766e')
  })

  it('is enforced by the SiteSettings field (every write path: admin, REST, Local API, MCP)', () => {
    const tabs = SiteSettings.fields.find((f) => f.type === 'tabs') as { tabs: { fields: unknown[] }[] }
    const brand = tabs.tabs.flatMap((t) => t.fields).find((f) => (f as { name?: string }).name === 'brand') as {
      fields: { name: string; validate: (v: unknown, o: unknown) => unknown; hooks: { beforeValidate: ((a: { value: unknown }) => unknown)[] } }[]
    }
    const accent = brand.fields.find((f) => f.name === 'accent')!
    expect(accent.validate('#e11d48', { req: { i18n: { language: 'tr' } } })).toMatch(/Kontrast/)
    expect(accent.validate('#0f766e', { req: {} })).toBe(true)
    expect(accent.hooks.beforeValidate[0]({ value: ' #ABC ' })).toBe('#aabbcc')
    expect(accent.hooks.beforeValidate[0]({ value: '' })).toBeNull()
  })
})

describe('placeholders never render', () => {
  it.each(['[ŞİRKET ADRESİ]', '[COMPANY PHONE]', ' [ÇALIŞMA SAATLERİ] ', 'Tel: [COMPANY PHONE]', '', '   ', null, 42])('publicText(%j) is null', (v) => {
    expect(publicText(v)).toBeNull()
  })
  it('keeps real values and formats the copyright template', () => {
    expect(publicText(' İstanbul, Türkiye ')).toBe('İstanbul, Türkiye')
    expect(publicText('Hafta içi 09:00–18:00 [GMT+3]')).toBe('Hafta içi 09:00–18:00 [GMT+3]')
    expect(formatCopyright('© {year} {siteName}. {other}', { year: 2026, siteName: 'Acme' })).toBe('© 2026 Acme. {other}')
  })
  it('publicContact drops empty/placeholder rows and builds a tel: link', () => {
    const contact = publicContact({ contact: { address: '[ŞİRKET ADRESİ]', phone: '+90 (212) 000 00 00', workingHours: '[ÇALIŞMA SAATLERİ]', email: null } })
    expect(contact).toMatchObject({ address: null, workingHours: null, email: null, phone: { label: '+90 (212) 000 00 00', href: 'tel:+902120000000' } })
    expect(publicContact({ contact: { phone: '[COMPANY PHONE]' } }).phone).toBeNull()
    expect(siteIdentity({ siteName: '[SITE NAME]' } as never, 'SoftMarket').name).toBe('SoftMarket')
  })
})

describe('CMS header/footer with i18n fallbacks', () => {
  it('falls back to the i18n menu, CTA and wordmark when the CMS is empty or unavailable', async () => {
    client.findGlobal.mockRejectedValue(new Error('DB offline'))
    client.find.mockRejectedValue(new Error('DB offline'))
    const html = renderToStaticMarkup(await Header({ locale: 'en' }))
    // Radix renders closed mega/dropdown content lazily: assert the fallback triggers + links in the bar.
    for (const label of ['products', 'solutions', 'support', 'company']) expect(html).toContain(`>${label}<svg`)
    for (const href of ['/en/request-demo', '/en/search', '/en/account']) expect(html).toContain(`href="${href}"`)
    expect(html).toContain('siteName') // i18n wordmark (translation key in this test)
    expect(html).not.toContain('<img')
    expect(html).not.toContain('bg-accent text-accent-contrast relative') // no announcement
    const footer = renderToStaticMarkup(await Footer({ locale: 'tr' }))
    for (const href of ['/tr/destek/indirmeler', '/tr/yasal/kvkk-aydinlatma', '/tr/iletisim']) expect(footer).toContain(`href="${href}"`)
    expect(footer).toContain(`© ${new Date().getFullYear()} siteName. rights`)
    expect(footer).not.toContain('<address')
  })

  it('renders CMS logo, site name, route menu, custom mega, secondary CTA, announcement and utility links', async () => {
    globals({
      'site-settings': {
        siteName: 'Acme', tagline: 'Tag',
        logoDark: { url: '/api/media/file/logo.svg', alt: '', width: 120, height: 32, mimeType: 'image/svg+xml', protected: false },
        contact: { address: '[ŞİRKET ADRESİ]', phone: '+90 212 000 00 00', workingHours: 'Hafta içi 09:00–18:00' },
        social: [{ platform: 'linkedin', url: 'https://www.linkedin.com/company/acme' }, { platform: 'x', url: 'javascript:alert(1)' }],
      },
      header: {
        navItems: [
          { link: route('urunler', 'Ürünler'), megaMenu: 'products' },
          {
            link: route('sirket_hakkimizda', 'Şirket'), megaMenu: 'custom',
            columns: [{ title: 'Kurumsal', links: [{ link: route('kariyer', 'Kariyer'), description: 'Ekibimize katılın.' }] }],
            featured: { title: 'Demo', description: 'Kısa demo', link: route('demo-talep', 'Planla') },
          },
        ],
        cta: { link: route('demo-talep', 'Demo İste'), secondary: route('teklif-iste', 'Teklif iste') },
        announcement: { enabled: true, text: 'Yeni sürüm yayında.', dismissible: true, link: route('destek_surum-notlari', 'İncele') },
        utility: { links: [{ link: route('destek_dokumantasyon', 'Dokümantasyon') }], showSearch: false, showLanguage: true, showAccount: true },
      },
      footer: {
        brandBlurb: 'Kurumsal yazılım.', copyright: '© {year} {siteName}', showContact: true, showSocial: true,
        legalLinks: [{ link: route('yasal_slug', 'KVKK', 'kvkk-aydinlatma') }],
      },
    })
    client.find.mockResolvedValue({ docs: [] })
    const html = renderToStaticMarkup(await Header({ locale: 'en' }))
    expect(html).toContain('aria-label="Acme"')
    expect(html).toContain('src="/api/media/file/logo.svg"')
    expect(html).toContain('href="/en/request-quote"')
    expect(html).toContain('href="/en/request-demo"')
    expect(html).toContain('Yeni sürüm yayında.')
    expect(html).toContain('href="/en/support/release-notes"')
    expect(html).toContain('href="/en/support/documentation"')
    expect(html).not.toContain('href="/en/search"') // utility.showSearch=false
    const nav = await getHeaderNav('en')
    expect(nav.items[1]).toMatchObject({ mega: 'custom', href: '/sirket/hakkimizda', columns: [{ title: 'Kurumsal', links: [{ href: '/kariyer' }] }], featured: { title: 'Demo', link: { href: '/demo-talep' } } })
    expect(nav.announcement).toMatchObject({ text: 'Yeni sürüm yayında.', dismissible: true })
    expect(nav.announcement!.id).toMatch(/^[a-z0-9]+$/)

    const footer = renderToStaticMarkup(await Footer({ locale: 'tr' }))
    expect(footer).toContain('Kurumsal yazılım.')
    expect(footer).toContain(`© ${new Date().getFullYear()} Acme`)
    expect(footer).toContain('href="tel:+902120000000"')
    expect(footer).toContain('Hafta içi 09:00–18:00')
    expect(footer).toContain('href="/tr/yasal/kvkk-aydinlatma"')
    expect(footer).toContain('linkedin.com')
    expect(footer).not.toContain('javascript:')
    expect(footer).not.toMatch(/\[[A-ZÇĞİÖŞÜ ]+\]/)
  })

  it('hides disabled announcements, empty custom menus and contact/social when toggled off', async () => {
    globals({
      'site-settings': { contact: { phone: '+90 212 000 00 00' }, social: [{ platform: 'x', url: 'https://x.com/acme' }] },
      header: {
        navItems: [{ link: route('iletisim', 'İletişim'), megaMenu: 'custom', columns: [{ title: 'Boş', links: [] }] }],
        announcement: { enabled: false, text: 'Gizli' },
      },
      footer: { showContact: false, showSocial: false },
    })
    const nav = await getHeaderNav('tr')
    expect(nav.announcement).toBeNull()
    expect(nav.items).toEqual([{ label: 'İletişim', href: '/iletisim', newTab: false, mega: undefined, children: undefined, columns: undefined, featured: undefined }])
    const footer = renderToStaticMarkup(await Footer({ locale: 'tr' }))
    expect(footer).not.toContain('tel:')
    expect(footer).not.toContain('x.com')
    expect((await getFooterData('tr')).showContact).toBe(false)
  })

  it('never renders protected or non-image media as logo', () => {
    const identity = siteIdentity({
      logo: { url: '/api/media/file/secret.png', protected: true, mimeType: 'image/png' },
      logoDark: { url: '/api/media/file/file.pdf', protected: false, mimeType: 'application/pdf' },
      favicon: 7,
    } as never, 'SoftMarket')
    expect(identity.logoOnDark).toBeNull()
    expect(identity.logoOnLight).toBeNull()
    expect(identity.favicon).toBeNull()
    expect(identity.motion).toBe('subtle')
    expect(siteIdentity({ motion: 'none' } as never, 'x').motion).toBe('none')
    expect(publicImage({ url: '/api/media/file/unknown.png', mimeType: 'image/png' })).toBeNull()
    expect(publicImage({ url: '/api/media/file/unknown', protected: false })).toBeNull()
  })
})

describe('MCP global update permission', () => {
  it('keeps header/footer/site-settings find+update and maps them into the API-key capability map', async () => {
    expect(mcpGlobals).toEqual({
      header: { enabled: { find: true, update: true } },
      footer: { enabled: { find: true, update: true } },
      'site-settings': { enabled: { find: true, update: true } },
    })
    const auth = vi.fn(async () => ({ user: { id: 1, collection: 'users', roles: ['admin'], _strategy: 'api-key' } }))
    const req = { headers: new Headers({ authorization: 'Bearer key' }), payload: { auth } } as never
    const access = await mcpOptions.overrideAuth!(req, vi.fn())
    expect(access).toMatchObject({ header: { find: true, update: true }, footer: { find: true, update: true }, siteSettings: { find: true, update: true } })
  })
})
