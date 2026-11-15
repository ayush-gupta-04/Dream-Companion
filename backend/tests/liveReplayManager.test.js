import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

const prisma = { match: { findUnique: async () => null } };
let clearSimulation = async () => {};
let replay = async () => ({ matchId: 'live-match' });
mock.module('../src/db/prisma.js', { exports: { prisma } });
mock.module('../src/modules/match-intelligence/state/matchStateCache.js', {
  exports: { getOrBuild: async () => null, set: async () => {}, clear: async () => {} }
});
mock.module('../src/modules/timeline/timelineService.js', { exports: {} });
mock.module('../src/replay/matchSimulationDataService.js', {
  exports: { clearMatchSimulationData: (...args) => clearSimulation(...args) }
});
mock.module('../src/replay/replayService.js', {
  exports: { replayCricsheetFile: (...args) => replay(...args) }
});
const { registerLiveMatch, isLiveMatchId, getStatus, startForMatch, stopReplay } =
  await import('../src/replay/liveReplayManager.js');

test('runs one replay for the configured match and reports progress through completion', async () => {
  const clears = [];
  let resolveReplay;
  let replayCalls = 0;
  clearSimulation = async (options) => { clears.push(options); };
  replay = ({ onProgress }) => {
    replayCalls += 1;
    onProgress({ matchId: 'live-match', processedDeliveries: 1, totalDeliveries: 2 });
    return new Promise((resolve) => { resolveReplay = resolve; });
  };
  registerLiveMatch({ matchId: 'live-match', liveFilePath: '1001349.json' });

  assert.equal(isLiveMatchId('live-match'), true);
  assert.deepEqual(await startForMatch('live-match'), { status: 'started', matchId: 'live-match' });
  assert.deepEqual(await startForMatch('live-match'), { status: 'running', matchId: 'live-match' });
  assert.equal(replayCalls, 1);
  assert.equal(clears.length, 1);
  assert.equal(clears[0].status, 'LIVE');
  assert.equal(getStatus().status, 'RUNNING');
  assert.equal(getStatus().progress.processedDeliveries, 1);

  resolveReplay({ matchId: 'live-match' });
  await new Promise(setImmediate);
  assert.equal(getStatus().isRunning, false);
  assert.equal(getStatus().status, 'COMPLETED');
});

test('cancels the active replay and keeps the stopped status', async () => {
  clearSimulation = async () => {};
  replay = ({ signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('Replay cancelled')), { once: true });
  });

  assert.equal((await startForMatch('live-match')).status, 'started');
  await stopReplay();
  assert.equal(getStatus().status, 'STOPPED');
  assert.equal(getStatus().isRunning, false);
  assert.equal(getStatus().error, null);
});

test('rejects another match and reports reset failures without starting replay', async () => {
  await assert.rejects(startForMatch('other-match'), { statusCode: 404 });
  clearSimulation = async () => { throw new Error('reset failed'); };
  let replayCalls = 0;
  replay = async () => { replayCalls += 1; return { matchId: 'live-match' }; };

  await assert.rejects(startForMatch('live-match'), /reset failed/);
  assert.equal(replayCalls, 0);
  assert.equal(getStatus().status, 'ERROR');
  assert.equal(getStatus().error, 'reset failed');
});
