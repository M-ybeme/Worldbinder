// A minimal but genuinely valid 1x1 PNG — same fixture bytes
// `apps/worker/src/imports/round-trip.integration.spec.ts` uses, so the
// worker's real magic-byte detection accepts it rather than rejecting a
// mislabeled/fake image (roadmap §16.2's real security boundary).
const VALID_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

const MANIFEST_MARKDOWN = Buffer.from(
  [
    "# Kettle's Manifest",
    '',
    '12 crates, marked "river salt" — weight and manifest seal do not match declared contents.',
    'Consigned to Grey Ferry Company, North Ferry Road route, third week of Rentaris.',
  ].join('\n'),
  'utf8',
);

export type DemoAttachmentLink =
  | { kind: 'entity'; slug: string }
  | { kind: 'session'; slug: string }
  | { kind: 'plot_thread'; slug: string }
  | { kind: 'map_image'; slug: string }
  | { kind: 'campaign_cover' };

export interface DemoAttachment {
  slug: string;
  filename: string;
  mimeType: 'image/png' | 'text/markdown';
  bytes: Buffer;
  link: DemoAttachmentLink;
  caption?: string;
}

/**
 * Milestone 15 Phase 2 — 6 attachments (§28's target), spanning every
 * attach point the app has: two map backgrounds (`imageAttachmentId`, set
 * via `PATCH .../maps/:id`, not the entity/session/plot_thread `link`
 * endpoint — maps aren't an `attachmentResourceType`), an entity portrait,
 * a plot-thread handout, a session image, and the campaign cover
 * (`coverAttachmentId`, also a direct `PATCH`, not `link`).
 */
export const DEMO_ATTACHMENTS: DemoAttachment[] = [
  {
    slug: 'town-map-background',
    filename: 'ashgate-crossing-town-map.png',
    mimeType: 'image/png',
    bytes: VALID_PNG,
    link: { kind: 'map_image', slug: 'ashgate-crossing-town-map' },
  },
  {
    slug: 'region-map-background',
    filename: 'the-ashgate-region.png',
    mimeType: 'image/png',
    bytes: VALID_PNG,
    link: { kind: 'map_image', slug: 'the-ashgate-region' },
  },
  {
    slug: 'osten-portrait',
    filename: 'lord-osten-ashgate.png',
    mimeType: 'image/png',
    bytes: VALID_PNG,
    link: { kind: 'entity', slug: 'osten' },
    caption: 'Lord Osten Ashgate, in healthier years.',
  },
  {
    slug: 'kettles-manifest-handout',
    filename: 'kettles-manifest.md',
    mimeType: 'text/markdown',
    bytes: MANIFEST_MARKDOWN,
    link: { kind: 'plot_thread', slug: 'the-missing-caravan' },
    caption: "Kettle's recovered manifest — a player handout.",
  },
  {
    slug: 'beneath-the-chapel-image',
    filename: 'the-hollow-beneath.png',
    mimeType: 'image/png',
    bytes: VALID_PNG,
    link: { kind: 'session', slug: 'beneath-the-chapel' },
    caption: 'The flooded crypts beneath the chapel altar.',
  },
  {
    slug: 'campaign-cover',
    filename: 'ashgate-crossing-cover.png',
    mimeType: 'image/png',
    bytes: VALID_PNG,
    link: { kind: 'campaign_cover' },
  },
];
