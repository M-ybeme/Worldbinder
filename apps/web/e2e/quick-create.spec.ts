import { expect, test, type Page } from '@playwright/test'
import { clearRateLimits, setUpOwnerWithCampaign, sidebarLink } from './helpers'

/**
 * Quick-create dialogs (entity, session, plot thread) — including the race
 * behind the intermittent "field is empty, Create stays disabled" failures:
 * the dialog's deferred initial focus used to fire after the user had
 * already started typing and pull focus to the Close button, so the rest
 * of the keystrokes were lost.
 *
 * Preconditions: `pnpm infra:up` and `pnpm dev` running locally.
 */

test.beforeEach(() => clearRateLimits())

const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const flows = [
  { name: 'entity', section: 'World', open: 'New entity', field: 'Name', result: /\/world\/[0-9a-f-]+$/ },
  { name: 'session', section: 'Sessions', open: 'New session', field: 'Title', result: /\/sessions\/[0-9a-f-]+$/ },
  { name: 'plot thread', section: 'Threads', open: 'New plot thread', field: 'Title', result: /\/threads\/[0-9a-f-]+$/ },
] as const

/** Makes the deferred initial focus land well after typing starts —
 * a slow frame, as on a busy machine or a slower browser. */
async function slowAnimationFrames(page: Page) {
  await page.addInitScript(() => {
    window.requestAnimationFrame = (cb) =>
      window.setTimeout(() => cb(performance.now()), 400) as unknown as number
    window.cancelAnimationFrame = (id) => window.clearTimeout(id)
  })
}

for (const flow of flows) {
  test.describe(`${flow.name} quick-create`, () => {
    test('typing straight after opening keeps every keystroke, even with slow frames', async ({
      page,
    }) => {
      await slowAnimationFrames(page)
      const id = stamp()
      await setUpOwnerWithCampaign(page, `PW QC ${flow.name}`, `QC ${flow.name} ${id}`)
      await sidebarLink(page, flow.section).click()
      await page.getByRole('button', { name: flow.open }).click()
      const field = page.getByRole('dialog').getByLabel(flow.field)
      await field.click()
      const text = `Typed fast ${id}`
      // Spans the slowed frame: with the old focus steal, the keystrokes
      // after ~400ms went to the Close button instead.
      await page.keyboard.type(text, { delay: 60 })
      await expect(field).toHaveValue(text)
      await page.getByRole('dialog').getByRole('button', { name: 'Create', exact: true }).click()
      await expect(page).toHaveURL(flow.result)
      await expect(page.getByRole('heading', { level: 1, name: new RegExp(text) })).toBeVisible()
    })

    test('opens on the field, validates, cancels clean, and creates once by keyboard', async ({
      page,
    }) => {
      const id = stamp()
      await setUpOwnerWithCampaign(page, `PW QC2 ${flow.name}`, `QC2 ${flow.name} ${id}`)
      await sidebarLink(page, flow.section).click()
      const posts: string[] = []
      page.on('request', (r) => {
        if (r.method() === 'POST' && /\/(entities|sessions|plot-threads)$/.test(new URL(r.url()).pathname)) {
          posts.push(r.url())
        }
      })

      // Rapid open/close leaves nothing behind.
      for (let i = 0; i < 3; i += 1) {
        await page.getByRole('button', { name: flow.open }).click()
        await page.keyboard.press('Escape')
        await expect(page.getByRole('dialog')).toHaveCount(0)
      }

      await page.getByRole('button', { name: flow.open }).click()
      const dialog = page.getByRole('dialog')
      const field = dialog.getByLabel(flow.field)
      await expect(field).toBeFocused()
      await expect(dialog.getByRole('button', { name: 'Create', exact: true })).toBeDisabled()
      await page.keyboard.type('Will be cancelled')
      await dialog.getByRole('button', { name: 'Cancel' }).click()
      await page.getByRole('button', { name: flow.open }).click()
      await expect(page.getByRole('dialog').getByLabel(flow.field)).toHaveValue('')
      await expect(page.getByRole('dialog').getByLabel(flow.field)).toBeFocused()

      const name = `Keyboard ${id}`
      await page.keyboard.type(name)
      await page.keyboard.press('Enter')
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(flow.result)
      await expect(page.getByRole('heading', { level: 1, name: new RegExp(name) })).toBeVisible()
      expect(posts).toHaveLength(1)
    })
  })
}
