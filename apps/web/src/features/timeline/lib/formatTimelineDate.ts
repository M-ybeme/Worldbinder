import type { CalendarConfig, TimelineDate, TimelineDatePrecision } from '@worldbinder/contracts'

/** Renders a timeline event's date using the campaign's own calendar month
 * names, at whatever granularity the event's precision actually stores. */
export function formatTimelineDate(
  date: TimelineDate | null,
  precision: TimelineDatePrecision | null,
  calendarConfig: CalendarConfig,
): string {
  if (!date || !precision) return 'Undated'
  const approx = date.approximate ? 'c. ' : ''
  const era = calendarConfig.eraLabel ? ` ${calendarConfig.eraLabel}` : ''

  if (precision === 'year') return `${approx}${date.year}${era}`

  const monthName = calendarConfig.months[(date.month ?? 1) - 1]?.name ?? `Month ${date.month}`
  if (precision === 'month') return `${approx}${monthName} ${date.year}${era}`

  return `${approx}${monthName} ${date.day}, ${date.year}${era}`
}
