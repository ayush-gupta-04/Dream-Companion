import { normalizedDeliverySchema } from '../../../schemas/deliverySchemas.js';

export {
  extrasSchema,
  wicketSchema,
  normalizedDeliverySchema
} from '../../../schemas/deliverySchemas.js';

export class DeliveryValidationError extends Error {
  constructor(issues) {
    super('Normalized delivery validation failed.');
    this.name = 'DeliveryValidationError';
    this.issues = issues;
  }
}

/**
 * Validates a provider-neutral delivery and derives its legal-delivery flag.
 *
 * @param {unknown} input
 * @returns {import('./contracts.js').NormalizedDelivery}
 */
export function validateNormalizedDelivery(input) {
  const result = normalizedDeliverySchema.safeParse(input);

  if (!result.success) {
    throw new DeliveryValidationError(result.error.issues);
  }

  const delivery = result.data;

  return {
    ...delivery,
    isLegalDelivery: delivery.extras.wides === 0 && delivery.extras.noBalls === 0
  };
}
