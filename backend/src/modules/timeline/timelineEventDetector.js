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

function groupsByOver(deliveries) {
  const groups = [];
  for (const delivery of deliveries) {
    const group = groups.at(-1);
    if (!group || group.overNumber !== delivery.displayOver) {
      groups.push({ overNumber: delivery.displayOver, deliveries: [delivery] });
    } else {
      group.deliveries.push(delivery);
    }
  }
  return groups;
}

function bowlerConceded(deliveries) {
  return deliveries.reduce(
    (total, delivery) =>
      total + delivery.totalRuns - delivery.byes - delivery.legByes - delivery.penaltyRuns,
    0
  );
}

export function eventForCompletedOver(group, completedGroups) {
  const anchor = group.deliveries.at(-1);
  const runs = group.deliveries.reduce((total, delivery) => total + delivery.totalRuns, 0);
  const conceded = bowlerConceded(group.deliveries);
  const bowler = anchor.bowler.displayName;
  const events = [];

  if (conceded === 0) {
    events.push(
      eventFromDelivery(anchor, {
        eventKey: `completed-over:${anchor.id}:maiden`,
        eventOrder: 60,
        type: 'MAIDEN_OVER',
        title: `Maiden over by ${bowler}`,
        description: `${bowler} conceded no runs in over ${group.overNumber}.`,
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
        description: `${bowler} conceded ${conceded} runs in over ${group.overNumber}.`,
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
          title: `Scoring rate surged in over ${group.overNumber}`,
          description: `${runs} runs came from over ${group.overNumber}, after an average of ${baseline.toFixed(1)} across the previous ${previous.length} overs.`,
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
          title: `Scoring rate slowed in over ${group.overNumber}`,
          description: `Only ${runs} runs came from over ${group.overNumber}, after an average of ${baseline.toFixed(1)} across the previous ${previous.length} overs.`,
          ...importance(65, 'HIGHLIGHT')
        })
      );
    }
  }

  return { events, runs };
}

/**
 * Detects events that occur on a single delivery (boundaries, wickets,
 * and batter/partnership milestones). Pure function shared by full sync and fast path.
 */
export function detectSingleDeliveryEvents({
  delivery,
  previousBatterRuns = 0,
  updatedBatterRuns = previousBatterRuns + delivery.batterRuns,
  previousPartnershipRuns = 0,
  updatedPartnershipRuns = previousPartnershipRuns + delivery.totalRuns,
  partnershipStartDeliveryId = delivery.id,
  partnershipPlayers = pairFor(delivery)
}) {
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

  for (const milestone of BATTER_MILESTONES) {
    if (previousBatterRuns < milestone && updatedBatterRuns >= milestone) {
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

  for (const milestone of PARTNERSHIP_MILESTONES) {
    if (previousPartnershipRuns < milestone && updatedPartnershipRuns >= milestone) {
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

/**
 * Produces notable events from one ordered innings. It uses stable delivery
 * sequence for chronology and never treats a display label as an identifier.
 */
export function detectTimelineEvents({ deliveries, isInningsComplete }) {
  const events = [];
  const batterRuns = new Map();
  let activePartnership = null;

  for (const delivery of deliveries) {
    const previousBatterRuns = batterRuns.get(delivery.batter.id) ?? 0;
    const updatedBatterRuns = previousBatterRuns + delivery.batterRuns;
    batterRuns.set(delivery.batter.id, updatedBatterRuns);

    const pair = pairFor(delivery);
    const pairKey = pair.map((player) => player.id).join(':');
    if (!activePartnership || activePartnership.key !== pairKey) {
      activePartnership = {
        key: pairKey,
        startDeliveryId: delivery.id,
        players: pair,
        runs: 0
      };
    }
    const previousPartnershipRuns = activePartnership.runs;
    activePartnership.runs += delivery.totalRuns;

    events.push(
      ...detectSingleDeliveryEvents({
        delivery,
        previousBatterRuns,
        updatedBatterRuns,
        previousPartnershipRuns,
        updatedPartnershipRuns: activePartnership.runs,
        partnershipStartDeliveryId: activePartnership.startDeliveryId,
        partnershipPlayers: activePartnership.players
      })
    );
  }

  const completedGroups = [];
  const groups = groupsByOver(deliveries);
  for (const [index, group] of groups.entries()) {
    const isComplete = index < groups.length - 1 || isInningsComplete;
    if (!isComplete) continue;
    const completed = eventForCompletedOver(group, completedGroups);
    events.push(...completed.events);
    completedGroups.push({ runs: completed.runs });
  }

  return events.sort(
    (left, right) =>
      left.deliverySequence - right.deliverySequence || left.eventOrder - right.eventOrder
  );
}
