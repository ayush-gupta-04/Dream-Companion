import { formatDeliveryReference } from '../../utils/formatting.js';

function createWindow(type, deliveries = [], options = {}) {
  return {
    type,
    availability: options.availability ?? 'AVAILABLE',
    timestampQuality: options.timestampQuality ?? 'NOT_APPLICABLE',
    anchor: options.anchor ?? null,
    overRange: options.overRange ?? null,
    deliveryRange: {
      start: deliveries[0] ? formatDeliveryReference(deliveries[0]) : null,
      end: deliveries.at(-1) ? formatDeliveryReference(deliveries.at(-1)) : null,
      deliveryCount: deliveries.length
    },
    deliveries,
    limitations: options.limitations ?? []
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
    return createWindow(type, [], {
      limitations: ['No completed over is available in the current innings yet.']
    });
  }

  const selectedGroups = completed.slice(-requestedOvers);
  const selectedDeliveries = selectedGroups.flatMap((group) => group.deliveries);
  const limitations =
    selectedGroups.length < requestedOvers
      ? [`Only ${selectedGroups.length} completed over(s) are available in the current innings.`]
      : [];
  return createWindow(type, selectedDeliveries, {
    anchor: formatDeliveryReference(selectedGroups.at(-1).deliveries.at(-1)),
    overRange: completedOverRange(selectedGroups, requestedOvers),
    limitations
  });
}

function afterSessionMarker(delivery, session) {
  if (session?.joinedInningsNumber == null || session?.joinedDeliverySequence == null) {
    return true;
  }
  const inningsNumber = delivery.innings.inningsNumber;
  return (
    inningsNumber > session.joinedInningsNumber ||
    (inningsNumber === session.joinedInningsNumber &&
      delivery.deliverySequence > session.joinedDeliverySequence)
  );
}

/**
 * Resolves a deterministic delivery window according to the requested tool/window type.
 */
export function resolveRecapWindow({ matchStatus, deliveries = [], request, tool, session }) {
  const windowType = request?.window ?? tool?.tool;
  const minutes = request?.minutes ?? tool?.minutes;
  const overs = request?.overs ?? tool?.overs ?? 1;

  if (windowType === 'WHOLE_MATCH') {
    return createWindow(windowType, deliveries);
  }

  if (windowType === 'LAST_N_MINUTES') {
    if (deliveries.length === 0 || deliveries.some((delivery) => !delivery.occurredAt)) {
      return createWindow(windowType, [], {
        availability: 'UNAVAILABLE',
        timestampQuality: 'UNAVAILABLE',
        limitations: [
          `A last ${minutes}-minute recap is unavailable because this match has no trustworthy event timestamps.`
        ]
      });
    }
    const latest = new Date(deliveries.at(-1).occurredAt).getTime();
    const cutoff = latest - minutes * 60_000;
    const startIndex = deliveries.findIndex(
      (delivery) => new Date(delivery.occurredAt).getTime() >= cutoff
    );
    const selected = startIndex === -1 ? [] : deliveries.slice(startIndex);
    return createWindow(windowType, selected, {
      timestampQuality: 'TRUSTWORTHY_EVENT_TIME'
    });
  }

  if (windowType === 'SINCE_SESSION_JOIN') {
    const startIndex = deliveries.findIndex((delivery) => afterSessionMarker(delivery, session));
    const selected = startIndex === -1 ? [] : deliveries.slice(startIndex);
    return createWindow(windowType, selected, {
      anchor: session
        ? {
            inningsNumber: session.joinedInningsNumber,
            deliverySequence: session.joinedDeliverySequence,
            joinedAt: session.joinedAt
          }
        : null
    });
  }

  if (windowType === 'LAST_OVER' || windowType === 'LAST_N_OVERS') {
    return resolveLastCompletedOvers({
      type: windowType,
      matchStatus,
      deliveries,
      requestedOvers: windowType === 'LAST_OVER' ? 1 : overs
    });
  }

  throw new Error(`Unsupported recap window: ${windowType}`);
}

export const executeRecapTool = resolveRecapWindow;

