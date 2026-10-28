import { expect, test, type Page } from '@playwright/test'
import {
  clearRateLimits,
  findEmailLink,
  login,
  registerAndVerify,
  setUpOwnerWithCampaign,
  sidebarLink,
} from './helpers'

/**
 * The entity article page (Entity Detail D, Stage 1) against the real API:
 * facts and derived connections from metadata, GM-only notes, and — most
 * importantly — that a player sees none of the GM-only material, including
 * a GM-only location referenced from a public character's metadata.
 *
 * Preconditions: `pnpm infra:up` and `pnpm dev` running locally.
 */

test.beforeEach(() => clearRateLimits())

const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

async function quickCreate(page: Page, type: 'Character' | 'Location', name: string) {
  await sidebarLink(page, 'World').click()
  await page.getByRole('button', { name: 'New entity' }).click()
  await page.getByRole('button', { name: type, exact: true }).click()
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  return page.url()
}

test('GM sees facts, derived connections and GM notes; a player sees none of the GM-only material', async ({
  browser,
}) => {
  const id = stamp()
  const campaignName = `Entity Article ${id}`
  const vaultName = `Hidden Vault ${id}`
  const maraName = `Mara Voss ${id}`
  const secret = `SecretArrangement${id}`
  const playerEmail = `pw-entity-player-${id}@verify.local`

  const ownerContext = await browser.newContext()
  const ownerPage = await ownerContext.newPage()
  const playerContext = await browser.newContext()
  const playerPage = await playerContext.newPage()
  await setUpOwnerWithCampaign(ownerPage, 'PW Entity Owner', campaignName)

  let vaultUrl = ''
  let maraUrl = ''

  await test.step('owner creates a GM-only location', async () => {
    vaultUrl = await quickCreate(ownerPage, 'Location', vaultName)
    await ownerPage.getByRole('link', { name: 'Edit' }).click()
    await ownerPage.getByLabel('Visibility').selectOption('gm_only')
    await expect(ownerPage.getByText('Saved')).toBeVisible({ timeout: 10_000 })
  })

  await test.step('owner writes a public character whose current location is the vault', async () => {
    maraUrl = await quickCreate(ownerPage, 'Character', maraName)
    await ownerPage.getByRole('link', { name: 'Edit' }).click()
    await ownerPage.getByLabel('Occupation').fill('Garrison captain')
    await ownerPage.getByLabel('Current location').fill(vaultName)
    await ownerPage.locator('.wb-combobox__option', { hasText: vaultName }).first().click()
    await ownerPage
      .locator('.wb-field', { hasText: 'Public content' })
      .locator('[contenteditable="true"]')
      .fill('Commands the Blackwall garrison.')
    await ownerPage
      .locator('.wb-field', { hasText: 'GM-only content' })
      .locator('[contenteditable="true"]')
      .fill(`Keeps a ${secret} with the smugglers.`)
    await expect(ownerPage.getByText('Saved')).toBeVisible({ timeout: 10_000 })
  })

  await test.step('the owner’s article shows facts, the derived connection and GM notes', async () => {
    await ownerPage.goto(maraUrl)
    const facts = ownerPage.getByLabel('Key facts')
    await expect(facts.getByText('Garrison captain')).toBeVisible()
    await expect(facts.getByRole('link', { name: vaultName })).toBeVisible()
    const derived = ownerPage.getByRole('list', { name: 'Connections from details' })
    await expect(derived.getByText('Currently in')).toBeVisible()
    await expect(derived.getByRole('link', { name: vaultName })).toBeVisible()
    await expect(derived.getByText('GM only')).toBeVisible()
    await expect(ownerPage.getByText('Commands the Blackwall garrison.')).toBeVisible()
    const gm = ownerPage.getByRole('region', { name: 'GM-only notes' })
    await expect(gm.getByText(new RegExp(secret))).toBeVisible()
    // Breadcrumbs are their own landmark, separate from the sidebar's World link.
    const crumbs = ownerPage.getByRole('navigation', { name: 'Breadcrumb' })
    await expect(crumbs.getByRole('link', { name: 'Characters' })).toHaveAttribute(
      'href',
      /\/world\?type=character$/,
    )
  })

  await test.step('favorite persists and Edit opens the existing editor', async () => {
    await ownerPage.getByRole('button', { name: 'Add to favorites' }).click()
    await expect(ownerPage.getByRole('button', { name: 'Remove from favorites' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await ownerPage.reload()
    await expect(ownerPage.getByRole('button', { name: 'Remove from favorites' })).toBeVisible()
    await ownerPage.getByRole('link', { name: 'Edit' }).click()
    await expect(ownerPage).toHaveURL(/\/edit$/)
    await expect(ownerPage.getByLabel('Occupation')).toHaveValue('Garrison captain')
  })

  await test.step('a player joins', async () => {
    await registerAndVerify(playerPage, playerEmail, 'PW Entity Player')
    await login(playerPage, playerEmail)
    await ownerPage.goto(maraUrl.replace(/\/world\/.+$/, '/members'))
    await ownerPage.getByLabel('Email').fill(playerEmail)
    await ownerPage.getByLabel('Role', { exact: true }).selectOption('player')
    await ownerPage.getByRole('button', { name: 'Send invitation' }).click()
    await playerPage.goto(await findEmailLink(playerEmail, campaignName))
    await playerPage.getByRole('button', { name: 'Accept invitation' }).click()
    await expect(playerPage).toHaveURL(/\/app\/campaign\//)
  })

  await test.step('the player’s article has no GM notes, GM-only location or edit tools', async () => {
    await playerPage.goto(maraUrl)
    await expect(playerPage.getByRole('heading', { level: 1, name: maraName })).toBeVisible()
    await expect(playerPage.getByText('Commands the Blackwall garrison.')).toBeVisible()
    await expect(playerPage.getByLabel('Key facts').getByText('Garrison captain')).toBeVisible()
    // Give the reference lookups time to settle before asserting absence.
    await playerPage.waitForLoadState('networkidle')
    await expect(playerPage.getByText(vaultName)).toHaveCount(0)
    await expect(playerPage.getByText('Current location')).toHaveCount(0)
    await expect(playerPage.getByText(new RegExp(secret))).toHaveCount(0)
    await expect(playerPage.getByRole('region', { name: 'GM-only notes' })).toHaveCount(0)
    await expect(playerPage.getByText('Has GM-only notes')).toHaveCount(0)
    await expect(playerPage.getByRole('link', { name: 'Edit' })).toHaveCount(0)
    await expect(playerPage.getByRole('button', { name: 'Manage' })).toHaveCount(0)
    await expect(playerPage.getByRole('button', { name: 'Add to favorites' })).toBeVisible()
  })

  await test.step('the GM-only location itself reads as not found for the player', async () => {
    await playerPage.goto(vaultUrl)
    await expect(playerPage.getByText(/could not be found/)).toBeVisible()
    await expect(playerPage.getByText(vaultName)).toHaveCount(0)
  })

  await ownerContext.close()
  await playerContext.close()
})

test('collapsed sidebar keeps the two-column article', async ({ page }) => {
  const id = stamp()
  await setUpOwnerWithCampaign(page, 'PW Entity Rail Owner', `Entity Rail ${id}`)
  const url = await quickCreate(page, 'Location', `Blackwall ${id}`)

  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await page.goto(url)
  const article = (await page.getByRole('article').boundingBox())!
  const aside = (await page.getByRole('complementary', { name: /^Connected to/ }).boundingBox())!
  expect(aside.x).toBeGreaterThan(article.x + article.width - 1)
  expect(aside.y).toBeLessThan(article.y + 50)
})

test.describe('phone width', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the article reads first, with connections up top and the rest collapsible', async ({ page }) => {
    const id = stamp()
    await setUpOwnerWithCampaign(page, 'PW Entity Phone Owner', `Entity Phone ${id}`)
    await page.getByRole('navigation', { name: 'Campaign sections' }).getByRole('link', { name: 'World' }).click()
    await page.getByRole('button', { name: 'New entity' }).click()
    await page.getByLabel('Name').fill(`Mara ${id}`)
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: `Mara ${id}` })).toBeVisible()

    const article = page.getByRole('article')
    await expect(article.getByRole('region', { name: /^Connections/ })).toBeVisible()
    for (const title of ['Plot threads', 'Appears in', 'Files', 'Revision history']) {
      const summary = page.locator('details > summary', { hasText: title })
      await expect(summary).toBeVisible()
      expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
    const threads = page.locator('details', { has: page.locator('summary', { hasText: 'Plot threads' }) })
    await threads.locator('summary').click()
    await expect(threads.getByText('Not part of any plot thread yet.')).toBeVisible()

    await expect(page.getByRole('link', { name: 'Edit' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Campaign sections' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })
})
