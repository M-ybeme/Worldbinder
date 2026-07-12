import { expect, test } from '@playwright/test'
import {
  clearRateLimits,
  findEmailLink,
  login,
  registerAndVerify,
  setUpOwnerWithCampaign,
} from './helpers'

/**
 * Covers Milestone 6's core deliverables end to end: create a plot thread,
 * link it to a session as "introduced," let a few sessions pass without
 * referencing it and confirm it surfaces under "Neglected" on both the
 * Threads page and the Dashboard, then resolve it via a session link and
 * confirm the player-facing status projection ("Completed") differs from
 * the GM-facing one ("resolved").
 *
 * Preconditions: `pnpm infra:up` and `pnpm dev` running locally.
 */

test.beforeEach(() => clearRateLimits())

test('plot thread lifecycle: introduce, go neglected, resolve, player status projection', async ({
  browser,
}) => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const campaignName = `Plot Thread Campaign ${stamp}`
  const threadTitle = `Missing Caravan ${stamp}`
  const playerEmail = `pw-thread-player-${stamp}@verify.local`

  const ownerContext = await browser.newContext()
  const ownerPage = await ownerContext.newPage()
  const playerContext = await browser.newContext()
  const playerPage = await playerContext.newPage()

  await test.step('owner registers, verifies, and creates a campaign', async () => {
    await setUpOwnerWithCampaign(ownerPage, 'PW Thread Owner', campaignName)
  })

  await test.step('player registers and verifies', async () => {
    await registerAndVerify(playerPage, playerEmail, 'PW Thread Player')
    await login(playerPage, playerEmail)
  })

  await test.step('owner creates a plot thread', async () => {
    await ownerPage.getByRole('link', { name: 'Threads' }).click()
    await ownerPage.getByRole('link', { name: 'New plot thread' }).click()
    await ownerPage.getByLabel('Title').fill(threadTitle)
    await ownerPage.getByRole('button', { name: 'Create plot thread' }).click()
    await expect(ownerPage.getByRole('heading', { name: threadTitle })).toBeVisible()
  })

  async function createAndCompleteSession(
    title: string,
    linkThread: boolean,
    action?: 'introduced' | 'resolved',
  ) {
    await ownerPage.getByRole('link', { name: 'Sessions' }).click()
    await ownerPage.getByRole('link', { name: 'New session' }).click()
    await ownerPage.getByLabel('Title').fill(title)
    if (linkThread && action) {
      await ownerPage.getByLabel('Plot thread').fill(threadTitle)
      await ownerPage.locator('.wb-combobox__option', { hasText: threadTitle }).first().click()
      await ownerPage.getByLabel('Action').selectOption(action)
      await ownerPage.getByRole('button', { name: 'Add' }).click()
    }
    await ownerPage.getByRole('button', { name: 'Create session' }).click()
    await expect(ownerPage.getByRole('heading', { name: new RegExp(title) })).toBeVisible()

    await ownerPage.getByRole('button', { name: 'Complete session' }).click()
    await ownerPage.getByRole('button', { name: 'Confirm completion' }).click()
    await expect(ownerPage.getByText('completed')).toBeVisible()
  }

  await test.step('owner introduces the thread in session one', async () => {
    await createAndCompleteSession('Session One', true, 'introduced')
  })

  await test.step('three more sessions pass without referencing the thread', async () => {
    await createAndCompleteSession('Session Two', false)
    await createAndCompleteSession('Session Three', false)
    await createAndCompleteSession('Session Four', false)
  })

  await test.step('the thread shows as neglected on the Threads page and the Dashboard', async () => {
    await ownerPage.getByRole('link', { name: 'Threads' }).click()
    await expect(ownerPage.getByText('Neglected')).toBeVisible()

    const neglectedSection = ownerPage
      .locator('h2', { hasText: 'Neglected' })
      .locator('xpath=following-sibling::ul[1]')
    await expect(neglectedSection.getByRole('link', { name: threadTitle })).toBeVisible()

    await ownerPage.getByRole('link', { name: 'Dashboard' }).click()
    await expect(ownerPage.getByText('Dormant Threads Requiring Attention')).toBeVisible()
    const dormantSection = ownerPage
      .locator('h2', { hasText: 'Dormant Threads Requiring Attention' })
      .locator('xpath=following-sibling::ul[1]')
    await expect(dormantSection.getByRole('link', { name: threadTitle })).toBeVisible()
  })

  await test.step('owner resolves the thread via a session link', async () => {
    await createAndCompleteSession('Session Five', true, 'resolved')

    await ownerPage.getByRole('link', { name: 'Threads' }).click()
    await ownerPage.getByRole('link', { name: threadTitle }).first().click()
    await expect(ownerPage.getByRole('heading', { name: threadTitle })).toBeVisible()
    await expect(ownerPage.locator('.wb-entity-header__meta')).toContainText('resolved')
  })

  await test.step('the player invited to the campaign sees the projected status, not the internal one', async () => {
    await ownerPage.goto(ownerPage.url().replace(/\/threads\/.+$/, '/members'))
    await ownerPage.getByLabel('Email').fill(playerEmail)
    await ownerPage.getByLabel('Role', { exact: true }).selectOption('player')
    await ownerPage.getByRole('button', { name: 'Send invitation' }).click()

    const inviteLink = await findEmailLink(playerEmail, campaignName)
    await playerPage.goto(inviteLink)
    await playerPage.getByRole('button', { name: 'Accept invitation' }).click()

    await playerPage.getByRole('link', { name: 'Threads' }).click()
    await playerPage.getByRole('link', { name: threadTitle }).first().click()
    await expect(playerPage.getByRole('heading', { name: threadTitle })).toBeVisible()
    const playerMeta = playerPage.locator('.wb-entity-header__meta')
    await expect(playerMeta).toContainText('completed')
    await expect(playerMeta).not.toContainText('resolved')
  })

  await ownerContext.close()
  await playerContext.close()
})
