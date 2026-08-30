import type { TiptapDoc } from '@worldbinder/contracts'
import type { UpdateEntityInput } from '@worldbinder/validation'
import { Button, ErrorState, FormMessage, LoadingState, TextField } from '@worldbinder/ui'
import { useEffect, useState } from 'react'
import { RichTextEditor } from '../../entities/components/RichTextEditor'
import { useEntityQuery, useUpdateEntityMutation } from '../../entities/hooks/useEntities'
import '../maps.css'

export interface MapPinEntityContentProps {
  campaignId: string
  entityId: string
  canEdit: boolean
}

/** The selected pin's linked entity — title/body, previewed (and, for
 * GMs/editors, editable) without leaving the map. Rendered full-width below
 * the map viewport rather than in the narrow side panel: the pin fields
 * (label/layer/visibility/position) stay a quick sidebar edit, but reading
 * or editing the entity's actual content wants the map's own width, not a
 * 320px rail. GM-only content is deliberately not shown here — this mirrors
 * what's already visible on the map itself; a GM who needs it has "Open
 * full page". */
export function MapPinEntityContent({ campaignId, entityId, canEdit }: MapPinEntityContentProps) {
  const entityQuery = useEntityQuery(campaignId, entityId)
  const updateEntity = useUpdateEntityMutation(campaignId, entityId)

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [content, setContent] = useState<TiptapDoc | null>(null)

  useEffect(() => {
    if (!entityQuery.data) return
    setName(entityQuery.data.name)
    setContent(entityQuery.data.publicContentJson)
    setEditing(false)
  }, [entityQuery.data])

  if (entityQuery.isLoading) return <LoadingState label="Loading entity…" />
  if (entityQuery.isError || !entityQuery.data) {
    return (
      <ErrorState
        message="This entity could not be loaded."
        onRetry={() => entityQuery.refetch()}
      />
    )
  }
  const entity = entityQuery.data

  if (!canEdit || !editing) {
    return (
      <div className="wb-map-pin-entity-content">
        <h3>{entity.name}</h3>
        <RichTextEditor
          key={entity.id}
          label="Content"
          content={entity.publicContentJson}
          editable={false}
          campaignId={campaignId}
        />
        {canEdit && (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="wb-map-pin-entity-content">
      <TextField
        id="pin-entity-name"
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <RichTextEditor
        key={entity.id}
        label="Content"
        content={entity.publicContentJson}
        onChange={setContent}
        campaignId={campaignId}
      />
      <FormMessage message={updateEntity.error?.message} tone="error" />
      <div className="wb-entity-header__actions">
        <Button
          disabled={updateEntity.isPending}
          onClick={() =>
            updateEntity.mutate(
              {
                entityType: entity.entityType,
                updatedAt: entity.updatedAt,
                name,
                publicContentJson: content ?? undefined,
              } as UpdateEntityInput,
              { onSuccess: () => setEditing(false) },
            )
          }
        >
          {updateEntity.isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setName(entity.name)
            setContent(entity.publicContentJson)
            setEditing(false)
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
