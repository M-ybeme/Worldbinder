import type { EntityType } from '@worldbinder/contracts'
import { Select, TextField } from '@worldbinder/ui'

export interface EntityMetadataFieldsProps {
  entityType: EntityType
  value: Record<string, unknown>
  onChange: (metadata: Record<string, unknown>) => void
}

/**
 * Cross-entity reference fields (currentLocationEntityId, leaderEntityId,
 * etc.) aren't exposed here — a proper entity-reference picker belongs with
 * Milestone 4's relationship UI. The backend already stores these fields if
 * set via the API directly; this form just doesn't offer a picker for them yet.
 */
export function EntityMetadataFields({ entityType, value, onChange }: EntityMetadataFieldsProps) {
  const str = (key: string): string =>
    typeof value[key] === 'string' ? (value[key] as string) : ''

  const set = (key: string) => (val: string) =>
    onChange({ ...value, [key]: val === '' ? undefined : val })

  switch (entityType) {
    case 'character':
      return (
        <>
          <TextField
            id="metadata-pronouns"
            label="Pronouns"
            value={str('pronouns')}
            onChange={(e) => set('pronouns')(e.target.value)}
          />
          <TextField
            id="metadata-species"
            label="Species"
            value={str('species')}
            onChange={(e) => set('species')(e.target.value)}
          />
          <TextField
            id="metadata-occupation"
            label="Occupation"
            value={str('occupation')}
            onChange={(e) => set('occupation')(e.target.value)}
          />
          <Select
            id="metadata-lifeStatus"
            label="Life status"
            options={[
              { value: '', label: 'Unspecified' },
              { value: 'alive', label: 'Alive' },
              { value: 'deceased', label: 'Deceased' },
              { value: 'unknown', label: 'Unknown' },
              { value: 'undead', label: 'Undead' },
            ]}
            value={str('lifeStatus')}
            onChange={(e) => set('lifeStatus')(e.target.value)}
          />
        </>
      )
    case 'location':
      return (
        <>
          <TextField
            id="metadata-locationType"
            label="Location type"
            value={str('locationType')}
            onChange={(e) => set('locationType')(e.target.value)}
          />
          <TextField
            id="metadata-population"
            label="Population"
            type="number"
            value={str('population')}
            onChange={(e) => set('population')(e.target.value)}
          />
          <TextField
            id="metadata-government"
            label="Government"
            value={str('government')}
            onChange={(e) => set('government')(e.target.value)}
          />
        </>
      )
    case 'faction':
      return (
        <TextField
          id="metadata-factionType"
          label="Faction type"
          value={str('factionType')}
          onChange={(e) => set('factionType')(e.target.value)}
        />
      )
    case 'organization':
      return (
        <TextField
          id="metadata-organizationType"
          label="Organization type"
          value={str('organizationType')}
          onChange={(e) => set('organizationType')(e.target.value)}
        />
      )
    case 'item':
      return (
        <>
          <TextField
            id="metadata-itemType"
            label="Item type"
            value={str('itemType')}
            onChange={(e) => set('itemType')(e.target.value)}
          />
          <TextField
            id="metadata-rarity"
            label="Rarity"
            value={str('rarity')}
            onChange={(e) => set('rarity')(e.target.value)}
          />
        </>
      )
    case 'deity':
      return (
        <>
          <TextField
            id="metadata-alignment"
            label="Alignment"
            value={str('alignment')}
            onChange={(e) => set('alignment')(e.target.value)}
          />
          <TextField
            id="metadata-symbol"
            label="Symbol"
            value={str('symbol')}
            onChange={(e) => set('symbol')(e.target.value)}
          />
        </>
      )
    case 'creature':
      return (
        <>
          <TextField
            id="metadata-creatureType"
            label="Creature type"
            value={str('creatureType')}
            onChange={(e) => set('creatureType')(e.target.value)}
          />
          <TextField
            id="metadata-habitat"
            label="Habitat"
            value={str('habitat')}
            onChange={(e) => set('habitat')(e.target.value)}
          />
          <TextField
            id="metadata-threatLevel"
            label="Threat level"
            value={str('threatLevel')}
            onChange={(e) => set('threatLevel')(e.target.value)}
          />
        </>
      )
    case 'event':
      return (
        <TextField
          id="metadata-eventType"
          label="Event type"
          value={str('eventType')}
          onChange={(e) => set('eventType')(e.target.value)}
        />
      )
    case 'quest':
      return (
        <>
          <TextField
            id="metadata-questType"
            label="Quest type"
            value={str('questType')}
            onChange={(e) => set('questType')(e.target.value)}
          />
          <Select
            id="metadata-questStatus"
            label="Quest status"
            options={[
              { value: '', label: 'Unspecified' },
              { value: 'active', label: 'Active' },
              { value: 'completed', label: 'Completed' },
              { value: 'failed', label: 'Failed' },
            ]}
            value={str('questStatus')}
            onChange={(e) => set('questStatus')(e.target.value)}
          />
        </>
      )
    case 'lore':
      return (
        <TextField
          id="metadata-loreCategory"
          label="Lore category"
          value={str('loreCategory')}
          onChange={(e) => set('loreCategory')(e.target.value)}
        />
      )
    case 'custom':
      return <p className="wb-field__hint">Custom entities have no fixed fields.</p>
    default:
      return null
  }
}
