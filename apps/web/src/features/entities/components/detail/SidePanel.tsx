import { useId, useState, type ReactNode } from 'react'

/**
 * One block of the entity page's connected-information column. On wide
 * screens it's an always-open card; on phones (`collapsible`) it becomes a
 * native disclosure so the article stays first and each block is one tap
 * away. Content mounts only while a disclosure is open, so closed panels
 * don't fetch.
 */
export function SidePanel({
  title,
  count,
  meta,
  action,
  collapsible,
  children,
}: {
  title: string
  count?: number
  /** Short text shown beside the title, e.g. "edited 4d ago". */
  meta?: string
  /** A control beside the title on the card (e.g. "Manage"). */
  action?: ReactNode
  collapsible: boolean
  children: ReactNode
}) {
  const headingId = useId()
  const [open, setOpen] = useState(false)
  const heading = (
    <h2 id={headingId} className="wb-ed-panel__title">
      {title}
      {count !== undefined && count > 0 && <span className="wb-ed-count">{count}</span>}
      {meta && <span className="wb-ed-panel__meta">{meta}</span>}
    </h2>
  )

  if (collapsible) {
    return (
      <details
        className="wb-ed-disclosure"
        onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
      >
        <summary>{heading}</summary>
        {open && (
          <div className="wb-ed-disclosure__body">
            {action && <div className="wb-ed-panel__action">{action}</div>}
            {children}
          </div>
        )}
      </details>
    )
  }

  return (
    <section className="wb-ed-panel" aria-labelledby={headingId}>
      <div className="wb-ed-panel__head">
        {heading}
        {action}
      </div>
      {children}
    </section>
  )
}
