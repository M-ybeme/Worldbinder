import { expect, test } from '@playwright/test'
import { clearRateLimits, setUpOwnerWithCampaign } from './helpers'

/**
 * The campaign shell: one sidebar (no topbar) that collapses to an icon
 * rail on desktop and becomes a drawer with bottom tabs at phone width.
 *
 * Preconditions: `pnpm infra:up` and `pnpm dev` running locally.
 */

test.beforeEach(() => clearRateLimits())

const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

test('desktop sidebar: search entry, collapse persists across reloads, World tabs', async ({
  page,
}) => {
  const campaignName = `Shell Desktop ${stamp()}`
  await setUpOwnerWithCampaign(page, 'PW Shell Owner', campaignName)
  const campaignNav = page.getByRole('navigation', { name: 'Campaign' })

  await test.step('the Dashboard owns the page h1 and is the current section', async () => {
    await expect(page.getByRole('heading', { level: 1, name: campaignName })).toBeVisible()
    await expect(campaignNav.getByRole('link', { name: 'Dashboard', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page).toHaveTitle(`${campaignName} · Worldbinder`)
  })

  await test.step('the sidebar search button opens the overlay', async () => {
    await page.getByRole('button', { name: 'Search (Ctrl/Cmd+K)' }).click()
    await expect(page.locator('.wb-search-overlay__panel')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.wb-search-overlay__panel')).toHaveCount(0)
  })

  await test.step('World and Timeline are tabs of the same section', async () => {
    await campaignNav.getByRole('link', { name: 'World', exact: true }).click()
    const tabs = page.getByRole('navigation', { name: 'World views' })
    await expect(tabs.getByRole('link', { name: 'Encyclopedia' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await tabs.getByRole('link', { name: 'Timeline' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Timeline' })).toBeVisible()
    await expect(campaignNav.getByRole('link', { name: 'World', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page).toHaveTitle(`Timeline · ${campaignName} · Worldbinder`)
  })

  await test.step('collapsing to the rail survives a reload', async () => {
    const sidebar = page.locator('#wb-campaign-sidebar')
    const before = (await sidebar.boundingBox())!.width
    await page.getByRole('button', { name: 'Collapse sidebar' }).click()
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
    await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeLessThan(before / 2)

    await page.reload()
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
    // Labels are hidden visually but stay the links' accessible names.
    await expect(campaignNav.getByRole('link', { name: 'Sessions', exact: true })).toBeVisible()
    await campaignNav.getByRole('link', { name: 'Sessions', exact: true }).focus()
    await expect(page.getByRole('tooltip')).toHaveText('Sessions')

    await page.getByRole('button', { name: 'Expand sidebar' }).click()
    await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible()
  })
})

test.describe('phone width', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('top bar, bottom tabs and the navigation drawer', async ({ page }) => {
    const campaignName = `Shell Mobile ${stamp()}`
    await setUpOwnerWithCampaign(page, 'PW Shell Mobile Owner', campaignName)
    const tabs = page.getByRole('navigation', { name: 'Campaign sections' })
    const menuButton = page.getByRole('button', { name: 'Open navigation' })

    await test.step('sidebar is hidden; bottom tabs carry the primary sections', async () => {
      await expect(page.locator('#wb-campaign-sidebar')).toBeHidden()
      await expect(tabs.getByRole('link')).toHaveCount(5)
      await tabs.getByRole('link', { name: 'Sessions', exact: true }).click()
      await expect(page.getByRole('heading', { level: 1, name: 'Sessions' })).toBeVisible()
      await expect(tabs.getByRole('link', { name: 'Sessions', exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      )
    })

    await test.step('the drawer opens, holds focus, and closes with Escape', async () => {
      await menuButton.click()
      const drawer = page.getByRole('dialog', { name: 'Navigation' })
      await expect(drawer).toBeVisible()
      await expect(drawer.getByRole('link', { name: 'Import / Export' })).toBeVisible()
      await expect(drawer.getByRole('link', { name: 'Account' })).toBeVisible()
      await expect(drawer.locator(':focus')).toHaveCount(1)
      await page.keyboard.press('Escape')
      await expect(drawer).toBeHidden()
      await expect(menuButton).toBeFocused()
    })

    await test.step('following a drawer link navigates and closes it', async () => {
      await menuButton.click()
      await page
        .getByRole('dialog', { name: 'Navigation' })
        .getByRole('link', { name: 'Members', exact: true })
        .click()
      await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeHidden()
      await expect(page.getByRole('banner')).toContainText('Members')
    })

    await test.step('the top bar search opens the overlay', async () => {
      await page.getByRole('banner').getByRole('button', { name: 'Search' }).click()
      await expect(page.locator('.wb-search-overlay__panel')).toBeVisible()
    })
  })
})
