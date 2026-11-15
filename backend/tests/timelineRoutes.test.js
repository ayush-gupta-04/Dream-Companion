import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import request from 'supertest';

let query;
const prisma = {
  match: { findUnique: async () => ({ id: 'match-1' }) },
  timelineEvent: {
    findMany: async (request) => {
      query = request;
      return [];
    }
  }
};
mock.module('../src/db/prisma.js', { exports: { prisma } });
const { default: app } = await import('../src/app.js');

test('timeline route validates filters and returns the service response', async () => {

  const valid = await request(app).get(
    '/api/matches/match-1/timeline?innings=1&types=FOUR,WICKET&limit=5'
  );
  const invalid = await request(app).get('/api/matches/match-1/timeline?types=NOT_AN_EVENT');

  assert.equal(valid.status, 200);
  assert.deepEqual(valid.body.events, []);
  assert.deepEqual(query.where.type, { in: ['FOUR', 'WICKET'] });
  assert.deepEqual(query.where.innings, { inningsNumber: 1 });
  assert.equal(query.take, 6);
  assert.equal(invalid.status, 400);
});
