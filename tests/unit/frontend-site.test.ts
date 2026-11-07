import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const client = vi.hoisted(() => ({findGlobal: vi.fn(), find: vi.fn(), findByID: vi.fn()}))
vi.mock('@payload-config', () => ({default: {}}))
vi.mock('payload', () => ({getPayload: vi.fn(async () => client)}))

import { getFooterData, getHeaderNav, getMegaData, getSiteSettings, resolveLink } from '@/lib/site'
import { Actions } from '@/components/blocks/actions'

beforeEach(() => vi.resetAllMocks())

const internal = (relationTo: string, value: unknown) => ({type: 'internal', label: 'Link', reference: {relationTo, value}})

describe('anonymous frontend Local API', () => {
  it('keeps globals shallow, selects public fields and enforces anonymous access', async () => {
    client.findGlobal.mockResolvedValue({})
    await getSiteSettings('tr')
    await getHeaderNav('tr')
    await getFooterData('tr')
    expect(client.findGlobal).toHaveBeenCalledTimes(3)
    for (const [options] of client.findGlobal.mock.calls) {
      expect(options).toMatchObject({overrideAccess: false, user: null, draft: false})
    }
    // Site settings: depth 1 only for logo/favicon media, populated with a public projection (F7).
    expect(client.findGlobal.mock.calls[0][0]).toMatchObject({depth: 1, populate: {media: {url: true, alt: true, protected: true}}})
    expect(Object.keys(client.findGlobal.mock.calls[0][0].select).sort()).toEqual(
      ['brand', 'contact', 'favicon', 'logo', 'logoDark', 'motion', 'siteName', 'social', 'tagline'])
    expect(client.findGlobal.mock.calls[0][0].select).not.toHaveProperty('company')
    expect(client.findGlobal.mock.calls[1][0].depth).toBe(0)
    expect(client.findGlobal.mock.calls[2][0].depth).toBe(0)
  })

  it('enforces publication and avoids loading product layouts, users or commerce records', async () => {
    client.find.mockResolvedValue({docs: []})
    expect(await getMegaData('en')).toEqual({families: [], solutions: []})
    for (const [options] of client.find.mock.calls) {
      expect(options).toMatchObject({overrideAccess: false, user: null, draft: false, depth: 0})
      expect(options.select).not.toHaveProperty('layout')
      if (options.collection !== 'product-families') expect(options.where).toEqual({_status: {equals: 'published'}})
    }
    expect(client.find.mock.calls.map(([o]) => o.collection)).toEqual(['product-families', 'products', 'solutions'])
  })

  it('resolves products through public slug-only relations and drops inaccessible references', async () => {
    client.findGlobal.mockResolvedValue({
      navItems: [
        {link: internal('products', 1)},
        {link: internal('posts', 2)},
        {link: internal('customers', 7)},
        {link: internal('customers', 8)},
        {link: internal('licenses', 9)},
      ],
    })
    client.findByID.mockImplementation(async ({collection}) => {
      if (collection === 'posts') throw new Error('Not found or forbidden')
      return {slug: 'product', family: {slug: 'family'}}
    })
    const result = await getHeaderNav('tr')
    expect(result.items[0].href).toBe('/urunler/family/product')
    expect(result.items).toHaveLength(1)
    expect(client.findByID.mock.calls.map(([o]) => o.collection)).toEqual(['products', 'posts'])
    expect(client.findByID.mock.calls[0][0]).toMatchObject({
      overrideAccess: false, user: null, draft: false, depth: 1,
      select: {slug: true, family: true},
      populate: {'product-families': {slug: true}, products: {slug: true}},
    })
  })

  it('uses fallbacks on database or Payload initialization errors', async () => {
    client.find.mockRejectedValue(new Error('DB offline'))
    client.findGlobal.mockRejectedValue(new Error('DB offline'))
    expect(await getSiteSettings('tr')).toBeNull()
    expect(await getHeaderNav('tr')).toEqual({
      items: [], cta: null, secondaryCta: null, announcement: null,
      utility: {links: [], showSearch: true, showLanguage: true, showAccount: true},
    })
    expect(await getFooterData('tr')).toEqual({
      columns: [], legal: [], copyright: null, brandBlurb: null, showContact: true, showSocial: true,
    })
    expect(await getMegaData('tr')).toEqual({families: [], solutions: []})
  })

  it('rejects unsafe CMS links before client serialization', () => {
    expect(resolveLink({label: 'x', type: 'external', url: 'javascript:alert(1)'})).toBeNull()
  })

  it.each(['data:text/html,test', '//evil.test', 'mailto:[COMPANY EMAIL]', 'mailto:[COMPANY_EMAIL]', 'mailto:%5BCOMPANY%20EMAIL%5D'])('drops unsafe or placeholder CTA target %s', (url) => {
    expect(resolveLink({ label: 'Contact', type: 'external', url })).toBeNull()
  })

  it('preserves real email links and query parameters', () => {
    expect(resolveLink({ label: 'Contact', type: 'external', url: 'mailto:sales@example.com?subject=Quote%20request' })?.href)
      .toBe('mailto:sales@example.com?subject=Quote%20request')
  })

  it('renders the localized quote fallback only when all CMS actions are invalid', () => {
    const fallback = { label: 'Request quote', href: '/teklif-iste' }
    const html = renderToStaticMarkup(createElement(Actions, { locale: 'en', fallback, actions: [
      { link: { label: 'Contact', type: 'external', url: 'mailto:%5BCOMPANY_EMAIL%5D' } },
      { link: { label: 'Unsafe', type: 'external', url: 'javascript:alert(1)' } },
    ] }))
    expect(html).toContain('href="/en/request-quote"')
    expect(html).not.toContain('mailto:')
    expect(html).not.toContain('javascript:')
    const valid = renderToStaticMarkup(createElement(Actions, { locale: 'en', fallback, actions: [
      { link: { label: 'Contact', type: 'external', url: 'mailto:sales@example.com' } },
    ] }))
    expect(valid).toContain('mailto:sales@example.com')
    expect(valid).not.toContain('request-quote')
  })
})
