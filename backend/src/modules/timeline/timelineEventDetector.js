import {
  BATTER_MILESTONES,
  EXPENSIVE_OVER_RUNS,
  PARTNERSHIP_MILESTONES,
  SCORING_RATE_ACCELERATION_MINIMUM,
  SCORING_RATE_ACCELERATION_MULTIPLIER,
  SCORING_RATE_SLOWDOWN_BASELINE,
  SCORING_RATE_SLOWDOWN_MAXIMUM,
  SCORING_RATE_SLOWDOWN_MULTIPLIER,
  SCORING_RATE_WINDOW_OVERS
} from './timelineRules.js';

function importance(score, level) {
  return { importanceScore: score, importanceLevel: level };
}

function eventFromDelivery(delivery, details) {
  return {
    inningsId: delivery.inningsId,
    deliveryId: delivery.id,
    deliverySequence: delivery.deliverySequence,
    displayOver: delivery.displayOver,
    displayBallLabel: delivery.displayBallLabel,
    occurredAt: delivery.occurredAt,
    ...details
  };
}

function pairFor(delivery) {
  return [delivery.batter, delivery.nonStriker].sort((left, right) =>
    left.id.localeCompare(right.id)
  );
}

function bowlerConceded(delivery) {
  return delivery.totalRuns - delivery.byes - delivery.legByes - delivery.penaltyRuns;
}

function completedOverEvents({ overNumber, anchor, runs, conceded }, completedGroups) {
  const bowler = anchor.bowler.displayName;
  const events = [];

  if (conceded === 0) {
    events.push(
      eventFromDelivery(anchor, {
        eventKey: `completed-over:${anchor.id}:maiden`,
        eventOrder: 60,
        type: 'MAIDEN_OVER',
        title: `Maiden over by ${bowler}`,
        description: `${bowler} conceded no runs in over ${overNumber}.`,
        ...importance(60, 'HIGHLIGHT')
      })
    );
  }

  if (conceded >= EXPENSIVE_OVER_RUNS) {
    const score = Math.min(90, 60 + (conceded - EXPENSIVE_OVER_RUNS) * 5);
    events.push(
      eventFromDelivery(anchor, {
        eventKey: `completed-over:${anchor.id}:expensive`,
        eventOrder: 70,
        type: 'EXPENSIVE_OVER',
        title: `${conceded}-run over against ${bowler}`,
        description: `${bowler} conceded ${conceded} runs in over ${overNumber}.`,
        ...importance(score, conceded >= 20 ? 'MAJOR' : 'HIGHLIGHT')
      })
    );
  }

  const previous = completedGroups.slice(-SCORING_RATE_WINDOW_OVERS);
  if (previous.length === SCORING_RATE_WINDOW_OVERS) {
    const baseline =
      previous.reduce((total, previousGroup) => total + previousGroup.runs, 0) / previous.length;
    if (
      runs >= SCORING_RATE_ACCELERATION_MINIMUM &&
      runs >= baseline * SCORING_RATE_ACCELERATION_MULTIPLIER
    ) {
      events.push(
        eventFromDelivery(anchor, {
          eventKey: `completed-over:${anchor.id}:acceleration`,
          eventOrder: 80,
          type: 'SCORING_RATE_SHIFT',
          title: `Scoring rate surged in over ${overNumber}`,
          description: `${runs} runs came from over ${overNumber}, after an average of ${baseline.toFixed(1)} across the previous ${previous.length} overs.`,
          ...importance(65, 'HIGHLIGHT')
        })
      );
    } else if (
      runs <= SCORING_RATE_SLOWDOWN_MAXIMUM &&
      baseline >= SCORING_RATE_SLOWDOWN_BASELINE &&
      runs <= baseline * SCORING_RATE_SLOWDOWN_MULTIPLIER
    ) {
      events.push(
        eventFromDelivery(anchor, {
          eventKey: `completed-over:${anchor.id}:slowdown`,
          eventOrder: 80,
          type: 'SCORING_RATE_SHIFT',
          title: `Scoring rate slowed in over ${overNumber}`,
          description: `Only ${runs} runs came from over ${overNumber}, after an average of ${baseline.toFixed(1)} across the previous ${previous.length} overs.`,
          ...importance(65, 'HIGHLIGHT')
        })
      );
    }
  }

  return events;
}

