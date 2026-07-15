/**
 * A minimal, versioned in-world date shape — see
 * packages/validation/src/calendar.ts for the authoritative schema and
 * validation functions. Always full-precision (year+month+day); bounds are
 * checked against the owning campaign's `CalendarConfig` at write time.
 */
export interface WorldDate {
  schemaVersion: 1
  year: number
  month: number
  day: number
  label?: string
}

export interface CalendarMonth {
  name: string
  days: number
}

/** A campaign's custom calendar (`campaigns.calendarConfigJson`) — an
 * ordered list of named months with fixed day counts. `null` on the
 * campaign means `DEFAULT_CALENDAR_CONFIG` (packages/validation) applies. */
export interface CalendarConfig {
  schemaVersion: 1
  months: CalendarMonth[]
  eraLabel?: string
}

export type TimelineDatePrecision = 'year' | 'month' | 'day'

/** A timeline event's date — precision-variable, unlike `WorldDate`. Fields
 * beyond the event's stored `datePrecision` are absent, not null. */
export interface TimelineDate {
  schemaVersion: 1
  year: number
  month?: number
  day?: number
  approximate?: boolean
  label?: string
}
