import { z } from 'zod';

const nonNegativeInteger = z.number().int().min(0);

export const extrasSchema = z
  .object({
    wides: nonNegativeInteger.default(0),
    noBalls: nonNegativeInteger.default(0),
    byes: nonNegativeInteger.default(0),
    legByes: nonNegativeInteger.default(0),
    penaltyRuns: nonNegativeInteger.default(0)
  })
  .default({});

export const wicketSchema = z.object({
  playerOutId: z.string().min(1),
  kind: z.string().trim().min(1),
  countsAsWicket: z.boolean().default(true),
  fielders: z.array(z.string().min(1)).default([])
});

export const normalizedDeliverySchema = z
  .object({
    deliverySequence: z.number().int().positive(),
    display: z.object({
      overNumber: nonNegativeInteger,
      ballLabel: z.string().trim().min(1).max(32)
    }),
    players: z.object({
      batterId: z.string().min(1),
      nonStrikerId: z.string().min(1),
      bowlerId: z.string().min(1)
    }),
    runs: z.object({
      batter: nonNegativeInteger,
      total: nonNegativeInteger
    }),
    extras: extrasSchema,
    wickets: z.array(wicketSchema).default([]),
    source: z
      .object({
        provider: z.string().trim().min(1),
        deliveryId: z.string().trim().min(1).optional(),
        revision: z.string().trim().min(1).optional()
      })
      .optional(),
    occurredAt: z.coerce.date().optional(),
    rawPayload: z.unknown().optional()
  })
  .superRefine((delivery, context) => {
    const extrasTotal = Object.values(delivery.extras).reduce((total, value) => total + value, 0);

    if (delivery.runs.total !== delivery.runs.batter + extrasTotal) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['runs', 'total'],
        message: 'Team runs must equal batter runs plus all extras.'
      });
    }

    if (delivery.extras.wides > 0 && delivery.runs.batter > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['runs', 'batter'],
        message: 'Batter cannot score runs off a wide delivery.'
      });
    }
  });

