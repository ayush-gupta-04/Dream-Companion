import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';

test('event search route validates filters and returns deterministic search results', async () => {
  const app = createApp({
    eventSearchService: {
      search: async ({ matchId, inningsNumber, types, playerId, minimumImportance, limit }) => ({
        type: 'EVENT_SEARCH',
        matchId,
        filters: { inningsNumber, types, playerId, minimumImportance, limit },
        events: [],
        nextCursor: null,
        references: []
      })
    }
  });

  const valid = await request(app).get(
    '/api/matches/match-1/events/search?innings=1&types=WICKET,SIX&playerId=player-1&minimumImportance=HIGHLIGHT&limit=5'
  );
  const invalid = await request(app).get('/api/matches/match-1/events/search?startSequence=1');

  assert.equal(valid.status, 200);
  assert.deepEqual(valid.body.filters.types, ['WICKET', 'SIX']);
  assert.equal(valid.body.filters.minimumImportance, 'HIGHLIGHT');
  assert.equal(valid.body.filters.limit, 5);
  assert.equal(invalid.status, 400);
});
