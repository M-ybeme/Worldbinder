import { expect, test, type Page } from '@playwright/test'
import {
  clearRateLimits,
  findEmailLink,
  login,
  registerAndVerify,
  setUpOwnerWithCampaign,
  openEditorTab,
} from './helpers'

/**
 * Dashboard E against the real API: the new-campaign checklist reflecting
 * actual campaign state, the + New menu's quick-create flows, the upcoming
 * session taking the lead once one is scheduled, player-vs-GM visibility,
 * and the phone layout inside the shared shell.
 *
 * Preconditions: `pnpm infra:up` and `pnpm dev` running locally.
 */

test.beforeEach(() => clearRateLimits())

const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

function checklistSteps(page: Page) {
  return page
    .getByRole('region', { name: 'Get the campaign ready' })
    .getByRole('heading', { level: 3 })
}

async function newFromMenu(page: Page, item: string) {
  await page.getByRole('button', { name: 'New', exact: true }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

async function backToDashboard(page: Page) {
  await page.getByRole('navigation', { name: 'Campaign' }).getByRole('link', { name: 'Dashboard', exact: true }).click()
}

test('new campaign: checklist follows real progress, then the next session leads', async ({
  page,
}) => {
  const id = stamp()
  const campaignName = `Dashboard E ${id}`
  await setUpOwnerWithCampaign(page, 'PW Dashboard Owner', campaignName)

  await test.step('a brand-new campaign shows the setup checklist', async () => {
    await expect(checklistSteps(page)).toHaveText([
      'Add the first people and places',
      'Plan your first session',
      'Invite your players',
      'Set up the calendar (optional)',
    ])
  })

  await test.step('+ New → Character creates an entry and its checklist step goes away', async () => {
    await newFromMenu(page, 'Character')
    await page.getByLabel('Name').fill(`Mara Voss ${id}`)
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByRole('heading', { name: `Mara Voss ${id}` })).toBeVisible()
    await backToDashboard(page)
    await expect(checklistSteps(page)).toHaveText([
      'Plan your first session',
      'Invite your players',
      'Set up the calendar (optional)',
    ])
  })

  await test.step('+ New → Plot thread shows up under Plot threads', async () => {
    await newFromMenu(page, 'Plot thread')
    await page.getByLabel('Title').fill(`The Missing Caravan ${id}`)
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByRole('heading', { name: `The Missing Caravan ${id}` })).toBeVisible()
    await backToDashboard(page)
    const threads = page.getByRole('region', { name: 'Plot threads' })
    await expect(threads.getByRole('link', { name: `The Missing Caravan ${id}` })).toBeVisible()
  })

  await test.step('scheduling a session makes it the Dashboard lead', async () => {
    await page.getByRole('button', { name: 'Plan a session' }).click()
    await page.getByLabel('Title').fill(`Into Stonewater Pass ${id}`)
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByRole('heading', { name: new RegExp(`Into Stonewater Pass ${id}`) })).toBeVisible()
    const sessionUrl = page.url()

    await page.getByRole('link', { name: 'Edit' }).click()
    const date = new Date(Date.now() + 3 * 86_400_000)
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16)
    await page.getByLabel('Scheduled at').fill(local)
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 10_000 })

    await backToDashboard(page)
    await expect(
      page.getByRole('heading', { level: 3, name: new RegExp(`Into Stonewater Pass ${id}`) }),
    ).toBeVisible()
    await expect(page.getByText('Next session in 3 days')).toBeVisible()
    await expect(checklistSteps(page)).toHaveText([
      'Invite your players',
      'Set up the calendar (optional)',
    ])
    await page.getByRole('link', { name: 'Open session prep' }).click()
    await expect(page).toHaveURL(sessionUrl)
  })
})

