import { expect, test, type Page } from '@playwright/test'
import {
  addRelationship,
  clearRateLimits,
  findEmailLink,
  login,
  openEditorTab,
  registerAndVerify,
  setUpOwnerWithCampaign,
  sidebarLink,
} from './helpers'

/**
 * The tabbed entity editor (Design D, Stage 2 foundation) against the real
 * API: URLs and history, state surviving tab switches while a save is
 * pending, persistence, the reused relationship and file managers, player
 * access, keyboard use and the phone layout.
 *
 * Preconditions: `pnpm infra:up` and `pnpm dev` running locally.
 */

test.beforeEach(() => clearRateLimits())

const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

async function createLocation(page: Page, name: string): Promise<string> {
  await sidebarLink(page, 'World').click()
  await page.getByRole('button', { name: 'New entity' }).click()
  await page.getByRole('button', { name: 'Location', exact: true }).click()
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  return page.url()
}

const editorTab = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Editor sections' }).getByRole('link', { name })

test('tabs keep pending edits, save once, persist, and follow browser history', async ({ page }) => {
  const id = stamp()
  await setUpOwnerWithCampaign(page, 'PW Editor Owner', `Editor ${id}`)
  const articleUrl = await createLocation(page, `Blackwall ${id}`)

  await test.step('old and unknown edit URLs land on Content', async () => {
    await page.goto(`${articleUrl}/edit`)
    await expect(page).toHaveURL(/\/edit\/content$/)
    await expect(editorTab(page, 'Content')).toHaveAttribute('aria-current', 'page')
    await page.goto(`${articleUrl}/edit/not-a-tab`)
    await expect(page).toHaveURL(/\/edit\/content$/)
  })

  await test.step('edits on both tabs survive switching while a save is pending', async () => {
    const updates: string[] = []
    page.on('request', (request) => {
      if (request.method() === 'PATCH' && request.url().includes('/entities/')) updates.push(request.url())
    })
    await page.getByLabel('Summary').fill('Frontier town on the Northern Wall.')
    await expect(page.getByText('Waiting to save…')).toBeVisible()
    await openEditorTab(page, 'Details')
    await page.getByLabel('Population').fill('2400')
    await page.getByLabel('Government').fill('Ducal holding')
    await openEditorTab(page, 'Content')
    await expect(page.getByLabel('Summary')).toHaveValue('Frontier town on the Northern Wall.')
    await page
      .locator('.wb-field', { hasText: 'Public content' })
      .locator('[contenteditable="true"]')
      .fill('Raised in 1104 AR as a supply post.')
    await openEditorTab(page, 'Details')
    await expect(page.getByLabel('Population')).toHaveValue('2400')
    await openEditorTab(page, 'Content')
    // The rich-text document wasn't reset by the round trip.
    await expect(page.locator('.wb-field', { hasText: 'Public content' })).toContainText(
      'Raised in 1104 AR as a supply post.',
    )
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10_000 })
    // One debounced save carried every change (no per-tab saves).
    expect(updates.length).toBeLessThanOrEqual(2)
  })

  await test.step('Back and Forward move between tabs without losing anything', async () => {
    await page.goBack()
    await expect(editorTab(page, 'Details')).toHaveAttribute('aria-current', 'page')
    await expect(page.getByLabel('Population')).toHaveValue('2400')
    await page.goForward()
    await expect(editorTab(page, 'Content')).toHaveAttribute('aria-current', 'page')
  })

  await test.step('a reload of a tab URL shows the saved values', async () => {
    await page.goto(`${articleUrl}/edit/details`)
    await expect(page.getByLabel('Government')).toHaveValue('Ducal holding')
    await openEditorTab(page, 'Content')
    await expect(page.getByLabel('Summary')).toHaveValue('Frontier town on the Northern Wall.')
  })

  await test.step('View article saves and returns to the article', async () => {
    await page.getByLabel('Summary').fill('A walled frontier town.')
    await page.getByRole('button', { name: 'View article' }).click()
    await expect(page).toHaveURL(articleUrl)
    await expect(page.getByText('A walled frontier town.')).toBeVisible()
    await expect(page.getByLabel('Key facts').getByText('Ducal holding')).toBeVisible()
  })
})

