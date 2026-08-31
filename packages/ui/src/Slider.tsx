import { forwardRef, type InputHTMLAttributes } from 'react'
import './Field.css'
import './Slider.css'

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  /** Formatted current value shown beside the label (e.g. "40%") — the
   * plain numeric `value` prop alone isn't user-facing. */
  valueLabel?: string
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
  { label, valueLabel, id, name, className, ...props },
  ref,
) {
  const fieldId = id ?? name
  return (
    <div className="wb-field">
      <div className="wb-slider__header">
        <label htmlFor={fieldId} className="wb-field__label">
          {label}
        </label>
        {valueLabel !== undefined && <span className="wb-slider__value">{valueLabel}</span>}
      </div>
      <input
        ref={ref}
        type="range"
        id={fieldId}
        name={name}
        className={['wb-slider', className].filter(Boolean).join(' ')}
        {...props}
      />
    </div>
  )
})
