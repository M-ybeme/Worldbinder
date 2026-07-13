// Raw TipTap JSON never gets diffed directly — the backend already adds a
// `<field>PlainText` sibling for every content field (RevisionsService.list
// ()), so the diff only ever compares plain strings. No word-level diff
// library is used (none exists in this repo) — this is a simple changed-
// field list with before/after values, matching the roadmap's "field-level
// diff" requirement without the extra dependency.
const HIDDEN_FIELDS = new Set([
  'publicContentJson',
  'gmContentJson',
  'recapContentJson',
  'plannedContentJson',
])

export interface FieldDiff {
  field: string
  label: string
  oldValue: unknown
  newValue: unknown
}

export function fieldLabel(field: string): string {
  const base = field.replace(/PlainText$/, '')
  const spaced = base.replace(/([A-Z])/g, ' $1').replace(/Json$/i, '')
  return (spaced.charAt(0).toUpperCase() + spaced.slice(1)).trim()
}

export function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.length === 0 ? '—' : value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** Compares two snapshots field by field. `older` is `null` for the
 * earliest revision (nothing to diff against — every field shows as "new"). */
export function computeFieldDiff(
  older: Record<string, unknown> | null,
  newer: Record<string, unknown>,
): FieldDiff[] {
  const keys = new Set([...(older ? Object.keys(older) : []), ...Object.keys(newer)])
  const diffs: FieldDiff[] = []

  for (const field of keys) {
    if (HIDDEN_FIELDS.has(field)) continue
    const oldValue = older ? older[field] : undefined
    const newValue = newer[field]
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue
    diffs.push({ field, label: fieldLabel(field), oldValue, newValue })
  }

  return diffs
}
