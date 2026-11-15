import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import request from 'supertest';

let joinSession;
let leaveSession;
mock.module('../src/modules/summaries/recapService.js', {
  exports: {
    join: (request) => joinSession(request),
    leave: (request) => leaveSession(request),
    executeRecap: async () => assert.fail('Unexpected recap execution')
  }
});
const { default: app } = await import('../src/app.js');

test('authenticated match-session routes remain available for Catch Me Up context', async () => {
  joinSession = async ({ matchId }) => ({ id: '98ff2e89-97e9-470d-8a03-6fce96edfc2e', matchId });
  leaveSession = async () => undefined;

  const join = await request(app).post('/api/matches/match-1/sessions/join');
  const leave = await request(app)
    .post('/api/matches/match-1/sessions/leave')
    .send({ sessionId: '98ff2e89-97e9-470d-8a03-6fce96edfc2e' });

  assert.equal(join.status, 201);
  assert.equal(leave.status, 204);
});

test('POST /api/matches/:matchId/sessions/leave validates sessionId is a valid UUID', async () => {
  joinSession = async () => ({ id: '98ff2e89-97e9-470d-8a03-6fce96edfc2e' });
  leaveSession = async () => undefined;

  const response = await request(app)
    .post('/api/matches/match-1/sessions/leave')
    .send({ sessionId: 'not-a-uuid' });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, 'Invalid match session request.');
});
