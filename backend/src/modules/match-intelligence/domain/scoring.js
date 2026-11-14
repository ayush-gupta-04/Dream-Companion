import {
  BOWLER_WICKET_KINDS,
  EMPTY_EXTRAS,
  formatOvers,
  isBowlerWicket
} from '../../../utils/cricket.js';
import { round } from '../../../utils/math.js';

export { BOWLER_WICKET_KINDS, EMPTY_EXTRAS, formatOvers, isBowlerWicket };

function createBatterState() {
  return { runs: 0, ballsFaced: 0, fours: 0, sixes: 0, strikeRate: 0 };
}

function createBowlerState() {
  return { legalDeliveries: 0, overs: '0.0', runsConceded: 0, wickets: 0, economy: 0 };
}

function updateRates(state) {
  for (const batter of Object.values(state.batters)) {
    batter.strikeRate =
      batter.ballsFaced === 0 ? 0 : round((batter.runs / batter.ballsFaced) * 100);
  }

  for (const bowler of Object.values(state.bowlers)) {
    bowler.overs = formatOvers(bowler.legalDeliveries, state.ballsPerOver);
    bowler.economy =
      bowler.legalDeliveries === 0
        ? 0
        : round((bowler.runsConceded * (state.ballsPerOver ?? 6)) / bowler.legalDeliveries);
  }

  state.overs = formatOvers(state.legalDeliveries, state.ballsPerOver);
  return state;
}

export function createEmptyInningsState({ ballsPerOver = 6, initialRuns = 0 } = {}) {
  return {
    totalRuns: initialRuns,
    wickets: 0,
    legalDeliveries: 0,
    overs: '0.0',
    ballsPerOver,
    extras: { ...EMPTY_EXTRAS },
    batters: {},
    bowlers: {}
  };
}

/**
 * Applies one already-validated delivery to innings state.
 */
export function applyDeliveryToInningsState(state, delivery) {
  const batter = state.batters[delivery.players.batterId] ?? createBatterState();
  const bowler = state.bowlers[delivery.players.bowlerId] ?? createBowlerState();

  state.batters[delivery.players.batterId] = batter;
  state.bowlers[delivery.players.bowlerId] = bowler;
  state.totalRuns += delivery.runs.total;

  for (const [extraType, runs] of Object.entries(delivery.extras)) {
    state.extras[extraType] += runs;
  }

  batter.runs += delivery.runs.batter;
  if (delivery.extras.wides === 0) {
    batter.ballsFaced += 1;
  }
  if (delivery.runs.batter === 4) {
    batter.fours += 1;
  }
  if (delivery.runs.batter === 6) {
    batter.sixes += 1;
  }

  if (delivery.isLegalDelivery) {
    state.legalDeliveries += 1;
    bowler.legalDeliveries += 1;
  }

  bowler.runsConceded +=
    delivery.runs.total -
    delivery.extras.byes -
    delivery.extras.legByes -
    delivery.extras.penaltyRuns;

  for (const wicket of delivery.wickets) {
    if (wicket.countsAsWicket) {
      state.wickets += 1;
    }
    if (isBowlerWicket(wicket)) {
      bowler.wickets += 1;
    }
  }

  return updateRates(state);
}
