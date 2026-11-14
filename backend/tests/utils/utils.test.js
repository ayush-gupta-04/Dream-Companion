import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  fingerprint,
  round,
  formatOvers,
  isBowlerWicket,
  calculateRunRate,
  calculateEconomy,
  calculateStrikeRate,
  requireValue,
  handleValidationError,
  formatDeliveryReference,
  BOWLER_WICKET_KINDS,
  EMPTY_EXTRAS
} from '../../src/utils/index.js';
import * as scoringExports from '../../src/modules/match-intelligence/domain/scoring.js';

describe('Backend Utilities Module', () => {
  describe('crypto utility', () => {
    test('generates deterministic SHA-256 fingerprints', () => {
      const obj1 = { over: 1, ball: 2, runs: 4 };
      const obj2 = { over: 1, ball: 2, runs: 4 };
      const obj3 = { over: 1, ball: 3, runs: 4 };

      const hash1 = fingerprint(obj1);
      const hash2 = fingerprint(obj2);
      const hash3 = fingerprint(obj3);

      assert.equal(typeof hash1, 'string');
      assert.equal(hash1.length, 64);
      assert.equal(hash1, hash2);
      assert.notEqual(hash1, hash3);
    });

    test('accepts strings directly', () => {
      const hash = fingerprint('test-string');
      assert.equal(typeof hash, 'string');
      assert.equal(hash.length, 64);
    });
  });

  describe('math utility', () => {
    test('rounds numbers to two decimal places by default', () => {
      assert.equal(round(3.14159), 3.14);
      assert.equal(round(8.66666), 8.67);
      assert.equal(round(10), 10);
    });

    test('supports custom decimal precision', () => {
      assert.equal(round(3.14159, 3), 3.142);
      assert.equal(round(3.14159, 1), 3.1);
      assert.equal(round(3.14159, 0), 3);
    });

    test('handles non-numeric inputs safely', () => {
      assert.equal(round(NaN), 0);
      assert.equal(round('not a number'), 0);
      assert.equal(round(null), 0);
    });
  });

  describe('cricket utility', () => {
    test('formats legal deliveries into cricket over notation', () => {
      assert.equal(formatOvers(0), '0.0');
      assert.equal(formatOvers(1), '0.1');
      assert.equal(formatOvers(5), '0.5');
      assert.equal(formatOvers(6), '1.0');
      assert.equal(formatOvers(99), '16.3');
      assert.equal(formatOvers(120), '20.0');
    });

    test('supports non-standard balls per over', () => {
      assert.equal(formatOvers(8, 8), '1.0');
      assert.equal(formatOvers(9, 8), '1.1');
    });

    test('identifies bowler wickets correctly', () => {
      assert.equal(isBowlerWicket({ kind: 'bowled', countsAsWicket: true }), true);
      assert.equal(isBowlerWicket({ kind: 'caught', countsAsWicket: true }), true);
      assert.equal(isBowlerWicket({ kind: 'caught and bowled', countsAsWicket: true }), true);
      assert.equal(isBowlerWicket({ kind: 'hit wicket', countsAsWicket: true }), true);
      assert.equal(isBowlerWicket({ kind: 'lbw', countsAsWicket: true }), true);
      assert.equal(isBowlerWicket({ kind: 'stumped', countsAsWicket: true }), true);

      // Dismissals not credited to bowler
      assert.equal(isBowlerWicket({ kind: 'run out', countsAsWicket: true }), false);
      assert.equal(isBowlerWicket({ kind: 'retired hurt', countsAsWicket: false }), false);
      assert.equal(isBowlerWicket({ kind: 'obstructing the field', countsAsWicket: true }), false);
      assert.equal(isBowlerWicket(null), false);
    });

    test('calculates run rate, economy, and strike rate', () => {
      assert.equal(calculateRunRate(75, 50, 6), 9);
      assert.equal(calculateRunRate(10, 0, 6), 0);

      assert.equal(calculateEconomy(32, 24, 6), 8);
      assert.equal(calculateEconomy(35, 24, 6), 8.75);
      assert.equal(calculateEconomy(0, 0, 6), 0);

      assert.equal(calculateStrikeRate(45, 30), 150);
      assert.equal(calculateStrikeRate(0, 0), 0);
    });
  });

  describe('validation utility', () => {
    test('requireValue returns value when present and throws when missing', () => {
      assert.equal(requireValue('ok', 'label'), 'ok');
      assert.equal(requireValue(123, 'label'), 123);

      assert.throws(
        () => requireValue(null, 'testField'),
        /Missing required value: testField/
      );
      assert.throws(
        () => requireValue(undefined, 'testField'),
        /Missing required value: testField/
      );
      assert.throws(
        () => requireValue('', 'testField'),
        /Missing required value: testField/
      );
    });

    test('handleValidationError attaches 400 status to Zod errors', () => {
      const zodError = new Error('Invalid input');
      zodError.name = 'ZodError';

      const handled = handleValidationError(zodError, 'Bad request.');
      assert.equal(handled.statusCode, 400);
      assert.equal(handled.message, 'Bad request.');

      const regularError = new Error('Database down');
      const regularHandled = handleValidationError(regularError, 'Bad request.');
      assert.equal(regularHandled.statusCode, undefined);
      assert.equal(regularHandled.message, 'Database down');
    });
  });

  describe('formatting utility', () => {
    test('formats delivery reference objects consistently', () => {
      const delivery = {
        id: 'del-123',
        inningsId: 'inn-1',
        innings: { inningsNumber: 1 },
        deliverySequence: 14,
        displayOver: 2,
        displayBallLabel: '2.2'
      };

      const ref = formatDeliveryReference(delivery);
      assert.deepEqual(ref, {
        deliveryId: 'del-123',
        inningsId: 'inn-1',
        inningsNumber: 1,
        deliverySequence: 14,
        display: {
          overNumber: 2,
          ballLabel: '2.2'
        }
      });
    });
  });

  describe('backward compatibility', () => {
    test('scoring.js re-exports cricket utilities without breaking existing imports', () => {
      assert.equal(scoringExports.formatOvers, formatOvers);
      assert.equal(scoringExports.isBowlerWicket, isBowlerWicket);
      assert.deepEqual(scoringExports.BOWLER_WICKET_KINDS, BOWLER_WICKET_KINDS);
      assert.deepEqual(scoringExports.EMPTY_EXTRAS, EMPTY_EXTRAS);
    });
  });
});
