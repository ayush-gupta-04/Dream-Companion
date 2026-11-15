import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { createReplayMatch, replayPlayers, storedDelivery } from '../fixtures/replayMatch.js';
import {
  applyDeliveryToTimelineState,
  createTimelineState
} from '../../src/modules/timeline/timelineEventDetector.js';

const prisma = {};
mock.module('../../src/db/prisma.js', { exports: { prisma } });
const timelineService = await import('../../src/modules/timeline/timelineService.js');

function usePrisma(client) {
  for (const key of Object.keys(prisma)) delete prisma[key];
  Object.assign(prisma, client);
  return timelineService;
}

function deliveryContext(delivery = storedDelivery({ batterRuns: 4 })) {
  return {
    matchId: 'match-1', delivery,
    innings: { id: delivery.inningsId, inningsNumber: 1 },
    players: new Map(Object.values(replayPlayers).map((player) => [player.id, player])),
    state: createTimelineState()
  };
}

function useTimelineStore(match) {
  const records = [];
  const queries = [];
  const writes = [];
  let id = 0;
  const assertFreePosition = (data, ignoredId) => {
    assert.ok(!records.some((record) => record.id !== ignoredId &&
      record.inningsId === data.inningsId && record.deliverySequence === data.deliverySequence &&
      record.eventOrder === data.eventOrder), 'Duplicate timeline delivery/order position');
  };
  const client = {
    timelineEvent: {
      findMany: async ({ where }) => {
        queries.push(where);
        return records.filter((record) => record.matchId === where.matchId &&
          (!where.eventKey || where.eventKey.in.includes(record.eventKey)))
          .map((record) => ({ ...record, innings: { inningsNumber: 1 } }));
      },
      create: async ({ data }) => {
        assertFreePosition(data);
        const record = { id: `event-${++id}`, ...data };
        records.push(record);
        writes.push('create');
        return record;
      },
      update: async ({ where, data }) => {
        assertFreePosition(data, where.id);
        const index = records.findIndex((record) => record.id === where.id);
        records[index] = { ...records[index], ...data };
        writes.push('update');
        return records[index];
      },
      delete: async ({ where }) => {
        writes.push('delete');
        const index = records.findIndex((record) => record.id === where.id);
        return records.splice(index, 1)[0];
      }
    }
  };
  if (match) client.match = { findUnique: async () => match };
  // No delivery, innings, or player delegates: incremental calls must use their context.
  const transaction = mock.fn(async (operation) => operation(client));
  const service = usePrisma({ $transaction: transaction });
  return { service, records, queries, writes, transaction };
}

