import { expect, test, type Page } from '@playwright/test'
import { clearRateLimits, openEditorTab, setUpOwnerWithCampaign, sidebarLink } from './helpers'

/**
 * Editor safety against the real API and browser: leaving the editor never
 * silently drops a change, failures and offline edits are explained and
 * recoverable from IndexedDB, and a concurrent edit is compared and
 * resolved explicitly.
 *
 * Preconditions: `pnpm infra:up` and `pnpm dev` running locally.
 */

test.beforeEach(() => clearRateLimits())

const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

async function setUp(page: Page, label: string): Promise<{ articleUrl: string; name: string }> {
  const id = stamp()
  const name = `Blackwall ${id}`
  await setUpOwnerWithCampaign(page, `PW Safety ${label}`, `Safety ${label} ${id}`)
  await sidebarLink(page, 'World').click()
  await page.getByRole('button', { name: 'New entity' }).click()
  await page.getByRole('button', { name: 'Location', exact: true }).click()
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  const articleUrl = page.url()
  await page.getByRole('link', { name: 'Edit' }).click()
  await expect(page.getByLabel('Summary')).toBeVisible()
  return { articleUrl, name }
}

const patches = (page: Page) => {
  const seen: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'PATCH' && request.url().includes('/entities/')) {
      seen.push(request.postDataJSON()?.summary ?? '')
    }
  })
  return seen
}

test('typing then View article saves first, exactly once', async ({ page }) => {
  const { articleUrl } = await setUp(page, 'View')
  const sent = patches(page)
  await page.getByLabel('Summary').fill('Saved on the way out.')
  await page.getByRole('button', { name: 'View article' }).click()
  await expect(page).toHaveURL(articleUrl)
  await expect(page.getByText('Saved on the way out.')).toBeVisible()
  expect(sent).toEqual(['Saved on the way out.'])
})

test('typing then a sidebar link, or browser Back, saves first', async ({ page }) => {
  const { articleUrl } = await setUp(page, 'Nav')
  await page.getByLabel('Summary').fill('Saved before Sessions.')
  await sidebarLink(page, 'Sessions').click()
  await expect(page.getByRole('heading', { level: 1, name: 'Sessions' })).toBeVisible()

  // In-app Back: article → Edit (client-side), type, then Back.
  await page.goto(articleUrl)
  await expect(page.getByText('Saved before Sessions.')).toBeVisible()
  await page.getByRole('link', { name: 'Edit' }).click()
  await page.getByLabel('Summary').fill('Saved before Back.')
  await page.goBack()
  await expect(page).toHaveURL(articleUrl)
  await expect(page.getByText('Saved before Back.')).toBeVisible()
})

test('switching tabs while a save is pending never asks to leave', async ({ page }) => {
  await setUp(page, 'Tabs')
  await page.getByLabel('Summary').fill('Pending across tabs.')
  await openEditorTab(page, 'Details')
  await openEditorTab(page, 'Connections')
  await openEditorTab(page, 'Content')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByLabel('Summary')).toHaveValue('Pending across tabs.')
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10_000 })
})

test('leaving during a slow save waits for it and for the edit queued behind it', async ({ page }) => {
  const { articleUrl } = await setUp(page, 'Slow')
  await page.route('**/entities/*', async (route) => {
    if (route.request().method() === 'PATCH') await new Promise((resolve) => setTimeout(resolve, 1500))
    await route.continue()
  })
  await page.getByLabel('Summary').fill('First version.')
  await expect(page.getByText('Saving…')).toBeVisible({ timeout: 10_000 })
  await page.getByLabel('Summary').fill('Second version.')
  await page.getByRole('button', { name: 'View article' }).click()
  await expect(page).toHaveURL(articleUrl, { timeout: 15_000 })
  await expect(page.getByText('Second version.')).toBeVisible()
})

test('a failed save pauses leaving; Try again saves and continues', async ({ page }) => {
  const { articleUrl } = await setUp(page, 'Fail')
  let fail = true
  await page.route('**/entities/*', async (route) => {
    if (route.request().method() === 'PATCH' && fail) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Boom"}' })
      return
    }
    await route.continue()
  })
  await page.getByLabel('Summary').fill('Survives a failure.')
  await page.getByRole('button', { name: 'View article' }).click()
  const dialog = page.getByRole('dialog', { name: 'Your latest changes couldn’t be saved' })
  await expect(dialog).toBeVisible()
  await expect(page).toHaveURL(/\/edit\/content$/)
  await expect(dialog.getByRole('button', { name: 'Leave, keep on this device' })).toBeVisible()

  // Escape = Keep editing: nothing lost, still here.
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByLabel('Summary')).toHaveValue('Survives a failure.')

  await page.getByRole('button', { name: 'View article' }).click()
  await expect(dialog).toBeVisible()
  fail = false
  await dialog.getByRole('button', { name: 'Try again' }).click()
  await expect(page).toHaveURL(articleUrl)
  await expect(page.getByText('Survives a failure.')).toBeVisible()
})

