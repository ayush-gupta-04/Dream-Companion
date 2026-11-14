import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { normalizedDelivery, variedInningsDeliveries } from '../fixtures/normalizedDeliveries.js';
import {
  DuplicateDeliverySequenceError,
  reconstructInningsState
} from '../../src/modules/match-intelligence/domain/reconstructInningsState.js';

describe('reconstructInningsState', () => {
  test('calculates innings and player state from ordered delivery sequences', () => {
    const state = reconstructInningsState([...variedInningsDeliveries].reverse());

    assert.equal(state.totalRuns, 11);
    assert.equal(state.wickets, 1);
    assert.equal(state.legalDeliveries, 6);
    assert.equal(state.overs, '1.0');
    assert.deepEqual(state.extras, {
      wides: 1,
      noBalls: 1,
      byes: 2,
      legByes: 1,
      penaltyRuns: 0
    });
    assert.deepEqual(state.batters['player-batter'], {
      runs: 6,
      ballsFaced: 7,
      fours: 1,
      sixes: 0,
      strikeRate: 85.71
    });
    assert.deepEqual(state.bowlers['player-bowler'], {
      legalDeliveries: 6,
      overs: '1.0',
      runsConceded: 8,
      wickets: 1,
      economy: 8
    });
  });

  test('does not credit a run out to the bowler', () => {
    const state = reconstructInningsState([
      normalizedDelivery({
        wickets: [{ playerOutId: 'player-batter', kind: 'run out' }]
      })
    ]);

    assert.equal(state.wickets, 1);
    assert.equal(state.bowlers['player-bowler'].wickets, 0);
  });

  test('counts penalty runs for the innings but not against the bowler', () => {
    const state = reconstructInningsState([
      normalizedDelivery({
        runs: { total: 5 },
        extras: { penaltyRuns: 5 }
      })
    ]);

    assert.equal(state.totalRuns, 5);
    assert.equal(state.extras.penaltyRuns, 5);
    assert.equal(state.bowlers['player-bowler'].runsConceded, 0);
  });

  test('rejects duplicate internal sequences even if display labels differ', () => {
    assert.throws(
      () =>
        reconstructInningsState([
          normalizedDelivery({ deliverySequence: 1, display: { ballLabel: '0.1' } }),
          normalizedDelivery({ deliverySequence: 1, display: { ballLabel: '17.3 revised' } })
        ]),
      DuplicateDeliverySequenceError
    );
  });

  test('uses the source match ball count when formatting overs and bowler economy', () => {
    const state = reconstructInningsState(
      [
        normalizedDelivery({ deliverySequence: 1, runs: { batter: 2, total: 2 } }),
        normalizedDelivery({ deliverySequence: 2 }),
        normalizedDelivery({ deliverySequence: 3 }),
        normalizedDelivery({ deliverySequence: 4 }),
        normalizedDelivery({ deliverySequence: 5 })
      ],
      { ballsPerOver: 5, initialRuns: 5 }
    );

    assert.equal(state.totalRuns, 7);
    assert.equal(state.overs, '1.0');
    assert.equal(state.bowlers['player-bowler'].overs, '1.0');
    assert.equal(state.bowlers['player-bowler'].economy, 2);
  });
});
