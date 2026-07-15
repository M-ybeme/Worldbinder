import { Link } from 'react-router-dom'

const ROLES = [
  {
    role: 'Owner',
    description: 'Full control, including deletion, member management, and settings.',
  },
  {
    role: 'GM',
    description:
      'Can view and edit GM-only content, manage most campaign data, and reveal information to players.',
  },
  {
    role: 'Editor',
    description:
      'Can maintain entities, sessions, and plot threads. Seeing GM-only content is configurable per campaign.',
  },
  {
    role: 'Player',
    description:
      'Sees only what has been revealed — public entities, revealed sessions, and player-facing plot statuses.',
  },
  {
    role: 'Viewer',
    description:
      'Read-only access to whatever is visible to them. Useful for guests or spectators.',
  },
]

const NAV_MAP = [
  {
    label: 'Dashboard',
    description: "the campaign's overview — upcoming sessions, active threads, recent activity",
  },
  {
    label: 'World',
    description: 'entities (characters, locations, factions, and everything else) and the timeline',
  },
  { label: 'Sessions', description: 'a log of what happened at the table, session by session' },
  { label: 'Threads', description: 'ongoing plots and their status' },
  {
    label: 'Maps',
    description: 'images with pins linking to locations, characters, or anything else',
  },
  {
    label: 'Search',
    description:
      'find anything in the campaign — press Ctrl/Cmd+K from any campaign page to open it',
  },
  { label: 'Members', description: 'who has access to the campaign, and at what role' },
  { label: 'Settings', description: "the campaign's name, system, calendar, and cover image" },
]

/** Static getting-started content — deliberately not a guided tour/walkthrough
 * library, per this codebase's "build up only as real screens need them"
 * philosophy (no such component exists yet, and one page of real content
 * doesn't justify building one). Public route: useful before registering,
 * not just after. */
export function HelpPage() {
  return (
    <section>
      <h1>Help &amp; getting started</h1>
      <p>
        Worldbinder is a campaign encyclopedia and continuity manager for tabletop RPGs. Track your
        world&apos;s entities, sessions, plot threads, maps, and timeline in one place, with control
        over exactly what your players can see.
      </p>

      <h2>Getting started</h2>
      <ol>
        <li>
          <Link to="/app/campaigns">Create a campaign</Link>.
        </li>
        <li>
          Add your first entity — a character, location, faction, or anything else — from World.
        </li>
        <li>Log a session under Sessions once you&apos;ve played.</li>
        <li>Track ongoing plots under Threads.</li>
        <li>Invite your players from Members so they can see what you choose to share.</li>
        <li>Use Search (Ctrl/Cmd+K from any campaign page) to jump to anything quickly.</li>
      </ol>

      <h2>Where things live</h2>
      <dl className="status-panel">
        {NAV_MAP.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.description}</dd>
          </div>
        ))}
      </dl>

      <h2>Visibility</h2>
      <p>
        Most content can be marked <strong>Public</strong> (visible to every campaign member) or{' '}
        <strong>GM only</strong> (hidden from players). Use this to write your real notes — hidden
        plot twists, secret motivations, unrevealed connections — right alongside what your players
        are allowed to see, instead of keeping a separate document.
      </p>

      <h2>Roles</h2>
      <dl className="status-panel">
        {ROLES.map((item) => (
          <div key={item.role}>
            <dt>{item.role}</dt>
            <dd>{item.description}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
