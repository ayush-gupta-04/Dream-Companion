import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

let transactions = 0;
let inningsUpsert;
const transaction = {
  match: { upsert: async () => ({ id: 'match-1' }) },
  team: {
    upsert: async ({ where }) => {
      const sourceTeamId = where.source_sourceTeamId.sourceTeamId;
      return { id: `stored-${sourceTeamId}`, sourceTeamId };
    }
  },
  matchTeam: { upsert: async () => {} },
  player: {
    upsert: async ({ where }) => {
      const sourcePlayerId = where.source_sourcePlayerId.sourcePlayerId;
      return { id: `stored-${sourcePlayerId}`, sourcePlayerId };
    }
  },
  matchPlayer: { upsert: async () => {} },
  innings: {
    upsert: async (request) => {
      inningsUpsert = request;
      return { id: 'innings-1', inningsNumber: 1 };
    }
  }
};
const prisma = {
  $transaction: async (callback) => {
    transactions += 1;
    return callback(transaction);
  }
};
mock.module('../../src/db/prisma.js', { exports: { prisma } });
const { bootstrapCricsheetMatch } = await import('../../src/modules/ingestion/matchBootstrapService.js');

test('bootstraps source identities in one transaction before delivery processing', async () => {
  const match = {
    name: 'Test match',
    source: 'cricsheet',
    sourceMatchId: 'source-match',
    sourceRevision: 'revision-1',
    ballsPerOver: 6,
    teams: [
      { sourceId: 'team-a', name: 'Team A' },
      { sourceId: 'team-b', name: 'Team B' }
    ],
    players: [
      { sourceId: 'batter', displayName: 'Batter', teamSourceId: 'team-a' },
      { sourceId: 'bowler', displayName: 'Bowler', teamSourceId: 'team-b' }
    ],
    innings: [{
      inningsNumber: 1,
      battingTeamSourceId: 'team-a',
      sourceInningsId: 'source-innings',
      targetRuns: null,
      prePenaltyRuns: 0,
      postPenaltyRuns: 0,
      deliveries: [{
        deliverySequence: 1,
        display: { overNumber: 0, ballLabel: '0.1' },
        playerSources: { batterId: 'batter', nonStrikerId: 'batter', bowlerId: 'bowler' },
        runs: { batter: 1, total: 1 },
        extras: {},
        wickets: [],
        sourceDeliveryId: 'source-delivery',
        sourceRevision: 'delivery-revision',
        rawPayload: {}
      }]
    }]
  };

  const prepared = await bootstrapCricsheetMatch(match);

  assert.equal(transactions, 1);
  assert.equal(prepared.match.id, 'match-1');
  assert.equal(inningsUpsert.create.battingTeamId, 'stored-team-a');
  assert.deepEqual(prepared.innings[0].deliveries[0].players, {
    batterId: 'stored-batter',
    nonStrikerId: 'stored-batter',
    bowlerId: 'stored-bowler'
  });
  assert.deepEqual(prepared.innings[0].deliveries[0].source, {
    provider: 'cricsheet', deliveryId: 'source-delivery', revision: 'delivery-revision'
  });
});
