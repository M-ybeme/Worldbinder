import {
  Badge,
  Button,
  CardGrid,
  Checkbox,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Select,
  TextField,
} from '@worldbinder/ui'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { QuickCreateEntityDialog } from '../components/QuickCreateEntityDialog'
import { ENTITY_TYPE_LABELS, ENTITY_TYPES, EntityTypeIcon } from '../lib/entityTypeIcons'
import { useEntitiesQuery } from '../hooks/useEntities'
import '../entities.css'

const ENTITY_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  ...ENTITY_TYPES.map((type) => ({ value: type, label: ENTITY_TYPE_LABELS[type] })),
]

const VISIBILITY_OPTIONS = [
  { value: '', label: 'All visibility' },
  { value: 'public', label: 'Public' },
  { value: 'gm_only', label: 'GM only' },
]

const SORT_OPTIONS = [
  { value: 'updatedAt', label: 'Recently updated' },
  { value: 'name', label: 'Name (A–Z)' },
]

const MANAGEMENT_ROLES = new Set(['owner', 'gm', 'editor'])

const DEFAULT_SORT = 'updatedAt' as const

export function WorldListPage() {
  const { campaign } = useCampaignOutletContext()
  const [entityType, setEntityType] = useState('')
  const [tag, setTag] = useState('')
  const [search, setSearch] = useState('')
  const [visibility, setVisibility] = useState('')
  const [sortBy, setSortBy] = useState<'updatedAt' | 'name'>(DEFAULT_SORT)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const canCreate = MANAGEMENT_ROLES.has(campaign.role)

  const hasActiveFilters =
    !!entityType || !!tag || !!search || !!visibility || sortBy !== DEFAULT_SORT || favoritesOnly

  function clearFilters() {
    setEntityType('')
    setTag('')
    setSearch('')
    setVisibility('')
    setSortBy(DEFAULT_SORT)
    setFavoritesOnly(false)
  }

  const entitiesQuery = useEntitiesQuery(campaign.id, {
    entityType: (entityType || undefined) as never,
    tag: tag || undefined,
    search: search || undefined,
    visibility: (visibility || undefined) as never,
    sortBy,
    favorite: favoritesOnly ? 'true' : undefined,
  })

  return (
    <section>
      <PageHeader
        title="World"
        actions={
          <>
            <Link
              className="wb-button wb-button--secondary"
              to={`/app/campaign/${campaign.id}/world/timeline`}
            >
              Timeline
            </Link>
            {canCreate && <Button onClick={() => setQuickCreateOpen(true)}>New entity</Button>}
          </>
        }
      />

      <QuickCreateEntityDialog
        campaignId={campaign.id}
        open={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
      />

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
        <Select
          id="visibilityFilter"
          label="Visibility"
          options={VISIBILITY_OPTIONS}
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
        />
        <Select
          id="sortByFilter"
          label="Sort"
          options={SORT_OPTIONS}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'updatedAt' | 'name')}
        />
        <Checkbox
          label="Favorites only"
          checked={favoritesOnly}
          onChange={(e) => setFavoritesOnly(e.target.checked)}
        />
        {hasActiveFilters && (
          <Button variant="secondary" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {!entitiesQuery.isLoading && !entitiesQuery.isError && (
        <p className="wb-world-filters__count">
          {entitiesQuery.data?.length ?? 0}{' '}
          {entitiesQuery.data?.length === 1 ? 'entity' : 'entities'}
        </p>
      )}

      {entitiesQuery.isLoading && <LoadingState label="Loading entities…" />}
      {entitiesQuery.isError && (
        <ErrorState message={entitiesQuery.error.message} onRetry={() => entitiesQuery.refetch()} />
      )}
      {!entitiesQuery.isLoading && !entitiesQuery.isError && entitiesQuery.data?.length === 0 && (
        <EmptyState
          message={hasActiveFilters ? 'No entities match your filters.' : 'No entities yet.'}
          action={
            hasActiveFilters ? (
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      )}

      {!entitiesQuery.isLoading && !entitiesQuery.isError && !!entitiesQuery.data?.length && (
        <CardGrid>
          {entitiesQuery.data.map((entity) => (
            <Link
              key={entity.id}
              to={`/app/campaign/${campaign.id}/world/${entity.id}`}
              className="wb-entity-card"
            >
              <div className="wb-entity-card__header">
                <EntityTypeIcon type={entity.entityType} />
                <span className="wb-entity-card__name">{entity.name}</span>
              </div>
              {entity.summary && <p className="wb-entity-card__summary">{entity.summary}</p>}
              <span className="wb-entity-card__meta">
                {entity.entityType}
                {entity.visibility === 'gm_only' && <Badge tone="warning">GM only</Badge>}
              </span>
              {entity.tags.length > 0 && (
                <span className="wb-entity-card__tags">{entity.tags.join(', ')}</span>
              )}
            </Link>
          ))}
        </CardGrid>
      )}
    </section>
  )
}
