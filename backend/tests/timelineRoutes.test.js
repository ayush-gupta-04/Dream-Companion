import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';

test('timeline route validates filters and returns the service response', async () => {
  const app = createApp({
    timelineService: {
      list: async ({ matchId, inningsNumber, types, limit }) => ({
        events: [{ id: 'event-1', matchId, inningsNumber, types, limit }],
        nextCursor: null
      })
    }
  });

  const valid = await request(app).get(
    '/api/matches/match-1/timeline?innings=1&types=FOUR,WICKET&limit=5'
  );
  const invalid = await request(app).get('/api/matches/match-1/timeline?types=NOT_AN_EVENT');

  assert.equal(valid.status, 200);
  assert.deepEqual(valid.body.events[0].types, ['FOUR', 'WICKET']);
  assert.equal(valid.body.events[0].limit, 5);
  assert.equal(invalid.status, 400);
});
