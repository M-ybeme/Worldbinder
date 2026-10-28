import type { EntityDetail, EntityType, TiptapDoc } from '@worldbinder/contracts'
import { differenceCollector, type FieldDifference } from '../../editing/compare'
import { metadataFieldLabel, referenceKeys } from './entityFacts'

/** The editor's current (local) values, in the shape it saves. */
export interface LocalEntityVersion {
  entityType: EntityType
  name: string
  summary: string
  aliases: string[]
  tags: string[]
  visibility: string
  status: string
  metadata: Record<string, unknown>
  publicContent: TiptapDoc | null
  /** Present only when this member edits GM content. */
  gmContent?: TiptapDoc | null
}

const VISIBILITY_LABELS: Record<string, string> = {
  public: 'Public',
  gm_only: 'GM only',
}

/**
 * What differs between the local edit and the server's newer version —
 * everything the member would overwrite by keeping theirs. GM-only content
 * is compared only when both sides include it (the server omits it for
 * members without GM access, so nothing hidden is ever shown).
 */
export function entityDifferences(local: LocalEntityVersion, server: EntityDetail): FieldDifference[] {
  const diff = differenceCollector()
  diff.value('Name', local.name, server.name)
  diff.value('Summary', local.summary, server.summary ?? '')
  diff.value('Aliases', local.aliases, server.aliases)
  diff.value('Tags', local.tags, server.tags)
  diff.value('Visibility', local.visibility, server.visibility, (v) => VISIBILITY_LABELS[String(v)] ?? String(v))
  diff.value('Status', local.status, server.status)

  const serverMeta = (server.metadataJson ?? {}) as Record<string, unknown>
  const refs = new Set(referenceKeys(local.entityType))
  const keys = new Set([...Object.keys(local.metadata), ...Object.keys(serverMeta)])
  keys.delete('schemaVersion')
  for (const key of keys) {
    const label = metadataFieldLabel(local.entityType, key)
    const mine = local.metadata[key]
    const theirs = serverMeta[key]
    if (refs.has(key)) {
      diff.entities(label, typeof mine === 'string' ? mine : null, typeof theirs === 'string' ? theirs : null)
    } else {
      diff.value(label, mine, theirs)
    }
  }

  diff.content('Public content', local.publicContent, server.publicContentJson)
  if ('gmContent' in local && 'gmContentJson' in server) {
    diff.content('GM-only content', local.gmContent, server.gmContentJson)
  }
  return diff.differences
}
