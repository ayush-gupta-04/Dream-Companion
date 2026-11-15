import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, mock, test } from 'node:test';
import { createReplayMatch, storedDelivery } from './fixtures/replayMatch.js';
import { deliveryRecordToNormalizedDelivery } from '../src/modules/match-intelligence/persistence/deliveryRepository.js';

let source, match, records, calls, cached, updates, published, failAt, deliveryPublished;
let contextLoads, reconciliations, finalWrites, nextEventId, directory, filePath;
function reset() {
  source = createReplayMatch();
  match = structuredClone(source);
  for (const innings of match.innings) innings.deliveries = [];
  records = []; calls = []; cached = []; updates = []; published = [];
  deliveryPublished = () => {};
  failAt = null;
  contextLoads = 0; reconciliations = 0; finalWrites = 0; nextEventId = 0;
}
beforeEach(reset);
before(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'replay-state-'));
  filePath = path.join(directory, 'sample.json');
  await writeFile(filePath, '{}');
});
after(async () => {
  assert.equal(path.dirname(directory), os.tmpdir());
  await rm(directory, { recursive: true, force: true });
});

function writeEvent(operation) {
  calls.push(`timeline:${operation}`);
  if (match.status === 'COMPLETE') finalWrites += 1;
}
const timelineEvent = {
  findMany: async ({ where }) => {
    calls.push('timeline:read');
    return records.filter((event) => !where.eventKey || where.eventKey.in.includes(event.eventKey))
      .map((event) => ({ ...event, innings: {
        inningsNumber: match.innings.find((innings) => innings.id === event.inningsId).inningsNumber
      } }));
  },
  create: async ({ data }) => {
    if (failAt === 'timeline') throw new Error('Timeline SQL failed');
    writeEvent('create');
    const event = { id: `event-${++nextEventId}`, ...data };
    records.push(event);
    return event;
  },
  update: async ({ where, data }) => {
    writeEvent('update');
    const event = records.find((entry) => entry.id === where.id);
    Object.assign(event, data);
    return event;
  },
  delete: async ({ where }) => {
    writeEvent('delete');
    return records.splice(records.findIndex((entry) => entry.id === where.id), 1)[0];
  }
};
mock.module('../src/db/prisma.js', { exports: { prisma: {
  match: {
    findUnique: async () => { contextLoads += 1; calls.push('context:load'); return structuredClone(match); },
    update: async ({ data }) => {
      if (failAt === 'complete' && data.status === 'COMPLETE') throw new Error('Match SQL failed');
      calls.push(`match:${data.status}`);
      Object.assign(match, data);
    }
  },
  $transaction: async (operation) => operation({
    timelineEvent,
    match: { findUnique: async () => { reconciliations += 1; return structuredClone(match); } }
  })
} } });
mock.module('../src/db/redis.js', { exports: { redisClient: {
  set: async (_key, value) => {
    if (failAt === 'redis') throw new Error('Redis unavailable');
    calls.push('cache:set');
    cached.push(JSON.parse(value));
  }
} } });
mock.module('../src/modules/ingestion/cricsheetAdapter.js', {
  exports: { adaptCricsheetMatch: () => ({ name: source.name }) }
});
mock.module('../src/modules/ingestion/matchBootstrapService.js', { exports: {
  bootstrapCricsheetMatch: async () => ({
    match: { id: match.id },
    innings: source.innings.map((innings) => ({
      ...innings, deliveries: innings.deliveries.map(deliveryRecordToNormalizedDelivery)
    }))
  })
} });
mock.module('../src/modules/ingestion/deliveryProcessor.js', { exports: {
  processDelivery: async ({ inningsId, delivery }) => {
    calls.push(`delivery:${inningsId}:${delivery.deliverySequence}`);
    if (failAt === 'delivery' && delivery.deliverySequence === 2) throw new Error('Delivery SQL failed');
    const innings = match.innings.find((entry) => entry.id === inningsId);
    const record = structuredClone(source.innings.find((entry) => entry.id === inningsId)
      .deliveries.find((entry) => entry.deliverySequence === delivery.deliverySequence));
    const index = innings.deliveries.findIndex((entry) => entry.id === record.id);
    const existing = innings.deliveries[index];
    const action = !existing ? 'created' : existing.sourceRevision === record.sourceRevision ? 'unchanged' : 'corrected';
    if (!existing) innings.deliveries.push(record);
    else if (action === 'corrected') innings.deliveries[index] = record;
    innings.deliveries.sort((left, right) => left.deliverySequence - right.deliverySequence);
    return { action, record };
  }
} });
mock.module('../src/sockets/socketServer.js', { exports: {
  io: { to: () => ({ emit: (event) => calls.push(`socket:${event}`) }) },
  matchRoom: (matchId) => `match:${matchId}`,
  publishDeliveryUpdate: (_matchId, action, delivery, state) => {
    calls.push(`socket:delivery:${action}`);
    updates.push({ action, delivery, state });
    deliveryPublished();
  },
  publishMatchStatus: (_matchId, status) => calls.push(`socket:status:${status}`),
  publishTimelineChanges: (changes) => {
    calls.push('socket:timeline');
    for (const action of ['created', 'updated', 'deleted']) {
      published.push(...changes[action].map((event) => ({ action, event })));
    }
  }
} });
// Use the real score accumulator, timeline service, and Redis cache error handling.
const { replayCricsheetFile } = await import('../src/replay/replayService.js');
function run(options = {}) {
  return replayCricsheetFile({ filePath, sourceMatchId: 'sample', intervalMs: 1,
    pause: async () => { calls.push('pause'); }, ...options });
}

