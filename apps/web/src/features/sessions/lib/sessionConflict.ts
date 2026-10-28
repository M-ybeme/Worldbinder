import type { CampaignSessionDetail, TiptapDoc, WorldDate } from '@worldbinder/contracts'
import type { PlotThreadChangeInput } from '@worldbinder/validation'
import { differenceCollector, type FieldDifference } from '../../editing/compare'

/** The session editor's current (local) values, as it would save them. */
export interface LocalSessionVersion {
  title: string
  visibility: string
  /** ISO timestamp or null. */
  scheduledAt: string | null
  worldStartDate: WorldDate | null
  recapContent: TiptapDoc | null
  participantIds: string[]
  featuredEntityIds: string[]
  locationEntityIds: string[]
  plotThreadChanges: PlotThreadChangeInput[]
  tags: string[]
  /** Present only for members who edit GM content (owner/GM). */
  plannedContent?: TiptapDoc | null
  gmContent?: TiptapDoc | null
}

const VISIBILITY_LABELS: Record<string, string> = { public: 'Public', gm_only: 'GM only' }

function when(iso: unknown): string {
  if (typeof iso !== 'string' || !iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function worldDate(value: unknown): string {
  const date = value as WorldDate | null
  if (!date) return '—'
  return date.label ?? `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
}

/**
 * What differs between the local session edit and the server's newer
 * version. Names for participants and plot threads come from data the
 * editor already has (the member list, the thread list and the server's
 * own detail); entities resolve through the visibility-checked endpoint.
 * GM-only fields are compared only when both sides include them.
 */
export function sessionDifferences(
  local: LocalSessionVersion,
  server: CampaignSessionDetail,
  names: { members: Map<string, string>; threads: Map<string, string> },
): FieldDifference[] {
  const diff = differenceCollector()
  diff.value('Title', local.title, server.title)
  diff.value('Visibility', local.visibility, server.visibility, (v) => VISIBILITY_LABELS[String(v)] ?? String(v))
  diff.value('Scheduled at', local.scheduledAt, server.scheduledAt, when)
  // Compared as displayed: the editor's and the server's date objects can
  // differ in shape (e.g. extra keys) while meaning the same day.
  diff.value('In-world start date', worldDate(local.worldStartDate), worldDate(server.worldStartDateJson))

  const memberName = (id: string) => names.members.get(id) ?? 'A member'
  const serverMembers = new Map(server.participants.map((p) => [p.campaignMemberId, p.displayName]))
  diff.value(
    'Participants',
    [...local.participantIds].sort().map(memberName),
    server.participants.map((p) => p.campaignMemberId).sort().map((id) => serverMembers.get(id) ?? memberName(id)),
  )
  diff.entities('Featured entities', local.featuredEntityIds, server.featuredEntities.map((e) => e.id))
  diff.entities('Locations', local.locationEntityIds, server.locations.map((e) => e.id))

  const threadTitle = (id: string) =>
    names.threads.get(id) ??
    server.plotThreadChanges.find((c) => c.plotThread.id === id)?.plotThread.title ??
    'A plot thread'
  const describeChanges = (changes: PlotThreadChangeInput[]) =>
    changes.map((c) => `${threadTitle(c.plotThreadId)} (${c.action})`).sort()
  diff.value(
    'Plot threads',
    describeChanges(local.plotThreadChanges),
    describeChanges(server.plotThreadChanges.map((c) => ({ plotThreadId: c.plotThread.id, action: c.action }))),
  )
  diff.value('Tags', local.tags, server.tags)

  diff.content('Recap', local.recapContent, server.recapContentJson)
  if ('plannedContent' in local && 'plannedContentJson' in server) {
    diff.content('Planned content (GM only)', local.plannedContent, server.plannedContentJson)
  }
  if ('gmContent' in local && 'gmContentJson' in server) {
    diff.content('GM-only notes', local.gmContent, server.gmContentJson)
  }
  return diff.differences
}
