import { expect, test, type Page } from '@playwright/test'
import { clearRateLimits } from './helpers'
import { API, joinAsPlayer, seedMap } from './maps-helpers'

/**
 * Maps workspace, Stage 2, against the real API: finding pins (search,
 * kinds, layers), overlapping pins offered as a choice (mouse, keyboard,
 * touch), what a player can and can't see, the unsaved-changes guard,
 * keyboard nudges in edit mode, and the phone bottom sheet.
 *
 * Preconditions: `pnpm infra:up` and `pnpm dev` (incl. the worker) running.
 */

test.beforeEach(() => clearRateLimits())

const surface = (page: Page) => page.getByRole('application', { name: /^Map: / })
const pinButton = (page: Page, name: string) => surface(page).getByRole('button', { name, exact: true })
const inspector = (page: Page) => page.getByRole('complementary', { name: 'Pins panel' })
const mapPins = (page: Page) => surface(page).locator('.wb-map-pin')

// Three pins a few pixels apart (they overlap at the fitted zoom), one apart.
const HUDDLE = [
  { name: 'Ashford', x: 0.5, y: 0.5 },
  { name: 'Brightwater', x: 0.512, y: 0.5 },
  { name: 'Cinder Hollow', x: 0.5, y: 0.515 },
  { name: 'Far Reach', x: 0.15, y: 0.2 },
]

test('search, kind filter and layers narrow both the list and the map', async ({ page, request }) => {
  const world = await seedMap(page, request, 'find', [
    { name: 'Blackwall', x: 0.25, y: 0.4, layer: 'towns', summary: 'Frontier town by the old keep.' },
    { name: 'Velis', x: 0.75, y: 0.6, layer: 'towns' },
    { name: 'Mara Voss', x: 0.4, y: 0.7, type: 'character' },
    { name: 'The smugglers’ cache', x: 0.6, y: 0.2, layer: 'secrets', gmPin: true },
  ])
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(world.url)
  await expect(mapPins(page)).toHaveCount(4)

  // Search matches names and entry summaries.
  const search = inspector(page).getByRole('searchbox', { name: 'Find a pin' })
  await search.fill('old keep')
  await expect(inspector(page).getByText('Showing 1 of 4')).toBeVisible()
  await expect(mapPins(page)).toHaveCount(1)
  await expect(pinButton(page, 'Blackwall')).toBeVisible()
  await search.fill('nothing like this')
  await expect(inspector(page).getByText('No pins match.')).toBeVisible()
  await expect(mapPins(page)).toHaveCount(0)
  await inspector(page).getByRole('button', { name: 'Clear' }).click()
  await expect(search).toHaveValue('')
  await expect(mapPins(page)).toHaveCount(4)

  // Kinds, and (for the GM) visibility.
  const filters = inspector(page).getByRole('group', { name: 'Filter pins' })
  await filters.getByRole('button', { name: /^Character/ }).click()
  await expect(mapPins(page)).toHaveCount(1)
  await expect(pinButton(page, 'Mara Voss')).toBeVisible()
  await filters.getByRole('button', { name: /^Character/ }).click()
  await filters.getByRole('button', { name: 'GM only' }).click()
  await expect(mapPins(page)).toHaveCount(1)
  await expect(pinButton(page, 'The smugglers’ cache (GM only)')).toBeVisible()
  await inspector(page).getByRole('button', { name: 'Clear' }).click()

  // Hiding a layer hides its pins on the map; the list still finds them.
  await inspector(page).getByRole('checkbox', { name: 'Settlements' }).uncheck()
  await expect(mapPins(page)).toHaveCount(2)
  await expect(inspector(page).getByText('(hidden on the map)')).toBeVisible()
  await expect(inspector(page).getByRole('button', { name: /^Velis/ })).toBeVisible()
})

