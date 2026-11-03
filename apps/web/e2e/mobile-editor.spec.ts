import { expect, test, type Page } from '@playwright/test'
import { clearRateLimits, setUpOwnerWithCampaign, sidebarLink } from './helpers'

/**
 * The entity editor on a phone. Browser emulation, not a real device: the
 * on-screen keyboard is simulated by a stand-in `visualViewport` whose
 * height shrinks (and fires `resize`) the way iOS Safari and Android Chrome
 * report a keyboard — the layout viewport stays the same size.
 *
 * Preconditions: `pnpm infra:up` and `pnpm dev` running locally.
 */

test.beforeEach(() => clearRateLimits())

const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

async function simulateKeyboard(page: Page) {
  await page.addInitScript(() => {
    let keyboard = 0
    const events = new EventTarget()
    const viewport = {
      get width() {
        return window.innerWidth
      },
      get height() {
        return window.innerHeight - keyboard
      },
      offsetTop: 0,
      offsetLeft: 0,
      pageTop: 0,
      pageLeft: 0,
      scale: 1,
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
      dispatchEvent: events.dispatchEvent.bind(events),
    }
    Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => viewport })
    ;(window as unknown as { setKeyboard: (px: number) => void }).setKeyboard = (px: number) => {
      keyboard = px
      events.dispatchEvent(new Event('resize'))
    }
  })
}

const setKeyboard = (page: Page, px: number) =>
  page.evaluate(
    (value) => (window as unknown as { setKeyboard: (px: number) => void }).setKeyboard(value),
    px,
  )

async function createEntity(page: Page, type: string, name: string): Promise<string> {
  await sidebarLink(page, 'World').click()
  await page.getByRole('button', { name: 'New entity' }).click()
  await page.getByRole('button', { name: type, exact: true }).click()
  await page.getByRole('dialog').getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  return page.url()
}

const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Public content formatting' })
const editor = (page: Page) =>
  page.locator('.wb-field', { hasText: 'Public content' }).locator('[contenteditable="true"]')

