import { useId, useState, type KeyboardEvent } from 'react'

export interface ComboboxOption {
  id: string
  label: string
  meta?: string
}

export interface ComboboxProps {
  label: string
  inputValue: string
  onInputChange: (value: string) => void
  options: ComboboxOption[]
  onSelect: (option: ComboboxOption) => void
  loading?: boolean
  error?: string
  placeholder?: string
  emptyMessage?: string
}

/**
 * Generic, data-agnostic async combobox: the caller owns the input value
 * and the option list (typically debouncing a server search into
 * `onInputChange`) — this component only owns open/closed state and
 * keyboard navigation. Used for entity search-and-select (relationship
 * target, wiki-link mentions, cross-entity metadata references).
 */
export function Combobox({
  label,
  inputValue,
  onInputChange,
  options,
  onSelect,
  loading,
  error,
  placeholder,
  emptyMessage = 'No matches',
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const fieldId = useId()
  const listboxId = `${fieldId}-listbox`

  const select = (option: ComboboxOption) => {
    onSelect(option)
    setIsOpen(false)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setIsOpen(true)
      return
    }
    if (!isOpen || options.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % options.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index - 1 + options.length) % options.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = options[activeIndex]
      if (option) select(option)
    } else if (event.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const showDropdown = isOpen && (loading || options.length > 0 || inputValue.length > 0)

  return (
    <div className="wb-field wb-combobox">
      <label htmlFor={fieldId} className="wb-field__label">
        {label}
      </label>
      <input
        id={fieldId}
        type="text"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
        className="wb-field__input"
        value={inputValue}
        placeholder={placeholder}
        aria-invalid={!!error}
        onChange={(event) => {
          onInputChange(event.target.value)
          setActiveIndex(0)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onKeyDown={handleKeyDown}
      />
      {showDropdown && (
        <ul id={listboxId} role="listbox" className="wb-combobox__listbox">
          {loading && <li className="wb-combobox__status">Searching…</li>}
          {!loading && options.length === 0 && (
            <li className="wb-combobox__status">{emptyMessage}</li>
          )}
          {!loading &&
            options.map((option, index) => (
              <li
                key={option.id}
                role="option"
                aria-selected={index === activeIndex}
                className={
                  'wb-combobox__option' +
                  (index === activeIndex ? ' wb-combobox__option--active' : '')
                }
                // onMouseDown (not onClick) fires before the input's onBlur closes the list
                onMouseDown={(event) => {
                  event.preventDefault()
                  select(option)
                }}
              >
                {option.label}
                {option.meta && <span className="wb-combobox__meta">{option.meta}</span>}
              </li>
            ))}
        </ul>
      )}
      {error && (
        <p className="wb-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