test('overlapping pins: one marker, and a chooser by mouse and keyboard', async ({ page, request }) => {
  const world = await seedMap(page, request, 'overlap', HUDDLE)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(world.url)

  const cluster = surface(page).getByRole('button', { name: /^3 pins here/ })
  await expect(cluster).toBeVisible()
  await expect(cluster).toHaveAccessibleName('3 pins here: Ashford, Brightwater, Cinder Hollow')
  await expect(pinButton(page, 'Far Reach')).toBeVisible()

  // Keyboard: Enter opens it with focus on the first choice; Escape closes
  // it and returns to the marker.
  await cluster.focus()
  await page.keyboard.press('Enter')
  const chooser = page.getByRole('dialog', { name: '3 pins here' })
  await expect(chooser.getByRole('button', { name: /^Ashford/ })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(chooser).toHaveCount(0)
  await expect(cluster).toBeFocused()

  // Arrow keys move between choices; Enter picks one.
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowDown')
  await expect(chooser.getByRole('button', { name: /^Brightwater/ })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(inspector(page).getByRole('heading', { level: 2, name: 'Brightwater' })).toBeVisible()
  // The chosen pin stands on its own; the other two stay grouped.
  await expect(pinButton(page, 'Brightwater')).toBeVisible()
  await expect(surface(page).getByRole('button', { name: /^2 pins here/ })).toBeVisible()

  // Mouse.
  await surface(page).getByRole('button', { name: /^2 pins here/ }).click()
  await page.getByRole('dialog', { name: '2 pins here' }).getByRole('button', { name: /^Cinder Hollow/ }).click()
  await expect(inspector(page).getByRole('heading', { level: 2, name: 'Cinder Hollow' })).toBeVisible()

  // Close enough, they separate.
  await surface(page).focus()
  for (let i = 0; i < 12; i += 1) await page.keyboard.press('+')
  await expect(surface(page).getByRole('button', { name: /pins here/ })).toHaveCount(0)
  for (const name of ['Ashford', 'Brightwater', 'Cinder Hollow']) await expect(pinButton(page, name)).toBeVisible()
})

test('a player sees no GM-only pins, layers, counts or filters — on the map, in the list or in a chooser', async ({
  page,
  request,
  browser,
}) => {
  const world = await seedMap(page, request, 'player', [
    { name: 'Blackwall', x: 0.25, y: 0.4, layer: 'towns' },
    // GM-only pin right on top of a public one: no chooser for the player.
    { name: 'Velis', x: 0.75, y: 0.6, layer: 'towns' },
    { name: 'Secret door', x: 0.751, y: 0.601, gmPin: true },
    // A public pin on a GM-only layer, and one linked to a GM-only entry.
    { name: 'Hidden camp', x: 0.4, y: 0.2, layer: 'secrets' },
    { name: 'The Pale Court', x: 0.6, y: 0.3, gmEntry: true },
  ])

  // The GM sees all five, the overlap and the GM-only layer.
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(world.url)
  await expect(surface(page).getByRole('button', { name: /^2 pins here/ })).toBeVisible()
  await expect(inspector(page).getByRole('checkbox', { name: 'GM secrets' })).toBeVisible()

  const playerContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const player = await playerContext.newPage()
  await joinAsPlayer(player, world)
  await player.goto(world.url)
  await expect(pinButton(player, 'Blackwall')).toBeVisible()
  await expect(pinButton(player, 'Velis')).toBeVisible()
  await expect(mapPins(player)).toHaveCount(2)
  await expect(surface(player).getByRole('button', { name: /pins here/ })).toHaveCount(0)

  const panel = inspector(player)
  await expect(panel.locator('.wb-mapws__count')).toHaveText('2')
  await expect(panel.getByRole('checkbox', { name: 'GM secrets' })).toHaveCount(0)
  await expect(panel.getByRole('button', { name: 'GM only' })).toHaveCount(0)
  await expect(panel.getByRole('button', { name: 'Edit' })).toHaveCount(0)
  for (const secret of ['Secret door', 'Hidden camp', 'The Pale Court', 'GM secrets', 'GM only']) {
    await expect(player.getByText(secret)).toHaveCount(0)
  }
  // Search can't reach them either.
  await panel.getByRole('searchbox', { name: 'Find a pin' }).fill('Secret')
  await expect(panel.getByText('No pins match.')).toBeVisible()

  await playerContext.close()
  // (The API leaves them out for players: maps.e2e-spec covers that.)
  const gmView = await (
    await request.get(`${API}/campaigns/${world.campaignId}/maps/${world.mapId}`, { headers: world.headers })
  ).json()
  expect(gmView.pins).toHaveLength(5)
})

test('edit mode: unsaved pin changes are never dropped silently', async ({ page, request }) => {
  const world = await seedMap(page, request, 'guard', [
    { name: 'Blackwall', x: 0.3, y: 0.3 },
    { name: 'Velis', x: 0.7, y: 0.6 },
  ])
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(world.url)
  await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Edit' }).click()
  await pinButton(page, 'Blackwall').click()
  await page.getByLabel(/^Label/).fill('Blackwall Keep')

  // Another pin: asked first; Keep editing keeps the change.
  await pinButton(page, 'Velis').click()
  const discard = page.getByRole('dialog', { name: 'Discard your changes to this pin?' })
  await expect(discard).toBeVisible()
  await discard.getByRole('button', { name: 'Keep editing' }).click()
  await expect(page.getByLabel(/^Label/)).toHaveValue('Blackwall Keep')

  // View mode: asked too.
  await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'View' }).click()
  await expect(discard).toBeVisible()
  await discard.getByRole('button', { name: 'Keep editing' }).click()

  // Leaving the page: asked; Discard leaves, and nothing was saved.
  await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Maps' }).click()
  await expect(discard).toBeVisible()
  await discard.getByRole('button', { name: 'Discard changes' }).click()
  await expect(page).toHaveURL(new RegExp(`/campaign/${world.campaignId}/maps$`))
  const map = await (
    await request.get(`${API}/campaigns/${world.campaignId}/maps/${world.mapId}`, { headers: world.headers })
  ).json()
  expect(map.pins.map((pin: { label: string | null }) => pin.label)).toEqual([null, null])

  // Saved changes don't ask.
  await page.goto(world.url)
  await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Edit' }).click()
  await pinButton(page, 'Blackwall').click()
  await page.getByLabel(/^Label/).fill('Blackwall Keep')
  await page.getByRole('button', { name: 'Save pin' }).click()
  await expect(pinButton(page, 'Blackwall Keep')).toBeVisible()
  await pinButton(page, 'Velis').click()
  await expect(discard).toHaveCount(0)
})

