import { expect, test, type APIRequestContext, type BrowserContext, type FrameLocator, type Page } from '@playwright/test'

/*
 * V5 visual editor: the 8 acceptance tasks (T1–T8) as automation, plus undo/redo, hidden blocks, save-loss
 * (flush on close), conflict warning and the security checks (forged postMessage, anonymous access, public HTML
 * free of editor markers / bridge code). Runs ONLY on the isolated DB copy (playwright.isolated.config.ts, port
 * 3400). `VE_BASE_URL` may point it at another throw-away copy server for local iteration; never the live DB.
 */

const EMAIL = process.env.E2E_ADMIN_EMAIL
const PASSWORD = process.env.E2E_ADMIN_PASSWORD
const timings: Record<string, number> = {}

test.describe.configure({ mode: 'serial' })
test.setTimeout(180_000)

const guard = (baseURL: string | undefined) => {
  const ok = baseURL === 'http://127.0.0.1:3400' || (process.env.VE_BASE_URL && baseURL === process.env.VE_BASE_URL)
  if (!ok || !EMAIL || !PASSWORD) throw new Error('Run the visual editor e2e only against an isolated DB copy (playwright.isolated.config.ts).')
  return baseURL!
}

async function login(request: APIRequestContext, base: string) {
  const res = await request.post('/api/users/login', { data: { email: EMAIL, password: PASSWORD }, headers: { Origin: base } })
  expect(res.status()).toBe(200)
}

type Block = { id: string; blockType: string; heading?: string; appearance?: { hidden?: boolean }; motion?: { preset?: string; duration?: string } }
type Doc = { id: number; title: string; slug: string; layout: Block[]; family: { slug: string } | number; updatedAt: string; editorVersion?: string }

// Browsers always send Fetch Metadata; the cookie-authenticated API contexts must too (Payload csrf, F-03).
const SAME_ORIGIN = { 'Sec-Fetch-Site': 'same-origin' }
const draft = async (request: APIRequestContext, collection: string, id: number, locale = 'tr') =>
  (await (await request.get(`/api/${collection}/${id}?draft=true&depth=1&locale=${locale}&fallback-locale=null`, { headers: SAME_ORIGIN })).json()) as Doc

const canvas = (page: Page): FrameLocator => page.frameLocator('#live-preview-iframe')
const blockSel = (type: string) => `[data-block-type="${type}"]`
const canvasTypes = (page: Page) => canvas(page).locator('[data-block-id]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.blockType))

async function timed<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now()
  const out = await fn()
  timings[name] = Date.now() - start
  return out
}

async function openEditor(page: Page, path: string) {
  await page.goto(path)
  await expect(page.locator('[data-visual-editor-bar]')).toBeVisible({ timeout: 30_000 })
  await expect(canvas(page).locator('[data-block-id]').first()).toBeAttached({ timeout: 30_000 })
  // The bridge is active once the host answered.
  await expect(canvas(page).locator('html[data-canvas-ready]')).toBeAttached({ timeout: 30_000 })
  const tour = page.locator('[data-canvas-tour]')
  if (await tour.isVisible().catch(() => false)) await tour.getByRole('button').first().click()
}

async function select(page: Page, type: string) {
  await expect(canvas(page).locator('html[data-canvas-ready]')).toBeAttached({ timeout: 30_000 })
  const block = canvas(page).locator(blockSel(type)).first()
  // First click on an unselected block only selects it (links never navigate on the canvas). The site's sticky
  // header covers the top of the viewport, so aim at the middle of the block's first box.
  await block.locator(':scope > *').first().click()
  await expect(canvas(page).locator('[data-canvas-toolbar]')).toContainText(/./, { timeout: 10_000 })
}

let ctx: BrowserContext
let page: Page
let base: string
let product: Doc
let productPath: string
let publicPath: string

test.beforeAll(async ({ browser, baseURL }) => {
  base = guard(baseURL)
  ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, baseURL: base })
  await login(ctx.request, base)
  const list = await (await ctx.request.get('/api/products?draft=true&depth=1&locale=tr&limit=50&sort=id', { headers: SAME_ORIGIN })).json() as { docs: Doc[] }
  // A compatibility-mode product (no bound section stored): exercises the materialise path too.
  product = list.docs.find((d) => !d.layout?.some((b) => b.blockType.startsWith('product'))) ?? list.docs[0]!
  productPath = `/admin/collections/products/${product.id}`
  publicPath = `/tr/urunler/${(product.family as { slug: string }).slug}/${product.slug}`
  page = await ctx.newPage()
})

