import { doc, paragraph } from '../tiptap';

export interface DemoSession {
  slug: string;
  title: string;
  worldStartDate: { year: number; month: number; day: number };
  worldEndDate?: { year: number; month: number; day: number };
  featuredEntitySlugs: string[];
  locationEntitySlugs: string[];
  plotThreadChanges: {
    threadSlug: string;
    action: 'introduced' | 'advanced' | 'resolved';
  }[];
  plannedContentJson: ReturnType<typeof doc>;
  recapContentJson?: ReturnType<typeof doc>;
  reveal?: string;
  complete: boolean;
}

/**
 * Milestone 15 Phase 2 — 6 sessions (within §28's 4–6 band), 5 completed
 * with recaps and 1 left `planned` to demonstrate that state. Session 5
 * reveals `the-hollow-beneath` to players at the exact narrative moment
 * it's discovered, via the real `.../sessions/:id/reveals` endpoint.
 */
export const DEMO_SESSIONS: DemoSession[] = [
  {
    slug: 'the-ferry-job',
    title: 'The Ferry Job',
    worldStartDate: { year: 1247, month: 3, day: 2 },
    worldEndDate: { year: 1247, month: 3, day: 2 },
    featuredEntitySlugs: ['kettle', 'mira'],
    locationEntitySlugs: ['ferrymens-docks'],
    plotThreadChanges: [
      { threadSlug: 'the-missing-caravan', action: 'introduced' },
    ],
    plannedContentJson: doc(
      paragraph(
        'Introduce Kettle Underhollow at the docks and the mystery of her missing caravan.',
      ),
    ),
    recapContentJson: doc(
      paragraph(
        "The party found Kettle at the docks, half-starved and certain the caravan's disappearance wasn't bandit work. Mira Talbot pointed them toward North Ferry Road.",
      ),
    ),
    complete: true,
  },
  {
    slug: 'old-blood-new-claims',
    title: 'Old Blood, New Claims',
    worldStartDate: { year: 1247, month: 3, day: 9 },
    worldEndDate: { year: 1247, month: 3, day: 9 },
    featuredEntitySlugs: ['osten', 'iseult', 'branwyn'],
    locationEntitySlugs: ['ashgate-keep'],
    plotThreadChanges: [
      { threadSlug: 'the-ashgate-succession', action: 'introduced' },
    ],
    plannedContentJson: doc(
      paragraph(
        "Introduce the succession crisis at the keep — Osten's health, Iseult's return, Branwyn's backers.",
      ),
    ),
    recapContentJson: doc(
      paragraph(
        'An audience at the keep made the succession crisis impossible to ignore — Osten visibly failing, Iseult and Branwyn barely speaking to each other across the hall.',
      ),
    ),
    complete: true,
  },
  {
    slug: 'what-the-river-keeps',
    title: 'What the River Keeps',
    worldStartDate: { year: 1247, month: 3, day: 16 },
    worldEndDate: { year: 1247, month: 3, day: 17 },
    featuredEntitySlugs: ['hollis', 'mira'],
    locationEntitySlugs: ['ferrymens-docks', 'the-reedmarsh'],
    plotThreadChanges: [
      { threadSlug: 'the-grey-ferry-conspiracy', action: 'advanced' },
    ],
    plannedContentJson: doc(
      paragraph(
        'Follow the manifest discrepancy toward the Grey Ferry Company; a marsh-wraith encounter on the way back.',
      ),
    ),
    recapContentJson: doc(
      paragraph(
        "Tracing the manifest led straight to Grey Ferry Company warehouses that don't match Hollis's public books. Returning after dark, the party ran into marsh-lights at the Reedmarsh's edge and got out with a healthy respect for the wraiths.",
      ),
    ),
    complete: true,
  },
  {
    slug: 'the-lords-last-breath',
    title: "The Lord's Last Breath",
    worldStartDate: { year: 1247, month: 3, day: 23 },
    worldEndDate: { year: 1247, month: 3, day: 23 },
    featuredEntitySlugs: ['osten', 'aldric'],
    locationEntitySlugs: ['ashgate-keep'],
    plotThreadChanges: [
      { threadSlug: 'the-ashgate-succession', action: 'advanced' },
    ],
    plannedContentJson: doc(paragraph("Osten's illness reaches its end.")),
    recapContentJson: doc(
      paragraph(
        'Lord Osten Ashgate died before dawn. Aldric handled the arrangements with unsettling composure. The Ashgate Seal is nowhere in the household inventory.',
      ),
    ),
    complete: true,
  },
  {
    slug: 'beneath-the-chapel',
    title: 'Beneath the Chapel',
    worldStartDate: { year: 1247, month: 3, day: 30 },
    worldEndDate: { year: 1247, month: 3, day: 30 },
    featuredEntitySlugs: ['thom', 'vessic'],
    locationEntitySlugs: ['chapel-of-aurel', 'the-hollow-beneath'],
    plotThreadChanges: [
      { threadSlug: 'cult-beneath-ashgate', action: 'advanced' },
    ],
    plannedContentJson: doc(
      paragraph(
        'A search for the Seal leads under the chapel — reveal the Hollow Beneath to the players here.',
      ),
    ),
    recapContentJson: doc(
      paragraph(
        "A loose flagstone behind the chapel altar led down into flooded crypts nobody at the chapel knew existed. Deacon Thom is still refusing to believe it. Whatever's living down there, it isn't alone.",
      ),
    ),
    reveal: 'the-hollow-beneath',
    complete: true,
  },
  {
    slug: 'the-seal-and-the-choice',
    title: 'The Seal and the Choice',
    worldStartDate: { year: 1247, month: 4, day: 6 },
    featuredEntitySlugs: ['iseult', 'branwyn'],
    locationEntitySlugs: ['ashgate-keep'],
    plotThreadChanges: [],
    plannedContentJson: doc(
      paragraph(
        'Whoever holds the Seal when the guild convenes decides the succession. Not yet run.',
      ),
    ),
    complete: false,
  },
];
