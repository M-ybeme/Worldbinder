import type { EntityType } from '@worldbinder/contracts'
import { Link } from 'react-router-dom'

const TYPE_PLURALS: Record<EntityType, string> = {
  character: 'Characters',
  location: 'Locations',
  faction: 'Factions',
  organization: 'Organizations',
  item: 'Items',
  deity: 'Deities',
  creature: 'Creatures',
  event: 'Events',
  quest: 'Quests',
  lore: 'Lore',
  custom: 'Custom entries',
}

/**
 * World › type › entity (› Edit) — its own `Breadcrumb` landmark, shared
 * by the article and the editor. On the editor, the entity crumb links
 * back to the article and "Edit" is the current page.
 */
export function EntityBreadcrumbs({
  campaignId,
  entityId,
  entityType,
  name,
  editing = false,
}: {
  campaignId: string
  entityId: string
  entityType: EntityType
  name: string
  editing?: boolean
}) {
  const worldUrl = `/app/campaign/${campaignId}/world`
  return (
    <nav aria-label="Breadcrumb" className="wb-ed-breadcrumbs">
      <ol>
        <li>
          <Link to={worldUrl}>World</Link>
        </li>
        <li>
          <Link to={`${worldUrl}?type=${entityType}`}>{TYPE_PLURALS[entityType]}</Link>
        </li>
        {editing ? (
          <>
            <li>
              <Link to={`${worldUrl}/${entityId}`}>{name}</Link>
            </li>
            <li aria-current="page">Edit</li>
          </>
        ) : (
          <li aria-current="page">{name}</li>
        )}
      </ol>
    </nav>
  )
}
