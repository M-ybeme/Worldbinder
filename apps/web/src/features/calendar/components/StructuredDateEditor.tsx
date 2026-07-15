import type { CalendarConfig, TimelineDatePrecision } from '@worldbinder/contracts'
import { Select, TextField } from '@worldbinder/ui'
import { useId } from 'react'
import type { StructuredDateValue } from '../lib/structuredDate'

const PRECISION_OPTIONS_DATED = [
  { value: 'year', label: 'Year only' },
  { value: 'month', label: 'Year and month' },
  { value: 'day', label: 'Exact day' },
]

export interface StructuredDateEditorProps {
  legend: string
  calendarConfig: CalendarConfig
  value: StructuredDateValue
  onChange: (value: StructuredDateValue) => void
  /** Sessions/campaigns always carry a full day-precision date — only
   * timeline events can be undated. */
  allowUndated?: boolean
  /** Timeline events support a "circa" flag; WorldDate has no such field. */
  allowApproximate?: boolean
  /** Session/campaign world dates are always day-precision with no choice
   * of granularity — set this to pin the precision and hide the selector,
   * rather than offering a year/month/day dropdown that doesn't apply. */
  fixedPrecision?: TimelineDatePrecision
}

/**
 * A calendar-aware structured date editor — month names and each month's
 * day bound come from the campaign's own `CalendarConfig` (or
 * DEFAULT_CALENDAR_CONFIG), not a hardcoded Gregorian assumption. Used for
 * both timeline events (variable precision + undated + approximate) and
 * session/campaign world dates (always exact-day, via `allowUndated={false}
 * allowApproximate={false}`).
 */
export function StructuredDateEditor({
  legend,
  calendarConfig,
  value,
  onChange,
  allowUndated = true,
  allowApproximate = true,
  fixedPrecision,
}: StructuredDateEditorProps) {
  const idPrefix = useId()
  const precisionOptions = allowUndated
    ? [{ value: 'undated', label: 'No date' }, ...PRECISION_OPTIONS_DATED]
    : PRECISION_OPTIONS_DATED

  const effectivePrecision = fixedPrecision ?? value.precision

  const selectedMonthIndex = value.month ? Number(value.month) - 1 : -1
  const selectedMonth = calendarConfig.months[selectedMonthIndex]
  const maxDay = selectedMonth?.days ?? 31

  const showMonth = effectivePrecision === 'month' || effectivePrecision === 'day'
  const showDay = effectivePrecision === 'day'

  return (
    <fieldset className="wb-field">
      <legend className="wb-field__label">{legend}</legend>

      {!fixedPrecision && (
        <Select
          id={`${idPrefix}-precision`}
          label={allowUndated ? 'Date precision' : undefined}
          options={precisionOptions}
          value={value.precision ?? 'undated'}
          onChange={(e) => {
            const next = e.target.value
            onChange({
              ...value,
              precision: next === 'undated' ? null : (next as TimelineDatePrecision),
            })
          }}
        />
      )}

      {effectivePrecision && (
        <>
          <TextField
            id={`${idPrefix}-year`}
            label="Year"
            type="number"
            value={value.year}
            onChange={(e) => onChange({ ...value, year: e.target.value, precision: effectivePrecision })}
          />

          {showMonth && (
            <Select
              id={`${idPrefix}-month`}
              label="Month"
              options={calendarConfig.months.map((month, index) => ({
                value: String(index + 1),
                label: month.name,
              }))}
              value={value.month}
              onChange={(e) =>
                onChange({
                  ...value,
                  month: e.target.value,
                  // Reset day when the month changes so a stale day beyond
                  // the new month's bound can't silently survive.
                  day: '',
                })
              }
            />
          )}

          {showDay && (
            <TextField
              id={`${idPrefix}-day`}
              label="Day"
              type="number"
              min={1}
              max={maxDay}
              value={value.day}
              onChange={(e) => onChange({ ...value, day: e.target.value })}
            />
          )}

          {allowApproximate && (
            <label style={{ display: 'block' }}>
              <input
                type="checkbox"
                checked={value.approximate}
                onChange={(e) => onChange({ ...value, approximate: e.target.checked })}
              />{' '}
              Approximate (circa)
            </label>
          )}

          <TextField
            id={`${idPrefix}-label`}
            label="Label (optional)"
            value={value.label}
            onChange={(e) => onChange({ ...value, label: e.target.value })}
          />
        </>
      )}
    </fieldset>
  )
}
