import type { EntityType, MapPinSummary } from '@worldbinder/contracts'

/** What a pin is called: its own label, else its linked entry's name. */
export function pinLabel(pin: MapPinSummary): string {
  return pin.label ?? pin.locationEntityName ?? 'Unlabeled pin'
}

/** The pin's kind for filtering: its entry's type, or `none` (no entry). */
export type PinKind = EntityType | 'none'

export function pinKind(pin: MapPinSummary): PinKind {
  return pin.locationEntityType ?? 'none'
}

export interface PinFilter {
  query: string
  /** Empty = every kind. */
  kinds: Set<PinKind>
  visibility: 'all' | 'public' | 'gm_only'
}

export const NO_FILTER: PinFilter = { query: '', kinds: new Set(), visibility: 'all' }

export function isFiltering(filter: PinFilter): boolean {
  return filter.query.trim() !== '' || filter.kinds.size > 0 || filter.visibility !== 'all'
}

/** Name (label or entry), entry summary and layer name all count for the
 * search; kinds and visibility narrow further. */
export function matchesFilter(pin: MapPinSummary, filter: PinFilter, layerName?: string): boolean {
  if (filter.kinds.size > 0 && !filter.kinds.has(pinKind(pin))) return false
  if (filter.visibility !== 'all' && pin.visibility !== filter.visibility) return false
  const query = filter.query.trim().toLowerCase()
  if (!query) return true
  return [pinLabel(pin), pin.locationEntityName ?? '', pin.locationEntitySummary ?? '', layerName ?? '']
    .join(' ')
    .toLowerCase()
    .includes(query)
}

export interface ScreenPin {
  pin: MapPinSummary
  /** On-screen position within the (scaled) map, in px. */
  x: number
  y: number
}

export interface PinGroup {
  /** Stable key: the ids of its pins. */
  key: string
  pins: MapPinSummary[]
  /** Average normalized (0–1) position, where the group's marker goes. */
  xNormalized: number
  yNormalized: number
}

/** Groups pins whose markers would overlap on screen (within `radius` px
 * of a group's first pin), so a cluster can be offered as a choice instead
 * of whichever pin happens to be on top. Pins in `keepSingle` (the
 * selected one) are never grouped. Deterministic: input order decides. */
export function groupOverlapping(points: ScreenPin[], radius: number, keepSingle?: string | null): PinGroup[] {
  const groups: { anchor: ScreenPin; members: ScreenPin[] }[] = []
  for (const point of points) {
    if (point.pin.id === keepSingle) {
      groups.push({ anchor: point, members: [point] })
      continue
    }
    const near = groups.find(
      (group) =>
        group.anchor.pin.id !== keepSingle &&
        Math.hypot(group.anchor.x - point.x, group.anchor.y - point.y) <= radius,
    )
    if (near) near.members.push(point)
    else groups.push({ anchor: point, members: [point] })
  }
  return groups.map(({ members }) => ({
    key: members.map((member) => member.pin.id).join('+'),
    pins: members.map((member) => member.pin),
    xNormalized: members.reduce((sum, member) => sum + member.pin.xNormalized, 0) / members.length,
    yNormalized: members.reduce((sum, member) => sum + member.pin.yNormalized, 0) / members.length,
  }))
}

type Box = { left: number; right: number; top: number; bottom: number }

const overlaps = (a: Box, b: Box) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

// Half the size of a marker's dot (or a group's badge), in px.
const MARKER_HALF = 14

/** Which single pins get their name drawn beside them: the selected pin
 * first, then pins linked to entries, then the rest — each only if its
 * label (estimated from its length) would cover neither a label already
 * placed nor another marker (`markers`: every marker on the map, single
 * pins and groups, at their on-screen positions). */
export function pinsWithRoomForLabels(
  points: ScreenPin[],
  selectedId?: string | null,
  markers: { x: number; y: number }[] = points,
): Set<string> {
  const priority = (point: ScreenPin) =>
    point.pin.id === selectedId ? 0 : point.pin.locationEntityId ? 1 : 2
  const ordered = [...points].sort((a, b) => priority(a) - priority(b))
  const markerBoxes = markers.map((marker) => ({
    x: marker.x,
    y: marker.y,
    box: {
      left: marker.x - MARKER_HALF,
      right: marker.x + MARKER_HALF,
      top: marker.y - MARKER_HALF,
      bottom: marker.y + MARKER_HALF,
    },
  }))
  const placed: Box[] = []
  const labelled = new Set<string>()
  for (const point of ordered) {
    const width = 26 + pinLabel(point.pin).length * 7
    const box = { left: point.x - 11, right: point.x - 11 + width, top: point.y - 12, bottom: point.y + 12 }
    // The text starts right of the pin's own dot: only that part counts.
    const text = { ...box, left: point.x + MARKER_HALF }
    const collides =
      placed.some((other) => overlaps(box, other)) ||
      markerBoxes.some((marker) => !(marker.x === point.x && marker.y === point.y) && overlaps(text, marker.box))
    if (collides && point.pin.id !== selectedId) continue
    placed.push(box)
    labelled.add(point.pin.id)
  }
  return labelled
}
