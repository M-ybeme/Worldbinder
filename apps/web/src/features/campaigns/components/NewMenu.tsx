import { ChevronDown, Plus } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import './NewMenu.css'

// Matches .wb-new-menu__list's min-width in NewMenu.css.
const MENU_MIN_WIDTH = 200

export interface NewMenuItem {
  label: string
  onSelect: () => void
}

/**
 * A "+ New" menu button (WAI-ARIA menu button pattern): opens on click,
 * Enter/Space or ArrowDown, moves with the arrow keys and Home/End, and
 * closes on Escape (returning focus to the button), Tab, or a click
 * outside. Items are buttons so each one can open its own dialog.
 */
export function NewMenu({ items }: { items: NewMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  // Right-aligned to the button by default; opens rightwards instead when
  // there isn't room to its left (e.g. the button wraps to the start of the
  // header on a phone).
  const [alignStart, setAlignStart] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const menuId = useId()

  useEffect(() => {
    if (open) itemRefs.current[activeIndex]?.focus()
  }, [open, activeIndex])

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: PointerEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  function openAt(index: number) {
    const right = buttonRef.current?.getBoundingClientRect().right ?? Infinity
    setAlignStart(right < MENU_MIN_WIDTH + 16)
    setActiveIndex(index)
    setOpen(true)
  }

  function close(returnFocus: boolean) {
    setOpen(false)
    if (returnFocus) buttonRef.current?.focus()
  }

  function handleButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      openAt(0)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      openAt(items.length - 1)
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = items.length - 1
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((i) => (i === last ? 0 : i + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((i) => (i === 0 ? last : i - 1))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(last)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close(true)
    } else if (event.key === 'Tab') {
      close(false)
    }
  }

  return (
    <div className="wb-new-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="wb-button wb-button--primary wb-new-menu__button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close(false) : openAt(0))}
        onKeyDown={handleButtonKeyDown}
      >
        <Plus size={16} aria-hidden="true" />
        New
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Create new"
          tabIndex={-1}
          className={['wb-new-menu__list', alignStart ? 'wb-new-menu__list--start' : '']
            .filter(Boolean)
            .join(' ')}
          onKeyDown={handleMenuKeyDown}
        >
          {items.map((item, index) => (
            <button
              key={item.label}
              ref={(element) => {
                itemRefs.current[index] = element
              }}
              type="button"
              role="menuitem"
              tabIndex={index === activeIndex ? 0 : -1}
              className="wb-new-menu__item"
              onClick={() => {
                close(true)
                item.onSelect()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
