import { applyDeliveryToInningsState, createEmptyInningsState } from './scoring.js';
import { validateNormalizedDelivery } from './validateNormalizedDelivery.js';

export class DuplicateDeliverySequenceError extends Error {
  constructor(deliverySequence) {
    super(`Duplicate delivery sequence: ${deliverySequence}`);
    this.name = 'DuplicateDeliverySequenceError';
  }
}

/**
 * Rebuilds state from delivery history. Display labels do not affect ordering.
 */
export function reconstructInningsState(deliveries, options) {
  const normalized = deliveries
    .map(validateNormalizedDelivery)
    .sort((a, b) => a.deliverySequence - b.deliverySequence);
  const seenSequences = new Set();
  const state = createEmptyInningsState(options);

  for (const delivery of normalized) {
    if (seenSequences.has(delivery.deliverySequence)) {
      throw new DuplicateDeliverySequenceError(delivery.deliverySequence);
    }

    seenSequences.add(delivery.deliverySequence);
    applyDeliveryToInningsState(state, delivery);
  }

  return state;
}
