import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowLeftRight,
  CalendarDays,
  GitBranch,
  Globe,
  HelpCircle,
  LayoutDashboard,
  Map,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Search,
  Settings,
  User,
  Users,
  X,
} from 'lucide-react'
import { IconButton, Tooltip } from '@worldbinder/ui'
import { SearchOverlay } from '../../search/components/SearchOverlay'
import { useSearchOverlayStore } from '../../search/store/useSearchOverlayStore'
import { CampaignSwitcher } from './CampaignSwitcher'
import { useCampaignOutletContext } from '../hooks/useCampaignContext'
import './CampaignLayout.css'

const MANAGEMENT_ROLES = new Set(['owner', 'gm'])
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'wb-sidebar-collapsed'
const SIDEBAR_ID = 'wb-campaign-sidebar'
// Matches CampaignLayout.css's own breakpoint (--wb-breakpoint-tablet) —
// below it the sidebar becomes an off-canvas drawer.
const NARROW_VIEWPORT_QUERY = '(max-width: 768px)'

function loadCollapsedPreference(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true'
  } catch {
    // Private browsing / storage disabled — default to expanded.
    return false
  }
}

function useIsNarrowViewport(): boolean {
  const [isNarrow, setIsNarrow] = useState(
    () =>
      typeof window.matchMedia === 'function' && window.matchMedia(NARROW_VIEWPORT_QUERY).matches,
  )
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(NARROW_VIEWPORT_QUERY)
    const onChange = () => setIsNarrow(query.matches)
    onChange()
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return isNarrow
}

function isPathActive(pathname: string, to: string, end?: boolean): boolean {
  if (pathname === to || pathname === `${to}/`) return true
  return !end && pathname.startsWith(`${to}/`)
}

/** The current section's name, for the document title and the mobile top
 * bar — derived from the URL's first segment under the campaign, so a new
 * route only needs an entry here to get a proper title. */
const SECTION_LABELS: Record<string, string> = {
  world: 'World',
  sessions: 'Sessions',
  threads: 'Threads',
  maps: 'Maps',
  search: 'Search',
  members: 'Members',
  settings: 'Settings',
  tags: 'Tags',
  audit: 'Audit Log',
  'import-export': 'Import / Export',
}

function sectionLabelFor(pathname: string, base: string): string {
  const [section, sub] = pathname.slice(base.length).split('/').filter(Boolean)
  if (!section) return 'Dashboard'
  if (section === 'world' && sub === 'timeline') return 'Timeline'
  return SECTION_LABELS[section] ?? 'Dashboard'
}

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  end?: boolean
  /** Extra route prefixes that also count as this item being current —
   * e.g. Tags, which has no nav entry of its own and is reached from
   * Settings. */
  alsoActiveFor?: string[]
}

/** A nav link that collapses to icon-only with a hover/focus tooltip
 * standing in for the now-hidden text label — the label stays in the DOM
 * (for CSS-only hide, not unmount) and `aria-label` keeps the accessible
 * name correct either way, so nothing regresses for assistive tech when
 * collapsed. A plain `Link` with its own active check rather than
 * `NavLink`, so `alsoActiveFor` routes get `aria-current` too. */
function SidebarNavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const { pathname } = useLocation()
  const active =
    isPathActive(pathname, item.to, item.end) ||
    (item.alsoActiveFor ?? []).some((prefix) => isPathActive(pathname, prefix))
  const link = (
    <Link
      to={item.to}
      className={['wb-sidebar__link', active ? 'wb-sidebar__link--active' : '']
        .filter(Boolean)
        .join(' ')}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
    >
      {item.icon}
      <span className="wb-sidebar__link-label">{item.label}</span>
    </Link>
  )
  return collapsed ? (
    <Tooltip label={item.label} placement="right">
      {link}
    </Tooltip>
  ) : (
    link
  )
}

