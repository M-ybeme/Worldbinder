import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { useSearchQuery } from '../hooks/useSearch'
import { resultHref } from '../lib/resultHref'
import { useSearchOverlayStore } from '../store/useSearchOverlayStore'
import { SearchResultRow } from './SearchResultRow'

const OVERLAY_RESULT_LIMIT = 8
const DEBOUNCE_MS = 200

export interface SearchOverlayProps {
  campaignId: string
}

/**
 * Global Ctrl/Cmd+K search overlay, opened from `CampaignLayout`. Keyboard
 * handling (arrow-key wrap, Enter to navigate, Escape to close) mirrors
 * `packages/ui/src/Combobox.tsx`'s pattern — referenced rather than reused,
 * since Combobox is a single-input-bound field, not a portal-rendered
 * multi-type modal.
 */
export function SearchOverlay({ campaignId }: SearchOverlayProps) {
  const isOpen = useSearchOverlayStore((state) => state.isOpen)
  const close = useSearchOverlayStore((state) => state.close)
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [query])

  useEffect(() => {
    if (!isOpen) return
    setQuery('')
    setDebouncedQuery('')
    setActiveIndex(0)
    const handle = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(handle)
  }, [isOpen])

  // Focus-trap contract for role="dialog" aria-modal="true": capture what
  // had focus before opening and restore it on close, so keyboard/screen-
  // reader users land back where they started instead of at the top of body.
  useEffect(() => {
    if (!isOpen) return
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null
    return () => {
      previouslyFocusedRef.current?.focus?.()
    }
  }, [isOpen])

  const trimmedQuery = debouncedQuery.trim()
  const searchResults = useSearchQuery(
    campaignId,
    { q: trimmedQuery, limit: OVERLAY_RESULT_LIMIT },
    { enabled: isOpen && trimmedQuery.length > 0 },
  )
  const results = searchResults.data?.results ?? []

  useEffect(() => {
    setActiveIndex(0)
  }, [results.length])

  if (!isOpen) return null

  function optionId(index: number): string {
    return `wb-search-overlay-option-${index}`
  }

  function goTo(index: number): void {
    const result = results[index]
    if (!result) return
    close()
    navigate(resultHref(campaignId, result))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'ArrowDown' && results.length > 0) {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % results.length)
    } else if (event.key === 'ArrowUp' && results.length > 0) {
      event.preventDefault()
      setActiveIndex((index) => (index - 1 + results.length) % results.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      goTo(activeIndex)
    }
  }

  // Minimal focus trap: keeps Tab from leaving the dialog while it's open.
  // Scoped to this one dialog rather than a shared primitive — no modal
  // component exists in packages/ui yet (see roadmap Milestone 13 audit).
  function handlePanelKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== 'Tab') return
    const panel = panelRef.current
    if (!panel) return
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div className="wb-search-overlay__backdrop" onMouseDown={close}>
      <div
        ref={panelRef}
        className="wb-search-overlay__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={handlePanelKeyDown}
      >
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="wb-search-overlay-listbox"
          aria-autocomplete="list"
          aria-activedescendant={results.length > 0 ? optionId(activeIndex) : undefined}
          autoComplete="off"
          className="wb-search-overlay__input"
          placeholder="Search campaign knowledge…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <ul id="wb-search-overlay-listbox" role="listbox" className="wb-search-overlay__results">
          {searchResults.isFetching && <li className="wb-search-overlay__status">Searching…</li>}
          {!searchResults.isFetching && trimmedQuery.length > 0 && results.length === 0 && (
            <li className="wb-search-overlay__status">No matches</li>
          )}
          {trimmedQuery.length === 0 && (
            <li className="wb-search-overlay__status">
              Type to search entities, sessions, threads…
            </li>
          )}
          {results.map((result, index) => (
            <li
              key={`${result.resourceType}-${result.id}`}
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
            >
              <SearchResultRow
                campaignId={campaignId}
                result={result}
                active={index === activeIndex}
                onSelect={close}
              />
            </li>
          ))}
        </ul>
        {trimmedQuery.length > 0 && (
          <div className="wb-search-overlay__footer">
            <Link
              to={`/app/campaign/${campaignId}/search?q=${encodeURIComponent(query)}`}
              onClick={close}
            >
              See all results
            </Link>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
