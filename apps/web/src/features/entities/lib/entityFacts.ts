import type { EntityType } from '@worldbinder/contracts'

/**
 * What each entity type's metadata (`metadataJson`, see
 * packages/validation's per-type metadata schemas) contributes to the
 * entity page: plain facts for the facts strip, and references to other
 * entities, which show both as a linked fact and as a *derived* connection
 * (read from metadata, never stored as a relationship). Labels match the
 * edit form's (EntityMetadataFields). Anything not listed — or empty —
 * simply doesn't render.
 */

type FactFormat = 'text' | 'number' | 'list' | 'enum'

interface FactDefinition {
  key: string
  label: string
  format?: FactFormat
}

export interface ReferenceDefinition {
  key: string
  /** Label in the facts strip, e.g. "Parent location". */
  factLabel: string
  /** Relationship-style label in Connections, e.g. "Located in". */
  connectionLabel: string
}

const FACTS: Record<EntityType, FactDefinition[]> = {
  character: [
    { key: 'pronouns', label: 'Pronouns' },
    { key: 'species', label: 'Species' },
    { key: 'occupation', label: 'Occupation' },
    { key: 'lifeStatus', label: 'Life status', format: 'enum' },
  ],
  location: [
    { key: 'locationType', label: 'Location type' },
    { key: 'population', label: 'Population', format: 'number' },
    { key: 'government', label: 'Government' },
  ],
  faction: [{ key: 'factionType', label: 'Faction type' }],
  organization: [{ key: 'organizationType', label: 'Organization type' }],
  item: [
    { key: 'itemType', label: 'Item type' },
    { key: 'rarity', label: 'Rarity' },
  ],
  deity: [
    { key: 'domains', label: 'Domains', format: 'list' },
    { key: 'alignment', label: 'Alignment' },
    { key: 'symbol', label: 'Symbol' },
  ],
  creature: [
    { key: 'creatureType', label: 'Creature type' },
    { key: 'habitat', label: 'Habitat' },
    { key: 'threatLevel', label: 'Threat level' },
  ],
  event: [{ key: 'eventType', label: 'Event type' }],
  quest: [
    { key: 'questType', label: 'Quest type' },
    { key: 'questStatus', label: 'Quest status', format: 'enum' },
  ],
  lore: [{ key: 'loreCategory', label: 'Lore category' }],
  custom: [],
}

const REFERENCES: Record<EntityType, ReferenceDefinition[]> = {
  character: [
    { key: 'currentLocationEntityId', factLabel: 'Current location', connectionLabel: 'Currently in' },
  ],
  location: [
    { key: 'parentLocationEntityId', factLabel: 'Parent location', connectionLabel: 'Located in' },
  ],
  faction: [
    { key: 'leaderEntityId', factLabel: 'Leader', connectionLabel: 'Led by' },
    { key: 'headquartersLocationEntityId', factLabel: 'Headquarters', connectionLabel: 'Based in' },
  ],
  organization: [
    { key: 'leaderEntityId', factLabel: 'Leader', connectionLabel: 'Led by' },
    { key: 'headquartersLocationEntityId', factLabel: 'Headquarters', connectionLabel: 'Based in' },
  ],
  item: [
    { key: 'currentOwnerEntityId', factLabel: 'Current owner', connectionLabel: 'Owned by' },
    { key: 'currentLocationEntityId', factLabel: 'Current location', connectionLabel: 'Kept in' },
  ],
  deity: [],
  creature: [],
  event: [{ key: 'locationEntityId', factLabel: 'Location', connectionLabel: 'Took place in' }],
  quest: [{ key: 'questGiverEntityId', factLabel: 'Quest giver', connectionLabel: 'Given by' }],
  lore: [],
  custom: [],
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatFact(raw: unknown, format: FactFormat = 'text'): string | null {
  if (raw === undefined || raw === null) return null
  if (format === 'number') return typeof raw === 'number' ? raw.toLocaleString() : null
  if (format === 'list') {
    if (!Array.isArray(raw)) return null
    const items = raw.filter((item): item is string => typeof item === 'string' && item !== '')
    return items.length > 0 ? items.join(', ') : null
  }
  if (typeof raw !== 'string' || raw.trim() === '') return null
  return format === 'enum' ? capitalize(raw) : raw
}

export interface Fact {
  label: string
  value: string
}

/** Plain (non-reference) facts that have a value, in display order. For
 * custom entities, their free-form `fields` with primitive values. */
export function readFacts(entityType: EntityType, metadata: Record<string, unknown> | null): Fact[] {
  if (!metadata) return []
  if (entityType === 'custom') {
    const fields = metadata.fields
    if (!fields || typeof fields !== 'object') return []
    return Object.entries(fields as Record<string, unknown>).flatMap(([label, raw]) => {
      if (typeof raw === 'number') return [{ label, value: raw.toLocaleString() }]
      if (typeof raw === 'boolean') return [{ label, value: raw ? 'Yes' : 'No' }]
      if (typeof raw === 'string' && raw.trim() !== '') return [{ label, value: raw }]
      return []
    })
  }
  return FACTS[entityType].flatMap((definition) => {
    const value = formatFact(metadata[definition.key], definition.format)
    return value === null ? [] : [{ label: definition.label, value }]
  })
}

export interface EntityReference extends ReferenceDefinition {
  entityId: string
}

/** The metadata fields that point at other entities and are set. */
export function readReferences(
  entityType: EntityType,
  metadata: Record<string, unknown> | null,
): EntityReference[] {
  if (!metadata) return []
  return REFERENCES[entityType].flatMap((definition) => {
    const id = metadata[definition.key]
    return typeof id === 'string' && id !== '' ? [{ ...definition, entityId: id }] : []
  })
}
