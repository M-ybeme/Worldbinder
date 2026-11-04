import { MenuButton } from '@worldbinder/ui'
import { ChevronDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useMapsQuery } from '../hooks/useMaps'

/**
 * The current map's name as a menu of the campaign's other maps (only the
 * ones this member can see — the list endpoint filters them), so moving
 * between maps doesn't mean going back to the list.
 */
export function MapSwitcher({ campaignId, mapId, mapName }: { campaignId: string; mapId: string; mapName: string }) {
  const mapsQuery = useMapsQuery(campaignId)
  const navigate = useNavigate()
  const others = (mapsQuery.data ?? []).filter((map) => map.id !== mapId)

  if (others.length === 0) {
    return <h1 className="wb-mapws__title">{mapName}</h1>
  }

  return (
    <div className="wb-mapws__switcher">
      <h1 className="wb-visually-hidden">{mapName}</h1>
      <MenuButton
        label={
          <>
            <span className="wb-mapws__title" aria-hidden="true">
              {mapName}
            </span>
            <ChevronDown size={16} aria-hidden="true" />
          </>
        }
        ariaLabel={`Map: ${mapName}. Switch map`}
        menuLabel="Switch map"
        buttonClassName="wb-mapws__switcher-button"
        items={others.map((map) => ({
          label: map.name,
          onSelect: () => navigate(`/app/campaign/${campaignId}/maps/${map.id}`),
        }))}
      />
    </div>
  )
}