test.afterAll(async () => {
  console.log(`VE_TIMINGS ${JSON.stringify(timings)}`)
  await ctx?.close()
})

test('opens products in the visual editor by default with a narrow form and the first-run tour once', async () => {
  await page.evaluate(() => { try { localStorage.removeItem('sm-visual-editor-tour-v1') } catch { /* empty */ } }).catch(() => {})
  const start = Date.now()
  await page.goto(productPath)
  await expect(page.locator('[data-visual-editor-bar]')).toBeVisible({ timeout: 30_000 })
  await expect(canvas(page).locator(blockSel('productHero'))).toBeAttached({ timeout: 30_000 })
  timings.open = Date.now() - start
  const widths = await page.evaluate(() => ({
    form: document.querySelector('.collection-edit__main')!.getBoundingClientRect().width,
    preview: document.querySelector('.live-preview-window')!.getBoundingClientRect().width,
  }))
  expect(widths.form).toBeLessThanOrEqual(470)
  expect(widths.preview).toBeGreaterThan(widths.form * 1.8)
  const tour = page.locator('[data-canvas-tour]')
  await expect(tour).toBeVisible()
  for (let i = 0; i < 4; i++) await tour.locator('[data-canvas-tour-next]').click()
  await expect(tour).toBeHidden()
  await page.reload()
  await expect(canvas(page).locator('[data-block-id]').first()).toBeAttached({ timeout: 30_000 })
  await page.waitForTimeout(800)
  await expect(tour).toBeHidden()
  // One click to the classic form and back; classic is a per-visit choice, the next open is visual again.
  await page.locator('[data-ve="mode"]').click()
  await expect(page.locator('.live-preview-window--is-live-previewing')).toHaveCount(0)
  await page.locator('[data-ve="mode"]').click()
  await expect(page.locator('.live-preview-window--is-live-previewing')).toHaveCount(1)
  await page.locator('[data-ve="mode"]').click()
  await expect(page.locator('.live-preview-window--is-live-previewing')).toHaveCount(0)
  await page.waitForTimeout(2000)
  await page.reload()
  await expect(page.locator('.live-preview-window--is-live-previewing')).toHaveCount(1, { timeout: 30_000 })
})

test('T1 add a CTA block from the palette (compatibility product is materialised)', async () => {
  await openEditor(page, productPath)
  await timed('T1', async () => {
    await select(page, 'productFeatures')
    await canvas(page).locator('[data-canvas-action="add"]').click()
    const palette = page.locator('[data-canvas-palette]')
    await expect(palette).toBeVisible()
    await expect(palette.locator('[data-canvas-block="cta"] img')).toHaveAttribute('src', /\/admin\/blocks\/cta\.webp$/)
    await palette.locator('[data-canvas-block="cta"]').click()
    await expect.poll(async () => (await draft(ctx.request, 'products', product.id)).layout.filter((b) => b.blockType === 'cta').length, { timeout: 20_000 })
      .toBe(product.layout.filter((b) => b.blockType === 'cta').length + 1)
  })
  const saved = await draft(ctx.request, 'products', product.id)
  expect(saved.layout.slice(0, 1).map((b) => b.blockType)).toEqual(['productHero'])
  expect(saved.layout.filter((b) => b.blockType.startsWith('product'))).toHaveLength(8)
  await expect.poll(async () => (await canvasTypes(page)).filter((t) => t === 'cta').length, { timeout: 20_000 })
    .toBe(product.layout.filter((b) => b.blockType === 'cta').length + 1)
})