function WithTooltip({
  collapsed,
  label,
  children,
}: {
  collapsed: boolean
  label: string
  children: ReactElement
}) {
  return collapsed ? (
    <Tooltip label={label} placement="right">
      {children}
    </Tooltip>
  ) : (
    children
  )
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/**
 * The campaign-scoped app shell. A single sidebar carries everything the
 * old topbar used to: the campaign switcher, the one search entry point
 * (opens the same Ctrl/Cmd+K overlay; its "See all results" link still
 * reaches the full results page), primary nav (Dashboard/World/Sessions/
 * Threads/Maps), a Manage group, and Help/Account in the footer. On
 * desktop it collapses to an icon rail (the preference persists in
 * localStorage); at tablet width and below it becomes an off-canvas
 * drawer, with a compact top bar and bottom tabs for the primary sections.
 * Only mounted for `/app/campaign/:id/*` routes — the outer `App.tsx`
 * shell (auth/account/status/help) keeps its own lighter header.
 */
export function CampaignLayout() {
  const { campaign } = useCampaignOutletContext()
  const canManage = MANAGEMENT_ROLES.has(campaign.role)
  const openSearch = useSearchOverlayStore((state) => state.open)
  const [collapsedPreference, setCollapsedPreference] = useState(loadCollapsedPreference)
  const isNarrow = useIsNarrowViewport()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { pathname } = useLocation()
  const sidebarRef = useRef<HTMLElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  // The drawer always shows full labels; the rail preference is desktop-only.
  const collapsed = collapsedPreference && !isNarrow
  const drawerVisible = isNarrow && drawerOpen
  const base = `/app/campaign/${campaign.id}`
  const sectionLabel = sectionLabelFor(pathname, base)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const isSearchShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
      if (!isSearchShortcut) return
      event.preventDefault()
      openSearch()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [openSearch])

  useEffect(() => {
    document.title =
      sectionLabel === 'Dashboard'
        ? `${campaign.name} · Worldbinder`
        : `${sectionLabel} · ${campaign.name} · Worldbinder`
  }, [sectionLabel, campaign.name])
  useEffect(
    () => () => {
      document.title = 'Worldbinder'
    },
    [],
  )

  // Following a link closes the drawer, as does widening past the
  // breakpoint (so it isn't found unexpectedly open on the way back down).
  useEffect(() => setDrawerOpen(false), [pathname, isNarrow])

  useEffect(() => {
    if (!drawerVisible) return
    sidebarRef.current?.querySelector<HTMLElement>('a, button, select')?.focus()
    const menuButton = menuButtonRef.current
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      menuButton?.focus()
    }
  }, [drawerVisible])

  function toggleCollapsed() {
    setCollapsedPreference((current) => {
      const next = !current
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next))
      } catch {
        // Private browsing / storage disabled — the toggle still works
        // for this session, it just won't persist across a reload.
      }
      return next
    })
  }

  function openSearchFromNav() {
    setDrawerOpen(false)
    openSearch()
  }

  const primaryItems: NavItem[] = [
    {
      to: base,
      end: true,
      label: 'Dashboard',
      icon: <LayoutDashboard size={18} aria-hidden="true" />,
    },
    { to: `${base}/world`, label: 'World', icon: <Globe size={18} aria-hidden="true" /> },
    {
      to: `${base}/sessions`,
      label: 'Sessions',
      icon: <CalendarDays size={18} aria-hidden="true" />,
    },
    { to: `${base}/threads`, label: 'Threads', icon: <GitBranch size={18} aria-hidden="true" /> },
    { to: `${base}/maps`, label: 'Maps', icon: <Map size={18} aria-hidden="true" /> },
  ]

  // Import / Export stays visible to every role, as before: players can't
  // create exports but can see and download the campaign's existing ones.
  const manageItems: NavItem[] = [
    { to: `${base}/members`, label: 'Members', icon: <Users size={18} aria-hidden="true" /> },
    ...(canManage
      ? [
          {
            to: `${base}/settings`,
            label: 'Settings',
            icon: <Settings size={18} aria-hidden="true" />,
            alsoActiveFor: [`${base}/tags`],
          },
          {
            to: `${base}/audit`,
            label: 'Audit Log',
            icon: <ScrollText size={18} aria-hidden="true" />,
          },
        ]
      : []),
    {
      to: `${base}/import-export`,
      label: 'Import / Export',
      icon: <ArrowLeftRight size={18} aria-hidden="true" />,
    },
  ]

  const accountItems: NavItem[] = [
    { to: '/help', label: 'Help', icon: <HelpCircle size={18} aria-hidden="true" /> },
    { to: '/account/profile', label: 'Account', icon: <User size={18} aria-hidden="true" /> },
  ]

  return (
    <div
      className={['wb-campaign-layout', drawerVisible ? 'wb-campaign-layout--drawer-open' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <header className="wb-mobile-topbar" inert={drawerVisible}>
        <button
          ref={menuButtonRef}
          type="button"
          className="wb-icon-button"
          aria-label="Open navigation"
          aria-expanded={drawerVisible}
          aria-controls={SIDEBAR_ID}
          onClick={() => setDrawerOpen(true)}
        >
          <Menu size={20} aria-hidden="true" />
        </button>
        <span className="wb-mobile-topbar__title">{sectionLabel}</span>
        <IconButton label="Search" onClick={openSearch}>
          <Search size={20} aria-hidden="true" />
        </IconButton>
      </header>

      {drawerVisible && (
        <div className="wb-sidebar-scrim" aria-hidden="true" onClick={() => setDrawerOpen(false)} />
      )}

      <aside
        id={SIDEBAR_ID}
        ref={sidebarRef}
        className={['wb-sidebar', collapsed ? 'wb-sidebar--collapsed' : '']
          .filter(Boolean)
          .join(' ')}
        role={drawerVisible ? 'dialog' : undefined}
        aria-modal={drawerVisible ? true : undefined}
        aria-label={drawerVisible ? 'Navigation' : undefined}
        inert={isNarrow && !drawerOpen}
      >
        <div className="wb-sidebar__header">
          <div className="wb-sidebar__header-row">
            <WithTooltip collapsed={collapsed} label="All campaigns">
              <Link to="/app/campaigns" className="wb-sidebar__back" aria-label="All campaigns">
                <ArrowLeft size={14} aria-hidden="true" />
                {!collapsed && 'All campaigns'}
              </Link>
            </WithTooltip>
            {isNarrow && (
              <IconButton label="Close navigation" onClick={() => setDrawerOpen(false)}>
                <X size={18} aria-hidden="true" />
              </IconButton>
            )}
          </div>
          {!collapsed && <CampaignSwitcher currentCampaignId={campaign.id} />}
        </div>

        <WithTooltip collapsed={collapsed} label="Search (Ctrl/Cmd+K)">
          <button
            type="button"
            className="wb-sidebar__search"
            aria-label="Search (Ctrl/Cmd+K)"
            aria-keyshortcuts="Control+K Meta+K"
            onClick={openSearchFromNav}
          >
            <Search size={16} aria-hidden="true" />
            <span className="wb-sidebar__link-label">Search</span>
            <kbd className="wb-sidebar__kbd" aria-hidden="true">
              {IS_MAC ? '⌘K' : 'Ctrl K'}
            </kbd>
          </button>
        </WithTooltip>

        <nav className="wb-sidebar__nav" aria-label="Campaign">
          {primaryItems.map((item) => (
            <SidebarNavLink key={item.to} item={item} collapsed={collapsed} />
          ))}
        </nav>

        <nav
          className="wb-sidebar__nav wb-sidebar__nav--secondary"
          aria-label="Campaign management"
        >
          <span className="wb-sidebar__group-label" aria-hidden="true">
            Manage
          </span>
          {manageItems.map((item) => (
            <SidebarNavLink key={item.to} item={item} collapsed={collapsed} />
          ))}
        </nav>

        <div className="wb-sidebar__footer">
          <nav className="wb-sidebar__nav" aria-label="Help and account">
            {accountItems.map((item) => (
              <SidebarNavLink key={item.to} item={item} collapsed={collapsed} />
            ))}
          </nav>
          {!isNarrow && (
            <WithTooltip collapsed={collapsed} label="Expand sidebar">
              <button
                type="button"
                className="wb-sidebar__link wb-sidebar__toggle"
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-expanded={!collapsed}
                aria-controls={SIDEBAR_ID}
                onClick={toggleCollapsed}
              >
                {collapsed ? (
                  <PanelLeftOpen size={18} aria-hidden="true" />
                ) : (
                  <PanelLeftClose size={18} aria-hidden="true" />
                )}
                <span className="wb-sidebar__link-label">Collapse</span>
              </button>
            </WithTooltip>
          )}
        </div>
      </aside>

      <div className="wb-campaign-layout__main" inert={drawerVisible}>
        <main className="wb-campaign-layout__content">
          <Outlet context={{ campaign }} />
        </main>
      </div>

      <nav className="wb-tabbar" aria-label="Campaign sections" inert={drawerVisible}>
        {primaryItems.map((item) => {
          const active = isPathActive(pathname, item.to, item.end)
          return (
            <Link
              key={item.to}
              to={item.to}
              className={['wb-tabbar__link', active ? 'wb-tabbar__link--active' : '']
                .filter(Boolean)
                .join(' ')}
              aria-current={active ? 'page' : undefined}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <SearchOverlay campaignId={campaign.id} />
    </div>
  )
}