test('replay advances both innings without per-ball rebuilds and publishes durable events before completion', async () => {
  const result = await run();
  assert.equal(contextLoads, 1);
  assert.equal(reconciliations, 0); // No full match reconciliation sweeps needed.
  assert.equal(finalWrites, 0); // All events were already persisted during replay.
  assert.equal(cached.length, 13); // Initial, eleven deliveries, final.
  assert.equal(updates[0].state.currentInnings.state.totalRuns, 11);
  assert.equal(updates[8].state.currentInnings.state.totalRuns, 29);
  assert.equal(updates[9].state.currentInnings.inningsNumber, 2);
  assert.deepEqual(result.state.innings.map((innings) => innings.state.totalRuns), [34, 5]);
  assert.equal(result.state.status, 'COMPLETE');
  assert.deepEqual(cached.at(-1), result.state);
  const firstDelivery = calls.indexOf('delivery:innings-1:1');
  assert.deepEqual(calls.slice(firstDelivery, firstDelivery + 7), [
    'delivery:innings-1:1', 'timeline:read', 'timeline:create', 'cache:set',
    'socket:delivery:created', 'socket:timeline', 'pause'
  ]);
  assert.deepEqual(published.map(({ action, event }) => [action, event.type, event.delivery.sequence]), [
    ['created', 'SIX', 1], ['created', 'FOUR', 3], ['created', 'WICKET', 8],
    ['created', 'EXPENSIVE_OVER', 8], ['created', 'MAIDEN_OVER', 9],
    ['created', 'FOUR', 1], ['created', 'WICKET', 2]
  ]);
});

for (const failure of ['delivery', 'timeline', 'complete']) {
  test(`${failure} SQL failure stops replay before publishing match completion`, async () => {
    failAt = failure;
    await assert.rejects(run(), /SQL failed/);
    assert.equal(match.status, 'LIVE');
    assert.equal(calls.includes('socket:status:COMPLETE'), false);
    assert.equal(cached.at(-1).status, 'LIVE');
    if (failure === 'timeline') {
      assert.equal(updates.length, 0);
      assert.equal(cached.length, 1);
    }
  });
}

test('cancellation before startup and after the last delivery never finalizes the match', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(run({ signal: controller.signal }), { name: 'AbortError' });
  assert.equal(contextLoads, 0);
  source.innings = source.innings.slice(0, 1);
  source.innings[0].deliveries = [storedDelivery(), storedDelivery({ deliverySequence: 2 })];
  match.innings = match.innings.slice(0, 1);
  const active = new AbortController();
  await assert.rejects(run({ signal: active.signal, pause: async () => {
    if (updates.length === 2) active.abort();
  } }), { name: 'AbortError' });
  assert.equal(match.status, 'LIVE');
  assert.equal(records.length, 0); // The partial over is still unfinished.
  assert.equal(calls.includes('socket:status:COMPLETE'), false);
});

test('cancellation interrupts the default timer before another delivery is processed', async (t) => {
  const controller = new AbortController();
  t.after(() => controller.abort());
  const firstDelivery = new Promise((resolve) => { deliveryPublished = resolve; });
  const running = run({ signal: controller.signal, intervalMs: 60_000, pause: undefined });
  await firstDelivery;
  controller.abort();
  await assert.rejects(running, { name: 'AbortError' });
  assert.equal(updates.length, 1);
  assert.equal(match.status, 'LIVE');
});

test('Redis failure keeps replay scoring and publishing from its in-memory state', async () => {
  source.innings = source.innings.slice(0, 1);
  source.innings[0].deliveries = source.innings[0].deliveries.slice(0, 2);
  match.innings = match.innings.slice(0, 1);
  failAt = 'redis';
  const result = await run();
  assert.equal(result.state.currentInnings.state.totalRuns, 17);
  assert.equal(result.state.status, 'COMPLETE');
  assert.equal(updates.length, 2);
  assert.equal(cached.length, 0);
  assert.equal(contextLoads, 1);
});

test('a reset replay starts with fresh local state', async () => {
  const first = await run();
  reset();
  const second = await run();
  assert.deepEqual(second.state.innings, first.state.innings);
  assert.equal(contextLoads, 1);
});
