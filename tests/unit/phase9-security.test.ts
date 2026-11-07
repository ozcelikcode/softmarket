import { afterEach, describe, expect, it, vi } from 'vitest'
import { contentSecurityPolicy, usesNonce } from '@/lib/csp'
import { serverUrl, validateServerUrl } from '@/lib/server-url'

const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }))
vi.mock('next/cache', () => cache)
import { revalidatePublicContent, withPublicRevalidation, withGlobalRevalidation } from '@/lib/revalidate'

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); cache.revalidatePath.mockReset() })

describe('CSP rendering boundaries', () => {
  it('uses a strict nonce only for dynamic HTML, with service origins and frame restrictions', () => {
    const policy = contentSecurityPolicy({ nonce: 'random-base64' })
    expect(policy).toContain("script-src 'self' 'nonce-random-base64'")
    expect(policy.split(';').find((d) => d.trim().startsWith('script-src'))).not.toContain('unsafe-inline')
    expect(policy).not.toContain('unsafe-eval')
    for (const host of ['challenges.cloudflare.com', 'static.cloudflareinsights.com', 'cloudflareinsights.com', 'www.youtube-nocookie.com', 'player.vimeo.com']) expect(policy).toContain(host)
    expect(policy).toContain("object-src 'none'")
    expect(contentSecurityPolicy({ admin: true })).toContain("'unsafe-eval'")
    expect(contentSecurityPolicy({ development: true })).toContain("'unsafe-eval'")
  })
  it('keeps public content free of request-specific nonces', () => {
    for (const path of ['/tr', '/en', '/tr/urunler/aile/urun', '/en/products/family/product', '/tr/destek', '/en/support/documentation/product/doc']) expect(usesNonce(path)).toBe(false)
    expect(contentSecurityPolicy()).not.toContain('nonce-')
  })
  it('covers localized dynamic forms, query filters and every portal descendant', () => {
    for (const path of ['/tr/hesap', '/en/account/login', '/tr/urunler', '/en/products', '/tr/ara', '/en/search', '/tr/teklif-iste', '/en/request-quote', '/tr/iletisim', '/en/contact', '/tr/destek/talep', '/en/support/request', '/tr/destek/sss', '/en/support/faq']) expect(usesNonce(path)).toBe(true)
  })
})

describe('public origin', () => {
  it('normalizes local aliases and rejects invalid origins and embedded credentials', () => {
    for (const value of ['', 'http://localhost:3100', 'http://127.0.0.1:3000', 'javascript:alert(1)', 'https://user:secret@example.com']) expect(serverUrl(value)).toBe('http://127.0.0.1:3100')
    expect(serverUrl('https://softmarket.example/path')).toBe('https://softmarket.example')
  })
  it('warns explicitly during a production build/start with a missing or local domain', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'http://localhost:3100')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    validateServerUrl()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('NEXT_PUBLIC_SERVER_URL'))
    warn.mockClear()
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://softmarket.example')
    validateServerUrl()
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('CMS cache invalidation', () => {
  it('does nothing in CLI, invalidates both locale layouts and sitemap in Next', async () => {
    vi.stubEnv('NEXT_RUNTIME', '')
    await revalidatePublicContent()
    expect(cache.revalidatePath).not.toHaveBeenCalled()
    vi.stubEnv('NEXT_RUNTIME', 'nodejs')
    await revalidatePublicContent()
    expect(cache.revalidatePath.mock.calls).toEqual([['/tr', 'layout'], ['/en', 'layout'], ['/sitemap.xml']])
  })
  it('preserves existing hooks and does not fail when Next cache context is absent', async () => {
    const existing = vi.fn()
    const collection = withPublicRevalidation({ slug: 'products', fields: [], hooks: { afterChange: [existing] } })
    expect(collection.hooks?.afterChange?.[0]).toBe(existing)
    expect(collection.hooks?.afterDelete).toHaveLength(1)
    expect(withGlobalRevalidation({ slug: 'header', fields: [] }).hooks?.afterChange).toHaveLength(1)
    vi.stubEnv('NEXT_RUNTIME', 'nodejs')
    cache.revalidatePath.mockImplementationOnce(() => { throw new Error('No incremental cache') })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(revalidatePublicContent()).resolves.toBeUndefined()
  })
})
