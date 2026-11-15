import { prisma } from '../../../db/prisma.js';
import { createMatchStateAccumulator } from './matchStateAccumulator.js';

export function loadMatchForState(matchId) {
  return prisma.match.findUnique({
    where: { id: matchId },
    include: {
      players: { include: { player: true } },
      innings: {
        orderBy: { inningsNumber: 'asc' },
        include: {
          battingTeam: true,
          deliveries: { orderBy: { deliverySequence: 'asc' }, include: { wickets: true } }
        }
      }
    }
  });
}

export async function buildMatchState(matchId) {
  const match = await loadMatchForState(matchId);
  if (!match) {
    return null;
  }

  return createMatchStateAccumulator(match).snapshot();
}
