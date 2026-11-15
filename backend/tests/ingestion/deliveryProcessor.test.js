import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { normalizedDelivery } from '../fixtures/normalizedDeliveries.js';

const writes = [];
let existing = null;
const transaction = {
  delivery: { findFirst: async () => existing }
};
const prisma = { $transaction: async (callback) => callback(transaction) };
mock.module('../../src/db/prisma.js', { exports: { prisma } });
mock.module('../../src/modules/match-intelligence/persistence/deliveryRepository.js', {
  exports: {
    createDelivery: async (client, options) => {
      writes.push({ operation: 'create', client, options });
      return { id: 'delivery-1' };
    },
    updateDelivery: async (client, id, delivery) => {
      writes.push({ operation: 'update', client, id, delivery });
      return { id };
    }
  }
});
const { processDelivery } = await import('../../src/modules/ingestion/deliveryProcessor.js');

test('uses the shared client for new deliveries and the transaction for source revisions', async () => {
  const withoutSource = normalizedDelivery();
  assert.equal((await processDelivery({ inningsId: 'innings-1', delivery: withoutSource })).action,
    'created');
  assert.equal(writes[0].client, prisma);

  const sourced = normalizedDelivery({
    source: { provider: 'cricsheet', deliveryId: 'source-1', revision: 'revision-1' }
  });
  existing = null;
  assert.equal((await processDelivery({ inningsId: 'innings-1', delivery: sourced })).action,
    'created');
  assert.equal(writes[1].client, transaction);

  existing = { id: 'delivery-1', sourceRevision: 'revision-1' };
  assert.equal((await processDelivery({ inningsId: 'innings-1', delivery: sourced })).action,
    'unchanged');
  assert.equal(writes.length, 2);

  existing = { id: 'delivery-1', sourceRevision: 'older-revision' };
  assert.equal((await processDelivery({ inningsId: 'innings-1', delivery: sourced })).action,
    'corrected');
  assert.equal(writes[2].client, transaction);
  assert.equal(writes[2].operation, 'update');
});