test('players see only what is shared with them, and no create or GM tools', async ({
  browser,
}) => {
  const id = stamp()
  const campaignName = `Dashboard Visibility ${id}`
  const publicName = `Blackwall ${id}`
  const secretName = `Gatehouse Tunnels ${id}`
  const playerEmail = `pw-dashboard-player-${id}@verify.local`

  const ownerContext = await browser.newContext()
  const ownerPage = await ownerContext.newPage()
  const playerContext = await browser.newContext()
  const playerPage = await playerContext.newPage()
  await setUpOwnerWithCampaign(ownerPage, 'PW Dashboard Vis Owner', campaignName)
  const campaignUrl = ownerPage.url()

  await test.step('owner creates a public and a GM-only entry', async () => {
    for (const name of [publicName, secretName]) {
      await newFromMenu(ownerPage, 'Location')
      await ownerPage.getByLabel('Name').fill(name)
      await ownerPage.getByRole('button', { name: 'Create', exact: true }).click()
      await expect(ownerPage.getByRole('heading', { name })).toBeVisible()
      await ownerPage.goto(campaignUrl)
    }
    await ownerPage.getByRole('link', { name: secretName }).click()
    await ownerPage.getByRole('link', { name: 'Edit' }).click()
    await openEditorTab(ownerPage, 'Details')
    await ownerPage.getByLabel('Visibility').selectOption('gm_only')
    await expect(ownerPage.getByText('Saved')).toBeVisible({ timeout: 10_000 })
  })

  await test.step('the owner sees both under Recently changed', async () => {
    await ownerPage.goto(campaignUrl)
    const recent = ownerPage.getByRole('region', { name: 'Recently changed' })
    await expect(recent.getByRole('link', { name: publicName })).toBeVisible()
    await expect(recent.getByRole('link', { name: secretName })).toBeVisible()
    await expect(recent.getByRole('link', { name: 'Full activity log' })).toBeVisible()
  })

  await test.step('a player joins', async () => {
    await registerAndVerify(playerPage, playerEmail, 'PW Dashboard Player')
    await login(playerPage, playerEmail)
    await ownerPage.goto(`${campaignUrl}/members`)
    await ownerPage.getByLabel('Email').fill(playerEmail)
    await ownerPage.getByLabel('Role', { exact: true }).selectOption('player')
    await ownerPage.getByRole('button', { name: 'Send invitation' }).click()
    await playerPage.goto(await findEmailLink(playerEmail, campaignName))
    await playerPage.getByRole('button', { name: 'Accept invitation' }).click()
    await expect(playerPage).toHaveURL(/\/app\/campaign\//)
  })

  await test.step('the player sees the public entry only, and no New menu or checklist', async () => {
    await playerPage.goto(campaignUrl)
    await expect(playerPage.getByRole('heading', { level: 1, name: campaignName })).toBeVisible()
    const recent = playerPage.getByRole('region', { name: 'Recently changed' })
    await expect(recent.getByRole('link', { name: publicName })).toBeVisible()
    await expect(playerPage.getByText(secretName)).toHaveCount(0)
    await expect(playerPage.getByRole('button', { name: 'New', exact: true })).toHaveCount(0)
    await expect(playerPage.getByRole('link', { name: 'Full activity log' })).toHaveCount(0)
    await expect(playerPage.getByRole('heading', { name: 'Get the campaign ready' })).toHaveCount(0)
  })

  await ownerContext.close()
  await playerContext.close()
})

test.describe('phone width', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the Dashboard fits the phone shell and its New menu works', async ({ page }) => {
    const id = stamp()
    const campaignName = `Dashboard Phone ${id}`
    await setUpOwnerWithCampaign(page, 'PW Dashboard Phone Owner', campaignName)

    await expect(page.getByRole('navigation', { name: 'Campaign sections' })).toBeVisible()
    await expect(page.getByRole('banner')).toContainText('Dashboard')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)

    await page.getByRole('button', { name: 'New', exact: true }).click()
    const menu = page.getByRole('menu', { name: 'Create new' })
    await expect(menu).toBeVisible()
    const box = (await menu.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(390)
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'New', exact: true })).toBeFocused()
  })
})
