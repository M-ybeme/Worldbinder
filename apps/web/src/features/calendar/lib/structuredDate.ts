import type { TimelineDate, TimelineDatePrecision, WorldDate } from '@worldbinder/contracts'

/** Draft/form-string shape backing StructuredDateEditor — one component
 * serves both a timeline event's variable-precision TimelineDate and a
 * session/campaign's always-full-precision WorldDate. `precision: null`
 * means undated (only meaningful where `allowUndated` is set). */
export interface StructuredDateValue {
  precision: TimelineDatePrecision | null
  year: string
  month: string
  day: string
  approximate: boolean
  label: string
}

export const EMPTY_STRUCTURED_DATE: StructuredDateValue = {
  precision: null,
  year: '',
  month: '',
  day: '',
  approximate: false,
  label: '',
}

export function worldDateToStructured(date: WorldDate | null | undefined): StructuredDateValue {
  if (!date) return EMPTY_STRUCTURED_DATE
  return {
    precision: 'day',
    year: String(date.year),
    month: String(date.month),
    day: String(date.day),
    approximate: false,
    label: date.label ?? '',
  }
}

export function structuredToWorldDate(value: StructuredDateValue): WorldDate | undefined {
  if (!value.year || !value.month || !value.day) return undefined
  return {
    schemaVersion: 1,
    year: Number(value.year),
    month: Number(value.month),
    day: Number(value.day),
    label: value.label.trim() || undefined,
  }
}

export function timelineDateToStructured(
  date: TimelineDate | null | undefined,
  precision: TimelineDatePrecision | null | undefined,
): StructuredDateValue {
  if (!date || !precision) return EMPTY_STRUCTURED_DATE
  return {
    precision,
    year: String(date.year),
    month: date.month !== undefined ? String(date.month) : '',
    day: date.day !== undefined ? String(date.day) : '',
    approximate: date.approximate ?? false,
    label: date.label ?? '',
  }
}

export interface StructuredTimelineDate {
  date: TimelineDate | null
  precision: TimelineDatePrecision | null
}

export function structuredToTimelineDate(value: StructuredDateValue): StructuredTimelineDate {
  if (!value.precision || !value.year) return { date: null, precision: null }

  const date: TimelineDate = {
    schemaVersion: 1,
    year: Number(value.year),
    approximate: value.approximate || undefined,
    label: value.label.trim() || undefined,
  }
  if (value.precision === 'month' || value.precision === 'day') {
    if (!value.month) return { date: null, precision: null }
    date.month = Number(value.month)
  }
  if (value.precision === 'day') {
    if (!value.day) return { date: null, precision: null }
    date.day = Number(value.day)
  }
  return { date, precision: value.precision }
}
