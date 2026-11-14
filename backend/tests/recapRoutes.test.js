import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';

test('Catch Me Up routes validate payloads and expose the service contracts', async () => {
  const app = createApp({
    recapService: {
      join: async ({ matchId }) => ({ id: '98ff2e89-97e9-470d-8a03-6fce96edfc2e', matchId }),
      leave: async () => undefined,
      summarize: async ({ matchId, request: recapRequest }) => ({
        intent: 'WHOLE_MATCH',
        window: { type: recapRequest.query, availability: 'AVAILABLE' },
        recap: { headline: matchId },
        evidence: null,
        limitations: []
      })
    }
  });

  const join = await request(app).post('/api/matches/match-1/sessions/join');
  const summary = await request(app)
    .post('/api/matches/match-1/summaries')
    .send({ query: 'Summarize the whole match', detail: 'QUICK' });
  const naturalLanguage = await request(app)
    .post('/api/matches/match-1/summaries')
    .send({ query: 'Summarize the last 3 overs' });
  const invalid = await request(app)
    .post('/api/matches/match-1/summaries')
    .send({ query: 'ok', detail: 'QUICK' });
  const retired = await request(app)
    .post('/api/matches/match-1/summaries')
    .send({ window: 'LAST_WICKET_CONTEXT', detail: 'QUICK' });
  const leave = await request(app)
    .post('/api/matches/match-1/sessions/leave')
    .send({ sessionId: '98ff2e89-97e9-470d-8a03-6fce96edfc2e' });

  assert.equal(join.status, 201);
  assert.equal(summary.status, 200);
  assert.equal(summary.body.recap.headline, 'match-1');
  assert.equal(naturalLanguage.status, 200);
  assert.equal(naturalLanguage.body.window.type, 'Summarize the last 3 overs');
  assert.equal(invalid.status, 400);
  assert.equal(retired.status, 400);
  assert.equal(leave.status, 204);
});
