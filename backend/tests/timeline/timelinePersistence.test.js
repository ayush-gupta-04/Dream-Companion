import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTimelineService } from '../../src/modules/timeline/timelineService.js';

test(
  'persists each derived event once and removes it after a corrected delivery',
  { skip: process.env.RUN_DATABASE_TESTS !== 'true' },
  async () => {
    const { prisma } = await import('../../src/db/prisma.js');
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    const match = await prisma.match.create({
      data: { name: `Phase 6 test ${suffix}`, status: 'COMPLETE' }
    });
    const team = await prisma.team.create({ data: { name: `Timeline XI ${suffix}` } });
    const [batter, nonStriker, bowler] = await Promise.all(
      ['Batter', 'Non-striker', 'Bowler'].map((displayName) =>
        prisma.player.create({ data: { displayName: `${displayName} ${suffix}` } })
      )
    );
    const innings = await prisma.innings.create({
      data: { matchId: match.id, inningsNumber: 1, battingTeamId: team.id }
    });
    const delivery = await prisma.delivery.create({
      data: {
        inningsId: innings.id,
        deliverySequence: 1,
        displayOver: 0,
        displayBallLabel: '0.1',
        batterId: batter.id,
        nonStrikerId: nonStriker.id,
        bowlerId: bowler.id,
        batterRuns: 4,
        totalExtras: 0,
        totalRuns: 4,
        isLegalDelivery: true
      }
    });
    const service = createTimelineService({ prisma });

    try {
      const first = await service.synchronizeMatch({ matchId: match.id });
      const repeated = await service.synchronizeMatch({ matchId: match.id });
      const listed = await service.list({ matchId: match.id, limit: 50 });
      await prisma.delivery.update({
        where: { id: delivery.id },
        data: { batterRuns: 0, totalRuns: 0 }
      });
      const corrected = await service.synchronizeMatch({ matchId: match.id });

      assert.equal(first.created.filter((event) => event.type === 'FOUR').length, 1);
      assert.equal(repeated.created.length, 0);
      assert.equal(repeated.updated.length, 0);
      assert.deepEqual(
        listed.events.map((event) => event.type),
        ['FOUR']
      );
      assert.equal(corrected.deleted.filter((event) => event.type === 'FOUR').length, 1);
      assert.equal(await prisma.timelineEvent.count({ where: { matchId: match.id } }), 1);
    } finally {
      await prisma.match.delete({ where: { id: match.id } });
      await prisma.$disconnect();
    }
  }
);
