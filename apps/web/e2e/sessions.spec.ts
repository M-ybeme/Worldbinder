import { expect, test } from '@playwright/test'
import {
  clearRateLimits,
  findEmailLink,
  login,
  registerAndVerify,
  setUpOwnerWithCampaign,
} from './helpers'

/**
 * Covers Milestone 5's core deliverables end to end: create a session with
 * a featured entity, complete it with an in-world end date and confirm the
 * date shows on the session, reveal a GM-only entity and confirm a player
 * can now see it, confirm the featured entity's own page lists the session
 * under "Session Appearances", and confirm a player never sees
 * planned/GM-only session content.
 *
 * Preconditions: `pnpm infra:up` and `pnpm dev` running locally.
 */

test.beforeEach(() => clearRateLimits())

test('session lifecycle: create, complete with world date, reveal, session appearances', async ({
  browser,
}) => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const campaignName = `Session Campaign ${stamp}`
  const npcName = `Featured NPC ${stamp}`
  const secretName = `Secret NPC ${stamp}`
  const sessionTitle = `Session Title ${stamp}`
  const playerEmail = `pw-session-player-${stamp}@verify.local`

  const ownerContext = await browser.newContext()
  const ownerPage = await ownerContext.newPage()
  const playerContext = await browser.newContext()
  const playerPage = await playerContext.newPage()

  await test.step('owner registers, verifies, and creates a campaign', async () => {
    await setUpOwnerWithCampaign(ownerPage, 'PW Session Owner', campaignName)
  })

  await test.step('player registers and verifies', async () => {
    await registerAndVerify(playerPage, playerEmail, 'PW Session Player')
    await login(playerPage, playerEmail)
  })

  let sessionUrl = ''
  let npcUrl = ''

  await test.step('owner creates a featured entity and a GM-only secret entity', async () => {
    await ownerPage.getByRole('link', { name: 'World' }).click()
    await ownerPage.getByRole('link', { name: 'New entity' }).click()
    await ownerPage.getByLabel('Name').fill(npcName)
    await ownerPage.getByRole('button', { name: 'Create entity' }).click()
    await expect(ownerPage.getByRole('heading', { name: npcName })).toBeVisible()
    npcUrl = ownerPage.url()

    await ownerPage.getByRole('link', { name: 'World' }).click()
    await ownerPage.getByRole('link', { name: 'New entity' }).click()
    await ownerPage.getByLabel('Name').fill(secretName)
    await ownerPage.getByLabel('Visibility').selectOption('gm_only')
    await ownerPage.getByRole('button', { name: 'Create entity' }).click()
    await expect(ownerPage.getByRole('heading', { name: secretName })).toBeVisible()
  })

  await test.step('owner creates a session with the featured entity', async () => {
    await ownerPage.getByRole('link', { name: 'Sessions' }).click()
    await ownerPage.getByRole('link', { name: 'New session' }).click()
    await ownerPage.getByLabel('Title').fill(sessionTitle)
    await ownerPage.getByLabel('Add to featured entities').fill(npcName)
    await ownerPage.locator('.wb-combobox__option', { hasText: npcName }).first().click()
    await ownerPage.getByRole('button', { name: 'Create session' }).click()
    await expect(ownerPage.getByRole('heading', { name: new RegExp(sessionTitle) })).toBeVisible()
    sessionUrl = ownerPage.url()
  })

  await test.step('owner completes the session with an in-world end date', async () => {
    await ownerPage.getByRole('button', { name: 'Complete session' }).click()
    await ownerPage.getByLabel('Year').fill('1428')
    await ownerPage.getByLabel('Month').fill('6')
    await ownerPage.getByLabel('Day').fill('12')
    await ownerPage.getByRole('button', { name: 'Confirm completion' }).click()
    await expect(ownerPage.getByText(/Ends 1428-06-12/)).toBeVisible()
    await expect(ownerPage.getByText('completed')).toBeVisible()
  })

  await test.step('owner reveals the secret entity', async () => {
    await ownerPage.getByLabel('Reveal a hidden entity').fill(secretName)
    await ownerPage.locator('.wb-combobox__option', { hasText: secretName }).first().click()
    await ownerPage.getByRole('button', { name: 'Reveal to players' }).click()
    await expect(ownerPage.locator('.wb-relationship-list', { hasText: secretName })).toBeVisible()
  })

  await test.step('player accepts an invitation to the campaign', async () => {
    await ownerPage.goto(sessionUrl.replace(/\/sessions\/.+$/, '/members'))
    await ownerPage.getByLabel('Email').fill(playerEmail)
    await ownerPage.getByLabel('Role', { exact: true }).selectOption('player')
    await ownerPage.getByRole('button', { name: 'Send invitation' }).click()

    const inviteLink = await findEmailLink(playerEmail, campaignName)
    await playerPage.goto(inviteLink)
    await playerPage.getByRole('button', { name: 'Accept invitation' }).click()
  })

  await test.step('player can now see the revealed entity', async () => {
    await playerPage.goto(npcUrl.replace(new RegExp(`/world/.+$`), `/world`))
    await playerPage.getByLabel('Search').fill(secretName)
    await expect(playerPage.getByRole('link', { name: secretName })).toBeVisible()
  })

  await test.step('player never sees planned/GM-only session content', async () => {
    await playerPage.goto(sessionUrl)
    await expect(playerPage.getByText(sessionTitle)).toBeVisible()
    await expect(playerPage.getByText('Planned content (GM only)')).toHaveCount(0)
    await expect(playerPage.getByText('GM-only notes')).toHaveCount(0)
  })

  await test.step('the featured entity shows this session under Session Appearances', async () => {
    await ownerPage.goto(npcUrl)
    await expect(ownerPage.getByText('Session Appearances')).toBeVisible()
    await expect(
      ownerPage
        .locator('.wb-related-content', { hasText: 'Session Appearances' })
        .getByText(new RegExp(sessionTitle)),
    ).toBeVisible()
  })

  await ownerContext.close()
  await playerContext.close()
})