test('T2 drag Sürümler above Özellikler', async () => {
  const order = async () => (await draft(ctx.request, 'products', product.id)).layout.map((b) => b.blockType)
  await expect(canvas(page).locator(`${blockSel('productEditions')}:not([data-block-id^="virtual:"])`)).toBeAttached({ timeout: 20_000 })
  await timed('T2', async () => {
    await select(page, 'productEditions')
    const handle = canvas(page).locator('[data-canvas-action="drag"]')
    const target = canvas(page).locator(blockSel('productFeatures')).locator(':scope > *').first()
    await target.evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await page.waitForTimeout(200)
    const h = (await handle.boundingBox())!
    const t = (await target.boundingBox())!
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
    await page.mouse.down()
    await page.mouse.move(t.x + t.width / 2, t.y + 10, { steps: 8 })
    await page.mouse.up()
    await expect.poll(async () => { const o = await order(); return o.indexOf('productEditions') < o.indexOf('productFeatures') }, { timeout: 20_000 }).toBe(true)
  })
})

test('keyboard: Alt+↓ / Alt+↑ move the selected block, ↑/↓ change the selection', async () => {
  const order = async () => (await draft(ctx.request, 'products', product.id)).layout.map((b) => b.blockType)
  await select(page, 'productDownloads')
  const before = await order()
  await page.keyboard.press('Alt+ArrowDown')
  await expect.poll(async () => (await order()).indexOf('productDownloads'), { timeout: 20_000 }).toBe(before.indexOf('productDownloads') + 1)
  await page.keyboard.press('Alt+ArrowUp')
  await expect.poll(async () => (await order()).indexOf('productDownloads'), { timeout: 20_000 }).toBe(before.indexOf('productDownloads'))
  await page.keyboard.press('ArrowUp')
  await expect(canvas(page).locator('[aria-live="polite"]').first()).toContainText(/\d+\/\d+/)
  // Locked rules: the product hero cannot move or be deleted; Sürümler cannot be deleted or hidden.
  await select(page, 'productHero')
  await expect(canvas(page).locator('[data-canvas-action="up"]')).toBeDisabled()
  await expect(canvas(page).locator('[data-canvas-action="remove"]')).toBeDisabled()
  await select(page, 'productEditions')
  await expect(canvas(page).locator('[data-canvas-action="remove"]')).toBeDisabled()
  await expect(canvas(page).locator('[data-canvas-action="hide"]')).toBeDisabled()
})

test('T3 delete the CTA (two-step), then undo and redo', async () => {
  const ctas = async () => (await draft(ctx.request, 'products', product.id)).layout.filter((b) => b.blockType === 'cta').length
  const start = await ctas()
  await timed('T3', async () => {
    await select(page, 'cta')
    await canvas(page).locator('[data-canvas-action="remove"]').click()
    await canvas(page).locator('[data-canvas-action="remove"]').click()
    await expect.poll(ctas, { timeout: 20_000 }).toBe(start - 1)
  })
  await page.waitForTimeout(1500) // history settles after Payload's form-state round trip
  await page.locator('[data-ve="undo"]').click()
  await expect.poll(ctas, { timeout: 20_000 }).toBe(start)
  await page.waitForTimeout(1500)
  await page.locator('[data-ve="redo"]').click()
  await expect.poll(ctas, { timeout: 20_000 }).toBe(start - 1)
})

test('hidden blocks stay on the canvas, faded with a badge, and can be shown again (never public)', async () => {
  const hidden = async () => (await draft(ctx.request, 'products', product.id)).layout.find((b) => b.blockType === 'productDocs')?.appearance?.hidden
  await select(page, 'productDocs')
  await canvas(page).locator('[data-canvas-action="hide"]').click()
  await expect.poll(hidden, { timeout: 20_000 }).toBe(true)
  await expect(canvas(page).locator(`${blockSel('productDocs')}[data-block-hidden]`)).toBeAttached({ timeout: 20_000 })
  await canvas(page).locator(blockSel('productDocs')).scrollIntoViewIfNeeded()
  await expect(canvas(page).locator('[data-canvas-hidden-badge]').first()).toBeVisible()
  await select(page, 'productDocs')
  await expect(canvas(page).locator('[data-canvas-action="hide"]')).toHaveAttribute('aria-pressed', 'true')
  await canvas(page).locator('[data-canvas-action="hide"]').click()
  await expect.poll(hidden, { timeout: 20_000 }).toBe(false)
})

