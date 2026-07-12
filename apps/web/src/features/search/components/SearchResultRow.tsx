import type { SearchResult } from '@worldbinder/contracts'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { resultHref } from '../lib/resultHref'

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
        <span className="wb-search-result__title">{result.title}</span>
        {result.subtitle && <span className="wb-search-result__subtitle">{result.subtitle}</span>}
      </div>
      {renderSnippet(result.snippet)}
    </Link>
  )
}
