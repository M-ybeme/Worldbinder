import { z } from 'zod'
import { worldDateSchema } from './calendar.js'

export const campaignNameSchema = z.string().trim().min(1).max(150)

export const createCampaignSchema = z.object({
  name: campaignNameSchema,
  description: z.string().trim().max(5000).optional(),
  systemName: z.string().trim().max(150).optional(),
})
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>

export const updateCampaignSchema = z.object({
  name: campaignNameSchema.optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  systemName: z.string().trim().max(150).nullable().optional(),
  settingsJson: z.record(z.string(), z.unknown()).nullable().optional(),
  currentWorldDateJson: worldDateSchema.nullable().optional(),
})
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>
