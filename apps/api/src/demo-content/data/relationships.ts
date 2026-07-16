/**
 * Milestone 15 Phase 2 — "Ashgate Crossing" relationships. Built-in
 * relationship types have fixed, well-known ids (see
 * `apps/api/src/relationships/built-in-relationship-types.ts`) provisioned
 * for every campaign on creation — no lookup needed. Two custom types are
 * created by the orchestrator first; their real (generated) ids get
 * merged into the same key->id map before any relationship referencing
 * them is created.
 */

export const BUILT_IN_TYPE_IDS: Record<string, string> = {
  ally_of: '00000000-0000-0000-0000-000000000001',
  enemy_of: '00000000-0000-0000-0000-000000000002',
  rival_of: '00000000-0000-0000-0000-000000000003',
  married_to: '00000000-0000-0000-0000-000000000004',
  sibling_of: '00000000-0000-0000-0000-000000000005',
  parent_of: '00000000-0000-0000-0000-000000000006',
  mentor_of: '00000000-0000-0000-0000-000000000007',
  member_of: '00000000-0000-0000-0000-000000000008',
  leader_of: '00000000-0000-0000-0000-000000000009',
  owns: '00000000-0000-0000-0000-000000000010',
  located_in: '00000000-0000-0000-0000-000000000011',
  controls: '00000000-0000-0000-0000-000000000012',
  employed_by: '00000000-0000-0000-0000-000000000013',
  worships: '00000000-0000-0000-0000-000000000014',
};

export interface DemoCustomRelationshipType {
  key: string;
  forwardLabel: string;
  reverseLabel: string;
}

export const DEMO_CUSTOM_RELATIONSHIP_TYPES: DemoCustomRelationshipType[] = [
  {
    key: 'smuggles_for',
    forwardLabel: 'Smuggles for',
    reverseLabel: 'Receives smuggled goods from',
  },
  { key: 'guards', forwardLabel: 'Guards', reverseLabel: 'Guarded by' },
];

export interface DemoRelationship {
  source: string;
  target: string;
  typeKey: string;
  description?: string;
  visibility?: 'public' | 'gm_only';
}

