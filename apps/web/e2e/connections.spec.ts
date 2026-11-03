import { expect, test, type Page } from '@playwright/test'
import { addRelationship, clearRateLimits, setUpOwnerWithCampaign, sidebarLink } from './helpers'

/**
 * The editor's Connections tab against the real API: adding from either
 * end (stored once, shown from both), duplicate and detail-field overlap
 * caught before sending, and removal with a server-confirmed Undo — on
 * desktop and in the phone bottom sheet.
 *
 * Preconditions: `pnpm infra:up` and `pnpm dev` running locally.
 */

test.beforeEach(() => clearRateLimits())

const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

async function createEntity(page: Page, type: string, name: string): Promise<string> {
  await sidebarLink(page, 'World').click()
  await page.getByRole('button', { name: 'New entity' }).click()
  await page.getByRole('button', { name: type, exact: true }).click()
  await page.getByRole('dialog').getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  return page.url()
}

test('add from either end, catch duplicates and detail overlaps, remove with Undo', async ({ page }) => {
  const id = stamp()
  await setUpOwnerWithCampaign(page, 'PW Connections Owner', `Connections ${id}`)
  const march = `Northern March ${id}`
  const blackwall = `Blackwall ${id}`
  const guard = `Ashen Guard ${id}`
  const mara = `Mara Voss ${id}`
  await createEntity(page, 'Location', march)
  const blackwallUrl = await createEntity(page, 'Location', blackwall)
  const guardUrl = await createEntity(page, 'Faction', guard)
  await createEntity(page, 'Character', mara)

  await test.step('Blackwall’s Parent location is set on Details', async () => {
    await page.goto(`${blackwallUrl}/edit/details`)
    await page.getByLabel('Parent location').fill(march)
    await page.locator('.wb-combobox__option', { hasText: march }).first().click()
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10_000 })
  })

  const table = page.getByRole('table', { name: `Relationships of ${blackwall}` })
  const form = page.getByRole('form', { name: 'Add a relationship' })

  await test.step('add “Contains” from the location: stored as the faction “Located in” it', async () => {
    await page.getByRole('link', { name: 'Connections' }).click()
    await expect(page.getByRole('region', { name: 'From details' }).getByText(march)).toBeVisible()
    await addRelationship(page, 'Contains', guard, { note: 'Garrison at the gatehouse', visibleTo: 'GM only' })
    const row = table.getByRole('row', { name: new RegExp(guard) })
    await expect(row).toContainText('Contains')
    await expect(row).toContainText('Garrison at the gatehouse')
    await expect(row).toContainText('GM only')

    await page.goto(guardUrl)
    const relationships = page.getByRole('list', { name: 'Relationships', exact: true })
    await expect(relationships.getByText('Located in')).toBeVisible()
    await expect(relationships.getByRole('link', { name: blackwall })).toBeVisible()
  })

  await test.step('the same fact from the faction’s end is caught as a duplicate', async () => {
    await page.goto(`${guardUrl}/edit/connections`)
    await form.getByLabel(/…$/).selectOption({ label: 'Located in' })
    await form.getByLabel('Entry').fill(blackwall)
    await page.locator('.wb-combobox__option', { hasText: blackwall }).first().click()
    await expect(form.getByRole('alert')).toContainText(`${guard} is already “located in” ${blackwall}.`)
    await expect(form.getByRole('button', { name: 'Add', exact: true })).toBeDisabled()
  })

  await test.step('a relationship the Parent location already states points to Details', async () => {
    await page.goto(`${blackwallUrl}/edit/connections`)
    await form.getByLabel(/…$/).selectOption({ label: 'Located in' })
    await form.getByLabel('Entry').fill(march)
    await page.locator('.wb-combobox__option', { hasText: march }).first().click()
    const alert = form.getByRole('alert')
    await expect(alert).toContainText(`${blackwall}’s Parent location is already ${march}`)
    await alert.getByRole('link', { name: 'Go to Details' }).click()
    await expect(page).toHaveURL(/\/edit\/details$/)
  })

  await test.step('remove, then Undo restores it with its note and visibility', async () => {
    await page.goto(`${blackwallUrl}/edit/connections`)
    const row = table.getByRole('row', { name: new RegExp(guard) })
    await row.getByRole('button', { name: `Remove: ${blackwall} contains ${guard}` }).click()
    await expect(row).toHaveCount(0)
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByText(`Restored: ${blackwall} contains ${guard}`).first()).toBeVisible()
    const restored = table.getByRole('row', { name: new RegExp(guard) })
    await expect(restored).toContainText('Garrison at the gatehouse')
    await expect(restored).toContainText('GM only')
    await page.reload()
    await expect(table.getByRole('row', { name: new RegExp(guard) })).toContainText('GM only')
  })

  await test.step('remove by keyboard: focus lands on Undo; leaving it alone, it expires', async () => {
    const remove = table.getByRole('button', { name: `Remove: ${blackwall} contains ${guard}` })
    await remove.focus()
    await page.keyboard.press('Enter')
    const undo = page.getByRole('button', { name: 'Undo' })
    await expect(undo).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(undo).toHaveCount(0)
    // Focus doesn't fall to the page body: it lands on the list's heading.
    await expect(page.getByRole('heading', { level: 2, name: /^Relationships/ })).toBeFocused()
    await page.reload()
    await expect(table.getByRole('row', { name: new RegExp(guard) })).toHaveCount(0)
  })
})

test('phones: list, bottom-sheet add above the tab bar, and Undo', async ({ page }) => {
  const id = stamp()
  await setUpOwnerWithCampaign(page, 'PW Connections Phone', `Connections Phone ${id}`)
  const blackwall = `Blackwall ${id}`
  const inn = `The Ember and Anvil ${id}`
  const blackwallUrl = await createEntity(page, 'Location', blackwall)
  await createEntity(page, 'Location', inn)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${blackwallUrl}/edit/connections`)
  await page.getByRole('button', { name: 'Add relationship' }).click()
  const sheet = page.getByRole('dialog', { name: 'Add a relationship' })
  await expect(sheet).toBeVisible()
  // Anchored to the bottom edge, full width.
  const box = (await sheet.boundingBox())!
  expect(Math.round(box.x)).toBe(0)
  expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(840)

  await sheet.getByLabel(/…$/).selectOption({ label: 'Contains' })
  await sheet.getByLabel('Entry').fill(inn)
  await page.locator('.wb-combobox__option', { hasText: inn }).first().click()
  await sheet.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(sheet).toHaveCount(0)

  const list = page.getByRole('list', { name: `Relationships of ${blackwall}` })
  await expect(list.getByRole('link', { name: inn })).toBeVisible()
  const remove = list.getByRole('button', { name: `Remove: ${blackwall} contains ${inn}` })
  const removeBox = (await remove.boundingBox())!
  expect(removeBox.width).toBeGreaterThanOrEqual(44)
  expect(removeBox.height).toBeGreaterThanOrEqual(44)
  await remove.click()

  // The Undo toast clears the bottom tab bar.
  const undo = page.getByRole('button', { name: 'Undo' })
  await expect(undo).toBeVisible()
  const tabbarTop = (await page.locator('.wb-tabbar').boundingBox())!.y
  const toastBottom = await page.locator('.wb-toast').evaluate((el) => el.getBoundingClientRect().bottom)
  expect(toastBottom).toBeLessThanOrEqual(tabbarTop)
  await undo.click()
  await expect(list.getByRole('link', { name: inn })).toBeVisible()
})
