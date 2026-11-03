import type { EntityDetail, PlotThreadImportance } from '@worldbinder/contracts'
import { Badge, ErrorState, type BadgeTone } from '@worldbinder/ui'
import { Link } from 'react-router-dom'
import { AttachmentsPanel } from '../../../attachments/components/AttachmentsPanel'
import { useAttachmentsForResourceQuery } from '../../../attachments/hooks/useAttachments'
import { formatAge } from '../../../campaigns/lib/dashboardFormat'
import { RevisionHistoryPanel } from '../../../revisions/components/RevisionHistoryPanel'
import { useEntityPlotThreadsQuery, useEntitySessionsQuery } from '../../hooks/useEntities'
import { ShowMoreList } from './ShowMore'
import { SidePanel } from './SidePanel'

const SESSION_LIMIT = 5

const IMPORTANCE_TONES: Record<PlotThreadImportance, BadgeTone> = {
  critical: 'danger',
  major: 'warning',
  standard: 'neutral',
  minor: 'info',
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/** Plot threads this entity is linked to. Importance is GM-only data — the
 * API omits it for other viewers, so no badge renders for them. */
export function EntityThreadsPanel({
  campaignId,
  entityId,
  collapsible,
}: {
  campaignId: string
  entityId: string
  collapsible: boolean
}) {
  const query = useEntityPlotThreadsQuery(campaignId, entityId)
  const threads = query.data ?? []
  return (
    <SidePanel title="Plot threads" count={threads.length} collapsible={collapsible}>
      {query.isLoading && <p className="wb-ed-muted">Loading plot threads…</p>}
      {query.isError && (
        <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
      )}
      {query.isSuccess && threads.length === 0 && (
        <p className="wb-ed-muted">Not part of any plot thread yet.</p>
      )}
      {threads.length > 0 && (
        <ul className="wb-ed-list" aria-label="Plot threads">
          {threads.map((thread) => (
            <li key={thread.id}>
              <Link to={`/app/campaign/${campaignId}/threads/${thread.id}`}>{thread.title}</Link>
              {thread.importance && (
                <Badge tone={IMPORTANCE_TONES[thread.importance]}>
                  {capitalize(thread.importance)}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </SidePanel>
  )
}

/** Sessions this entity was featured in (newest first, as the API returns
 * them), already filtered to sessions the member can see. */
export function AppearsInPanel({
  campaignId,
  entityId,
  collapsible,
}: {
  campaignId: string
  entityId: string
  collapsible: boolean
}) {
  const query = useEntitySessionsQuery(campaignId, entityId)
  const sessions = query.data ?? []
  return (
    <SidePanel title="Appears in" count={sessions.length} collapsible={collapsible}>
      {query.isLoading && <p className="wb-ed-muted">Loading sessions…</p>}
      {query.isError && (
        <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
      )}
      {query.isSuccess && sessions.length === 0 && (
        <p className="wb-ed-muted">No session appearances yet.</p>
      )}
      {sessions.length > 0 && (
        <ShowMoreList
          label="Session appearances"
          items={sessions}
          limit={SESSION_LIMIT}
          renderItem={(session) => (
            <li key={session.id}>
              <Link to={`/app/campaign/${campaignId}/sessions/${session.id}`}>
                Session {session.sessionNumber} — {session.title}
              </Link>
            </li>
          )}
        />
      )}
    </SidePanel>
  )
}

function editedAgo(iso: string): string {
  const age = formatAge(iso)
  if (age === 'now') return 'edited just now'
  return /^\d+[mhd]$/.test(age) ? `edited ${age} ago` : `edited ${age}`
}

/**
 * Files and revision history, each behind a disclosure at every width
 * since both panels are tall. Files are read-only here (open, download);
 * they're managed on the editor's Files tab ("Manage"). Revision history
 * keeps its restore for editors.
 */
export function FilesAndHistoryPanels({
  campaignId,
  entity,
  canManage,
  onRestored,
}: {
  campaignId: string
  entity: EntityDetail
  canManage: boolean
  onRestored: () => void
}) {
  const attachmentsQuery = useAttachmentsForResourceQuery(campaignId, 'entity', entity.id)
  return (
    <>
      <SidePanel
        title="Files"
        count={attachmentsQuery.data?.length}
        collapsible
        action={
          canManage && (
            <Link
              className="wb-ed-link-button"
              to={`/app/campaign/${campaignId}/world/${entity.id}/edit/files`}
              aria-label="Manage files"
            >
              Manage
            </Link>
          )
        }
      >
        <AttachmentsPanel
          campaignId={campaignId}
          resourceType="entity"
          resourceId={entity.id}
          resourceName={entity.name}
          canManage={false}
          compact
          embedded
        />
      </SidePanel>
      <SidePanel title="Revision history" meta={editedAgo(entity.updatedAt)} collapsible>
        <RevisionHistoryPanel
          campaignId={campaignId}
          resourceType="entity"
          resourceId={entity.id}
          canRestore={canManage}
          onRestored={onRestored}
        />
      </SidePanel>
    </>
  )
}
