import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';

test('POST /api/matches/:matchId/ask validates input and returns the service response', async () => {
  const app = createApp({
    askMatchService: {
      ask: async ({ matchId, question }) => ({
        intent: 'OVER_ANALYSIS',
        answer: { headline: question, analysis: matchId, factReferences: [] },
        facts: {},
        limitations: []
      })
    }
  });

  const valid = await request(app)
    .post('/api/matches/match-1/ask')
    .send({ question: 'Analyse the first over' });
  const invalid = await request(app).post('/api/matches/match-1/ask').send({ question: '' });

  assert.equal(valid.status, 200);
  assert.equal(valid.body.answer.analysis, 'match-1');
  assert.equal(invalid.status, 400);
});
