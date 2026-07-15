import type { CampaignExportSummary } from '@worldbinder/contracts'
import { Button, FormMessage } from '@worldbinder/ui'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { useCreateExportMutation, useExportsQuery } from '../hooks/useExports'

const MANAGEMENT_ROLES = new Set(['owner', 'gm'])

const STATUS_LABELS: Record<CampaignExportSummary['status'], string> = {
  pending: 'Preparing…',
  processing: 'Building archive…',
  ready: 'Ready',
  failed: 'Failed',
}

function ExportRow({ item }: { item: CampaignExportSummary }) {
  return (
    <li>
      <span>{new Date(item.createdAt).toLocaleString()}</span>
      <span className="wb-session-list__meta"> · {STATUS_LABELS[item.status]}</span>
      {item.status === 'ready' && item.downloadUrl && (
        <>
          {' '}
          <a href={item.downloadUrl}>Download</a>
        </>
      )}
      {item.status === 'failed' && item.errorMessage && (
        <FormMessage message={item.errorMessage} tone="error" />
      )}
    </li>
  )
}

export function ExportsPage() {
  const { campaign } = useCampaignOutletContext()
  const canExport = MANAGEMENT_ROLES.has(campaign.role)

  const exportsQuery = useExportsQuery(campaign.id)
  const createExport = useCreateExportMutation(campaign.id)

  return (
    <section>
      <header className="wb-world-header">
        <h1>Import / Export</h1>
      </header>

      <h2>Export this campaign</h2>
      <p>
        Builds a versioned archive of this campaign's content (entities, relationships, sessions,
        plot threads, maps, timeline, and attachments) that can be imported back as a new campaign.
      </p>
      {canExport ? (
        <Button disabled={createExport.isPending} onClick={() => createExport.mutate()}>
          {createExport.isPending ? 'Starting…' : 'Create export'}
        </Button>
      ) : (
        <p>Only the campaign owner or GM can create an export.</p>
      )}
      <FormMessage message={createExport.error?.message} />

      <h2>Export history</h2>
      {exportsQuery.isLoading && <p>Loading exports…</p>}
      {exportsQuery.isError && <FormMessage message={exportsQuery.error.message} />}
      <ul className="wb-session-list">
        {exportsQuery.data?.map((item) => (
          <ExportRow key={item.id} item={item} />
        ))}
        {exportsQuery.data?.length === 0 && <li>No exports yet.</li>}
      </ul>
    </section>
  )
}
