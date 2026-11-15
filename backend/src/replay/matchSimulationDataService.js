import { prisma } from '../db/prisma.js';
import * as stateCache from '../modules/match-intelligence/state/matchStateCache.js';

/**
 * Removes only data that is derived from a match's deliveries. Match metadata,
 * teams, players, and innings remain available for the next replay.
 */
export async function clearMatchSimulationData({ matchId, status }) {
  await prisma.$transaction(async (transaction) => {
    const innings = await transaction.innings.findMany({
      where: { matchId },
      select: { id: true }
    });
    const inningsIds = innings.map((inningsEntry) => inningsEntry.id);

    // Timeline records refer to deliveries, so remove them before the delivery
    // history. This also makes the reset explicit for database engines that do
    // not apply relation cascades in test doubles.
    await transaction.timelineEvent.deleteMany({ where: { matchId } });
    await transaction.matchSession.deleteMany({ where: { matchId } });
    await transaction.delivery.deleteMany({
      where: { inningsId: { in: inningsIds } }
    });
    await transaction.match.update({ where: { id: matchId }, data: { status } });
  });

  await stateCache.clear(matchId);
}
