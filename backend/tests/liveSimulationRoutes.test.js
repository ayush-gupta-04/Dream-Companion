import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';

test('POST /api/matches/:matchId/live-simulation starts the configured live match for any fan', async () => {
  const startedMatchIds = [];
  const app = createApp({
    liveReplayManager: {
      isLiveMatchId: (matchId) => matchId === 'live-match',
      startForMatch: async (matchId) => {
        startedMatchIds.push(matchId);
        return { status: 'started', matchId };
      }
    }
  });

  const response = await request(app).post('/api/matches/live-match/live-simulation');

  assert.equal(response.status, 202);
  assert.deepEqual(response.body, {
    simulation: { status: 'started', matchId: 'live-match' }
  });
  assert.deepEqual(startedMatchIds, ['live-match']);
});

test('live-simulation activation returns an existing replay without resetting it', async () => {
  const app = createApp({
    liveReplayManager: {
      isLiveMatchId: () => true,
      startForMatch: async (matchId) => ({ status: 'running', matchId })
    }
  });

  const response = await request(app).post('/api/matches/live-match/live-simulation');

  assert.equal(response.status, 200);
  assert.equal(response.body.simulation.status, 'running');
});

test('retired admin replay routes are not registered', async () => {
  const app = createApp({
    liveReplayManager: { isLiveMatchId: () => false, startForMatch: async () => ({}) }
  });

  const response = await request(app).get('/api/replay/status');

  assert.equal(response.status, 404);
});
