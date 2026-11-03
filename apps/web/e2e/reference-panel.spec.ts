import { expect, test, type Page } from '@playwright/test'
import { addRelationship, clearRateLimits, setUpOwnerWithCampaign, sidebarLink } from './helpers'

/**
 * The Content tab's reference panel never disturbs the editor: toggling
 * keeps the same editor instance, focus, caret and selection, and sends no
 * save; its links open in a new tab; it collapses to a rail when there's no
 * room (including after the sidebar changes width) and becomes a sheet on
 * phones.
 *
 * Preconditions: `pnpm infra:up` and `pnpm dev` running locally.
 */

test.beforeEach(() => clearRateLimits())

const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

async function createLocation(page: Page, name: string): Promise<string> {
  await sidebarLink(page, 'World').click()
  await page.getByRole('button', { name: 'New entity' }).click()
  await page.getByRole('button', { name: 'Location', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  return page.url()
}

const publicEditor = (page: Page) =>
  page.locator('.wb-field', { hasText: 'Public content' }).locator('[contenteditable="true"]')

test('toggling keeps the editor, its focus and selection, and saves nothing', async ({ page, context }) => {
  const id = stamp()
  await page.setViewportSize({ width: 1440, height: 900 })
  await setUpOwnerWithCampaign(page, 'PW Reference Owner', `Reference ${id}`)
  const march = `Northern March ${id}`
  await createLocation(page, march)
  const articleUrl = await createLocation(page, `Blackwall ${id}`)
  await page.goto(`${articleUrl}/edit/connections`)
  await addRelationship(page, 'Located in', march)
  await page.getByRole('navigation', { name: 'Editor sections' }).getByRole('link', { name: 'Content' }).click()

  const reference = page.getByRole('complementary', { name: 'Reference' })
  await expect(reference.getByRole('region', { name: 'Connected to' })).toContainText(march)

  // Write, let it save, then select a word.
  const editor = publicEditor(page)
  await editor.click()
  await page.keyboard.type('The caravan never arrived')
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10_000 })
  for (let i = 0; i < 'arrived'.length; i += 1) await page.keyboard.press('Shift+ArrowLeft')
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('arrived')
  await editor.evaluate((el) => el.setAttribute('data-probe', 'same-instance'))
  const patches: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'PATCH') patches.push(request.url())
  })

  for (const name of [/Hide reference panel/, /Show reference panel/, /Hide reference panel/]) {
    await page.getByRole('button', { name }).click()
    // Same editor element, still focused, selection intact, nothing pending.
    await expect(editor).toHaveAttribute('data-probe', 'same-instance')
    expect(await editor.evaluate((el) => el.contains(document.activeElement) || el === document.activeElement)).toBe(true)
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('arrived')
    await expect(page.getByText('Saved', { exact: true })).toBeVisible()
  }
  expect(patches).toEqual([])

  // Typing continues exactly where it was: the selection is replaced.
  await page.keyboard.type('turned east')
  await expect(editor).toHaveText('The caravan never turned east')

  // Links open in a new tab; this editor stays where it is.
  await page.getByRole('button', { name: /Show reference panel/ }).click()
  const popupPromise = context.waitForEvent('page')
  await reference.getByRole('link', { name: `${march} (opens in a new tab)` }).click()
  const popup = await popupPromise
  await expect(popup.getByRole('heading', { level: 1, name: march })).toBeVisible()
  await popup.close()
  await expect(page).toHaveURL(/\/edit\/content$/)
  await expect(editor).toHaveText('The caravan never turned east')
})

test('collapses to a rail without room, follows the sidebar, and is a sheet on phones', async ({ page }) => {
  const id = stamp()
  await page.setViewportSize({ width: 1440, height: 900 })
  await setUpOwnerWithCampaign(page, 'PW Reference Layout', `Reference Layout ${id}`)
  const articleUrl = await createLocation(page, `Blackwall ${id}`)
  await page.goto(`${articleUrl}/edit/content`)
  const reference = page.getByRole('complementary', { name: 'Reference' })
  await expect(reference.getByRole('region', { name: 'Connected to' })).toBeVisible()

  // Narrower window: no room beside the editor, so it's the rail.
  await page.setViewportSize({ width: 1100, height: 900 })
  await expect(page.getByRole('button', { name: /Show reference panel/ })).toBeVisible()
  // Collapsing the sidebar frees enough width for the panel again.
  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await expect(reference.getByRole('region', { name: 'Connected to' })).toBeVisible()
  await page.getByRole('button', { name: 'Expand sidebar' }).click()
  await expect(page.getByRole('button', { name: /Show reference panel/ })).toBeVisible()

  // In the rail layout, opening overlays the panel; the editor keeps its width.
  const editor = publicEditor(page)
  const widthBefore = (await editor.boundingBox())!.width
  await page.getByRole('button', { name: /Show reference panel/ }).click()
  await expect(reference.getByRole('region', { name: 'Connected to' })).toBeVisible()
  expect((await editor.boundingBox())!.width).toBeCloseTo(widthBefore, 0)
  await page.getByRole('button', { name: 'Hide reference panel' }).click()

  // Phones: a Reference button and a sheet; the editor is untouched.
  await editor.click()
  await page.keyboard.type('Written on a phone')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: /^Reference/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Reference' })
  await expect(sheet.getByRole('region', { name: 'Connected to' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
  await expect(editor).toHaveText('Written on a phone')
})
