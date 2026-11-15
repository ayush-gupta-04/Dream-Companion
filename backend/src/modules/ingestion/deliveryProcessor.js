import {
  createDelivery,
  updateDelivery
} from '../match-intelligence/persistence/deliveryRepository.js';
import { validateNormalizedDelivery } from '../match-intelligence/domain/validateNormalizedDelivery.js';
import { prisma } from '../../db/prisma.js';

export async function processDelivery({ inningsId, delivery }) {
  const normalized = validateNormalizedDelivery(delivery);
  const sourceDeliveryId = normalized.source?.deliveryId;

  if (!sourceDeliveryId) {
    const record = await createDelivery(prisma, { inningsId, delivery: normalized });
    return { action: 'created', record };
  }

  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.delivery.findFirst({
      where: { inningsId, sourceDeliveryId }
    });

    if (!existing) {
      const record = await createDelivery(transaction, { inningsId, delivery: normalized });
      return { action: 'created', record };
    }

    if (existing.sourceRevision === normalized.source.revision) {
      return { action: 'unchanged', record: existing };
    }

    const record = await updateDelivery(transaction, existing.id, normalized);
    return { action: 'corrected', record };
  });
}
