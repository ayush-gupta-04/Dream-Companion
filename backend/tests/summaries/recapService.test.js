import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { config } from '../../src/config/index.js';
import { executeRecapTool } from '../../src/modules/summaries/recapToolExecutor.js';

const prisma = {};
let narrate;
let runTool;
mock.module('../../src/db/prisma.js', { exports: { prisma } });
mock.module('../../src/modules/ai/geminiMatchQueryClient.js', {
  exports: { narrateRecap: (request) => narrate(request) }
});
mock.module('../../src/modules/summaries/recapToolExecutor.js', {
  exports: { executeRecapTool: (request) => runTool(request) }
});
const { join, leave, executeRecap } = await import('../../src/modules/summaries/recapService.js');

function useRecapDependencies({ prisma: database, narrate: narrator, executeTool = executeRecapTool }) {
  for (const key of Object.keys(prisma)) delete prisma[key];
  Object.assign(prisma, database);
  narrate = narrator;
  runTool = executeTool;
  config.gemini.apiKey = narrator ? 'test-key' : '';
  return { join, leave, execute: executeRecap };
}

function storedDelivery({ sequence, over, runs = 0, wicket = false }) {
  return {
    id: `delivery-${sequence}`,
    inningsId: 'innings-1',
    deliverySequence: sequence,
    displayOver: over,
    displayBallLabel: `0.${sequence}`,
    batterRuns: runs,
    totalRuns: runs,
    wides: 0,
    noBalls: 0,
    byes: 0,
    legByes: 0,
    penaltyRuns: 0,
    occurredAt: null,
    innings: { inningsNumber: 1 },
    batter: { id: 'batter-1', displayName: 'Batter One' },
    bowler: { id: 'bowler-1', displayName: 'Bowler One' },
    wickets: wicket
      ? [
          {
            countsAsWicket: true,
            kind: 'bowled',
            playerOut: { id: 'player-out', displayName: 'Player Out' }
          }
        ]
      : []
  };
}

function recapTool(tool, overrides = {}) {
  return { tool, minutes: null, overs: null, ...overrides };
}

test('builds deterministic recap evidence before concise narration', async () => {
  const deliveries = [
    storedDelivery({ sequence: 1, over: 0, runs: 1 }),
    storedDelivery({ sequence: 2, over: 0, runs: 4 }),
    storedDelivery({ sequence: 3, over: 1, runs: 6 })
  ];
  const service = useRecapDependencies({
    prisma: {
      match: { findUnique: async () => ({ id: 'match-1', status: 'LIVE' }) },
      delivery: { findMany: async () => deliveries }
    },
    narrate: async ({ evidence }) => {
      assert.deepEqual(evidence.totals, {
        runs: 11,
        wickets: 0,
        fours: 1,
        sixes: 1,
        dots: 0,
        extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penaltyRuns: 0 }
      });
      assert.equal(evidence.notableEvents.length, 2);
      return {
        headline: 'Fast scoring',
        summary: 'Eleven came quickly.',
        bullets: ['A four.', 'A six.']
      };
    },
    executeTool: (input) => {
      assert.deepEqual(input.tool, recapTool('WHOLE_MATCH'));
      return executeRecapTool(input);
    }
  });

  const result = await service.execute({
    matchId: 'match-1',
    request: { query: 'Summarize the whole match' },
    tool: recapTool('WHOLE_MATCH')
  });

  assert.equal(result.tool, 'WHOLE_MATCH');
  assert.equal(result.recap.headline, 'Fast scoring');
  assert.equal(result.recap.factReferences.length, 3);
  assert.equal(result.evidence.totals.runs, 11);
});

test('does not narrate a timestamp-less unavailable time window', async () => {
  const service = useRecapDependencies({
    prisma: {
      match: { findUnique: async () => ({ id: 'match-1', status: 'LIVE' }) },
      delivery: { findMany: async () => [storedDelivery({ sequence: 1, over: 0 })] }
    },
    narrate: async () => assert.fail('Unexpected narration')
  });

  const result = await service.execute({
    matchId: 'match-1',
    request: { query: 'Summarize the last 10 minutes' },
    tool: recapTool('LAST_N_MINUTES', { minutes: 10 })
  });

  assert.equal(result.window.availability, 'UNAVAILABLE');
  assert.equal(result.recap, null);
});

