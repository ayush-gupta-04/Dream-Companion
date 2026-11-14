import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRecapService } from '../../src/modules/summaries/recapService.js';
import { executeRecapTool } from '../../src/modules/summaries/recapToolExecutor.js';

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

test('selects an allow-listed tool, builds deterministic evidence, then narrates it', async () => {
  const deliveries = [
    storedDelivery({ sequence: 1, over: 0, runs: 1 }),
    storedDelivery({ sequence: 2, over: 0, runs: 4 }),
    storedDelivery({ sequence: 3, over: 1, runs: 6 })
  ];
  const aiClient = {
    resolveIntent: async ({ query, sessionId }) => {
      assert.equal(query, 'Summarize the whole match');
      assert.equal(sessionId, undefined);
      return { tool: 'WHOLE_MATCH', minutes: null, overs: null };
    },
    narrate: async ({ detail, evidence }) => {
      assert.equal(detail, 'QUICK');
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
    }
  };
  const service = createRecapService({
    prisma: {
      match: { findUnique: async () => ({ id: 'match-1', status: 'LIVE' }) },
      delivery: { findMany: async () => deliveries }
    },
    aiClient,
    executeTool: (input) => {
      assert.deepEqual(input.tool, { tool: 'WHOLE_MATCH', minutes: null, overs: null });
      return executeRecapTool(input);
    }
  });

  const result = await service.summarize({
    matchId: 'match-1',
    request: { query: 'Summarize the whole match', detail: 'QUICK' }
  });

  assert.equal(result.intent, 'WHOLE_MATCH');
  assert.equal(result.recap.headline, 'Fast scoring');
  assert.equal(result.recap.factReferences.length, 3);
  assert.equal(result.evidence.totals.runs, 11);
});

test('does not call the model when a timestamp-less time window is unavailable', async () => {
  const service = createRecapService({
    prisma: {
      match: { findUnique: async () => ({ id: 'match-1', status: 'LIVE' }) },
      delivery: { findMany: async () => [storedDelivery({ sequence: 1, over: 0 })] }
    },
    aiClient: {
      resolveIntent: async () => ({ tool: 'LAST_N_MINUTES', minutes: 10, overs: null }),
      narrate: async () => assert.fail('Unexpected narration')
    }
  });

  const result = await service.summarize({
    matchId: 'match-1',
    request: { query: 'Summarize the last 10 minutes', detail: 'QUICK' }
  });

  assert.equal(result.window.availability, 'UNAVAILABLE');
  assert.equal(result.recap, null);
});

test('builds recap evidence for the just-ended over before narration', async () => {
  const deliveries = [
    storedDelivery({ sequence: 1, over: 0, runs: 1 }),
    storedDelivery({ sequence: 2, over: 0, runs: 4 }),
    storedDelivery({ sequence: 3, over: 1, runs: 6 })
  ];
  const service = createRecapService({
    prisma: {
      match: { findUnique: async () => ({ id: 'match-1', status: 'LIVE' }) },
      delivery: { findMany: async () => deliveries }
    },
    aiClient: {
      resolveIntent: async () => ({ tool: 'LAST_OVER', minutes: null, overs: null }),
      narrate: async ({ evidence }) => {
        assert.equal(evidence.totals.runs, 5);
        assert.equal(evidence.window.overRange.startOverNumber, 0);
        return {
          headline: 'Completed over',
          summary: 'Five runs came from the over.',
          bullets: ['A four.']
        };
      }
    }
  });

  const result = await service.summarize({
    matchId: 'match-1',
    request: { query: 'Summarize this over', detail: 'QUICK' }
  });

  assert.equal(result.window.type, 'LAST_OVER');
  assert.equal(result.window.deliveryRange.deliveryCount, 2);
  assert.equal(result.evidence.totals.runs, 5);
});

test('rebuilds recap evidence after a corrected delivery instead of returning a stale summary', async () => {
  let deliveries = [storedDelivery({ sequence: 1, over: 0, runs: 1 })];
  const service = createRecapService({
    prisma: {
      match: { findUnique: async () => ({ id: 'match-1', status: 'LIVE' }) },
      delivery: { findMany: async () => deliveries }
    },
    aiClient: {
      resolveIntent: async () => ({ tool: 'WHOLE_MATCH', minutes: null, overs: null }),
      narrate: async () => ({ headline: 'Recap', summary: 'Verified.', bullets: ['Verified.'] })
    }
  });

  const first = await service.summarize({
    matchId: 'match-1',
    request: { query: 'Summarize the whole match', detail: 'QUICK' }
  });
  deliveries = [storedDelivery({ sequence: 1, over: 0, runs: 4 })];
  const corrected = await service.summarize({
    matchId: 'match-1',
    request: { query: 'Summarize the whole match', detail: 'QUICK' }
  });

  assert.equal(first.evidence.totals.runs, 1);
  assert.equal(corrected.evidence.totals.runs, 4);
});

test('does not resolve deliveries or narrate when the selected tool is unsupported', async () => {
  const service = createRecapService({
    prisma: {
      match: { findUnique: async () => ({ id: 'match-1', status: 'LIVE' }) },
      delivery: { findMany: async () => assert.fail('Unexpected deterministic tool preparation') }
    },
    aiClient: {
      resolveIntent: async () => ({ tool: 'UNSUPPORTED', minutes: null, overs: null }),
      narrate: async () => assert.fail('Unexpected narration')
    }
  });

  const result = await service.summarize({
    matchId: 'match-1',
    request: { query: 'Explain the captaincy strategy in detail', detail: 'QUICK' }
  });

  assert.equal(result.intent, 'UNSUPPORTED');
  assert.equal(result.recap, null);
  assert.equal(result.window, null);
});

test('creates a session marker at the latest stable match position', async () => {
  let created;
  const service = createRecapService({
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
    aiClient: null
  });

  const session = await service.join({ matchId: 'match-1' });

  assert.deepEqual(created, {
    matchId: 'match-1',
    joinedInningsNumber: 2,
    joinedDeliverySequence: 8
  });
  assert.deepEqual(session.marker, { inningsNumber: 2, deliverySequence: 8 });
});
