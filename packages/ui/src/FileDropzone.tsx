import { useId, useState, type DragEvent } from 'react'
import './Field.css'
import './FileDropzone.css'

export interface FileDropzoneProps {
  label: string
  accept?: string
  disabled?: boolean
  onFilesSelected: (files: File[]) => void
  error?: string
}

/** Click-to-browse + drag-and-drop, following TextField's wb-field/
 * wb-field__label/wb-field__error class shape. No file-input primitive
 * existed in this package before Milestone 9.
 *
 * The clickable/keyboard-activatable target is a real `<label>` wrapping
 * a real (visually hidden but not aria-hidden) `<input type="file">` —
 * not a `role="button"` div with a nested input, which an automated
 * accessibility scan flagged as two interactive controls nested inside
 * each other, plus the input having no accessible name. A native label+
 * input pairing gets click-to-open, keyboard Enter/Space-to-open, and a
 * real accessible name for free, with no custom key handler needed. */
export function FileDropzone({ label, accept, disabled, onFilesSelected, error }: FileDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false)
  const labelId = useId()

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    onFilesSelected(Array.from(fileList))
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    if (!disabled) setIsDragActive(true)
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsDragActive(false)
    if (!disabled) handleFiles(event.dataTransfer.files)
  }

  return (
    <div className="wb-field">
      <span id={labelId} className="wb-field__label">
        {label}
      </span>
      <label
        className={[
          'wb-dropzone',
          isDragActive ? 'wb-dropzone--active' : '',
          disabled ? 'wb-dropzone--disabled' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={handleDrop}
      >
        <p>Drag a file here, or click to browse.</p>
        <input
          type="file"
          accept={accept}
          disabled={disabled}
          className="wb-dropzone__input"
          aria-labelledby={labelId}
          onChange={(event) => {
            handleFiles(event.target.files)
            event.target.value = ''
          }}
        />
      </label>
      {error && (
        <p className="wb-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
