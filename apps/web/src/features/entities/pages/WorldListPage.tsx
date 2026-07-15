import { EmptyState, ErrorState, LoadingState, Select, TextField } from '@worldbinder/ui'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { useEntitiesQuery } from '../hooks/useEntities'

const ENTITY_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'character', label: 'Character' },
  { value: 'location', label: 'Location' },
  { value: 'faction', label: 'Faction' },
  { value: 'organization', label: 'Organization' },
  { value: 'item', label: 'Item' },
  { value: 'deity', label: 'Deity' },
  { value: 'creature', label: 'Creature' },
  { value: 'event', label: 'Event' },
  { value: 'quest', label: 'Quest' },
  { value: 'lore', label: 'Lore' },
  { value: 'custom', label: 'Custom' },
]

const MANAGEMENT_ROLES = new Set(['owner', 'gm', 'editor'])

export function WorldListPage() {
  const { campaign } = useCampaignOutletContext()
  const [entityType, setEntityType] = useState('')
  const [tag, setTag] = useState('')
  const [search, setSearch] = useState('')
  const canCreate = MANAGEMENT_ROLES.has(campaign.role)

  const entitiesQuery = useEntitiesQuery(campaign.id, {
    entityType: (entityType || undefined) as never,
    tag: tag || undefined,
    search: search || undefined,
  })

  return (
    <section>
      <header className="wb-world-header">
        <h1>World</h1>
        <div>
          <Link to={`/app/campaign/${campaign.id}/world/timeline`}>Timeline</Link>
          {canCreate && (
            <Link
              className="wb-button wb-button--primary"
              to={`/app/campaign/${campaign.id}/world/new`}
              style={{ marginLeft: '1rem' }}
            >
              New entity
            </Link>
          )}
        </div>
      </header>

      <div className="wb-world-filters">
        <TextField
          id="search"
          label="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          id="entityTypeFilter"
          label="Type"
          options={ENTITY_TYPE_OPTIONS}
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
        />
        <TextField id="tag" label="Tag" value={tag} onChange={(e) => setTag(e.target.value)} />
      </div>

      {entitiesQuery.isLoading && <LoadingState label="Loading entities…" />}
      {entitiesQuery.isError && (
        <ErrorState message={entitiesQuery.error.message} onRetry={() => entitiesQuery.refetch()} />
      )}
      {!entitiesQuery.isLoading && !entitiesQuery.isError && entitiesQuery.data?.length === 0 && (
        <EmptyState message="No entities yet." />
      )}

      {!entitiesQuery.isLoading && !entitiesQuery.isError && !!entitiesQuery.data?.length && (
        <ul className="wb-entity-list">
          {entitiesQuery.data.map((entity) => (
            <li key={entity.id}>
              <Link to={`/app/campaign/${campaign.id}/world/${entity.id}`}>{entity.name}</Link>
              <span className="wb-entity-list__meta">
                {entity.entityType}
                {entity.tags.length > 0 ? ` · ${entity.tags.join(', ')}` : ''}
                {entity.visibility === 'gm_only' ? ' · GM only' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
