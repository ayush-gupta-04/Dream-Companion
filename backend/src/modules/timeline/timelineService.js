import { detectTimelineEvents } from './timelineEventDetector.js';
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
export function createTimelineService({ prisma }) {
  return {
    async synchronizeMatch({ matchId }) {
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
        const existingByKey = new Map(existing.map((event) => [event.eventKey, event]));
        const desiredKeys = new Set(desired.map((event) => event.eventKey));
        const changes = { created: [], updated: [], deleted: [] };

        for (const event of desired) {
          const prior = existingByKey.get(event.eventKey);
          const data = eventData(matchId, event);
          if (!prior) {
            const created = await transaction.timelineEvent.create({ data });
            changes.created.push(toTimelineEvent(created, event.inningsNumber));
          } else if (eventChanged(prior, event)) {
            const updated = await transaction.timelineEvent.update({
              where: { id: prior.id },
              data
            });
            changes.updated.push(toTimelineEvent(updated, event.inningsNumber));
          }
        }

        for (const event of existing) {
          if (!desiredKeys.has(event.eventKey)) {
            await transaction.timelineEvent.delete({ where: { id: event.id } });
            changes.deleted.push(toTimelineEvent(event));
          }
        }

        return changes;
      });
    },

    async list({ matchId, inningsNumber, types, limit, cursor }) {
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
  };
}
