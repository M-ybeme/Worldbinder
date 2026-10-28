import type { CampaignRole, EntityDetail } from '@worldbinder/contracts'
import { Badge, ErrorState } from '@worldbinder/ui'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { RelatedContentPanel } from '../../../relationships/components/RelatedContentPanel'
import {
  useEntityBacklinksQuery,
  useEntityRelationshipsQuery,
} from '../../../relationships/hooks/useRelationships'
import type { EntityReference } from '../../lib/entityFacts'
import { ShowMoreList } from './ShowMore'
import { SidePanel } from './SidePanel'

const RELATIONSHIP_LIMIT = 6
const MENTION_LIMIT = 6

/**
 * Everything this entity is connected to, by source:
 * - **From details** — derived from metadata (a location's parent, a
 *   character's current location…). Read live from the entity's own
 *   fields; nothing is stored as a relationship.
 * - **Relationships** — explicit relationship records, with their label.
 * - **Mentioned in** — entries whose text links here (wiki-link backlinks).
 * All three come from endpoints that apply the API's visibility rules;
 * a reference the member can't see is resolved to `null` upstream and
 * never rendered.
 */
export function ConnectionsPanel({
  campaignId,
  entity,
  references,
  resolved,
  canEdit,
  campaignRole,
}: {
  campaignId: string
  entity: EntityDetail
  references: EntityReference[]
  resolved: Map<string, EntityDetail | null>
  canEdit: boolean
  campaignRole: CampaignRole
}) {
  const relationshipsQuery = useEntityRelationshipsQuery(campaignId, entity.id)
  const backlinksQuery = useEntityBacklinksQuery(campaignId, entity.id)
  const [managing, setManaging] = useState(false)

  const derived = references.flatMap((reference) => {
    const target = resolved.get(reference.entityId)
    return target ? [{ ...reference, target }] : []
  })
  const relationships = relationshipsQuery.data ?? []
  const backlinks = backlinksQuery.data ?? []
  const worldUrl = (id: string) => `/app/campaign/${campaignId}/world/${id}`
  const loading = relationshipsQuery.isLoading || backlinksQuery.isLoading
  const isEmpty =
    !loading && derived.length === 0 && relationships.length === 0 && backlinks.length === 0

  return (
    <SidePanel
      title="Connections"
      count={derived.length + relationships.length}
      collapsible={false}
      action={
        canEdit && (
          <button
            type="button"
            className="wb-ed-link-button"
            aria-expanded={managing}
            onClick={() => setManaging((value) => !value)}
          >
            {managing ? 'Done managing' : 'Manage'}
          </button>
        )
      }
    >
      {derived.length > 0 && (
        <div className="wb-ed-group">
          <h3 className="wb-ed-eyebrow">From details</h3>
          <ul className="wb-ed-list" aria-label="Connections from details">
            {derived.map((item) => (
              <li key={item.key}>
                <span className="wb-ed-rel-label">{item.connectionLabel}</span>
                <Link to={worldUrl(item.target.id)}>{item.target.name}</Link>
                {item.target.visibility === 'gm_only' && <Badge tone="warning">GM only</Badge>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {relationshipsQuery.isError && (
        <ErrorState
          message={relationshipsQuery.error.message}
          onRetry={() => relationshipsQuery.refetch()}
        />
      )}
      {relationships.length > 0 && (
        <div className="wb-ed-group">
          <h3 className="wb-ed-eyebrow">Relationships</h3>
          <ShowMoreList
            label="Relationships"
            items={relationships}
            limit={RELATIONSHIP_LIMIT}
            renderItem={(rel) => (
              <li key={rel.relationshipId}>
                <span className="wb-ed-rel-label">{rel.label}</span>
                <Link to={worldUrl(rel.otherEntity.id)}>{rel.otherEntity.name}</Link>
                {rel.visibility === 'gm_only' && <Badge tone="warning">GM only</Badge>}
                {rel.description && <span className="wb-ed-rel-note">{rel.description}</span>}
              </li>
            )}
          />
        </div>
      )}

      {backlinksQuery.isError && (
        <ErrorState
          message={backlinksQuery.error.message}
          onRetry={() => backlinksQuery.refetch()}
        />
      )}
      {backlinks.length > 0 && (
        <div className="wb-ed-group">
          <h3 className="wb-ed-eyebrow">
            Mentioned in <span className="wb-ed-count">{backlinks.length}</span>
          </h3>
          <ShowMoreList
            label="Mentioned in"
            className="wb-ed-chips"
            items={backlinks}
            limit={MENTION_LIMIT}
            renderItem={(link) => (
              <li key={`${link.sourceEntity.id}-${link.section}`}>
                <Link className="wb-ed-chip" to={worldUrl(link.sourceEntity.id)}>
                  {link.sourceEntity.name}
                  {link.section === 'gm' && <span className="wb-ed-chip__note">· GM notes</span>}
                </Link>
              </li>
            )}
          />
        </div>
      )}

      {loading && <p className="wb-ed-muted">Loading connections…</p>}
      {isEmpty && !managing && <p className="wb-ed-muted">No connections yet.</p>}

      {managing && (
        <div className="wb-ed-manage">
          <RelatedContentPanel
            campaignId={campaignId}
            entityId={entity.id}
            canEdit={canEdit}
            campaignRole={campaignRole}
          />
        </div>
      )}
    </SidePanel>
  )
}
