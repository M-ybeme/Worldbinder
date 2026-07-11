import { zodResolver } from '@hookform/resolvers/zod'
import { Button, FormMessage, TextField } from '@worldbinder/ui'
import { updateCampaignSchema, type UpdateCampaignInput } from '@worldbinder/validation'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useCampaignOutletContext } from '../hooks/useCampaignContext'
import {
  useArchiveCampaignMutation,
  useDeleteCampaignMutation,
  useRestoreCampaignMutation,
  useUpdateCampaignMutation,
} from '../hooks/useCampaigns'

export function CampaignSettingsPage() {
  const { campaign } = useCampaignOutletContext()
  const navigate = useNavigate()
  const isOwner = campaign.role === 'owner'

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