test('T4 edit the product title in place (plain text, Enter keeps it)', async () => {
  const title = `${product.title} Pro`
  await timed('T4', async () => {
    await select(page, 'productHero')
    const h1 = canvas(page).locator(`${blockSel('productHero')} [data-doc-field="title"]`)
    await h1.click()
    await expect(h1).toHaveAttribute('contenteditable', /plaintext-only|true/)
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type(title, { delay: 20 })
    await page.keyboard.press('Enter')
    await expect(page.locator('#field-title')).toHaveValue(title)
    await expect.poll(async () => (await draft(ctx.request, 'products', product.id)).title, { timeout: 20_000 }).toBe(title)
  })
  // Paste is plain text only (no markup reaches the field).
  await select(page, 'productHero')
  const h1 = canvas(page).locator(`${blockSel('productHero')} [data-doc-field="title"]`)
  await h1.click()
  await h1.evaluate((el) => {
    const data = new DataTransfer()
    data.setData('text/html', '<img src=x onerror=alert(1)><b>Kalın</b>')
    data.setData('text/plain', ' X')
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  })
  await expect(h1.locator('img, b')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.locator('#field-title')).toHaveValue(title)
})

test('T5 give a block "Sola kayma" + slow duration (form panel opens the block\'s Hareket group)', async () => {
  const motion = async () => (await draft(ctx.request, 'products', product.id)).layout.find((b) => b.blockType === 'productDownloads')?.motion
  await timed('T5', async () => {
    await select(page, 'productDownloads')
    const index = (await draft(ctx.request, 'products', product.id)).layout.findIndex((b) => b.blockType === 'productDownloads')
    const row = page.locator(`#layout-row-${index}`)
    const radio = row.locator('input[type="radio"][value="slide-left"]')
    await expect(radio).toBeVisible({ timeout: 10_000 })
    await radio.check({ force: true })
    const duration = row.locator('[id$="motion__duration"]').first()
    await expect(duration).toBeVisible({ timeout: 10_000 })
    await duration.click()
    await page.locator('.rs__option', { hasText: /800 ms/ }).first().click()
    await expect.poll(motion, { timeout: 20_000 }).toMatchObject({ preset: 'slide-left', duration: 'slow' })
  })
})

test('T6 switch to EN and translate the title; TR stays unchanged and no TR text leaks into EN', async () => {
  const trTitle = (await draft(ctx.request, 'products', product.id, 'tr')).title
  const enBefore = await draft(ctx.request, 'products', product.id, 'en')
  await timed('T6', async () => {
    await page.locator('[data-ve="locale-en"]').click()
    await expect(page).toHaveURL(/locale=en/)
    await expect(canvas(page).locator('html[lang="en"]')).toBeAttached({ timeout: 30_000 })
    await expect(canvas(page).locator(blockSel('productHero'))).toBeAttached({ timeout: 30_000 })
    await select(page, 'productHero')
    const h1 = canvas(page).locator(`${blockSel('productHero')} [data-doc-field="title"]`)
    await h1.click()
    await expect(h1).toHaveAttribute('contenteditable', /plaintext-only|true/)
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('Report Studio EN', { delay: 20 })
    await page.keyboard.press('Enter')
    await expect.poll(async () => (await draft(ctx.request, 'products', product.id, 'en')).title, { timeout: 20_000 }).toBe('Report Studio EN')
  })
  expect((await draft(ctx.request, 'products', product.id, 'tr')).title).toBe(trTitle)
  const enAfter = await draft(ctx.request, 'products', product.id, 'en') as unknown as Record<string, unknown>
  // Empty EN fields stay empty (no fallback written).
  for (const key of ['tagline', 'summary'] as const) {
    if (!(enBefore as unknown as Record<string, unknown>)[key]) expect(enAfter[key], key).toBeFalsy()
  }
  await page.locator('[data-ve="locale-tr"]').click()
  await expect(canvas(page).locator('html[lang="tr"]')).toBeAttached({ timeout: 30_000 })
})

