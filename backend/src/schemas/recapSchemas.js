import { z } from 'zod';

export const recapWindowTypes = [
  'LAST_N_MINUTES',
  'SINCE_SESSION_JOIN',
  'WHOLE_MATCH',
  'LAST_N_OVERS',
  'LAST_OVER'
];

export const recapToolTypes = [...recapWindowTypes, 'UNSUPPORTED'];

export const sessionRequestSchema = z.object({
  sessionId: z.string().uuid()
});

/**
 * The model may choose only a tool from this allow-list. The service validates
 * this parsed shape again before it resolves a delivery window.
 */
export const recapIntentSchema = z
  .object({
    tool: z.enum(recapToolTypes),
    minutes: z.number().int().min(1).max(180).nullable(),
    overs: z.number().int().min(1).max(20).nullable()
  })
  .superRefine((value, context) => {
    if (value.tool === 'LAST_N_MINUTES' && value.minutes === null) {
      context.addIssue({ code: 'custom', path: ['minutes'], message: 'minutes is required.' });
    }
    if (value.tool !== 'LAST_N_MINUTES' && value.minutes !== null) {
      context.addIssue({
        code: 'custom',
        path: ['minutes'],
        message: 'minutes is not applicable.'
      });
    }
    if (value.tool === 'LAST_N_OVERS' && value.overs === null) {
      context.addIssue({ code: 'custom', path: ['overs'], message: 'overs is required.' });
    }
    if (value.tool !== 'LAST_N_OVERS' && value.overs !== null) {
      context.addIssue({ code: 'custom', path: ['overs'], message: 'overs is not applicable.' });
    }
  });

export const recapNarrationSchema = z.object({
  headline: z.string().trim().min(1).max(180),
  summary: z.string().trim().min(1).max(1600),
  bullets: z.array(z.string().trim().min(1).max(320)).min(1).max(5)
});
