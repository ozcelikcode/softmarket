import { beforeEach, describe, expect, it, vi } from 'vitest'

const client = vi.hoisted(() => ({findGlobal: vi.fn(), find: vi.fn(), findByID: vi.fn()}))
vi.mock('@payload-config', () => ({default: {}}))
vi.mock('payload', () => ({getPayload: vi.fn(async () => client)}))

import { getFooterData, getHeaderNav, getMegaData, getSiteSettings, resolveLink } from '@/lib/site'

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
      expect(options).toMatchObject({overrideAccess: false, user: null, draft: false, depth: 0})
    }
    expect(client.findGlobal.mock.calls[0][0].select).toEqual({siteName: true, tagline: true, social: true})
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
    expect(await getHeaderNav('tr')).toEqual({items: [], cta: null})
    expect(await getFooterData('tr')).toEqual({columns: [], legal: [], copyright: null})
    expect(await getMegaData('tr')).toEqual({families: [], solutions: []})
  })

  it('rejects unsafe CMS links before client serialization', () => {
    expect(resolveLink({label: 'x', type: 'external', url: 'javascript:alert(1)'})).toBeNull()
  })
})