test('Escape on an empty translation does not save the fallback', async () => {
  for (const [locale, tagline] of [['tr', 'Türkçe yedek'], ['en', '']] as const) {
    const res = await ctx.request.patch(`/api/products/${product.id}?locale=${locale}&draft=true`, {
      data: { tagline }, headers: { Origin: base },
    })
    expect(res.ok()).toBe(true)
  }
  await openEditor(page, `${productPath}?locale=en`)
  await select(page, 'productHero')
  const field = canvas(page).locator(`${blockSel('productHero')} [data-doc-field="tagline"]`)
  await expect(field).toContainText('Türkçe yedek')
  await field.click()
  await expect(field).toHaveAttribute('contenteditable', /plaintext-only|true/)
  await page.keyboard.type(' edited')
  await page.keyboard.press('Escape')
  await expect(page.locator('#field-tagline')).toHaveValue('')
  await expect.poll(async () => (await draft(ctx.request, 'products', product.id, 'en') as unknown as { tagline?: string }).tagline || '', { timeout: 20_000 }).toBe('')
  await page.locator('[data-ve="locale-tr"]').click()
  await expect(canvas(page).locator('html[lang="tr"]')).toBeAttached({ timeout: 30_000 })
})

test('a failed draft save prevents switching locale', async () => {
  await page.route('**/api/products/**?*', async (route) => {
    if (route.request().method() === 'PATCH') await route.fulfill({ status: 500, body: '{}' })
    else await route.continue()
  })
  const title = page.locator('#field-title')
  const previous = await title.inputValue()
  await title.fill(`${previous} unsaved`)
  await page.locator('[data-ve="locale-en"]').click()
  await expect(page.locator('[role="alert"]').filter({ hasText: /kaydedilemedi|could not be saved/i })).toBeVisible()
  await expect(page).not.toHaveURL(/locale=en/)
  await title.fill(previous)
  await page.unroute('**/api/products/**?*')
})

test('T7 preview at 390 and 1440', async () => {
  await timed('T7', async () => {
    await page.locator('[data-ve="device-mobile"]').click()
    await expect.poll(() => page.locator('#live-preview-iframe').evaluate((f) => (f as HTMLIFrameElement).contentWindow!.innerWidth)).toBe(390)
    await page.locator('[data-ve="device-desktop"]').click()
    await expect.poll(() => page.locator('#live-preview-iframe').evaluate((f) => (f as HTMLIFrameElement).contentWindow!.innerWidth)).toBe(1440)
  })
  await page.locator('[data-ve="device-responsive"]').click()
})

test('T8 publish; the public page shows the new title and order and carries no editor markup', async () => {
  const anon = await ctx.browser()!.newContext({ baseURL: base })
  await timed('T8', async () => {
    await page.locator('#action-save').click()
    await expect.poll(async () => {
      const html = await (await anon.request.get(publicPath)).text()
      return html.includes(`${product.title} Pro`) && html.indexOf('id="surumler"') < html.indexOf('id="ozellikler"')
    }, { timeout: 30_000 }).toBe(true)
  })
  const html = await (await anon.request.get(publicPath)).text()
  expect(html).not.toMatch(/data-(block-id|block-hidden|field-path|doc-field|canvas)/)
  expect(html).not.toContain('sm-canvas')
  await anon.close()
})

test('pages: home opens in the editor; hero heading edits in place and saves to the form', async () => {
  const home = (await (await ctx.request.get('/api/pages?where[slug][equals]=home&draft=true&depth=0&locale=tr&limit=1', { headers: SAME_ORIGIN })).json()).docs[0] as Doc
  await openEditor(page, `/admin/collections/pages/${home.id}`)
  await select(page, 'hero')
  const heading = canvas(page).locator(`${blockSel('hero')} [data-field-path="heading"]`).first()
  await heading.click()
  await expect(heading).toHaveAttribute('contenteditable', /plaintext-only|true/)
  await page.keyboard.press('End')
  await page.keyboard.type(' ✓')
  await page.keyboard.press('Enter')
  const index = home.layout.findIndex((b) => b.blockType === 'hero')
  await expect.poll(async () => (await draft(ctx.request, 'pages', home.id)).layout[index]?.heading, { timeout: 20_000 }).toBe(`${home.layout[index]!.heading} ✓`)
})

