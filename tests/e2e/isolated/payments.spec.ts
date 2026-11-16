import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test'

/*
 * P5 payments e2e. Runs ONLY against the temp DB copy (playwright.isolated.config.ts, port 3400) with the loopback fake
 * iyzico (port 3500, scripts/e2e-fake-iyzico.ts); no real provider is ever contacted. Fixtures (product, buy edition,
 * clean sales texts, two verified customers) come from scripts/e2e-seed-payments.ts; the site starts in quote mode and
 * the spec flips it through the admin API (like an operator would in the panel).
 */
const BASE = 'http://127.0.0.1:3400'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const BUYER = process.env.E2E_CUSTOMER_EMAIL!
const OTHER = process.env.E2E_CUSTOMER2_EMAIL!
const CUSTOMER_PASSWORD = process.env.E2E_CUSTOMER_PASSWORD!
const SKU = 'E2E-PAY-1'
const CHECKOUT = `/tr/hesap/satin-al/${SKU}`
const PRODUCT = '/tr/urunler/e2e-aile/e2e-urun'
const TCKN = '10000000146'

test.describe.configure({ mode: 'serial' })

async function adminRequest(playwright: { request: { newContext(o: { baseURL: string }): Promise<APIRequestContext> } }) {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !BUYER || !OTHER || !CUSTOMER_PASSWORD) throw new Error('Run this test only with playwright.isolated.config.ts on port 3400.')
  const admin = await playwright.request.newContext({ baseURL: BASE })
  const res = await admin.post('/api/users/login', { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, headers: { Origin: BASE } })
  expect(res.status()).toBe(200)
  return admin
}

async function setMode(admin: APIRequestContext, mode: 'payments' | 'quote-only') {
  const current = await admin.get('/api/globals/site-settings?locale=tr&depth=0')
  expect(current.status()).toBe(200)
  const commerce = ((await current.json()) as { commerce?: Record<string, unknown> }).commerce ?? {}
  const res = await admin.post('/api/globals/site-settings?locale=tr', {
    headers: { Origin: BASE },
    data: { commerce: { ...commerce, mode, providers: { iyzico: { enabled: true } }, vat: { try: { rule: 'rate', ratePercent: 20 }, usd: { rule: 'exempt' } } } },
  })
  expect(res.status(), await res.text()).toBe(200)
}

async function login(page: Page, email: string) {
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(CUSTOMER_PASSWORD)
  await page.getByRole('button', { name: 'Giriş yap' }).click()
}

async function fillCheckout(page: Page, over: { tckn?: string } = {}) {
  await page.locator('#co-type-individual').check()
  await page.locator('#co-name').fill('Ali Veli')
  await page.locator('#co-identityNumber').fill(over.tckn ?? TCKN)
  await page.locator('#co-phone').fill('+90 532 000 00 00')
  await page.locator('#co-addressLine').fill('Atatürk Caddesi No 1')
  await page.locator('#co-city').fill('İstanbul')
  for (const id of ['#co-consentPre', '#co-consentSales', '#co-consentWaiver']) await page.locator(id).check()
}

/** Pays (or declines) on the fake hosted page and waits for the return to the order page. */
async function payOnFake(page: Page, result: 'Pay now' | 'Decline') {
  await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:3500\/pay\?token=/)
  await page.getByRole('button', { name: result }).click()
  await page.waitForURL(/\/tr\/hesap\/siparisler\/SM-\d{6}-[0-9A-Z]{6}$/, { timeout: 30_000 })
}

const orderNumber = (page: Page) => /(SM-\d{6}-[0-9A-Z]{6})$/.exec(page.url())![1]!

async function loggedInContext(browser: Browser, email: string, opts: { javaScriptEnabled?: boolean; viewport?: { width: number; height: number } } = {}): Promise<{ context: BrowserContext; page: Page }> {
  const first = await browser.newContext({ baseURL: BASE })
  const p = await first.newPage()
  await p.goto('/tr/hesap/giris')
  await login(p, email)
  await p.waitForURL(/\/tr\/hesap\/?$/)
  const state = await first.storageState()
  await first.close()
  const context = await browser.newContext({ baseURL: BASE, storageState: state, ...opts })
  return { context, page: await context.newPage() }
}

