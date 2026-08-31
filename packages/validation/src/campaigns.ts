import { z } from 'zod'
import { calendarConfigSchema, worldDateSchema } from './calendar.js'

export const campaignNameSchema = z.string().trim().min(1).max(150)

export const createCampaignSchema = z.object({
  name: campaignNameSchema,
  description: z.string().trim().max(5000).optional(),
  systemName: z.string().trim().max(150).optional(),
})
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>

/** How the campaign's cover image (if any) is displayed behind the
 * Dashboard's content. `fit` mirrors CSS `object-fit`: 'cover' crops to
 * fill with no dead space, 'contain' shows the whole image (letterboxed),
 * 'stretch' fills by distorting aspect ratio. `zoom`/`focalX`/`focalY` let
 * the user pan/zoom within 'cover' fit; harmless no-ops under 'contain'/
 * 'stretch'. Opacity is capped below 1 so dashboard content stays legible
 * regardless of the source image (roadmap: "operational workspace, not a
 * fantasy character sheet"). */
export const dashboardBackdropFitSchema = z.enum(['cover', 'contain', 'stretch'])
export type DashboardBackdropFit = z.infer<typeof dashboardBackdropFitSchema>

export const dashboardBackdropConfigSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  fit: dashboardBackdropFitSchema,
  opacity: z.number().min(0).max(0.6),
  zoom: z.number().min(1).max(2.5),
  focalX: z.number().min(0).max(100),
  focalY: z.number().min(0).max(100),
})
export type DashboardBackdropConfig = z.infer<typeof dashboardBackdropConfigSchema>

export const DEFAULT_DASHBOARD_BACKDROP_CONFIG: DashboardBackdropConfig = {
  schemaVersion: 1,
  fit: 'cover',
  opacity: 0.25,
  zoom: 1,
  focalX: 50,
  focalY: 50,
}

export const updateCampaignSchema = z.object({
  name: campaignNameSchema.optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  systemName: z.string().trim().max(150).nullable().optional(),
  settingsJson: z.record(z.string(), z.unknown()).nullable().optional(),
  currentWorldDateJson: worldDateSchema.nullable().optional(),
  calendarConfigJson: calendarConfigSchema.nullable().optional(),
  dashboardBackdropJson: dashboardBackdropConfigSchema.nullable().optional(),
  coverAttachmentId: z.string().uuid().nullable().optional(),
})
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>
