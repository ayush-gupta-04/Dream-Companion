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

function requireField(value, field, context) {
  if (value === null) {
    context.addIssue({ code: 'custom', path: [field], message: `${field} is required.` });
  }
}

function requireNull(value, field, context) {
  if (value !== null) {
    context.addIssue({ code: 'custom', path: [field], message: `${field} is not applicable.` });
  }
}

function requireOnlyNulls(value, fields, context) {
  for (const field of fields) requireNull(value[field], field, context);
}

const allParameterFields = [
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
 * The model may select exactly one operation and only provide its bounded
 * arguments. The service validates this shape before any domain function runs.
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
  .superRefine((value, context) => {
    const analysisFields = [
      'inningsNumber',
      'overNumber',
      'comparisonOver1',
      'comparisonOver2',
      'playerId',
      'eventTypes',
      'minimumImportance',
      'startSequence',
      'endSequence'
    ];
    const recapFields = ['minutes', 'overs'];

    if (value.tool === 'OVER_ANALYSIS') {
      const hasInnings = value.inningsNumber !== null;
      const hasOver = value.overNumber !== null;
      if (hasInnings !== hasOver) {
        if (!hasInnings) {
          context.addIssue({
            code: 'custom',
            path: ['inningsNumber'],
            message: 'inningsNumber is required when overNumber is specified.'
          });
        }
        if (!hasOver) {
          context.addIssue({
            code: 'custom',
            path: ['overNumber'],
            message: 'overNumber is required when inningsNumber is specified.'
          });
        }
      }
      requireOnlyNulls(
        value,
        [
          ...analysisFields.filter((field) => !['inningsNumber', 'overNumber'].includes(field)),
          ...recapFields
        ],
        context
      );
      return;
    }

    if (value.tool === 'PLAYER_ANALYSIS') {
      requireField(value.playerId, 'playerId', context);
      requireOnlyNulls(
        value,
        [...analysisFields.filter((field) => field !== 'playerId'), ...recapFields],
        context
      );
      return;
    }

    if (value.tool === 'OVER_COMPARISON') {
      requireField(value.inningsNumber, 'inningsNumber', context);
      requireField(value.comparisonOver1, 'comparisonOver1', context);
      requireField(value.comparisonOver2, 'comparisonOver2', context);
      if (
        value.comparisonOver1 !== null &&
        value.comparisonOver2 !== null &&
        value.comparisonOver1 === value.comparisonOver2
      ) {
        context.addIssue({
          code: 'custom',
          path: ['comparisonOver2'],
          message: 'comparisonOver2 must differ from comparisonOver1.'
        });
      }
      requireOnlyNulls(
        value,
        [
          ...analysisFields.filter(
            (field) => !['inningsNumber', 'comparisonOver1', 'comparisonOver2'].includes(field)
          ),
          ...recapFields
        ],
        context
      );
      return;
    }

    if (value.tool === 'EVENT_SEARCH') {
      requireOnlyNulls(
        value,
        ['overNumber', 'comparisonOver1', 'comparisonOver2', ...recapFields],
        context
      );
      if (
        (value.startSequence !== null || value.endSequence !== null) &&
        value.inningsNumber === null
      ) {
        context.addIssue({
          code: 'custom',
          path: ['inningsNumber'],
          message: 'inningsNumber is required for a delivery sequence range.'
        });
      }
      if (
        value.startSequence !== null &&
        value.endSequence !== null &&
        value.startSequence > value.endSequence
      ) {
        context.addIssue({
          code: 'custom',
          path: ['endSequence'],
          message: 'endSequence must not precede startSequence.'
        });
      }
      return;
    }

    if (value.tool === 'LAST_N_MINUTES') {
      requireField(value.minutes, 'minutes', context);
      requireNull(value.overs, 'overs', context);
      requireOnlyNulls(value, analysisFields, context);
      return;
    }

    if (value.tool === 'LAST_N_OVERS') {
      requireField(value.overs, 'overs', context);
      requireNull(value.minutes, 'minutes', context);
      requireOnlyNulls(value, analysisFields, context);
      return;
    }

    requireOnlyNulls(value, allParameterFields, context);
  });

export const analysisNarrationSchema = z.object({
  headline: z.string().trim().min(1).max(240),
  analysis: z.string().trim().min(1).max(1200)
});
