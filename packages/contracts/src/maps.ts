import type { EntityType, EntityVisibility } from './entities.js'

export interface MapSummary {
  id: string
  campaignId: string
  name: string
  description: string | null
  visibility: EntityVisibility
  /** Freshly signed on every request (~15min expiry), same pattern as
   * AttachmentSummary.downloadUrl — never persisted. Null until an image
   * has been uploaded and attached. */
  imageUrl: string | null
  /** From the underlying attachment's stored dimensions — lets the canvas
   * set a CSS aspect-ratio so pins stay aligned at any viewport width. */
  imageWidth: number | null
  imageHeight: number | null
  createdAt: string
  updatedAt: string
}

export interface MapLayerSummary {
  id: string
  mapId: string
  name: string
  displayOrder: number
  visibility: EntityVisibility
}

export interface MapPinSummary {
  id: string
  mapId: string
  layerId: string | null
  locationEntityId: string | null
  /** Denormalized so the canvas/accessible list don't need a per-pin
   * follow-up fetch — same reasoning as PlotThreadSummary.lastReferencedSession. */
  locationEntityName: string | null
  locationEntityType: EntityType | null
  label: string | null
  xNormalized: number
  yNormalized: number
  visibility: EntityVisibility
  createdAt: string
  updatedAt: string
}

export interface MapDetail extends MapSummary {
  layers: MapLayerSummary[]
  pins: MapPinSummary[]
}
