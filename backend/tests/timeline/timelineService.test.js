import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTimelineService } from '../../src/modules/timeline/timelineService.js';

function createDelivery(batterRuns) {
  return {
    id: 'delivery-1',
    inningsId: 'innings-1',
    deliverySequence: 1,
    displayOver: 0,
    displayBallLabel: '0.1',
    batterRuns,
    totalRuns: batterRuns,
    wides: 0,
    noBalls: 0,
    byes: 0,
    legByes: 0,
    penaltyRuns: 0,
    occurredAt: null,
    batter: { id: 'batter-1', displayName: 'Batter One' },
    nonStriker: { id: 'partner-1', displayName: 'Partner One' },
    bowler: { id: 'bowler-1', displayName: 'Bowler One' },
    wickets: []
  };
}

test('reconciles a corrected delivery by deleting its obsolete timeline event', async () => {
  const records = [];
  const match = {
    id: 'match-1',
    status: 'LIVE',
    innings: [{ id: 'innings-1', inningsNumber: 1, deliveries: [createDelivery(4)] }]
  };
  let id = 1;
  const transaction = {
    match: { findUnique: async () => match },
    timelineEvent: {
      findMany: async () => records.map((record) => ({ ...record, innings: { inningsNumber: 1 } })),
      create: async ({ data }) => {
        const record = { id: `event-${id++}`, ...data };
        records.push(record);
        return record;
      },
      update: async ({ where, data }) => {
        const index = records.findIndex((record) => record.id === where.id);
        records[index] = { ...records[index], ...data };
        return records[index];
      },
      delete: async ({ where }) => {
        const index = records.findIndex((record) => record.id === where.id);
        return records.splice(index, 1)[0];
      }
    }
  };
  const service = createTimelineService({
    prisma: { $transaction: async (operation) => operation(transaction) }
  });

  const created = await service.synchronizeMatch({ matchId: 'match-1' });
  match.innings[0].deliveries = [createDelivery(0)];
  const corrected = await service.synchronizeMatch({ matchId: 'match-1' });

  assert.equal(created.created.length, 1);
  assert.equal(created.created[0].type, 'FOUR');
  assert.equal(corrected.deleted.length, 1);
  assert.equal(corrected.deleted[0].id, created.created[0].id);
  assert.equal(records.length, 0);
});

test('returns a stable, compact timeline response', async () => {
  const service = createTimelineService({
    prisma: {
      match: { findUnique: async () => ({ id: 'match-1' }) },
      timelineEvent: {
        findMany: async () => [
          {
            id: 'event-1',
            matchId: 'match-1',
            inningsId: 'innings-1',
            deliveryId: 'delivery-1',
            deliverySequence: 1,
            displayOver: 0,
            displayBallLabel: '0.1',
            type: 'FOUR',
            title: 'Four by Batter One',
            description: 'Batter One hit four at 0.1.',
            importanceScore: 35,
            importanceLevel: 'MINOR',
            occurredAt: null,
            innings: { inningsNumber: 1 }
          }
        ]
      }
    }
  });

  const result = await service.list({ matchId: 'match-1', limit: 50 });

  assert.equal(result.nextCursor, null);
  assert.deepEqual(result.events[0].delivery, {
    id: 'delivery-1',
    sequence: 1,
    display: { overNumber: 0, ballLabel: '0.1' }
  });
});
