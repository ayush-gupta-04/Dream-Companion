import { z } from 'zod';

const inningsNumberSchema = z.coerce.number().int().positive();
const overNumberSchema = z.coerce.number().int().min(0);

export const overAnalysisQuerySchema = z.object({
  innings: inningsNumberSchema
});

export const overAnalysisParamsSchema = z.object({
  overNumber: overNumberSchema
});

export const overComparisonQuerySchema = z
  .object({
    innings: inningsNumberSchema,
    over1: overNumberSchema,
    over2: overNumberSchema
  })
  .superRefine(({ over1, over2 }, context) => {
    if (over1 === over2) {
      context.addIssue({
        code: 'custom',
        path: ['over2'],
        message: 'over1 and over2 must be different.'
      });
    }
  });