test('replaces obsolete event keys before inserting into the same delivery/order position', async () => {
  const match = {
    id: 'match-1', status: 'LIVE',
    innings: [{ id: 'innings-1', inningsNumber: 1, deliveries: [storedDelivery({ batterRuns: 4 })] }]
  };
  const { service, records, writes } = useTimelineStore(match);

  const created = await service.synchronizeMatch({ matchId: 'match-1' });
  match.innings[0].deliveries = [storedDelivery({ batterRuns: 6 })];
  const replaced = await service.synchronizeMatch({ matchId: 'match-1' });
  assert.equal(replaced.created[0].type, 'SIX');
  assert.equal(replaced.deleted[0].id, created.created[0].id);
  assert.deepEqual(writes, ['create', 'delete', 'create']);

  match.innings[0].deliveries = [storedDelivery()];
  const corrected = await service.synchronizeMatch({ matchId: 'match-1' });

  assert.equal(created.created.length, 1);
  assert.equal(created.created[0].type, 'FOUR');
  assert.equal(corrected.deleted.length, 1);
  assert.equal(corrected.deleted[0].id, replaced.created[0].id);
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

test('recordDelivery uses the supplied delivery and player lookup without historical reads', async () => {
  const context = deliveryContext();
  delete context.delivery.batter;
  delete context.delivery.nonStriker;
  delete context.delivery.bowler;
  const { service, records, queries, transaction } = useTimelineStore();
  const result = await service.recordDelivery(context);

  assert.equal(result.created[0].type, 'FOUR');
  assert.equal(result.created[0].title, 'Four by Zara');
  assert.deepEqual(result.created[0].innings, { id: 'innings-1', number: 1 });
  assert.equal(records[0].eventKey, 'delivery:innings-1-delivery-1:four');
  assert.deepEqual(queries, [{ matchId: 'match-1', eventKey: { in: [records[0].eventKey] } }]);
  assert.equal(transaction.mock.callCount(), 1);
});

test('recordDelivery keeps milestone event payloads when a delivery crosses both thresholds', async () => {
  const context = deliveryContext(storedDelivery({ deliverySequence: 9, batterRuns: 2 }));
  for (let sequence = 1; sequence <= 8; sequence += 1) {
    applyDeliveryToTimelineState(context.state, storedDelivery({ deliverySequence: sequence, batterRuns: 6 }));
  }
  const { service, records, queries, transaction } = useTimelineStore();
  const result = await service.recordDelivery(context);

  assert.deepEqual(
    result.created.map((event) => event.type),
    ['BATTER_MILESTONE', 'PARTNERSHIP_MILESTONE']
  );
  assert.equal(records[0].eventKey, 'batter-milestone:innings-1:player-a:50');
  assert.equal(records[1].eventKey, 'partnership-milestone:innings-1-delivery-1:50');
  assert.equal(
    records[1].description,
    'Zara and Amir added 50 runs together at 1.3.'
  );
  assert.equal(queries.length, 1);
  assert.equal(queries[0].eventKey.in.length, 2);
  assert.equal(transaction.mock.callCount(), 1);
});

test('recordDelivery skips the database when a delivery has no events', async () => {
  const service = usePrisma({});
  for (const batterRuns of [0, 1]) {
    assert.deepEqual(await service.recordDelivery(deliveryContext(storedDelivery({ batterRuns }))),
      { created: [], updated: [], deleted: [] });
  }
});

test('recordDelivery hydrates wicket players from the lookup', async () => {
  const context = deliveryContext(storedDelivery({ wickets: [{
    wicketSequence: 1, playerOutId: replayPlayers.partner.id, kind: 'run out', countsAsWicket: true
  }] }));
  const { service } = useTimelineStore();
  const result = await service.recordDelivery(context);
  assert.equal(result.created[0].title, 'Wicket — Amir');
  assert.equal(result.created[0].type, 'WICKET');
});

test('repeated event candidates skip unchanged writes and report real updates with the same ID', async () => {
  const { service, records, writes } = useTimelineStore();
  const occurredAt = new Date('2026-01-01T12:00:00Z');
  const context = () => deliveryContext(storedDelivery({ batterRuns: 4, occurredAt: new Date(occurredAt) }));
  const created = await service.recordDelivery(context());
  // A rebuilt context can replay the same durable delivery without publishing it again.
  assert.deepEqual(await service.recordDelivery(context()), { created: [], updated: [], deleted: [] });
  assert.deepEqual(writes, ['create']);

  const renamed = context();
  renamed.players.set(replayPlayers.batter.id, { ...replayPlayers.batter, displayName: 'Zara Revised' });
  const updated = await service.recordDelivery(renamed);
  assert.deepEqual(updated.created, []);
  assert.equal(updated.updated[0].id, created.created[0].id);
  assert.equal(updated.updated[0].title, 'Four by Zara Revised');
  assert.deepEqual(writes, ['create', 'update']);
  assert.equal(records.length, 1);
});

test('over events retain the previous delivery anchor when the next delivery arrives', async () => {
  const context = deliveryContext(storedDelivery({ deliverySequence: 7, batterRuns: 4 }));
  for (let sequence = 1; sequence <= 6; sequence += 1) {
    applyDeliveryToTimelineState(context.state, storedDelivery({ deliverySequence: sequence }));
  }
  const { service, records } = useTimelineStore();
  const result = await service.recordDelivery(context);
  assert.deepEqual(result.created.map((event) => [event.type, event.delivery.id]), [
    ['MAIDEN_OVER', 'innings-1-delivery-6'], ['FOUR', 'innings-1-delivery-7']
  ]);
  assert.deepEqual(records.map((event) => event.deliverySequence), [6, 7]);
});

test('finishInnings persists a partial over once and skips repeated finalization', async () => {
  const context = deliveryContext(storedDelivery());
  const { service, transaction } = useTimelineStore();
  await service.recordDelivery(context);
  const result = await service.finishInnings(context);
  assert.equal(result.created[0].type, 'MAIDEN_OVER');
  assert.deepEqual(await service.finishInnings(context), { created: [], updated: [], deleted: [] });
  assert.equal(transaction.mock.callCount(), 1);
});

test('corrections use full reconciliation without advancing the supplied state', async () => {
  const match = {
    id: 'match-1', status: 'LIVE',
    innings: [{ id: 'innings-1', inningsNumber: 1, deliveries: [storedDelivery({ batterRuns: 4 })] }]
  };
  const { service } = useTimelineStore(match);
  const created = await service.recordDelivery(deliveryContext());
  assert.equal(created.created[0].type, 'FOUR');
  match.innings[0].deliveries = [storedDelivery({ batterRuns: 6 })];
  const context = deliveryContext();
  const before = structuredClone(context.state);
  const corrected = await service.synchronizeMatch({ matchId: 'match-1' });
  assert.equal(corrected.created[0].type, 'SIX');
  assert.equal(corrected.deleted[0].id, created.created[0].id);
  assert.deepEqual(context.state, before);
});

test('invalid context fails before mutating the detector or querying the database', async () => {
  const service = usePrisma({});
  const context = deliveryContext();
  const before = structuredClone(context.state);
  await assert.rejects(service.recordDelivery({ ...context, state: undefined }), /requires an innings state/);
  await assert.rejects(service.recordDelivery({ ...context, innings: { id: 'another-innings' } }),
    /does not belong/);
  context.players.delete(replayPlayers.batter.id);
  await assert.rejects(service.recordDelivery(context), /Player not found in timeline context/);
  assert.deepEqual(context.state, before);
});