test('offline: leave with the change kept on this device, then restore it later', async ({
  page,
  context,
}) => {
  const { articleUrl } = await setUp(page, 'Offline')
  await context.setOffline(true)
  await page.getByLabel('Summary').fill('Written on the train.')
  await expect(page.getByText('Offline — saved on this device')).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'View article' }).click()
  const dialog = page.getByRole('dialog', { name: 'You’re offline' })
  await expect(dialog).toContainText('won’t sync on their own')
  await dialog.getByRole('button', { name: 'Leave, keep on this device' }).click()
  await expect(page).toHaveURL(articleUrl)

  await context.setOffline(false)
  await page.goto(`${articleUrl}/edit/content`)
  await expect(page.getByText(/You have unsaved local changes/)).toBeVisible()
  await page.getByRole('button', { name: 'Restore' }).click()
  await expect(page.getByLabel('Summary')).toHaveValue('Written on the train.')
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10_000 })
  await page.goto(articleUrl)
  await expect(page.getByText('Written on the train.')).toBeVisible()
})

test('closing the tab with a pending change warns, and the draft is offered back', async ({
  page,
  context,
}) => {
  const { articleUrl } = await setUp(page, 'Close')
  await page.getByLabel('Summary').fill('Typed right before closing.')
  const unloadPrompt = page.waitForEvent('dialog')
  void page.close({ runBeforeUnload: true })
  const prompt = await unloadPrompt
  expect(prompt.type()).toBe('beforeunload')
  await prompt.accept()

  const again = await context.newPage()
  await again.goto(`${articleUrl}/edit/content`)
  // Either the unload-time save made it, or the draft is offered back —
  // never silently lost.
  await expect(async () => {
    const banner = await again.getByText(/You have unsaved local changes/).isVisible()
    const value = await again.getByLabel('Summary').inputValue()
    expect(banner || value === 'Typed right before closing.').toBe(true)
  }).toPass({ timeout: 10_000 })
})

test('a concurrent edit is compared and resolved explicitly', async ({ page, context }) => {
  const { articleUrl, name } = await setUp(page, 'Conflict')
  const other = await context.newPage()
  await other.goto(`${articleUrl}/edit/details`)
  await other.getByLabel('Name').fill(`${name} Keep`)
  await expect(other.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10_000 })
  await other.close()

  await page.getByLabel('Summary').fill('My summary.')
  await expect(page.getByText('Changed elsewhere', { exact: true })).toBeVisible({ timeout: 10_000 })

  // Leaving now asks for an informed choice instead of going.
  await sidebarLink(page, 'Sessions').click()
  const leave = page.getByRole('dialog', { name: 'This entry was changed elsewhere' })
  await expect(leave).toBeVisible()
  await leave.getByRole('button', { name: 'Review differences' }).click()

  const compare = page.getByRole('dialog', { name: 'Changed elsewhere' })
  const differences = compare.getByRole('list', { name: 'Differences' })
  await expect(differences.getByText(`${name} Keep`)).toBeVisible()
  await expect(differences.getByText('My summary.')).toBeVisible()

  // Keyboard: focus stays inside the dialog.
  for (let i = 0; i < 6; i += 1) await page.keyboard.press('Tab')
  expect(await compare.evaluate((el) => el.contains(document.activeElement))).toBe(true)

  await compare.getByRole('button', { name: 'Keep my changes…' }).click()
  await expect(compare.getByText('Overwrite the saved version with yours?')).toBeVisible()
  await compare.getByRole('button', { name: 'Overwrite with my version' }).click()
  await expect(compare).toHaveCount(0)
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10_000 })

  await page.goto(articleUrl)
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await expect(page.getByText('My summary.')).toBeVisible()
})

test('a concurrent edit can be accepted instead, discarding mine after confirmation', async ({
  page,
  context,
}) => {
  const { articleUrl, name } = await setUp(page, 'Accept')
  const other = await context.newPage()
  await other.goto(`${articleUrl}/edit/content`)
  await other.getByLabel('Summary').fill('Their summary.')
  await expect(other.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10_000 })
  await other.close()

  await page.getByLabel('Summary').fill('My doomed summary.')
  await expect(page.getByText('Changed elsewhere', { exact: true })).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Review differences' }).first().click()
  const compare = page.getByRole('dialog', { name: 'Changed elsewhere' })
  await compare.getByRole('button', { name: 'Load saved version' }).click()
  await compare.getByRole('button', { name: 'Discard my changes' }).click()
  await expect(page.getByLabel('Summary')).toHaveValue('Their summary.')

  // Leaving is now free: nothing unsaved.
  await page.getByRole('button', { name: 'View article' }).click()
  await expect(page).toHaveURL(articleUrl)
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await expect(page.getByText('Their summary.')).toBeVisible()
})
