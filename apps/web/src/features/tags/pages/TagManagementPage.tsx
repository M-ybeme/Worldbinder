import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormMessage,
  LoadingState,
  Select,
  TextField,
} from '@worldbinder/ui'
import { useState } from 'react'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { useCampaignTagsQuery, useMergeTagMutation, useRenameTagMutation } from '../hooks/useTags'

export function TagManagementPage() {
  const { campaign } = useCampaignOutletContext()
  const tagsQuery = useCampaignTagsQuery(campaign.id)
  const renameTag = useRenameTagMutation(campaign.id)
  const mergeTag = useMergeTagMutation(campaign.id)

  const [renamingTagId, setRenamingTagId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [mergingTagId, setMergingTagId] = useState<string | null>(null)
  const [mergeTargetId, setMergeTargetId] = useState('')
  const [confirmMergeOpen, setConfirmMergeOpen] = useState(false)

  const tags = tagsQuery.data ?? []
  const mergingTag = tags.find((t) => t.id === mergingTagId)
  const mergeTarget = tags.find((t) => t.id === mergeTargetId)

  function startRename(tagId: string, currentName: string) {
    setRenamingTagId(tagId)
    setRenameDraft(currentName)
    renameTag.reset()
  }

  function submitRename(tagId: string) {
    if (!renameDraft.trim()) return
    renameTag.mutate(
      { tagId, input: { name: renameDraft.trim() } },
      { onSuccess: () => setRenamingTagId(null) },
    )
  }

  function startMerge(tagId: string) {
    setMergingTagId(tagId)
    setMergeTargetId('')
    mergeTag.reset()
  }

  function confirmMerge() {
    if (!mergingTagId || !mergeTargetId) return
    mergeTag.mutate(
      { tagId: mergingTagId, input: { targetTagId: mergeTargetId } },
      {
        onSuccess: () => {
          setConfirmMergeOpen(false)
          setMergingTagId(null)
        },
      },
    )
  }

  return (
    <section>
      <h1>Tags</h1>

      {tagsQuery.isLoading && <LoadingState label="Loading tags…" />}
      {tagsQuery.isError && (
        <ErrorState message={tagsQuery.error.message} onRetry={() => tagsQuery.refetch()} />
      )}
      {!tagsQuery.isLoading && !tagsQuery.isError && tags.length === 0 && (
        <EmptyState message="No tags yet — tags appear here once you tag an entity, session, timeline event, or plot thread." />
      )}

      {!tagsQuery.isLoading && !tagsQuery.isError && tags.length > 0 && (
        <ul className="wb-relationship-list">
          {tags.map((tag) => (
            <li key={tag.id}>
              {renamingTagId === tag.id ? (
                <div className="wb-form">
                  <TextField
                    id={`rename-${tag.id}`}
                    label="New name"
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                  />
                  <FormMessage message={renameTag.error?.message} />
                  <div className="wb-entity-header__actions">
                    <Button disabled={renameTag.isPending} onClick={() => submitRename(tag.id)}>
                      {renameTag.isPending ? 'Saving…' : 'Save'}
                    </Button>
                    <Button variant="secondary" onClick={() => setRenamingTagId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : mergingTagId === tag.id ? (
                <div className="wb-form">
                  <Select
                    id={`merge-target-${tag.id}`}
                    label={`Merge "${tag.name}" into`}
                    value={mergeTargetId}
                    onChange={(e) => setMergeTargetId(e.target.value)}
                    options={[
                      { value: '', label: 'Choose a tag…' },
                      ...tags
                        .filter((t) => t.id !== tag.id)
                        .map((t) => ({ value: t.id, label: t.name })),
                    ]}
                  />
                  <FormMessage message={mergeTag.error?.message} />
                  <div className="wb-entity-header__actions">
                    <Button disabled={!mergeTargetId} onClick={() => setConfirmMergeOpen(true)}>
                      Merge
                    </Button>
                    <Button variant="secondary" onClick={() => setMergingTagId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <span>{tag.name}</span>
                  <span className="wb-session-list__meta">
                    {' '}
                    · {tag.usageCount} {tag.usageCount === 1 ? 'use' : 'uses'}
                  </span>
                  <div className="wb-entity-header__actions">
                    <Button variant="secondary" onClick={() => startRename(tag.id, tag.name)}>
                      Rename
                    </Button>
                    <Button variant="secondary" onClick={() => startMerge(tag.id)}>
                      Merge into…
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirmMergeOpen}
        title={`Merge "${mergingTag?.name ?? ''}" into "${mergeTarget?.name ?? ''}"?`}
        description={`Every entity, session, timeline event, and plot thread tagged "${mergingTag?.name ?? ''}" will be retagged "${mergeTarget?.name ?? ''}" instead. "${mergingTag?.name ?? ''}" will then be deleted. This cannot be undone.`}
        confirmLabel="Merge"
        danger
        pending={mergeTag.isPending}
        onConfirm={confirmMerge}
        onCancel={() => setConfirmMergeOpen(false)}
      />
    </section>
  )
}
