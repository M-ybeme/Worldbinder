import type { MapSummary } from '@worldbinder/contracts'
import { EmptyState, ErrorState, LoadingState } from '@worldbinder/ui'
import { Link } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { useMapsQuery } from '../hooks/useMaps'

const MANAGEMENT_ROLES = new Set(['owner', 'gm', 'editor'])

function MapCard({ campaignId, map }: { campaignId: string; map: MapSummary }) {
  return (
    <li className="wb-map-list__card">
      <Link to={`/app/campaign/${campaignId}/maps/${map.id}`}>
        {map.imageUrl && <img src={map.imageUrl} alt="" />}
        <span>{map.name}</span>
        {map.visibility === 'gm_only' && <span className="wb-session-list__meta"> · GM only</span>}
      </Link>
    </li>
  )
}

export function MapListPage() {
  const { campaign } = useCampaignOutletContext()
  const canCreate = MANAGEMENT_ROLES.has(campaign.role)
  const mapsQuery = useMapsQuery(campaign.id)
  const maps = mapsQuery.data ?? []

  return (
    <section>
      <header className="wb-world-header">
        <h1>Maps</h1>
        {canCreate && (
          <Link
            className="wb-button wb-button--primary"
            to={`/app/campaign/${campaign.id}/maps/new`}
          >
            New map
          </Link>
        )}
      </header>

      {mapsQuery.isLoading && <LoadingState label="Loading maps…" />}
      {mapsQuery.isError && (
        <ErrorState message={mapsQuery.error.message} onRetry={() => mapsQuery.refetch()} />
      )}
      {!mapsQuery.isLoading && !mapsQuery.isError && maps.length === 0 && (
        <EmptyState message="No maps yet." />
      )}

      {!mapsQuery.isLoading && !mapsQuery.isError && maps.length > 0 && (
        <ul className="wb-map-list">
          {maps.map((map) => (
            <MapCard key={map.id} campaignId={campaign.id} map={map} />
          ))}
        </ul>
      )}
    </section>
  )
}
