import type { CalendarConfig } from '@worldbinder/contracts'
import { Button, TextField } from '@worldbinder/ui'

export interface CalendarMonthsEditorProps {
  value: CalendarConfig
  onChange: (value: CalendarConfig) => void
}

/**
 * Add/remove/reorder editor for a campaign's custom calendar months — no
 * generic list-editor primitive exists in packages/ui yet, so this is
 * built feature-local rather than as a new generic primitive, matching
 * packages/ui's "built up only as real screens need them" philosophy.
 */
export function CalendarMonthsEditor({ value, onChange }: CalendarMonthsEditorProps) {
  const updateMonth = (index: number, patch: Partial<CalendarConfig['months'][number]>) => {
    onChange({
      ...value,
      months: value.months.map((month, i) => (i === index ? { ...month, ...patch } : month)),
    })
  }

  const addMonth = () => {
    onChange({ ...value, months: [...value.months, { name: '', days: 30 }] })
  }

  const removeMonth = (index: number) => {
    onChange({ ...value, months: value.months.filter((_, i) => i !== index) })
  }

  const moveMonth = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= value.months.length) return
    const months = [...value.months]
    const [moved] = months.splice(index, 1)
    if (!moved) return
    months.splice(target, 0, moved)
    onChange({ ...value, months })
  }

  return (
    <div className="wb-field">
      <span className="wb-field__label">Months</span>
      {value.months.map((month, index) => (
        <div
          key={index}
          style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginBottom: '0.5rem' }}
        >
          <TextField
            id={`month-name-${index}`}
            label="Name"
            value={month.name}
            onChange={(e) => updateMonth(index, { name: e.target.value })}
          />
          <TextField
            id={`month-days-${index}`}
            label="Days"
            type="number"
            min={1}
            value={String(month.days)}
            onChange={(e) => updateMonth(index, { days: Number(e.target.value) || 1 })}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => moveMonth(index, -1)}
            disabled={index === 0}
            aria-label={`Move ${month.name || 'month'} earlier`}
          >
            ↑
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => moveMonth(index, 1)}
            disabled={index === value.months.length - 1}
            aria-label={`Move ${month.name || 'month'} later`}
          >
            ↓
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => removeMonth(index)}
            disabled={value.months.length <= 1}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={addMonth}>
        Add month
      </Button>

      <TextField
        label="Era label (optional)"
        value={value.eraLabel ?? ''}
        onChange={(e) => onChange({ ...value, eraLabel: e.target.value || undefined })}
      />
    </div>
  )
}
