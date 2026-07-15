import { zodResolver } from '@hookform/resolvers/zod'
import { Button, FileDropzone, FormMessage, TextField } from '@worldbinder/ui'
import {
  DEFAULT_CALENDAR_CONFIG,
  updateCampaignSchema,
  type UpdateCampaignInput,
} from '@worldbinder/validation'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import {
  useUnlinkedAttachmentsQuery,
  useUploadUnlinkedAttachmentMutation,
} from '../../attachments/hooks/useAttachments'
import { CalendarMonthsEditor } from '../../calendar/components/CalendarMonthsEditor'
import { useCampaignOutletContext } from '../hooks/useCampaignContext'
import {
  useArchiveCampaignMutation,
  useDeleteCampaignMutation,
  useRestoreCampaignMutation,
  useUpdateCampaignMutation,
} from '../hooks/useCampaigns'

const MANAGEMENT_ROLES = new Set(['owner', 'gm'])

export function CampaignSettingsPage() {
  const { campaign } = useCampaignOutletContext()
  const navigate = useNavigate()
  const isOwner = campaign.role === 'owner'
  const canManageSettings = MANAGEMENT_ROLES.has(campaign.role)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateCampaignInput>({
    resolver: zodResolver(updateCampaignSchema),
    values: {
      name: campaign.name,
      description: campaign.description ?? '',
      systemName: campaign.systemName ?? '',
    },
  })
  const updateCampaign = useUpdateCampaignMutation(campaign.id)
  const [calendarConfig, setCalendarConfig] = useState(
    campaign.calendarConfigJson ?? DEFAULT_CALENDAR_CONFIG,
  )
  const saveCalendarConfig = useUpdateCampaignMutation(campaign.id)
  const archiveCampaign = useArchiveCampaignMutation(campaign.id)
  const restoreCampaign = useRestoreCampaignMutation(campaign.id)
  const deleteCampaign = useDeleteCampaignMutation(campaign.id)

  const onSubmit = handleSubmit((data) => {
    // Only the owner may rename — omit `name` from a GM's payload entirely
    // rather than relying on the disabled input to be dropped, since the
    // API treats field presence (not value change) as "please update this".
    const payload: UpdateCampaignInput = isOwner
      ? data
      : { description: data.description, systemName: data.systemName }
    updateCampaign.mutate(payload)
  })

  // Cover images aren't linked to a resource via resource_attachments —
  // campaigns reference one directly via coverAttachmentId — so the upload
  // flow here is upload-then-poll-until-ready-then-PATCH, rather than the
  // AttachmentsPanel's upload-and-link flow.
  const [pendingCoverId, setPendingCoverId] = useState<string | null>(null)
  const [coverError, setCoverError] = useState<string | null>(null)
  const uploadCover = useUploadUnlinkedAttachmentMutation(campaign.id)
  const unlinkedQuery = useUnlinkedAttachmentsQuery(campaign.id, !!pendingCoverId, true)

  useEffect(() => {
    if (!pendingCoverId) return
    const pending = unlinkedQuery.data?.find((a) => a.id === pendingCoverId)
    if (!pending) return

    if (pending.status === 'ready') {
      updateCampaign.mutate({ coverAttachmentId: pendingCoverId })
      setPendingCoverId(null)
    } else if (pending.status === 'rejected') {
      setCoverError('That file was rejected — it may not be a supported image type.')
      setPendingCoverId(null)
    }
  }, [pendingCoverId, unlinkedQuery.data, updateCampaign])

  return (
    <section>
      <h1>Campaign settings</h1>
      <form className="wb-form" onSubmit={onSubmit} noValidate>
        <TextField
          label="Name"
          disabled={!isOwner}
          error={errors.name?.message}
          {...register('name')}
        />
        <TextField
          label="System (optional)"
          error={errors.systemName?.message}
          {...register('systemName')}
        />
        <TextField
          label="Description (optional)"
          error={errors.description?.message}
          {...register('description')}
        />
        <FormMessage message={updateCampaign.error?.message} />
        {updateCampaign.isSuccess && <FormMessage tone="success" message="Settings saved." />}
        <Button type="submit" disabled={updateCampaign.isPending}>
          {updateCampaign.isPending ? 'Saving…' : 'Save settings'}
        </Button>
      </form>

      {canManageSettings && (
        <>
          <h2>Cover image</h2>
          {campaign.coverImageUrl && (
            <img
              src={campaign.coverImageUrl}
              alt="Campaign cover"
              style={{ maxWidth: 240, borderRadius: 6, display: 'block', marginBottom: '0.75rem' }}
            />
          )}
          <FileDropzone
            label={campaign.coverImageUrl ? 'Replace cover image' : 'Upload a cover image'}
            accept="image/*"
            disabled={uploadCover.isPending || !!pendingCoverId}
            onFilesSelected={(files) => {
              const file = files[0]
              if (!file) return
              setCoverError(null)
              uploadCover.mutate(file, {
                onSuccess: (attachmentId) => setPendingCoverId(attachmentId),
              })
            }}
          />
          {(uploadCover.isPending || pendingCoverId) && <p>Uploading and processing…</p>}
          <FormMessage message={uploadCover.error?.message ?? coverError} tone="error" />
        </>
      )}

      {canManageSettings && (
        <>
          <h2>Calendar</h2>
          <p>
            Configure a custom in-world calendar (month names and lengths) used by session and
            timeline dates. Changes that would make an already-recorded date invalid are rejected —
            adjust those dates first.
          </p>
          <CalendarMonthsEditor value={calendarConfig} onChange={setCalendarConfig} />
          <FormMessage message={saveCalendarConfig.error?.message} />
          {saveCalendarConfig.isSuccess && <FormMessage tone="success" message="Calendar saved." />}
          <Button
            type="button"
            disabled={saveCalendarConfig.isPending}
            onClick={() => saveCalendarConfig.mutate({ calendarConfigJson: calendarConfig })}
          >
            {saveCalendarConfig.isPending ? 'Saving…' : 'Save calendar'}
          </Button>
        </>
      )}

      <h2>Activity log</h2>
      <p>
        <Link to={`/app/campaign/${campaign.id}/audit`}>View campaign activity</Link>
      </p>

      <h2>Archive</h2>
      {campaign.status === 'archived' ? (
        <Button
          variant="secondary"
          onClick={() => restoreCampaign.mutate()}
          disabled={restoreCampaign.isPending}
        >
          Restore campaign
        </Button>
      ) : (
        <Button
          variant="secondary"
          onClick={() => archiveCampaign.mutate()}
          disabled={archiveCampaign.isPending}
        >
          Archive campaign
        </Button>
      )}

      {isOwner && (
        <>
          <h2>Delete campaign</h2>
          <Button
            variant="secondary"
            disabled={deleteCampaign.isPending}
            onClick={() => {
              if (!window.confirm(`Delete "${campaign.name}"? This cannot be undone.`)) return
              deleteCampaign.mutate(undefined, {
                onSuccess: () => navigate('/app/campaigns'),
              })
            }}
          >
            Delete campaign
          </Button>
        </>
      )}
    </section>
  )
}
