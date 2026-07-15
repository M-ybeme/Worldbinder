import { z } from 'zod'
import { timelineDatePrecisionSchema, timelineDateSchema } from './calendar.js'
import { entityVisibilitySchema, tiptapDocSchema } from './entities.js'

const uuidField = z.string().uuid()

export const createTimelineEventSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    summary: z.string().trim().max(2000).optional(),
    contentJson: tiptapDocSchema.optional(),
    startDateJson: timelineDateSchema.nullable().optional(),
    endDateJson: timelineDateSchema.nullable().optional(),
    datePrecision: timelineDatePrecisionSchema.nullable().optional(),
    visibility: entityVisibilitySchema.optional(),
    entityIds: z.array(uuidField).optional(),
    sessionIds: z.array(uuidField).optional(),
    tags: z.array(z.string().trim().min(1).max(50)).optional(),
  })
  // An event is either undated (neither field set — the "Undated" section)
  // or dated (both set together); a date with no precision (or vice versa)
  // is meaningless.
  .refine((input) => (input.startDateJson == null) === (input.datePrecision == null), {
    message: 'startDateJson and datePrecision must be set together',
    path: ['datePrecision'],
  })
export type CreateTimelineEventInput = z.infer<typeof createTimelineEventSchema>

export const updateTimelineEventSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  summary: z.string().trim().max(2000).nullable().optional(),
  contentJson: tiptapDocSchema.nullable().optional(),
  startDateJson: timelineDateSchema.nullable().optional(),
  endDateJson: timelineDateSchema.nullable().optional(),
  datePrecision: timelineDatePrecisionSchema.nullable().optional(),
  visibility: entityVisibilitySchema.optional(),
  entityIds: z.array(uuidField).optional(),
  sessionIds: z.array(uuidField).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).optional(),
})
export type UpdateTimelineEventInput = z.infer<typeof updateTimelineEventSchema>

export const listTimelineEventsQuerySchema = z.object({
  entityId: uuidField.optional(),
  sessionId: uuidField.optional(),
  tag: z.string().trim().min(1).optional(),
})
export type ListTimelineEventsQuery = z.infer<typeof listTimelineEventsQuerySchema>
