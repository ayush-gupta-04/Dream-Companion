import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { mock, test } from 'node:test';
import { config } from '../src/config/index.js';

const clears = [];
const lookedUpSources = [];
const completedMatches = [];
const synchronizedMatches = [];
let abortSeeding;
let archiveIsCurrent = true;
const prisma = {
  match: {
    findUnique: async ({ where }) => {
      lookedUpSources.push(where.source_sourceMatchId.sourceMatchId);
      abortSeeding?.abort();
      return archiveIsCurrent
        ? { id: 'existing-match', sourceRevision: 'revision-1', status: 'COMPLETE' }
        : null;
    },
    update: async ({ where, data }) => { completedMatches.push({ where, data }); }
  }
};
mock.module('../src/db/prisma.js', { exports: { prisma } });
mock.module('../src/modules/match-intelligence/state/matchStateCache.js', {
  exports: { clear: async () => {} }
});
mock.module('../src/modules/timeline/timelineService.js', {
  exports: { synchronizeMatch: async ({ matchId }) => { synchronizedMatches.push(matchId); } }
});
mock.module('../src/modules/ingestion/cricsheetAdapter.js', {
  exports: {
    adaptCricsheetMatch: (_raw, sourceMatchId) => ({
      source: 'cricsheet', sourceMatchId, sourceRevision: 'revision-1'
    })
  }
});
mock.module('../src/modules/ingestion/matchBootstrapService.js', {
  exports: {
    bootstrapCricsheetMatch: async (match) => ({
      match: { id: match.sourceMatchId }, innings: []
    })
  }
});
mock.module('../src/modules/ingestion/deliveryProcessor.js', {
  exports: { processDelivery: async () => {} }
});
mock.module('../src/replay/matchSimulationDataService.js', {
  exports: { clearMatchSimulationData: async (options) => { clears.push(options); } }
});
const { bootstrapLiveMatch, seedHistoricalArchive } =
  await import('../src/replay/historicalArchiveService.js');

test('bootstraps the live file, seeds history, and stops between files on shutdown', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'phase6-archive-'));
  const originalReplay = { ...config.replay };
  try {
    for (const name of ['aaa.json', 'bbb.json', 'live.json']) {
      await writeFile(path.join(directory, name), '{}');
    }
    config.replay.dataDirectory = directory;
    config.replay.liveFileName = 'live.json';
    config.replay.seedLimit = 2;

    const live = await bootstrapLiveMatch();
    assert.equal(live.liveMatchId, 'live');
    assert.equal(live.liveFilePath, path.join(directory, 'live.json'));
    assert.equal(clears[0].matchId, 'live');
    assert.equal(clears[0].status, 'LIVE');

    abortSeeding = new AbortController();
    await seedHistoricalArchive({ signal: abortSeeding.signal });
    assert.deepEqual(lookedUpSources, ['aaa']);

    abortSeeding = null;
    archiveIsCurrent = false;
    lookedUpSources.length = 0;
    await seedHistoricalArchive();
    assert.deepEqual(lookedUpSources, ['aaa', 'bbb']);
    assert.deepEqual(completedMatches.map(({ where }) => where.id), ['aaa', 'bbb']);
    assert.deepEqual(synchronizedMatches, ['aaa', 'bbb']);
    assert.equal(clears.filter(({ status }) => status === 'SCHEDULED').length, 2);
  } finally {
    Object.assign(config.replay, originalReplay);
    assert.equal(path.dirname(directory), os.tmpdir());
    await rm(directory, { recursive: true, force: true });
  }
});
