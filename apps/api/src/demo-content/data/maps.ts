export interface DemoMapPin {
  label?: string;
  locationSlug?: string;
  layerSlug?: string;
  x: number;
  y: number;
  visibility?: 'public' | 'gm_only';
}

export interface DemoMapLayer {
  slug: string;
  name: string;
  displayOrder: number;
  visibility?: 'public' | 'gm_only';
}

export interface DemoMap {
  slug: string;
  name: string;
  description?: string;
  layers: DemoMapLayer[];
  pins: DemoMapPin[];
}

/**
 * Milestone 15 Phase 2 — 2 maps (§28's exact target). The town map has a
 * public "Surface" layer and a `gm_only` "Hollow Beneath" layer, so the
 * demo shows layer-level visibility working, not just entity/relationship
 * visibility.
 */
export const DEMO_MAPS: DemoMap[] = [
  {
    slug: 'ashgate-crossing-town-map',
    name: 'Ashgate Crossing — Town Map',
    description: 'The town itself: the keep, the chapel, and the docks.',
    layers: [
      { slug: 'surface', name: 'Surface', displayOrder: 0 },
      {
        slug: 'hollow-beneath-layer',
        name: 'Hollow Beneath',
        displayOrder: 1,
        visibility: 'gm_only',
      },
    ],
    pins: [
      {
        label: 'Ashgate Keep',
        locationSlug: 'ashgate-keep',
        layerSlug: 'surface',
        x: 0.3,
        y: 0.25,
      },
      {
        label: 'Chapel of Aurel',
        locationSlug: 'chapel-of-aurel',
        layerSlug: 'surface',
        x: 0.55,
        y: 0.4,
      },
      {
        label: "Ferrymen's Docks",
        locationSlug: 'ferrymens-docks',
        layerSlug: 'surface',
        x: 0.45,
        y: 0.75,
      },
      { label: 'Market Square', layerSlug: 'surface', x: 0.5, y: 0.5 },
      {
        label: 'The Hollow Beneath',
        locationSlug: 'the-hollow-beneath',
        layerSlug: 'hollow-beneath-layer',
        x: 0.55,
        y: 0.42,
        visibility: 'gm_only',
      },
    ],
  },
  {
    slug: 'the-ashgate-region',
    name: 'The Ashgate Region',
    description:
      'The crossing and its surroundings — the road north, the marsh, and Draymoor.',
    layers: [{ slug: 'region-overview', name: 'Overview', displayOrder: 0 }],
    pins: [
      {
        label: 'Ashgate Crossing',
        locationSlug: 'ashgate-crossing',
        layerSlug: 'region-overview',
        x: 0.5,
        y: 0.6,
      },
      {
        label: 'Draymoor',
        locationSlug: 'draymoor',
        layerSlug: 'region-overview',
        x: 0.55,
        y: 0.15,
      },
      {
        label: 'North Ferry Road',
        locationSlug: 'north-ferry-road',
        layerSlug: 'region-overview',
        x: 0.52,
        y: 0.35,
      },
      {
        label: 'The Reedmarsh',
        locationSlug: 'the-reedmarsh',
        layerSlug: 'region-overview',
        x: 0.75,
        y: 0.65,
      },
    ],
  },
];