let adminCtx: APIRequestContext
let paidOrder = ''

test.beforeAll(async ({ playwright }) => { adminCtx = await adminRequest(playwright) })
test.afterAll(async () => { await adminCtx?.dispose() })

test('quote mode (default install): no price, no buy link, checkout and orders are not public', async ({ request }) => {
  const html = await (await request.get(PRODUCT)).text()
  expect(html).not.toContain('data-edition-price')
  expect(html).not.toContain('/hesap/satin-al')
  for (const path of [CHECKOUT, '/tr/hesap/siparisler', '/en/account/orders']) {
    const res = await request.get(path, { maxRedirects: 0 })
    expect([307, 308]).toContain(res.status())
    expect(res.headers().location).toMatch(/\/(tr\/hesap|en\/account)\/(giris|login)/)
  }
})

test('operator switches to payments: price and a "Satın al" link to checkout appear', async ({ request }) => {
  await setMode(adminCtx, 'payments')
  await expect.poll(async () => await (await request.get(PRODUCT)).text(), { timeout: 30_000 }).toContain('data-edition-price')
  const html = await (await request.get(PRODUCT)).text()
  expect(html).toContain('1.250,00')
  expect(html).toContain(`href="${CHECKOUT}"`)
})

test('full flow with JavaScript: product → login → checkout → hosted page → callback → paid order with license', async ({ page }) => {
  await page.goto(PRODUCT)
  // The hero "Satın al" scrolls to the editions; the edition card leads to checkout.
  await page.locator(`a[href="${CHECKOUT}"]`).first().click()
  await expect(page).toHaveURL(/\/tr\/hesap\/giris\?next=/)
  await login(page, BUYER)
  await expect(page).toHaveURL(new RegExp(`${CHECKOUT}$`))
  await expect(page.getByRole('heading', { level: 1, name: 'Satın al' })).toBeVisible()
  // Server-computed summary: 1.250,00 KDV dahil → net 1.041,67 + KDV 208,33.
  await expect(page.locator('[data-checkout-total]')).toContainText('1.250,00')
  await expect(page.getByText('1.041,67')).toBeVisible()
  await expect(page.getByText('208,33')).toBeVisible()
  // The sales texts come from the published legal pages and are keyboard-reachable regions.
  await expect(page.getByRole('region', { name: 'Ön bilgilendirme formu' })).toContainText('Reviewed preInformation text TR.')
  await expect(page.getByRole('region', { name: 'Mesafeli satış sözleşmesi' })).toContainText('Reviewed distanceSales text TR.')

  // Consent boxes by keyboard (Space on the focused checkbox).
  const box = page.locator('#co-consentPre')
  await box.focus()
  await page.keyboard.press('Space')
  await expect(box).toBeChecked()
  await fillCheckout(page)
  await page.getByRole('button', { name: 'Ödemeye geç' }).click()
  await expect(page.getByTestId('fake-amount')).toHaveText('1250.00 TRY')
  await payOnFake(page, 'Pay now')
  paidOrder = orderNumber(page)
  await expect(page.getByText('Tamamlandı').first()).toBeVisible()
  await expect(page.locator('[data-order-total]')).toContainText('1.250,00')
  await expect(page.getByRole('region', { name: 'Sözleşme kopyası, kaydırılabilir metin' })).toContainText(paidOrder)
  await expect(page.getByText(TCKN)).toHaveCount(0)
  await page.getByRole('link', { name: 'Lisansımı görüntüle' }).click()
  await expect(page).toHaveURL(/\/tr\/hesap\/lisanslar$/)
  await expect(page.locator('main').getByText('E2E Ürün').first()).toBeVisible()
  // Orders list + conditional nav item.
  await page.getByRole('link', { name: 'Siparişlerim', exact: true }).click()
  await expect(page.getByRole('link', { name: paidOrder }).first()).toBeVisible()
})

