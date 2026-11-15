import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { mock, test } from 'node:test';

const events = [];
let stateVersion = 0;
const delivery = {
  display: { ballLabel: '0.1' },
  runs: { batter: 4 },
  extras: { total: 0 }
};
const prisma = {
  match: { update: async ({ data }) => { events.push(`match:${data.status}`); } }
};
mock.module('../src/db/prisma.js', { exports: { prisma } });
mock.module('../src/modules/ingestion/cricsheetAdapter.js', {
  exports: { adaptCricsheetMatch: () => ({ name: 'Sample match' }) }
});
mock.module('../src/modules/ingestion/matchBootstrapService.js', {
  exports: {
    bootstrapCricsheetMatch: async () => ({
      match: { id: 'match-1' },
      innings: [{ id: 'innings-1', inningsNumber: 1, deliveries: [delivery] }]
    })
  }
});
mock.module('../src/modules/ingestion/deliveryProcessor.js', {
  exports: {
    processDelivery: async () => {
      events.push('delivery:stored');
      return { action: 'created', record: { id: 'delivery-1' } };
    }
  }
});
mock.module('../src/modules/match-intelligence/state/matchStateService.js', {
  exports: {
    buildMatchState: async () => {
      events.push('state:built');
      return { matchId: 'match-1', version: ++stateVersion };
    }
  }
});
mock.module('../src/modules/match-intelligence/state/matchStateCache.js', {
  exports: { set: async () => { events.push('state:cached'); } }
});
mock.module('../src/modules/timeline/timelineService.js', {
  exports: {
    recordDelivery: async () => {
      events.push('timeline:recorded');
      return { created: [], updated: [], deleted: [] };
    },
    synchronizeMatch: async () => {
      events.push('timeline:synchronized');
      return { created: [], updated: [], deleted: [] };
    }
  }
});
mock.module('../src/sockets/socketServer.js', {
  exports: {
    io: { to: () => ({ emit: (event) => events.push(`socket:${event}`) }) },
    matchRoom: (matchId) => `match:${matchId}`,
    publishDeliveryUpdate: () => { events.push('socket:delivery_added'); },
    publishMatchStatus: (_matchId, status) => { events.push(`socket:status:${status}`); },
    publishTimelineChanges: () => { events.push('socket:timeline'); }
  }
});
const { replayCricsheetFile } = await import('../src/replay/replayService.js');

test('replay preserves the delivery, score, status, and timeline sequence', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'phase7-replay-'));
  const filePath = path.join(directory, 'sample.json');
  const progress = [];
  try {
    await writeFile(filePath, '{}');
    const result = await replayCricsheetFile({
      filePath,
      sourceMatchId: 'sample',
      intervalMs: 1,
      onProgress: (value) => progress.push(value),
      pause: async () => { events.push('replay:paused'); }
    });

    assert.equal(result.matchId, 'match-1');
    assert.equal(result.state.version, 3);
    assert.equal(progress[0].processedDeliveries, 1);
    assert.equal(progress[0].totalDeliveries, 1);
    assert.deepEqual(events, [
      'match:LIVE', 'socket:status:LIVE',
      'state:built', 'state:cached', 'socket:score_updated',
      'delivery:stored', 'state:built', 'state:cached',
      'socket:delivery_added', 'timeline:recorded', 'socket:timeline', 'replay:paused',
      'match:COMPLETE', 'state:built', 'state:cached', 'socket:score_updated',
      'socket:status:COMPLETE', 'timeline:synchronized', 'socket:timeline'
    ]);
  } finally {
    assert.equal(path.dirname(directory), os.tmpdir());
    await rm(directory, { recursive: true, force: true });
  }
});
