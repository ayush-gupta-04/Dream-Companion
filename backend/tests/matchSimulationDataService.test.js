import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

const calls = [];
const cacheClears = [];
const transaction = {
  matchSession: { deleteMany: async (args) => calls.push(['matchSession', args]) },
  delivery: { deleteMany: async (args) => calls.push(['delivery', args]) },
  match: { update: async (args) => calls.push(['match', args]) }
};
const prisma = { $transaction: async (callback) => callback(transaction) };
mock.module('../src/db/prisma.js', { exports: { prisma } });
mock.module('../src/modules/match-intelligence/state/matchStateCache.js', {
  exports: { clear: async (matchId) => cacheClears.push(matchId) }
});
const { clearMatchSimulationData } = await import('../src/replay/matchSimulationDataService.js');

test('clears only delivery-derived data for the configured simulation match', async () => {
  await clearMatchSimulationData({ matchId: 'live-match', status: 'LIVE' });

  assert.deepEqual(calls, [
    ['matchSession', { where: { matchId: 'live-match' } }],
    ['delivery', { where: { innings: { matchId: 'live-match' } } }],
    ['match', { where: { id: 'live-match' }, data: { status: 'LIVE' } }]
  ]);
  assert.deepEqual(cacheClears, ['live-match']);
});
