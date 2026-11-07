import { describe, expect, it, vi } from 'vitest'
import { leadSchema, hasHoneypot } from '@/lib/forms/schema'
import { createRateLimiter, requestIP, verifyTurnstile } from '@/lib/forms/security'
import { boundedQuery, quoteSelection, searchQuery } from '@/lib/support-query'
import { prepareDocContent } from '@/lib/doc-content'
import { jsonLdString } from '@/lib/seo'

const valid = {
  kind: 'quote',
  locale: 'tr',
  name: 'Test User',
  email: 'test@example.com',
  company: '',
  phone: '',
  message: 'A useful request message',
  product: '',
  sku: '',
  consent: 'on',
  website: '',
  token: '',
}
describe('lead validation', () => {
  it('accepts only bounded, consented and supported requests', () => {
    expect(leadSchema.safeParse(valid).success).toBe(true)
    for (const change of [
      { kind: 'other' },
      { locale: 'de' },
      { consent: '' },
      { email: 'bad\r\nBcc: hidden@example.com' },
      { name: 'x'.repeat(101) },
      { company: 'x'.repeat(161) },
      { phone: 'x'.repeat(41) },
      { message: 'short' },
      { message: 'x'.repeat(5001) },
      { token: 'x'.repeat(2049) },
      { product: [] },
      { sku: 'x'.repeat(65) },
    ]) {
      expect(leadSchema.safeParse({ ...valid, ...change }).success).toBe(false)
    }
  })
  it('detects honeypots and non-string inputs', () => {
    expect(hasHoneypot('')).toBe(false)
    expect(hasHoneypot('https://spam.invalid')).toBe(true)
    expect(hasHoneypot({})).toBe(true)
  })
  it('limits per IP, recovers after the window, and bounds storage without eviction', () => {
    const allow = createRateLimiter(2, 100, 2)
    expect(allow('a', 0)).toBe(true)
    expect(allow('a', 1)).toBe(true)
    expect(allow('a', 2)).toBe(false)
    expect(allow('b', 3)).toBe(true)
    expect(allow('c', 4)).toBe(false)
    expect(allow('a', 101)).toBe(true)
  })
  it('trusts only an authenticated proxy and otherwise uses a shared bucket', () => {
    const secret = 's'.repeat(32)
    const spoof = new Headers({ 'x-forwarded-for': '203.0.113.1', 'x-softmarket-client-ip': '203.0.113.2' })
    expect(requestIP(spoof, secret)).toBe('unknown')
    spoof.set('x-softmarket-proxy-secret', secret)
    expect(requestIP(spoof, secret)).toBe('203.0.113.2')
    expect(requestIP(spoof, '')).toBe('unknown')
    expect(requestIP(spoof, 'short')).toBe('unknown')
    spoof.set('x-softmarket-client-ip', 'invalid')
    expect(requestIP(spoof, secret)).toBe('unknown')
  })
})
describe('Turnstile server verification', () => {
  it('allows unconfigured development and requires a secret in production', async () => {
    const fetcher = vi.fn()
    expect(await verifyTurnstile('', '', { secret: '', production: false, fetcher })).toBe(true)
    expect(await verifyTurnstile('', '', { secret: '', production: true, fetcher })).toBe(false)
    expect(await verifyTurnstile('', '', { secret: 'CHANGE_KEY', production: true, fetcher })).toBe(
      false,
    )
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('validates success and hostname and sends bounded tokens to Siteverify', async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ success: true, hostname: 'example.com' })),
    )
    const opts = {
      secret: 'secret',
      production: true,
      hostname: 'example.com',
      fetcher: fetcher as typeof fetch,
    }
    expect(await verifyTurnstile('token', '203.0.113.1', opts)).toBe(true)
    expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string)).toMatchObject({
      secret: 'secret',
      response: 'token',
      remoteip: '203.0.113.1',
    })
    expect(await verifyTurnstile('token', '', { ...opts, hostname: 'wrong.invalid' })).toBe(false)
    expect(await verifyTurnstile('', '', opts)).toBe(false)
    expect(await verifyTurnstile('x'.repeat(2049), '', opts)).toBe(false)
  })
  it('fails closed on rejected tokens, invalid JSON, HTTP failure and timeout', async () => {
    for (const fetcher of [
      vi.fn(async () => new Response('{"success":false}')),
      vi.fn(async () => new Response('not json')),
      vi.fn(async () => new Response('{}', { status: 500 })),
      vi.fn(async () => {
        throw new Error('timeout')
      }),
    ]) {
      expect(
        await verifyTurnstile('token', '', { secret: 'secret', fetcher: fetcher as typeof fetch }),
      ).toBe(false)
    }
  })
})
describe('public query boundaries', () => {
  it('limits search and rejects repeated values', () => {
    expect(searchQuery(undefined)).toBe('')
    expect(searchQuery(' a ')).toBeNull()
    expect(searchQuery('  help  ')).toBe('help')
    expect(searchQuery('x'.repeat(120))).toHaveLength(120)
    expect(searchQuery('x'.repeat(121))).toBeNull()
    expect(searchQuery(['hello', 'world'])).toBeNull()
    expect(searchQuery('%_')).toBeNull()
    expect(boundedQuery(['x'])).toBeNull()
  })
  it('preselects only a valid SKU belonging to the public product', () => {
    const products = [
      { id: 1, slug: 'p' },
      { id: 2, slug: 'q' },
    ]
    const editions = [{ sku: 'P-PRO', product: 1 }]
    expect(quoteSelection(products, editions, 'p', 'P-PRO')).toEqual({ product: 'p', sku: 'P-PRO' })
    expect(quoteSelection(products, editions, 'q', 'P-PRO')).toEqual({ product: 'q', sku: '' })
    expect(quoteSelection(products, editions, 'missing', 'P-PRO')).toEqual({ product: '', sku: '' })
    expect(quoteSelection(products, editions, ['p'], 'P-PRO')).toEqual({ product: '', sku: '' })
  })
  it('generates unique heading anchors and safely escapes FAQ JSON-LD', () => {
    const source = {
      root: {
        children: [
          { type: 'heading', children: [{ text: 'Same' }] },
          { type: 'heading', children: [{ text: 'Same' }] },
        ],
      },
    }
    expect(prepareDocContent(source).headings).toEqual([
      { id: 'doc-heading-1', text: 'Same' },
      { id: 'doc-heading-2', text: 'Same' },
    ])
    expect(JSON.stringify(source)).not.toContain('anchor')
    expect(jsonLdString({ text: '</script><script>alert(1)</script>' })).not.toContain('<')
  })
})
