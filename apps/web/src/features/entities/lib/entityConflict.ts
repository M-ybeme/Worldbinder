import type { EntityDetail, EntityType, TiptapDoc } from '@worldbinder/contracts'
import { diffBlocks, docToBlocks, type BlockChange } from '../../../lib/blockDiff'
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

export type FieldDifference =
  | { kind: 'value'; label: string; mine: string; theirs: string }
  | { kind: 'reference'; label: string; mine: string | null; theirs: string | null }
  | { kind: 'content'; label: string; changes: BlockChange[] }

const VISIBILITY_LABELS: Record<string, string> = {
  public: 'Public',
  gm_only: 'GM only',
}

function show(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function same(a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => (v === undefined || v === null || v === '' ? null : v)
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b))
}

/**
 * What differs between the local edit and the server's newer version —
 * everything the member would overwrite by keeping theirs. Only fields the
 * member can edit take part: GM-only content is compared only when both
 * sides include it (the server omits it for members without GM access, so
 * nothing hidden is ever shown). References to other entities come back
 * as IDs here; the dialog resolves them through the visibility-checked
 * entity endpoint.
 */
export function entityDifferences(local: LocalEntityVersion, server: EntityDetail): FieldDifference[] {
  const differences: FieldDifference[] = []
  const value = (label: string, mine: unknown, theirs: unknown) => {
    if (!same(mine, theirs)) differences.push({ kind: 'value', label, mine: show(mine), theirs: show(theirs) })
  }

  value('Name', local.name, server.name)
  value('Summary', local.summary, server.summary ?? '')
  value('Aliases', local.aliases, server.aliases)
  value('Tags', local.tags, server.tags)
  value('Visibility', VISIBILITY_LABELS[local.visibility] ?? local.visibility, VISIBILITY_LABELS[server.visibility] ?? server.visibility)
  value('Status', local.status, server.status)

  const serverMeta = (server.metadataJson ?? {}) as Record<string, unknown>
  const refs = new Set(referenceKeys(local.entityType))
  const keys = new Set([...Object.keys(local.metadata), ...Object.keys(serverMeta)])
  keys.delete('schemaVersion')
  for (const key of keys) {
    const mine = local.metadata[key]
    const theirs = serverMeta[key]
    if (same(mine, theirs)) continue
    const label = metadataFieldLabel(local.entityType, key)
    if (refs.has(key)) {
      differences.push({
        kind: 'reference',
        label,
        mine: typeof mine === 'string' && mine ? mine : null,
        theirs: typeof theirs === 'string' && theirs ? theirs : null,
      })
    } else {
      value(label, mine, theirs)
    }
  }

  const content = (label: string, mine: TiptapDoc | null | undefined, theirs: TiptapDoc | null | undefined) => {
    const changes = diffBlocks(docToBlocks(mine), docToBlocks(theirs))
    if (changes.some((change) => change.kind !== 'same')) differences.push({ kind: 'content', label, changes })
  }
  content('Public content', local.publicContent, server.publicContentJson)
  if ('gmContent' in local && 'gmContentJson' in server) {
    content('GM-only content', local.gmContent, server.gmContentJson)
  }
  return differences
}
