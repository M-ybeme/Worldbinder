import { useCampaignOutletContext } from '../hooks/useCampaignContext'

export function CampaignOverviewPage() {
  const { campaign } = useCampaignOutletContext()

  return (
    <section>
      <p>{campaign.description ?? 'No description yet.'}</p>
      <dl className="wb-campaign-overview">
        <dt>System</dt>
        <dd>{campaign.systemName ?? '—'}</dd>
        <dt>Status</dt>
        <dd>{campaign.status}</dd>
        <dt>Your role</dt>
        <dd>{campaign.role}</dd>
      </dl>
    </section>
  )
}
