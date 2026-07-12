/**
 * Minimal versioned in-world date shape — see
 * packages/validation/src/calendar.ts for the authoritative schema comment.
 * Gregorian-shaped placeholder pending Milestone 11's real calendar system.
 */
export interface WorldDate {
  schemaVersion: 1
  year: number
  month: number
  day: number
  label?: string
}
