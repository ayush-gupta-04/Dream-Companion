import { prisma } from '../../db/prisma.js';
import {
  queryTimelineEvents,
  TimelineNotFoundError,
  TimelineValidationError
} from './timelineService.js';

export class EventSearchNotFoundError extends TimelineNotFoundError {
  constructor(message = 'Match not found.') {
    super(message);
    this.name = 'EventSearchNotFoundError';
  }
}

export class EventSearchValidationError extends TimelineValidationError {
  constructor(message) {
    super(message);
    this.name = 'EventSearchValidationError';
  }
}

function eventReference(event) {
  return {
    eventId: event.id,
    inningsId: event.innings.id,
    inningsNumber: event.innings.number,
    deliveryId: event.delivery.id,
    deliverySequence: event.delivery.sequence,
    display: event.delivery.display
  };
}

/**
 * Searches factual, reconciled timeline events using the shared query pipeline.
 */
export async function searchMatchEvents({
  matchId,
  inningsNumber,
  types,
  playerId,
  startSequence,
  endSequence,
  minimumImportance,
  limit = 50,
  cursor
}) {
  if ((startSequence || endSequence) && !inningsNumber) {
    throw new EventSearchValidationError('An innings is required for a delivery sequence range.');
  }
  if (startSequence && endSequence && startSequence > endSequence) {
    throw new EventSearchValidationError('The end delivery sequence must not precede the start.');
  }

  let player = null;
  if (playerId) {
    player = await prisma.player.findFirst({
      where: { id: playerId, matchAppearances: { some: { matchId } } },
      select: { id: true, displayName: true }
    });
    if (!player) throw new EventSearchNotFoundError('Player not found in this match.');
  }

  let result;
  try {
    result = await queryTimelineEvents({
      matchId,
      inningsNumber,
      types,
      playerId,
      startSequence,
      endSequence,
      minimumImportance,
      limit,
      cursor
    });
  } catch (error) {
    if (error instanceof TimelineNotFoundError) throw new EventSearchNotFoundError(error.message);
    if (error instanceof TimelineValidationError) throw new EventSearchValidationError(error.message);
    throw error;
  }

  const normalizedTypes = types?.length ? [...new Set(types)] : null;

  return {
    type: 'EVENT_SEARCH',
    matchId,
    filters: {
      inningsNumber: inningsNumber ?? null,
      types: normalizedTypes,
      player,
      startSequence: startSequence ?? null,
      endSequence: endSequence ?? null,
      minimumImportance: minimumImportance ?? null
    },
    events: result.events,
    nextCursor: result.nextCursor,
    references: result.events.map(eventReference)
  };
}
