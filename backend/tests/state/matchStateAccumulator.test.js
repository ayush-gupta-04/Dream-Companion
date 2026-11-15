import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMatchStateAccumulator } from '../../src/modules/match-intelligence/state/matchStateAccumulator.js';
import { createReplayMatch, storedDelivery } from '../fixtures/replayMatch.js';

function scorecard(accumulator) {
  const snapshot = accumulator.snapshot();
  delete snapshot.updatedAt;
  return snapshot;
}

test('incremental scores match rebuilding after every delivery across both innings', () => {
  const match = createReplayMatch();
  const deliveries = match.innings.map((entry) => entry.deliveries);
  for (const entry of match.innings) entry.deliveries = [];
  const accumulator = createMatchStateAccumulator(match);
  assert.equal(accumulator.snapshot().currentInnings.inningsNumber, 1);
  assert.equal(accumulator.snapshot().currentInnings.state.totalRuns, 5);

  const totals = [[11, 12, 16, 18, 21, 23, 24, 24, 29], [4, 5]];
  for (const [inningsIndex, records] of deliveries.entries()) {
    for (const [index, record] of records.entries()) {
      accumulator.applyDelivery(record);
      match.innings[inningsIndex].deliveries.push(record);
      const snapshot = scorecard(accumulator);
      assert.equal(snapshot.currentInnings.inningsNumber, inningsIndex + 1);
      assert.equal(snapshot.currentInnings.state.totalRuns, totals[inningsIndex][index]);
      assert.deepEqual(snapshot, scorecard(createMatchStateAccumulator(match)),
        `innings ${inningsIndex + 1}, delivery ${index + 1}`);
    }
  }
});

test('snapshots stay independent of later deliveries and cannot mutate the accumulator', () => {
  const match = createReplayMatch();
  const [first, second] = match.innings[0].deliveries;
  for (const entry of match.innings) entry.deliveries = [];
  const accumulator = createMatchStateAccumulator(match);
  accumulator.applyDelivery(first);
  const previous = accumulator.snapshot();
  const saved = structuredClone(previous);

  accumulator.applyDelivery(second);
  assert.deepEqual(previous, saved);
  const snapshot = accumulator.snapshot();
  snapshot.currentInnings.state.batters.Zara.runs = 999;
  snapshot.innings[0].state.extras.wides = 999;
  assert.equal(accumulator.snapshot().currentInnings.state.batters.Zara.runs, 7);
  assert.equal(accumulator.snapshot().innings[0].state.extras.wides, 0);
  assert.deepEqual(previous, saved);
});

test('continues from persisted deliveries without counting their runs or penalties again', () => {
  const match = createReplayMatch();
  const firstInnings = match.innings[0];
  const deliveries = firstInnings.deliveries;
  firstInnings.deliveries = deliveries.slice(0, 4);
  match.innings[1].deliveries = [];
  const accumulator = createMatchStateAccumulator(match);
  for (const record of deliveries.slice(4)) accumulator.applyDelivery(record);

  firstInnings.deliveries = deliveries;
  assert.deepEqual(scorecard(accumulator), scorecard(createMatchStateAccumulator(match)));
  assert.equal(accumulator.snapshot().currentInnings.state.totalRuns, 29);
});

test('completion applies final penalties once, including after restoring a completed match', () => {
  const match = createReplayMatch();
  const accumulator = createMatchStateAccumulator(match);
  const live = scorecard(accumulator);
  accumulator.complete();
  const complete = scorecard(accumulator);

  assert.equal(complete.status, 'COMPLETE');
  assert.equal(complete.innings[0].state.totalRuns, 34);
  assert.equal(live.innings[0].state.totalRuns, 29);
  assert.deepEqual(complete.innings[0].state, { ...live.innings[0].state, totalRuns: 34 });
  assert.deepEqual(complete.innings[1], live.innings[1]);
  accumulator.complete();
  assert.deepEqual(scorecard(accumulator), complete);

  match.status = 'COMPLETE';
  const restored = createMatchStateAccumulator(match);
  assert.deepEqual(scorecard(restored), complete);
  restored.complete();
  assert.deepEqual(scorecard(restored), complete);
  assert.throws(() => restored.applyDelivery(storedDelivery()), /completed match/);
});

test('uses the match ball count and falls back to player IDs when names are unavailable', () => {
  const match = createReplayMatch();
  match.ballsPerOver = 5;
  match.players = [];
  match.innings = [{ ...match.innings[0], deliveries: [] }];
  const accumulator = createMatchStateAccumulator(match);
  for (let sequence = 1; sequence <= 5; sequence += 1) {
    accumulator.applyDelivery(storedDelivery({
      deliverySequence: sequence, batterRuns: sequence === 1 ? 2 : 0
    }));
  }

  const snapshot = accumulator.snapshot();
  assert.equal(snapshot.ballsPerOver, 5);
  assert.equal(snapshot.currentInnings.state.totalRuns, 7);
  assert.equal(snapshot.currentInnings.state.overs, '1.0');
  assert.deepEqual(snapshot.currentInnings.state.batters['player-a'], {
    runs: 2, ballsFaced: 5, fours: 0, sixes: 0, strikeRate: 40
  });
  assert.deepEqual(snapshot.currentInnings.state.bowlers['player-d'], {
    legalDeliveries: 5, overs: '1.0', runsConceded: 2, wickets: 0, economy: 2
  });
});
