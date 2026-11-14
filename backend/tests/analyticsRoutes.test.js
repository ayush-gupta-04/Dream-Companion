import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';

function delivery({ id, overNumber, sequence, runs }) {
  return {
    id,
    inningsId: 'innings-1',
    deliverySequence: sequence,
    displayOver: overNumber,
    displayBallLabel: `${overNumber}.1`,
    batterRuns: runs,
    totalRuns: runs,
    wides: 0,
    noBalls: 0,
    byes: 0,
    legByes: 0,
    penaltyRuns: 0,
    isLegalDelivery: true,
    batter: { id: 'batter-1', displayName: 'Batter One' },
    bowler: { id: 'bowler-1', displayName: 'Bowler One' },
    wickets: []
  };
}

test('over comparison route validates query parameters and returns deterministic analysis', async () => {
  const app = createApp({
    prismaClient: {
      innings: { findFirst: async () => ({ id: 'innings-1', match: { ballsPerOver: 6 } }) },
      delivery: {
        findMany: async ({ where }) =>
          where.displayOver === 0
            ? [delivery({ id: 'delivery-1', overNumber: 0, sequence: 1, runs: 4 })]
            : [delivery({ id: 'delivery-2', overNumber: 1, sequence: 2, runs: 6 })]
      }
    }
  });

  const valid = await request(app).get(
    '/api/matches/match-1/analytics/overs/compare?innings=1&over1=0&over2=1'
  );
  const invalid = await request(app).get(
    '/api/matches/match-1/analytics/overs/compare?innings=1&over1=0&over2=0'
  );

  assert.equal(valid.status, 200);
  assert.equal(valid.body.analysis.type, 'OVER_COMPARISON');
  assert.equal(valid.body.analysis.deltas.runs, 2);
  assert.equal(invalid.status, 400);
});