test('tabs fit a 360px phone, deep links and Back/Forward work', async ({ page }) => {
  const id = stamp()
  await setUpOwnerWithCampaign(page, 'PW Mobile Tabs', `Mobile Tabs ${id}`)
  const articleUrl = await createEntity(page, 'Location', `Blackwall ${id}`)
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto(`${articleUrl}/edit/files`)
  const tabs = page.getByRole('navigation', { name: 'Editor sections' })
  await expect(tabs.getByRole('link', { name: 'Files' })).toHaveAttribute('aria-current', 'page')
  for (const name of ['Content', 'Details', 'Connections', 'Files']) {
    const box = (await tabs.getByRole('link', { name }).boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(360)
    expect(box.height).toBeGreaterThanOrEqual(44)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  await tabs.getByRole('link', { name: 'Details' }).click()
  await tabs.getByRole('link', { name: 'Connections' }).click()
  await page.goBack()
  await expect(page).toHaveURL(/\/edit\/details$/)
  await page.goForward()
  await expect(page).toHaveURL(/\/edit\/connections$/)
})

test('compact toolbar floats above the keyboard; caret, formatting, menus and mentions stay usable', async ({
  page,
}) => {
  const id = stamp()
  await simulateKeyboard(page)
  await setUpOwnerWithCampaign(page, 'PW Mobile Editor', `Mobile Editor ${id}`)
  const oren = `Sergeant Oren Hale ${id}`
  await createEntity(page, 'Character', oren)
  const articleUrl = await createEntity(page, 'Location', `Blackwall ${id}`)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${articleUrl}/edit/content`)

  // One row of 44px controls; the rest under More.
  const bar = toolbar(page)
  for (const name of [
    'Bold',
    'Italic',
    'Heading',
    'Bullet list',
    'Link entity',
    'More formatting',
  ]) {
    const box = (await bar.getByRole('button', { name }).boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)
  }

  // Focus and "open the keyboard": the toolbar sits right on top of it.
  await editor(page).click()
  await setKeyboard(page, 300)
  await expect(bar.getByRole('button', { name: 'Hide keyboard' })).toBeVisible()
  await expect
    .poll(async () => Math.round((await bar.boundingBox())!.y + (await bar.boundingBox())!.height))
    .toBe(844 - 300)

  // Lots of text: the caret stays visible above the toolbar.
  for (let i = 0; i < 18; i += 1) {
    await page.keyboard.type(`Line ${i} of the caravan’s route`)
    await page.keyboard.press('Enter')
  }
  await page.keyboard.type('The last outrider')
  const caretBottom = await page.evaluate(
    () => window.getSelection()!.getRangeAt(0).getBoundingClientRect().bottom,
  )
  const barTop = (await bar.boundingBox())!.y
  expect(caretBottom).toBeLessThanOrEqual(barTop)

  // Formatting keeps the editor focused (the keyboard stays up).
  await page.keyboard.press('Shift+Home')
  await bar.getByRole('button', { name: 'Bold' }).click()
  await expect(bar.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true')
  expect(
    await editor(page).evaluate(
      (el) => el.contains(document.activeElement) || el === document.activeElement,
    ),
  ).toBe(true)
  await expect(editor(page).locator('strong', { hasText: 'The last outrider' })).toBeVisible()

  // More opens upwards, inside the visible area, and applies to the text.
  await page.keyboard.press('End')
  await bar.getByRole('button', { name: 'More formatting' }).click()
  const menu = page.getByRole('menu', { name: 'More formatting' })
  const menuBox = (await menu.boundingBox())!
  expect(menuBox.y).toBeGreaterThanOrEqual(0)
  expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(barTop)
  await menu.getByRole('menuitem', { name: 'Quote' }).click()
  await expect(editor(page).locator('blockquote')).toBeVisible()
  expect(
    await editor(page).evaluate(
      (el) => el.contains(document.activeElement) || el === document.activeElement,
    ),
  ).toBe(true)

  // An entity mention: the list fits in what's visible above the keyboard.
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await bar.getByRole('button', { name: 'Link entity' }).click()
  await page.keyboard.type('Oren')
  const popup = page.locator('.wb-entity-mention-popup')
  await expect(popup.locator('.wb-combobox__option', { hasText: oren })).toBeVisible({
    timeout: 10_000,
  })
  const popupBox = (await popup.boundingBox())!
  expect(popupBox.y).toBeGreaterThanOrEqual(0)
  expect(popupBox.y + popupBox.height).toBeLessThanOrEqual(844 - 300)
  expect(popupBox.x + popupBox.width).toBeLessThanOrEqual(390)
  await popup.locator('.wb-combobox__option', { hasText: oren }).click()
  await expect(editor(page).locator('.wb-entity-mention', { hasText: oren })).toBeVisible()

  // Hide keyboard: the editor lets go and the toolbar returns to its place.
  await bar.getByRole('button', { name: 'Hide keyboard' }).click()
  await setKeyboard(page, 0)
  await expect(bar.getByRole('button', { name: 'Hide keyboard' })).toHaveCount(0)
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10_000 })

  // Switching tabs and back keeps everything; returning to the article shows it.
  const tabs = page.getByRole('navigation', { name: 'Editor sections' })
  await tabs.getByRole('link', { name: 'Details' }).click()
  await tabs.getByRole('link', { name: 'Content' }).click()
  await expect(editor(page).locator('.wb-entity-mention', { hasText: oren })).toBeVisible()
  await page.getByRole('button', { name: 'View article' }).click()
  await expect(page).toHaveURL(articleUrl)
  await expect(page.getByText('The last outrider')).toBeVisible()
})

test('editing safety works at phone width: leaving saves first, a failed save pauses with choices', async ({
  page,
}) => {
  const id = stamp()
  await simulateKeyboard(page)
  await setUpOwnerWithCampaign(page, 'PW Mobile Safety', `Mobile Safety ${id}`)
  const articleUrl = await createEntity(page, 'Location', `Blackwall ${id}`)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${articleUrl}/edit/content`)

  let fail = true
  await page.route('**/entities/*', async (route) => {
    if (route.request().method() === 'PATCH' && fail) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: '{"message":"Boom"}',
      })
      return
    }
    await route.continue()
  })
  await editor(page).click()
  await setKeyboard(page, 300)
  await page.keyboard.type('Typed on the road')
  await page.getByRole('button', { name: 'View article' }).click()
  await setKeyboard(page, 0)
  const dialog = page.getByRole('dialog', { name: 'Your latest changes couldn’t be saved' })
  await expect(dialog).toBeVisible()
  const box = (await dialog.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(390)
  for (const name of ['Try again', 'Keep editing']) {
    expect(
      (await dialog.getByRole('button', { name }).boundingBox())!.height,
    ).toBeGreaterThanOrEqual(36)
  }
  fail = false
  await dialog.getByRole('button', { name: 'Try again' }).click()
  await expect(page).toHaveURL(articleUrl)
  await expect(page.getByText('Typed on the road')).toBeVisible()
})
