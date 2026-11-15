import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as timelineService from '../../src/modules/timeline/timelineService.js';
import { createTimelineState } from '../../src/modules/timeline/timelineEventDetector.js';

test(
  'persists incremental events once, rolls back failed batches, and reconciles corrections',
  { skip: process.env.RUN_DATABASE_TESTS !== 'true' },
  async () => {
    const { prisma } = await import('../../src/db/prisma.js');
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    const match = await prisma.match.create({
      data: { name: `Timeline integration ${suffix}`, status: 'LIVE' }
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
    const data = {
      inningsId: innings.id, deliverySequence: 1, displayOver: 0, displayBallLabel: '0.1',
      batterId: batter.id, nonStrikerId: nonStriker.id, bowlerId: bowler.id,
      batterRuns: 4, totalExtras: 0, totalRuns: 4, isLegalDelivery: true
    };
    const delivery = await prisma.delivery.create({ data });
    const players = new Map([batter, nonStriker, bowler].map((player) => [player.id, player]));
    const context = { matchId: match.id, innings, players };

    try {
      const first = await timelineService.recordDelivery({ ...context, delivery, state: createTimelineState() });
      const repeated = await timelineService.recordDelivery({ ...context, delivery, state: createTimelineState() });
      assert.equal(first.created[0].type, 'FOUR');
      assert.deepEqual(repeated, { created: [], updated: [], deleted: [] });

      // Both event keys occupy delivery/order 1/10; delete the obsolete four before inserting the six.
      const six = await prisma.delivery.update({
        where: { id: delivery.id }, data: { batterRuns: 6, totalRuns: 6 }
      });
      const replaced = await timelineService.synchronizeMatch({ matchId: match.id });
      assert.equal(replaced.created[0].type, 'SIX');
      assert.equal(replaced.deleted[0].id, first.created[0].id);
      assert.notEqual(replaced.created[0].id, first.created[0].id);

      const next = await prisma.delivery.create({
        data: { ...data, deliverySequence: 2, displayBallLabel: '0.2', wickets: {
          create: { wicketSequence: 1, playerOutId: nonStriker.id, kind: 'run out', countsAsWicket: true }
        } },
        include: { wickets: true }
      });
      // A stale event blocks the second write in a two-event batch. Its first write must roll back.
      const seed = await prisma.timelineEvent.findUnique({ where: { id: replaced.created[0].id } });
      delete seed.id;
      delete seed.createdAt;
      delete seed.updatedAt;
      const blocker = await prisma.timelineEvent.create({ data: {
        ...seed, deliveryId: next.id, deliverySequence: 2, displayBallLabel: '0.2',
        eventKey: 'test:occupied-wicket', eventOrder: 21, type: 'WICKET'
      } });
      const restoredState = () => timelineService.createInningsState({ deliveries: [six], players });
      await assert.rejects(
        timelineService.recordDelivery({ ...context, delivery: next, state: restoredState() }),
        (error) => error.code === 'P2002'
      );
      assert.equal(await prisma.timelineEvent.count({ where: { matchId: match.id } }), 2);
      assert.equal(await prisma.timelineEvent.findUnique({ where: {
        matchId_eventKey: { matchId: match.id, eventKey: `delivery:${next.id}:four` }
      } }), null);
      await prisma.timelineEvent.delete({ where: { id: blocker.id } });
      const retried = await timelineService.recordDelivery({ ...context, delivery: next, state: restoredState() });
      assert.deepEqual(retried.created.map((event) => event.type), ['FOUR', 'WICKET']);

      await prisma.match.update({ where: { id: match.id }, data: { status: 'COMPLETE' } });
      assert.deepEqual(await timelineService.synchronizeMatch({ matchId: match.id }),
        { created: [], updated: [], deleted: [] });
      const listed = await timelineService.list({ matchId: match.id, limit: 50 });
      assert.deepEqual(listed.events.map((event) => event.type), ['SIX', 'FOUR', 'WICKET']);

      await prisma.delivery.update({
        where: { id: delivery.id },
        data: { batterRuns: 0, totalRuns: 0 }
      });
      const corrected = await timelineService.synchronizeMatch({ matchId: match.id });
      assert.equal(corrected.deleted[0].id, replaced.created[0].id);
      assert.equal(await prisma.timelineEvent.count({ where: { matchId: match.id } }), 2);
    } finally {
      await prisma.match.delete({ where: { id: match.id } });
      await prisma.player.deleteMany({ where: { id: { in: [batter.id, nonStriker.id, bowler.id] } } });
      await prisma.team.delete({ where: { id: team.id } });
      await prisma.$disconnect();
    }
  }
);
