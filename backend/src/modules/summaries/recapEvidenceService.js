import { EMPTY_EXTRAS } from '../../utils/cricket.js';
import { formatDeliveryReference } from '../../utils/formatting.js';

const byRunsDesc = (a, b) => b.runs - a.runs || a.name.localeCompare(b.name);
const byRunsConcededDesc = (a, b) => b.runsConceded - a.runsConceded || a.name.localeCompare(b.name);

/**
 * Creates factual recap evidence in a single clean pass over deliveries.
 * Contains purely deterministic facts without model-generated language.
 */
export function buildRecapEvidence({ matchId, deliveries, window }) {
  const totals = { runs: 0, wickets: 0, fours: 0, sixes: 0, dots: 0, extras: { ...EMPTY_EXTRAS } };
  const batters = {};
  const bowlers = {};
  const notableEvents = [];
  const references = [];

  for (const delivery of deliveries) {
    const reference = formatDeliveryReference(delivery);
    references.push(reference);

    totals.runs += delivery.totalRuns;
    if (delivery.totalRuns === 0) totals.dots += 1;

    totals.extras.wides += delivery.wides;
    totals.extras.noBalls += delivery.noBalls;
    totals.extras.byes += delivery.byes;
    totals.extras.legByes += delivery.legByes;
    totals.extras.penaltyRuns += delivery.penaltyRuns;

    for (const wicket of delivery.wickets) {
      if (wicket.countsAsWicket) {
        totals.wickets += 1;
        notableEvents.push({
          type: 'WICKET',
          playerOut: wicket.playerOut.displayName,
          kind: wicket.kind,
          reference
        });
      }
    }

    if (delivery.batterRuns === 4) {
      totals.fours += 1;
      notableEvents.push({
        type: 'FOUR',
        batter: delivery.batter.displayName,
        runs: 4,
        reference
      });
    } else if (delivery.batterRuns === 6) {
      totals.sixes += 1;
      notableEvents.push({
        type: 'SIX',
        batter: delivery.batter.displayName,
        runs: 6,
        reference
      });
    }

    const batter = (batters[delivery.batter.id] ??= {
      playerId: delivery.batter.id,
      name: delivery.batter.displayName,
      runs: 0
    });
    batter.runs += delivery.batterRuns;

    const bowler = (bowlers[delivery.bowler.id] ??= {
      playerId: delivery.bowler.id,
      name: delivery.bowler.displayName,
      runsConceded: 0
    });
    bowler.runsConceded +=
      delivery.totalRuns - delivery.byes - delivery.legByes - delivery.penaltyRuns;
  }

  return {
    matchId,
    window: {
      type: window.type,
      timestampQuality: window.timestampQuality,
      anchor: window.anchor,
      overRange: window.overRange,
      deliveryRange: window.deliveryRange
    },
    totals,
    contributors: {
      batters: Object.values(batters).sort(byRunsDesc).slice(0, 5),
      bowlers: Object.values(bowlers).sort(byRunsConcededDesc).slice(0, 5)
    },
    notableEvents: notableEvents.slice(-20),
    references
  };
}

/** Limits model context while preserving deterministic facts. */
export function recapNarrationContext(evidence) {
  return {
    window: evidence.window,
    totals: evidence.totals,
    contributors: evidence.contributors,
    notableEvents: evidence.notableEvents
  };
}
