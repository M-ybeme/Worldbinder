import { useEffect, useState, type KeyboardEvent } from 'react'
import { Dialog } from '@worldbinder/ui'
import { Link, useNavigate } from 'react-router-dom'
import { useSearchQuery } from '../hooks/useSearch'
import { resultHref } from '../lib/resultHref'
import { useSearchOverlayStore } from '../store/useSearchOverlayStore'
import { SearchResultRow } from './SearchResultRow'
import '../search.css'

const OVERLAY_RESULT_LIMIT = 8
const DEBOUNCE_MS = 200

export interface SearchOverlayProps {
  campaignId: string
}

/**
 * Global Ctrl/Cmd+K search overlay, opened from `CampaignLayout`. Renders
 * through `@worldbinder/ui`'s `Dialog` primitive for the portal/focus-trap/
 * backdrop-dismiss mechanics (this component used to hand-roll that logic
 * itself — extracted into Dialog during the design-system rollout's Phase
 * 2). Keyboard handling here (arrow-key wrap, Enter to navigate) is its own
 * combobox-style layer on top, since Dialog only owns modal mechanics, not
 * listbox navigation.
 */
export function SearchOverlay({ campaignId }: SearchOverlayProps) {
  const isOpen = useSearchOverlayStore((state) => state.isOpen)
  const close = useSearchOverlayStore((state) => state.close)
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [query])

  useEffect(() => {
    if (!isOpen) return
    setQuery('')
    setDebouncedQuery('')
    setActiveIndex(0)
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
    if (event.key === 'ArrowDown' && results.length > 0) {
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

  return (
    <Dialog
      open={isOpen}
      onClose={close}
      label="Search"
      hideCloseButton
      flush
      className="wb-search-overlay__panel"
    >
      <input
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
      {/* role="listbox" only when there's at least one real role="option"
          child — the role structurally *requires* one (WAI-ARIA
          aria-required-children), which an always-on role="listbox"
          can't satisfy while the search box is empty or mid-query. The
          status messages below mirror that same condition for their own
          role: role="presentation" (out of the listbox's child-role
          bookkeeping) when a listbox IS active, or no override at all
          (a plain <ul>'s <li> needs its native listitem role intact)
          when it isn't — hardcoding one or the other broke whichever
          case it wasn't written for. */}
      <ul
        id="wb-search-overlay-listbox"
        role={results.length > 0 ? 'listbox' : undefined}
        className="wb-search-overlay__results"
      >
        {searchResults.isFetching && (
          <li
            role={results.length > 0 ? 'presentation' : undefined}
            className="wb-search-overlay__status"
          >
            Searching…
          </li>
        )}
        {!searchResults.isFetching && trimmedQuery.length > 0 && results.length === 0 && (
          <li className="wb-search-overlay__status">No matches</li>
        )}
        {trimmedQuery.length === 0 && (
          <li className="wb-search-overlay__status">Type to search entities, sessions, threads…</li>
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
    </Dialog>
  )
}
