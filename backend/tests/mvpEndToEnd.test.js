import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import request from 'supertest';
import { config } from '../src/config/index.js';

const realStateCache = await import('../src/modules/match-intelligence/state/matchStateCache.js');
let activePrisma = {};
let activeStateCache;
let aiClient;
const prismaProxy = new Proxy({}, {
  get(_target, property) {
    const value = activePrisma[property];
    return typeof value === 'function' ? value.bind(activePrisma) : value;
  }
});
mock.module('../src/db/prisma.js', { exports: { prisma: prismaProxy } });
mock.module('../src/modules/match-intelligence/state/matchStateCache.js', {
  exports: {
    getOrBuild: (...args) => activeStateCache.getOrBuild(...args),
    set: (...args) => activeStateCache.set(...args),
    clear: (...args) => activeStateCache.clear(...args)
  }
});
mock.module('../src/modules/ai/geminiMatchQueryClient.js', {
  exports: {
    selectTool: (request) => aiClient.selectTool(request),
    narrateAnalysis: (request) => aiClient.narrateAnalysis(request),
    narrateRecap: (request) => aiClient.narrateRecap(request)
  }
});
const { default: app } = await import('../src/app.js');
const timelineService = await import('../src/modules/timeline/timelineService.js');

describe('MVP End-to-End System Tests', () => {
  const matchId = 'match-mvp-1';
  const playerId = 'player-1';

  const mockDeliveries = [
    {
      id: 'del-1',
      inningsId: 'inn-1',
      deliverySequence: 1,
      displayOver: 0,
      displayBallLabel: '0.1',
      batterId: playerId,
      nonStrikerId: 'batter-2',
      bowlerId: 'bowler-1',
      batterRuns: 4,
      totalRuns: 4,
      totalExtras: 0,
      wides: 0,
      noBalls: 0,
      byes: 0,
      legByes: 0,
      penaltyRuns: 0,
      isLegalDelivery: true,
      occurredAt: null,
      innings: { inningsNumber: 1 },
      batter: { id: playerId, displayName: 'V Kohli' },
      nonStriker: { id: 'batter-2', displayName: 'R Sharma' },
      bowler: { id: 'bowler-1', displayName: 'J Bumrah' },
      wickets: []
    },
    {
      id: 'del-2',
      inningsId: 'inn-1',
      deliverySequence: 2,
      displayOver: 0,
      displayBallLabel: '0.2',
      batterId: playerId,
      nonStrikerId: 'batter-2',
      bowlerId: 'bowler-1',
      batterRuns: 0,
      totalRuns: 0,
      totalExtras: 0,
      wides: 0,
      noBalls: 0,
      byes: 0,
      legByes: 0,
      penaltyRuns: 0,
      isLegalDelivery: true,
      occurredAt: null,
      innings: { inningsNumber: 1 },
      batter: { id: playerId, displayName: 'V Kohli' },
      nonStriker: { id: 'batter-2', displayName: 'R Sharma' },
      bowler: { id: 'bowler-1', displayName: 'J Bumrah' },
      sourceDeliveryId: null,
      sourceRevision: null,
      rawPayload: null,
      wickets: [
        {
          playerOutId: playerId,
          countsAsWicket: true,
          kind: 'bowled',
          playerOut: { id: playerId, displayName: 'V Kohli' }
        }
      ]
    },
    {
      id: 'del-3',
      inningsId: 'inn-1',
      deliverySequence: 3,
      displayOver: 1,
      displayBallLabel: '1.1',
      batterId: 'batter-2',
      nonStrikerId: 'batter-3',
      bowlerId: 'bowler-2',
      batterRuns: 6,
      totalRuns: 6,
      totalExtras: 0,
      wides: 0,
      noBalls: 0,
      byes: 0,
      legByes: 0,
      penaltyRuns: 0,
      isLegalDelivery: true,
      occurredAt: null,
      innings: { inningsNumber: 1 },
      batter: { id: 'batter-2', displayName: 'R Sharma' },
      nonStriker: { id: 'batter-3', displayName: 'KL Rahul' },
      bowler: { id: 'bowler-2', displayName: 'M Shami' },
      wickets: []
    }
  ];

  const mockTimelineRecords = [
    {
      id: 'evt-1',
      matchId,
      inningsId: 'inn-1',
      deliveryId: 'del-1',
      deliverySequence: 1,
      eventOrder: 10,
      displayOver: 0,
      displayBallLabel: '0.1',
      type: 'FOUR',
      eventKey: 'delivery:del-1:four',
      title: 'Four by V Kohli',
      description: 'V Kohli hit four at 0.1.',
      importanceScore: 35,
      importanceLevel: 'MINOR',
      occurredAt: null,
      innings: { inningsNumber: 1 },
      delivery: {
        id: 'del-1',
        sequence: 1,
        display: { overNumber: 0, ballLabel: '0.1' },
        batterId: playerId,
        bowlerId: 'bowler-1',
        wickets: []
      }
    },
    {
      id: 'evt-2',
      matchId,
      inningsId: 'inn-1',
      deliveryId: 'del-2',
      deliverySequence: 2,
      eventOrder: 21,
      displayOver: 0,
      displayBallLabel: '0.2',
      type: 'WICKET',
      eventKey: 'delivery:del-2:wicket:1',
      title: 'Wicket — V Kohli',
      description: 'V Kohli was dismissed bowled at 0.2.',
      importanceScore: 90,
      importanceLevel: 'MAJOR',
      occurredAt: null,
      innings: { inningsNumber: 1 },
      delivery: {
        id: 'del-2',
        sequence: 2,
        display: { overNumber: 0, ballLabel: '0.2' },
        batterId: playerId,
        bowlerId: 'bowler-1',
        wickets: [{ playerOutId: playerId }]
      }
    },
    {
      id: 'evt-3',
      matchId,
      inningsId: 'inn-1',
      deliveryId: 'del-3',
      deliverySequence: 3,
      eventOrder: 10,
      displayOver: 1,
      displayBallLabel: '1.1',
      type: 'SIX',
      eventKey: 'delivery:del-3:six',
      title: 'Six by R Sharma',
      description: 'R Sharma hit six at 1.1.',
      importanceScore: 55,
      importanceLevel: 'HIGHLIGHT',
      occurredAt: null,
      innings: { inningsNumber: 1 },
      delivery: {
        id: 'del-3',
        sequence: 3,
        display: { overNumber: 1, ballLabel: '1.1' },
        batterId: 'batter-2',
        bowlerId: 'bowler-2',
        wickets: []
      }
    }
  ];

  const mockSession = {
    id: 'a558509c-4ebc-4bf0-8c29-3731518f8e0b',
    matchId,
    joinedInningsNumber: 1,
    joinedDeliverySequence: 1,
    joinedAt: new Date(),
    leftAt: null
  };

  const mockPrisma = {
    match: {
      findUnique: async ({ where }) =>
        where.id === matchId
          ? {
              id: matchId,
              name: 'India vs Australia',
              status: 'LIVE',
              ballsPerOver: 6,
              innings: [
                {
                  id: 'inn-1',
                  inningsNumber: 1,
                  battingTeam: { name: 'India' },
                  targetRuns: null,
                  prePenaltyRuns: 0,
                  postPenaltyRuns: 0,
                  deliveries: mockDeliveries
                }
              ]
            }
          : null
    },
    player: {
      findMany: async () => [{ id: playerId, displayName: 'V Kohli' }],
      findFirst: async ({ where }) =>
        where.id === playerId ? { id: playerId, displayName: 'V Kohli' } : null
    },
    innings: {
      findFirst: async () => ({
        id: 'inn-1',
        inningsNumber: 1,
        match: { ballsPerOver: 6 }
      })
    },
    delivery: {
      findMany: async ({ where } = {}) => {
        let list = [...mockDeliveries];
        if (where?.displayOver !== undefined) {
          list = list.filter((d) => d.displayOver === where.displayOver);
        }
        if (where?.OR) {
          list = list.filter((d) =>
            where.OR.some(
              (clause) =>
                (clause.batterId && d.batterId === clause.batterId) ||
                (clause.bowlerId && d.bowlerId === clause.bowlerId)
            )
          );
        }
        return list;
      },
      findFirst: async () => ({
        deliverySequence: 2,
        innings: { inningsNumber: 1 }
      })
    },
    timelineEvent: {
      findMany: async ({ where, take, cursor, skip } = {}) => {
        let list = [...mockTimelineRecords];
        if (where?.type?.in) {
          list = list.filter((e) => where.type.in.includes(e.type));
        }
        if (cursor?.id) {
          const idx = list.findIndex((e) => e.id === cursor.id);
          if (idx !== -1) {
            list = list.slice(idx + (skip ?? 0));
          }
        }
        if (take) {
          list = list.slice(0, take);
        }
        return list;
      },
      findFirst: async ({ where }) => mockTimelineRecords.find((e) => e.id === where?.id) ?? null
    },
    matchSession: {
      create: async ({ data }) => ({
        id: mockSession.id,
        matchId: data.matchId,
        joinedInningsNumber: data.joinedInningsNumber,
        joinedDeliverySequence: data.joinedDeliverySequence,
        joinedAt: mockSession.joinedAt
      }),
      findFirst: async ({ where }) => (where.id === mockSession.id ? mockSession : null),
      updateMany: async ({ where }) => ({ count: where.id === mockSession.id ? 1 : 0 })
    }
  };
  activePrisma = mockPrisma;

  function toolSelection(tool, overrides = {}) {
    return {
      tool,
      inningsNumber: null,
      overNumber: null,
      comparisonOver1: null,
      comparisonOver2: null,
      playerId: null,
      eventTypes: null,
      minimumImportance: null,
      startSequence: null,
      endSequence: null,
      minutes: null,
      overs: null,
      ...overrides
    };
  }

  const mockQueryAi = {
    async selectTool({ query }) {
      if (query.toLowerCase().includes('compare')) {
        return toolSelection('OVER_COMPARISON', {
          inningsNumber: 1,
          comparisonOver1: 0,
          comparisonOver2: 1
        });
      }
      if (query.toLowerCase().includes('kohli') || query.toLowerCase().includes('player')) {
        return toolSelection('PLAYER_ANALYSIS', { playerId });
      }
      if (query.toLowerCase().includes('wicket') || query.toLowerCase().includes('event')) {
        return toolSelection('EVENT_SEARCH', {
          inningsNumber: 1,
          eventTypes: ['WICKET'],
          minimumImportance: 'MAJOR'
        });
      }
      if (query === 'Summarize this over') return toolSelection('LAST_OVER');
      if (query.includes('last 2 overs') || query.includes('2 overs')) {
        return toolSelection('LAST_N_OVERS', { overs: 2 });
      }
      if (query === 'What did I miss?') return toolSelection('SINCE_SESSION_JOIN');
      if (query.toLowerCase().includes('unsupported')) return toolSelection('UNSUPPORTED');
      if (query.toLowerCase().includes('summarize')) return toolSelection('WHOLE_MATCH');
      return toolSelection('OVER_ANALYSIS', { inningsNumber: 1, overNumber: 0 });
    },
    async narrateAnalysis({ query, facts }) {
      return `### Factual match narrative\n\nGrounded answer for "${query}" using ${facts.type ?? 'match data'}.`;
    },
    async narrateRecap({ evidence }) {
      return `### Quick recap\n\nThe selected window had ${evidence.totals.runs} runs and ${evidence.totals.wickets} wickets.`;
    }
  };
  aiClient = mockQueryAi;
  config.gemini.apiKey = 'test-key';

  const stateCache = {
    getOrBuild: async (_matchId, build) => build(),
    set: async () => {},
    clear: async () => {}
  };
  activeStateCache = stateCache;

  describe('MVP Feature 1: Smart Match Timeline', () => {
    test('GET /api/matches/:id/timeline returns chronological events with importance levels', async () => {
      const res = await request(app).get(`/api/matches/${matchId}/timeline?limit=2`);
      assert.equal(res.status, 200);
      assert.equal(Array.isArray(res.body.events), true);
      assert.equal(res.body.events.length, 2);

      const first = res.body.events[0];
      assert.equal(first.type, 'FOUR');
      assert.equal(first.importance.level, 'MINOR');
      assert.equal(first.delivery.display.ballLabel, '0.1');

      const second = res.body.events[1];
      assert.equal(second.type, 'WICKET');
      assert.equal(second.importance.level, 'MAJOR');
      assert.equal(second.delivery.display.ballLabel, '0.2');
    });

    test('GET /api/matches/:id/events/search filters timeline events by type and importance', async () => {
      const res = await request(app).get(
        `/api/matches/${matchId}/events/search?types=WICKET&minimumImportance=MAJOR`
      );
      assert.equal(res.status, 200);
      assert.equal(res.body.type, 'EVENT_SEARCH');
      assert.equal(
        res.body.events.every((e) => e.type === 'WICKET'),
        true
      );
      assert.equal(res.body.references.length > 0, true);
    });

    test('GET /api/matches/:id/timeline supports cursor-based pagination', async () => {
      const firstPage = await request(app).get(`/api/matches/${matchId}/timeline?limit=1`);
      assert.equal(firstPage.status, 200);
      assert.equal(firstPage.body.events.length, 1);
      assert.ok(firstPage.body.nextCursor);

      const secondPage = await request(app).get(
        `/api/matches/${matchId}/timeline?cursor=${firstPage.body.nextCursor}&limit=1`
      );
      assert.equal(secondPage.status, 200);
      assert.equal(secondPage.body.events.length, 1);
      assert.notEqual(secondPage.body.events[0].id, firstPage.body.events[0].id);
    });

    test('GET /api/matches/:id/events/search rejects invalid search sequence bounds with HTTP 400', async () => {
      const res = await request(app).get(
        `/api/matches/${matchId}/events/search?startSequence=10&endSequence=2&innings=1`
      );
      assert.equal(res.status, 400);
      assert.equal(res.body.message, 'Invalid event search request.');
    });
  });

  describe('MVP Feature 2: Catch Me Up through the shared query endpoint', () => {
    test('POST /api/matches/:id/sessions/join creates an authenticated viewer session', async () => {
      const res = await request(app).post(`/api/matches/${matchId}/sessions/join`);
      assert.equal(res.status, 201);
      assert.equal(res.body.session.id, mockSession.id);
      assert.deepEqual(res.body.session.marker, { inningsNumber: 1, deliverySequence: 2 });
    });

    test('returns a WHOLE_MATCH recap with evidence totals', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/query`)
        .send({ query: 'Summarize the whole match' });
      assert.equal(res.status, 200);
      assert.equal(res.body.kind, 'RECAP');
      assert.equal(res.body.tool, 'WHOLE_MATCH');
      assert.equal(res.body.window.type, 'WHOLE_MATCH');
      assert.ok(res.body.answer.includes('Quick recap'));
      assert.equal(res.body.evidence.totals.runs, 10);
      assert.equal(res.body.evidence.totals.wickets, 1);
      assert.equal(res.body.references.length, 3);
    });

    test('returns LAST_OVER bounded to a completed over', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/query`)
        .send({ query: 'Summarize this over' });
      assert.equal(res.status, 200);
      assert.equal(res.body.tool, 'LAST_OVER');
      assert.equal(res.body.window.type, 'LAST_OVER');
      assert.equal(res.body.window.anchor.display.overNumber, 0);
    });

    test('returns LAST_N_OVERS bounded to requested completed overs', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/query`)
        .send({ query: 'Summarize the last 2 overs' });
      assert.equal(res.status, 200);
      assert.equal(res.body.tool, 'LAST_N_OVERS');
      assert.equal(res.body.window.type, 'LAST_N_OVERS');
      assert.ok(res.body.window.overRange);
      assert.equal(res.body.window.overRange.requestedOvers, 2);
    });

    test('returns a SINCE_SESSION_JOIN scoped recap', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/query`)
        .send({ query: 'What did I miss?', sessionId: mockSession.id });
      assert.equal(res.status, 200);
      assert.equal(res.body.tool, 'SINCE_SESSION_JOIN');
      assert.equal(res.body.window.type, 'SINCE_SESSION_JOIN');
      assert.deepEqual(res.body.window.anchor, {
        inningsNumber: 1,
        deliverySequence: 1,
        joinedAt: mockSession.joinedAt.toISOString()
      });
    });

    test('returns limitations for unsupported requests without running a domain tool', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/query`)
        .send({ query: 'Tell me an unsupported joke' });
      assert.equal(res.status, 200);
      assert.equal(res.body.kind, 'UNSUPPORTED');
      assert.equal(res.body.answer, null);
      assert.ok(res.body.limitations.length > 0);
    });

    test('rejects a too-short query with HTTP 400', async () => {
      const res = await request(app).post(`/api/matches/${matchId}/query`).send({ query: 'hi' });
      assert.equal(res.status, 400);
      assert.equal(res.body.message, 'Invalid match query request.');
    });

    test('returns 422 when asking for a session recap without a session', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/query`)
        .send({ query: 'What did I miss?' });
      assert.equal(res.status, 422);
      assert.equal(res.body.message, 'Join the match before asking what you missed.');
    });

    test('POST /api/matches/:id/sessions/leave returns 404 when session is unknown', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/sessions/leave`)
        .send({ sessionId: '00000000-0000-0000-0000-000000000000' });
      assert.equal(res.status, 404);
      assert.equal(res.body.message, 'Active match session not found.');
    });

    test('POST /api/matches/:id/sessions/leave closes the session', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/sessions/leave`)
        .send({ sessionId: mockSession.id });
      assert.equal(res.status, 204);
    });
  });

  describe('MVP Feature 3: Ask the Match through the shared query endpoint', () => {
    test('answers over analysis queries grounded in factual data', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/query`)
        .send({ query: 'Analyse the first over' });
      assert.equal(res.status, 200);
      assert.equal(res.body.kind, 'ANALYSIS');
      assert.equal(res.body.tool, 'OVER_ANALYSIS');
      assert.equal(res.body.evidence.runs, 4);
      assert.equal(res.body.evidence.wickets, 1);
      assert.equal(res.body.references.length, 2);
      assert.ok(res.body.answer.includes('Factual match narrative'));
    });

    test('answers player analysis queries with batting and bowling facts', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/query`)
        .send({ query: 'How did Kohli play today?' });
      assert.equal(res.status, 200);
      assert.equal(res.body.tool, 'PLAYER_ANALYSIS');
      assert.equal(res.body.evidence.player.displayName, 'V Kohli');
      assert.equal(res.body.evidence.batting.runs, 4);
      assert.equal(res.body.evidence.batting.ballsFaced, 2);
    });

    test('answers event-search queries using verified timeline moments', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/query`)
        .send({ query: 'Show me the wickets in this match' });
      assert.equal(res.status, 200);
      assert.equal(res.body.tool, 'EVENT_SEARCH');
      assert.equal(res.body.evidence.events.length > 0, true);
    });

    test('answers over comparisons with directional factual deltas', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/query`)
        .send({ query: 'Compare over 1 and over 2' });
      assert.equal(res.status, 200);
      assert.equal(res.body.tool, 'OVER_COMPARISON');
      assert.equal(res.body.evidence.type, 'OVER_COMPARISON');
      assert.ok(res.body.evidence.deltas);
      assert.equal(typeof res.body.evidence.deltas.runs, 'number');
      assert.ok(res.body.references.length > 0);
    });

    test('rejects a retired detail option with HTTP 400', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/query`)
        .send({ query: 'Summarize the match', detail: 'QUICK' });
      assert.equal(res.status, 400);
      assert.equal(res.body.message, 'Invalid match query request.');
    });

    test('returns 503 when AI is not configured', async () => {
      config.gemini.apiKey = '';
      try {
        const res = await request(app)
          .post(`/api/matches/${matchId}/query`)
          .send({ query: 'Analyse the first over' });
        assert.equal(res.status, 503);
        assert.equal(res.body.message, 'AI features are not configured.');
      } finally {
        config.gemini.apiKey = 'test-key';
      }
    });
  });

  describe('Shared Match Intelligence Engine & State APIs', () => {
    test('GET /api/matches/:id/state returns reconstructed match and innings state', async () => {
      const res = await request(app).get(`/api/matches/${matchId}/state`);
      assert.equal(res.status, 200);
      assert.equal(res.body.state.matchId, matchId);
      assert.equal(res.body.state.innings.length, 1);
      assert.equal(res.body.state.innings[0].state.totalRuns, 10);
      assert.equal(res.body.state.innings[0].state.wickets, 1);
    });

    test('GET /api/matches/:id/analytics/overs/:overNumber returns over breakdown facts', async () => {
      const res = await request(app).get(`/api/matches/${matchId}/analytics/overs/0?innings=1`);
      assert.equal(res.status, 200);
      assert.equal(res.body.analysis.type, 'OVER_ANALYSIS');
      assert.equal(res.body.analysis.runs, 4);
      assert.equal(res.body.analysis.wickets, 1);
      assert.equal(res.body.analysis.overs, '0.2');
    });

    test('GET /api/matches/:id/analytics/players/:playerId returns player statistics', async () => {
      const res = await request(app).get(`/api/matches/${matchId}/analytics/players/${playerId}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.analysis.type, 'PLAYER_ANALYSIS');
      assert.equal(res.body.analysis.player.displayName, 'V Kohli');
      assert.equal(res.body.analysis.batting.runs, 4);
    });

    test('GET /api/matches/:id/analytics/overs/compare returns comparative over analytics', async () => {
      const res = await request(app).get(
        `/api/matches/${matchId}/analytics/overs/compare?innings=1&over1=0&over2=1`
      );
      assert.equal(res.status, 200);
      assert.equal(res.body.analysis.type, 'OVER_COMPARISON');
      assert.equal(res.body.analysis.firstOver.overNumber, 0);
      assert.equal(res.body.analysis.secondOver.overNumber, 1);
      assert.ok(res.body.analysis.deltas);
    });

    test('GET /api/matches/:id/analytics/overs/compare rejects comparing an over with itself', async () => {
      const res = await request(app).get(
        `/api/matches/${matchId}/analytics/overs/compare?innings=1&over1=0&over2=0`
      );
      assert.equal(res.status, 400);
      assert.equal(res.body.message, 'Invalid analytics request.');
    });

    test('GET /api/matches/:id/analytics/players/:playerId returns 404 for unknown player', async () => {
      const res = await request(app).get(
        `/api/matches/${matchId}/analytics/players/unknown-player-id`
      );
      assert.equal(res.status, 404);
      assert.equal(res.body.message, 'Player not found in this match.');
    });
  });

  describe(
    'Live PostgreSQL Database End-to-End Verification',
    { skip: process.env.RUN_DATABASE_TESTS !== 'true' },
    () => {
      test('queries real match data and verifies all MVP endpoints with PostgreSQL and Redis', async () => {
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        activePrisma = prisma;
        const { redisClient: sharedRedisClient } = await import('../src/db/redis.js');
        const { createDelivery } =
          await import('../src/modules/match-intelligence/persistence/deliveryRepository.js');
        const { normalizedDelivery } = await import('./fixtures/normalizedDeliveries.js');

        // Connect to live Redis
        const redisClient = sharedRedisClient;
        let liveStateCache = stateCache;
        try {
          await redisClient.connect();
          liveStateCache = realStateCache;
        } catch {
          // Redis unavailable, keep fallback cache
        }

        // The configured live source intentionally starts without deliveries,
        // so this verification always creates its own complete match fixture.
        let dbMatch = null;
        let createdMatchId = null;

        if (dbMatch === null) {
          // Seed a complete test match with 2 completed overs into PostgreSQL
          const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
          const seededMatch = await prisma.match.create({
            data: {
              name: `Live Integration Match ${suffix}`,
              status: 'COMPLETE',
              ballsPerOver: 6
            }
          });
          createdMatchId = seededMatch.id;

          const [teamA, teamB] = await Promise.all([
            prisma.team.create({ data: { name: `Team A ${suffix}` } }),
            prisma.team.create({ data: { name: `Team B ${suffix}` } })
          ]);

          const [batter, nonStriker, bowler] = await Promise.all([
            prisma.player.create({ data: { displayName: `Batter A ${suffix}` } }),
            prisma.player.create({ data: { displayName: `Batter B ${suffix}` } }),
            prisma.player.create({ data: { displayName: `Bowler A ${suffix}` } })
          ]);

          await Promise.all([
            prisma.matchPlayer.create({
              data: { matchId: seededMatch.id, playerId: batter.id, teamId: teamA.id }
            }),
            prisma.matchPlayer.create({
              data: { matchId: seededMatch.id, playerId: nonStriker.id, teamId: teamA.id }
            }),
            prisma.matchPlayer.create({
              data: { matchId: seededMatch.id, playerId: bowler.id, teamId: teamB.id }
            })
          ]);

          const innings = await prisma.innings.create({
            data: { matchId: seededMatch.id, inningsNumber: 1, battingTeamId: teamA.id }
          });

          // Over 0 (0.1 - 0.6): 1, 0, 4 (FOUR), 1, 0, 0 -> 6 runs, 1 boundary
          const over0Deliveries = [
            { ballLabel: '0.1', runs: 1 },
            { ballLabel: '0.2', runs: 0 },
            { ballLabel: '0.3', runs: 4 },
            { ballLabel: '0.4', runs: 1 },
            { ballLabel: '0.5', runs: 0 },
            { ballLabel: '0.6', runs: 0 }
          ];

          for (let i = 0; i < over0Deliveries.length; i++) {
            await createDelivery(prisma, {
              inningsId: innings.id,
              delivery: normalizedDelivery({
                deliverySequence: i + 1,
                display: { overNumber: 0, ballLabel: over0Deliveries[i].ballLabel },
                players: {
                  batterId: batter.id,
                  nonStrikerId: nonStriker.id,
                  bowlerId: bowler.id
                },
                runs: { batter: over0Deliveries[i].runs, total: over0Deliveries[i].runs }
              })
            });
          }

          // Over 1 (1.1 - 1.6): 6 (SIX), 1, 0, Wicket, 2, 1 -> 10 runs, 1 six, 1 wicket
          const over1Deliveries = [
            { ballLabel: '1.1', runs: 6, wickets: [] },
            { ballLabel: '1.2', runs: 1, wickets: [] },
            { ballLabel: '1.3', runs: 0, wickets: [] },
            {
              ballLabel: '1.4',
              runs: 0,
              wickets: [{ playerOutId: batter.id, kind: 'bowled', countsAsWicket: true }]
            },
            { ballLabel: '1.5', runs: 2, wickets: [] },
            { ballLabel: '1.6', runs: 1, wickets: [] }
          ];

          for (let i = 0; i < over1Deliveries.length; i++) {
            await createDelivery(prisma, {
              inningsId: innings.id,
              delivery: normalizedDelivery({
                deliverySequence: over0Deliveries.length + i + 1,
                display: { overNumber: 1, ballLabel: over1Deliveries[i].ballLabel },
                players: {
                  batterId: batter.id,
                  nonStrikerId: nonStriker.id,
                  bowlerId: bowler.id
                },
                runs: { batter: over1Deliveries[i].runs, total: over1Deliveries[i].runs },
                wickets: over1Deliveries[i].wickets
              })
            });
          }

          // Synchronize timeline events
          await timelineService.synchronizeMatch({ matchId: seededMatch.id });

          dbMatch = {
            id: seededMatch.id,
            players: [{ player: batter }]
          };
        }

        try {
          activeStateCache = liveStateCache;

          // 1. State API + Redis Caching Verification
          const stateRes = await request(app).get(`/api/matches/${dbMatch.id}/state`);
          assert.equal(stateRes.status, 200);
          assert.ok(stateRes.body.state.innings.length >= 1);

          if (redisClient?.isOpen) {
            const cached = await redisClient.get(`match:${dbMatch.id}:state`);
            assert.ok(cached, 'Match state should be cached in Redis');
            const parsed = JSON.parse(cached);
            assert.equal(parsed.matchId, dbMatch.id);

            // Second request should hit Redis cache
            const cachedRes = await request(app).get(`/api/matches/${dbMatch.id}/state`);
            assert.equal(cachedRes.status, 200);
            assert.equal(cachedRes.body.state.matchId, dbMatch.id);
          }

          // 2. Smart Match Timeline API
          const timelineRes = await request(app).get(
            `/api/matches/${dbMatch.id}/timeline?limit=5`
          );
          assert.equal(timelineRes.status, 200);
          assert.ok(timelineRes.body.events.length > 0);

          // 3. Catch Me Up through the shared query endpoint
          const recapRes = await request(app)
            .post(`/api/matches/${dbMatch.id}/query`)
            .send({ query: 'Summarize the whole match' });
          assert.equal(recapRes.status, 200);
          assert.equal(recapRes.body.evidence.totals.runs > 0, true);

          const recapLastNOvers = await request(app)
            .post(`/api/matches/${dbMatch.id}/query`)
            .send({ query: 'Summarize the last 2 overs' });
          assert.equal(recapLastNOvers.status, 200);
          assert.equal(recapLastNOvers.body.tool, 'LAST_N_OVERS');
          assert.equal(recapLastNOvers.body.window.overRange.requestedOvers, 2);

          // 4. Authenticated Match-Session Join & Leave
          const joinRes = await request(app)
            .post(`/api/matches/${dbMatch.id}/sessions/join`)
            .send({});
          assert.equal(joinRes.status, 201);
          assert.ok(joinRes.body.session?.id);

          const leaveRes = await request(app)
            .post(`/api/matches/${dbMatch.id}/sessions/leave`)
            .send({ sessionId: joinRes.body.session.id });
          assert.equal(leaveRes.status, 204);

          // 5. Ask the Match through the shared query endpoint
          const askRes = await request(app)
            .post(`/api/matches/${dbMatch.id}/query`)
            .send({ query: 'Analyse the first over' });
          assert.equal(askRes.status, 200);
          assert.equal(askRes.body.tool, 'OVER_ANALYSIS');
          assert.ok(askRes.body.evidence?.runs !== undefined);

          // 6. Over Comparison Analytics API
          const compareRes = await request(app).get(
            `/api/matches/${dbMatch.id}/analytics/overs/compare?innings=1&over1=0&over2=1`
          );
          assert.equal(compareRes.status, 200);
          assert.equal(compareRes.body.analysis.type, 'OVER_COMPARISON');
          assert.ok(compareRes.body.analysis.deltas);

          // 7. Event Search API
          const searchRes = await request(app).get(
            `/api/matches/${dbMatch.id}/events/search?types=FOUR,SIX&minimumImportance=HIGHLIGHT`
          );
          assert.equal(searchRes.status, 200);
          assert.equal(searchRes.body.type, 'EVENT_SEARCH');
          assert.ok(Array.isArray(searchRes.body.events));

          // 8. Player Analytics API
          if (dbMatch.players?.[0]?.player?.id) {
            const playerId = dbMatch.players[0].player.id;
            const playerRes = await request(app).get(
              `/api/matches/${dbMatch.id}/analytics/players/${playerId}`
            );
            assert.equal(playerRes.status, 200);
            assert.equal(playerRes.body.analysis.type, 'PLAYER_ANALYSIS');
          }
        } finally {
          if (liveStateCache && createdMatchId) {
            await liveStateCache.clear(createdMatchId);
          }
          if (createdMatchId) {
            await prisma.match.delete({ where: { id: createdMatchId } });
          }
          if (redisClient?.isOpen) {
            await redisClient.quit();
          }
          await prisma.$disconnect();
          activePrisma = mockPrisma;
          activeStateCache = stateCache;
        }
      });
    }
  );
});
