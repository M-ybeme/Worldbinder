import type { EntityType } from '@worldbinder/contracts';
import { doc, heading, paragraph } from '../tiptap';
import { ref } from '../refs';

export interface DemoEntity {
  slug: string;
  entityType: EntityType;
  name: string;
  summary?: string;
  visibility?: 'public' | 'gm_only';
  tags?: string[];
  metadata?: Record<string, unknown>;
  publicContentJson?: ReturnType<typeof doc>;
  gmContentJson?: ReturnType<typeof doc>;
}

/**
 * Milestone 15 Phase 2 — "Ashgate Crossing" demo campaign entities.
 * Ordered so every metadata cross-reference (currentLocationEntityId,
 * leaderEntityId, questGiverEntityId, ...) points at a slug created
 * earlier in this same array: locations -> characters -> factions/orgs ->
 * items/deities/creatures/events/quests/lore/custom. The orchestrator
 * creates entities in this order and resolves `ref()` markers against the
 * slug->id map built up so far — see `refs.ts`.
 */
export const DEMO_ENTITIES: DemoEntity[] = [
  // --- Locations (8) — parents before children ---
  {
    slug: 'ashgate-crossing',
    entityType: 'location',
    name: 'Ashgate Crossing',
    summary:
      "The last free river-ford town before the empire's crumbling border — a chokepoint every caravan, pilgrim, and smuggler has to pass through.",
    tags: ['town', 'river'],
    metadata: {
      locationType: 'town',
      population: 4200,
      government: 'Hereditary lordship',
    },
    publicContentJson: doc(
      paragraph(
        'A river-ford town built where the last stone bridge before the border still stands. Merchants, pilgrims, and refugees alike funnel through its gates, which has made House Ashgate rich — and made the town a prize worth fighting over.',
      ),
      paragraph(
        "The town centers on three landmarks: Ashgate Keep on the bluff above the water, the Chapel of Aurel by the market square, and the Ferrymen's Docks below the old bridge.",
      ),
    ),
  },
  {
    slug: 'ashgate-keep',
    entityType: 'location',
    name: 'Ashgate Keep',
    summary: 'The fortified seat of House Ashgate, overlooking the river-ford.',
    tags: ['keep', 'noble-seat'],
    metadata: {
      locationType: 'keep',
      parentLocationEntityId: ref('ashgate-crossing'),
      population: 90,
    },
    publicContentJson: doc(
      paragraph(
        'A blunt, unlovely fortress of grey river-stone, built for defense rather than display. Lord Osten Ashgate has ruled from here for thirty years, and his household has grown thin and quiet around his failing health.',
      ),
    ),
  },
  {
    slug: 'chapel-of-aurel',
    entityType: 'location',
    name: 'Chapel of Aurel',
    summary:
      "The town's public house of worship, dedicated to Aurel the Lightbringer.",
    tags: ['chapel', 'religious'],
    metadata: {
      locationType: 'chapel',
      parentLocationEntityId: ref('ashgate-crossing'),
      population: 12,
    },
    publicContentJson: doc(
      paragraph(
        'A modest sandstone chapel built directly atop the ruins of something much older — a fact the current clergy has never much dwelt on. Deacon Thom Aldery keeps it swept, lit, and welcoming to anyone the crossing brings through.',
      ),
    ),
  },
  {
    slug: 'ferrymens-docks',
    entityType: 'location',
    name: "Ferrymen's Docks",
    summary:
      'The working waterfront below the old bridge, where the river trade actually happens.',
    tags: ['docks', 'trade'],
    metadata: {
      locationType: 'docks',
      parentLocationEntityId: ref('ashgate-crossing'),
      population: 260,
    },
    publicContentJson: doc(
      paragraph(
        "Warehouses, net-sheds, and the Grey Ferry Company's counting-house crowd the waterfront below the bridge. Half the town's income moves through here, and — if the rumors Mira Talbot keeps denying are true — so does quite a bit that never gets declared.",
      ),
    ),
  },
  {
    slug: 'the-reedmarsh',
    entityType: 'location',
    name: 'The Reedmarsh',
    summary: 'Flooded lowland east of the crossing, avoided after dark.',
    tags: ['wilderness', 'marsh'],
    metadata: { locationType: 'marsh' },
    publicContentJson: doc(
      paragraph(
        'A wide belt of flooded reed-fen east of the crossing. Locals fish its margins by day and stay well clear of the deep channels by night, when the marsh-lights start moving against the wind.',
      ),
    ),
  },
  {
    slug: 'north-ferry-road',
    entityType: 'location',
    name: 'North Ferry Road',
    summary: 'The trade road running north from the crossing toward Draymoor.',
    tags: ['road'],
    metadata: { locationType: 'road' },
    publicContentJson: doc(
      paragraph(
        'A rutted trade road climbing north out of the crossing toward Draymoor, exposed and poorly patrolled for the last stretch before the old milestone marker.',
      ),
    ),
  },
  {
    slug: 'draymoor',
    entityType: 'location',
    name: 'Draymoor',
    summary:
      "A larger rival town a day's ride north, with its own ambitions on the river trade.",
    tags: ['town', 'rival'],
    metadata: {
      locationType: 'town',
      population: 9000,
      government: 'Merchant council',
    },
    publicContentJson: doc(
      paragraph(
        "Bigger and richer than Ashgate Crossing, Draymoor has coveted the river-ford for two generations and backs its preferred claimant to House Ashgate's seat every chance it gets — never quite openly enough to be called an act of war.",
      ),
    ),
  },
  {
    slug: 'the-hollow-beneath',
    entityType: 'location',
    name: 'The Hollow Beneath',
    summary:
      'A flooded crypt system beneath the Chapel of Aurel, older than the chapel itself.',
    visibility: 'gm_only',
    tags: ['hidden', 'ruins'],
    metadata: {
      locationType: 'ruins',
      parentLocationEntityId: ref('chapel-of-aurel'),
    },
    gmContentJson: doc(
      paragraph(
        "A flooded crypt complex beneath the chapel's foundations, sealed since before House Ashgate ever ruled the crossing. The Hollow Choir has quietly reopened it. Something down here survived the Drowning.",
      ),
    ),
  },

  // --- Characters (11) ---
  {
    slug: 'osten',
    entityType: 'character',
    name: 'Lord Osten Ashgate',
    summary: 'The dying lord of Ashgate Crossing.',
    tags: ['noble', 'house-ashgate'],
    metadata: {
      lifeStatus: 'alive',
      occupation: 'Lord of Ashgate Crossing',
      currentLocationEntityId: ref('ashgate-keep'),
    },
    publicContentJson: doc(
      paragraph(
        "Thirty years Lord of Ashgate Crossing, Osten is failing fast — a wasting illness the chapel's healers can slow but not stop. He has not named an heir, and the town knows it.",
      ),
    ),
    gmContentJson: doc(
      paragraph(
        "Osten suspects Steward Aldric of skimming the ferry tolls, but has no proof and no strength left to investigate it himself. He genuinely does not know which of his two heirs would rule better — Iseult he trusts, Branwyn he's not sure he even knows anymore.",
      ),
    ),
  },
  {
    slug: 'iseult',
    entityType: 'character',
    name: 'Lady Iseult Ashgate',
    summary:
      "Osten's estranged daughter, returned to the crossing to press her claim.",
    tags: ['noble', 'house-ashgate', 'claimant'],
    metadata: {
      lifeStatus: 'alive',
      occupation: 'Claimant to Ashgate',
      currentLocationEntityId: ref('ashgate-keep'),
    },
    publicContentJson: doc(
      paragraph(
        "Osten's only daughter, estranged for a decade after a marriage her father refused to sanction. She has come back with her husband's name shed and a hard, practical eye for what the town actually needs.",
      ),
    ),
  },
  {
    slug: 'branwyn',
    entityType: 'character',
    name: 'Ser Branwyn Ashgate',
    summary:
      "Osten's knight-nephew, backed by outside interests for the succession.",
    tags: ['noble', 'house-ashgate', 'claimant'],
    metadata: {
      lifeStatus: 'alive',
      occupation: 'Knight, claimant to Ashgate',
      currentLocationEntityId: ref('ashgate-keep'),
    },
    publicContentJson: doc(
      paragraph(
        "Osten's nephew, raised half at Ashgate Keep and half in the Order of the Lantern's halls. Popular with the garrison, openly backed by interests in Draymoor who'd very much like a friendlier lord on the crossing.",
      ),
    ),
  },
  {
    slug: 'aldric',
    entityType: 'character',
    name: 'Steward Aldric Penn',
    summary:
      "Osten's household steward, quietly running the keep as the lord fades.",
    tags: ['steward', 'house-ashgate'],
    metadata: {
      lifeStatus: 'alive',
      occupation: 'Household steward',
      currentLocationEntityId: ref('ashgate-keep'),
    },
    publicContentJson: doc(
      paragraph(
        'A careful, colorless man who has run the day-to-day business of the keep for a decade, and never once been suspected of wanting more than that.',
      ),
    ),
    gmContentJson: doc(
      paragraph(
        "Aldric has been quietly feeding the Hollow Choir information and cover for two years, in exchange for a promise the cult has no intention of keeping. He is skimming toll revenue to fund it. His membership in the Choir is the campaign's central hidden reveal.",
      ),
    ),
  },
  {
    slug: 'rosalind',
    entityType: 'character',
    name: 'Captain Rosalind Vane',
    summary: 'Captain of the Ashgate town guard.',
    tags: ['guard', 'ally'],
    metadata: {
      lifeStatus: 'alive',
      occupation: 'Guard captain',
      currentLocationEntityId: ref('ashgate-keep'),
    },
    publicContentJson: doc(
      paragraph(
        'Blunt, competent, and increasingly worried — the guard is undermanned, the succession crisis is splitting loyalties in the barracks, and something has been killing livestock out past the Reedmarsh.',
      ),
    ),
  },
  {
    slug: 'mira',
    entityType: 'character',
    name: 'Mira Talbot',
    summary: 'A fixer who moves goods — and information — through the docks.',
    tags: ['docks', 'fixer'],
    metadata: {
      lifeStatus: 'alive',
      occupation: 'Fixer',
      currentLocationEntityId: ref('ferrymens-docks'),
    },
    publicContentJson: doc(
      paragraph(
        "Mira knows everyone at the docks and owes favors to most of them. Officially she brokers cargo space. Unofficially, very little moves through Ferrymen's Docks she doesn't know about first.",
      ),
    ),
  },
  {
    slug: 'hollis',
    entityType: 'character',
    name: 'Hollis Grey',
    summary:
      'Owner of the Grey Ferry Company — publicly a trade magnate, privately a smuggler.',
    tags: ['docks', 'merchant'],
    metadata: {
      lifeStatus: 'alive',
      occupation: 'Company owner',
      currentLocationEntityId: ref('ferrymens-docks'),
    },
    publicContentJson: doc(
      paragraph(
        "Hollis built the Grey Ferry Company from a single barge into the crossing's largest river-trade concern. Generous with the guild, well-liked at the docks, careful never to let anyone look too closely at his manifests.",
      ),
    ),
    gmContentJson: doc(
      paragraph(
        "The Grey Ferry Company's legitimate trade is real, but it's also the cover for smuggling goods — and people — past the town's tolls. Hollis is complicit, not a victim; Kettle's missing caravan was one of his shipments gone wrong.",
      ),
    ),
  },
  {
    slug: 'vessic',
    entityType: 'character',
    name: 'Prior Vessic',
    summary:
      'Leader of the Hollow Choir, once a chapel novice records claim vanished decades ago.',
    visibility: 'gm_only',
    tags: ['cult', 'hidden'],
    metadata: {
      lifeStatus: 'unknown',
      occupation: 'Cult leader',
      currentLocationEntityId: ref('the-hollow-beneath'),
    },
    gmContentJson: doc(
      paragraph(
        "Chapel records list a novice named Vessic who disappeared during renovations forty years ago. He never left — he found the Hollow Beneath instead, and has been patiently rebuilding the Hollow Choir's worship of Yl'nathra ever since.",
      ),
    ),
  },
  {
    slug: 'maren',
    entityType: 'character',
    name: 'Old Maren',
    summary:
      'A hedge-witch and lore-keeper living at the edge of the Reedmarsh.',
    tags: ['lore-keeper', 'reedmarsh'],
    metadata: {
      lifeStatus: 'alive',
      occupation: 'Hedge-witch',
      currentLocationEntityId: ref('the-reedmarsh'),
    },
    publicContentJson: doc(
      paragraph(
        "Maren has lived at the marsh's edge longer than anyone can account for, and remembers versions of the town's history that don't quite match the chapel's official ones — including what the old folk actually called the river, before Aurel's faith renamed everything it touched.",
      ),
    ),
  },
  {
    slug: 'kettle',
    entityType: 'character',
    name: 'Kettle Underhollow',
    summary: 'A halfling caravan guard, sole survivor of an ambushed shipment.',
    tags: ['survivor', 'caravan'],
    metadata: {
      lifeStatus: 'alive',
      occupation: 'Caravan guard',
      currentLocationEntityId: ref('ashgate-crossing'),
    },
    publicContentJson: doc(
      paragraph(
        "Kettle walked into town alone, half-starved, three days after the caravan she was guarding vanished on North Ferry Road. She's certain it wasn't bandits — bandits don't leave a manifest behind and take nothing else.",
      ),
    ),
  },
  {
    slug: 'thom',
    entityType: 'character',
    name: 'Deacon Thom Aldery',
    summary:
      "The chapel's public priest, entirely unaware of what lies beneath his own floor.",
    tags: ['clergy', 'chapel'],
    metadata: {
      lifeStatus: 'alive',
      occupation: 'Deacon',
      currentLocationEntityId: ref('chapel-of-aurel'),
    },
    publicContentJson: doc(
      paragraph(
        "A genuinely kind man who took the Chapel of Aurel's posting because he liked the idea of a crossing town's constant stream of strangers to minister to.",
      ),
    ),
    gmContentJson: doc(
      paragraph(
        "Thom has no idea Prior Vessic's name is even in the old chapel records, let alone what's moved back into the crypts below his own floor.",
      ),
    ),
  },

  // --- Factions (3) ---
  {
    slug: 'house-ashgate',
    entityType: 'faction',
    name: 'House Ashgate',
    summary:
      'The ruling house of Ashgate Crossing, now facing a contested succession.',
    tags: ['noble-house'],
    metadata: {
      factionType: 'noble house',
      leaderEntityId: ref('osten'),
      headquartersLocationEntityId: ref('ashgate-keep'),
    },
    publicContentJson: doc(
      paragraph(
        'House Ashgate has held the crossing for four generations, since the Ashgate Accord granted them the ford in exchange for keeping it open to imperial trade. That legitimacy is worth fighting over now that Osten is dying without a clear heir.',
      ),
    ),
  },
  {
    slug: 'grey-ferry-company',
    entityType: 'faction',
    name: 'The Grey Ferry Company',
    summary:
      "The crossing's largest river-trade concern — and a smuggling front.",
    tags: ['trade', 'docks'],
    metadata: {
      factionType: 'trade company',
      leaderEntityId: ref('hollis'),
      headquartersLocationEntityId: ref('ferrymens-docks'),
    },
    publicContentJson: doc(
      paragraph(
        'A respected river-trade company with barges running the length of the border river. Publicly a guild success story; privately, the mechanism by which a great deal of undeclared cargo crosses the ford.',
      ),
    ),
  },
  {
    slug: 'hollow-choir',
    entityType: 'faction',
    name: 'The Hollow Choir',
    summary: 'A drowned-god cult quietly rebuilding itself beneath the chapel.',
    visibility: 'gm_only',
    tags: ['cult', 'hidden'],
    metadata: {
      factionType: 'cult',
      leaderEntityId: ref('vessic'),
      headquartersLocationEntityId: ref('the-hollow-beneath'),
    },
    gmContentJson: doc(
      paragraph(
        "Survivors of the Drowning's original cult, scattered for generations, now reassembling under Prior Vessic in the crypts beneath the Chapel of Aurel. They need the succession crisis's chaos as cover to finish whatever they're building down there.",
      ),
    ),
  },

  // --- Organizations (2) ---
  {
    slug: 'rivermerchants-guild',
    entityType: 'organization',
    name: "Rivermerchants' Guild",
    summary: 'The trade guild regulating river commerce through the crossing.',
    tags: ['guild', 'trade'],
    metadata: {
      organizationType: 'guild',
      leaderEntityId: ref('hollis'),
      headquartersLocationEntityId: ref('ferrymens-docks'),
    },
    publicContentJson: doc(
      paragraph(
        'The guild that sets tolls and settles disputes for every barge that passes the ford. Hollis Grey has chaired it for three years running, which not everyone finds reassuring in hindsight.',
      ),
    ),
  },
  {
    slug: 'order-of-the-lantern',
    entityType: 'organization',
    name: 'Order of the Lantern',
    summary:
      "A knightly order out of Draymoor, backing Branwyn's claim to Ashgate.",
    tags: ['knightly-order', 'draymoor'],
    metadata: {
      organizationType: 'knightly order',
      leaderEntityId: ref('branwyn'),
      headquartersLocationEntityId: ref('draymoor'),
    },
    publicContentJson: doc(
      paragraph(
        'A Draymoor-based order that trained Branwyn and has thrown its considerable weight behind his claim — officially out of loyalty, unofficially because a lord of their own choosing on the crossing would suit Draymoor very well.',
      ),
    ),
  },

  // --- Items (3) ---
  {
    slug: 'ashgate-seal',
    entityType: 'item',
    name: 'The Ashgate Seal',
    summary: 'The signet that legitimizes whoever holds it as Lord of Ashgate.',
    tags: ['heirloom', 'succession'],
    metadata: {
      itemType: 'signet',
      rarity: 'unique',
      currentOwnerEntityId: ref('osten'),
      currentLocationEntityId: ref('ashgate-keep'),
    },
    publicContentJson: doc(
      paragraph(
        'Granted to the first Ashgate lord by the Accord itself. Whoever presents it to the chapel and the guild together is recognized as the rightful heir — which is exactly why both Iseult and Branwyn need to know where it will end up.',
      ),
    ),
  },
  {
    slug: 'drowned-codex',
    entityType: 'item',
    name: 'The Drowned Codex',
    summary: 'A waterlogged religious text recovered from the Hollow Beneath.',
    visibility: 'gm_only',
    tags: ['cult', 'hidden'],
    metadata: {
      itemType: 'book',
      rarity: 'unique',
      currentOwnerEntityId: ref('vessic'),
      currentLocationEntityId: ref('the-hollow-beneath'),
    },
    gmContentJson: doc(
      paragraph(
        "The Hollow Choir's liturgy, older than the chapel built over its hiding place. Vessic reads from it nightly. Old Maren would recognize some of its older names for the river immediately.",
      ),
    ),
  },
  {
    slug: 'kettles-manifest',
    entityType: 'item',
    name: "Kettle's Manifest",
    summary:
      'The cargo manifest from the ambushed caravan — evidence the Grey Ferry Company would rather see burned.',
    tags: ['evidence'],
    metadata: {
      itemType: 'document',
      rarity: 'common',
      currentOwnerEntityId: ref('kettle'),
      currentLocationEntityId: ref('ashgate-crossing'),
    },
    publicContentJson: doc(
      paragraph(
        "A cargo manifest Kettle kept hold of when the rest of the caravan vanished. The listed goods don't match anything the Grey Ferry Company has on its public books.",
      ),
    ),
  },

  // --- Deities (2) ---
  {
    slug: 'aurel',
    entityType: 'deity',
    name: 'Aurel the Lightbringer',
    summary: 'The public faith of Ashgate Crossing, worshipped at the chapel.',
    tags: ['faith'],
    metadata: {
      domains: ['light', 'travelers', 'honest trade'],
      alignment: 'Lawful good',
      symbol: 'A rising sun over water',
    },
    publicContentJson: doc(
      paragraph(
        "Patron of travelers and honest trade, fittingly worshipped at a crossing town. Aurel's faith is mild, practical, and mostly concerned with safe passage and fair dealing — exactly the god a ford town would adopt.",
      ),
    ),
  },
  {
    slug: 'ylnathra',
    entityType: 'deity',
    name: "Yl'nathra, the Drowned God",
    summary:
      'A pre-Ashgate river deity, worshipped in secret by the Hollow Choir.',
    visibility: 'gm_only',
    tags: ['cult', 'hidden'],
    metadata: {
      domains: ['the deep river', 'drowning', 'what waits below'],
      alignment: 'Unknown',
      symbol: 'A closed eye beneath still water',
    },
    gmContentJson: doc(
      paragraph(
        "Worshipped along this stretch of river long before Aurel's faith arrived, and blamed — accurately, per the Drowned Codex — for the Drowning itself. The Hollow Choir never stopped believing it would return.",
      ),
    ),
  },

  // --- Creatures (2) ---
  {
    slug: 'marsh-wraiths',
    entityType: 'creature',
    name: 'Marsh Wraiths',
    summary: 'Lights and shapes seen moving through the Reedmarsh after dark.',
    tags: ['reedmarsh', 'undead'],
    metadata: {
      creatureType: 'undead',
      habitat: 'The Reedmarsh',
      threatLevel: 'Moderate',
    },
    publicContentJson: doc(
      paragraph(
        'Drifting lights and half-glimpsed shapes that lead travelers off the safe paths through the Reedmarsh. Locals give them a wide berth rather than a name.',
      ),
    ),
  },
  {
    slug: 'the-coilback',
    entityType: 'creature',
    name: 'The Coilback',
    summary:
      'Something large that guards the deepest chamber of the Hollow Beneath.',
    visibility: 'gm_only',
    tags: ['hidden', 'guardian'],
    metadata: {
      creatureType: 'aberration',
      habitat: 'The Hollow Beneath',
      threatLevel: 'Severe',
    },
    gmContentJson: doc(
      paragraph(
        'Whatever survived the Drowning down here, the Hollow Choir has never controlled it so much as fed it and stayed out of its way. It guards the deepest chamber without needing to be told to.',
      ),
    ),
  },

  // --- Events (2, historical) ---
  {
    slug: 'the-drowning',
    entityType: 'event',
    name: 'The Drowning',
    summary:
      "The catastrophic flood, generations past, that gave Yl'nathra's cult its name and its grievance.",
    visibility: 'gm_only',
    tags: ['history', 'cult'],
    metadata: {
      eventType: 'catastrophe',
      locationEntityId: ref('the-hollow-beneath'),
    },
    gmContentJson: doc(
      paragraph(
        "Long before House Ashgate held the ford, a flood drowned the settlement that stood here, and the cult that worshipped Yl'nathra along with it. The current chapel — and the Accord that founded House Ashgate's rule — was built directly on top of the memory.",
      ),
    ),
  },
  {
    slug: 'the-ashgate-accord',
    entityType: 'event',
    name: 'The Ashgate Accord',
    summary:
      'The treaty granting the first Ashgate lord the ford, four generations ago.',
    tags: ['history', 'house-ashgate'],
    metadata: { eventType: 'treaty', locationEntityId: ref('ashgate-keep') },
    publicContentJson: doc(
      paragraph(
        "The founding document of House Ashgate's rule, granting the crossing in exchange for keeping it open to imperial trade — and the origin of the Ashgate Seal's authority.",
      ),
    ),
  },

  // --- Quests (3) ---
  {
    slug: 'find-the-missing-caravan',
    entityType: 'quest',
    name: 'Find the Missing Caravan',
    summary:
      'Kettle needs help learning what really happened to her caravan on North Ferry Road.',
    tags: ['quest'],
    metadata: {
      questType: 'investigation',
      questStatus: 'completed',
      questGiverEntityId: ref('kettle'),
    },
    publicContentJson: doc(
      paragraph(
        "Kettle Underhollow is offering what little coin she has left to anyone willing to find out what happened to the caravan she was guarding — and why the only thing left behind was a manifest that doesn't add up.",
      ),
    ),
  },
  {
    slug: 'recover-the-ashgate-seal',
    entityType: 'quest',
    name: 'Recover the Ashgate Seal',
    summary: 'The Ashgate Seal has gone missing at the worst possible moment.',
    tags: ['quest', 'succession'],
    metadata: {
      questType: 'retrieval',
      questStatus: 'active',
      questGiverEntityId: ref('iseult'),
    },
    publicContentJson: doc(
      paragraph(
        "With Osten failing, the Ashgate Seal needs to be accounted for — and it isn't where the household records say it should be. Iseult wants it found before Branwyn's allies can claim it went missing on her watch.",
      ),
    ),
  },
  {
    slug: 'silence-beneath',
    entityType: 'quest',
    name: 'Silence Beneath',
    summary:
      "Captain Vane wants to know what's really happening under the chapel.",
    visibility: 'gm_only',
    tags: ['quest', 'hidden'],
    metadata: {
      questType: 'investigation',
      questStatus: 'active',
      questGiverEntityId: ref('rosalind'),
    },
    gmContentJson: doc(
      paragraph(
        "Rosalind has noticed Deacon Thom's chapel accounts don't match its foot traffic, and wants someone she trusts to quietly look into what's actually going on beneath it before she takes it to a steward she's starting to distrust.",
      ),
    ),
  },

  // --- Lore (2) ---
  {
    slug: 'faiths-of-the-crossing',
    entityType: 'lore',
    name: 'Faiths of the Crossing',
    summary:
      "A brief survey of what the crossing's residents actually believe.",
    tags: ['religion'],
    metadata: { loreCategory: 'religion' },
    publicContentJson: doc(
      paragraph(
        "Aurel's faith is the only one with a chapel, but river towns keep older habits alive in small ways — coins left at the waterline, doors that don't face the water at night. Most residents would call themselves faithful to Aurel and still knock on wood by the river.",
      ),
    ),
  },
  {
    slug: 'the-rivers-old-names',
    entityType: 'lore',
    name: "The River's Old Names",
    summary:
      "Old Maren remembers what the river was called before Aurel's faith renamed it.",
    tags: ['history', 'reedmarsh'],
    metadata: { loreCategory: 'history' },
    publicContentJson: doc(
      paragraph(
        'Every river town has a "old name" nobody quite uses anymore. Old Maren still does, and refuses to explain why in front of anyone from the chapel.',
      ),
    ),
  },

  // --- Custom (1) ---
  {
    slug: 'house-ashgate-heraldry',
    entityType: 'custom',
    name: 'House Ashgate Heraldry',
    summary:
      "A structured reference for House Ashgate's arms and household colors.",
    tags: ['reference', 'house-ashgate'],
    metadata: {
      fields: {
        blazon: 'A grey tower on blue, over a silver wave',
        colors: ['slate grey', 'river blue', 'silver'],
        motto: 'Steady as the Ford',
      },
    },
    publicContentJson: doc(
      heading('Arms'),
      paragraph('A grey tower on blue, over a silver wave.'),
      heading('Motto'),
      paragraph('"Steady as the Ford."'),
    ),
  },
];
