import { reconstructInningsState } from '../domain/reconstructInningsState.js';
import { deliveryRecordToNormalizedDelivery } from '../persistence/deliveryRepository.js';

export async function buildMatchState(prisma, matchId) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
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

  const innings = match.innings.map((entry) => ({
    id: entry.id,
    inningsNumber: entry.inningsNumber,
    battingTeam: entry.battingTeam.name,
    targetRuns: entry.targetRuns,
    state: reconstructInningsState(entry.deliveries.map(deliveryRecordToNormalizedDelivery), {
      ballsPerOver: match.ballsPerOver,
      initialRuns: entry.prePenaltyRuns + (match.status === 'COMPLETE' ? entry.postPenaltyRuns : 0)
    })
  }));

  return {
    matchId: match.id,
    name: match.name,
    status: match.status,
    ballsPerOver: match.ballsPerOver,
    currentInnings: innings.at(-1) ?? null,
    innings,
    updatedAt: new Date().toISOString()
  };
}
