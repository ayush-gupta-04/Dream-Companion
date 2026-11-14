/** Converts a persisted timeline record into the public timeline contract. */
export function toTimelineEvent(event, inningsNumber = event.innings?.inningsNumber ?? null) {
  return {
    id: event.id,
    matchId: event.matchId,
    innings: { id: event.inningsId, number: inningsNumber },
    delivery: {
      id: event.deliveryId,
      sequence: event.deliverySequence,
      display: { overNumber: event.displayOver, ballLabel: event.displayBallLabel }
    },
    type: event.type,
    title: event.title,
    description: event.description,
    importance: { score: event.importanceScore, level: event.importanceLevel },
    occurredAt: event.occurredAt
  };
}
