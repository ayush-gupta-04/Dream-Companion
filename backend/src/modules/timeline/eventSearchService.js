import { prisma } from '../../db/prisma.js';
import { toTimelineEvent } from './timelineEventPresenter.js';

const importanceLevels = {
  MINOR: ['MINOR', 'HIGHLIGHT', 'MAJOR'],
  HIGHLIGHT: ['HIGHLIGHT', 'MAJOR'],
  MAJOR: ['MAJOR']
};

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

function filtersWhere({
  matchId,
  inningsNumber,
  types,
  playerId,
  startSequence,
  endSequence,
  minimumImportance
}) {
  const deliverySequence = {};
  if (startSequence) deliverySequence.gte = startSequence;
  if (endSequence) deliverySequence.lte = endSequence;

  return {
    matchId,
    ...(inningsNumber ? { innings: { inningsNumber } } : {}),
    ...(types?.length ? { type: { in: types } } : {}),
    ...(playerId
      ? {
          delivery: {
            OR: [
              { batterId: playerId },
              { bowlerId: playerId },
              { wickets: { some: { playerOutId: playerId } } }
            ]
          }
        }
      : {}),
    ...(Object.keys(deliverySequence).length ? { deliverySequence } : {}),
    ...(minimumImportance ? { importanceLevel: { in: importanceLevels[minimumImportance] } } : {})
  };
}

export class EventSearchNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EventSearchNotFoundError';
    this.statusCode = 404;
  }
}

export class EventSearchValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EventSearchValidationError';
    this.statusCode = 400;
  }
}

function validateSequenceFilters({ inningsNumber, startSequence, endSequence }) {
  if ((startSequence || endSequence) && !inningsNumber) {
    throw new EventSearchValidationError('An innings is required for a delivery sequence range.');
  }
  if (startSequence && endSequence && startSequence > endSequence) {
    throw new EventSearchValidationError('The end delivery sequence must not precede the start.');
  }
}

/**
 * Searches factual, reconciled timeline events. It never searches generated
 * prose, so every returned result has a durable event and delivery reference.
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
  validateSequenceFilters({ inningsNumber, startSequence, endSequence });

  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { id: true } });
  if (!match) throw new EventSearchNotFoundError('Match not found.');

  let player = null;
  if (playerId) {
    player = await prisma.player.findFirst({
      where: { id: playerId, matchAppearances: { some: { matchId } } },
      select: { id: true, displayName: true }
    });
    if (!player) throw new EventSearchNotFoundError('Player not found in this match.');
  }

  const normalizedTypes = types?.length ? [...new Set(types)] : undefined;
  const where = filtersWhere({
    matchId,
    inningsNumber,
    types: normalizedTypes,
    playerId,
    startSequence,
    endSequence,
    minimumImportance
  });

  if (cursor) {
    const cursorEvent = await prisma.timelineEvent.findFirst({
      where: { ...where, id: cursor },
      select: { id: true }
    });
    if (!cursorEvent) throw new EventSearchValidationError('Invalid event search cursor.');
  }

  const records = await prisma.timelineEvent.findMany({
    where,
    include: { innings: { select: { inningsNumber: true } } },
    orderBy: [
      { innings: { inningsNumber: 'asc' } },
      { deliverySequence: 'asc' },
      { eventOrder: 'asc' },
      { id: 'asc' }
    ],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: limit + 1
  });
  const hasMore = records.length > limit;
  const events = records.slice(0, limit).map((event) => toTimelineEvent(event));

  return {
    type: 'EVENT_SEARCH',
    matchId,
    filters: {
      inningsNumber: inningsNumber ?? null,
      types: normalizedTypes ?? null,
      player,
      startSequence: startSequence ?? null,
      endSequence: endSequence ?? null,
      minimumImportance: minimumImportance ?? null
    },
    events,
    nextCursor: hasMore ? events.at(-1).id : null,
    references: events.map(eventReference)
  };
}
