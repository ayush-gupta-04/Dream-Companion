import { prisma } from '../db/prisma.js';
import * as stateCache from '../modules/match-intelligence/state/matchStateCache.js';

/**
 * Removes only delivery-derived data (deliveries, wickets, timeline events, sessions)
 * while preserving match metadata, teams, players, and innings for replay.
 */
export async function clearMatchSimulationData({ matchId, status = 'LIVE' }) {
  await prisma.$transaction(async (transaction) => {
    await transaction.matchSession.deleteMany({ where: { matchId } });
    await transaction.delivery.deleteMany({ where: { innings: { matchId } } });
    await transaction.match.update({ where: { id: matchId }, data: { status } });
  });

  await stateCache.clear(matchId);
}
