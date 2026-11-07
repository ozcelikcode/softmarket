import { expect, test } from '@playwright/test'

// Read-only flows (safe against the live dev DB on 3100). DB-writing flows: tests/e2e/isolated.

test('catalog → product → "Teklif İste" opens the quote form with a submit control', async ({ page }) => {
  await page.goto('/tr/urunler')
  await page.locator('main a[href^="/tr/urunler/"]').filter({ has: page.locator('h2') }).first().click()
  await page.waitForURL(/\/tr\/urunler\/[^/]+\/[^/]+$/)
  const quote = page.locator('#surumler a[href*="surum="]').first()
  await expect(quote).toBeVisible()
  await quote.click()
  await page.waitForURL(/\/tr\/teklif-iste\?/, { timeout: 30_000 })
  await expect(page.locator('main h1')).toHaveCount(1)
  await expect(page.locator('form input[name="email"]')).toBeVisible()
  await expect(page.locator('form select[name="product"]')).toBeVisible()
  await expect(page.locator('form button[type="submit"]')).toBeVisible()
})

test('anonymous preview is refused and never sets the draft cookie', async ({ request, page }) => {
  for (const url of ['/api/preview?redirect=/tr', '/api/preview?redirect=/tr/urunler']) {
    const res = await request.get(url, { headers: { 'Sec-Fetch-Site': 'same-origin' }, maxRedirects: 0 })
    expect(res.status()).toBe(401)
    expect(res.headers()['set-cookie'] ?? '').not.toContain('__prerender_bypass')
    expect(res.headers()['cache-control']).toContain('no-store')
  }
  const cross = await request.get('/api/preview?redirect=/tr', { headers: { 'Sec-Fetch-Site': 'cross-site' }, maxRedirects: 0 })
  expect(cross.status()).toBe(403)
  const invalid = await request.get('/api/preview?redirect=//evil.example', { maxRedirects: 0 })
  expect(invalid.status()).toBe(400)
  await page.goto('/tr')
  expect((await page.context().cookies()).some((c) => c.name === '__prerender_bypass')).toBe(false)
})
