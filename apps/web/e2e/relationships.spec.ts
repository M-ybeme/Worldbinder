import { expect, test } from '@playwright/test'
import {
  clearRateLimits,
  findEmailLink,
  login,
  registerAndVerify,
  setUpOwnerWithCampaign,
} from './helpers'

/**
 * Covers Milestone 4's core deliverables end to end: create a typed
 * relationship between two entities and confirm the reverse label projects
 * onto the target automatically, add a `[[` wiki-link mention in content and
 * confirm the backlink appears on the target, and confirm a player can't see
 * a GM-only relationship.
 *
 * Preconditions: `pnpm infra:up` and `pnpm dev` running locally.
 */

test.beforeEach(() => clearRateLimits())

test('relationship creation projects the reverse label on the target entity', async ({ page }) => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const campaignName = `Relationship Campaign ${stamp}`
  const dukeName = `Duke Renald ${stamp}`
  const westvaleName = `Westvale ${stamp}`

  await setUpOwnerWithCampaign(page, 'PW Relationship Owner', campaignName)

  let dukeUrl = ''
  let westvaleUrl = ''

  await test.step('create the source and target entities', async () => {
    await page.getByRole('link', { name: 'World' }).click()
    await page.getByRole('link', { name: 'New entity' }).click()
    await page.getByLabel('Name').fill(dukeName)
    await page.getByRole('button', { name: 'Create entity' }).click()
    await expect(page.getByRole('heading', { name: dukeName })).toBeVisible()
    dukeUrl = page.url()

    await page.getByRole('link', { name: 'World' }).click()
    await page.getByRole('link', { name: 'New entity' }).click()
    await page.getByLabel('Name').fill(westvaleName)
    await page.getByLabel('Type').selectOption('location')
    await page.getByRole('button', { name: 'Create entity' }).click()
    await expect(page.getByRole('heading', { name: westvaleName })).toBeVisible()
    westvaleUrl = page.url()
  })

  await test.step('add a "Controls" relationship from Duke Renald to Westvale', async () => {
    await page.goto(dukeUrl)
    await page.getByRole('button', { name: '+ Relationship' }).click()
    await page.getByLabel('Relationship type').selectOption({ label: 'Controls' })
    await page.getByLabel('Target entity').fill(westvaleName)
    await page.locator('.wb-combobox__option', { hasText: westvaleName }).first().click()
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Outgoing')).toBeVisible()
    await expect(
      page
        .locator('.wb-relationship-list', { hasText: 'Controls' })
        .getByRole('link', { name: westvaleName }),
    ).toBeVisible()
  })

  await test.step('the reverse label appears on the target entity', async () => {
    await page.goto(westvaleUrl)
    await expect(page.getByText('Incoming')).toBeVisible()
    await expect(
      page
        .locator('.wb-relationship-list', { hasText: 'Controlled by' })
        .getByRole('link', { name: dukeName }),
    ).toBeVisible()
  })
})

test('a [[ wiki-link mention creates a backlink on the target entity', async ({ page }) => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const campaignName = `Wiki Link Campaign ${stamp}`
  const dukeName = `Duke Renald ${stamp}`
  const westvaleName = `Westvale ${stamp}`

  await setUpOwnerWithCampaign(page, 'PW Wiki Link Owner', campaignName)

  await page.getByRole('link', { name: 'World' }).click()
  await page.getByRole('link', { name: 'New entity' }).click()
  await page.getByLabel('Name').fill(westvaleName)
  await page.getByLabel('Type').selectOption('location')
  await page.getByRole('button', { name: 'Create entity' }).click()
  await expect(page.getByRole('heading', { name: westvaleName })).toBeVisible()
  const westvaleUrl = page.url()

  await page.getByRole('link', { name: 'World' }).click()
  await page.getByRole('link', { name: 'New entity' }).click()
  await page.getByLabel('Name').fill(dukeName)

  const publicEditor = page
    .locator('.wb-field', { hasText: 'Public content' })
    .locator('[contenteditable="true"]')
  await publicEditor.click()
  await page.keyboard.type(`[[${westvaleName}`)
  await expect(
    page.locator('.wb-entity-mention-popup .wb-combobox__option', { hasText: westvaleName }),
  ).toBeVisible({ timeout: 10_000 })
  await page
    .locator('.wb-entity-mention-popup .wb-combobox__option', { hasText: westvaleName })
    .click()

  await page.getByRole('button', { name: 'Create entity' }).click()
  await expect(page.getByRole('heading', { name: dukeName })).toBeVisible()

  await page.goto(westvaleUrl)
  await expect(page.getByText('Backlinks')).toBeVisible()
  await expect(
    page.locator('.wb-backlink-list').getByRole('link', { name: dukeName }),
  ).toBeVisible()
})

test('a player cannot see a GM-only relationship', async ({ browser }) => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const campaignName = `Hidden Relationship Campaign ${stamp}`
  const aName = `Entity A ${stamp}`
  const bName = `Entity B ${stamp}`
  const playerEmail = `pw-relationship-player-${stamp}@verify.local`

  const ownerContext = await browser.newContext()
  const ownerPage = await ownerContext.newPage()
  const playerContext = await browser.newContext()
  const playerPage = await playerContext.newPage()

  await setUpOwnerWithCampaign(ownerPage, 'PW Hidden Rel Owner', campaignName)
  await registerAndVerify(playerPage, playerEmail, 'PW Hidden Rel Player')
  await login(playerPage, playerEmail)

  await ownerPage.getByRole('link', { name: 'World' }).click()
  await ownerPage.getByRole('link', { name: 'New entity' }).click()
  await ownerPage.getByLabel('Name').fill(aName)
  await ownerPage.getByRole('button', { name: 'Create entity' }).click()
  await expect(ownerPage.getByRole('heading', { name: aName })).toBeVisible()
  const aUrl = ownerPage.url()

  await ownerPage.getByRole('link', { name: 'World' }).click()
  await ownerPage.getByRole('link', { name: 'New entity' }).click()
  await ownerPage.getByLabel('Name').fill(bName)
  await ownerPage.getByRole('button', { name: 'Create entity' }).click()
  await expect(ownerPage.getByRole('heading', { name: bName })).toBeVisible()

  await ownerPage.goto(aUrl)
  await ownerPage.getByRole('button', { name: '+ Relationship' }).click()
  await ownerPage.getByLabel('Relationship type').selectOption({ label: 'Ally of' })
  await ownerPage.getByLabel('Target entity').fill(bName)
  await ownerPage.locator('.wb-combobox__option', { hasText: bName }).first().click()
  await ownerPage.getByLabel('Visibility').selectOption('gm_only')
  await ownerPage.getByRole('button', { name: 'Save' }).click()
  await expect(ownerPage.getByText('Outgoing')).toBeVisible()

  await ownerPage.goto(aUrl.replace(/\/world\/.+$/, '/members'))
  await ownerPage.getByLabel('Email').fill(playerEmail)
  await ownerPage.getByLabel('Role', { exact: true }).selectOption('player')
  await ownerPage.getByRole('button', { name: 'Send invitation' }).click()
  const inviteLink = await findEmailLink(playerEmail, campaignName)
  await playerPage.goto(inviteLink)
  await playerPage.getByRole('button', { name: 'Accept invitation' }).click()

  await playerPage.goto(aUrl)
  await expect(playerPage.getByText('No relationships yet.')).toBeVisible()

  await ownerContext.close()
  await playerContext.close()
})
