import type { AttachmentSummary } from '@worldbinder/contracts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/apiClient'
import { AttachmentsPanel } from './AttachmentsPanel'

// --- In-memory attachments API for one entity ("blackwall"). -------------

type Stored = AttachmentSummary & { linked: boolean; deleted: boolean }
let files: Stored[]
let failUnlink: ApiError | null
let failLink: ApiError | null
let failDelete: ApiError | null
const calls: { fn: string; args: unknown[] }[] = []

function file(id: string, name: string, extra: Partial<Stored> = {}): Stored {
  return {
    id,
    originalFilename: name,
    detectedMimeType: 'application/pdf',
    sizeBytes: 48_000,
    width: null,
    height: null,
    status: 'ready',
    uploadedByUserId: 'u1',
    uploadedByDisplayName: 'Mara',
    createdAt: '2026-09-12T10:00:00.000Z',
    caption: null,
    displayOrder: 0,
    downloadUrl: `https://storage.test/${id}`,
    usedElsewhereCount: 0,
    linked: true,
    deleted: false,
    ...extra,
  }
}

vi.mock('../api/attachmentsApi', () => ({
  listForResource: () =>
    Promise.resolve(
      files
        .filter((f) => f.linked && !f.deleted)
        .map((f) => {
          const summary: Partial<Stored> = { ...f }
          delete summary.linked
          delete summary.deleted
          return summary
        }),
    ),
  listUnlinked: () => Promise.resolve([]),
  unlinkAttachment: (...args: unknown[]) => {
    calls.push({ fn: 'unlink', args })
    if (failUnlink) return Promise.reject(failUnlink)
    files = files.map((f) => (f.id === args[1] ? { ...f, linked: false } : f))
    return Promise.resolve({ message: 'ok' })
  },
  linkAttachment: (...args: unknown[]) => {
    calls.push({ fn: 'link', args })
    if (failLink) return Promise.reject(failLink)
    const input = args[2] as { caption?: string | null; displayOrder?: number }
    files = files.map((f) =>
      f.id === args[1]
        ? { ...f, linked: true, caption: input.caption ?? null, displayOrder: input.displayOrder ?? 0 }
        : f,
    )
    return Promise.resolve({ message: 'ok' })
  },
  deleteAttachment: (...args: unknown[]) => {
    calls.push({ fn: 'delete', args })
    if (failDelete) return Promise.reject(failDelete)
    files = files.map((f) => (f.id === args[1] ? { ...f, deleted: true } : f))
    return Promise.resolve({ message: 'ok' })
  },
  presignUpload: () => Promise.reject(new Error('Upload service unavailable')),
}))

beforeEach(() => {
  files = [
    file('map', 'blackwall-town-map.png', {
      detectedMimeType: 'image/png',
      width: 2400,
      height: 1600,
      sizeBytes: 3_400_000,
      caption: 'Town map, autumn 1287',
      displayOrder: 2,
    }),
    file('ledger', 'gate-ledger-handout.pdf', { usedElsewhereCount: 1 }),
  ]
  failUnlink = null
  failLink = null
  failDelete = null
  calls.length = 0
})

afterEach(() => {
  vi.useRealTimers()
})

function renderPanel(props: { canManage?: boolean; compact?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AttachmentsPanel
        campaignId="c1"
        resourceType="entity"
        resourceId="blackwall"
        resourceName="Blackwall"
        canManage={props.canManage ?? true}
        compact={props.compact}
      />
    </QueryClientProvider>,
  )
}

const row = (name: string) => screen.getByText(name).closest('li')!
const fileList = () => screen.getByRole('list', { name: 'Files on Blackwall' })

