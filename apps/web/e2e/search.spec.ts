import { expect, test } from '@playwright/test'
import {
  clearRateLimits,
  findEmailLink,
  login,
  registerAndVerify,
  setUpOwnerWithCampaign,
} from './helpers'

/**
 * Covers Milestone 7's roadmap §20.4 step 14 ("Search visible content") end
 * to end: the GM's Ctrl/Cmd+K overlay and the full results page both find
 * public and GM-only content for the GM, while a player can find the public
 * entity by name but never the GM-only entity or its secret content — the
 * same visibility split verified at the API layer in
 * `apps/api/test/search.e2e-spec.ts`, exercised here through the real UI.
 *
 * Preconditions: `pnpm infra:up` and `pnpm dev` running locally.
 */

test.beforeEach(() => clearRateLimits())

test('search: overlay and results page respect entity visibility for GM vs. player', async ({
  browser,
}) => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  // Independent suffixes, not the shared `stamp`, for the two entity names
  // used in fuzzy-match assertions below — sharing one long numeric suffix
  // between "Ashen Guard" and "Hidden Villain" would make them trigram-
  // similar by accident (most of the string overlaps), causing a real
  // fuzzy-tier match that has nothing to do with the visibility rule being
  // tested here.
  const publicSuffix = Math.random().toString(36).slice(2, 8)
  const hiddenSuffix = Math.random().toString(36).slice(2, 8)
  const campaignName = `Search Campaign ${stamp}`
  const publicEntityName = `Ashen Guard ${publicSuffix}`
  const hiddenEntityName = `Hidden Villain ${hiddenSuffix}`
  const secretPhrase = `RebellionSecret${stamp}`
  const playerEmail = `pw-search-player-${stamp}@verify.local`

  const ownerContext = await browser.newContext()
  const ownerPage = await ownerContext.newPage()
  const playerContext = await browser.newContext()
  const playerPage = await playerContext.newPage()

  await test.step('owner registers, verifies, and creates a campaign', async () => {
    await setUpOwnerWithCampaign(ownerPage, 'PW Search Owner', campaignName)
  })

  await test.step('player registers and verifies', async () => {
    await registerAndVerify(playerPage, playerEmail, 'PW Search Player')
    await login(playerPage, playerEmail)
  })

  let campaignUrl = ''

  await test.step('owner creates a public entity with public and GM-only content', async () => {
    campaignUrl = ownerPage.url()
    await ownerPage.getByRole('link', { name: 'World' }).click()
    await ownerPage.getByRole('link', { name: 'New entity' }).click()

    await ownerPage.getByLabel('Name').fill(publicEntityName)
    await ownerPage
      .locator('.wb-field', { hasText: 'Public content' })
      .locator('[contenteditable="true"]')
      .fill('Patrols the northern wall day and night.')
    await ownerPage
      .locator('.wb-field', { hasText: 'GM-only content' })
      .locator('[contenteditable="true"]')
      .fill(`Secretly funding the ${secretPhrase}.`)

    await ownerPage.getByRole('button', { name: 'Create entity' }).click()
    await expect(ownerPage.getByRole('heading', { name: publicEntityName })).toBeVisible()
  })

  await test.step('owner creates a GM-only entity', async () => {
    await ownerPage.getByRole('link', { name: 'World' }).click()
    await ownerPage.getByRole('link', { name: 'New entity' }).click()
    await ownerPage.getByLabel('Name').fill(hiddenEntityName)
    await ownerPage.getByLabel('Visibility').selectOption('gm_only')
    await ownerPage.getByRole('button', { name: 'Create entity' }).click()
    await expect(ownerPage.getByRole('heading', { name: hiddenEntityName })).toBeVisible()
  })

  await test.step('owner finds both entities and the secret phrase via the search overlay', async () => {
    await ownerPage.goto(campaignUrl)
    await ownerPage.keyboard.press('Control+k')
    const overlay = ownerPage.locator('.wb-search-overlay__panel')
    await expect(overlay).toBeVisible()

    await ownerPage.locator('.wb-search-overlay__input').fill(publicEntityName)
    await expect(overlay.getByText(publicEntityName)).toBeVisible()
    await ownerPage.keyboard.press('Escape')
    await expect(overlay).toHaveCount(0)

    await ownerPage.keyboard.press('Control+k')
    await ownerPage.locator('.wb-search-overlay__input').fill(hiddenEntityName)
    await expect(
      ownerPage.locator('.wb-search-overlay__panel').getByText(hiddenEntityName),
    ).toBeVisible()
    await ownerPage.keyboard.press('Escape')
    await expect(overlay).toHaveCount(0)

    await ownerPage.keyboard.press('Control+k')
    await ownerPage.locator('.wb-search-overlay__input').fill(secretPhrase)
    await expect(
      ownerPage.locator('.wb-search-overlay__panel').getByText(publicEntityName),
    ).toBeVisible()
    await ownerPage.keyboard.press('Escape')
  })

  await test.step('owner invites the player', async () => {
    await ownerPage.goto(campaignUrl.replace(/\/?$/, '/members'))
    await ownerPage.getByLabel('Email').fill(playerEmail)
    await ownerPage.getByLabel('Role', { exact: true }).selectOption('player')
    await ownerPage.getByRole('button', { name: 'Send invitation' }).click()

    const inviteLink = await findEmailLink(playerEmail, campaignName)
    await playerPage.goto(inviteLink)
    await playerPage.getByRole('button', { name: 'Accept invitation' }).click()
    // Wait for the client-side navigate() into CampaignLayout to finish
    // mounting — keyboard.press is a raw input event, not an auto-waiting
    // locator action, so pressing Ctrl+K before the layout's keydown
    // listener attaches would silently do nothing.
    await expect(playerPage.getByRole('link', { name: 'Search' })).toBeVisible()
  })

  const playerOverlay = playerPage.locator('.wb-search-overlay__panel')

  await test.step('player finds the public entity by name via the overlay', async () => {
    await playerPage.keyboard.press('Control+k')
    await expect(playerOverlay).toBeVisible()
    await playerPage.locator('.wb-search-overlay__input').fill(publicEntityName)
    await expect(playerOverlay.getByText(publicEntityName)).toBeVisible()
    await playerPage.keyboard.press('Escape')
    // Wait for the close to fully commit before the next test.step presses
    // Ctrl+K again — two keyboard.press calls are raw CDP input events with
    // no auto-waiting between them, and the Zustand isOpen transition needs
    // to actually unmount the overlay (resetting its local query state)
    // before a reopen, or the next query can race against stale state.
    await expect(playerOverlay).toHaveCount(0)
  })

  await test.step('player never finds the GM-only entity, even by exact name', async () => {
    await playerPage.keyboard.press('Control+k')
    await expect(playerOverlay).toBeVisible()
    await playerPage.locator('.wb-search-overlay__input').fill(hiddenEntityName)
    await expect(playerPage.locator('.wb-search-overlay__status')).toHaveText('No matches')
    await playerPage.keyboard.press('Escape')
    await expect(playerOverlay).toHaveCount(0)
  })

  await test.step('player never matches the secret phrase from GM-only content', async () => {
    await playerPage.keyboard.press('Control+k')
    await expect(playerOverlay).toBeVisible()
    await playerPage.locator('.wb-search-overlay__input').fill(secretPhrase)
    await expect(playerPage.locator('.wb-search-overlay__status')).toHaveText('No matches')
    await playerPage.keyboard.press('Escape')
    await expect(playerOverlay).toHaveCount(0)
  })

  await test.step('the full results page shows the same visibility split for the player', async () => {
    await playerPage.goto(campaignUrl.replace(/\/?$/, '/search'))
    await playerPage.getByLabel('Search', { exact: true }).fill(publicEntityName)
    await expect(
      playerPage.locator('.wb-search-results-page').getByText(publicEntityName),
    ).toBeVisible()
    await expect(playerPage.getByLabel('World')).toBeVisible()
    await expect(playerPage.getByLabel('Sessions')).toBeVisible()

    await playerPage.getByLabel('Search', { exact: true }).fill(hiddenEntityName)
    await expect(playerPage.getByText(/No matches for/)).toBeVisible()
  })

  await ownerContext.close()
  await playerContext.close()
})
