import type { MapLayerSummary, MapPinSummary } from '@worldbinder/contracts'
import { Badge, IconButton } from '@worldbinder/ui'
import { ExternalLink, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EntityTypeIcon, ENTITY_TYPE_LABELS } from '../../entities/lib/entityTypeIcons'
import { useEntityRelationshipsQuery } from '../../relationships/hooks/useRelationships'
import { pinLabel } from '../lib/pins'

const RELATIONSHIP_LIMIT = 4

/**
 * What a selected pin is: its name, type and layer, the linked entry's
 * summary and a few of its connections, with ways on — the article, the
 * entry's own editor (autosave, drafts, conflict checks), and the pin's
 * own fields in edit mode. The entry itself is never edited here.
 *
 * `presentation` (At the Table): only what the server's player-safe map
 * returned — no relationship lookups, which would run with the GM's own
 * access, and no edit links.
 */
export function PinDetails({
  campaignId,
  pin,
  layers,
  canEditEntries,
  onClose,
  onEditPin,
  presentation = false,
}: {
  campaignId: string
  pin: MapPinSummary
  layers: MapLayerSummary[]
  canEditEntries: boolean
  onClose: () => void
  /** Edit mode only: open the pin's own fields. */
  onEditPin?: () => void
  presentation?: boolean
}) {
  const layer = pin.layerId ? layers.find((item) => item.id === pin.layerId) : null
  const entityId = pin.locationEntityId
  const worldUrl = entityId ? `/app/campaign/${campaignId}/world/${entityId}` : null

  return (
    <section className="wb-pin-details" aria-labelledby={`pin-${pin.id}-title`}>
      <div className="wb-pin-details__head">
        <div className="wb-pin-details__eyebrow">
          {pin.locationEntityType && <EntityTypeIcon type={pin.locationEntityType} size={14} />}
          <span>
            {pin.locationEntityType ? ENTITY_TYPE_LABELS[pin.locationEntityType] : 'Pin'}
            {layer && ` · ${layer.name}`}
          </span>
          {!presentation && pin.visibility === 'gm_only' && <Badge tone="warning">GM only</Badge>}
        </div>
        <IconButton label={`Close ${pinLabel(pin)}`} onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </IconButton>
      </div>
      <h2 id={`pin-${pin.id}-title`} className="wb-pin-details__title">
        {pinLabel(pin)}
      </h2>
      {pin.label && pin.locationEntityName && pin.label !== pin.locationEntityName && (
        <p className="wb-pin-details__muted">Linked to {pin.locationEntityName}</p>
      )}
      {pin.locationEntitySummary && <p className="wb-pin-details__summary">{pin.locationEntitySummary}</p>}
      {!presentation && entityId && <PinConnections campaignId={campaignId} entityId={entityId} />}
      {!entityId && <p className="wb-pin-details__muted">Not linked to an entry.</p>}
      {!presentation && (
        <div className="wb-pin-details__actions">
          {worldUrl && (
            <Link className="wb-button wb-button--primary" to={worldUrl}>
              Open article
            </Link>
          )}
          {worldUrl && canEditEntries && (
            <Link className="wb-button wb-button--secondary" to={`${worldUrl}/edit/content`}>
              Edit entry
            </Link>
          )}
          {onEditPin && (
            <button type="button" className="wb-button wb-button--secondary" onClick={onEditPin}>
              Edit pin
            </button>
          )}
        </div>
      )}
      {presentation && worldUrl && (
        <a className="wb-pin-details__open" href={worldUrl} target="_blank" rel="noreferrer">
          Open article <ExternalLink size={14} aria-hidden="true" />
          <span className="wb-visually-hidden"> (opens in a new tab)</span>
        </a>
      )}
    </section>
  )
}

function PinConnections({ campaignId, entityId }: { campaignId: string; entityId: string }) {
  const relationshipsQuery = useEntityRelationshipsQuery(campaignId, entityId)
  const relationships = relationshipsQuery.data ?? []
  if (relationships.length === 0) return null
  return (
    <ul className="wb-pin-details__connections" aria-label="Connections">
      {relationships.slice(0, RELATIONSHIP_LIMIT).map((rel) => (
        <li key={rel.relationshipId}>
          <span className="wb-pin-details__muted">{rel.label}</span>{' '}
          <Link to={`/app/campaign/${campaignId}/world/${rel.otherEntity.id}`}>{rel.otherEntity.name}</Link>
        </li>
      ))}
      {relationships.length > RELATIONSHIP_LIMIT && (
        <li className="wb-pin-details__muted">and {relationships.length - RELATIONSHIP_LIMIT} more</li>
      )}
    </ul>
  )
}