describe('AttachmentsPanel', () => {
  it('lists files with type, size, dimensions, uploader, caption and open/download', async () => {
    renderPanel()
    await screen.findByText('blackwall-town-map.png')
    const map = row('blackwall-town-map.png')
    expect(map).toHaveTextContent('PNG image · 3.2 MB · 2400×1600')
    expect(map).toHaveTextContent('by Mara')
    expect(map).toHaveTextContent('Town map, autumn 1287')
    expect(within(map).getByRole('link', { name: /blackwall-town-map\.png \(opens in a new tab\)/ })).toHaveAttribute(
      'target',
      '_blank',
    )
    expect(within(map).getByRole('link', { name: 'Download blackwall-town-map.png' })).toHaveAttribute(
      'download',
      'blackwall-town-map.png',
    )
    expect(row('gate-ledger-handout.pdf')).toHaveTextContent('Also used in 1 other place')
  })

  it('Remove unlinks only, and Undo re-links with the same caption and order', async () => {
    renderPanel()
    await screen.findByText('blackwall-town-map.png')
    fireEvent.click(screen.getByRole('button', { name: 'Remove blackwall-town-map.png from Blackwall' }))
    await waitFor(() => expect(within(fileList()).queryByText('blackwall-town-map.png')).not.toBeInTheDocument())
    expect(calls.map((call) => call.fn)).toEqual(['unlink'])

    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))
    await within(fileList()).findByText('blackwall-town-map.png')
    expect(calls[1]).toEqual({
      fn: 'link',
      args: [
        'c1',
        'map',
        { resourceType: 'entity', resourceId: 'blackwall', caption: 'Town map, autumn 1287', displayOrder: 2 },
      ],
    })
    expect(await screen.findAllByText('Restored blackwall-town-map.png to Blackwall')).not.toHaveLength(0)
  })

  it('an Undo the server refuses is reported, not shown as restored', async () => {
    renderPanel()
    await screen.findByText('blackwall-town-map.png')
    fireEvent.click(screen.getByRole('button', { name: 'Remove blackwall-town-map.png from Blackwall' }))
    failLink = new ApiError('Attachment is not ready to be linked yet', 409)
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))
    expect(
      await screen.findAllByText(
        'blackwall-town-map.png couldn’t be restored: the file was deleted in the meantime.',
      ),
    ).not.toHaveLength(0)
    expect(screen.queryByText(/^Restored/)).not.toBeInTheDocument()
  })

  it('Delete asks first, says it’s permanent, sends the context, and offers no Undo', async () => {
    renderPanel()
    await screen.findByText('blackwall-town-map.png')
    fireEvent.click(screen.getByRole('button', { name: 'Delete file blackwall-town-map.png permanently…' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete blackwall-town-map.png?' })
    expect(dialog).toHaveTextContent('deleted permanently')
    expect(dialog).toHaveTextContent('There’s no Undo.')
    // Initial focus is not on the destructive button.
    expect(within(dialog).getByRole('button', { name: 'Delete file' })).not.toHaveFocus()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete file' }))
    await waitFor(() => expect(within(fileList()).queryByText('blackwall-town-map.png')).not.toBeInTheDocument())
    expect(calls).toEqual([{ fn: 'delete', args: ['c1', 'map', { resourceType: 'entity', resourceId: 'blackwall' }] }])
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  })

  it('a file used elsewhere can’t be deleted from here; Remove is offered instead', async () => {
    renderPanel()
    await screen.findByText('gate-ledger-handout.pdf')
    fireEvent.click(screen.getByRole('button', { name: 'Delete file gate-ledger-handout.pdf permanently…' }))
    const dialog = screen.getByRole('dialog', { name: 'gate-ledger-handout.pdf is used elsewhere' })
    expect(dialog).toHaveTextContent('also used in 1 other place')
    expect(within(dialog).queryByRole('button', { name: 'Delete file' })).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove from Blackwall' }))
    await waitFor(() => expect(within(fileList()).queryByText('gate-ledger-handout.pdf')).not.toBeInTheDocument())
    expect(calls.map((call) => call.fn)).toEqual(['unlink'])
  })

  it('shows the server’s refusal when the file became shared meanwhile', async () => {
    failDelete = new ApiError('This file is also used in 1 other place in this campaign, so it can’t be deleted.', 409)
    renderPanel()
    await screen.findByText('blackwall-town-map.png')
    fireEvent.click(screen.getByRole('button', { name: 'Delete file blackwall-town-map.png permanently…' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete file' }))
    expect(await within(screen.getByRole('dialog')).findByText(/also used in 1 other place/)).toBeInTheDocument()
    expect(screen.getByText('blackwall-town-map.png', { selector: '.wb-files__name' })).toBeInTheDocument()
  })

  it('edits a caption, keeping the file’s order', async () => {
    renderPanel()
    await screen.findByText('blackwall-town-map.png')
    fireEvent.click(screen.getByRole('button', { name: 'Edit caption of blackwall-town-map.png' }))
    const input = screen.getByLabelText('Caption')
    expect(input).toHaveFocus()
    fireEvent.change(input, { target: { value: 'Town map, winter 1288' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save caption' }))
    await screen.findByText('Town map, winter 1288')
    expect(calls[0]).toEqual({
      fn: 'link',
      args: ['c1', 'map', { resourceType: 'entity', resourceId: 'blackwall', caption: 'Town map, winter 1288', displayOrder: 2 }],
    })
  })

  it('rejects unsupported or oversized files before uploading, and reports upload failures', async () => {
    renderPanel()
    await screen.findByText('blackwall-town-map.png')
    const input = screen.getByLabelText('Add files') as HTMLInputElement
    const big = new File(['x'], 'atlas.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: 25_000_000 })
    const exe = new File(['x'], 'tool.exe', { type: 'application/x-msdownload' })
    const ok = new File(['x'], 'notes.txt', { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [big, exe, ok] } })
    expect(await screen.findByText(/atlas\.png is 23\.8 MB; files can be up to 19\.1 MB\./)).toBeInTheDocument()
    expect(screen.getByText(/tool\.exe isn’t a supported type/)).toBeInTheDocument()
    expect(await screen.findByText('Failed: Upload service unavailable')).toBeInTheDocument()
  })

  it('players see files to open and download, without managing controls', async () => {
    renderPanel({ canManage: false })
    await screen.findByText('blackwall-town-map.png')
    expect(screen.queryByLabelText('Add files')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/Also used in/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Download blackwall-town-map.png' })).toBeInTheDocument()
  })

  it('says so when there are no files', async () => {
    files = []
    renderPanel()
    expect(await screen.findByText('No files yet. Add maps, handouts or reference images above.')).toBeInTheDocument()
  })
})
