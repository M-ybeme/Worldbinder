import type { CSSProperties, ReactNode } from 'react'
import './CardGrid.css'

export interface CardGridProps {
  children: ReactNode
  /** Minimum width (px) before the grid wraps to fewer columns. */
  minItemWidth?: number
}

/**
 * Responsive `repeat(auto-fill, minmax(...))` card grid — wraps to more
 * columns as the viewport widens instead of the fixed single-column stacks
 * every list/dashboard page used before this (see WORLDBINDER_DESIGN_SYSTEM.md
 * §45's UI/UX rework phases). Two real consumers from day one: WorldListPage's
 * entity cards and CampaignOverviewPage's dashboard widgets — not built
 * speculatively.
 */
export function CardGrid({ children, minItemWidth = 280 }: CardGridProps) {
  return (
    <div
      className="wb-card-grid"
      style={{ '--wb-card-grid-min-width': `${minItemWidth}px` } as CSSProperties}
    >
      {children}
    </div>
  )
}
