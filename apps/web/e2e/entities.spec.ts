import { expect, test } from '@playwright/test'
import {
  clearRateLimits,
  findEmailLink,
  login,
  registerAndVerify,
  setUpOwnerWithCampaign,
} from './helpers'

/**
 * Covers Milestone 3's core deliverables end to end: create an entity with
 * tags/metadata/split content, confirm a player sees the public content but
 * not the GM-only section, edit it, filter by tag, delete it, and confirm a
 * mid-edit network drop still preserves the change locally (autosave +
 * IndexedDB draft recovery).
 *
 * Preconditions: `pnpm infra:up` and `pnpm dev` running locally.
 */

test.beforeEach(() => clearRateLimits())

test('entity lifecycle: create, visibility, edit, tag filter, delete', async ({ browser }) => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const campaignName = `Entity Campaign ${stamp}`
  const entityName = `Duke Renald ${stamp}`
  const playerEmail = `pw-entity-player-${stamp}@verify.local`

  const ownerContext = await browser.newContext()
  const ownerPage = await ownerContext.newPage()
  const playerContext = await browser.newContext()
  const playerPage = await playerContext.newPage()

  await test.step('owner registers, verifies, and creates a campaign', async () => {
    await setUpOwnerWithCampaign(ownerPage, 'PW Entity Owner', campaignName)
  })

  await test.step('player registers and verifies', async () => {
    await registerAndVerify(playerPage, playerEmail, 'PW Entity Player')
    await login(playerPage, playerEmail)
  })

  let entityUrl = ''

  await test.step('owner creates an entity with tags and split content', async () => {
    await ownerPage.getByRole('link', { name: 'World' }).click()
    await ownerPage.getByRole('link', { name: 'New entity' }).click()

    await ownerPage.getByLabel('Name').fill(entityName)
    await ownerPage.getByLabel('Tags').fill('nobility')
    await ownerPage.getByLabel('Tags').press('Enter')

    await ownerPage
      .locator('.wb-field', { hasText: 'Public content' })
      .locator('[contenteditable="true"]')
      .fill('A minor noble known for his generosity.')
    await ownerPage
      .locator('.wb-field', { hasText: 'GM-only content' })
      .locator('[contenteditable="true"]')
      .fill('Secretly funding the rebellion.')

    await ownerPage.getByRole('button', { name: 'Create entity' }).click()
    await expect(ownerPage.getByRole('heading', { name: entityName })).toBeVisible()
    entityUrl = ownerPage.url()
  })

  await test.step('owner sees both public and GM content', async () => {
    await expect(ownerPage.getByText('A minor noble known for his generosity.')).toBeVisible()
    await expect(ownerPage.getByText('Secretly funding the rebellion.')).toBeVisible()
  })

  await test.step('player sees the entity but not GM content', async () => {
    // The campaign owner needs to invite the player for them to have any
    // access at all — reuse the members flow rather than re-testing it here.
    await ownerPage.goto(entityUrl.replace(/\/world\/.+$/, '/members'))
    await ownerPage.getByLabel('Email').fill(playerEmail)
    await ownerPage.getByLabel('Role', { exact: true }).selectOption('player')
    await ownerPage.getByRole('button', { name: 'Send invitation' }).click()

    const inviteLink = await findEmailLink(playerEmail, campaignName)
    await playerPage.goto(inviteLink)
    await playerPage.getByRole('button', { name: 'Accept invitation' }).click()

    await playerPage.goto(entityUrl)
    await expect(playerPage.getByText('A minor noble known for his generosity.')).toBeVisible()
    await expect(playerPage.getByText('Secretly funding the rebellion.')).toHaveCount(0)
    await expect(playerPage.getByRole('link', { name: 'Edit' })).toHaveCount(0)
  })

  await test.step('owner edits the entity', async () => {
    await ownerPage.goto(entityUrl)
    await ownerPage.getByRole('link', { name: 'Edit' }).click()
    await ownerPage.getByLabel('Summary').fill('Updated summary text.')
    // Autosave debounces ~2s after idle, then confirms via the status line.
    await expect(ownerPage.getByText('Saved')).toBeVisible({ timeout: 10_000 })
  })

  await test.step('tag filter narrows the World list', async () => {
    await ownerPage.goto(entityUrl.replace(/\/world\/.+$/, '/world'))
    await ownerPage.getByLabel('Tag').fill('nobility')
    await expect(ownerPage.getByRole('link', { name: entityName })).toBeVisible()
    await ownerPage.getByLabel('Tag').fill('no-such-tag')
    await expect(ownerPage.getByRole('link', { name: entityName })).toHaveCount(0)
  })

  await test.step('owner deletes the entity', async () => {
    await ownerPage.goto(entityUrl)
    ownerPage.once('dialog', (dialog) => void dialog.accept())
    await ownerPage.getByRole('button', { name: 'Delete' }).click()
    await expect(ownerPage).toHaveURL(/\/world$/)
  })

  await ownerContext.close()
  await playerContext.close()
})

test('offline mid-edit: change is preserved locally and synced once back online', async ({
  browser,
}) => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const campaignName = `Draft Recovery Campaign ${stamp}`
  const entityName = `Draft Recovery Entity ${stamp}`

  const context = await browser.newContext()
  const page = await context.newPage()

  await setUpOwnerWithCampaign(page, 'PW Draft Owner', campaignName)

  await page.getByRole('link', { name: 'World' }).click()
  await page.getByRole('link', { name: 'New entity' }).click()
  await page.getByLabel('Name').fill(entityName)
  await page.getByRole('button', { name: 'Create entity' }).click()
  await expect(page.getByRole('heading', { name: entityName })).toBeVisible()

  await page.getByRole('link', { name: 'Edit' }).click()

  await context.setOffline(true)
  await page.getByLabel('Summary').fill('Written while offline.')
  await expect(page.getByText('Offline — changes saved locally')).toBeVisible({
    timeout: 10_000,
  })

  await context.setOffline(false)
  // The next debounce cycle (triggered by any further change, or simply
  // re-focusing the field) should flush the locally-saved draft.
  await page.getByLabel('Summary').fill('Written while offline, then synced.')
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10_000 })

  await context.close()
})
