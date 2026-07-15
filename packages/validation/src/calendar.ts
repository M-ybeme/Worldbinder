import { z } from 'zod'

/**
 * A minimal, versioned in-world date shape — good enough to store, order,
 * and display a session's or campaign's current in-world date for v1.
 * Always full-precision (year+month+day); month/day bounds are checked at
 * write time against the owning campaign's calendar config (see
 * `isValidWorldDate` below), falling back to `DEFAULT_CALENDAR_CONFIG` when
 * none has been configured yet.
 */
export const worldDateSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  year: z.number().int(),
  month: z.number().int().min(1),
  day: z.number().int().min(1),
  label: z.string().trim().max(200).optional(),
})
export type WorldDate = z.infer<typeof worldDateSchema>

/** A campaign's custom calendar — an ordered list of named months, each
 * with a fixed day count. No leap-year/era-cycle rules in v1 (documented
 * scope note, Milestone 11 "Timeline and Calendar") — a flat repeating
 * month list, not a repeating leap adjustment. */
export const calendarMonthSchema = z.object({
  name: z.string().trim().min(1).max(100),
  days: z.number().int().min(1).max(1000),
})
export type CalendarMonth = z.infer<typeof calendarMonthSchema>

export const calendarConfigSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  months: z.array(calendarMonthSchema).min(1).max(50),
  eraLabel: z.string().trim().max(50).optional(),
})
export type CalendarConfig = z.infer<typeof calendarConfigSchema>

/** Fallback calendar for campaigns that haven't configured one — standard
 * (non-leap) Gregorian month lengths, so existing Gregorian-shaped dates
 * stay valid by default rather than breaking when this milestone's real
 * validation lands. */
export const DEFAULT_CALENDAR_CONFIG: CalendarConfig = {
  schemaVersion: 1,
  months: [
    { name: 'January', days: 31 },
    { name: 'February', days: 28 },
    { name: 'March', days: 31 },
    { name: 'April', days: 30 },
    { name: 'May', days: 31 },
    { name: 'June', days: 30 },
    { name: 'July', days: 31 },
    { name: 'August', days: 31 },
    { name: 'September', days: 30 },
    { name: 'October', days: 31 },
    { name: 'November', days: 30 },
    { name: 'December', days: 31 },
  ],
}

export const timelineDatePrecisionSchema = z.enum(['year', 'month', 'day'])
export type TimelineDatePrecision = z.infer<typeof timelineDatePrecisionSchema>

/** A timeline event's date — unlike `WorldDate`, precision is variable:
 * year-only, year+month, or a full year+month+day. Fields beyond the
 * event's stored `datePrecision` are simply absent, not null. `approximate`
 * marks a GM's "circa" date without adding a separate precision tier. */
export const timelineDateSchema = z
  .object({
    schemaVersion: z.literal(1).default(1),
    year: z.number().int(),
    month: z.number().int().min(1).optional(),
    day: z.number().int().min(1).optional(),
    approximate: z.boolean().optional(),
    label: z.string().trim().max(200).optional(),
  })
  .refine((date) => date.day === undefined || date.month !== undefined, {
    message: 'A day cannot be set without a month',
    path: ['day'],
  })
export type TimelineDate = z.infer<typeof timelineDateSchema>

function monthStartOffsets(config: CalendarConfig): number[] {
  const offsets: number[] = []
  let total = 0
  for (const month of config.months) {
    offsets.push(total)
    total += month.days
  }
  return offsets
}

/** Checks a (possibly partial) date's month/day against a calendar config's
 * month count and per-month day count. `precision` dictates which fields
 * are expected: `'year'` → neither, `'month'` → month only, `'day'` →
 * both. Year itself is never bounded — campaigns can date things
 * arbitrarily far into their own history or future. The single source of
 * truth behind the "dates validate consistently" exit criterion, shared by
 * both API validation and frontend date-picker bounds. */
export function isValidTimelineDate(
  date: Pick<TimelineDate, 'month' | 'day'>,
  precision: TimelineDatePrecision,
  config: CalendarConfig,
): boolean {
  if (precision === 'year') {
    return date.month === undefined && date.day === undefined
  }
  if (date.month === undefined) return false
  const month = config.months[date.month - 1]
  if (!month) return false
  if (precision === 'month') return date.day === undefined
  if (date.day === undefined) return false
  return date.day >= 1 && date.day <= month.days
}

/** A full year+month+day `WorldDate` is equivalent to a `'day'`-precision
 * `TimelineDate` for validation purposes. */
export function isValidWorldDate(
  date: Pick<WorldDate, 'month' | 'day'>,
  config: CalendarConfig,
): boolean {
  return isValidTimelineDate(date, 'day', config)
}

/** Ordinal day count from an arbitrary epoch — the shared comparison basis
 * for sorting timeline events and validating dates consistently. Missing
 * month/day (lower precision) resolve to the start of that unit, so a
 * year-only date sorts before any dated event later that same year. */
export function timelineDateToOrdinal(
  date: Pick<TimelineDate, 'year' | 'month' | 'day'>,
  config: CalendarConfig,
): number {
  const daysPerYear = config.months.reduce((sum, month) => sum + month.days, 0)
  const offsets = monthStartOffsets(config)
  const monthIndex = (date.month ?? 1) - 1
  const dayOffset = offsets[monthIndex] ?? 0
  const day = (date.day ?? 1) - 1
  return date.year * daysPerYear + dayOffset + day
}

export function compareTimelineDates(
  a: Pick<TimelineDate, 'year' | 'month' | 'day'>,
  b: Pick<TimelineDate, 'year' | 'month' | 'day'>,
  config: CalendarConfig,
): number {
  return timelineDateToOrdinal(a, config) - timelineDateToOrdinal(b, config)
}
