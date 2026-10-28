import { expect, test, type Page } from '@playwright/test'
import { clearRateLimits, setUpOwnerWithCampaign, sidebarLink } from './helpers'

/**
 * Session and plot-thread editors get the entity editor's safety: leaving
 * saves first (or pauses with an explanation), offline edits survive in
 * IndexedDB, and a concurrent edit is compared before anything is
 * overwritten.
 *
 * Preconditions: `pnpm infra:up` and `pnpm dev` running locally.
 */

test.beforeEach(() => clearRateLimits())

const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const kinds = [
  { kind: 'session', section: 'Sessions', newButton: 'New session', view: 'View session', api: '/sessions/' },
  { kind: 'plot thread', section: 'Threads', newButton: 'New plot thread', view: 'View plot thread', api: '/plot-threads/' },
] as const

for (const k of kinds) {
  test.describe(`${k.kind} editor`, () => {
    async function setUp(page: Page, label: string) {
      const id = stamp()
      await setUpOwnerWithCampaign(page, `PW ${k.kind} Safety`, `${k.section} Safety ${label} ${id}`)
      await sidebarLink(page, k.section).click()
      await page.getByRole('button', { name: k.newButton }).click()
      await page.getByLabel('Title').fill(`Record ${id}`)
      await page.getByRole('button', { name: 'Create', exact: true }).click()
      await expect(page.getByRole('link', { name: 'Edit' })).toBeVisible()
      const detailUrl = page.url()
      await page.getByRole('link', { name: 'Edit' }).click()
      await expect(page.getByLabel('Title')).toHaveValue(`Record ${id}`)
      return { detailUrl, title: `Record ${id}` }
    }

    test('typing then leaving (View, sidebar, Back) saves first, once', async ({ page }) => {
      const { detailUrl } = await setUp(page, 'Leave')
      const patches: string[] = []
      page.on('request', (r) => {
        if (r.method() === 'PATCH' && r.url().includes(k.api)) patches.push(r.postDataJSON()?.title)
      })
      await page.getByLabel('Title').fill('Saved via View')
      await page.getByRole('button', { name: k.view }).click()
      await expect(page).toHaveURL(detailUrl)
      await expect(page.getByRole('heading', { name: /Saved via View/ })).toBeVisible()
      expect(patches).toEqual(['Saved via View'])

      await page.getByRole('link', { name: 'Edit' }).click()
      await page.getByLabel('Title').fill('Saved via Back')
      await page.goBack()
      await expect(page).toHaveURL(detailUrl)
      await expect(page.getByRole('heading', { name: /Saved via Back/ })).toBeVisible()

      await page.getByRole('link', { name: 'Edit' }).click()
      await page.getByLabel('Title').fill('Saved via sidebar')
      await sidebarLink(page, 'World').click()
      await expect(page.getByRole('heading', { level: 1, name: 'World' })).toBeVisible()
      await page.goto(detailUrl)
      await expect(page.getByRole('heading', { name: /Saved via sidebar/ })).toBeVisible()
    })

    test('leaving during a slow save waits for it and the edit queued behind it', async ({ page }) => {
      const { detailUrl } = await setUp(page, 'Slow')
      await page.route(`**${k.api}*`, async (route) => {
        if (route.request().method() === 'PATCH') await new Promise((r) => setTimeout(r, 1500))
        await route.continue()
      })
      await page.getByLabel('Title').fill('First title')
      await expect(page.getByText('Saving…')).toBeVisible({ timeout: 10_000 })
      await page.getByLabel('Title').fill('Second title')
      await page.getByRole('button', { name: k.view }).click()
      await expect(page).toHaveURL(detailUrl, { timeout: 15_000 })
      await expect(page.getByRole('heading', { name: /Second title/ })).toBeVisible()
    })

    test('a failed save pauses leaving; Try again saves and continues', async ({ page }) => {
      const { detailUrl } = await setUp(page, 'Fail')
      let fail = true
      await page.route(`**${k.api}*`, async (route) => {
        if (route.request().method() === 'PATCH' && fail) {
          await route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Boom"}' })
          return
        }
        await route.continue()
      })
      await page.getByLabel('Title').fill('Survives failure')
      await page.getByRole('button', { name: k.view }).click()
      const dialog = page.getByRole('dialog', { name: 'Your latest changes couldn’t be saved' })
      await expect(dialog).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(page.getByLabel('Title')).toHaveValue('Survives failure')
      await page.getByRole('button', { name: k.view }).click()
      fail = false
      await dialog.getByRole('button', { name: 'Try again' }).click()
      await expect(page).toHaveURL(detailUrl)
      await expect(page.getByRole('heading', { name: /Survives failure/ })).toBeVisible()
    })

    test('offline: leave keeping the change on this device, restore it later', async ({ page, context }) => {
      const { detailUrl } = await setUp(page, 'Offline')
      await context.setOffline(true)
      await page.getByLabel('Title').fill('Written offline')
      await expect(page.getByText('Offline — saved on this device')).toBeVisible({ timeout: 10_000 })
      await page.getByRole('button', { name: k.view }).click()
      const dialog = page.getByRole('dialog', { name: 'You’re offline' })
      await dialog.getByRole('button', { name: 'Leave, keep on this device' }).click()
      await expect(page).toHaveURL(detailUrl)

      await context.setOffline(false)
      await page.goto(`${detailUrl}/edit`)
      await page.getByRole('button', { name: 'Restore' }).click()
      await expect(page.getByLabel('Title')).toHaveValue('Written offline')
      await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10_000 })
    })

    test('a concurrent edit is compared and kept only after confirmation', async ({ page, context }) => {
      const { detailUrl } = await setUp(page, 'Conflict')
      const other = await context.newPage()
      await other.goto(`${detailUrl}/edit`)
      await other.getByLabel('Title').fill('Their title')
      await expect(other.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10_000 })
      await other.close()

      await page.getByLabel('Title').fill('My title')
      await expect(page.getByText('Changed elsewhere', { exact: true })).toBeVisible({ timeout: 10_000 })
      await sidebarLink(page, 'World').click()
      const leave = page.getByRole('dialog', { name: `This ${k.kind} was changed elsewhere` })
      await expect(leave).toBeVisible()
      await leave.getByRole('button', { name: 'Review differences' }).click()
      const compare = page.getByRole('dialog', { name: 'Changed elsewhere' })
      await expect(compare.getByRole('list', { name: 'Differences' }).getByText('Their title')).toBeVisible()
      await compare.getByRole('button', { name: 'Keep my changes…' }).click()
      await compare.getByRole('button', { name: 'Overwrite with my version' }).click()
      await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10_000 })
      await page.goto(detailUrl)
      await expect(page.getByRole('heading', { name: /My title/ })).toBeVisible()
    })
  })
}
