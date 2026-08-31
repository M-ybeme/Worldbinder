import { zodResolver } from '@hookform/resolvers/zod'
import type { DashboardBackdropConfig, DashboardBackdropFit } from '@worldbinder/contracts'
import {
  Button,
  ConfirmDialog,
  FileDropzone,
  FormMessage,
  LoadingState,
  Select,
  Slider,
  TextField,
} from '@worldbinder/ui'
import {
  DEFAULT_CALENDAR_CONFIG,
  DEFAULT_DASHBOARD_BACKDROP_CONFIG,
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
import { DashboardBackdrop } from '../components/DashboardBackdrop'
import { useCampaignOutletContext } from '../hooks/useCampaignContext'
import {
  useArchiveCampaignMutation,
  useDeleteCampaignMutation,
  useRestoreCampaignMutation,
  useUpdateCampaignMutation,
} from '../hooks/useCampaigns'

const BACKDROP_FIT_OPTIONS: { value: DashboardBackdropFit; label: string }[] = [
  { value: 'cover', label: 'Cover (crop to fill, no dead space)' },
  { value: 'contain', label: 'Contain (show whole image, letterboxed)' },
  { value: 'stretch', label: 'Stretch (fill by distorting)' },
]

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
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

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

  const [backdropConfig, setBackdropConfig] = useState<DashboardBackdropConfig>(
    campaign.dashboardBackdropJson ?? DEFAULT_DASHBOARD_BACKDROP_CONFIG,
  )
  const saveBackdropConfig = useUpdateCampaignMutation(campaign.id)

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
            <img src={campaign.coverImageUrl} alt="Campaign cover" className="wb-image-preview" />
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
          {(uploadCover.isPending || pendingCoverId) && (
            <LoadingState label="Uploading and processing…" />
          )}
          <FormMessage message={uploadCover.error?.message ?? coverError} tone="error" />
        </>
      )}

      {canManageSettings && campaign.coverImageUrl && (
        <>
          <h2>Dashboard backdrop</h2>
          <p>Show the cover image behind the campaign Dashboard's content.</p>
          <DashboardBackdrop imageUrl={campaign.coverImageUrl} config={backdropConfig} />
          <div className="wb-form">
            <Select
              label="Fill mode"
              options={BACKDROP_FIT_OPTIONS}
              value={backdropConfig.fit}
              onChange={(event) =>
                setBackdropConfig((config) => ({
                  ...config,
                  fit: event.target.value as DashboardBackdropFit,
                }))
              }
            />
            <Slider
              label="Opacity"
              valueLabel={`${Math.round(backdropConfig.opacity * 100)}%`}
              min={0}
              max={0.6}
              step={0.05}
              value={backdropConfig.opacity}
              onChange={(event) =>
                setBackdropConfig((config) => ({ ...config, opacity: Number(event.target.value) }))
              }
            />
            <Slider
              label="Zoom"
              valueLabel={`${Math.round(backdropConfig.zoom * 100)}%`}
              min={1}
              max={2.5}
              step={0.05}
              value={backdropConfig.zoom}
              onChange={(event) =>
                setBackdropConfig((config) => ({ ...config, zoom: Number(event.target.value) }))
              }
            />
            <Slider
              label="Focal point — horizontal"
              valueLabel={`${Math.round(backdropConfig.focalX)}%`}
              min={0}
              max={100}
              step={1}
              value={backdropConfig.focalX}
              onChange={(event) =>
                setBackdropConfig((config) => ({ ...config, focalX: Number(event.target.value) }))
              }
            />
            <Slider
              label="Focal point — vertical"
              valueLabel={`${Math.round(backdropConfig.focalY)}%`}
              min={0}
              max={100}
              step={1}
              value={backdropConfig.focalY}
              onChange={(event) =>
                setBackdropConfig((config) => ({ ...config, focalY: Number(event.target.value) }))
              }
            />
            <FormMessage message={saveBackdropConfig.error?.message} />
            {saveBackdropConfig.isSuccess && (
              <FormMessage tone="success" message="Backdrop saved." />
            )}
            <div className="wb-entity-header__actions">
              <Button
                type="button"
                disabled={saveBackdropConfig.isPending}
                onClick={() => saveBackdropConfig.mutate({ dashboardBackdropJson: backdropConfig })}
              >
                {saveBackdropConfig.isPending ? 'Saving…' : 'Save backdrop'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={saveBackdropConfig.isPending}
                onClick={() => {
                  setBackdropConfig(DEFAULT_DASHBOARD_BACKDROP_CONFIG)
                  saveBackdropConfig.mutate({ dashboardBackdropJson: null })
                }}
              >
                Reset to default
              </Button>
            </div>
          </div>
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

      <h2>Tags</h2>
      <p>
        <Link to={`/app/campaign/${campaign.id}/tags`}>Manage tags</Link>
      </p>

      <h2>Import / Export</h2>
      <p>
        <Link to={`/app/campaign/${campaign.id}/import-export`}>Export this campaign</Link>
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
            onClick={() => setConfirmDeleteOpen(true)}
          >
            Delete campaign
          </Button>
        </>
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        title={`Delete "${campaign.name}"?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        danger
        pending={deleteCampaign.isPending}
        onConfirm={() => {
          setConfirmDeleteOpen(false)
          deleteCampaign.mutate(undefined, {
            onSuccess: () => navigate('/app/campaigns'),
          })
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </section>
  )
}
