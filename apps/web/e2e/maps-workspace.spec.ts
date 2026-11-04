import { expect, test, type Page } from '@playwright/test'
import { clearRateLimits } from './helpers'
import { API, seedMap } from './maps-helpers'

/**
 * The map workspace against the real API, storage and worker: saved pins
 * where they were placed, the map filling the page, the switcher and
 * inspector, the view kept across resizes, keyboard control, and the
 * existing edit flows (add, drag, delete).
 *
 * Preconditions: `pnpm infra:up` and `pnpm dev` (incl. the worker) running.
 */

test.beforeEach(() => clearRateLimits())

const surface = (page: Page) => page.getByRole('application', { name: /^Map: / })
const pinButton = (page: Page, name: string) =>
  surface(page).getByRole('button', { name, exact: true })

async function center(page: Page, name: string) {
  // The dot is the pin's point; the button also holds its label.
  const box = (await pinButton(page, name).locator('.wb-map-pin__dot').boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test('saved pins sit where they were placed; the map fills the page; switcher and inspector work', async ({
  page,
  request,
}) => {
  const world = await seedMap(page, request, 'ws', [
    {
      name: 'Blackwall',
      x: 0.25,
      y: 0.4,
      layer: 'towns',
      summary: 'Frontier town by the old keep.',
    },
    { name: 'Velis', x: 0.75, y: 0.6, layer: 'towns' },
  ])
  const other = await world.send('post', `/campaigns/${world.campaignId}/maps`, {
    name: 'Velis — Lower City',
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(world.url)
  await expect(pinButton(page, 'Blackwall')).toBeVisible()

  // No page scroll: the workspace is exactly the window.
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(900)

  // Each pin is at its saved fraction of the image.
  const image = (await page.locator('.wb-map-canvas').boundingBox())!
  for (const [name, x, y] of [
    ['Blackwall', 0.25, 0.4],
    ['Velis', 0.75, 0.6],
  ] as const) {
    const pin = await center(page, name)
    expect(Math.abs(pin.x - (image.x + x * image.width))).toBeLessThanOrEqual(2)
    expect(Math.abs(pin.y - (image.y + y * image.height))).toBeLessThanOrEqual(2)
  }

  // Selecting a pin shows what it is, and the way to its article.
  await pinButton(page, 'Blackwall').click()
  const inspector = page.getByRole('complementary', { name: 'Pins panel' })
  await expect(inspector.getByRole('heading', { level: 2, name: 'Blackwall' })).toBeVisible()
  await expect(inspector.getByText('Frontier town by the old keep.')).toBeVisible()
  await expect(inspector.getByRole('link', { name: 'Open article' })).toHaveAttribute(
    'href',
    `/app/campaign/${world.campaignId}/world/${world.entityIds.Blackwall}`,
  )
  // Clicking empty map clears it.
  const map = (await surface(page).boundingBox())!
  await page.mouse.click(map.x + 20, map.y + 20)
  await expect(inspector.getByRole('heading', { level: 2, name: 'Blackwall' })).toHaveCount(0)

  // The inspector folds away, and stays that way after a reload.
  const widthWith = map.width
  await page.getByRole('button', { name: 'Hide pins panel' }).click()
  await expect(inspector).toHaveCount(0)
  expect((await surface(page).boundingBox())!.width).toBeGreaterThan(widthWith + 300)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Show pins panel' })).toBeVisible()
  await page.getByRole('button', { name: 'Show pins panel' }).click()

  // The switcher moves to another map.
  await page.getByRole('button', { name: 'Map: The Northern March. Switch map' }).click()
  await page.getByRole('menuitem', { name: 'Velis — Lower City' }).click()
  await expect(page).toHaveURL(new RegExp(`/maps/${other.id}$`))
})

test('the view stays put when the inspector or the sidebar changes the map’s size', async ({
  page,
  request,
}) => {
  const world = await seedMap(page, request, 'view', [
    { name: 'Blackwall', x: 0.3, y: 0.35 },
    { name: 'Velis', x: 0.8, y: 0.7 },
  ])
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(world.url)
  // Select from the list: it brings the pin to the middle of the map.
  const inspector = page.getByRole('complementary', { name: 'Pins panel' })
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await inspector.getByRole('button', { name: /^Blackwall/ }).click()
  const middle = async () => {
    const box = (await surface(page).boundingBox())!
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }
  const near = async () => {
    const pin = await center(page, 'Blackwall')
    const mid = await middle()
    return Math.max(Math.abs(pin.x - mid.x), Math.abs(pin.y - mid.y))
  }
  await expect.poll(near).toBeLessThanOrEqual(2)
  const zoomBefore = await page.locator('.wb-map-toolbar__zoom').textContent()
  const spacing = async () => (await center(page, 'Velis')).x - (await center(page, 'Blackwall')).x

  const before = await spacing()
  // Centre and on-screen scale both held. Polled: the sidebar's width is
  // animated, and the map follows it frame by frame, so check once it settles.
  const held = async () =>
    (await near()) <= 2 && Math.abs((await spacing()) - before) <= 2
  await page.getByRole('button', { name: 'Hide pins panel' }).click()
  await expect.poll(held).toBe(true)
  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await expect.poll(held).toBe(true)
  await page.getByRole('button', { name: 'Expand sidebar' }).click()
  await page.getByRole('button', { name: 'Show pins panel' }).click()
  await expect.poll(held).toBe(true)
  expect(zoomBefore).not.toBe('100%')
})

test('keyboard: pan with arrows, zoom with + and −, 0 shows the whole map, Escape clears the selection', async ({
  page,
  request,
}) => {
  const world = await seedMap(page, request, 'keys', [{ name: 'Blackwall', x: 0.5, y: 0.5 }])
  await page.setViewportSize({ width: 1280, height: 860 })
  await page.goto(world.url)
  await pinButton(page, 'Blackwall').click()
  await surface(page).focus()
  await page.keyboard.press('+')
  await expect(page.locator('.wb-map-toolbar__zoom')).toHaveText('125%')
  const start = await center(page, 'Blackwall')
  await page.keyboard.press('ArrowLeft')
  await expect.poll(async () => (await center(page, 'Blackwall')).x - start.x).toBeCloseTo(80, 0)
  await page.keyboard.press('-')
  await expect(page.locator('.wb-map-toolbar__zoom')).toHaveText('100%')
  await page.keyboard.press('0')
  await expect(page.locator('.wb-map-toolbar__zoom')).toHaveText('100%')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { level: 2, name: 'Blackwall' })).toHaveCount(0)
})

test('edit mode: add a pin by clicking the map, drag one to move it, delete one — all saved', async ({
  page,
  request,
}) => {
  const world = await seedMap(page, request, 'edit', [{ name: 'Blackwall', x: 0.3, y: 0.3 }])
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(world.url)
  await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Edit' }).click()
  await page.getByRole('button', { name: 'Add pin' }).click()
  const image = (await page.locator('.wb-map-canvas').boundingBox())!
  await page.mouse.click(image.x + image.width * 0.6, image.y + image.height * 0.5)
  await page.getByLabel(/^Label/).fill('The old milestone')
  await page.getByRole('button', { name: 'Save pin' }).click()
  await expect(pinButton(page, 'The old milestone')).toBeVisible()

  // Drag Blackwall to the right.
  const from = await center(page, 'Blackwall')
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 100, from.y + 50, { steps: 8 })
  await page.mouse.up()

  await expect
    .poll(async () => {
      const res = await request.get(`${API}/campaigns/${world.campaignId}/maps/${world.mapId}`, {
        headers: world.headers,
      })
      const pins = (await res.json()).pins as {
        label: string | null
        locationEntityName: string | null
        xNormalized: number
        yNormalized: number
      }[]
      const moved = pins.find((pin) => pin.locationEntityName === 'Blackwall')!
      const added = pins.find((pin) => pin.label === 'The old milestone')!
      return [
        Math.abs(moved.xNormalized - (0.3 + 100 / image.width)) < 0.01,
        Math.abs(moved.yNormalized - (0.3 + 50 / image.height)) < 0.01,
        Math.abs(added.xNormalized - 0.6) < 0.01 && Math.abs(added.yNormalized - 0.5) < 0.01,
      ]
    })
    .toEqual([true, true, true])

  // Delete the new pin: in edit mode, selecting a pin opens its fields.
  await pinButton(page, 'The old milestone').click()
  await page.getByRole('button', { name: 'Delete pin' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete pin' }).click()
  await expect(pinButton(page, 'The old milestone')).toHaveCount(0)
  await page.reload()
  await expect(pinButton(page, 'Blackwall')).toBeVisible()
  await expect(pinButton(page, 'The old milestone')).toHaveCount(0)
})