test('another customer cannot open the order (404, no existence leak)', async ({ browser }) => {
  const { context, page } = await loggedInContext(browser, OTHER)
  const res = await page.goto(`/tr/hesap/siparisler/${paidOrder}`)
  expect(res?.status()).toBe(404)
  await expect(page.getByText('Tamamlandı')).toHaveCount(0)
  await page.goto('/tr/hesap/siparisler')
  await expect(page.getByText(paidOrder)).toHaveCount(0)
  expect((await page.goto('/tr/hesap/siparisler/SM-000000-AAAAAA'))?.status()).toBe(404)
  await context.close()
})

test('without JavaScript: validation errors re-render the form; a valid POST answers 303 to the hosted page', async ({ browser }) => {
  const { context, page } = await loggedInContext(browser, BUYER, { javaScriptEnabled: false })
  await page.goto(CHECKOUT)
  await fillCheckout(page, { tckn: '12345678901' })
  await page.getByRole('button', { name: 'Ödemeye geç' }).click()
  await expect(page.locator('#co-summary')).toBeVisible()
  await expect(page.locator('#co-summary')).toHaveAttribute('role', 'alert')
  await expect(page.locator('#co-identityNumber')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('#co-name')).toHaveValue('Ali Veli')

  await page.locator('#co-identityNumber').fill(TCKN)
  for (const id of ['#co-consentPre', '#co-consentSales', '#co-consentWaiver']) await page.locator(id).check()
  const posted = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/hesap/satin-al/'))
  await page.getByRole('button', { name: 'Ödemeye geç' }).click()
  const response = await posted
  expect(response.status()).toBe(303)
  expect(response.headers().location).toMatch(/^http:\/\/127\.0\.0\.1:3500\/pay\?token=/)
  await page.getByRole('button', { name: 'Pay now' }).click()
  // The fake's auto-submit needs JS: use the visible button, like a real buyer without scripting.
  await page.getByRole('button', { name: 'Continue to the shop' }).click()
  await page.waitForURL(/\/tr\/hesap\/siparisler\/SM-\d{6}-[0-9A-Z]{6}$/, { timeout: 30_000 })
  expect(orderNumber(page)).not.toBe(paidOrder)
  await expect(page.getByText('Tamamlandı').first()).toBeVisible()
  await context.close()
})

test('a declined payment ends as a failed order with a calm message', async ({ browser }) => {
  const { context, page } = await loggedInContext(browser, BUYER)
  await page.goto(CHECKOUT)
  await fillCheckout(page)
  await page.getByRole('button', { name: 'Ödemeye geç' }).click()
  await payOnFake(page, 'Decline')
  await expect(page.getByText('Başarısız').first()).toBeVisible()
  await expect(page.getByText('Ödeme tamamlanamadı')).toBeVisible()
  await context.close()
})

test('mobile 390: checkout fits the viewport; CSP form-action allows the provider on the checkout path only', async ({ browser }) => {
  const { context, page } = await loggedInContext(browser, BUYER, { viewport: { width: 390, height: 844 } })
  const res = await page.goto(CHECKOUT)
  const csp = res!.headers()['content-security-policy-report-only'] ?? res!.headers()['content-security-policy'] ?? ''
  expect(csp).toContain("form-action 'self' https://iyzipay.com https://*.iyzipay.com https://iyzico.com https://*.iyzico.com http://127.0.0.1:3500;")
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await expect(page.getByRole('button', { name: 'Ödemeye geç' })).toBeVisible()
  const other = await page.goto('/tr/hesap/lisanslar')
  expect(other!.headers()['content-security-policy-report-only'] ?? '').toContain("form-action 'self';")
  await page.goto('/tr/hesap/siparisler')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await context.close()
})

test('back to quote mode (S3): checkout fails to quote, history stays readable, prices disappear', async ({ browser, request }) => {
  await setMode(adminCtx, 'quote-only')
  const { context, page } = await loggedInContext(browser, BUYER)
  await page.goto(CHECKOUT)
  await expect(page).toHaveURL(/\/tr\/teklif-iste\?urun=e2e-urun&surum=E2E-PAY-1/)
  await page.goto(`/tr/hesap/siparisler/${paidOrder}`)
  await expect(page.getByText('Tamamlandı').first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Siparişlerim', exact: true })).toBeVisible()
  await context.close()
  await expect.poll(async () => await (await request.get(PRODUCT)).text(), { timeout: 30_000 }).not.toContain('data-edition-price')
})
