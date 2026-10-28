import type { EntityDetail } from '@worldbinder/contracts'
import { Badge, IconButton, MenuButton, type MenuButtonItem } from '@worldbinder/ui'
import { MoreHorizontal, Pencil, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ENTITY_TYPE_LABELS, EntityTypeIcon } from '../../lib/entityTypeIcons'
import { EntityBreadcrumbs } from './EntityBreadcrumbs'

/**
 * The entity page's identity block: breadcrumbs (World › type › name),
 * the page's only `h1`, type and aliases, visibility badges, tags, and the
 * actions — favorite (any member, as before), Edit (owner/GM/editor) and a
 * More menu (copy link; delete for owner/GM/editor). The API enforces the
 * same permissions; these only decide what's offered.
 */
export function EntityHeader({
  campaignId,
  entity,
  hasGmNotes,
  canManage,
  favoritePending,
  onToggleFavorite,
  onCopyLink,
  onDelete,
}: {
  campaignId: string
  entity: EntityDetail
  hasGmNotes: boolean
  canManage: boolean
  favoritePending: boolean
  onToggleFavorite: () => void
  onCopyLink: () => void
  onDelete: () => void
}) {
  const worldUrl = `/app/campaign/${campaignId}/world`
  const moreItems: MenuButtonItem[] = [
    { label: 'Copy link', onSelect: onCopyLink },
    ...(canManage ? [{ label: 'Delete…', onSelect: onDelete, danger: true }] : []),
  ]

  return (
    <header className="wb-ed-header">
      <EntityBreadcrumbs
        campaignId={campaignId}
        entityId={entity.id}
        entityType={entity.entityType}
        name={entity.name}
      />

      <div className="wb-ed-header__row">
        <div className="wb-ed-header__identity">
          <div className="wb-ed-header__name">
            <span className="wb-ed-type-tile" aria-hidden="true">
              <EntityTypeIcon type={entity.entityType} size={20} />
            </span>
            <h1>{entity.name}</h1>
          </div>
          <p className="wb-ed-header__meta">
            <span>{ENTITY_TYPE_LABELS[entity.entityType]}</span>
            {entity.aliases.length > 0 && (
              <span>
                also called <em>{entity.aliases.join(', ')}</em>
              </span>
            )}
            {entity.visibility === 'gm_only' && <Badge tone="warning">GM only</Badge>}
            {entity.visibility !== 'gm_only' && hasGmNotes && (
              <Badge tone="warning">Has GM-only notes</Badge>
            )}
            {entity.status === 'archived' && <Badge>Archived</Badge>}
          </p>
          {entity.tags.length > 0 && (
            <ul className="wb-ed-chips" aria-label="Tags">
              {entity.tags.map((tag) => (
                <li key={tag} className="wb-ed-chip wb-ed-chip--static">
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="wb-ed-header__actions">
          <IconButton
            label={entity.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            className="wb-favorite-toggle"
            aria-pressed={entity.isFavorite}
            disabled={favoritePending}
            onClick={onToggleFavorite}
          >
            <Star size={18} fill={entity.isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
          </IconButton>
          <MenuButton
            buttonClassName="wb-icon-button"
            ariaLabel="More actions"
            menuLabel="More actions"
            label={<MoreHorizontal size={18} aria-hidden="true" />}
            items={moreItems}
          />
          {canManage && (
            <Link className="wb-button wb-button--primary wb-ed-edit" to={`${worldUrl}/${entity.id}/edit/content`}>
              <Pencil size={16} aria-hidden="true" />
              Edit
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
