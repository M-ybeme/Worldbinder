import type { CampaignDashboard, CampaignDetail, EntityType } from '@worldbinder/contracts'
import { Button } from '@worldbinder/ui'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMembersQuery } from '../../../membership/hooks/useCampaignMembers'

interface Step {
  key: string
  title: ReactNode
  description: string
  action: ReactNode
}

/**
 * "Get the campaign ready" — built only from actions the app already has,
 * with each step's completion read from the campaign's real state (the
 * dashboard's existence checks, the member list, the calendar config —
 * never stored flags), so a step disappears once it's actually done. The
 * calendar step is optional and never keeps the checklist up on its own.
 */
export function SetupChecklist({
  campaign,
  dashboard,
  onNewEntity,
  onPlanSession,
}: {
  campaign: CampaignDetail
  dashboard: CampaignDashboard
  onNewEntity: (type: EntityType) => void
  onPlanSession: () => void
}) {
  const membersQuery = useMembersQuery(campaign.id)
  const base = `/app/campaign/${campaign.id}`

  // Authoritative, visibility-filtered existence checks from the API — not
  // inferred from recent activity, which only holds the latest 10 items.
  const { hasEntities, hasSessions } = dashboard
  // Unknown until the members list loads — treated as done meanwhile so
  // the step doesn't flash in and out.
  const hasPlayers = membersQuery.data ? membersQuery.data.length > 1 : true
  const hasCalendar = campaign.calendarConfigJson !== null

  const candidates: (Step | false)[] = [
    !hasEntities && {
      key: 'entities',
      title: 'Add the first people and places',
      description:
        'Characters, locations and factions become the encyclopedia everything else links to.',
      action: (
        <>
          <Button variant="secondary" onClick={() => onNewEntity('character')}>
            New character
          </Button>
          <Button variant="secondary" onClick={() => onNewEntity('location')}>
            New location
          </Button>
        </>
      ),
    },
    !hasSessions && {
      key: 'session',
      title: 'Plan your first session',
      description: 'It will appear here as “Up next”, with the threads and entries you feature.',
      action: <Button onClick={onPlanSession}>Plan a session</Button>,
    },
    !hasPlayers && {
      key: 'players',
      title: 'Invite your players',
      description: 'They see public entries; your GM-only notes stay hidden.',
      action: (
        <Link className="wb-button wb-button--secondary" to={`${base}/members`}>
          Invite players
        </Link>
      ),
    },
  ]
  const required = candidates.filter((step): step is Step => step !== false)

  if (required.length === 0) return null

  const steps: Step[] = hasCalendar
    ? required
    : [
        ...required,
        {
          key: 'calendar',
          title: (
            <>
              Set up the calendar <span className="wb-dash-muted">(optional)</span>
            </>
          ),
          description: 'Gives sessions and the timeline in-world dates.',
          action: (
            <Link className="wb-button wb-button--secondary" to={`${base}/settings`}>
              Calendar settings
            </Link>
          ),
        },
      ]

  return (
    <section className="wb-dash-card wb-dash-checklist" aria-labelledby="wb-dash-setup">
      <div>
        <h2 id="wb-dash-setup" className="wb-dash-checklist__title">
          Get the campaign ready
        </h2>
        <p className="wb-dash-secondary">
          Each step disappears once it’s done. Nothing here is required.
        </p>
      </div>
      <ol className="wb-dash-checklist__steps">
        {steps.map((step, index) => (
          <li key={step.key} className="wb-dash-checklist__step">
            <span className="wb-dash-checklist__number" aria-hidden="true">
              {index + 1}
            </span>
            <div className="wb-dash-checklist__text">
              <h3 className="wb-dash-checklist__step-title">{step.title}</h3>
              <p className="wb-dash-muted">{step.description}</p>
            </div>
            <div className="wb-dash-checklist__action">{step.action}</div>
          </li>
        ))}
      </ol>
      <p className="wb-dash-muted">
        Bringing an existing campaign? <Link to="/app/campaigns/import">Import a campaign file</Link>
        .
      </p>
    </section>
  )
}
