import { expect, test, type Page } from '@playwright/test'

// Read-only: header mega menu (server markup + lib/header-nav) and mobile sheet (native <dialog>).
// E2E_BASE_URL can point at an isolated prod build (e.g. http://127.0.0.1:3300); default = config baseURL.
if (process.env.E2E_BASE_URL) test.use({ baseURL: process.env.E2E_BASE_URL })

const nav = (page: Page) => page.locator('header nav[data-mega-nav]')
const triggers = (page: Page) => nav(page).locator('button[data-mega-trigger]')
const panelOf = async (page: Page, i: number) => page.locator(`#${await triggers(page).nth(i).getAttribute('aria-controls')}`)

test.describe('desktop mega menu', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('keyboard: Enter/Escape, arrows between items, ArrowDown into the panel, focus return', async ({ page }) => {
    await page.goto('/tr')
    const first = triggers(page).first()
    await expect(first).toHaveAttribute('aria-expanded', 'false')
    const panel = await panelOf(page, 0)
    await expect(panel).toBeHidden()

    await first.focus()
    await page.keyboard.press('Enter')
    await expect(first).toHaveAttribute('aria-expanded', 'true')
    await expect(panel).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(first).toHaveAttribute('aria-expanded', 'false')
    await expect(panel).toBeHidden()
    await expect(first).toBeFocused()

    // ArrowRight/End/Home move between top-level items without opening anything.
    const tops = nav(page).locator('[data-mega-top]')
    await page.keyboard.press('ArrowRight')
    await expect(tops.nth(1)).toBeFocused()
    await page.keyboard.press('End')
    await expect(tops.last()).toBeFocused()
    await page.keyboard.press('Home')
    await expect(first).toBeFocused()

    // ArrowDown opens and enters the panel; ArrowDown/Up move between links; Escape returns to the trigger.
    await page.keyboard.press('ArrowDown')
    await expect(first).toHaveAttribute('aria-expanded', 'true')
    const links = panel.locator('a[href]')
    await expect(links.first()).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(links.nth(1)).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(links.first()).toBeFocused()
    // Tab order follows the DOM: trigger -> panel links -> next item.
    await page.keyboard.press('Escape')
    await expect(panel).toBeHidden()
    await expect(first).toBeFocused()

    // Space toggles too; Tab into the open panel, then focus leaving the item closes it.
    await page.keyboard.press('Space')
    await expect(panel).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(links.first()).toBeFocused()
    await tops.nth(1).focus()
    await expect(panel).toBeHidden()
  })

  test('pointer: hover intent opens, leaving closes, outside click closes, one panel at a time', async ({ page }) => {
    await page.goto('/tr')
    const [a, b] = [triggers(page).nth(0), triggers(page).nth(1)]
    const [pa, pb] = [await panelOf(page, 0), await panelOf(page, 1)]
    await a.hover()
    await expect(pa).toBeVisible()
    await b.hover()
    await expect(pb).toBeVisible()
    await expect(pa).toBeHidden()
    await expect(a).toHaveAttribute('aria-expanded', 'false')
    // Moving from the trigger into its panel keeps it open.
    await pb.locator('a[href]').first().hover()
    await page.waitForTimeout(300)
    await expect(pb).toBeVisible()
    await page.mouse.move(700, 880)
    await expect(pb).toBeHidden()
    // Click toggles (as with Radix: a hover-opened panel closes on click and stays closed while hovered).
    await a.hover()
    await expect(pa).toBeVisible()
    await a.click()
    await expect(pa).toBeHidden()
    await page.waitForTimeout(200)
    await expect(pa).toBeHidden()
    await a.click()
    await expect(pa).toBeVisible()
    // Outside pointerdown closes.
    await page.mouse.click(700, 880)
    await expect(pa).toBeHidden()
  })

  test('keeps a focused panel open when the pointer leaves and rebinds after navigation', async ({ page }) => {
    await page.goto('/tr')
    const first = triggers(page).first()
    const panel = await panelOf(page, 0)
    await first.hover()
    await expect(panel).toBeVisible()
    await panel.locator('a[href]').first().focus()
    await page.mouse.move(700, 880)
    await page.waitForTimeout(250)
    await expect(panel).toBeVisible()
    await panel.locator('a[href]').first().click()
    await expect(triggers(page).first()).toBeVisible()
    await triggers(page).first().focus()
    await page.keyboard.press('Enter')
    await expect(triggers(page).first()).toHaveAttribute('aria-expanded', 'true')
  })
})

test.describe('mobile sheet', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('opens as a modal dialog, keeps focus inside, Escape closes and restores focus', async ({ page }) => {
    await page.goto('/tr')
    const button = page.locator('header button[data-sheet-open]')
    const dialog = page.locator('dialog[data-sheet]')
    await expect(button).toHaveAttribute('aria-expanded', 'false')
    await expect(dialog).toBeHidden()
    await button.focus()
    await page.keyboard.press('Enter')
    await expect(dialog).toBeVisible()
    await expect(button).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('body')).toHaveCSS('position', 'fixed')
    await expect(page.getByRole('dialog', { name: 'Menü' })).toBeVisible()
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab')
      // Modal dialog: focus never lands on page content behind it (the browser UI may take focus briefly).
      expect(await page.evaluate(() => {
        const el = document.activeElement
        return !el || el === document.body || Boolean(el.closest('dialog[data-sheet]'))
      })).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(button).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator('body')).not.toHaveCSS('position', 'fixed')
    await expect(button).toBeFocused()
    // Close button and backdrop also dismiss.
    await button.click()
    await page.locator('dialog[data-sheet] [data-sheet-close][aria-label]').last().click()
    await expect(dialog).toBeHidden()
  })
})
