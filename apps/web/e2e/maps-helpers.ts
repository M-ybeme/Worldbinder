import { deflateSync } from 'node:zlib'
import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { clearRateLimits, login, PASSWORD, registerAndVerify } from './helpers'

export const API = 'http://localhost:3000'

function crc32(bytes: Buffer): number {
  let crc = ~0
  for (const byte of bytes) {
    crc ^= byte
    for (let k = 0; k < 8; k += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return ~crc >>> 0
}

/** A real PNG (so the worker's detection accepts it): a parchment ground
 * with a darker grid, `width`×`height`. */
export function mapPng(width = 1200, height = 750): Buffer {
  const rows: Buffer[] = []
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 3)
    for (let x = 0; x < width; x += 1) {
      const grid = x % 100 === 0 || y % 100 === 0
      row[1 + x * 3] = grid ? 190 : 232
      row[2 + x * 3] = grid ? 170 : 220
      row[3 + x * 3] = grid ? 140 : 190
    }
    rows.push(row)
  }
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(4)
    head.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([head, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

export interface SeededPin {
  name: string
  type?: string
  summary?: string
  x: number
  y: number
  layer?: 'towns' | 'secrets'
  /** The pin itself is GM-only. */
  gmPin?: boolean
  /** Its linked entry is GM-only. */
  gmEntry?: boolean
  /** A plain labelled pin with no linked entry. */
  noEntry?: boolean
}

/** Owner + campaign with a real map image, two layers (Settlements, and a
 * GM-only "GM secrets"), and the given pins. The browser page is signed in
 * as the owner. */
export async function seedMap(page: Page, request: APIRequestContext, label: string, pins: SeededPin[]) {
  await clearRateLimits()
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const email = `pw-maps-${label}-${stamp}@verify.local`
  await registerAndVerify(page, email, `PW Maps ${label}`)
  await login(page, email)
  const auth = await request.post(`${API}/auth/login`, { data: { email, password: PASSWORD } })
  const headers = { Authorization: `Bearer ${(await auth.json()).accessToken}` }
  const send = async (method: 'post' | 'patch' | 'delete', path: string, data?: object) => {
    const res = await request[method](`${API}${path}`, { headers, data })
    expect(res.ok(), await res.text()).toBe(true)
    return method === 'delete' ? null : res.json()
  }
  const campaign = await send('post', '/campaigns', { name: `Maps ${label} ${stamp}` })
  const c = campaign.id
  const png = mapPng()
  const presign = await send('post', `/campaigns/${c}/attachments/presign`, {
    filename: 'region.png',
    declaredMimeType: 'image/png',
    sizeBytes: png.byteLength,
  })
  expect((await request.put(presign.uploadUrl, { data: png, headers: { 'Content-Type': 'image/png' } })).ok()).toBe(true)
  await send('post', `/campaigns/${c}/attachments/${presign.attachmentId}/complete`, {})
  await expect
    .poll(
      async () =>
        (await (await request.get(`${API}/campaigns/${c}/attachments/${presign.attachmentId}`, { headers })).json()).status,
      { timeout: 60_000 },
    )
    .toBe('ready')
  const map = await send('post', `/campaigns/${c}/maps`, { name: 'The Northern March', description: 'The frontier.' })
  await send('patch', `/campaigns/${c}/maps/${map.id}`, { imageAttachmentId: presign.attachmentId })
  const towns = await send('post', `/campaigns/${c}/maps/${map.id}/layers`, { name: 'Settlements' })
  const secrets = await send('post', `/campaigns/${c}/maps/${map.id}/layers`, {
    name: 'GM secrets',
    visibility: 'gm_only',
  })
  const pinIds: Record<string, string> = {}
  const entityIds: Record<string, string> = {}
  for (const pin of pins) {
    let entityId: string | null = null
    if (!pin.noEntry) {
      const entity = await send('post', `/campaigns/${c}/entities`, {
        name: pin.name,
        entityType: pin.type ?? 'location',
        summary: pin.summary ?? `About ${pin.name}.`,
        visibility: pin.gmEntry ? 'gm_only' : 'public',
      })
      entityId = entity.id
      entityIds[pin.name] = entity.id
    }
    const created = await send('post', `/campaigns/${c}/maps/${map.id}/pins`, {
      locationEntityId: entityId,
      label: pin.noEntry ? pin.name : null,
      xNormalized: pin.x,
      yNormalized: pin.y,
      layerId: pin.layer === 'towns' ? towns.id : pin.layer === 'secrets' ? secrets.id : null,
      visibility: pin.gmPin ? 'gm_only' : 'public',
    })
    pinIds[pin.name] = created.id
  }
  return {
    campaignId: c,
    mapId: map.id,
    layers: { towns: towns.id, secrets: secrets.id },
    pinIds,
    entityIds,
    headers,
    send,
    url: `/app/campaign/${c}/maps/${map.id}`,
  }
}
