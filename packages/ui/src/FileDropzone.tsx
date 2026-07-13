import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react'

export interface FileDropzoneProps {
  label: string
  accept?: string
  disabled?: boolean
  onFilesSelected: (files: File[]) => void
  error?: string
}

/** Click-to-browse + drag-and-drop, following TextField's wb-field/
 * wb-field__label/wb-field__error class shape. No file-input primitive
 * existed in this package before Milestone 9. */
export function FileDropzone({ label, accept, disabled, onFilesSelected, error }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragActive, setIsDragActive] = useState(false)

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    onFilesSelected(Array.from(fileList))
  }

  function openPicker() {
    if (!disabled) inputRef.current?.click()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    openPicker()
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (!disabled) setIsDragActive(true)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragActive(false)
    if (!disabled) handleFiles(event.dataTransfer.files)
  }

  return (
    <div className="wb-field">
      <span className="wb-field__label">{label}</span>
      <div
        className={['wb-dropzone', isDragActive ? 'wb-dropzone--active' : ''].filter(Boolean).join(' ')}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={openPicker}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={handleDrop}
      >
        <p>Drag a file here, or click to browse.</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          disabled={disabled}
          className="wb-dropzone__input"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(event) => {
            handleFiles(event.target.files)
            event.target.value = ''
          }}
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
