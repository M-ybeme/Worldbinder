import type { RevisionResourceType } from '@worldbinder/contracts'
import { Button, EmptyState, ErrorState, FormMessage, LoadingState } from '@worldbinder/ui'
import { useState } from 'react'
import { useRestoreRevisionMutation, useRevisionsQuery } from '../hooks/useRevisions'
import { computeFieldDiff, formatFieldValue } from '../lib/computeFieldDiff'

export interface RevisionHistoryPanelProps {
  campaignId: string
  resourceType: RevisionResourceType
  resourceId: string
  /** Same actor set as the resource's own edit permission — restore
   * replays through the real update() path, which enforces this again
   * server-side regardless, but hiding the button avoids a pointless 403. */
  canRestore: boolean
  /** Called after a successful restore so the parent detail page can
   * refetch its own resource query — this panel is reused identically
   * across entity/session/thread detail pages and deliberately doesn't
   * know any of their specific query keys (matches `RelatedContentPanel`'s
   * self-contained shape otherwise). */
  onRestored?: () => void
}

/**
 * Self-contained revision history panel (matches `RelatedContentPanel`'s
 * shape: owns its own data fetching, dropped as a JSX sibling on entity/
 * session/thread detail pages) — lists immutable revisions newest-first,
 * an expandable field-level diff against the next-older revision, and a
 * restore action.
 */
export function RevisionHistoryPanel({
  campaignId,
  resourceType,
  resourceId,
  canRestore,
  onRestored,
}: RevisionHistoryPanelProps) {
  const revisionsQuery = useRevisionsQuery(campaignId, resourceType, resourceId)
  const restoreRevision = useRestoreRevisionMutation(campaignId, resourceType, resourceId)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const revisions = revisionsQuery.data ?? []

  function handleRestore(revisionId: string, revisionNumber: number) {
    const confirmed = window.confirm(
      `Restore revision #${revisionNumber}? This creates a new revision with that content — nothing is deleted.`,
    )
    if (!confirmed) return
    restoreRevision.mutate(revisionId, { onSuccess: () => onRestored?.() })
  }

  return (
    <div className="wb-related-content">
      <div>
        <h2>Revision History</h2>

        {revisionsQuery.isLoading && <LoadingState label="Loading revision history…" />}
        {revisionsQuery.isError && (
          <ErrorState
            message={revisionsQuery.error.message}
            onRetry={() => revisionsQuery.refetch()}
          />
        )}
        {!revisionsQuery.isLoading && !revisionsQuery.isError && revisions.length === 0 && (
          <EmptyState message="No revision history yet." />
        )}
        <FormMessage message={restoreRevision.error?.message ?? null} tone="error" />

        <ul className="wb-relationship-list">
          {revisions.map((revision, index) => {
            const olderSnapshot = revisions[index + 1]?.snapshotJson ?? null
            const diffs = computeFieldDiff(olderSnapshot, revision.snapshotJson)
            const isExpanded = expandedId === revision.id

            return (
              <li key={revision.id}>
                <div>
                  <strong>Revision #{revision.revisionNumber}</strong>
                  {' — '}
                  {revision.createdByDisplayName ?? 'Unknown'}
                  {' · '}
                  {new Date(revision.createdAt).toLocaleString()}
                  {revision.changeSummary && <> — {revision.changeSummary}</>}
                </div>
                <div className="wb-entity-header__actions">
                  <Button
                    variant="secondary"
                    onClick={() => setExpandedId(isExpanded ? null : revision.id)}
                  >
                    {isExpanded ? 'Hide changes' : `View changes (${diffs.length})`}
                  </Button>
                  {canRestore && (
                    <Button
                      variant="secondary"
                      disabled={restoreRevision.isPending}
                      onClick={() => handleRestore(revision.id, revision.revisionNumber)}
                    >
                      Restore
                    </Button>
                  )}
                </div>
                {isExpanded && (
                  <ul>
                    {diffs.length === 0 && <li>No field changes.</li>}
                    {diffs.map((diff) => (
                      <li key={diff.field}>
                        <strong>{diff.label}:</strong> {formatFieldValue(diff.oldValue)} →{' '}
                        {formatFieldValue(diff.newValue)}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
