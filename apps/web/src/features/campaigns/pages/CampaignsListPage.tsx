import { zodResolver } from '@hookform/resolvers/zod'
import {
  Button,
  EmptyState,
  ErrorState,
  FormMessage,
  LoadingState,
  TextField,
} from '@worldbinder/ui'
import { createCampaignSchema, type CreateCampaignInput } from '@worldbinder/validation'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { useCampaignsQuery, useCreateCampaignMutation } from '../hooks/useCampaigns'

export function CampaignsListPage() {
  const campaignsQuery = useCampaignsQuery()
  const createCampaign = useCreateCampaignMutation()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateCampaignInput>({ resolver: zodResolver(createCampaignSchema) })

  const onSubmit = handleSubmit((data) => {
    createCampaign.mutate(data, { onSuccess: () => reset() })
  })

  return (
    <section>
      <h1>Your campaigns</h1>
      <p>
        <Link to="/app/campaigns/import">Import a campaign from an archive</Link>
      </p>
      {campaignsQuery.isLoading && <LoadingState label="Loading campaigns…" />}
      {campaignsQuery.isError && (
        <ErrorState
          message={campaignsQuery.error.message}
          onRetry={() => campaignsQuery.refetch()}
        />
      )}
      {!campaignsQuery.isLoading &&
        !campaignsQuery.isError &&
        campaignsQuery.data?.length === 0 && (
          <EmptyState message="You aren't a member of any campaigns yet. Create one below to get started." />
        )}

      {!campaignsQuery.isLoading && !campaignsQuery.isError && !!campaignsQuery.data?.length && (
        <ul className="wb-campaign-list">
          {campaignsQuery.data.map((campaign) => (
            <li key={campaign.id}>
              <Link to={`/app/campaign/${campaign.id}`}>{campaign.name}</Link>
              <span className="wb-campaign-list__meta">
                {campaign.role} · {campaign.status}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h2>Create a campaign</h2>
      <form className="wb-form" onSubmit={onSubmit} noValidate>
        <TextField label="Name" error={errors.name?.message} {...register('name')} />
        <TextField
          label="System (optional)"
          error={errors.systemName?.message}
          {...register('systemName')}
        />
        <FormMessage message={createCampaign.error?.message} />
        <Button type="submit" disabled={createCampaign.isPending}>
          {createCampaign.isPending ? 'Creating…' : 'Create campaign'}
        </Button>
      </form>
    </section>
  )
}
