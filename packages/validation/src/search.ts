import { z } from 'zod'

export const searchResourceTypeSchema = z.enum([
  'entity',
  'session',
  'plot_thread',
  'relationship',
  'timeline_event',
])
export type SearchResourceType = z.infer<typeof searchResourceTypeSchema>

/** Query params arrive as a single string, a comma-separated string, or
 * (when repeated, e.g. `?types=entity&types=session`) an array — normalize
 * all three into a string array before the enum check runs. */
function toArray(value: unknown): unknown {
  if (value === undefined) return undefined
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((piece) => piece.trim())
      .filter((piece) => piece.length > 0)
  }
  return value
}

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  types: z.preprocess(toArray, z.array(searchResourceTypeSchema)).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
})
export type SearchQuery = z.infer<typeof searchQuerySchema>
