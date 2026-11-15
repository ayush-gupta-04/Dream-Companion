import { applyDeliveryToInningsState } from '../domain/scoring.js';
import { reconstructInningsState } from '../domain/reconstructInningsState.js';
import { validateNormalizedDelivery } from '../domain/validateNormalizedDelivery.js';
import { deliveryRecordToNormalizedDelivery } from '../persistence/deliveryRepository.js';

function namedPlayerStates(states, playerNames) {
  return Object.fromEntries(Object.entries(states).map(([id, stats]) => [
    playerNames.get(id) || id, stats
  ]));
}

/** Builds a replay's score state from persisted facts; keeps no delivery history. */
export function createMatchStateAccumulator({
  id: matchId, name, status: initialStatus, ballsPerOver, players = [], innings: storedInnings
}) {
  let status = initialStatus;
  const playerNames = new Map(players.map(({ playerId, player }) => [playerId, player.displayName]));
  const innings = storedInnings.map((entry) => ({
    id: entry.id,
    inningsNumber: entry.inningsNumber,
    battingTeam: entry.battingTeam.name,
    targetRuns: entry.targetRuns,
    postPenaltyRuns: entry.postPenaltyRuns,
    state: reconstructInningsState(entry.deliveries.map(deliveryRecordToNormalizedDelivery), {
      ballsPerOver,
      initialRuns: entry.prePenaltyRuns + (status === 'COMPLETE' ? entry.postPenaltyRuns : 0)
    })
  }));
  const inningsById = new Map(innings.map((entry) => [entry.id, entry]));
  const activeId = storedInnings.findLast((entry) => entry.deliveries.length > 0)?.id;
  let currentInnings = inningsById.get(activeId) ?? innings[0];

  return {
    // Apply each new delivery exactly once, in order. Recreate after a correction.
    applyDelivery(record) {
      if (status === 'COMPLETE') throw new Error('Cannot score a completed match.');
      const entry = inningsById.get(record.inningsId);
      if (!entry) throw new Error(`Unknown innings: ${record.inningsId}`);
      const delivery = validateNormalizedDelivery(deliveryRecordToNormalizedDelivery(record));
      applyDeliveryToInningsState(entry.state, delivery);
      if (!currentInnings || entry.inningsNumber >= currentInnings.inningsNumber) currentInnings = entry;
    },

    complete() {
      if (status === 'COMPLETE') return;
      for (const entry of innings) entry.state.totalRuns += entry.postPenaltyRuns;
      status = 'COMPLETE';
    },

    snapshot() {
      const publicInnings = innings.map((entry) => ({
        id: entry.id,
        inningsNumber: entry.inningsNumber,
        battingTeam: entry.battingTeam,
        targetRuns: entry.targetRuns,
        state: {
          ...entry.state,
          batters: namedPlayerStates(entry.state.batters, playerNames),
          bowlers: namedPlayerStates(entry.state.bowlers, playerNames)
        }
      }));
      return structuredClone({
        matchId, name, status, ballsPerOver,
        currentInnings: publicInnings.find((entry) => entry.id === currentInnings?.id) ?? null,
        innings: publicInnings,
        updatedAt: new Date().toISOString()
      });
    }
  };
}
