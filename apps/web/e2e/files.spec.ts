import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { clearRateLimits, login, PASSWORD, registerAndVerify } from './helpers'

/**
 * The editor's Files tab against the real API, storage and worker: upload
 * (processed for real), caption, Remove with Undo, permanent Delete after
 * confirmation, and a file shared with another entry that Delete refuses to
 * take away from it — on desktop and at phone width.
 *
 * Preconditions: `pnpm infra:up` and `pnpm dev` (incl. the worker) running.
 */

test.beforeEach(() => clearRateLimits())

const API = 'http://localhost:3000'
// A real 1×1 PNG, so the worker's magic-byte detection accepts it.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)

async function setUp(page: Page, request: APIRequestContext, label: string) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const email = `pw-files-${label}-${stamp}@verify.local`
  await registerAndVerify(page, email, `PW Files ${label}`)
  await login(page, email)
  const auth = await request.post(`${API}/auth/login`, { data: { email, password: PASSWORD } })
  const headers = { Authorization: `Bearer ${(await auth.json()).accessToken}` }
  const post = async (path: string, data: object) => {
    const res = await request.post(`${API}${path}`, { headers, data })
    expect(res.ok(), await res.text()).toBe(true)
    return res.json()
  }
  const campaign = await post('/campaigns', { name: `Files ${label} ${stamp}` })
  const blackwall = await post(`/campaigns/${campaign.id}/entities`, { name: 'Blackwall', entityType: 'location' })
  const guard = await post(`/campaigns/${campaign.id}/entities`, { name: 'Ashen Guard', entityType: 'faction' })
  return {
    filesUrl: (id: string) => `/app/campaign/${campaign.id}/world/${id}/edit/files`,
    blackwall,
    guard,
    linkTo: (attachmentId: string, resourceId: string) =>
      post(`/campaigns/${campaign.id}/attachments/${attachmentId}/link`, { resourceType: 'entity', resourceId }),
    list: async (resourceId: string) =>
      (await request.get(`${API}/campaigns/${campaign.id}/attachments/entity/${resourceId}`, { headers })).json(),
  }
}

test('upload, caption, Remove with Undo, Delete, and a shared file Delete won’t take', async ({ page, request }) => {
  const world = await setUp(page, request, 'desk')
  await page.goto(world.filesUrl(world.blackwall.id))
  const list = page.getByRole('list', { name: 'Files on Blackwall' })

  await test.step('upload two files at once; both are processed and attached', async () => {
    await page.getByLabel('Add files').setInputFiles([
      { name: 'blackwall-town-map.png', mimeType: 'image/png', buffer: PNG },
      { name: 'gate-ledger.txt', mimeType: 'text/plain', buffer: Buffer.from('Tolls collected at the gate.') },
    ])
    await expect(list.getByText('blackwall-town-map.png')).toBeVisible({ timeout: 30_000 })
    await expect(list.getByText('gate-ledger.txt')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('list', { name: 'Uploads' })).toHaveCount(0)
  })

  await test.step('caption', async () => {
    await page.getByRole('button', { name: 'Edit caption of blackwall-town-map.png' }).click()
    await page.getByLabel('Caption', { exact: true }).fill('Town map, autumn 1287')
    await page.getByRole('button', { name: 'Save caption' }).click()
    await expect(list.getByText('Town map, autumn 1287')).toBeVisible()
  })

  await test.step('Remove, then Undo restores the link with its caption', async () => {
    await page.getByRole('button', { name: 'Remove blackwall-town-map.png from Blackwall' }).click()
    await expect(list.getByText('blackwall-town-map.png')).toHaveCount(0)
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByText('Restored blackwall-town-map.png to Blackwall').first()).toBeVisible()
    await page.reload()
    await expect(list.getByText('Town map, autumn 1287')).toBeVisible()
  })

  await test.step('a file another entry also uses can’t be deleted from here', async () => {
    const [map] = (await world.list(world.blackwall.id)).filter(
      (f: { originalFilename: string }) => f.originalFilename === 'blackwall-town-map.png',
    )
    await world.linkTo(map.id, world.guard.id)
    await page.reload()
    await expect(list.getByText('Also used in 1 other place')).toBeVisible()
    await page.getByRole('button', { name: 'Delete file blackwall-town-map.png permanently…' }).click()
    const dialog = page.getByRole('dialog', { name: 'blackwall-town-map.png is used elsewhere' })
    await expect(dialog.getByRole('button', { name: 'Delete file' })).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Remove from Blackwall' }).click()
    await expect(list.getByText('blackwall-town-map.png')).toHaveCount(0)
    // Still on the Ashen Guard, still downloadable.
    const [kept] = await world.list(world.guard.id)
    expect(kept.originalFilename).toBe('blackwall-town-map.png')
    expect((await request.get(kept.downloadUrl)).status()).toBe(200)
  })

  await test.step('Delete asks first, then deletes the stored file for good', async () => {
    await page.getByRole('button', { name: 'Delete file gate-ledger.txt permanently…' }).click()
    const dialog = page.getByRole('dialog', { name: 'Delete gate-ledger.txt?' })
    await expect(dialog).toContainText('There’s no Undo.')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(list.getByText('gate-ledger.txt')).toBeVisible()
    await page.getByRole('button', { name: 'Delete file gate-ledger.txt permanently…' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete file' }).click()
    await expect(page.getByText('gate-ledger.txt', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0)
    await page.reload()
    await expect(page.getByText('No files yet.', { exact: false })).toBeVisible()
  })
})

test('phones: every action is reachable without sideways scrolling', async ({ page, request }) => {
  const world = await setUp(page, request, 'phone')
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto(world.filesUrl(world.blackwall.id))
  await page.getByLabel('Add files').setInputFiles({
    name: 'a-very-long-file-name-for-the-northern-march-survey-of-1287.png',
    mimeType: 'image/png',
    buffer: PNG,
  })
  const list = page.getByRole('list', { name: 'Files on Blackwall' })
  await expect(list.getByText(/northern-march-survey/)).toBeVisible({ timeout: 30_000 })

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  for (const name of [/^Remove /, /^Delete file /, /^Download /]) {
    const control = list.getByRole(name.source.includes('Download') ? 'link' : 'button', { name })
    const box = (await control.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(360)
    expect(box.height).toBeGreaterThanOrEqual(44)
  }

  await list.getByRole('button', { name: /^Delete file / }).click()
  const dialog = page.getByRole('dialog')
  const dialogBox = (await dialog.boundingBox())!
  expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(360)
  await dialog.getByRole('button', { name: 'Delete file' }).click()
  await expect(page.getByText('No files yet.', { exact: false })).toBeVisible()
})
