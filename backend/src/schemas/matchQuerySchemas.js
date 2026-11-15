import { z } from 'zod';
import { timelineEventTypes, timelineImportanceLevels } from './timelineSchemas.js';
import { recapWindowTypes } from './recapSchemas.js';

export const analysisToolTypes = [
  'OVER_ANALYSIS',
  'PLAYER_ANALYSIS',
  'OVER_COMPARISON',
  'EVENT_SEARCH'
];

export const matchQueryToolTypes = [...analysisToolTypes, ...recapWindowTypes, 'UNSUPPORTED'];

export const matchQueryRequestSchema = z
  .object({
    query: z.string().trim().min(3).max(500),
    sessionId: z.string().uuid().optional()
  })
  .strict();

// Allowed non-null parameters per tool
const ALLOWED_TOOL_PARAMS = {
  OVER_ANALYSIS: ['inningsNumber', 'overNumber'],
  PLAYER_ANALYSIS: ['playerId'],
  OVER_COMPARISON: ['inningsNumber', 'comparisonOver1', 'comparisonOver2'],
  EVENT_SEARCH: [
    'inningsNumber',
    'playerId',
    'eventTypes',
    'minimumImportance',
    'startSequence',
    'endSequence'
  ],
  LAST_N_MINUTES: ['minutes'],
  LAST_N_OVERS: ['overs'],
  LAST_OVER: [],
  SINCE_SESSION_JOIN: [],
  WHOLE_MATCH: [],
  UNSUPPORTED: []
};

const ALL_PARAMS = [
  'inningsNumber',
  'overNumber',
  'comparisonOver1',
  'comparisonOver2',
  'playerId',
  'eventTypes',
  'minimumImportance',
  'startSequence',
  'endSequence',
  'minutes',
  'overs'
];

/**
 * Validates that exactly one tool is selected and only its permitted parameters are populated.
 */
export const matchQueryToolSchema = z
  .object({
    tool: z.enum(matchQueryToolTypes),
    inningsNumber: z.number().int().positive().nullable(),
    overNumber: z.number().int().min(0).nullable(),
    comparisonOver1: z.number().int().min(0).nullable(),
    comparisonOver2: z.number().int().min(0).nullable(),
    playerId: z.string().min(1).nullable(),
    eventTypes: z.array(z.enum(timelineEventTypes)).max(timelineEventTypes.length).nullable(),
    minimumImportance: z.enum(timelineImportanceLevels).nullable(),
    startSequence: z.number().int().positive().nullable(),
    endSequence: z.number().int().positive().nullable(),
    minutes: z.number().int().min(1).max(180).nullable(),
    overs: z.number().int().min(1).max(20).nullable()
  })
  .superRefine((val, ctx) => {
    const allowed = ALLOWED_TOOL_PARAMS[val.tool] || [];

    // Ensure parameters not applicable to this tool are null
    for (const param of ALL_PARAMS) {
      if (!allowed.includes(param) && val[param] !== null) {
        ctx.addIssue({ code: 'custom', path: [param], message: `${param} is not applicable.` });
      }
    }

    // Tool-specific validations
    if (val.tool === 'OVER_ANALYSIS') {
      const hasInnings = val.inningsNumber !== null;
      const hasOver = val.overNumber !== null;
      if (hasInnings !== hasOver) {
        ctx.addIssue({
          code: 'custom',
          path: [hasInnings ? 'overNumber' : 'inningsNumber'],
          message: `${hasInnings ? 'overNumber' : 'inningsNumber'} is required when ${hasInnings ? 'inningsNumber' : 'overNumber'} is specified.`
        });
      }
    } else if (val.tool === 'PLAYER_ANALYSIS') {
      if (val.playerId === null) {
        ctx.addIssue({ code: 'custom', path: ['playerId'], message: 'playerId is required.' });
      }
    } else if (val.tool === 'OVER_COMPARISON') {
      for (const field of ['inningsNumber', 'comparisonOver1', 'comparisonOver2']) {
        if (val[field] === null) {
          ctx.addIssue({ code: 'custom', path: [field], message: `${field} is required.` });
        }
      }
      if (
        val.comparisonOver1 !== null &&
        val.comparisonOver2 !== null &&
        val.comparisonOver1 === val.comparisonOver2
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['comparisonOver2'],
          message: 'comparisonOver2 must differ from comparisonOver1.'
        });
      }
    } else if (val.tool === 'EVENT_SEARCH') {
      if ((val.startSequence !== null || val.endSequence !== null) && val.inningsNumber === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['inningsNumber'],
          message: 'inningsNumber is required for a delivery sequence range.'
        });
      }
      if (
        val.startSequence !== null &&
        val.endSequence !== null &&
        val.startSequence > val.endSequence
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['endSequence'],
          message: 'endSequence must not precede startSequence.'
        });
      }
    } else if (val.tool === 'LAST_N_MINUTES') {
      if (val.minutes === null) {
        ctx.addIssue({ code: 'custom', path: ['minutes'], message: 'minutes is required.' });
      }
    } else if (val.tool === 'LAST_N_OVERS') {
      if (val.overs === null) {
        ctx.addIssue({ code: 'custom', path: ['overs'], message: 'overs is required.' });
      }
    }
  });

export const analysisNarrationSchema = z.object({
  headline: z.string().trim().min(1).max(240),
  analysis: z.string().trim().min(1).max(1200)
});