test('builds evidence for the just-ended completed over before narration', async () => {
  const deliveries = [
    storedDelivery({ sequence: 1, over: 0, runs: 1 }),
    storedDelivery({ sequence: 2, over: 0, runs: 4 }),
    storedDelivery({ sequence: 3, over: 1, runs: 6 })
  ];
  const service = useRecapDependencies({
    prisma: {
      match: { findUnique: async () => ({ id: 'match-1', status: 'LIVE' }) },
      delivery: { findMany: async () => deliveries }
    },
    narrate: async ({ evidence }) => {
      assert.equal(evidence.totals.runs, 5);
      assert.equal(evidence.window.overRange.startOverNumber, 0);
      return {
        headline: 'Completed over',
        summary: 'Five runs came from the over.',
        bullets: ['A four.']
      };
    }
  });

  const result = await service.execute({
    matchId: 'match-1',
    request: { query: 'Summarize this over' },
    tool: recapTool('LAST_OVER')
  });

  assert.equal(result.window.type, 'LAST_OVER');
  assert.equal(result.window.deliveryRange.deliveryCount, 2);
  assert.equal(result.evidence.totals.runs, 5);
});

test('rebuilds recap evidence after a corrected delivery instead of using a stale summary', async () => {
  let deliveries = [storedDelivery({ sequence: 1, over: 0, runs: 1 })];
  const service = useRecapDependencies({
    prisma: {
      match: { findUnique: async () => ({ id: 'match-1', status: 'LIVE' }) },
      delivery: { findMany: async () => deliveries }
    },
    narrate: async () => ({ headline: 'Recap', summary: 'Verified.', bullets: ['Verified.'] })
  });

  const request = {
    matchId: 'match-1',
    request: { query: 'Summarize the whole match' },
    tool: recapTool('WHOLE_MATCH')
  };
  const first = await service.execute(request);
  deliveries = [storedDelivery({ sequence: 1, over: 0, runs: 4 })];
  const corrected = await service.execute(request);

  assert.equal(first.evidence.totals.runs, 1);
  assert.equal(corrected.evidence.totals.runs, 4);
});

test('creates a session marker at the latest stable match position', async () => {
  let created;
  const service = useRecapDependencies({
    prisma: {
      match: { findUnique: async () => ({ id: 'match-1', status: 'LIVE' }) },
      delivery: {
        findFirst: async () => ({
          deliverySequence: 8,
          innings: { inningsNumber: 2 }
        })
      },
      matchSession: {
        create: async ({ data }) => {
          created = data;
          return {
            id: 'a998c18b-075a-4c6d-85a1-77382ebea8d5',
            ...data,
            joinedAt: new Date('2026-11-14T10:00:00.000Z')
          };
        }
      }
    },
    narrate: null
  });

  const session = await service.join({
    matchId: 'match-1',
    viewer: { userId: 'user_123', sessionId: 'sess_123' }
  });

  assert.deepEqual(created, {
    matchId: 'match-1',
    clerkUserId: 'user_123',
    clerkSessionId: 'sess_123',
    joinedInningsNumber: 2,
    joinedDeliverySequence: 8
  });
  assert.deepEqual(session.marker, { inningsNumber: 2, deliverySequence: 8 });
});

test("does not resolve another Clerk user's active session", async () => {
  let sessionLookup;
  const service = useRecapDependencies({
    prisma: {
      matchSession: {
        findFirst: async ({ where }) => {
          sessionLookup = where;
          return null;
        }
      }
    },
    narrate: async () => assert.fail('Unexpected narration')
  });

  await assert.rejects(
    () =>
      service.execute({
        matchId: 'match-1',
        match: { id: 'match-1', status: 'LIVE' },
        request: {
          query: 'What did I miss?',
          sessionId: 'a998c18b-075a-4c6d-85a1-77382ebea8d5'
        },
        tool: recapTool('SINCE_SESSION_JOIN'),
        viewer: { userId: 'user_other', sessionId: 'sess_other' }
      }),
    /Active match session not found/
  );

  assert.equal(sessionLookup.clerkUserId, 'user_other');
});
