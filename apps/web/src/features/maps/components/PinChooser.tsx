import type { MapPinSummary } from '@worldbinder/contracts'
import { Badge, IconButton } from '@worldbinder/ui'
import { X } from 'lucide-react'
import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react'
import { EntityTypeIcon, ENTITY_TYPE_LABELS } from '../../entities/lib/entityTypeIcons'
import { pinLabel } from '../lib/pins'

/**
 * Pins that overlap at the current zoom: choose which one you meant.
 * Focus starts on the first; arrow keys move between them; Escape (or a
 * click elsewhere) closes and returns focus to the group's marker. Only
 * pins already on the map — so only ones this viewer may see — are listed.
 */
export function PinChooser({
  pins,
  style,
  showVisibility = true,
  onChoose,
  onClose,
}: {
  pins: MapPinSummary[]
  /** Desktop: positioned beside the group's marker. Omit when inline (the
   * phone sheet). */
  style?: CSSProperties
  /** Off in At the Table: GM-only pins never reach it anyway. */
  showVisibility?: boolean
  onChoose: (pin: MapPinSummary) => void
  onClose: () => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const optionsRef = useRef<(HTMLButtonElement | null)[]>([])
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    optionsRef.current[0]?.focus()
  }, [pins])

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) onCloseRef.current()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const options = optionsRef.current.filter((option): option is HTMLButtonElement => option !== null)
    const index = options.indexOf(document.activeElement as HTMLButtonElement)
    const moves: Record<string, () => number> = {
      ArrowDown: () => (index + 1) % options.length,
      ArrowUp: () => (index - 1 + options.length) % options.length,
      Home: () => 0,
      End: () => options.length - 1,
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
      return
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    options[move()]?.focus()
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      ref={rootRef}
      className={['wb-pin-chooser', style ? 'wb-pin-chooser--floating' : ''].filter(Boolean).join(' ')}
      style={style}
      role="dialog"
      aria-label={`${pins.length} pins here`}
      onKeyDown={handleKeyDown}
    >
      <div className="wb-pin-chooser__head">
        <h2 className="wb-pin-chooser__title">{pins.length} pins here</h2>
        <IconButton label="Close" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </IconButton>
      </div>
      <ul className="wb-pin-chooser__list">
        {pins.map((pin, index) => (
          <li key={pin.id}>
            <button
              ref={(element) => {
                optionsRef.current[index] = element
              }}
              type="button"
              className="wb-pin-chooser__option"
              onClick={() => onChoose(pin)}
            >
              <span className="wb-pin-chooser__icon" data-visibility={pin.visibility} aria-hidden="true">
                {pin.locationEntityType && <EntityTypeIcon type={pin.locationEntityType} size={12} />}
              </span>
              <span className="wb-pin-chooser__name">{pinLabel(pin)}</span>
              <span className="wb-pin-chooser__meta">
                {pin.locationEntityType ? ENTITY_TYPE_LABELS[pin.locationEntityType] : 'Pin'}
              </span>
              {showVisibility && pin.visibility === 'gm_only' && <Badge tone="warning">GM only</Badge>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
