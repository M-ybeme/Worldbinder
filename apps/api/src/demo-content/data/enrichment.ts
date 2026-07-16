import type { EntityType } from '@worldbinder/contracts';
import type { MentionRef } from '../refs';
import { doc, paragraph } from '../tiptap';

export interface DemoEntityEnrichment {
  slug: string;
  entityType: EntityType;
  metadataPatch?: Record<string, unknown>;
  publicContentJson?: ReturnType<typeof doc>;
  gmContentJson?: ReturnType<typeof doc>;
}

/**
 * Milestone 15 Phase 3 — rewrites a curated subset of entities' content to
 * include real inline `entityMention` wiki-link nodes (via `mention()`,
 * which needs each target's real id — hence a `(slugToId) => ...` factory
 * rather than static content like Phase 2's entity data), plus narrative
 * updates that follow from the campaign's own completed sessions (Osten's
 * death). Applied by the *editor* account, not the GM who created
 * everything in Phase 2 — a different actor is what makes
 * `RevisionRecorderService` open a genuine second revision instead of
 * merging into the creation edit (see `revision-recorder.service.ts`'s
 * ~30-minute same-actor merge window).
 */
export function buildEntityEnrichments(
  m: (slug: string) => MentionRef,
): DemoEntityEnrichment[] {
  return [
    {
      slug: 'osten',
      entityType: 'character',
      metadataPatch: { lifeStatus: 'deceased' },
      publicContentJson: doc(
        paragraph(
          'Thirty years Lord of Ashgate Crossing, Osten died before naming an heir between ',
          m('iseult'),
          ' and ',
          m('branwyn'),
          ' — and without the ',
          m('ashgate-seal'),
          ' anywhere in the household inventory.',
        ),
      ),
      gmContentJson: doc(
        paragraph(
          'Osten suspected ',
          m('aldric'),
          ' of skimming the ferry tolls, but never lived to act on it. He never learned what was reopened beneath ',
          m('chapel-of-aurel'),
          ' either.',
        ),
      ),
    },
    {
      slug: 'iseult',
      entityType: 'character',
      publicContentJson: doc(
        paragraph(
          "Osten's only daughter, returned after a decade estranged. With the ",
          m('ashgate-seal'),
          ' missing and ',
          m('branwyn'),
          "'s claim backed by the ",
          m('order-of-the-lantern'),
          ', she needs it found before the guild convenes.',
        ),
      ),
    },
    {
      slug: 'aldric',
      entityType: 'character',
      gmContentJson: doc(
        paragraph(
          'Aldric has quietly served the ',
          m('hollow-choir'),
          ' for two years, skimming toll revenue to fund ',
          m('vessic'),
          "'s work in the ",
          m('the-hollow-beneath'),
          ' in exchange for promises the cult has no intention of keeping.',
        ),
      ),
    },
    {
      slug: 'vessic',
      entityType: 'character',
      gmContentJson: doc(
        paragraph(
          'Chapel records list a novice named Vessic who vanished during renovations decades ago. He never left — he found the ',
          m('the-hollow-beneath'),
          ' instead, and has read from the ',
          m('drowned-codex'),
          ' nightly ever since, worship of ',
          m('ylnathra'),
          ' quietly rebuilding around him.',
        ),
      ),
    },
    {
      slug: 'hollis',
      entityType: 'character',
      gmContentJson: doc(
        paragraph(
          'The ',
          m('grey-ferry-company'),
          "'s legitimate trade is real, but it's also the cover for smuggling goods past the town's tolls — ",
          m('kettle'),
          "'s caravan was one of Hollis's own shipments gone wrong, not bandit work at all.",
        ),
      ),
    },
    {
      slug: 'mira',
      entityType: 'character',
      gmContentJson: doc(
        paragraph(
          'Mira runs the actual logistics behind ',
          m('hollis'),
          "'s undeclared cargo — officially a fixer, unofficially the reason very little moves through ",
          m('ferrymens-docks'),
          " he doesn't already know about.",
        ),
      ),
    },
    {
      slug: 'kettle',
      entityType: 'character',
      publicContentJson: doc(
        paragraph(
          'Sole survivor of a caravan ambushed on ',
          m('north-ferry-road'),
          ". The manifest she kept doesn't match anything the ",
          m('grey-ferry-company'),
          ' has on its public books.',
        ),
      ),
    },
    {
      slug: 'the-hollow-beneath',
      entityType: 'location',
      gmContentJson: doc(
        paragraph(
          'Flooded crypts beneath ',
          m('chapel-of-aurel'),
          ', sealed since before ',
          m('house-ashgate'),
          ' ever ruled the crossing. ',
          m('vessic'),
          "'s ",
          m('hollow-choir'),
          ' has quietly reopened it, and ',
          m('the-coilback'),
          ' still guards its deepest chamber.',
        ),
      ),
    },
    {
      slug: 'hollow-choir',
      entityType: 'faction',
      gmContentJson: doc(
        paragraph(
          'Survivors of ',
          m('the-drowning'),
          "'s original cult, reassembling under ",
          m('vessic'),
          ' in the crypts beneath the chapel — using ',
          m('osten'),
          "'s death and the succession chaos it left behind as cover to finish whatever they're building down there.",
        ),
      ),
    },
  ];
}

export interface DemoPlotThreadStatusChange {
  slug: string;
  status: 'foreshadowed' | 'active' | 'dormant' | 'resolved' | 'abandoned';
}

/**
 * Status changes consistent with what the 5 completed sessions actually
 * resolved or advanced — `the-ashgate-succession` deliberately stays
 * `active`, not `resolved`, since the session that would resolve it (`The
 * Seal and the Choice`) is the one left `planned`. Threads not listed here
 * keep their creation-time default (`foreshadowed`), for genuine status
 * variety rather than escalating everything.
 */
export const DEMO_PLOT_THREAD_STATUS_CHANGES: DemoPlotThreadStatusChange[] = [
  { slug: 'the-ashgate-succession', status: 'active' },
  { slug: 'the-missing-caravan', status: 'resolved' },
  { slug: 'the-grey-ferry-conspiracy', status: 'active' },
  { slug: 'cult-beneath-ashgate', status: 'active' },
  { slug: 'foreign-interest-in-the-crossing', status: 'dormant' },
];

/**
 * The restore-beat target: a real bad edit (overwriting Maren's real
 * content with an obviously wrong placeholder), then a real restore back
 * to her original Phase-2 (GM-authored) revision —
 * `RevisionsService.restore()` always forces a new revision regardless of
 * timing (`entities.service.ts`'s `entitySnapshotToUpdateInput` reuses the
 * real `update()` path so tag sync/wiki-link refresh/tsvector rebuild all
 * happen for free on restore too).
 */
export const RESTORE_BEAT_ENTITY_SLUG = 'maren';
export const RESTORE_BEAT_ENTITY_TYPE: EntityType = 'character';
export const RESTORE_BEAT_BAD_CONTENT = doc(
  paragraph('placeholder — this edit should not survive the restore beat.'),
);
