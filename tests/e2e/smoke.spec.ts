import { expect, test } from '@playwright/test'

test('frontend home renders and unknown routes return 404', async ({ page }) => {
  const home = await page.goto('/tr')
  expect(home?.status()).toBe(200)
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
  await expect(page.locator('main h1')).toHaveCount(1)
  for (const path of ['/tr/nonexistent-audit-route', '/tr/xyz', '/en/xyz', '/xyz']) {
    const response = await page.goto(path)
    expect(response?.status()).toBe(404)
    await expect(page.locator('main').getByText('404', { exact: true })).toBeVisible()
  }
})
