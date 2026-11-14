import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EventSearchValidationError,
  searchMatchEvents
} from '../../src/modules/timeline/eventSearchService.js';

function timelineRecord({ id, type, sequence, importance = 'HIGHLIGHT' }) {
  return {
    id,
    matchId: 'match-1',
    inningsId: 'innings-1',
    deliveryId: `delivery-${sequence}`,
    deliverySequence: sequence,
    eventOrder: 10,
    displayOver: 0,
    displayBallLabel: `0.${sequence}`,
    type,
    title: `${type} event`,
    description: 'Verified timeline event.',
    importanceScore: 60,
    importanceLevel: importance,
    occurredAt: null,
    innings: { inningsNumber: 1 }
  };
}

test('searches stored timeline events with factual filters and cursor pagination', async () => {
  const records = [
    timelineRecord({ id: 'event-1', type: 'WICKET', sequence: 1, importance: 'MAJOR' }),
    timelineRecord({ id: 'event-2', type: 'SIX', sequence: 2, importance: 'HIGHLIGHT' })
  ];
  let receivedWhere;
  const prisma = {
    match: { findUnique: async () => ({ id: 'match-1' }) },
    player: { findFirst: async () => ({ id: 'player-1', displayName: 'Player One' }) },
    timelineEvent: {
      findMany: async ({ where }) => {
        receivedWhere = where;
        return records;
      }
    }
  };

  const result = await searchMatchEvents(prisma, {
    matchId: 'match-1',
    inningsNumber: 1,
    types: ['WICKET'],
    playerId: 'player-1',
    startSequence: 1,
    endSequence: 4,
    minimumImportance: 'HIGHLIGHT',
    limit: 1
  });

  assert.deepEqual(receivedWhere.type, { in: ['WICKET'] });
  assert.deepEqual(receivedWhere.importanceLevel, { in: ['HIGHLIGHT', 'MAJOR'] });
  assert.equal(receivedWhere.delivery.OR[0].batterId, 'player-1');
  assert.deepEqual(receivedWhere.deliverySequence, { gte: 1, lte: 4 });
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].id, 'event-1');
  assert.equal(result.nextCursor, 'event-1');
  assert.deepEqual(result.references[0], {
    eventId: 'event-1',
    inningsId: 'innings-1',
    inningsNumber: 1,
    deliveryId: 'delivery-1',
    deliverySequence: 1,
    display: { overNumber: 0, ballLabel: '0.1' }
  });
});

test('requires innings for a delivery sequence event filter', async () => {
  await assert.rejects(
    searchMatchEvents({}, { matchId: 'match-1', startSequence: 1 }),
    EventSearchValidationError
  );
});
