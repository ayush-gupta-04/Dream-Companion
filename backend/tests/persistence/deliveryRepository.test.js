import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizedDelivery } from '../fixtures/normalizedDeliveries.js';
import { reconstructInningsState } from '../../src/modules/match-intelligence/domain/reconstructInningsState.js';
import {
  createDelivery,
  deliveryRecordToNormalizedDelivery,
  listInningsDeliveries,
  updateDelivery
} from '../../src/modules/match-intelligence/persistence/deliveryRepository.js';

test('createDelivery and updateDelivery preserve their delivery and wicket mappings', async () => {
  const calls = [];
  const prisma = {
    delivery: {
      create: async (args) => {
        calls.push({ operation: 'create', args });
        return args;
      },
      update: async (args) => {
        calls.push({ operation: 'update', args });
        return args;
      }
    }
  };
  const delivery = normalizedDelivery({
    runs: { batter: 4, total: 6 },
    extras: { noBalls: 1, byes: 1 },
    wickets: [
      {
        playerOutId: 'player-out',
        kind: 'run out',
        countsAsWicket: true,
        fielders: ['fielder-1']
      }
    ],
    source: { provider: 'source', deliveryId: 'source-delivery', revision: 'revision-1' },
    rawPayload: { provider: 'source' }
  });

  await createDelivery(prisma, { inningsId: 'innings-1', delivery });
  await updateDelivery(prisma, 'delivery-1', delivery);

  const [createCall, updateCall] = calls;
  assert.deepEqual(createCall.args.data, {
    inningsId: 'innings-1',
    deliverySequence: 1,
    sourceDeliveryId: 'source-delivery',
    sourceRevision: 'revision-1',
    displayOver: 0,
    displayBallLabel: '0.1',
    batterId: 'player-batter',
    nonStrikerId: 'player-non-striker',
    bowlerId: 'player-bowler',
    batterRuns: 4,
    totalExtras: 2,
    totalRuns: 6,
    wides: 0,
    noBalls: 1,
    byes: 1,
    legByes: 0,
    penaltyRuns: 0,
    isLegalDelivery: false,
    occurredAt: undefined,
    rawPayload: { provider: 'source' },
    wickets: {
      create: [
        {
          wicketSequence: 1,
          playerOutId: 'player-out',
          kind: 'run out',
          countsAsWicket: true,
          fielders: ['fielder-1']
        }
      ]
    }
  });
  const updateDeliveryData = { ...createCall.args.data };
  delete updateDeliveryData.inningsId;
  delete updateDeliveryData.deliverySequence;
  delete updateDeliveryData.sourceDeliveryId;
  assert.deepEqual(updateCall.args, {
    where: { id: 'delivery-1' },
    data: {
      ...updateDeliveryData,
      wickets: {
        deleteMany: {},
        create: createCall.args.data.wickets.create
      }
    },
    include: { wickets: true }
  });
});

test('deliveryRecordToNormalizedDelivery maps database records to normalized domain objects', () => {
  const dbRecord = {
    deliverySequence: 3,
    displayOver: 0,
    displayBallLabel: '0.3',
    batterId: 'batter-1',
    nonStrikerId: 'non-striker-1',
    bowlerId: 'bowler-1',
    batterRuns: 4,
    totalRuns: 4,
    wides: 0,
    noBalls: 0,
    byes: 0,
    legByes: 0,
    penaltyRuns: 0,
    isLegalDelivery: true,
    sourceDeliveryId: null,
    sourceRevision: null,
    occurredAt: null,
    rawPayload: null,
    wickets: []
  };

  const normalized = deliveryRecordToNormalizedDelivery(dbRecord);
  assert.equal(normalized.deliverySequence, 3);
  assert.equal(normalized.runs.batter, 4);
  assert.equal(normalized.runs.total, 4);
  assert.equal(normalized.isLegalDelivery, true);
  assert.equal(normalized.source, undefined);
  assert.deepEqual(normalized.wickets, []);

  // Also test defensive handling when wickets is undefined
  const withoutWickets = deliveryRecordToNormalizedDelivery({ ...dbRecord, wickets: undefined });
  assert.deepEqual(withoutWickets.wickets, []);
});

test(
  'PostgreSQL enforces a unique delivery sequence within an innings',
  { skip: process.env.RUN_DATABASE_TESTS !== 'true' },
  async () => {
    const { prisma } = await import('../../src/db/prisma.js');
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    const match = await prisma.match.create({ data: { name: `Phase 2 test ${suffix}` } });
    const team = await prisma.team.create({ data: { name: `Test XI ${suffix}` } });
    const [batter, nonStriker, bowler] = await Promise.all(
      ['Batter', 'Non-striker', 'Bowler'].map((displayName) =>
        prisma.player.create({ data: { displayName: `${displayName} ${suffix}` } })
      )
    );
    const innings = await prisma.innings.create({
      data: { matchId: match.id, inningsNumber: 1, battingTeamId: team.id }
    });
    const delivery = normalizedDelivery({
      players: { batterId: batter.id, nonStrikerId: nonStriker.id, bowlerId: bowler.id },
      runs: { batter: 1, total: 1 }
    });

    try {
      await createDelivery(prisma, { inningsId: innings.id, delivery });

      await assert.rejects(
        () => createDelivery(prisma, { inningsId: innings.id, delivery }),
        (error) => error.code === 'P2002'
      );

      const savedDeliveries = await listInningsDeliveries(prisma, innings.id);
      const state = reconstructInningsState(
        savedDeliveries.map(deliveryRecordToNormalizedDelivery)
      );
      assert.equal(state.totalRuns, 1);
      assert.equal(state.legalDeliveries, 1);
    } finally {
      await prisma.match.delete({ where: { id: match.id } });
      await prisma.$disconnect();
    }
  }
);
