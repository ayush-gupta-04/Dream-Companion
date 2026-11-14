import { z } from 'zod';
import { timelineEventTypes, timelineImportanceLevels } from './timelineSchemas.js';

export const askMatchRequestSchema = z.object({
  question: z.string().trim().min(3).max(500)
});

export const askIntentSchema = z.object({
  intent: z.enum([
    'OVER_ANALYSIS',
    'PLAYER_ANALYSIS',
    'OVER_COMPARISON',
    'EVENT_SEARCH',
    'UNSUPPORTED'
  ]),
  inningsNumber: z.number().int().positive().nullable(),
  overNumber: z.number().int().min(0).nullable(),
  comparisonOver1: z.number().int().min(0).nullable(),
  comparisonOver2: z.number().int().min(0).nullable(),
  playerId: z.string().min(1).nullable(),
  eventTypes: z.array(z.enum(timelineEventTypes)).max(timelineEventTypes.length).nullable(),
  minimumImportance: z.enum(timelineImportanceLevels).nullable(),
  startSequence: z.number().int().positive().nullable(),
  endSequence: z.number().int().positive().nullable()
});

export const narrationSchema = z.object({
  headline: z.string().trim().min(1).max(240),
  analysis: z.string().trim().min(1).max(1200)
});

