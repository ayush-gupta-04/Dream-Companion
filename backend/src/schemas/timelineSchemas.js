import { z } from 'zod';

export const timelineEventTypes = [
  'WICKET',
  'FOUR',
  'SIX',
  'BATTER_MILESTONE',
  'PARTNERSHIP_MILESTONE',
  'MAIDEN_OVER',
  'EXPENSIVE_OVER',
  'SCORING_RATE_SHIFT'
];

export const timelineEventTypeSchema = z.enum(timelineEventTypes);

export const timelineImportanceLevels = ['MINOR', 'HIGHLIGHT', 'MAJOR'];
export const timelineImportanceLevelSchema = z.enum(timelineImportanceLevels);

function eventTypesQuerySchema() {
  return z
    .string()
    .trim()
    .min(1)
    .max(240)
    .optional()
    .transform((value, context) => {
      if (!value) return undefined;
      const types = value.split(',').map((type) => type.trim());
      for (const type of types) {
        if (!timelineEventTypeSchema.safeParse(type).success) {
          context.addIssue({
            code: 'custom',
            message: 'types contains an unsupported event type.'
          });
          return z.NEVER;
        }
      }
      return [...new Set(types)];
    });
}

export const timelineQuerySchema = z.object({
  innings: z.coerce.number().int().positive().optional(),
  types: eventTypesQuerySchema(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().trim().min(1).max(100).optional()
});

export const eventSearchQuerySchema = z
  .object({
    innings: z.coerce.number().int().positive().optional(),
    types: eventTypesQuerySchema(),
    playerId: z.string().trim().min(1).max(100).optional(),
    startSequence: z.coerce.number().int().positive().optional(),
    endSequence: z.coerce.number().int().positive().optional(),
    minimumImportance: timelineImportanceLevelSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().trim().min(1).max(100).optional()
  })
  .superRefine(({ innings, startSequence, endSequence }, context) => {
    if ((startSequence || endSequence) && !innings) {
      context.addIssue({
        code: 'custom',
        path: ['innings'],
        message: 'innings is required when filtering by delivery sequence.'
      });
    }
    if (startSequence && endSequence && startSequence > endSequence) {
      context.addIssue({
        code: 'custom',
        path: ['endSequence'],
        message: 'endSequence must not be before startSequence.'
      });
    }
  });

