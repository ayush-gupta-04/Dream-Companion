import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import request from 'supertest';

const prismaMock = {};
mock.module('../src/db/prisma.js', { exports: { prisma: prismaMock } });
const { default: app } = await import('../src/app.js');

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
  Object.assign(prismaMock, {
    innings: { findFirst: async () => ({ id: 'innings-1', match: { ballsPerOver: 6 } }) },
    delivery: {
      findMany: async ({ where }) =>
        where.displayOver === 0
          ? [delivery({ id: 'delivery-1', overNumber: 0, sequence: 1, runs: 4 })]
          : [delivery({ id: 'delivery-2', overNumber: 1, sequence: 2, runs: 6 })]
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

test('over analysis route parses parameters and returns single-over analysis', async () => {
  Object.assign(prismaMock, {
    innings: { findFirst: async () => ({ id: 'innings-1', match: { ballsPerOver: 6 } }) },
    delivery: {
      findMany: async () => [delivery({ id: 'delivery-1', overNumber: 0, sequence: 1, runs: 4 })]
    }
  });

  const valid = await request(app).get('/api/matches/match-1/analytics/overs/0?innings=1');
  const invalidQuery = await request(app).get('/api/matches/match-1/analytics/overs/0?innings=0');
  const invalidParam = await request(app).get('/api/matches/match-1/analytics/overs/-1?innings=1');

  assert.equal(valid.status, 200);
  assert.equal(valid.body.analysis.type, 'OVER_ANALYSIS');
  assert.equal(valid.body.analysis.overNumber, 0);
  assert.equal(valid.body.analysis.runs, 4);
  assert.equal(invalidQuery.status, 400);
  assert.equal(invalidParam.status, 400);
});

test('route order preserves literal /compare over parameterized /:overNumber', async () => {
  let compareHandlerHit = false;
  Object.assign(prismaMock, {
    innings: { findFirst: async () => ({ id: 'innings-1', match: { ballsPerOver: 6 } }) },
    delivery: {
      findMany: async () => {
        compareHandlerHit = true;
        return [delivery({ id: 'delivery-1', overNumber: 0, sequence: 1, runs: 4 })];
      }
    }
  });

  const res = await request(app).get(
    '/api/matches/match-1/analytics/overs/compare?innings=1&over1=0&over2=1'
  );

  assert.equal(res.status, 200);
  assert.equal(res.body.analysis.type, 'OVER_COMPARISON');
  assert.equal(compareHandlerHit, true);
});

test('player analysis route returns player batting and bowling analysis', async () => {
  Object.assign(prismaMock, {
    match: { findUnique: async () => ({ ballsPerOver: 6 }) },
    player: {
      findFirst: async () => ({ id: 'player-1', displayName: 'Player One' })
    },
    delivery: {
      findMany: async () => [
        {
          id: 'delivery-1',
          inningsId: 'innings-1',
          deliverySequence: 1,
          displayOver: 0,
          displayBallLabel: '0.1',
          batterId: 'player-1',
          bowlerId: 'bowler-1',
          batterRuns: 4,
          totalRuns: 4,
          wides: 0,
          noBalls: 0,
          byes: 0,
          legByes: 0,
          penaltyRuns: 0,
          isLegalDelivery: true,
          wickets: []
        }
      ]
    }
  });

  const response = await request(app).get('/api/matches/match-1/analytics/players/player-1');

  assert.equal(response.status, 200);
  assert.equal(response.body.analysis.type, 'PLAYER_ANALYSIS');
  assert.equal(response.body.analysis.player.displayName, 'Player One');
  assert.equal(response.body.analysis.batting.runs, 4);
});
