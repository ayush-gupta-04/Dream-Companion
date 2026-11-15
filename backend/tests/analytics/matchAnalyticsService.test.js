import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';

const prismaClient = {};
mock.module('../../src/db/prisma.js', { exports: { prisma: prismaClient } });
const {
  analyzeOver,
  analyzePlayer,
  compareOvers
} = await import('../../src/modules/analytics/matchAnalyticsService.js');

function usePrisma(client) {
  for (const key of Object.keys(prismaClient)) delete prismaClient[key];
  Object.assign(prismaClient, client);
}

const wicket = { countsAsWicket: true, kind: 'caught' };
const deliveries = [
  {
    id: 'delivery-1',
    inningsId: 'innings-1',
    deliverySequence: 1,
    displayOver: 0,
    displayBallLabel: '0.1',
    batterRuns: 4,
    totalRuns: 4,
    wides: 0,
    noBalls: 0,
    byes: 0,
    legByes: 0,
    penaltyRuns: 0,
    isLegalDelivery: true,
    batter: { id: 'batter-1', displayName: 'Batter One' },
    bowler: { id: 'bowler-1', displayName: 'Bowler One' },
    wickets: []
  },
  {
    id: 'delivery-2',
    inningsId: 'innings-1',
    deliverySequence: 2,
    displayOver: 0,
    displayBallLabel: '0.1',
    batterRuns: 0,
    totalRuns: 1,
    wides: 1,
    noBalls: 0,
    byes: 0,
    legByes: 0,
    penaltyRuns: 0,
    isLegalDelivery: false,
    batter: { id: 'batter-1', displayName: 'Batter One' },
    bowler: { id: 'bowler-1', displayName: 'Bowler One' },
    wickets: []
  },
  {
    id: 'delivery-3',
    inningsId: 'innings-1',
    deliverySequence: 3,
    displayOver: 0,
    displayBallLabel: '0.2',
    batterRuns: 0,
    totalRuns: 0,
    wides: 0,
    noBalls: 0,
    byes: 0,
    legByes: 0,
    penaltyRuns: 0,
    isLegalDelivery: true,
    batter: { id: 'batter-1', displayName: 'Batter One' },
    bowler: { id: 'bowler-1', displayName: 'Bowler One' },
    wickets: [wicket]
  }
];

describe('match analytics', () => {
  test('analyzes an over from stored delivery facts', async () => {
    const prisma = {
      innings: { findFirst: async () => ({ id: 'innings-1', match: { ballsPerOver: 6 } }) },
      delivery: { findMany: async () => deliveries }
    };

    usePrisma(prisma);
    const analysis = await analyzeOver({
      matchId: 'match-1',
      inningsNumber: 1,
      overNumber: 0
    });

    assert.equal(analysis.runs, 5);
    assert.equal(analysis.wickets, 1);
    assert.equal(analysis.legalDeliveries, 2);
    assert.equal(analysis.runRate, 15);
    assert.equal(analysis.extras.wides, 1);
    assert.equal(analysis.batters[0].runs, 4);
    assert.equal(analysis.bowlers[0].wickets, 1);
    assert.deepEqual(
      analysis.references.map((reference) => reference.deliverySequence),
      [1, 2, 3]
    );
  });

  test('resolves the last completed over dynamically when over number is omitted', async () => {
    const over0 = deliveries;
    const over1 = [
      {
        ...deliveries[0],
        id: 'delivery-4',
        deliverySequence: 4,
        displayOver: 1,
        displayBallLabel: '1.1',
        batterRuns: 6,
        totalRuns: 6,
        innings: { id: 'innings-1', inningsNumber: 1 }
      }
    ];
    const allDeliveries = [
      ...over0.map((d) => ({ ...d, innings: { id: 'innings-1', inningsNumber: 1 } })),
      ...over1
    ];
    const prisma = {
      match: { findUnique: async () => ({ status: 'IN_PROGRESS', ballsPerOver: 6 }) },
      delivery: { findMany: async () => allDeliveries }
    };

    usePrisma(prisma);
    const analysis = await analyzeOver({ matchId: 'match-1' });

    assert.equal(analysis.overNumber, 0);
    assert.equal(analysis.runs, 5);
  });

  test('compares two stored overs with directional factual deltas', async () => {
    const secondOver = [
      {
        ...deliveries[0],
        id: 'delivery-4',
        deliverySequence: 4,
        displayOver: 1,
        displayBallLabel: '1.1',
        batterRuns: 6,
        totalRuns: 6,
        wickets: []
      },
      {
        ...deliveries[2],
        id: 'delivery-5',
        deliverySequence: 5,
        displayOver: 1,
        displayBallLabel: '1.2',
        wickets: []
      }
    ];
    const prisma = {
      innings: { findFirst: async () => ({ id: 'innings-1', match: { ballsPerOver: 6 } }) },
      delivery: {
        findMany: async ({ where }) => (where.displayOver === 0 ? deliveries : secondOver)
      }
    };

    usePrisma(prisma);
    const comparison = await compareOvers({
      matchId: 'match-1',
      inningsNumber: 1,
      over1: 0,
      over2: 1
    });

    assert.equal(comparison.type, 'OVER_COMPARISON');
    assert.equal(comparison.firstOver.runs, 5);
    assert.equal(comparison.secondOver.runs, 6);
    assert.equal(comparison.deltas.runs, 1);
    assert.equal(comparison.deltas.wickets, -1);
    assert.equal(comparison.deltas.fours, -1);
    assert.equal(comparison.deltas.sixes, 1);
    assert.equal(comparison.references.length, 5);
  });

  test('rejects attempts to compare an over with itself', async () => {
    await assert.rejects(
      compareOvers({ matchId: 'match-1', inningsNumber: 1, over1: 4, over2: 4 }),
      { message: 'Choose two different overs to compare.' }
    );
  });

  test('calculates player batting and bowling figures deterministically', async () => {
    const prisma = {
      match: { findUnique: async () => ({ ballsPerOver: 6 }) },
      player: { findFirst: async () => ({ id: 'batter-1', displayName: 'Batter One' }) },
      delivery: {
        findMany: async () =>
          deliveries.map((delivery) => ({
            ...delivery,
            batterId: 'batter-1',
            bowlerId: 'batter-1'
          }))
      }
    };

    usePrisma(prisma);
    const analysis = await analyzePlayer({ matchId: 'match-1', playerId: 'batter-1' });

    assert.equal(analysis.batting.runs, 4);
    assert.equal(analysis.batting.ballsFaced, 2);
    assert.equal(analysis.batting.strikeRate, 200);
    assert.equal(analysis.bowling.legalDeliveries, 2);
    assert.equal(analysis.bowling.runsConceded, 5);
    assert.equal(analysis.bowling.wickets, 1);
  });
});
