import { doc, paragraph } from '../tiptap';

export interface DemoPlotThread {
  slug: string;
  title: string;
  summary?: string;
  importance?: 'minor' | 'standard' | 'major' | 'critical';
  visibility?: 'public' | 'gm_only';
  entitySlugs: string[];
  publicContentJson?: ReturnType<typeof doc>;
  gmContentJson?: ReturnType<typeof doc>;
}

/**
 * Milestone 15 Phase 2 — 7 plot threads (within §28's 6–10 band). Status
 * isn't settable at creation (`createPlotThreadSchema` has no `status`
 * field, defaults to `foreshadowed`) — the varied active/resolved/dormant
 * statuses planned for these get set in the Phase 3 revision pass instead,
 * as the second actor, so they produce genuine second revisions rather
 * than merging into the creation edit.
 */
export const DEMO_PLOT_THREADS: DemoPlotThread[] = [
  {
    slug: 'the-ashgate-succession',
    title: 'The Ashgate Succession',
    summary:
      'Osten is dying without a named heir, and Iseult and Branwyn both have real claims.',
    importance: 'major',
    entitySlugs: [
      'osten',
      'iseult',
      'branwyn',
      'ashgate-seal',
      'house-ashgate',
    ],
    publicContentJson: doc(
      paragraph(
        'Lord Osten Ashgate is failing, and has never named an heir between his estranged daughter and his knight-nephew. Whoever presents the Ashgate Seal to the chapel and the guild will be recognized as the next lord — assuming it can even be found.',
      ),
    ),
  },
  {
    slug: 'the-missing-caravan',
    title: 'The Missing Caravan',
    summary:
      'A caravan vanished on North Ferry Road, leaving only its guard and its manifest behind.',
    importance: 'standard',
    entitySlugs: [
      'kettle',
      'north-ferry-road',
      'kettles-manifest',
      'grey-ferry-company',
    ],
    publicContentJson: doc(
      paragraph(
        "Kettle Underhollow walked into Ashgate Crossing alone, the only survivor of a caravan that should never have run into trouble on a well-traveled road. The manifest she kept doesn't match anything the Grey Ferry Company has on its books.",
      ),
    ),
  },
  {
    slug: 'the-grey-ferry-conspiracy',
    title: 'The Grey Ferry Conspiracy',
    summary:
      "The Grey Ferry Company's legitimate trade is covering for a smuggling operation.",
    importance: 'major',
    visibility: 'gm_only',
    entitySlugs: ['grey-ferry-company', 'hollis', 'mira', 'ferrymens-docks'],
    gmContentJson: doc(
      paragraph(
        "Hollis Grey's river-trade empire is real, but so is the undeclared cargo moving under it, with Mira Talbot running the actual logistics. Kettle's caravan was one of Hollis's own shipments gone wrong, not bandit work at all.",
      ),
    ),
  },
  {
    slug: 'cult-beneath-ashgate',
    title: 'Cult Beneath Ashgate',
    summary:
      'The Hollow Choir has quietly reopened the crypts beneath the Chapel of Aurel.',
    importance: 'critical',
    visibility: 'gm_only',
    entitySlugs: [
      'vessic',
      'the-hollow-beneath',
      'drowned-codex',
      'hollow-choir',
    ],
    gmContentJson: doc(
      paragraph(
        "Prior Vessic never left the chapel after his disappearance decades ago — he found the Hollow Beneath instead, and has spent years rebuilding worship of Yl'nathra in the crypts beneath Deacon Thom's own floor.",
      ),
    ),
  },
  {
    slug: 'stewards-betrayal',
    title: "Steward's Betrayal",
    summary:
      'Aldric Penn is feeding the Hollow Choir information and toll revenue.',
    importance: 'standard',
    visibility: 'gm_only',
    entitySlugs: ['aldric', 'hollow-choir'],
    gmContentJson: doc(
      paragraph(
        'Aldric has quietly served the Hollow Choir for two years, skimming toll revenue to fund it in exchange for promises the cult has no intention of keeping. Nobody at the keep suspects him — least of all Osten.',
      ),
    ),
  },
  {
    slug: 'foreign-interest-in-the-crossing',
    title: 'Foreign Interest in the Crossing',
    summary: "Draymoor has quietly backed Branwyn's claim for its own reasons.",
    importance: 'minor',
    entitySlugs: ['draymoor', 'rivermerchants-guild', 'branwyn'],
    publicContentJson: doc(
      paragraph(
        "Draymoor has coveted the river-ford for two generations, and the Order of the Lantern's support for Branwyn's claim is no coincidence — a friendlier lord at Ashgate Crossing would suit Draymoor's river trade very well.",
      ),
    ),
  },
  {
    slug: 'the-drowned-gods-return',
    title: "The Drowned God's Return",
    summary:
      'Something that survived the Drowning still lives beneath the chapel.',
    importance: 'critical',
    visibility: 'gm_only',
    entitySlugs: ['ylnathra', 'the-coilback', 'the-drowning'],
    gmContentJson: doc(
      paragraph(
        "The Drowning was never just a flood — it was Yl'nathra's doing, and the Hollow Choir never stopped believing it would happen again. The Coilback guarding the Hollow Beneath's deepest chamber is proof something down there survived.",
      ),
    ),
  },
];
