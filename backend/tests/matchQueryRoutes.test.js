import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import request from 'supertest';

let query;
mock.module('../src/modules/ai/matchQueryService.js', {
  exports: { queryMatch: (request) => query(request) }
});
const { default: app } = await import('../src/app.js');

test('POST /api/matches/:matchId/query validates the shared contract and returns its result', async () => {
  query = async ({ matchId, request: queryRequest }) => ({
    kind: 'ANALYSIS',
    tool: 'OVER_ANALYSIS',
    answer: { headline: queryRequest.query, body: matchId, bullets: [] },
    evidence: null,
    references: [],
    window: null,
    limitations: []
  });

  const valid = await request(app)
    .post('/api/matches/match-1/query')
    .send({ query: 'Analyse the first over' });
  const invalid = await request(app).post('/api/matches/match-1/query').send({ query: 'hi' });
  const detail = await request(app)
    .post('/api/matches/match-1/query')
    .send({ query: 'Summarize the match', detail: 'QUICK' });

  assert.equal(valid.status, 200);
  assert.equal(valid.body.answer.body, 'match-1');
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.message, 'Invalid match query request.');
  assert.equal(detail.status, 400);
});

test('retired Ask and Catch Me Up query routes are not registered', async () => {

  const ask = await request(app)
    .post('/api/matches/match-1/ask')
    .send({ question: 'Analyse over 1' });
  const summaries = await request(app)
    .post('/api/matches/match-1/summaries')
    .send({ query: 'Summarize the match' });

  assert.equal(ask.status, 404);
  assert.equal(summaries.status, 404);
});
