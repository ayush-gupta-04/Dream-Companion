import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { createReplayMatch } from '../fixtures/replayMatch.js';

const prisma = {};
mock.module('../../src/db/prisma.js', { exports: { prisma } });
const timelineService = await import('../../src/modules/timeline/timelineService.js');

function usePrisma(client) {
  for (const key of Object.keys(prisma)) delete prisma[key];
  Object.assign(prisma, client);
  return timelineService;
}

function createDelivery(batterRuns) {
  return {
    id: 'delivery-1',
    inningsId: 'innings-1',
    deliverySequence: 1,
    displayOver: 0,
    displayBallLabel: '0.1',
    batterRuns,
    totalRuns: batterRuns,
    wides: 0,
    noBalls: 0,
    byes: 0,
    legByes: 0,
    penaltyRuns: 0,
    occurredAt: null,
    batter: { id: 'batter-1', displayName: 'Batter One' },
    nonStriker: { id: 'partner-1', displayName: 'Partner One' },
    bowler: { id: 'bowler-1', displayName: 'Bowler One' },
    wickets: []
  };
}

test('reconciles a corrected delivery by deleting its obsolete timeline event', async () => {
  const records = [];
  const match = {
    id: 'match-1',
    status: 'LIVE',
    innings: [{ id: 'innings-1', inningsNumber: 1, deliveries: [createDelivery(4)] }]
  };
  let id = 1;
  const transaction = {
    match: { findUnique: async () => match },
    timelineEvent: {
      findMany: async () => records.map((record) => ({ ...record, innings: { inningsNumber: 1 } })),
      create: async ({ data }) => {
        const record = { id: `event-${id++}`, ...data };
        records.push(record);
        return record;
      },
      update: async ({ where, data }) => {
        const index = records.findIndex((record) => record.id === where.id);
        records[index] = { ...records[index], ...data };
        return records[index];
      },
      delete: async ({ where }) => {
        const index = records.findIndex((record) => record.id === where.id);
        return records.splice(index, 1)[0];
      }
    }
  };
  const service = usePrisma({ $transaction: async (operation) => operation(transaction) });

  const created = await service.synchronizeMatch({ matchId: 'match-1' });
  match.innings[0].deliveries = [createDelivery(0)];
  const corrected = await service.synchronizeMatch({ matchId: 'match-1' });

  assert.equal(created.created.length, 1);
  assert.equal(created.created[0].type, 'FOUR');
  assert.equal(corrected.deleted.length, 1);
  assert.equal(corrected.deleted[0].id, created.created[0].id);
  assert.equal(records.length, 0);
});

test('returns a stable, compact timeline response', async () => {
  const occurredAt = new Date('2026-01-01T12:00:00Z');
  const service = usePrisma({
    match: { findUnique: async () => ({ id: 'match-1' }) },
    timelineEvent: {
      findMany: async () => [
        {
          id: 'event-1',
          matchId: 'match-1',
          inningsId: 'innings-1',
          deliveryId: 'delivery-1',
          deliverySequence: 1,
          displayOver: 0,
          displayBallLabel: '0.1',
          eventKey: 'delivery:delivery-1:four',
          eventOrder: 10,
          type: 'FOUR',
          title: 'Four by Batter One',
          description: 'Batter One hit four at 0.1.',
          importanceScore: 35,
          importanceLevel: 'MINOR',
          occurredAt,
          innings: { inningsNumber: 1 }
        }
      ]
    }
  });

  const result = await service.list({ matchId: 'match-1', limit: 50 });

  assert.deepEqual(result, {
    nextCursor: null,
    events: [{
      id: 'event-1', matchId: 'match-1', innings: { id: 'innings-1', number: 1 },
      delivery: { id: 'delivery-1', sequence: 1, display: { overNumber: 0, ballLabel: '0.1' } },
      type: 'FOUR', title: 'Four by Batter One', description: 'Batter One hit four at 0.1.',
      importance: { score: 35, level: 'MINOR' }, occurredAt
    }]
  });
});

test('starting the next innings finalizes only the previous innings and keeps delivery identities separate', async () => {
  const match = createReplayMatch();
  let id = 0;
  const service = usePrisma({
    $transaction: async (operation) => operation({
      match: { findUnique: async () => match },
      timelineEvent: {
        findMany: async () => [],
        create: async ({ data }) => ({ id: `event-${++id}`, ...data })
      }
    })
  });

  const changes = await service.synchronizeMatch({ matchId: match.id });
  assert.deepEqual(changes.created.map((event) => [
    event.innings.number, event.delivery.id, event.type
  ]), [
    [1, 'innings-1-delivery-1', 'SIX'],
    [1, 'innings-1-delivery-3', 'FOUR'],
    [1, 'innings-1-delivery-8', 'WICKET'],
    [1, 'innings-1-delivery-8', 'EXPENSIVE_OVER'],
    [1, 'innings-1-delivery-9', 'MAIDEN_OVER'],
    [2, 'innings-2-delivery-1', 'FOUR'],
    [2, 'innings-2-delivery-2', 'WICKET']
  ]);
  assert.deepEqual(changes.updated, []);
  assert.deepEqual(changes.deleted, []);
});

