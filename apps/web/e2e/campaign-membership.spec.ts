import { expect, test } from '@playwright/test'
import { clearRateLimits, findEmailLink, login, registerAndVerify } from './helpers'

/**
 * Covers roadmap §20.4 "critical Playwright suite" items 1-4 (register and
 * verify, create campaign, invite player, accept invite), plus Milestone 2's
 * remaining deliverables (switcher, permission-aware nav, role changes,
 * member removal, archive/restore, tenant isolation). Written as one
 * sequential scenario, matching how the roadmap itself narrates the suite —
 * split into fixtures/page objects once more of the suite exists.
 *
 * Preconditions: `pnpm infra:up` and `pnpm dev` running locally (not
 * started by this config — see playwright.config.ts).
 */

test.beforeEach(() => clearRateLimits())

test('campaign lifecycle: create, invite, accept, switch, role change, remove, archive/restore, tenant isolation', async ({
  browser,
}) => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const ownerEmail = `pw-owner-${stamp}@verify.local`
  const inviteeEmail = `pw-invitee-${stamp}@verify.local`
  const campaignName = `Playwright Campaign ${stamp}`

  const ownerContext = await browser.newContext()
  const ownerPage = await ownerContext.newPage()
  const inviteeContext = await browser.newContext()
  const inviteePage = await inviteeContext.newPage()

  await test.step('register and verify both accounts', async () => {
    await registerAndVerify(ownerPage, ownerEmail, 'PW Owner')
    await registerAndVerify(inviteePage, inviteeEmail, 'PW Invitee')
  })

  await test.step('log in as both users', async () => {
    await login(ownerPage, ownerEmail)
    await login(inviteePage, inviteeEmail)
  })

  await test.step('owner creates a campaign', async () => {
    await ownerPage.goto('/app/campaigns')
    await ownerPage.getByLabel('Name').fill(campaignName)
    await ownerPage.getByRole('button', { name: 'Create campaign' }).click()
    await ownerPage.getByRole('link', { name: campaignName }).click()
    await expect(ownerPage.getByRole('heading', { name: campaignName })).toBeVisible()
  })

  await test.step('permission-aware nav: owner sees Settings', async () => {
    await expect(ownerPage.getByRole('link', { name: 'Settings' })).toBeVisible()
  })

  await test.step('owner invites the second user as editor', async () => {
    await ownerPage.getByRole('link', { name: 'Members' }).click()
    await ownerPage.getByLabel('Email').fill(inviteeEmail)
    await ownerPage.getByLabel('Role', { exact: true }).selectOption('editor')
    await ownerPage.getByRole('button', { name: 'Send invitation' }).click()
    await expect(ownerPage.getByText(inviteeEmail)).toBeVisible()
  })

  await test.step('invitee accepts via the emailed link', async () => {
    const inviteLink = await findEmailLink(inviteeEmail, campaignName)
    await inviteePage.goto(inviteLink)
    await expect(inviteePage.getByRole('heading', { name: new RegExp(campaignName) })).toBeVisible()
    await inviteePage.getByRole('button', { name: 'Accept invitation' }).click()
    await expect(inviteePage).toHaveURL(/\/app\/campaign\//)
  })

  await test.step('campaign switcher lists the newly joined campaign', async () => {
    await expect(inviteePage.locator('select[aria-label="Switch campaign"]')).toContainText(
      campaignName,
    )
  })

  await test.step('permission-aware nav: editor does not see Settings', async () => {
    await expect(inviteePage.getByRole('link', { name: 'Settings' })).toHaveCount(0)
  })

  await test.step("owner changes the invitee's role to viewer", async () => {
    await ownerPage.reload()
    const roleSelect = ownerPage.getByLabel('Role for PW Invitee')
    await roleSelect.selectOption('viewer')
    await expect(roleSelect).toHaveValue('viewer')
  })

  await test.step('owner archives then restores the campaign', async () => {
    await ownerPage.getByRole('link', { name: 'Settings' }).click()
    await ownerPage.getByRole('button', { name: 'Archive campaign' }).click()
    await expect(ownerPage.getByRole('button', { name: 'Restore campaign' })).toBeVisible()
    await ownerPage.getByRole('button', { name: 'Restore campaign' }).click()
    await expect(ownerPage.getByRole('button', { name: 'Archive campaign' })).toBeVisible()
  })

  await test.step('owner removes the invitee', async () => {
    await ownerPage.getByRole('link', { name: 'Members' }).click()
    await ownerPage.getByRole('button', { name: 'Remove' }).click()
    await expect(ownerPage.getByText(inviteeEmail)).toHaveCount(0)
  })

  await test.step('removed member is bounced from the campaign (tenant isolation)', async () => {
    await inviteePage.reload()
    await expect(inviteePage).toHaveURL(/\/app\/campaigns$/)
  })

  await ownerContext.close()
  await inviteeContext.close()
})
