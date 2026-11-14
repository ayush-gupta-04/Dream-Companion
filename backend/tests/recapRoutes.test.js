import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';

test('authenticated match-session routes remain available for Catch Me Up context', async () => {
  const app = createApp({
    recapService: {
      join: async ({ matchId }) => ({ id: '98ff2e89-97e9-470d-8a03-6fce96edfc2e', matchId }),
      leave: async () => undefined
    }
  });

  const join = await request(app).post('/api/matches/match-1/sessions/join');
  const leave = await request(app)
    .post('/api/matches/match-1/sessions/leave')
    .send({ sessionId: '98ff2e89-97e9-470d-8a03-6fce96edfc2e' });

  assert.equal(join.status, 201);
  assert.equal(leave.status, 204);
});
