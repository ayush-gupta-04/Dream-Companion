import { prisma } from '../../db/prisma.js';
import {
  applyDeliveryToTimelineState,
  createTimelineState,
  detectTimelineEvents,
  finishTimelineInnings
} from './timelineEventDetector.js';
import { toTimelineEvent } from './timelineEventPresenter.js';

const deliveryInclude = {
  batter: { select: { id: true, displayName: true } },
  nonStriker: { select: { id: true, displayName: true } },
  bowler: { select: { id: true, displayName: true } },
  wickets: {
    include: { playerOut: { select: { id: true, displayName: true } } }
  }
};

const eventFields = [
  'inningsId',
  'deliveryId',
  'deliverySequence',
  'eventOrder',
  'displayOver',
  'displayBallLabel',
  'type',
  'eventKey',
  'title',
  'description',
  'importanceScore',
  'importanceLevel',
  'occurredAt'
];

function sameTime(left, right) {
  if (left === null && right === null) return true;
  if (!left || !right) return false;
  return new Date(left).getTime() === new Date(right).getTime();
}

function eventData(matchId, event) {
  return Object.fromEntries([
    ['matchId', matchId],
    ...eventFields.map((field) => [field, event[field]])
  ]);
}

function eventChanged(existing, desired) {
  return eventFields.some((field) => {
    if (field === 'occurredAt') return !sameTime(existing[field], desired[field]);
    return existing[field] !== desired[field];
  });
}

function assertUniqueEventKeys(events) {
  const keys = new Set();
  for (const event of events) {
    if (keys.has(event.eventKey)) {
      throw new Error(`Timeline detector produced a duplicate event key: ${event.eventKey}`);
    }
    keys.add(event.eventKey);
  }
}

async function writeEvents(transaction, matchId, desired, existing) {
  const existingByKey = new Map(existing.map((event) => [event.eventKey, event]));
  const changes = { created: [], updated: [], deleted: [] };
  for (const event of desired) {
    const prior = existingByKey.get(event.eventKey);
    const data = eventData(matchId, event);
    if (!prior) {
      const created = await transaction.timelineEvent.create({ data });
      changes.created.push(toTimelineEvent(created, event.inningsNumber));
    } else if (eventChanged(prior, event)) {
      const updated = await transaction.timelineEvent.update({ where: { id: prior.id }, data });
      changes.updated.push(toTimelineEvent(updated, event.inningsNumber));
    }
  }
  return changes;
}

async function recordEvents({ matchId, innings, events }) {
  if (!events.length) return { created: [], updated: [], deleted: [] };
  assertUniqueEventKeys(events);
  const desired = events.map((event) => ({ ...event, inningsNumber: innings.inningsNumber }));
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.timelineEvent.findMany({
      where: { matchId, eventKey: { in: events.map((event) => event.eventKey) } }
    });
    return writeEvents(transaction, matchId, desired, existing);
  });
}

function deliveryWithPlayers(delivery, players) {
  const player = (id) => {
    const found = players.get(id);
    if (!found) throw new TimelineValidationError(`Player not found in timeline context: ${id}`);
    return found;
  };
  return {
    ...delivery,
    batter: player(delivery.batterId),
    nonStriker: player(delivery.nonStrikerId),
    bowler: player(delivery.bowlerId),
    wickets: (delivery.wickets ?? []).map((wicket) => ({
      ...wicket, playerOut: player(wicket.playerOutId)
    }))
  };
}

/** Restores one innings detector from persisted deliveries without writing events. */
export function createInningsState({ deliveries, players, isInningsComplete = false }) {
  const state = createTimelineState();
  for (const delivery of deliveries) {
    applyDeliveryToTimelineState(state, deliveryWithPlayers(delivery, players));
  }
  if (isInningsComplete) finishTimelineInnings(state);
  return state;
}

function desiredEvents(match) {
  const populatedInnings = match.innings.filter((innings) => innings.deliveries.length > 0);
  const latestInningsNumber = populatedInnings.at(-1)?.inningsNumber;
  const events = [];
  for (const innings of populatedInnings) {
    const isInningsComplete =
      match.status === 'COMPLETE' || innings.inningsNumber < latestInningsNumber;
    for (const event of detectTimelineEvents({
      deliveries: innings.deliveries,
      isInningsComplete
    })) {
      events.push({ ...event, inningsNumber: innings.inningsNumber });
    }
  }
  assertUniqueEventKeys(events);
  return events;
}

export class TimelineNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TimelineNotFoundError';
    this.statusCode = 404;
  }
}

export class TimelineValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TimelineValidationError';
    this.statusCode = 400;
  }
}

/**
 * Reconciles all timeline events for a match from durable delivery facts. A
 * full match pass is deliberately bounded to the single-match T20 MVP and
 * ensures source corrections repair derived milestones and over events.
 */
export async function synchronizeMatch({ matchId }) {
  return prisma.$transaction(async (transaction) => {
    const match = await transaction.match.findUnique({
      where: { id: matchId },
      include: {
        innings: {
          orderBy: { inningsNumber: 'asc' },
          include: {
            deliveries: { orderBy: { deliverySequence: 'asc' }, include: deliveryInclude }
          }
        }
      }
    });
    if (!match) throw new TimelineNotFoundError('Match not found.');

    const desired = desiredEvents(match);
    const existing = await transaction.timelineEvent.findMany({
      where: { matchId },
      include: { innings: { select: { inningsNumber: true } } }
    });
    const desiredKeys = new Set(desired.map((event) => event.eventKey));
    const obsolete = existing.filter((event) => !desiredKeys.has(event.eventKey));
    // Free obsolete delivery/order positions before inserting their replacements.
    for (const event of obsolete) {
      await transaction.timelineEvent.delete({ where: { id: event.id } });
    }

    const changes = await writeEvents(transaction, matchId, desired, existing);
    changes.deleted = obsolete.map((event) => toTimelineEvent(event));
    return changes;
  });
}

/**
 * Records a new delivery using its innings state and player lookup, with no history reads.
 * Apply deliveries once, in order; discard and rebuild state after a SQL failure or correction.
 */
export async function recordDelivery({ matchId, delivery, innings, players, state, action = 'created' }) {
  if (action === 'unchanged') return { created: [], updated: [], deleted: [] };
  if (action === 'corrected') return synchronizeMatch({ matchId });
  if (!state) throw new TimelineValidationError('Timeline recording requires an innings state.');
  if (delivery.inningsId !== innings.id) {
    throw new TimelineValidationError('Delivery does not belong to the supplied innings.');
  }
  const events = applyDeliveryToTimelineState(state, deliveryWithPlayers(delivery, players));
  return recordEvents({ matchId, innings, events });
}

/** Persists the remaining over's events when an innings ends. */
export async function finishInnings({ matchId, innings, state }) {
  return recordEvents({ matchId, innings, events: finishTimelineInnings(state) });
}

export async function list({ matchId, inningsNumber, types, limit, cursor }) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true }
  });
  if (!match) throw new TimelineNotFoundError('Match not found.');

  if (cursor) {
    const cursorEvent = await prisma.timelineEvent.findFirst({
      where: { id: cursor, matchId },
      select: { id: true }
    });
    if (!cursorEvent) throw new TimelineValidationError('Invalid timeline cursor.');
  }

  const records = await prisma.timelineEvent.findMany({
    where: {
      matchId,
      ...(inningsNumber ? { innings: { inningsNumber } } : {}),
      ...(types?.length ? { type: { in: types } } : {})
    },
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
  return { events, nextCursor: hasMore ? events.at(-1).id : null };
}
