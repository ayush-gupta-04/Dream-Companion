import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clearMatchSimulationData } from '../src/replay/matchSimulationDataService.js';

test('clears only delivery-derived data for the configured simulation match', async () => {
  const calls = [];
  const transaction = {
    innings: {
      findMany: async (args) => {
        calls.push(['innings', args]);
        return [{ id: 'live-innings' }];
      }
    },
    timelineEvent: { deleteMany: async (args) => calls.push(['timelineEvent', args]) },
    matchSession: { deleteMany: async (args) => calls.push(['matchSession', args]) },
    delivery: { deleteMany: async (args) => calls.push(['delivery', args]) },
    match: { update: async (args) => calls.push(['match', args]) }
  };
  const prisma = { $transaction: async (callback) => callback(transaction) };
  const cacheClears = [];

  await clearMatchSimulationData({
    prisma,
    stateCache: { clear: async (matchId) => cacheClears.push(matchId) },
    matchId: 'live-match',
    status: 'LIVE'
  });

  assert.deepEqual(calls, [
    ['innings', { where: { matchId: 'live-match' }, select: { id: true } }],
    ['timelineEvent', { where: { matchId: 'live-match' } }],
    ['matchSession', { where: { matchId: 'live-match' } }],
    ['delivery', { where: { inningsId: { in: ['live-innings'] } } }],
    ['match', { where: { id: 'live-match' }, data: { status: 'LIVE' } }]
  ]);
  assert.deepEqual(cacheClears, ['live-match']);
});
