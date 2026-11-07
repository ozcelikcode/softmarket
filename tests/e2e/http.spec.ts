import { expect, test } from '@playwright/test'

// These checks need no browser process, so HTTP/security proof remains available
// on hosts where macOS disallows Chromium's MachPort bootstrap.
test('HTTP: both locales, canonical/hreflang and localized branded OG images', async ({ request, baseURL }) => {
  for (const locale of ['tr', 'en']) {
    const response = await request.get(`/${locale}`)
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain(`<html lang="${locale}"`)
    expect(html).toContain(`rel="canonical" href="http://127.0.0.1:3100/${locale}"`)
    expect(html).toContain('hrefLang="x-default"')
    const og = await request.get(`/${locale}/opengraph-image`)
    expect(og.status()).toBe(200)
    expect(og.headers()['content-type']).toContain('image/png')
    const catalog = await request.get(locale === 'tr' ? '/tr/urunler' : '/en/products')
    expect(catalog.status()).toBe(200)
    expect(new URL(catalog.url()).origin).toBe(new URL(baseURL!).origin)
  }
})

test('HTTP: quote preselection and nonce match the response policy', async ({ request }) => {
  const catalog = await (await request.get('/tr/urunler')).text()
  const productPath = catalog.match(/href="(\/tr\/urunler\/[^/"?]+\/[^/"?]+)"/)?.[1]
  expect(productPath).toBeTruthy()
  const detail = await (await request.get(productPath!)).text()
  const quotePath = detail.match(/href="([^" ]*teklif-iste\?[^" ]*surum=[^" ]+)"/)?.[1]?.replaceAll('&amp;', '&')
  expect(quotePath).toBeTruthy()
  const response = await request.get(quotePath!)
  expect(response.status()).toBe(200)
  const html = await response.text()
  const url = new URL(quotePath!, 'http://127.0.0.1:3100')
  for (const value of [url.searchParams.get('urun'), url.searchParams.get('surum')]) {
    expect(html).toContain(`value="${value}" selected=""`)
  }
  const policy = response.headers()['content-security-policy-report-only'] || response.headers()['content-security-policy']
  const nonce = policy.match(/'nonce-([^']+)'/)?.[1]
  expect(nonce).toBeTruthy()
  expect(html).toContain(`nonce="${nonce}" type="application/ld+json"`)
  const second = await request.get(quotePath!)
  const nextPolicy = second.headers()['content-security-policy-report-only'] || second.headers()['content-security-policy']
  expect(nextPolicy).not.toContain(`'nonce-${nonce}'`)
})

test('HTTP: search/noindex, sitemap, portal no-store, 404 and optimizer denial', async ({ request }) => {
  const search = await request.get('/en/search?q=software')
  expect(search.status()).toBe(200)
  expect(await search.text()).toContain('noindex')
  const xml = await (await request.get('/sitemap.xml')).text()
  expect(xml).toContain('<lastmod>')
  expect(xml).not.toMatch(/<loc>[^<]*\/(?:ara|search)(?:\?|<)/)
  const portal = await request.get('/en/account/login')
  expect(portal.status()).toBe(200)
  expect(portal.headers()['cache-control']).toContain('no-store')
  expect(portal.headers()['x-robots-tag']).toContain('noindex')
  for (const path of ['/tr/xyz', '/en/xyz', '/xyz', '/tr/nonexistent-audit-route', '/en/nonexistent-audit-route']) {
    const missing = await request.get(path)
    expect(missing.status()).toBe(404)
    // Next 15.4.11: notFound() under the (frontend)/[locale] root layout SSRs the __next_error__ shell;
    // the localized 404 renders client-side from the RSC payload. Visible <main> 404 is asserted in smoke.spec.ts (browser).
    const html = await missing.text()
    expect(html).toMatch(/<meta name="next-error" content="not-found"\/?>/)
    expect(html).toContain('NEXT_HTTP_ERROR_FALLBACK;404')
  }
  const missingMedia = await request.get('/api/media/file/yok')
  expect(missingMedia.status()).toBe(404)
  expect(missingMedia.headers()['cache-control']).toContain('no-store')
  const missingAccount = await request.get('/tr/hesap/nonexistent-audit-route')
  expect(missingAccount.status()).toBe(404)
  const policy = missingAccount.headers()['content-security-policy'] || missingAccount.headers()['content-security-policy-report-only']
  const nonce = policy.match(/'nonce-([^']+)'/)?.[1]
  expect(nonce).toBeTruthy()
  const scripts = [...(await missingAccount.text()).matchAll(/<script\b([^>]*)>/g)]
  expect(scripts.length).toBeGreaterThan(0)
  expect(scripts.every(([, attrs]) => attrs.includes(`nonce="${nonce}"`))).toBe(true)
  expect((await request.get('/admin')).status()).toBe(200)
  const missingApi = await request.get('/api/nonexistent-audit-route')
  expect(missingApi.status()).toBe(404)
  expect(missingApi.headers()['content-type']).toContain('application/json')
  expect((await request.get('/_next/image?url=%2Fapi%2Fmedia%2Ffile%2Fprotected.png&w=640&q=75')).status()).toBe(400)
})

test('legacy search preserves queries and invalid dynamic content returns HTTP 404', async ({ request, baseURL }) => {
  const legacy = await request.get('/tr/arama?q=akis&page=1', { maxRedirects: 0 })
  expect(legacy.status()).toBe(308)
  const location = new URL(legacy.headers().location, baseURL)
  expect(location.pathname + location.search).toBe('/tr/ara?q=akis&page=1')
  expect(location.origin).toBe(new URL(baseURL!).origin)
  for (const path of ['/tr/yasal/olmayan', '/en/legal/missing-routine-check', '/tr/ara?q=%25', '/en/search?q=%25']) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(404)
  }
  const empty = await request.get('/tr/ara?q=zzzzzznomatchingrecord')
  expect(empty.status()).toBe(200)
  expect(await empty.text()).toContain('Sonuç bulunamadı.')
})

test('foreign Server Action origins receive a controlled forbidden response', async ({ request, baseURL }) => {
  const origin = new URL(baseURL!).origin
  const denied = await request.post('/tr/iletisim', {
    headers: { 'Next-Action': 'routine-check', Origin: 'https://foreign.example.test' }, data: '',
  })
  expect(denied.status()).toBe(403)
  const allowed = await request.post('/tr/iletisim', {
    headers: { 'Next-Action': 'routine-check', Origin: origin }, data: '',
  })
  // The fake action may be rejected by Next, but our origin guard must allow it through.
  expect(allowed.status()).not.toBe(403)
})