export const DEMO_RELATIONSHIPS: DemoRelationship[] = [
  // --- Family / personal ---
  { source: 'osten', target: 'iseult', typeKey: 'parent_of' },
  {
    source: 'iseult',
    target: 'branwyn',
    typeKey: 'rival_of',
    description: "Openly contest each other's claim to Ashgate.",
  },
  { source: 'rosalind', target: 'iseult', typeKey: 'ally_of' },
  {
    source: 'rosalind',
    target: 'aldric',
    typeKey: 'rival_of',
    description: 'Professional friction between guard and steward.',
  },
  { source: 'maren', target: 'rosalind', typeKey: 'ally_of' },
  {
    source: 'mira',
    target: 'kettle',
    typeKey: 'ally_of',
    description: 'Mira has quietly helped Kettle since she stumbled into town.',
  },
  {
    source: 'iseult',
    target: 'kettle',
    typeKey: 'ally_of',
    description:
      "Iseult has taken a personal interest in Kettle's missing caravan.",
  },

  // --- House Ashgate ---
  { source: 'osten', target: 'house-ashgate', typeKey: 'leader_of' },
  { source: 'iseult', target: 'house-ashgate', typeKey: 'member_of' },
  { source: 'branwyn', target: 'house-ashgate', typeKey: 'member_of' },
  { source: 'aldric', target: 'house-ashgate', typeKey: 'employed_by' },
  { source: 'rosalind', target: 'house-ashgate', typeKey: 'employed_by' },
  { source: 'house-ashgate', target: 'ashgate-crossing', typeKey: 'controls' },
  { source: 'osten', target: 'ashgate-seal', typeKey: 'owns' },

  // --- Order of the Lantern / Draymoor ---
  { source: 'branwyn', target: 'order-of-the-lantern', typeKey: 'member_of' },
  { source: 'branwyn', target: 'order-of-the-lantern', typeKey: 'leader_of' },
  { source: 'order-of-the-lantern', target: 'draymoor', typeKey: 'controls' },

  // --- Grey Ferry Company / docks / river trade ---
  { source: 'hollis', target: 'grey-ferry-company', typeKey: 'leader_of' },
  { source: 'hollis', target: 'rivermerchants-guild', typeKey: 'member_of' },
  { source: 'hollis', target: 'rivermerchants-guild', typeKey: 'leader_of' },
  { source: 'mira', target: 'grey-ferry-company', typeKey: 'employed_by' },
  {
    source: 'grey-ferry-company',
    target: 'ferrymens-docks',
    typeKey: 'controls',
  },
  { source: 'kettle', target: 'kettles-manifest', typeKey: 'owns' },
  {
    source: 'mira',
    target: 'grey-ferry-company',
    typeKey: 'smuggles_for',
    description: "Runs the Company's undeclared cargo through the docks.",
    visibility: 'gm_only',
  },

  // --- The Hollow Choir (gm_only) ---
  {
    source: 'aldric',
    target: 'hollow-choir',
    typeKey: 'member_of',
    description: "The campaign's central hidden reveal.",
    visibility: 'gm_only',
  },
  {
    source: 'vessic',
    target: 'hollow-choir',
    typeKey: 'leader_of',
    visibility: 'gm_only',
  },
  {
    source: 'vessic',
    target: 'ylnathra',
    typeKey: 'worships',
    visibility: 'gm_only',
  },
  {
    source: 'vessic',
    target: 'drowned-codex',
    typeKey: 'owns',
    visibility: 'gm_only',
  },
  {
    source: 'vessic',
    target: 'the-hollow-beneath',
    typeKey: 'located_in',
    visibility: 'gm_only',
  },
  {
    source: 'the-coilback',
    target: 'the-hollow-beneath',
    typeKey: 'guards',
    visibility: 'gm_only',
  },
  {
    source: 'the-coilback',
    target: 'the-hollow-beneath',
    typeKey: 'located_in',
    visibility: 'gm_only',
  },
  {
    source: 'the-hollow-beneath',
    target: 'chapel-of-aurel',
    typeKey: 'located_in',
    visibility: 'gm_only',
  },
  {
    source: 'hollow-choir',
    target: 'house-ashgate',
    typeKey: 'enemy_of',
    description:
      'Unknown to House Ashgate, who has no idea it has an enemy at all.',
    visibility: 'gm_only',
  },

  // --- Public faith ---
  { source: 'thom', target: 'aurel', typeKey: 'worships' },

  // --- Everyday geography (located_in) ---
  { source: 'osten', target: 'ashgate-keep', typeKey: 'located_in' },
  { source: 'iseult', target: 'ashgate-keep', typeKey: 'located_in' },
  { source: 'branwyn', target: 'ashgate-keep', typeKey: 'located_in' },
  { source: 'aldric', target: 'ashgate-keep', typeKey: 'located_in' },
  { source: 'rosalind', target: 'ashgate-keep', typeKey: 'located_in' },
  { source: 'mira', target: 'ferrymens-docks', typeKey: 'located_in' },
  { source: 'hollis', target: 'ferrymens-docks', typeKey: 'located_in' },
  { source: 'maren', target: 'the-reedmarsh', typeKey: 'located_in' },
  { source: 'kettle', target: 'ashgate-crossing', typeKey: 'located_in' },
  { source: 'thom', target: 'chapel-of-aurel', typeKey: 'located_in' },
  { source: 'marsh-wraiths', target: 'the-reedmarsh', typeKey: 'located_in' },
  { source: 'ashgate-keep', target: 'ashgate-crossing', typeKey: 'located_in' },
  {
    source: 'chapel-of-aurel',
    target: 'ashgate-crossing',
    typeKey: 'located_in',
  },
  {
    source: 'ferrymens-docks',
    target: 'ashgate-crossing',
    typeKey: 'located_in',
  },
];
