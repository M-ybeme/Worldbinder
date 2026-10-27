import { NavLink } from 'react-router-dom'
import './WorldTabs.css'

function tabClass({ isActive }: { isActive: boolean }): string {
  return ['wb-world-tabs__tab', isActive ? 'wb-world-tabs__tab--active' : '']
    .filter(Boolean)
    .join(' ')
}

/**
 * World's two views — the entity encyclopedia and the timeline — as
 * page-level tabs, so World is one sidebar entry rather than two. Links
 * (not an ARIA tablist): each view is its own route with its own URL.
 */
export function WorldTabs({ campaignId }: { campaignId: string }) {
  const base = `/app/campaign/${campaignId}/world`
  return (
    <nav className="wb-world-tabs" aria-label="World views">
      <NavLink to={base} end className={tabClass}>
        Encyclopedia
      </NavLink>
      <NavLink to={`${base}/timeline`} className={tabClass}>
        Timeline
      </NavLink>
    </nav>
  )
}
