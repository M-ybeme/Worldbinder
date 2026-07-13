import type { EntityVisibility } from '@worldbinder/contracts'
import { Button, FileDropzone, FormMessage, TextField, Textarea, Select } from '@worldbinder/ui'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useUnlinkedAttachmentsQuery,
  useUploadUnlinkedAttachmentMutation,
} from '../../attachments/hooks/useAttachments'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { useCreateMapMutation, useMapQuery, useUpdateMapMutation } from '../hooks/useMaps'

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public — visible to all campaign members' },
  { value: 'gm_only', label: 'GM only — hidden from players' },
]

export function MapFormPage() {
  const { mapId } = useParams<{ mapId: string }>()
  const isEditMode = !!mapId
  const { campaign } = useCampaignOutletContext()
  const navigate = useNavigate()

  const mapQuery = useMapQuery(campaign.id, mapId)
  const createMap = useCreateMapMutation(campaign.id)
  const updateMap = useUpdateMapMutation(campaign.id, mapId ?? '')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<EntityVisibility>('public')

  useEffect(() => {
    if (!isEditMode || !mapQuery.data) return
    setName(mapQuery.data.name)
    setDescription(mapQuery.data.description ?? '')
    setVisibility(mapQuery.data.visibility)
  }, [isEditMode, mapQuery.data])

  // Same upload-then-poll-until-ready-then-PATCH flow as
  // CampaignSettingsPage's cover image — a map image is a direct reference
  // (imageAttachmentId), not a resource_attachments link.
  const [pendingImageId, setPendingImageId] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const uploadImage = useUploadUnlinkedAttachmentMutation(campaign.id)
  const unlinkedQuery = useUnlinkedAttachmentsQuery(campaign.id, !!pendingImageId, true)

  useEffect(() => {
    if (!pendingImageId) return
    const pending = unlinkedQuery.data?.find((a) => a.id === pendingImageId)
    if (!pending) return

    if (pending.status === 'ready') {
      updateMap.mutate({ imageAttachmentId: pendingImageId })
      setPendingImageId(null)
    } else if (pending.status === 'rejected') {
      setImageError('That file was rejected — it may not be a supported image type.')
      setPendingImageId(null)
    }
  }, [pendingImageId, unlinkedQuery.data, updateMap])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return

    if (isEditMode) {
      await updateMap.mutateAsync({ name, description: description || null, visibility })
      navigate(`/app/campaign/${campaign.id}/maps/${mapId}`)
      return
    }

    const result = await createMap.mutateAsync({
      name,
      description: description || undefined,
      visibility,
    })
    navigate(`/app/campaign/${campaign.id}/maps/${result.id}/edit`)
  }

  if (isEditMode && mapQuery.isLoading) return <p>Loading…</p>
  if (isEditMode && mapQuery.isError) return <FormMessage message="This map could not be loaded." />

  const mutation = isEditMode ? updateMap : createMap

  return (
    <section>
      <h1>{isEditMode ? 'Edit map' : 'New map'}</h1>

      <form className="wb-form" onSubmit={(e) => void onSubmit(e)} noValidate>
        <TextField
          id="map-name"
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Textarea
          id="map-description"
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Select
          id="map-visibility"
          label="Visibility"
          options={VISIBILITY_OPTIONS}
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as EntityVisibility)}
        />

        <FormMessage message={mutation.error?.message} />
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : isEditMode ? 'Save changes' : 'Create map'}
        </Button>
      </form>

      {isEditMode && mapQuery.data && (
        <>
          <h2>Map image</h2>
          {mapQuery.data.imageUrl && (
            <img
              src={mapQuery.data.imageUrl}
              alt="Map"
              style={{ maxWidth: 320, borderRadius: 6, display: 'block', marginBottom: '0.75rem' }}
            />
          )}
          <FileDropzone
            label={mapQuery.data.imageUrl ? 'Replace map image' : 'Upload a map image'}
            accept="image/*"
            disabled={uploadImage.isPending || !!pendingImageId}
            onFilesSelected={(files) => {
              const file = files[0]
              if (!file) return
              setImageError(null)
              uploadImage.mutate(file, {
                onSuccess: (attachmentId) => setPendingImageId(attachmentId),
              })
            }}
          />
          {(uploadImage.isPending || pendingImageId) && <p>Uploading and processing…</p>}
          <FormMessage message={uploadImage.error?.message ?? imageError} tone="error" />
        </>
      )}
    </section>
  )
}