test('recordDelivery fast-path creates a FOUR event for a boundary without full match query', async () => {
  const delivery = createDelivery(4);
  let upsertedData = null;
  const prismaMock = {
    delivery: {
      findUnique: async () => delivery,
      aggregate: async () => ({ _sum: { batterRuns: 4, totalRuns: 4 } }),
      findFirst: async () => null,
      count: async () => 1
    },
    innings: {
      findUnique: async () => ({ inningsNumber: 1 })
    },
    timelineEvent: {
      upsert: async ({ create }) => {
        upsertedData = { id: 'event-created-1', ...create };
        return upsertedData;
      }
    }
  };

  const service = usePrisma(prismaMock);
  const result = await service.recordDelivery({
    matchId: 'match-1',
    deliveryId: 'delivery-1',
    action: 'created'
  });

  assert.equal(result.created.length, 1);
  assert.equal(result.created[0].type, 'FOUR');
  assert.equal(result.created[0].title, 'Four by Batter One');
  assert.equal(upsertedData.eventKey, 'delivery:delivery-1:four');
});

test('recordDelivery keeps milestone event payloads when a delivery crosses both thresholds', async () => {
  const delivery = createDelivery(1);
  delivery.totalRuns = 1;
  const upsertedEvents = [];
  const prismaMock = {
    delivery: {
      findUnique: async () => delivery,
      aggregate: async ({ _sum }) =>
        _sum.batterRuns ? { _sum: { batterRuns: 50 } } : { _sum: { totalRuns: 50 } },
      findFirst: async ({ orderBy }) => (orderBy?.deliverySequence === 'asc' ? { id: 'delivery-0' } : null),
      count: async () => 0
    },
    innings: {
      findUnique: async () => ({ inningsNumber: 1 })
    },
    timelineEvent: {
      upsert: async ({ create }) => {
        upsertedEvents.push(create);
        return { id: `event-${upsertedEvents.length}`, ...create };
      }
    }
  };

  const service = usePrisma(prismaMock);
  const result = await service.recordDelivery({
    matchId: 'match-1',
    deliveryId: 'delivery-1',
    action: 'created'
  });

  assert.deepEqual(
    result.created.map((event) => event.type),
    ['BATTER_MILESTONE', 'PARTNERSHIP_MILESTONE']
  );
  assert.equal(upsertedEvents[0].eventKey, 'batter-milestone:innings-1:batter-1:50');
  assert.equal(upsertedEvents[1].eventKey, 'partnership-milestone:delivery-0:50');
  assert.equal(
    upsertedEvents[1].description,
    'Batter One and Partner One added 50 runs together at 0.1.'
  );
});

test('recordDelivery fast-path returns empty changes on a dot ball without creating events', async () => {
  const delivery = createDelivery(0);
  delivery.isLegalDelivery = true;
  const prismaMock = {
    delivery: {
      findUnique: async () => delivery,
      aggregate: async () => ({ _sum: { batterRuns: 0, totalRuns: 0 } }),
      findFirst: async () => null,
      count: async () => 2
    },
    innings: {
      findUnique: async () => ({ inningsNumber: 1 })
    },
    timelineEvent: {
      upsert: async () => {
        throw new Error('Should not upsert on dot ball');
      }
    }
  };

  const service = usePrisma(prismaMock);
  const result = await service.recordDelivery({
    matchId: 'match-1',
    deliveryId: 'delivery-1',
    action: 'created'
  });

  assert.equal(result.created.length, 0);
  assert.equal(result.updated.length, 0);
  assert.equal(result.deleted.length, 0);
});

test('recordDelivery falls back to synchronizeMatch when action is corrected', async () => {
  let syncCalled = false;
  const service = usePrisma({
    $transaction: async () => {
      syncCalled = true;
      return { created: [], updated: [{ id: 'updated-1' }], deleted: [] };
    }
  });

  const result = await service.recordDelivery({
    matchId: 'match-1',
    deliveryId: 'delivery-1',
    action: 'corrected'
  });

  assert.equal(syncCalled, true);
  assert.equal(result.updated.length, 1);
});