/**
 * Detects boundaries and wickets without accumulated innings state.
 */
export function detectBoundaryAndWicketEvents(delivery) {
  const events = [];

  if (delivery.batterRuns === 4) {
    events.push(
      eventFromDelivery(delivery, {
        eventKey: `delivery:${delivery.id}:four`,
        eventOrder: 10,
        type: 'FOUR',
        title: `Four by ${delivery.batter.displayName}`,
        description: `${delivery.batter.displayName} hit four at ${delivery.displayBallLabel}.`,
        ...importance(35, 'MINOR')
      })
    );
  }

  if (delivery.batterRuns === 6) {
    events.push(
      eventFromDelivery(delivery, {
        eventKey: `delivery:${delivery.id}:six`,
        eventOrder: 10,
        type: 'SIX',
        title: `Six by ${delivery.batter.displayName}`,
        description: `${delivery.batter.displayName} hit six at ${delivery.displayBallLabel}.`,
        ...importance(55, 'HIGHLIGHT')
      })
    );
  }

  for (const [wicketIndex, wicket] of (delivery.wickets ?? []).entries()) {
    if (!wicket.countsAsWicket) continue;
    const wicketSequence = wicket.wicketSequence ?? wicketIndex + 1;
    events.push(
      eventFromDelivery(delivery, {
        eventKey: `delivery:${delivery.id}:wicket:${wicketSequence}`,
        eventOrder: 20 + wicketSequence,
        type: 'WICKET',
        title: `Wicket — ${wicket.playerOut.displayName}`,
        description: `${wicket.playerOut.displayName} was dismissed ${wicket.kind} at ${delivery.displayBallLabel}.`,
        ...importance(90, 'MAJOR')
      })
    );
  }

  return events;
}

export function detectBatterMilestoneEvents({ delivery, previousRuns, updatedRuns }) {
  const events = [];

  for (const milestone of BATTER_MILESTONES) {
    if (previousRuns < milestone && updatedRuns >= milestone) {
      events.push(
        eventFromDelivery(delivery, {
          eventKey: `batter-milestone:${delivery.inningsId}:${delivery.batter.id}:${milestone}`,
          eventOrder: 30 + milestone / 50,
          type: 'BATTER_MILESTONE',
          title: `${milestone} for ${delivery.batter.displayName}`,
          description: `${delivery.batter.displayName} reached ${milestone} runs at ${delivery.displayBallLabel}.`,
          ...importance(milestone === 100 ? 90 : 70, milestone === 100 ? 'MAJOR' : 'HIGHLIGHT')
        })
      );
    }
  }

  return events;
}

export function detectPartnershipMilestoneEvents({
  delivery,
  previousRuns,
  updatedRuns,
  partnershipStartDeliveryId = delivery.id,
  partnershipPlayers = pairFor(delivery),
  milestones = PARTNERSHIP_MILESTONES
}) {
  const events = [];

  for (const milestone of milestones) {
    if (previousRuns < milestone && updatedRuns >= milestone) {
      const names = partnershipPlayers.map((player) => player.displayName).join(' and ');
      events.push(
        eventFromDelivery(delivery, {
          eventKey: `partnership-milestone:${partnershipStartDeliveryId}:${milestone}`,
          eventOrder: 40 + milestone / 50,
          type: 'PARTNERSHIP_MILESTONE',
          title: `${milestone}-run partnership`,
          description: `${names} added ${milestone} runs together at ${delivery.displayBallLabel}.`,
          ...importance(milestone === 100 ? 85 : 65, milestone === 100 ? 'MAJOR' : 'HIGHLIGHT')
        })
      );
    }
  }

  return events;
}

