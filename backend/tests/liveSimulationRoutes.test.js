import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import request from 'supertest';

let startForMatch;
mock.module('../src/replay/liveReplayManager.js', {
  exports: {
    isLiveMatchId: () => false,
    startForMatch: (matchId) => startForMatch(matchId)
  }
});
const { default: app } = await import('../src/app.js');

test('POST /api/matches/:matchId/live-simulation starts the configured live match for any fan', async () => {
  const startedMatchIds = [];
  startForMatch = async (matchId) => {
    startedMatchIds.push(matchId);
    return { status: 'started', matchId };
  };

  const response = await request(app).post('/api/matches/live-match/live-simulation');

  assert.equal(response.status, 202);
  assert.deepEqual(response.body, {
    simulation: { status: 'started', matchId: 'live-match' }
  });
  assert.deepEqual(startedMatchIds, ['live-match']);
});

test('live-simulation activation returns an existing replay without resetting it', async () => {
  startForMatch = async (matchId) => ({ status: 'running', matchId });

  const response = await request(app).post('/api/matches/live-match/live-simulation');

  assert.equal(response.status, 200);
  assert.equal(response.body.simulation.status, 'running');
});

test('retired admin replay routes are not registered', async () => {

  const response = await request(app).get('/api/replay/status');

  assert.equal(response.status, 404);
});