test('closing the tab right after typing does not lose the edit (flush on pagehide)', async () => {
  const flushPage = await ctx.newPage()
  await openEditor(flushPage, productPath)
  await select(flushPage, 'productHero')
  const h1 = canvas(flushPage).locator(`${blockSel('productHero')} [data-doc-field="title"]`)
  await h1.click()
  await expect(h1).toHaveAttribute('contenteditable', /plaintext-only|true/)
  await flushPage.keyboard.press('End')
  await flushPage.keyboard.type(' Kayıp yok')
  await flushPage.waitForTimeout(300) // well inside Payload's 2 s autosave debounce
  await flushPage.close({ runBeforeUnload: true })
  await expect.poll(async () => (await draft(ctx.request, 'products', product.id)).title, { timeout: 15_000 }).toMatch(/Kayıp yok$/)
})

test('a write from elsewhere (MCP/another tab) shows the reload warning', async () => {
  await openEditor(page, productPath)
  const other = await ctx.browser()!.newContext({ baseURL: base })
  await login(other.request, base)
  const res = await other.request.patch(`/api/products/${product.id}?locale=tr&draft=true`, { data: { tagline: `Dış yazım ${Date.now()}` }, headers: { Origin: base } })
  expect(res.status()).toBe(200)
  await other.close()
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.locator('[data-ve="conflict"]')).toBeVisible({ timeout: 15_000 })
})

test('P1: an editor save based on a stale version is rejected (409); the other write survives, local text stays, merge saves both', async () => {
  await openEditor(page, productPath)
  // The admin form carries the version it was loaded at.
  const loaded = await draft(ctx.request, 'products', product.id)
  expect(loaded.editorVersion).toMatch(/^[a-f0-9]{64}$/)
  // A write elsewhere (MCP / script / another tab): no version -> accepted.
  const outside = `MCP özeti ${Date.now()}`
  const other = await ctx.browser()!.newContext({ baseURL: base })
  await login(other.request, base)
  expect((await other.request.patch(`/api/products/${product.id}?locale=tr&draft=true`, { data: { summary: outside }, headers: { Origin: base } })).status()).toBe(200)
  // Replaying the editor's own request with the stale version is refused by the server.
  const stale = await other.request.patch(`/api/products/${product.id}?locale=tr&draft=true&autosave=true`, { data: { summary: 'stale', editorVersion: loaded.editorVersion }, headers: { Origin: base } })
  expect(stale.status()).toBe(409)
  await other.close()
  // The editor (not reloaded) edits the title: its autosave is rejected, nothing is overwritten.
  const rejected = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().includes(`/api/products/${product.id}`) && r.status() === 409, { timeout: 20_000 })
  await select(page, 'productHero')
  const h1 = canvas(page).locator(`${blockSel('productHero')} [data-doc-field="title"]`)
  await h1.click()
  await expect(h1).toHaveAttribute('contenteditable', /plaintext-only|true/)
  await page.keyboard.press('End')
  await page.keyboard.type(' Yerel')
  await page.keyboard.press('Enter')
  await rejected
  await expect(page.locator('[data-ve="conflict"]')).toBeVisible({ timeout: 15_000 })
  const server = await draft(ctx.request, 'products', product.id)
  expect((server as unknown as { summary: string }).summary).toBe(outside)
  expect(server.title).not.toMatch(/ Yerel$/)
  await expect(page.locator('#field-title')).toHaveValue(/ Yerel$/)
  // Copy keeps the local change available verbatim.
  await page.locator('[data-ve="copy"]').click()
  await expect(page.locator('[data-ve="copy-text"]')).toHaveValue(/ Yerel/)
  // Merge: local title + outside summary, saved at the new version.
  await page.locator('[data-ve="merge"]').click()
  await expect(page.locator('[data-ve="conflict"]')).toBeHidden({ timeout: 15_000 })
  await expect.poll(async () => {
    const d = await draft(ctx.request, 'products', product.id) as unknown as { title: string; summary: string }
    return [/ Yerel$/.test(d.title), d.summary === outside]
  }, { timeout: 20_000 }).toEqual([true, true])
  // Later edits keep saving normally (the form follows the new version).
  await select(page, 'productHero')
  await h1.click()
  await expect(h1).toHaveAttribute('contenteditable', /plaintext-only|true/)
  // (A long title wraps: End would only reach the end of the visual line, so retype the whole value.)
  const merged = await page.locator('#field-title').inputValue()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type(`${merged}!`)
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await draft(ctx.request, 'products', product.id)).title, { timeout: 20_000 }).toMatch(/ Yerel!$/)
  await expect(page.locator('[data-ve="conflict"]')).toBeHidden()
})

