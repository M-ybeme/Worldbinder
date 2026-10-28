import { useId, useState, type ReactNode } from 'react'

/**
 * Shows the first `limit` items and a "Show N more" / "Show fewer" toggle
 * for the rest — so an entity with dozens of connections doesn't push the
 * rest of the sidebar off-screen. The toggle reports `aria-expanded` and
 * controls the list it extends.
 */
export function ShowMoreList<T>({
  items,
  limit,
  renderItem,
  label,
  className = 'wb-ed-list',
}: {
  items: T[]
  limit: number
  renderItem: (item: T) => ReactNode
  /** Accessible name for the list. */
  label: string
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  const hidden = items.length - limit
  const shown = expanded || hidden <= 0 ? items : items.slice(0, limit)

  return (
    <>
      <ul id={listId} className={className} aria-label={label}>
        {shown.map(renderItem)}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          className="wb-ed-more"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show fewer' : `Show ${hidden} more`}
        </button>
      )}
    </>
  )
}
