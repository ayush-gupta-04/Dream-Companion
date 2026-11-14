import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { normalizedDelivery } from '../fixtures/normalizedDeliveries.js';
import {
  DeliveryValidationError,
  validateNormalizedDelivery
} from '../../src/modules/match-intelligence/domain/validateNormalizedDelivery.js';

describe('validateNormalizedDelivery', () => {
  test('fills optional extras and derives a legal delivery', () => {
    const delivery = validateNormalizedDelivery(normalizedDelivery());

    assert.deepEqual(delivery.extras, {
      wides: 0,
      noBalls: 0,
      byes: 0,
      legByes: 0,
      penaltyRuns: 0
    });
    assert.equal(delivery.isLegalDelivery, true);
  });

  test('does not count wides or no-balls as legal deliveries', () => {
    const wide = validateNormalizedDelivery(
      normalizedDelivery({ runs: { total: 1 }, extras: { wides: 1 } })
    );
    const noBall = validateNormalizedDelivery(
      normalizedDelivery({ runs: { total: 1 }, extras: { noBalls: 1 } })
    );

    assert.equal(wide.isLegalDelivery, false);
    assert.equal(noBall.isLegalDelivery, false);
  });

  test('rejects totals that do not reconcile with batter runs and extras', () => {
    assert.throws(
      () =>
        validateNormalizedDelivery(
          normalizedDelivery({ runs: { batter: 1, total: 3 }, extras: { wides: 1 } })
        ),
      (error) =>
        error instanceof DeliveryValidationError &&
        error.issues.some(
          (issue) => issue.message === 'Team runs must equal batter runs plus all extras.'
        )
    );
  });

  test('rejects batter runs on a wide delivery', () => {
    assert.throws(
      () =>
        validateNormalizedDelivery(
          normalizedDelivery({ runs: { batter: 2, total: 3 }, extras: { wides: 1 } })
        ),
      (error) =>
        error instanceof DeliveryValidationError &&
        error.issues.some(
          (issue) => issue.message === 'Batter cannot score runs off a wide delivery.'
        )
    );
  });
});
