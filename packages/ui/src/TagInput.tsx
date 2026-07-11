import { useId, useState, type KeyboardEvent } from 'react'

export interface TagInputProps {
  label: string
  value: string[]
  onChange: (tags: string[]) => void
  error?: string
  placeholder?: string
}

export function TagInput({ label, value, onChange, error, placeholder }: TagInputProps) {
  const [draft, setDraft] = useState('')
  const fieldId = useId()

  const commitDraft = () => {
    const next = draft.trim()
    if (next && !value.includes(next)) {
      onChange([...value, next])
    }
    setDraft('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commitDraft()
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  const removeTag = (tag: string) => {
    onChange(value.filter((existing) => existing !== tag))
  }

  return (
    <div className="wb-field">
      <label htmlFor={fieldId} className="wb-field__label">
        {label}
      </label>
      <div className="wb-tag-input">
        {value.map((tag) => (
          <span key={tag} className="wb-tag-input__chip">
            {tag}
            <button
              type="button"
              className="wb-tag-input__remove"
              onClick={() => removeTag(tag)}
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={fieldId}
          type="text"
          className="wb-tag-input__field"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitDraft}
          placeholder={placeholder}
          aria-invalid={!!error}
        />
      </div>
      {error && (
        <p className="wb-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
