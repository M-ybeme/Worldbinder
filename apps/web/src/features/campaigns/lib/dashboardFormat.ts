import type { CampaignDashboard, WorldDate } from '@worldbinder/contracts'

/** Whether the Dashboard's setup checklist applies: only until the first
 * session has been played — after that the campaign is up and running and
 * the regular Dashboard takes over. (Owner/GM-only is the caller's check.) */
export function isSetupPhase(dashboard: CampaignDashboard): boolean {
  return dashboard.lastPlayedSession === null
}

export function formatWorldDate(date: WorldDate | null | undefined): string | null {
  if (!date) return null
  return (
    date.label ??
    `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
  )
}

/** "Sat 2 Nov, 7:00 PM" in the viewer's locale. */
export function formatSessionDateTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

/** "Sat 19 Oct" in the viewer's locale. */
export function formatSessionDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso))
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** Calendar days from today to `iso` in local time — 0 is today,
 * negative is in the past. */
export function calendarDaysUntil(iso: string, now: Date = new Date()): number {
  return Math.round((startOfDay(new Date(iso)) - startOfDay(now)) / 86_400_000)
}

/** "Next session today / tomorrow / in 6 days", or that its date passed. */
export function describeNextSession(iso: string, now: Date = new Date()): string {
  const days = calendarDaysUntil(iso, now)
  if (days < 0) return `Next session was due ${formatSessionDate(iso)}`
  if (days === 0) return 'Next session today'
  if (days === 1) return 'Next session tomorrow'
  return `Next session in ${days} days`
}

/** Compact age for activity rows: "now", "5m", "2h", "3d", then a date. */
export function formatAge(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(
    new Date(iso),
  )
}
