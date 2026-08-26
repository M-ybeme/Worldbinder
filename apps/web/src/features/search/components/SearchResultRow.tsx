import type { SearchResult } from '@worldbinder/contracts'
import { CalendarClock, CalendarDays, GitBranch, Link2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { EntityTypeIcon } from '../../entities/lib/entityTypeIcons'
import { resultHref } from '../lib/resultHref'
import '../search.css'

/** One icon per resourceType — entities get their own type icon (same
 * mapping WorldListPage/EntityDetailPage/the dashboard activity feed
 * already use), the other resource types get a fixed icon each, reusing
 * CampaignOverviewPage's ActivityIcon choices for session/plot_thread so
 * the same resource always renders the same icon across the app. */
function ResultIcon({ result }: { result: SearchResult }) {
  if (result.resourceType === 'entity' && result.entityType) {
    return <EntityTypeIcon type={result.entityType} size={16} />
  }
  if (result.resourceType === 'session') return <CalendarDays size={16} aria-hidden="true" />
  if (result.resourceType === 'plot_thread') return <GitBranch size={16} aria-hidden="true" />
  if (result.resourceType === 'timeline_event')
    return <CalendarClock size={16} aria-hidden="true" />
  return <Link2 size={16} aria-hidden="true" />
}

/** Renders highlight offsets as plain text nodes wrapped in <mark> — never
 * embedded markup, so there's no dangerouslySetInnerHTML anywhere in this
 * codebase's search UI either. */
function renderSnippet(snippet: SearchResult['snippet']): ReactNode {
  if (!snippet) return null
  const { text, highlights } = snippet

  if (highlights.length === 0) {
    return <p className="wb-search-result__snippet">{text}</p>
  }

  const nodes: ReactNode[] = []
  let cursor = 0
  highlights.forEach(([start, end], index) => {
    if (start > cursor) nodes.push(text.slice(cursor, start))
    nodes.push(<mark key={index}>{text.slice(start, end)}</mark>)
    cursor = end
  })
  if (cursor < text.length) nodes.push(text.slice(cursor))

  return <p className="wb-search-result__snippet">{nodes}</p>
}

export interface SearchResultRowProps {
  campaignId: string
  result: SearchResult
  active?: boolean
  onSelect?: () => void
}

export function SearchResultRow({ campaignId, result, active, onSelect }: SearchResultRowProps) {
  return (
    <Link
      to={resultHref(campaignId, result)}
      className={'wb-search-result' + (active ? ' wb-search-result--active' : '')}
      onClick={onSelect}
    >
      <div className="wb-search-result__heading">
        <span className="wb-search-result__icon">
          <ResultIcon result={result} />
        </span>
        <span className="wb-search-result__title">{result.title}</span>
        {result.subtitle && <span className="wb-search-result__subtitle">{result.subtitle}</span>}
      </div>
      {renderSnippet(result.snippet)}
    </Link>
  )
}