test('security: forged postMessages are ignored on both sides', async () => {
  await openEditor(page, productPath)
  const count = async () => (await draft(ctx.request, 'products', product.id)).layout.length
  const before = await count()
  const target = (await draft(ctx.request, 'products', product.id)).layout.at(-1)!.id
  const forged = { ns: 'sm-canvas', v: 2, type: 'remove', id: target }
  // 1) The admin window posting to itself (source is not the iframe).
  await page.evaluate((m) => window.postMessage(m, window.location.origin), forged)
  // 2) A same-origin popup posting to its opener.
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => window.open('/tr', 'forged'))])
  await popup.waitForLoadState()
  await popup.evaluate((m) => window.opener.postMessage(m, window.location.origin), forged)
  await popup.close()
  // 3) A sibling same-origin iframe in the admin.
  await page.evaluate(() => new Promise<void>((resolve) => {
    const f = document.createElement('iframe')
    f.src = '/tr'
    f.onload = () => resolve()
    document.body.appendChild(f)
  }))
  await page.evaluate((m) => ((document.querySelectorAll("iframe")[1] as HTMLIFrameElement).contentWindow as unknown as { eval: (code: string) => void }).eval(`parent.postMessage(${JSON.stringify(m)}, location.origin)`), forged)
  // 4) The real iframe with an unknown type / extra keys.
  await page.locator('#live-preview-iframe').evaluate((f, m) => {
    const w = (f as HTMLIFrameElement).contentWindow!
    w.parent.postMessage({ ...m, type: 'exec' }, w.location.origin)
    w.parent.postMessage({ ...m, extra: 1 }, w.location.origin)
  }, forged)
  await page.waitForTimeout(3500)
  expect(await count()).toBe(before)
  // 5) Bridge side: a message to the iframe that does not come from its parent is ignored.
  await page.locator('#live-preview-iframe').evaluate((f) => {
    const w = (f as HTMLIFrameElement).contentWindow!
    w.postMessage({ ns: 'sm-canvas', v: 2, type: 'notice', message: 'FORGED' }, w.location.origin)
  })
  await page.waitForTimeout(500)
  await expect(canvas(page).getByText('FORGED')).toHaveCount(0)
  // Positive control: the real bridge still works.
  await select(page, 'productDownloads')
  await expect(canvas(page).locator('[data-canvas-toolbar]')).toBeVisible()
})

test('security: anonymous visitors get no editor, no preview and no bridge code', async ({ browser }) => {
  const anon = await browser.newContext({ baseURL: base })
  const p = await anon.newPage()
  const scripts: string[] = []
  p.on('response', async (r) => { if (r.request().resourceType() === 'script') scripts.push(await r.text().catch(() => '')) })
  for (const path of ['/tr', publicPath, '/en']) {
    const res = await p.goto(path)
    expect(res!.status()).toBe(200)
    const html = await p.content()
    expect(html).not.toMatch(/data-(block-id|block-hidden|field-path|doc-field|canvas)/)
    expect(await p.locator('[data-canvas-ui]').count()).toBe(0)
  }
  // Bridge/host code (toolbar, protocol vocabulary) is never downloaded; the shared layout chunk only knows the
  // lazy import and the refresh-deferral event name.
  expect(scripts.length).toBeGreaterThan(3)
  expect(scripts.filter((s) => /data-canvas-toolbar|textBegin|data-canvas-ready|visual-editor-bar/.test(s))).toEqual([])
  const preview = await anon.request.get(`/api/preview?redirect=${encodeURIComponent(publicPath)}`, { headers: { 'Sec-Fetch-Site': 'same-origin' }, maxRedirects: 0 })
  expect(preview.status()).toBe(401)
  await p.goto(productPath)
  await expect(p).toHaveURL(/\/admin\/login/)
  await expect(p.locator('[data-visual-editor-bar]')).toHaveCount(0)
  await anon.close()
})