test('edit mode: arrow keys nudge a focused pin, saved once the keys stop', async ({ page, request }) => {
  const world = await seedMap(page, request, 'nudge', [{ name: 'Blackwall', x: 0.3, y: 0.3 }])
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(world.url)
  // View mode: arrows on a pin do nothing to it.
  await pinButton(page, 'Blackwall').focus()
  await page.keyboard.press('ArrowRight')
  await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Edit' }).click()
  await pinButton(page, 'Blackwall').focus()
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Shift+ArrowDown')
  const saved = async () => {
    const map = await (
      await request.get(`${API}/campaigns/${world.campaignId}/maps/${world.mapId}`, { headers: world.headers })
    ).json()
    const pin = map.pins[0] as { xNormalized: number; yNormalized: number }
    return [Number(pin.xNormalized.toFixed(3)), Number(pin.yNormalized.toFixed(3))]
  }
  await expect.poll(saved).toEqual([0.32, 0.32])
  await expect(pinButton(page, 'Blackwall')).toBeFocused()
})

for (const width of [360, 390]) {
  test(`phone (${width}px): the map comes first, pins in a bottom sheet, touch chooser`, async ({
    browser,
    request,
  }) => {
    const context = await browser.newContext({ viewport: { width, height: 760 }, hasTouch: true, isMobile: true })
    const page = await context.newPage()
    const world = await seedMap(page, request, `phone${width}`, HUDDLE)
    await page.goto(world.url)
    const handle = page.getByRole('button', { name: 'Pins (4)' })
    await expect(handle).toBeVisible()
    await expect(handle).toHaveAttribute('aria-expanded', 'false')
    // Nothing scrolls sideways; the map is taller than the sheet's handle.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    const map = (await surface(page).boundingBox())!
    expect(map.height).toBeGreaterThan(400)
    // The zoom controls sit above the sheet, not under it.
    const zoom = (await page.getByRole('button', { name: 'Zoom in' }).boundingBox())!
    const sheet = (await handle.boundingBox())!
    expect(zoom.y + zoom.height).toBeLessThanOrEqual(sheet.y)
    expect(zoom.height).toBeGreaterThanOrEqual(44)

    // Tap the huddle: the chooser comes up in the sheet.
    await surface(page).getByRole('button', { name: /^3 pins here/ }).tap()
    const chooser = page.getByRole('dialog', { name: '3 pins here' })
    await expect(chooser).toBeVisible()
    await chooser.getByRole('button', { name: /^Brightwater/ }).tap()
    await expect(inspector(page).getByRole('heading', { level: 2, name: 'Brightwater' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Show the map' })).toBeVisible()

    // Collapse: the handle names the selected pin.
    await page.getByRole('button', { name: 'Show the map' }).tap()
    await expect(page.getByRole('button', { name: 'Brightwater' }).and(page.locator('.wb-mapws__sheet-handle'))).toBeVisible()
    await expect(inspector(page).getByRole('heading', { level: 2 })).toHaveCount(0)

    // From the list: expand, search, pick.
    await page.locator('.wb-mapws__sheet-handle').tap()
    await inspector(page).getByRole('searchbox', { name: 'Find a pin' }).fill('Far')
    await inspector(page).getByRole('button', { name: /^Far Reach/ }).tap()
    await expect(inspector(page).getByRole('heading', { level: 2, name: 'Far Reach' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await context.close()
  })
}
