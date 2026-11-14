import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createAskMatchService } from '../src/modules/ai/askMatchService.js';
import { createRecapService } from '../src/modules/summaries/recapService.js';
import { createTimelineService } from '../src/modules/timeline/timelineService.js';
import { createEventSearchService } from '../src/modules/timeline/eventSearchService.js';
import { MatchStateCache } from '../src/modules/match-intelligence/state/matchStateCache.js';

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

  const mockAskAi = {
    async resolveIntent({ question }) {
      if (question.toLowerCase().includes('compare')) {
        return {
          intent: 'OVER_COMPARISON',
          inningsNumber: 1,
          overNumber: null,
          comparisonOver1: 0,
          comparisonOver2: 1,
          playerId: null,
          eventTypes: null,
          minimumImportance: null,
          startSequence: null,
          endSequence: null
        };
      }
      if (question.toLowerCase().includes('kohli') || question.toLowerCase().includes('player')) {
        return {
          intent: 'PLAYER_ANALYSIS',
          inningsNumber: 1,
          overNumber: null,
          comparisonOver1: null,
          comparisonOver2: null,
          playerId,
          eventTypes: null,
          minimumImportance: null,
          startSequence: null,
          endSequence: null
        };
      }
      if (question.toLowerCase().includes('wicket') || question.toLowerCase().includes('event')) {
        return {
          intent: 'EVENT_SEARCH',
          inningsNumber: 1,
          overNumber: null,
          comparisonOver1: null,
          comparisonOver2: null,
          playerId: null,
          eventTypes: ['WICKET'],
          minimumImportance: 'MAJOR',
          startSequence: null,
          endSequence: null
        };
      }
      if (question.toLowerCase().includes('unsupported')) {
        return {
          intent: 'UNSUPPORTED',
          inningsNumber: null,
          overNumber: null,
          comparisonOver1: null,
          comparisonOver2: null,
          playerId: null,
          eventTypes: null,
          minimumImportance: null,
          startSequence: null,
          endSequence: null
        };
      }
      return {
        intent: 'OVER_ANALYSIS',
        inningsNumber: 1,
        overNumber: 0,
        comparisonOver1: null,
        comparisonOver2: null,
        playerId: null,
        eventTypes: null,
        minimumImportance: null,
        startSequence: null,
        endSequence: null
      };
    },
    async narrate({ question, facts }) {
      return {
        headline: 'Factual match narrative',
        analysis: `Grounded answer for "${question}" using ${facts.type ?? 'match data'}.`
      };
    }
  };

  const mockRecapAi = {
    async resolveIntent({ query }) {
      if (query === 'Summarize this over') {
        return { tool: 'LAST_OVER', minutes: null, overs: null };
      }
      if (query.includes('last 2 overs') || query.includes('2 overs')) {
        return { tool: 'LAST_N_OVERS', minutes: null, overs: 2 };
      }
      if (query === 'What did I miss?') {
        return { tool: 'SINCE_SESSION_JOIN', minutes: null, overs: null };
      }
      if (query.toLowerCase().includes('unsupported')) {
        return { tool: 'UNSUPPORTED', minutes: null, overs: null };
      }
      return { tool: 'WHOLE_MATCH', minutes: null, overs: null };
    },
    async narrate({ detail, evidence }) {
      return {
        headline: `Recap (${detail}) for match`,
        summary: `The selected window had ${evidence.totals.runs} runs and ${evidence.totals.wickets} wickets.`,
        bullets: ['Key boundary scored', 'Key dismissal recorded']
      };
    }
  };

  const stateCache = new MatchStateCache({
    get: async () => null,
    set: async () => {},
    del: async () => {}
  });

  const app = createApp({
    stateCache,
    prismaClient: mockPrisma,
    askMatchService: createAskMatchService({ prisma: mockPrisma, aiClient: mockAskAi }),
    recapService: createRecapService({ prisma: mockPrisma, aiClient: mockRecapAi }),
    timelineService: createTimelineService({ prisma: mockPrisma }),
    eventSearchService: createEventSearchService({ prisma: mockPrisma })
  });

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

  describe('MVP Feature 2: Catch Me Up (Summaries & Session Markers)', () => {
    test('POST /api/matches/:id/sessions/join creates an anonymous viewer session', async () => {
      const res = await request(app).post(`/api/matches/${matchId}/sessions/join`);
      assert.equal(res.status, 201);
      assert.equal(res.body.session.id, mockSession.id);
      assert.deepEqual(res.body.session.marker, { inningsNumber: 1, deliverySequence: 2 });
    });

    test('POST /api/matches/:id/summaries returns WHOLE_MATCH recap with evidence totals', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/summaries`)
        .send({ query: 'Summarize the whole match', detail: 'QUICK' });
      assert.equal(res.status, 200);
      assert.equal(res.body.intent, 'WHOLE_MATCH');
      assert.equal(res.body.window.type, 'WHOLE_MATCH');
      assert.equal(res.body.recap.headline, 'Recap (QUICK) for match');
      assert.equal(res.body.evidence.totals.runs, 10);
      assert.equal(res.body.evidence.totals.wickets, 1);
      assert.equal(res.body.recap.factReferences.length, 3);
    });

    test('POST /api/matches/:id/summaries returns LAST_OVER recap bounded to completed over', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/summaries`)
        .send({ query: 'Summarize this over', detail: 'QUICK' });
      assert.equal(res.status, 200);
      assert.equal(res.body.intent, 'LAST_OVER');
      assert.equal(res.body.window.type, 'LAST_OVER');
      assert.equal(res.body.window.anchor.display.overNumber, 0);
    });

    test('POST /api/matches/:id/summaries returns LAST_N_OVERS recap bounded to requested completed overs', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/summaries`)
        .send({ query: 'Summarize the last 2 overs', detail: 'QUICK' });
      assert.equal(res.status, 200);
      assert.equal(res.body.intent, 'LAST_N_OVERS');
      assert.equal(res.body.window.type, 'LAST_N_OVERS');
      assert.ok(res.body.window.overRange);
      assert.equal(res.body.window.overRange.requestedOvers, 2);
    });

    test('POST /api/matches/:id/summaries returns SINCE_SESSION_JOIN scoped recap', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/summaries`)
        .send({ query: 'What did I miss?', sessionId: mockSession.id, detail: 'QUICK' });
      assert.equal(res.status, 200);
      assert.equal(res.body.intent, 'SINCE_SESSION_JOIN');
      assert.equal(res.body.window.type, 'SINCE_SESSION_JOIN');
      assert.deepEqual(res.body.window.anchor, {
        inningsNumber: 1,
        deliverySequence: 1,
        joinedAt: mockSession.joinedAt.toISOString()
      });
    });

    test('POST /api/matches/:id/summaries returns limitations for unsupported recap requests', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/summaries`)
        .send({ query: 'Tell me an unsupported joke', detail: 'QUICK' });
      assert.equal(res.status, 200);
      assert.equal(res.body.intent, 'UNSUPPORTED');
      assert.equal(res.body.recap, null);
      assert.ok(res.body.limitations.length > 0);
    });

    test('POST /api/matches/:id/summaries rejects query that is too short with HTTP 400', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/summaries`)
        .send({ query: 'hi' });
      assert.equal(res.status, 400);
      assert.equal(res.body.message, 'Invalid Catch Me Up request.');
    });

    test('POST /api/matches/:id/summaries returns 422 when asking for session recap without session', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/summaries`)
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

  describe('MVP Feature 3: Ask the Match (Grounded AI Answers)', () => {
    test('POST /api/matches/:id/ask answers over analysis queries grounded in factual data', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/ask`)
        .send({ question: 'Analyse the first over' });
      assert.equal(res.status, 200);
      assert.equal(res.body.intent, 'OVER_ANALYSIS');
      assert.equal(res.body.facts.runs, 4);
      assert.equal(res.body.facts.wickets, 1);
      assert.equal(res.body.answer.factReferences.length, 2);
      assert.equal(res.body.answer.headline, 'Factual match narrative');
    });

    test('POST /api/matches/:id/ask answers player analysis queries with batting & bowling facts', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/ask`)
        .send({ question: 'How did Kohli play today?' });
      assert.equal(res.status, 200);
      assert.equal(res.body.intent, 'PLAYER_ANALYSIS');
      assert.equal(res.body.facts.player.displayName, 'V Kohli');
      assert.equal(res.body.facts.batting.runs, 4);
      assert.equal(res.body.facts.batting.ballsFaced, 2);
    });

    test('POST /api/matches/:id/ask answers event search queries using verified timeline moments', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/ask`)
        .send({ question: 'Show me the wickets in this match' });
      assert.equal(res.status, 200);
      assert.equal(res.body.intent, 'EVENT_SEARCH');
      assert.equal(res.body.facts.events.length > 0, true);
    });

    test('POST /api/matches/:id/ask answers over comparison queries with directional factual deltas', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/ask`)
        .send({ question: 'Compare over 1 and over 2' });
      assert.equal(res.status, 200);
      assert.equal(res.body.intent, 'OVER_COMPARISON');
      assert.equal(res.body.facts.type, 'OVER_COMPARISON');
      assert.ok(res.body.facts.deltas);
      assert.equal(typeof res.body.facts.deltas.runs, 'number');
      assert.ok(res.body.answer.factReferences.length > 0);
    });

    test('POST /api/matches/:id/ask rejects missing or too short questions with HTTP 400', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/ask`)
        .send({ question: 'hi' });
      assert.equal(res.status, 400);
      assert.equal(res.body.message, 'Invalid Ask the Match request.');
    });

    test('POST /api/matches/:id/ask handles unsupported queries without calling tools', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/ask`)
        .send({ question: 'What is the weather like tomorrow in London? (unsupported)' });
      assert.equal(res.status, 200);
      assert.equal(res.body.intent, 'UNSUPPORTED');
      assert.equal(res.body.facts, null);
    });

    test('POST /api/matches/:id/ask returns 503 when AI is not configured', async () => {
      const unconfiguredApp = createApp({
        stateCache,
        prismaClient: mockPrisma,
        askMatchService: createAskMatchService({ prisma: mockPrisma, aiClient: null })
      });
      const res = await request(unconfiguredApp)
        .post(`/api/matches/${matchId}/ask`)
        .send({ question: 'Analyse the first over' });
      assert.equal(res.status, 503);
      assert.equal(res.body.message, 'AI features are not configured.');
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
      test('queries real Cricsheet match data through all MVP endpoints', async () => {
        const { prisma } = await import('../src/db/prisma.js');
        const dbMatch = await prisma.match.findFirst({
          where: { sourceMatchId: '1001349' },
          include: { players: { include: { player: true }, take: 1 } }
        });

        if (!dbMatch) return;

        const liveApp = createApp({
          stateCache,
          prismaClient: prisma,
          askMatchService: createAskMatchService({ prisma, aiClient: mockAskAi }),
          recapService: createRecapService({ prisma, aiClient: mockRecapAi }),
          timelineService: createTimelineService({ prisma }),
          eventSearchService: createEventSearchService({ prisma })
        });

        // 1. State
        const stateRes = await request(liveApp).get(`/api/matches/${dbMatch.id}/state`);
        assert.equal(stateRes.status, 200);
        assert.equal(stateRes.body.state.innings.length, 2);

        // 2. Timeline
        const timelineRes = await request(liveApp).get(
          `/api/matches/${dbMatch.id}/timeline?limit=5`
        );
        assert.equal(timelineRes.status, 200);
        assert.equal(timelineRes.body.events.length, 5);

        // 3. Catch Me Up (Whole Match and Last N Overs)
        const recapRes = await request(liveApp)
          .post(`/api/matches/${dbMatch.id}/summaries`)
          .send({ query: 'Summarize the whole match', detail: 'QUICK' });
        assert.equal(recapRes.status, 200);
        assert.equal(recapRes.body.evidence.totals.runs > 0, true);

        const recapLastNOvers = await request(liveApp)
          .post(`/api/matches/${dbMatch.id}/summaries`)
          .send({ query: 'Summarize the last 2 overs', detail: 'QUICK' });
        assert.equal(recapLastNOvers.status, 200);
        assert.equal(recapLastNOvers.body.intent, 'LAST_N_OVERS');
        assert.equal(recapLastNOvers.body.window.overRange.requestedOvers, 2);

        // 4. Ask the Match
        const askRes = await request(liveApp)
          .post(`/api/matches/${dbMatch.id}/ask`)
          .send({ question: 'Analyse the first over' });
        assert.equal(askRes.status, 200);
        assert.equal(askRes.body.intent, 'OVER_ANALYSIS');

        // 5. Over Comparison
        const compareRes = await request(liveApp).get(
          `/api/matches/${dbMatch.id}/analytics/overs/compare?innings=1&over1=0&over2=1`
        );
        assert.equal(compareRes.status, 200);
        assert.equal(compareRes.body.analysis.type, 'OVER_COMPARISON');
        assert.ok(compareRes.body.analysis.deltas);

        // 6. Event Search
        const searchRes = await request(liveApp).get(
          `/api/matches/${dbMatch.id}/events/search?types=FOUR,SIX&minimumImportance=HIGHLIGHT`
        );
        assert.equal(searchRes.status, 200);
        assert.equal(searchRes.body.type, 'EVENT_SEARCH');
        assert.ok(Array.isArray(searchRes.body.events));

        // 7. Player Analytics
        if (dbMatch.players?.[0]?.player?.id) {
          const playerId = dbMatch.players[0].player.id;
          const playerRes = await request(liveApp).get(
            `/api/matches/${dbMatch.id}/analytics/players/${playerId}`
          );
          assert.equal(playerRes.status, 200);
          assert.equal(playerRes.body.analysis.type, 'PLAYER_ANALYSIS');
        }

        await prisma.$disconnect();
      });
    }
  );
});
