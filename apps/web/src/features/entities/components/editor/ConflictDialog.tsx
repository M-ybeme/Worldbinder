import type { EntityDetail } from '@worldbinder/contracts'
import { Button, Dialog } from '@worldbinder/ui'
import { useState } from 'react'
import { useReferencedEntities } from '../../hooks/useEntities'
import {
  entityDifferences,
  type FieldDifference,
  type LocalEntityVersion,
} from '../../lib/entityConflict'

export type ServerVersionState =
  | { status: 'loading' }
  | { status: 'ready'; entity: EntityDetail }
  /** 404/403: deleted, or no longer shared with this member. */
  | { status: 'unavailable' }
  | { status: 'error'; message: string }

type Step = 'compare' | 'confirm-keep' | 'confirm-load'

/** " on 27 Oct 2026, 21:04", or nothing if the version isn't a date. */
function formatWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return ` on ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)}`
}

function Difference({
  item,
  names,
}: {
  item: FieldDifference
  names: Map<string, EntityDetail | null>
}) {
  if (item.kind === 'content') {
    const changed = item.changes.filter((change) => change.kind !== 'same')
    const unchanged = item.changes.length - changed.length
    return (
      <li className="wb-conflict__item">
        <h3 className="wb-conflict__label">{item.label}</h3>
        <ul className="wb-conflict__blocks" aria-label={`${item.label} differences`}>
          {changed.map((change, index) => (
            <li key={index} className={`wb-conflict__block wb-conflict__block--${change.kind}`}>
              <span className="wb-conflict__tag">
                {change.kind === 'mine' ? 'Only in yours' : 'Only in theirs'}
              </span>
              <span>{change.text}</span>
            </li>
          ))}
        </ul>
        {unchanged > 0 && (
          <p className="wb-conflict__note">
            {unchanged} {unchanged === 1 ? 'paragraph is' : 'paragraphs are'} the same in both.
          </p>
        )}
      </li>
    )
  }
  const render = (value: string | null) => {
    if (item.kind === 'value') return value
    if (!value) return '—'
    // A referenced entry this member can't see shows no name.
    return names.get(value)?.name ?? 'An entry you can’t view'
  }
  return (
    <li className="wb-conflict__item">
      <h3 className="wb-conflict__label">{item.label}</h3>
      <dl className="wb-conflict__values">
        <div className="wb-conflict__value wb-conflict__value--mine">
          <dt>Yours</dt>
          <dd>{render(item.mine)}</dd>
        </div>
        <div className="wb-conflict__value wb-conflict__value--theirs">
          <dt>Theirs (saved)</dt>
          <dd>{render(item.theirs)}</dd>
        </div>
      </dl>
    </li>
  )
}

/**
 * "Changed elsewhere": someone saved a newer version while this member was
 * editing. Shows what differs between their local version and the
 * server's — what keeping theirs would overwrite — and offers three
 * explicit choices. Keeping theirs and loading the server version each need
 * a second confirmation; closing (Keep editing, Escape) changes nothing.
 *
 * The server version comes from the normal, permission-checked entity
 * endpoint, so GM-only content and hidden entries never appear for members
 * who can't see them; if the entry is no longer available, both overwrite
 * choices are withdrawn.
 */
export function ConflictDialog({
  open,
  campaignId,
  local,
  server,
  pending,
  changedAgain = false,
  onKeepEditing,
  onRetryLoad,
  onKeepMine,
  onLoadServer,
}: {
  open: boolean
  campaignId: string
  local: LocalEntityVersion
  server: ServerVersionState
  /** A resolution is being applied. */
  pending: boolean
  /** The overwrite was refused because it changed yet again. */
  changedAgain?: boolean
  onKeepEditing: () => void
  onRetryLoad: () => void
  onKeepMine: (server: EntityDetail) => void
  onLoadServer: (server: EntityDetail) => void
}) {
  const [step, setStep] = useState<Step>('compare')
  const entity = server.status === 'ready' ? server.entity : null
  const differences = entity ? entityDifferences(local, entity) : []
  const referenceIds = differences.flatMap((item) =>
    item.kind === 'reference' ? [item.mine, item.theirs].filter((id): id is string => !!id) : [],
  )
  const names = useReferencedEntities(campaignId, referenceIds).entities

  function close() {
    setStep('compare')
    onKeepEditing()
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Changed elsewhere"
      className="wb-conflict-dialog"
      flush
    >
      <div className="wb-conflict__scroll">
        {changedAgain && (
          <p className="wb-conflict__notice wb-conflict__notice--again" role="alert">
            It changed again before your version could be saved, so nothing was overwritten. These
            are the latest differences.
          </p>
        )}
        {server.status === 'loading' && <p>Loading the saved version…</p>}
        {server.status === 'error' && (
          <div className="wb-conflict__notice" role="alert">
            <p>The saved version couldn’t be loaded: {server.message}</p>
            <Button variant="secondary" onClick={onRetryLoad}>
              Try loading again
            </Button>
          </div>
        )}
        {server.status === 'unavailable' && (
          <p className="wb-conflict__notice" role="alert">
            This entry is no longer available to you — it may have been deleted, or your access
            changed. Your changes are kept on this device; nothing will be saved.
          </p>
        )}

        {entity && step === 'compare' && (
          <>
            <p>
              Someone saved a newer version of <strong>{entity.name}</strong>
              {formatWhen(entity.updatedAt)} while you were editing. Your changes haven’t been
              saved. Here’s what differs:
            </p>
            {differences.length === 0 ? (
              <p className="wb-conflict__note">
                No differences in the fields you can edit — keeping your version changes nothing you
                can see.
              </p>
            ) : (
              <ul className="wb-conflict__list" aria-label="Differences">
                {differences.map((item) => (
                  <Difference key={item.label} item={item} names={names} />
                ))}
              </ul>
            )}
          </>
        )}

        {entity && step === 'confirm-keep' && (
          <div className="wb-conflict__confirm">
            <h3>Overwrite the saved version with yours?</h3>
            <p>
              The {differences.length} difference{differences.length === 1 ? '' : 's'} listed will
              be replaced by your version. Their version stays in this entry’s revision history. If
              it changes again before your save lands, you’ll see the new differences instead of
              overwriting them.
            </p>
          </div>
        )}

        {entity && step === 'confirm-load' && (
          <div className="wb-conflict__confirm">
            <h3>Discard your changes?</h3>
            <p>
              Your unsaved edits to this entry will be removed from this device and the editor will
              show the saved version. This can’t be undone.
            </p>
          </div>
        )}
      </div>

      <div className="wb-conflict__actions">
        {step === 'compare' && (
          <>
            <Button variant="secondary" onClick={close}>
              Keep editing
            </Button>
            {entity && (
              <>
                <Button variant="secondary" onClick={() => setStep('confirm-load')}>
                  Load saved version
                </Button>
                <Button onClick={() => setStep('confirm-keep')}>Keep my changes…</Button>
              </>
            )}
          </>
        )}
        {entity && step === 'confirm-keep' && (
          <>
            <Button variant="secondary" onClick={() => setStep('compare')}>
              Back to differences
            </Button>
            <Button disabled={pending} onClick={() => onKeepMine(entity)}>
              {pending ? 'Saving…' : 'Overwrite with my version'}
            </Button>
          </>
        )}
        {entity && step === 'confirm-load' && (
          <>
            <Button variant="secondary" onClick={() => setStep('compare')}>
              Back to differences
            </Button>
            <Button variant="danger" disabled={pending} onClick={() => onLoadServer(entity)}>
              Discard my changes
            </Button>
          </>
        )}
      </div>
    </Dialog>
  )
}