test('Connections and Files tabs manage relationships and files', async ({ page }) => {
  const id = stamp()
  await setUpOwnerWithCampaign(page, 'PW Editor Tabs Owner', `Editor Tabs ${id}`)
  const marchName = `Northern March ${id}`
  await createLocation(page, marchName)
  const articleUrl = await createLocation(page, `Blackwall ${id}`)

  await page.goto(`${articleUrl}/edit/connections`)
  await addRelationship(page, 'Located in', marchName)
  await expect(page.getByRole('table').getByRole('link', { name: marchName })).toBeVisible()

  await openEditorTab(page, 'Files')
  await expect(page.getByRole('heading', { name: 'Attachments' })).toBeVisible()
  await expect(page.getByText('Upload a new attachment')).toBeVisible()

  await page.goto(articleUrl)
  await expect(
    page.getByRole('list', { name: 'Relationships', exact: true }).getByRole('link', { name: marchName }),
  ).toBeVisible()
})

test('keyboard users can reach and switch the editor tabs', async ({ page, browserName }) => {
  const id = stamp()
  await setUpOwnerWithCampaign(page, 'PW Editor Keys Owner', `Editor Keys ${id}`)
  const articleUrl = await createLocation(page, `Blackwall ${id}`)
  await page.goto(`${articleUrl}/edit/content`)
  if (browserName === 'webkit') {
    // WebKit (like Safari's default setting) doesn't move Tab focus
    // between links at all, on any page — so check what does apply there:
    // the tabs stay focusable (no tabindex=-1) and Enter activates them.
    await expect(editorTab(page, 'Details')).not.toHaveAttribute('tabindex', '-1')
    await editorTab(page, 'Details').focus()
  } else {
    await editorTab(page, 'Content').focus()
    await page.keyboard.press('Tab')
  }
  await expect(editorTab(page, 'Details')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/edit\/details$/)
  await expect(page.getByLabel('Name')).toBeVisible()
})

test('players get no editor', async ({ browser }) => {
  const id = stamp()
  const campaignName = `Editor Player ${id}`
  const playerEmail = `pw-editor-player-${id}@verify.local`
  const ownerContext = await browser.newContext()
  const ownerPage = await ownerContext.newPage()
  const playerContext = await browser.newContext()
  const playerPage = await playerContext.newPage()

  await setUpOwnerWithCampaign(ownerPage, 'PW Editor Player Owner', campaignName)
  const articleUrl = await createLocation(ownerPage, `Blackwall ${id}`)
  await registerAndVerify(playerPage, playerEmail, 'PW Editor Player')
  await login(playerPage, playerEmail)
  await ownerPage.goto(articleUrl.replace(/\/world\/.+$/, '/members'))
  await ownerPage.getByLabel('Email').fill(playerEmail)
  await ownerPage.getByLabel('Role', { exact: true }).selectOption('player')
  await ownerPage.getByRole('button', { name: 'Send invitation' }).click()
  await playerPage.goto(await findEmailLink(playerEmail, campaignName))
  await playerPage.getByRole('button', { name: 'Accept invitation' }).click()
  await expect(playerPage).toHaveURL(/\/app\/campaign\//)

  await playerPage.goto(`${articleUrl}/edit/details`)
  await expect(playerPage.getByText('You don’t have permission to edit this entry.')).toBeVisible()
  await expect(playerPage.getByLabel('Name')).toHaveCount(0)
  await expect(playerPage.getByRole('navigation', { name: 'Editor sections' })).toHaveCount(0)

  await ownerContext.close()
  await playerContext.close()
})

test.describe('phone width', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the editor fits a phone with reachable tabs', async ({ page }) => {
    const id = stamp()
    await setUpOwnerWithCampaign(page, 'PW Editor Phone Owner', `Editor Phone ${id}`)
    await page.getByRole('navigation', { name: 'Campaign sections' }).getByRole('link', { name: 'World' }).click()
    await page.getByRole('button', { name: 'New entity' }).click()
    await page.getByLabel('Name').fill(`Mara ${id}`)
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await page.getByRole('link', { name: 'Edit' }).click()
    await expect(page).toHaveURL(/\/edit\/content$/)
    for (const name of ['Content', 'Details', 'Connections', 'Files']) {
      const box = (await editorTab(page, name).boundingBox())!
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.x + box.width).toBeLessThanOrEqual(390)
    }
    await openEditorTab(page, 'Details')
    await expect(page.getByLabel('Occupation')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })
})
