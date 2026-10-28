import type { PlotThreadDetail, TiptapDoc } from '@worldbinder/contracts'
import { differenceCollector, type FieldDifference } from '../../editing/compare'

/** The plot-thread editor's current (local) values, as it would save them. */
export interface LocalThreadVersion {
  title: string
  summary: string
  visibility: string
  importance: string
  publicContent: TiptapDoc | null
  entityIds: string[]
  tags: string[]
  /** Present only for members who edit GM content (owner/GM). */
  gmContent?: TiptapDoc | null
}

const VISIBILITY_LABELS: Record<string, string> = { public: 'Public', gm_only: 'GM only' }
const capitalize = (v: unknown) => (typeof v === 'string' && v ? v[0]!.toUpperCase() + v.slice(1) : '—')

/**
 * What differs between the local plot-thread edit and the server's newer
 * version. Importance and GM content are GM-level data the API omits for
 * other members, so they're compared only when the server sent them.
 */
export function threadDifferences(local: LocalThreadVersion, server: PlotThreadDetail): FieldDifference[] {
  const diff = differenceCollector()
  diff.value('Title', local.title, server.title)
  diff.value('Summary', local.summary, server.summary ?? '')
  diff.value('Visibility', local.visibility, server.visibility, (v) => VISIBILITY_LABELS[String(v)] ?? String(v))
  if (server.importance !== undefined) diff.value('Importance', local.importance, server.importance, capitalize)
  diff.entities('Related entities', local.entityIds, server.entities.map((e) => e.id))
  diff.value('Tags', local.tags, server.tags)
  diff.content('Public content', local.publicContent, server.publicContentJson)
  if ('gmContent' in local && 'gmContentJson' in server) {
    diff.content('GM-only content', local.gmContent, server.gmContentJson)
  }
  return diff.differences
}
