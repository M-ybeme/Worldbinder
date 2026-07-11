import { Navigate, Outlet, useParams } from 'react-router-dom'
import { useCampaignQuery } from '../hooks/useCampaigns'

/** Mirrors auth's RequireAuth, but the "not allowed" state is a redirect to
 * the campaign list rather than login — the server (not this guard) is the
 * source of truth: a 404 here means "not your campaign," and the UI just
 * needs to not dead-end the user (roadmap §5.6: UI checks are usability only). */
export function RequireCampaignMembership() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const campaignQuery = useCampaignQuery(campaignId)

  if (!campaignId) return <Navigate to="/app/campaigns" replace />
  if (campaignQuery.isLoading) return null
  if (campaignQuery.isError || !campaignQuery.data) {
    return <Navigate to="/app/campaigns" replace />
  }

  return <Outlet context={{ campaign: campaignQuery.data }} />
}
