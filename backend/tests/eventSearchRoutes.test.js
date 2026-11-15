import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import request from 'supertest';

let query;
const prisma = {
  match: { findUnique: async () => ({ id: 'match-1' }) },
  player: { findFirst: async () => ({ id: 'player-1', displayName: 'Player One' }) },
  timelineEvent: {
    findMany: async (request) => {
      query = request;
      return [];
    }
  }
};
mock.module('../src/db/prisma.js', { exports: { prisma } });
const { default: app } = await import('../src/app.js');

test('event search route validates filters and returns deterministic search results', async () => {

  const valid = await request(app).get(
    '/api/matches/match-1/events/search?innings=1&types=WICKET,SIX&playerId=player-1&minimumImportance=HIGHLIGHT&limit=5'
  );
  const invalid = await request(app).get('/api/matches/match-1/events/search?startSequence=1');

  assert.equal(valid.status, 200);
  assert.deepEqual(valid.body.filters.types, ['WICKET', 'SIX']);
  assert.equal(valid.body.filters.minimumImportance, 'HIGHLIGHT');
  assert.equal(valid.body.filters.inningsNumber, 1);
  assert.deepEqual(query.where.type, { in: ['WICKET', 'SIX'] });
  assert.equal(query.take, 6);
  assert.equal(invalid.status, 400);
});
