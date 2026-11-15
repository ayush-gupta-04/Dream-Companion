import { prisma } from '../../../db/prisma.js';
import { reconstructInningsState } from '../domain/reconstructInningsState.js';
import { deliveryRecordToNormalizedDelivery } from '../persistence/deliveryRepository.js';

export async function buildMatchState(matchId) {
  const match = await prisma.match.findUnique({
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

  if (!match) {
    return null;
  }

  const playerNames = new Map(
    match.players?.map((mp) => [mp.playerId, mp.player.displayName]) ?? []
  );

  const innings = match.innings.map((entry) => ({
    id: entry.id,
    inningsNumber: entry.inningsNumber,
    battingTeam: entry.battingTeam.name,
    targetRuns: entry.targetRuns,
    state: reconstructInningsState(
      entry.deliveries.map((d) => {
        const normalized = deliveryRecordToNormalizedDelivery(d);
        if (playerNames.size > 0) {
          return {
            ...normalized,
            players: {
              ...normalized.players,
              batterId: playerNames.get(normalized.players.batterId) || normalized.players.batterId,
              nonStrikerId:
                playerNames.get(normalized.players.nonStrikerId) || normalized.players.nonStrikerId,
              bowlerId: playerNames.get(normalized.players.bowlerId) || normalized.players.bowlerId
            }
          };
        }
        return normalized;
      }),
      {
        ballsPerOver: match.ballsPerOver,
        initialRuns:
          entry.prePenaltyRuns + (match.status === 'COMPLETE' ? entry.postPenaltyRuns : 0)
      }
    )
  }));

  // Current innings is the latest innings that has recorded deliveries, or the first innings if none have started yet.
  const activeEntry =
    [...match.innings].reverse().find((entry) => entry.deliveries.length > 0) ?? match.innings[0];
  const currentInnings = activeEntry
    ? (innings.find((inn) => inn.id === activeEntry.id) ?? null)
    : null;

  return {
    matchId: match.id,
    name: match.name,
    status: match.status,
    ballsPerOver: match.ballsPerOver,
    currentInnings,
    innings,
    updatedAt: new Date().toISOString()
  };
}
