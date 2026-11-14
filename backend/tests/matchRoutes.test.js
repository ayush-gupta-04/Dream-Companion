import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';

function matchRecord({ id, name, status, updatedAt, latestDeliveryAt = null }) {
  return {
    id,
    name,
    status,
    updatedAt: new Date(updatedAt),
    innings: latestDeliveryAt
      ? [{ deliveries: [{ ingestedAt: new Date(latestDeliveryAt) }] }]
      : [{ deliveries: [] }]
  };
}

test('GET /api/matches returns card-safe summaries for every match', async () => {
  const calls = [];
  const matches = [
    matchRecord({
      id: 'complete-match',
      name: 'Completed match',
      status: 'COMPLETE',
      updatedAt: '2026-11-14T09:00:00.000Z',
      latestDeliveryAt: '2026-11-14T10:05:00.000Z'
    }),
    matchRecord({
      id: 'live-match',
      name: 'Live match',
      status: 'LIVE',
      updatedAt: '2026-11-14T11:00:00.000Z',
      latestDeliveryAt: '2026-11-14T11:15:00.000Z'
    }),
    matchRecord({
      id: 'scheduled-match',
      name: 'Scheduled match',
      status: 'SCHEDULED',
      updatedAt: '2026-11-14T12:00:00.000Z'
    }),
    matchRecord({
      id: 'abandoned-match',
      name: 'Abandoned match',
      status: 'ABANDONED',
      updatedAt: '2026-11-14T08:00:00.000Z'
    })
  ];
  const app = createApp({
    prismaClient: {
      match: {
        findMany: async (query) => {
          calls.push(query);
          return matches;
        }
      }
    }
  });

  const response = await request(app).get('/api/matches');

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.matches.map((match) => match.id),
    ['live-match', 'scheduled-match', 'complete-match', 'abandoned-match']
  );
  assert.deepEqual(response.body.matches[0], {
    id: 'live-match',
    displayName: 'Live match',
    imageUrl: '/match-card-images/img9.jpg',
    status: 'LIVE',
    isLiveSimulation: false,
    freshness: { updatedAt: '2026-11-14T11:15:00.000Z' }
  });
  assert.equal(response.body.matches[1].freshness.updatedAt, '2026-11-14T12:00:00.000Z');
  assert.ok(Number.isFinite(Date.parse(response.body.generatedAt)));
  assert.deepEqual(calls[0].select, {
    id: true,
    name: true,
    status: true,
    updatedAt: true,
    innings: {
      select: {
        deliveries: {
          orderBy: { ingestedAt: 'desc' },
          take: 1,
          select: { ingestedAt: true }
        }
      }
    }
  });
});

test('GET /match-card-images serves the bundled match-card artwork without authentication', async () => {
  const app = createApp();

  const response = await request(app).get('/match-card-images/img1.jpg');

  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /^image\/jpeg/);
  assert.ok(response.body.length > 0);
});

test('GET /api/matches/live keeps its existing live-only response contract', async () => {
  const liveMatches = [
    {
      id: 'live-match',
      name: 'Live match',
      status: 'LIVE',
      updatedAt: new Date('2026-11-14T11:00:00.000Z')
    }
  ];
  const app = createApp({
    prismaClient: {
      match: {
        findMany: async ({ where }) => {
          assert.deepEqual(where, { status: 'LIVE' });
          return liveMatches;
        }
      }
    }
  });

  const response = await request(app).get('/api/matches/live');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.matches, [
    {
      id: 'live-match',
      name: 'Live match',
      status: 'LIVE',
      updatedAt: '2026-11-14T11:00:00.000Z'
    }
  ]);
});

test('GET /api/matches/:matchId/state identifies only the configured live simulation', async () => {
  const state = {
    matchId: 'live-match',
    name: 'Live match',
    status: 'LIVE',
    ballsPerOver: 6,
    currentInnings: null,
    innings: [],
    updatedAt: '2026-11-15T00:00:00.000Z'
  };
  const app = createApp({
    stateCache: { getOrBuild: async () => state },
    liveReplayManager: {
      isLiveMatchId: (matchId) => matchId === 'live-match',
      startForMatch: async () => ({ status: 'started' })
    }
  });

  const response = await request(app).get('/api/matches/live-match/state');

  assert.equal(response.status, 200);
  assert.equal(response.body.state.isLiveSimulation, true);
});
