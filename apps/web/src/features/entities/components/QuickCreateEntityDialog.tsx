import type { EntityType } from '@worldbinder/contracts'
import { QuickCreateDialog, TextField } from '@worldbinder/ui'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateEntityMutation } from '../hooks/useEntities'
import { ENTITY_TYPE_LABELS } from '../lib/entityTypeIcons'
import { EntityTypePicker } from './EntityTypePicker'

export interface QuickCreateEntityDialogProps {
  campaignId: string
  open: boolean
  onClose: () => void
  /** Skips the type picker for a dashboard shortcut like "New Character"
   * or "New Location" — the type is already decided by which button
   * opened the dialog. */
  fixedType?: EntityType
}

/**
 * "Type a name, Create, fill in the rest later" — the quick-create flow
 * docs/planning/ui-ux.md's "Creating Information" section calls for.
 * Navigates to the new entity's detail page on success, same target the
 * full EntityFormPage create form already used; that full form now
 * exclusively serves edit mode (see routes/index.tsx).
 */
export function QuickCreateEntityDialog({
  campaignId,
  open,
  onClose,
  fixedType,
}: QuickCreateEntityDialogProps) {
  const navigate = useNavigate()
  const createEntity = useCreateEntityMutation(campaignId)
  const [name, setName] = useState('')
  const [entityType, setEntityType] = useState<EntityType>(fixedType ?? 'character')

  function handleClose() {
    setName('')
    setEntityType(fixedType ?? 'character')
    createEntity.reset()
    onClose()
  }

  function handleSubmit() {
    if (!name.trim()) return
    createEntity.mutate(
      { entityType: fixedType ?? entityType, name },
      {
        onSuccess: (entity) => {
          handleClose()
          navigate(`/app/campaign/${campaignId}/world/${entity.id}`)
        },
      },
    )
  }

  return (
    <QuickCreateDialog
      open={open}
      onClose={handleClose}
      title={fixedType ? `New ${ENTITY_TYPE_LABELS[fixedType]}` : 'New entity'}
      onSubmit={handleSubmit}
      submitDisabled={!name.trim()}
      pending={createEntity.isPending}
      error={createEntity.error?.message}
    >
      {!fixedType && <EntityTypePicker value={entityType} onChange={setEntityType} />}
      <TextField
        id="quick-create-entity-name"
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
    </QuickCreateDialog>
  )
}
