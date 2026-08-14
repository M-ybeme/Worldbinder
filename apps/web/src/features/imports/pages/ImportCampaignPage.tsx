import { Button, FileDropzone, FormMessage, LoadingState } from '@worldbinder/ui'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useConfirmImportMutation,
  useImportQuery,
  useUploadImportMutation,
} from '../hooks/useImports'

export function ImportCampaignPage() {
  const [importId, setImportId] = useState<string | null>(null)
  const upload = useUploadImportMutation()
  const importQuery = useImportQuery(importId ?? undefined)
  const confirm = useConfirmImportMutation(importId ?? '')

  const summary = importQuery.data
  const status = summary?.status

  return (
    <section>
      <header className="wb-world-header">
        <h1>Import a campaign</h1>
      </header>
      <p>
        Upload a campaign export archive (<code>.zip</code>). It's validated first — you'll see a
        summary of what will be imported before anything is created.
      </p>

      {!importId && (
        <FileDropzone
          label="Upload campaign archive"
          accept=".zip,application/zip"
          disabled={upload.isPending}
          onFilesSelected={(files) => {
            const file = files[0]
            if (!file) return
            upload.mutate(file, { onSuccess: (result) => setImportId(result.id) })
          }}
        />
      )}
      {upload.isPending && <LoadingState label="Uploading…" />}
      <FormMessage message={upload.error?.message} />

      {status === 'validating' && <LoadingState label="Validating archive…" />}

      {status === 'dry_run_ready' && summary?.dryRunReport && (
        <>
          <h2>Ready to import</h2>
          <ul className="wb-relationship-list">
            {Object.entries(summary.dryRunReport.counts).map(([key, count]) => (
              <li key={key}>
                {key}: {count}
              </li>
            ))}
          </ul>
          {summary.dryRunReport.warnings.length > 0 && (
            <>
              <h3>Warnings</h3>
              <ul className="wb-relationship-list">
                {summary.dryRunReport.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </>
          )}
          <Button type="button" disabled={confirm.isPending} onClick={() => confirm.mutate()}>
            {confirm.isPending ? 'Starting import…' : 'Confirm import'}
          </Button>
          <FormMessage message={confirm.error?.message} />
        </>
      )}

      {status === 'importing' && <LoadingState label="Importing…" />}

      {status === 'completed' && summary?.resultCampaignId && (
        <>
          <FormMessage tone="success" message="Import complete." />
          {summary.importReport && (
            <ul className="wb-relationship-list">
              {Object.entries(summary.importReport.counts).map(([key, count]) => (
                <li key={key}>
                  {key}: {count}
                </li>
              ))}
            </ul>
          )}
          <p>
            <Link to={`/app/campaign/${summary.resultCampaignId}`}>Go to the new campaign</Link>
          </p>
        </>
      )}

      {status === 'failed' && (
        <FormMessage tone="error" message={summary?.errorMessage ?? 'Import failed.'} />
      )}
    </section>
  )
}
