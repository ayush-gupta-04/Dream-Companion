import assert from 'node:assert/strict';
import { beforeEach, mock, test } from 'node:test';

const prisma = { match: { findUnique: async () => null } };
let clearSimulation = async () => {};
let replay = async () => ({ matchId: 'live-match' });
mock.module('../src/db/prisma.js', { exports: { prisma } });
mock.module('../src/replay/matchSimulationDataService.js', {
  exports: { clearMatchSimulationData: (...args) => clearSimulation(...args) }
});
mock.module('../src/replay/replayService.js', {
  exports: { replayCricsheetFile: (...args) => replay(...args) }
});
const { registerLiveMatch, isLiveMatchId, startForMatch, stopReplay } =
  await import('../src/replay/liveReplayManager.js');

beforeEach(() => {
  clearSimulation = async () => {};
  replay = async () => ({ matchId: 'live-match' });
  registerLiveMatch({ matchId: 'live-match', liveFilePath: '1001349.json' });
});

test('shares one replay between callers and allows a new run after completion', async () => {
  const clears = [];
  let resolveReplay;
  let replayCalls = 0;
  clearSimulation = async (options) => { clears.push(options); };
  replay = () => {
    replayCalls += 1;
    return new Promise((resolve) => { resolveReplay = resolve; });
  };

  assert.equal(isLiveMatchId('live-match'), true);
  assert.deepEqual(await startForMatch('live-match'), { status: 'started', matchId: 'live-match' });
  assert.deepEqual(await startForMatch('live-match'), { status: 'running', matchId: 'live-match' });
  assert.equal(replayCalls, 1);
  assert.equal(clears.length, 1);
  assert.equal(clears[0].status, 'LIVE');

  resolveReplay({ matchId: 'live-match' });
  await new Promise(setImmediate);
  assert.equal((await startForMatch('live-match')).status, 'started');
  assert.equal(replayCalls, 2);
  resolveReplay({ matchId: 'live-match' });
  await new Promise(setImmediate);
});

test('cancels the active replay without logging an execution error', async (t) => {
  const errors = t.mock.method(console, 'error', () => {});
  let replaySignal;
  replay = ({ signal }) => {
    replaySignal = signal;
    return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
  };

  assert.equal((await startForMatch('live-match')).status, 'started');
  await stopReplay();
  assert.equal(replaySignal.aborted, true);
  assert.equal(errors.mock.callCount(), 0);
  replay = async () => ({ matchId: 'live-match' });
  assert.equal((await startForMatch('live-match')).status, 'started');
  await new Promise(setImmediate);
});

test('rejects another match and propagates reset failures without starting replay', async (t) => {
  t.mock.method(console, 'error', () => {});
  await assert.rejects(startForMatch('other-match'), { statusCode: 404 });
  clearSimulation = async () => { throw new Error('reset failed'); };
  let replayCalls = 0;
  replay = async () => { replayCalls += 1; return { matchId: 'live-match' }; };

  await assert.rejects(startForMatch('live-match'), /reset failed/);
  assert.equal(replayCalls, 0);
  await stopReplay();
  clearSimulation = async () => {};
  assert.equal((await startForMatch('live-match')).status, 'started');
  assert.equal(replayCalls, 1);
  await new Promise(setImmediate);
});

test('shutdown waits for a pending reset and prevents replay from starting afterward', async () => {
  let releaseReset;
  let replayCalls = 0;
  clearSimulation = () => new Promise((resolve) => { releaseReset = resolve; });
  replay = async () => { replayCalls += 1; };
  const starting = startForMatch('live-match');
  await new Promise(setImmediate);
  assert.equal((await startForMatch('live-match')).status, 'running');

  let stopped = false;
  const stopping = stopReplay().then(() => { stopped = true; });
  await new Promise(setImmediate);
  assert.equal(stopped, false);

  releaseReset();
  await starting;
  await stopping;
  assert.equal(replayCalls, 0);
  clearSimulation = async () => {};
  assert.equal((await startForMatch('live-match')).status, 'started');
  await new Promise(setImmediate);
});

test('logs replay failures and releases the active run for retry', async (t) => {
  const errors = t.mock.method(console, 'error', () => {});
  const failure = new Error('delivery write failed');
  replay = async () => { throw failure; };

  await startForMatch('live-match');
  await stopReplay();
  assert.equal(errors.mock.callCount(), 1);
  assert.equal(errors.mock.calls[0].arguments[1], failure);

  replay = async () => ({ matchId: 'live-match' });
  assert.equal((await startForMatch('live-match')).status, 'started');
  await new Promise(setImmediate);
});