export function detectSingleDeliveryEvents({
  delivery,
  previousBatterRuns = 0,
  updatedBatterRuns = previousBatterRuns + delivery.batterRuns,
  previousPartnershipRuns = 0,
  updatedPartnershipRuns = previousPartnershipRuns + delivery.totalRuns,
  partnershipStartDeliveryId = delivery.id,
  partnershipPlayers = pairFor(delivery)
}) {
  return [
    ...detectBoundaryAndWicketEvents(delivery),
    ...detectBatterMilestoneEvents({
      delivery,
      previousRuns: previousBatterRuns,
      updatedRuns: updatedBatterRuns
    }),
    ...detectPartnershipMilestoneEvents({
      delivery,
      previousRuns: previousPartnershipRuns,
      updatedRuns: updatedPartnershipRuns,
      partnershipStartDeliveryId,
      partnershipPlayers
    })
  ];
}

/** Creates independent detector state for one innings; no delivery history is retained. */
export function createTimelineState() {
  return { batterRuns: new Map(), partnership: null, currentOver: null, previousOvers: [] };
}

function completeOver(state) {
  const over = state.currentOver;
  if (!over) return [];
  const events = completedOverEvents(over, state.previousOvers);
  state.previousOvers.push({ runs: over.runs });
  if (state.previousOvers.length > SCORING_RATE_WINDOW_OVERS) state.previousOvers.shift();
  state.currentOver = null;
  return events;
}

/**
 * Mutates one innings state using the next ordered delivery and returns new events.
 * Prior deliveries must be applied exactly once; corrections require rebuilding state.
 */
export function applyDeliveryToTimelineState(state, delivery) {
  const events = state.currentOver && state.currentOver.overNumber !== delivery.displayOver
    ? completeOver(state) : [];
  const over = state.currentOver ??= {
    overNumber: delivery.displayOver, anchor: null, runs: 0, conceded: 0
  };
  over.anchor = delivery;
  over.runs += delivery.totalRuns;
  over.conceded += bowlerConceded(delivery);

  const previousBatterRuns = state.batterRuns.get(delivery.batter.id) ?? 0;
  const updatedBatterRuns = previousBatterRuns + delivery.batterRuns;
  state.batterRuns.set(delivery.batter.id, updatedBatterRuns);

  const pair = pairFor(delivery);
  const pairKey = pair.map((player) => player.id).join(':');
  if (!state.partnership || state.partnership.key !== pairKey) {
    state.partnership = {
      key: pairKey, startDeliveryId: delivery.id, players: pair, runs: 0
    };
  }
  const previousPartnershipRuns = state.partnership.runs;
  state.partnership.runs += delivery.totalRuns;

  const deliveryEvents = detectSingleDeliveryEvents({
    delivery,
    previousBatterRuns,
    updatedBatterRuns,
    previousPartnershipRuns,
    updatedPartnershipRuns: state.partnership.runs,
    partnershipStartDeliveryId: state.partnership.startDeliveryId,
    partnershipPlayers: state.partnership.players
  });
  events.push(...deliveryEvents.sort((left, right) => left.eventOrder - right.eventOrder));
  return events;
}

/** Emits the pending over's events once, including an innings ending mid-over. */
export function finishTimelineInnings(state) {
  return completeOver(state);
}

/** Detects events from one ordered innings using the same state as incremental detection. */
export function detectTimelineEvents({ deliveries, isInningsComplete }) {
  const state = createTimelineState();
  const events = [];
  for (const delivery of deliveries) {
    events.push(...applyDeliveryToTimelineState(state, delivery));
  }
  if (isInningsComplete) events.push(...finishTimelineInnings(state));
  return events;
}
