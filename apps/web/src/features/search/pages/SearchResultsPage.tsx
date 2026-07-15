import type { SearchResourceType } from '@worldbinder/contracts'
import { FormMessage } from '@worldbinder/ui'
import { useSearchParams } from 'react-router-dom'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import { SearchResultRow } from '../components/SearchResultRow'
import { useSearchQuery } from '../hooks/useSearch'

const RESOURCE_TYPE_FILTERS: { value: SearchResourceType; label: string }[] = [
  { value: 'entity', label: 'World' },
  { value: 'session', label: 'Sessions' },
  { value: 'plot_thread', label: 'Threads' },
  { value: 'relationship', label: 'Relationships' },
  { value: 'timeline_event', label: 'Timeline' },
]

const PAGE_SIZE = 20

function parseTypes(value: string | null): SearchResourceType[] {
  if (!value) return []
  return value
    .split(',')
    .filter((piece): piece is SearchResourceType =>
      RESOURCE_TYPE_FILTERS.some((filter) => filter.value === piece),
    )
}

/** Results-page query state is URL-owned (roadmap §10.2: "Search terms"
 * live in the URL, not Zustand) so a search is shareable/bookmarkable and
 * survives a reload — unlike the overlay's ephemeral in-memory query. */
export function SearchResultsPage() {
  const { campaign } = useCampaignOutletContext()
  const [searchParams, setSearchParams] = useSearchParams()

  const q = searchParams.get('q') ?? ''
  const selectedTypes = parseTypes(searchParams.get('types'))
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)
  const trimmedQuery = q.trim()

  const searchResults = useSearchQuery(
    campaign.id,
    {
      q: trimmedQuery,
      types: selectedTypes.length > 0 ? selectedTypes : undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    },
    { enabled: trimmedQuery.length > 0 },
  )

  const results = searchResults.data?.results ?? []
  const total = searchResults.data?.total ?? 0
  const hasNextPage = page * PAGE_SIZE < total

  function updateParams(next: { q?: string; types?: SearchResourceType[]; page?: number }): void {
    const params = new URLSearchParams(searchParams)
    if (next.q !== undefined) {
      if (next.q) params.set('q', next.q)
      else params.delete('q')
    }
    if (next.types !== undefined) {
      if (next.types.length > 0) params.set('types', next.types.join(','))
      else params.delete('types')
    }
    if (next.page !== undefined) {
      if (next.page > 1) params.set('page', String(next.page))
      else params.delete('page')
    }
    setSearchParams(params)
  }

  function toggleType(type: SearchResourceType): void {
    const next = selectedTypes.includes(type)
      ? selectedTypes.filter((selected) => selected !== type)
      : [...selectedTypes, type]
    updateParams({ types: next, page: 1 })
  }

  return (
    <section>
      <header className="wb-world-header">
        <h1>Search</h1>
      </header>

      <div className="wb-field">
        <label htmlFor="wb-search-page-input" className="wb-field__label">
          Search
        </label>
        <input
          id="wb-search-page-input"
          type="text"
          className="wb-field__input"
          value={q}
          onChange={(event) => updateParams({ q: event.target.value, page: 1 })}
          placeholder="Search campaign knowledge…"
        />
      </div>

      <fieldset className="wb-search-filters">
        <legend>Filter by type</legend>
        {RESOURCE_TYPE_FILTERS.map((filter) => (
          <label key={filter.value} className="wb-search-filters__option">
            <input
              type="checkbox"
              checked={selectedTypes.includes(filter.value)}
              onChange={() => toggleType(filter.value)}
            />
            {filter.label}
          </label>
        ))}
      </fieldset>

      {searchResults.isFetching && <p>Searching…</p>}
      {searchResults.isError && <FormMessage message={searchResults.error.message} />}

      {trimmedQuery.length === 0 && <p>Type a search term to get started.</p>}
      {trimmedQuery.length > 0 && !searchResults.isFetching && results.length === 0 && (
        <p>No matches for &ldquo;{trimmedQuery}&rdquo;.</p>
      )}

      <ul className="wb-search-results-page">
        {results.map((result) => (
          <li key={`${result.resourceType}-${result.id}`}>
            <SearchResultRow campaignId={campaign.id} result={result} />
          </li>
        ))}
      </ul>

      {(page > 1 || hasNextPage) && (
        <nav className="wb-pagination" aria-label="Search results pages">
          <button
            type="button"
            className="wb-button wb-button--secondary"
            disabled={page <= 1}
            onClick={() => updateParams({ page: page - 1 })}
          >
            Previous
          </button>
          <span>Page {page}</span>
          <button
            type="button"
            className="wb-button wb-button--secondary"
            disabled={!hasNextPage}
            onClick={() => updateParams({ page: page + 1 })}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  )
}
