import { expect, test, type Page } from '@playwright/test'
import { clearRateLimits, setUpOwnerWithCampaign } from './helpers'

/**
 * Regression coverage for autosave losing the last edit: the entity,
 * session and plot-thread editors debounce saves by ~2s, and leaving the
 * page inside that window used to cancel the save without keeping a draft.
 * Each test types a change and immediately leaves via the sidebar (well
 * inside the debounce), then reloads the record from the server.
 *
 * Preconditions: `pnpm infra:up` and `pnpm dev` running locally.
 */

test.beforeEach(() => clearRateLimits())

/** Leaves via the sidebar without waiting for "Saved" — that's the point —
 * and asserts the pending change is still sent to the server and accepted.
 * Waiting for that response before any full-page reload matters: a hard
 * reload would abort the request (the change would then survive only as a
 * local draft, which is the recovery path, not what this test checks). */
async function leaveImmediatelyAndExpectSave(
  page: Page,
  sectionLink: string,
  resourcePath: string,
): Promise<void> {
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' && response.url().includes(resourcePath),
    { timeout: 10_000 },
  )
  await page.getByRole('link', { name: sectionLink, exact: true }).click()
  expect((await saved).ok()).toBe(true)
}

test('entity edit typed just before navigating away is saved', async ({ page }) => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await setUpOwnerWithCampaign(page, 'PW Autosave Entity Owner', `Autosave Entities ${stamp}`)

  await page.getByRole('link', { name: 'World' }).click()
  await page.getByRole('button', { name: 'New entity' }).click()
  await page.getByLabel('Name').fill(`Blackwall ${stamp}`)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByRole('heading', { name: `Blackwall ${stamp}` })).toBeVisible()
  const entityUrl = page.url()

  await page.getByRole('link', { name: 'Edit' }).click()
  await page.getByLabel('Summary').fill('Frontier town where the Northern Wall meets the Velis road.')
  await expect(page.getByText('Waiting to save…')).toBeVisible()
  await leaveImmediatelyAndExpectSave(page, 'World', '/entities/')

  await page.goto(entityUrl)
  await expect(
    page.getByText('Frontier town where the Northern Wall meets the Velis road.'),
  ).toBeVisible({ timeout: 10_000 })
})

test('session edit typed just before navigating away is saved', async ({ page }) => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await setUpOwnerWithCampaign(page, 'PW Autosave Session Owner', `Autosave Sessions ${stamp}`)

  await page.getByRole('link', { name: 'Sessions' }).click()
  await page.getByRole('button', { name: 'New session' }).click()
  await page.getByLabel('Title').fill(`Draft title ${stamp}`)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByRole('heading', { name: new RegExp(`Draft title ${stamp}`) })).toBeVisible()
  const sessionUrl = page.url()

  await page.getByRole('link', { name: 'Edit' }).click()
  await page.getByLabel('Title').fill(`Into Stonewater Pass ${stamp}`)
  await leaveImmediatelyAndExpectSave(page, 'Sessions', '/sessions/')

  await page.goto(sessionUrl)
  await expect(
    page.getByRole('heading', { name: new RegExp(`Into Stonewater Pass ${stamp}`) }),
  ).toBeVisible({ timeout: 10_000 })
})

test('plot thread edit typed just before navigating away is saved', async ({ page }) => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await setUpOwnerWithCampaign(page, 'PW Autosave Thread Owner', `Autosave Threads ${stamp}`)

  await page.getByRole('link', { name: 'Threads' }).click()
  await page.getByRole('button', { name: 'New plot thread' }).click()
  await page.getByLabel('Title').fill(`The Missing Caravan ${stamp}`)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByRole('heading', { name: `The Missing Caravan ${stamp}` })).toBeVisible()
  const threadUrl = page.url()

  await page.getByRole('link', { name: 'Edit' }).click()
  await page.getByLabel('Summary').fill('The autumn caravan from Velis never reached Blackwall.')
  await leaveImmediatelyAndExpectSave(page, 'Threads', '/plot-threads/')

  await page.goto(threadUrl)
  await expect(
    page.getByText('The autumn caravan from Velis never reached Blackwall.'),
  ).toBeVisible({ timeout: 10_000 })
})
