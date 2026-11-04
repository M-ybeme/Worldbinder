import { expect, test, type Page } from '@playwright/test'
import { clearRateLimits } from './helpers'
import { seedMap } from './maps-helpers'

/**
 * Maps workspace, Stage 3 — At the Table, against the real API: a GM's
 * screen shown to the players carries nothing GM-only (the page only ever
 * asks the server for the player view), no navigation or edit controls,
 * keeps the view both ways, and never carries a selection over.
 *
 * Preconditions: `pnpm infra:up` and `pnpm dev` (incl. the worker) running.
 */

test.beforeEach(() => clearRateLimits())

const surface = (page: Page) => page.getByRole('application', { name: /^Map: / })
const pinButton = (page: Page, name: string) => surface(page).getByRole('button', { name, exact: true })
const zoomLabel = (page: Page) => page.locator('.wb-map-toolbar__zoom')

const SECRETS = ['Secret door', 'Hidden camp', 'The Pale Court', 'GM secrets', 'GM only']

async function seedTable(page: Page, request: Parameters<typeof seedMap>[1], label: string) {
  return seedMap(page, request, label, [
    { name: 'Blackwall', x: 0.25, y: 0.4, layer: 'towns', summary: 'Frontier town by the old keep.' },
    { name: 'Velis', x: 0.75, y: 0.6, layer: 'towns' },
    // Right on top of Velis: the GM sees a group of two; the table must not.
    { name: 'Secret door', x: 0.751, y: 0.601, gmPin: true },
    { name: 'Hidden camp', x: 0.4, y: 0.2, layer: 'secrets' },
    { name: 'The Pale Court', x: 0.6, y: 0.3, gmEntry: true },
  ])
}

test('a GM at the table shows players only the player view, and gets back to the same view', async ({
  page,
  request,
}) => {
  const world = await seedTable(page, request, 'table')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(world.url)
  await expect(surface(page).getByRole('button', { name: /^2 pins here/ })).toBeVisible()

  // A GM-only pin selected and the map zoomed in the GM's own view.
  await page.getByRole('complementary', { name: 'Pins panel' }).getByRole('button', { name: /^The Pale Court/ }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'The Pale Court' })).toBeVisible()
  await surface(page).focus()
  await page.keyboard.press('+')
  await page.keyboard.press('ArrowLeft')
  const zoom = await zoomLabel(page).textContent()

  const mapRequests: string[] = []
  page.on('request', (req) => {
    if (req.url().includes(`/maps/${world.mapId}`)) mapRequests.push(req.url())
  })
  await page.getByRole('button', { name: 'At the table', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/maps/${world.mapId}/table$`))

  // Only the player view, on its own: no shell, no edit controls.
  await expect(page.getByRole('note')).toContainText('Players’ view')
  await expect(pinButton(page, 'Blackwall')).toBeVisible()
  await expect(pinButton(page, 'Velis')).toBeVisible()
  await expect(surface(page).locator('.wb-map-pin, .wb-map-cluster')).toHaveCount(2)
  for (const secret of SECRETS) await expect(page.getByText(secret)).toHaveCount(0)
  expect(await page.content()).not.toMatch(/Secret door|Hidden camp|The Pale Court|GM secrets/)
  expect(mapRequests.length).toBeGreaterThan(0)
  expect(mapRequests.every((url) => url.includes('audience=players'))).toBe(true)
  await expect(page.getByRole('navigation')).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Mode' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Add pin|Map actions|pins panel/ })).toHaveCount(0)
  // Search is the GM's own view: its shortcut does nothing here.
  await page.keyboard.press('Control+k')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // Nothing selected over from the GM's view; the view itself came along.
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(0)
  await expect(zoomLabel(page)).toHaveText(zoom!)

  // Selecting shows the summary, and nothing that would use the GM's access.
  await pinButton(page, 'Blackwall').click()
  const panel = page.locator('.wb-table__panel')
  await expect(panel.getByRole('heading', { level: 2, name: 'Blackwall' })).toBeVisible()
  await expect(panel.getByText('Frontier town by the old keep.')).toBeVisible()
  await expect(panel.getByRole('link')).toHaveCount(0)
  await expect(panel.getByRole('list', { name: 'Connections' })).toHaveCount(0)

  // Escape: first the selection, then back to the workspace, same view.
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await surface(page).focus()
  await page.keyboard.press('+')
  const tableZoom = await zoomLabel(page).textContent()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(new RegExp(`/maps/${world.mapId}$`))
  await expect(zoomLabel(page)).toHaveText(tableZoom!)
  await expect(page.getByRole('navigation', { name: 'Campaign', exact: true })).toBeVisible()
})

test('a GM-only map has no player view: the button is off and the route says why', async ({ page, request }) => {
  const world = await seedTable(page, request, 'tablegm')
  await world.send('patch', `/campaigns/${world.campaignId}/maps/${world.mapId}`, { visibility: 'gm_only' })
  await page.setViewportSize({ width: 1280, height: 860 })
  await page.goto(world.url)
  await expect(page.getByRole('button', { name: 'At the table (not for GM-only maps)' })).toBeDisabled()
  await page.goto(`${world.url}/table`)
  await expect(page.getByText(/no players’ view/)).toBeVisible()
  for (const secret of SECRETS.slice(0, 4)) await expect(page.getByText(secret)).toHaveCount(0)
  await page.getByRole('link', { name: 'Back to the map' }).click()
  await expect(page).toHaveURL(new RegExp(`/maps/${world.mapId}$`))
})

for (const width of [390, 360]) {
  test(`At the table on a phone (${width}px): fills the screen, controls in reach`, async ({ browser, request }) => {
    const context = await browser.newContext({ viewport: { width, height: 760 }, hasTouch: true, isMobile: true })
    const page = await context.newPage()
    const world = await seedTable(page, request, `table${width}`)
    await page.goto(`${world.url}/table`)
    await expect(pinButton(page, 'Blackwall')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    const map = (await surface(page).boundingBox())!
    expect(map.height).toBeGreaterThan(600)
    const back = (await page.getByRole('button', { name: 'Back to the map' }).boundingBox())!
    expect(back.width).toBeGreaterThanOrEqual(44)
    expect(back.height).toBeGreaterThanOrEqual(44)
    await expect(page.getByRole('note')).toContainText('Players’ view')
    // Shortened on screen; still read out in full.
    await expect(page.getByRole('note')).toContainText('GM-only pins and layers are hidden')
    await pinButton(page, 'Velis').tap()
    const panel = page.locator('.wb-table__panel')
    await expect(panel.getByRole('heading', { level: 2, name: 'Velis' })).toBeVisible()
    // The panel doesn't cover the zoom controls.
    const panelBox = (await panel.boundingBox())!
    const zoomIn = (await page.getByRole('button', { name: 'Zoom in' }).boundingBox())!
    expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(zoomIn.y)
    await page.getByRole('button', { name: 'Back to the map' }).tap()
    await expect(page).toHaveURL(new RegExp(`/maps/${world.mapId}$`))
    await context.close()
  })
}
