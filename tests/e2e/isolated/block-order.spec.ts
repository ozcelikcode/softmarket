import { expect, test, type APIRequestContext } from '@playwright/test'

// Runs ONLY against the temp DB copy (playwright.isolated.config.ts, port 3400). Never the live DB.
const EMAIL = process.env.E2E_ADMIN_EMAIL
const PASSWORD = process.env.E2E_ADMIN_PASSWORD

const login = async (request: APIRequestContext, baseURL: string) => {
  if (baseURL !== 'http://127.0.0.1:3400' || !EMAIL || !PASSWORD) {
    throw new Error('Run this write test only with playwright.isolated.config.ts on port 3400.')
  }
  const res = await request.post('/api/users/login', { data: { email: EMAIL, password: PASSWORD }, headers: { Origin: baseURL } })
  expect(res.status()).toBe(200)
  expect((await res.json()).user.roles).toContain('admin')
}

const order = (html: string, a: string, b: string) => {
  // Headings can also occur in navigation or be HTML-escaped; measure actual block wrappers.
  const ia = html.indexOf(`data-block="${a}"`)
  const ib = html.indexOf(`data-block="${b}"`)
  expect(ia).toBeGreaterThan(-1)
  expect(ib).toBeGreaterThan(-1)
  return ia < ib ? 'ab' : 'ba'
}

test('publishing a new block order through the API reorders the home page; anonymous preview stays denied', async ({ playwright, baseURL }) => {
  const base = baseURL!
  const admin = await playwright.request.newContext({ baseURL: base })
  const anon = await playwright.request.newContext({ baseURL: base })
  await login(admin, base)

  const found = await admin.get('/api/pages?where[slug][equals]=home&locale=tr&depth=0&draft=true&limit=1')
  expect(found.status()).toBe(200)
  const home = (await found.json()).docs[0]
  const layout = home.layout as Array<{ id: string; blockType: string }>
  const fi = layout.findIndex((b) => b.blockType === 'productFamilies')
  const si = layout.findIndex((b) => b.blockType === 'solutionsGrid')
  expect(fi).toBeGreaterThan(-1)
  expect(si).toBeGreaterThan(-1)
  const [a, b] = [layout[fi].blockType, layout[si].blockType]

  const publish = async (blocks: typeof layout) => {
    const res = await admin.patch(`/api/pages/${home.id}?locale=tr`, { data: { layout: blocks, _status: 'published' }, headers: { Origin: base } })
    expect(res.status()).toBe(200)
  }
  const rendered = async () => order(await (await anon.get('/tr')).text(), a, b)
  const orderOf = (blocks: typeof layout) => (blocks.findIndex((x) => x.blockType === a) < blocks.findIndex((x) => x.blockType === b) ? 'ab' : 'ba')

  // The prod build prerenders from whatever the DB held at build time, which can differ from the DB copy now.
  // Publish the current order first so the page provably reflects the DB before the swap is measured.
  await publish(layout)
  await expect.poll(rendered, { timeout: 20_000 }).toBe(orderOf(layout))

  const swapped = [...layout]
  ;[swapped[fi], swapped[si]] = [swapped[si], swapped[fi]]
  expect(orderOf(swapped)).not.toBe(orderOf(layout))
  await publish(swapped)
  await expect.poll(rendered, { timeout: 20_000 }).toBe(orderOf(swapped))

  // Anonymous visitors cannot enter draft mode, with or without cookies from a staff session.
  const denied = await anon.get('/api/preview?redirect=/tr', { headers: { 'Sec-Fetch-Site': 'same-origin' }, maxRedirects: 0 })
  expect(denied.status()).toBe(401)
  expect(denied.headers()['set-cookie'] ?? '').not.toContain('__prerender_bypass')

  // Staff in the same context can (positive control), and the redirect stays a relative locale path.
  const allowed = await admin.get('/api/preview?redirect=/tr', { headers: { 'Sec-Fetch-Site': 'same-origin' }, maxRedirects: 0 })
  expect(allowed.status()).toBe(307)
  expect(allowed.headers()['location']).toBe('/tr')

  await admin.dispose()
  await anon.dispose()
})
