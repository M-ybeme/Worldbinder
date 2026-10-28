import type { EntityDetail } from '@worldbinder/contracts'
import { Link } from 'react-router-dom'
import type { EntityReference, Fact } from '../../lib/entityFacts'

/**
 * The entity's key facts from its metadata, as a definition list. Plain
 * facts first, then references to other entities as links. References the
 * member can't see (or that no longer exist) are left out rather than shown
 * as an empty or broken value. Nothing renders when there are no facts.
 */
export function FactsStrip({
  campaignId,
  facts,
  references,
  resolved,
}: {
  campaignId: string
  facts: Fact[]
  references: EntityReference[]
  resolved: Map<string, EntityDetail | null>
}) {
  const linked = references.flatMap((reference) => {
    const target = resolved.get(reference.entityId)
    return target ? [{ label: reference.factLabel, target }] : []
  })
  if (facts.length === 0 && linked.length === 0) return null

  return (
    <dl className="wb-ed-facts" aria-label="Key facts">
      {facts.map((fact) => (
        <div key={fact.label} className="wb-ed-fact">
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
      {linked.map(({ label, target }) => (
        <div key={label} className="wb-ed-fact">
          <dt>{label}</dt>
          <dd>
            <Link to={`/app/campaign/${campaignId}/world/${target.id}`}>{target.name}</Link>
          </dd>
        </div>
      ))}
    </dl>
  )
}
