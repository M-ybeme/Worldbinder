import { z } from 'zod'

/**
 * A minimal, versioned in-world date shape — good enough to store, order,
 * and display a session's or campaign's current in-world date for v1.
 * Deliberately Gregorian-shaped (month 1-12) rather than validated against
 * a per-campaign custom calendar; Milestone 11 ("Timeline and Calendar")
 * owns real calendar settings and will extend/validate this properly.
 */
export const worldDateSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  label: z.string().trim().max(200).optional(),
})
export type WorldDate = z.infer<typeof worldDateSchema>
