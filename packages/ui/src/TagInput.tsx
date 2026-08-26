import { useId, useState, type KeyboardEvent } from 'react'
import './Combobox.css'
import './Field.css'
import './TagInput.css'

export interface TagInputProps {
  label: string
  value: string[]
  onChange: (tags: string[]) => void
  error?: string
  placeholder?: string
  /** Existing tag names in the campaign — when given, typing shows a
   * filtered dropdown of matches (excluding tags already added) so
   * campaigns converge on a shared vocabulary instead of near-duplicate
   * tags. Omit for a plain freeform input (e.g. no campaign-tag list
   * fetched yet). */
  suggestions?: string[]
}

export function TagInput({
  label,
  value,
  onChange,
  error,
  placeholder,
  suggestions,
}: TagInputProps) {
  const [draft, setDraft] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const fieldId = useId()

  const addTag = (name: string) => {
    const next = name.trim()
    if (next && !value.includes(next)) {
      onChange([...value, next])
      setAnnouncement(`Added tag ${next}`)
    }
    setDraft('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTag(draft)
    } else if (event.key === 'Escape') {
      setSuggestionsOpen(false)
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      const removed = value[value.length - 1]
      onChange(value.slice(0, -1))
      setAnnouncement(`Removed tag ${removed}`)
    }
  }

  const removeTag = (tag: string) => {
    onChange(value.filter((existing) => existing !== tag))
    setAnnouncement(`Removed tag ${tag}`)
  }

  const draftLower = draft.trim().toLowerCase()
  const matches =
    suggestions && draftLower
      ? suggestions.filter(
          (name) => name.toLowerCase().includes(draftLower) && !value.includes(name),
        )
      : []
  const showDropdown = suggestionsOpen && matches.length > 0

  return (
    <div className="wb-field">
      <label htmlFor={fieldId} className="wb-field__label">
        {label}
      </label>
      <div className="wb-tag-input">
        <ul className="wb-tag-input__list">
          {value.map((tag) => (
            <li key={tag} className="wb-tag-input__chip">
              {tag}
              <button
                type="button"
                className="wb-tag-input__remove"
                onClick={() => removeTag(tag)}
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <input
          id={fieldId}
          type="text"
          className="wb-tag-input__field"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            setSuggestionsOpen(true)
          }}
          onFocus={() => setSuggestionsOpen(true)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            addTag(draft)
            setSuggestionsOpen(false)
          }}
          placeholder={placeholder}
          aria-invalid={!!error}
          autoComplete="off"
        />
        {showDropdown && (
          <ul className="wb-combobox__listbox wb-tag-input__suggestions">
            {matches.map((name) => (
              <li
                key={name}
                role="option"
                aria-selected={false}
                className="wb-combobox__option"
                // onMouseDown (not onClick) fires before the input's onBlur commits the draft
                onMouseDown={(event) => {
                  event.preventDefault()
                  addTag(name)
                  setSuggestionsOpen(false)
                }}
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </div>
      <span className="wb-visually-hidden" role="status" aria-live="polite">
        {announcement}
      </span>
      {error && (
        <p className="wb-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
