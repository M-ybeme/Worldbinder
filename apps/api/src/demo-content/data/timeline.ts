import { doc, paragraph } from '../tiptap';

export interface DemoTimelineEvent {
  slug: string;
  title: string;
  summary?: string;
  visibility?: 'public' | 'gm_only';
  datePrecision?: 'year' | 'month' | 'day';
  date?: { year: number; month?: number; day?: number; approximate?: boolean };
  entitySlugs?: string[];
  sessionSlugs?: string[];
  tags?: string[];
  contentJson?: ReturnType<typeof doc>;
}

/**
 * Milestone 15 Phase 2 — 14 timeline events (within §28's 10–15 band): 4
 * historical, 9 tied to the campaign's actual sessions, and 1 (the
 * founding) deliberately left undated — no `date`/`datePrecision` at all,
 * exercising the "Undated" section `createTimelineEventSchema` supports.
 */
export const DEMO_TIMELINE_EVENTS: DemoTimelineEvent[] = [
  // --- Historical (4) ---
  {
    slug: 'the-founding',
    title: 'The Founding of the Crossing',
    summary: 'The exact date the first ford settlement was built here is lost.',
    tags: ['history'],
    contentJson: doc(
      paragraph(
        'No record agrees on when the first ford settlement stood here — only that it did, long before House Ashgate.',
      ),
    ),
  },
  {
    slug: 'the-drowning-event',
    title: 'The Drowning',
    summary:
      'A catastrophic flood destroyed the settlement that stood here before House Ashgate.',
    visibility: 'gm_only',
    datePrecision: 'year',
    date: { year: 812, approximate: true },
    entitySlugs: ['the-drowning', 'ylnathra'],
    tags: ['history', 'cult'],
  },
  {
    slug: 'vessics-disappearance',
    title: 'Vessic Vanishes from Chapel Records',
    summary:
      'A young novice named Vessic disappears during chapel renovations.',
    visibility: 'gm_only',
    datePrecision: 'month',
    date: { year: 1207, month: 6 },
    entitySlugs: ['vessic'],
    tags: ['cult'],
  },
  {
    slug: 'the-ashgate-accord-event',
    title: 'The Ashgate Accord Signed',
    summary: 'The treaty granting the first Ashgate lord the ford.',
    datePrecision: 'year',
    date: { year: 1103 },
    entitySlugs: ['the-ashgate-accord', 'house-ashgate'],
    tags: ['history', 'house-ashgate'],
  },

  // --- Current campaign (9), day precision, tied to real sessions ---
  {
    slug: 'caravan-ambush',
    title: "Kettle's Caravan Vanishes",
    summary: 'A caravan on North Ferry Road disappears without a trace.',
    datePrecision: 'day',
    date: { year: 1247, month: 2, day: 27 },
    entitySlugs: ['kettle', 'north-ferry-road'],
    tags: ['missing-caravan'],
  },
  {
    slug: 'kettle-arrives-in-town',
    title: 'Kettle Arrives at the Crossing',
    summary: 'The sole survivor stumbles into Ashgate Crossing.',
    datePrecision: 'day',
    date: { year: 1247, month: 3, day: 2 },
    entitySlugs: ['kettle'],
    sessionSlugs: ['the-ferry-job'],
    tags: ['missing-caravan'],
  },
  {
    slug: 'iseult-returns',
    title: 'Lady Iseult Returns to the Crossing',
    summary: 'Iseult Ashgate returns after a decade estranged.',
    datePrecision: 'day',
    date: { year: 1247, month: 3, day: 5 },
    entitySlugs: ['iseult'],
    tags: ['succession'],
  },
  {
    slug: 'osten-collapses',
    title: "Osten's Health Worsens",
    summary: 'Lord Osten collapses in the great hall.',
    datePrecision: 'day',
    date: { year: 1247, month: 3, day: 9 },
    entitySlugs: ['osten'],
    sessionSlugs: ['old-blood-new-claims'],
    tags: ['succession'],
  },
  {
    slug: 'manifest-discovery',
    title: "Kettle's Manifest Doesn't Add Up",
    summary: 'The party traces the manifest to Grey Ferry Company warehouses.',
    datePrecision: 'day',
    date: { year: 1247, month: 3, day: 16 },
    entitySlugs: ['kettles-manifest', 'grey-ferry-company'],
    sessionSlugs: ['what-the-river-keeps'],
    tags: ['grey-ferry-conspiracy'],
  },
  {
    slug: 'marsh-wraith-encounter',
    title: 'Lights in the Reedmarsh',
    summary:
      'The party encounters marsh wraiths returning from the docks after dark.',
    datePrecision: 'day',
    date: { year: 1247, month: 3, day: 17 },
    entitySlugs: ['marsh-wraiths', 'the-reedmarsh'],
    sessionSlugs: ['what-the-river-keeps'],
    tags: ['reedmarsh'],
  },
  {
    slug: 'osten-dies',
    title: 'Lord Osten Ashgate Dies',
    summary: 'Osten dies before dawn, the succession still unresolved.',
    datePrecision: 'day',
    date: { year: 1247, month: 3, day: 23 },
    entitySlugs: ['osten'],
    sessionSlugs: ['the-lords-last-breath'],
    tags: ['succession'],
  },
  {
    slug: 'seal-goes-missing',
    title: 'The Ashgate Seal Is Missing',
    summary: 'The household inventory turns up no sign of the Seal.',
    datePrecision: 'day',
    date: { year: 1247, month: 3, day: 23 },
    entitySlugs: ['ashgate-seal', 'aldric'],
    sessionSlugs: ['the-lords-last-breath'],
    tags: ['succession'],
  },
  {
    slug: 'hollow-beneath-discovered',
    title: 'The Hollow Beneath Is Discovered',
    summary:
      'A search for the Seal uncovers flooded crypts beneath the chapel.',
    visibility: 'gm_only',
    datePrecision: 'day',
    date: { year: 1247, month: 3, day: 30 },
    entitySlugs: ['the-hollow-beneath', 'vessic'],
    sessionSlugs: ['beneath-the-chapel'],
    tags: ['cult'],
  },

  // --- One more current event (14th), after the last completed session ---
  {
    slug: 'the-funeral',
    title: "Lord Osten's Funeral",
    summary:
      'Ashgate Crossing buries its lord with the succession still undecided.',
    datePrecision: 'day',
    date: { year: 1247, month: 3, day: 26 },
    entitySlugs: ['osten', 'iseult', 'branwyn'],
    tags: ['succession'],
  },
];
