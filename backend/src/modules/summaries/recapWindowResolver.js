function deliveryReference(delivery) {
  return {
    deliveryId: delivery.id,
    inningsId: delivery.inningsId,
    inningsNumber: delivery.innings.inningsNumber,
    deliverySequence: delivery.deliverySequence,
    display: {
      overNumber: delivery.displayOver,
      ballLabel: delivery.displayBallLabel
    }
  };
}

function createWindowFromDeliveries(type, selected, options = {}) {
  const deliveries = selected ?? [];
  return {
    type,
    availability: 'AVAILABLE',
    timestampQuality: options.timestampQuality ?? 'NOT_APPLICABLE',
    anchor: options.anchor ?? null,
    overRange: options.overRange ?? null,
    deliveryRange: {
      start: deliveries[0] ? deliveryReference(deliveries[0]) : null,
      end: deliveries.at(-1) ? deliveryReference(deliveries.at(-1)) : null,
      deliveryCount: deliveries.length
    },
    deliveries,
    limitations: options.limitations ?? []
  };
}

function createWindow(type, deliveries, startIndex, endIndex, options = {}) {
  const selected = startIndex < 0 || startIndex > endIndex ? [] : deliveries.slice(startIndex, endIndex + 1);
  return createWindowFromDeliveries(type, selected, options);
}

function unavailableTimeWindow(type, minutes) {
  return {
    type,
    availability: 'UNAVAILABLE',
    timestampQuality: 'UNAVAILABLE',
    anchor: null,
    overRange: null,
    deliveryRange: { start: null, end: null, deliveryCount: 0 },
    deliveries: [],
    limitations: [
      `A last ${minutes}-minute recap is unavailable because this match has no trustworthy event timestamps.`
    ]
  };
}

function completedOverGroups(deliveries, matchStatus) {
  const currentInningsNumber = deliveries.at(-1)?.innings.inningsNumber;
  if (currentInningsNumber === undefined) return [];

  const currentInnings = deliveries.filter(
    (delivery) => delivery.innings.inningsNumber === currentInningsNumber
  );
  const groups = [];
  for (const delivery of currentInnings) {
    const group = groups.at(-1);
    if (!group || group.overNumber !== delivery.displayOver) {
      groups.push({ overNumber: delivery.displayOver, deliveries: [delivery] });
    } else {
      group.deliveries.push(delivery);
    }
  }

  if (matchStatus === 'COMPLETE') return groups;
  return groups.slice(0, -1);
}

function completedOverRange(groups, requestedOvers) {
  const firstGroup = groups[0];
  const lastGroup = groups.at(-1);
  return {
    inningsNumber: firstGroup.deliveries[0].innings.inningsNumber,
    startOverNumber: firstGroup.overNumber,
    endOverNumber: lastGroup.overNumber,
    requestedOvers,
    completedOversReturned: groups.length
  };
}

function resolveLastCompletedOvers({ type, matchStatus, deliveries, requestedOvers }) {
  const completed = completedOverGroups(deliveries, matchStatus);
  if (completed.length === 0) {
    return createWindowFromDeliveries(type, [], {
      limitations: ['No completed over is available in the current innings yet.']
    });
  }

  const selectedGroups = completed.slice(-requestedOvers);
  const selectedDeliveries = selectedGroups.flatMap((group) => group.deliveries);
  const limitations =
    selectedGroups.length < requestedOvers
      ? [`Only ${selectedGroups.length} completed over(s) are available in the current innings.`]
      : [];
  return createWindowFromDeliveries(type, selectedDeliveries, {
    anchor: deliveryReference(selectedGroups.at(-1).deliveries.at(-1)),
    overRange: completedOverRange(selectedGroups, requestedOvers),
    limitations
  });
}

function afterSessionMarker(delivery, session) {
  if (session.joinedInningsNumber === null || session.joinedDeliverySequence === null) {
    return true;
  }
  const inningsNumber = delivery.innings.inningsNumber;
  return (
    inningsNumber > session.joinedInningsNumber ||
    (inningsNumber === session.joinedInningsNumber &&
      delivery.deliverySequence > session.joinedDeliverySequence)
  );
}



// The Main Method : 
// It build the window accoring to the TOOL selected!

export function resolveRecapWindow({ matchStatus, deliveries, request, session }) {
  if (request.window === 'WHOLE_MATCH') {
    return createWindow(request.window, deliveries, 0, deliveries.length - 1);
  }

  if (request.window === 'LAST_N_MINUTES') {
    if (deliveries.length === 0 || deliveries.some((delivery) => !delivery.occurredAt)) {
      return unavailableTimeWindow(request.window, request.minutes);
    }
    const latest = new Date(deliveries.at(-1).occurredAt).getTime();
    const cutoff = latest - request.minutes * 60_000;
    const startIndex = deliveries.findIndex(
      (delivery) => new Date(delivery.occurredAt).getTime() >= cutoff
    );
    return createWindow(request.window, deliveries, startIndex, deliveries.length - 1, {
      timestampQuality: 'TRUSTWORTHY_EVENT_TIME'
    });
  }

  if (request.window === 'SINCE_SESSION_JOIN') {
    const startIndex = deliveries.findIndex((delivery) => afterSessionMarker(delivery, session));
    return createWindow(request.window, deliveries, startIndex, deliveries.length - 1, {
      anchor: {
        inningsNumber: session.joinedInningsNumber,
        deliverySequence: session.joinedDeliverySequence,
        joinedAt: session.joinedAt
      }
    });
  }

  if (request.window === 'LAST_OVER') {
    return resolveLastCompletedOvers({
      type: request.window,
      matchStatus,
      deliveries,
      requestedOvers: 1
    });
  }

  if (request.window === 'LAST_N_OVERS') {
    return resolveLastCompletedOvers({
      type: request.window,
      matchStatus,
      deliveries,
      requestedOvers: request.overs
    });
  }

  throw new Error(`Unsupported recap window: ${request.window}`);
}
