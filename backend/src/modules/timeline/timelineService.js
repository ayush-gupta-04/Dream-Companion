import { prisma } from '../../db/prisma.js';
import {
  detectBatterMilestoneEvents,
  detectBoundaryAndWicketEvents,
  detectPartnershipMilestoneEvents,
  detectTimelineEvents,
  eventForCompletedOver
} from './timelineEventDetector.js';
import { toTimelineEvent } from './timelineEventPresenter.js';
import { PARTNERSHIP_MILESTONES } from './timelineRules.js';

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
}

/**
 * Fast-path: Evaluates and persists timeline events for a single delivery
 * in O(1) time without re-reading all deliveries for the entire match.
 * Falls back to full synchronizeMatch() if this delivery is a correction.
 */
export async function recordDelivery({ matchId, deliveryId, action = 'created' }) {
  if (action === 'corrected') {
    return synchronizeMatch({ matchId });
  }

  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: deliveryInclude
  });

  if (!delivery) {
    return { created: [], updated: [], deleted: [] };
  }

  const events = detectBoundaryAndWicketEvents(delivery);

  if (delivery.batterRuns > 0) {
    const batterAgg = await prisma.delivery.aggregate({
      _sum: { batterRuns: true },
      where: {
        inningsId: delivery.inningsId,
        batterId: delivery.batterId,
        deliverySequence: { lte: delivery.deliverySequence }
      }
    });
    const currentRuns = batterAgg._sum.batterRuns ?? 0;
    const priorRuns = currentRuns - delivery.batterRuns;
    events.push(
      ...detectBatterMilestoneEvents({
        delivery,
        previousRuns: priorRuns,
        updatedRuns: currentRuns
      })
    );
  }

  if (delivery.totalRuns > 0) {
    const lastWicketDelivery = await prisma.delivery.findFirst({
      where: {
        inningsId: delivery.inningsId,
        deliverySequence: { lt: delivery.deliverySequence },
        wickets: { some: { countsAsWicket: true } }
      },
      orderBy: { deliverySequence: 'desc' },
      select: { deliverySequence: true }
    });
    const sinceSeq = lastWicketDelivery?.deliverySequence ?? 0;
    const partnerAgg = await prisma.delivery.aggregate({
      _sum: { totalRuns: true },
      where: {
        inningsId: delivery.inningsId,
        deliverySequence: { gt: sinceSeq, lte: delivery.deliverySequence }
      }
    });
    const currentPartnershipRuns = partnerAgg._sum.totalRuns ?? 0;
    const priorPartnershipRuns = currentPartnershipRuns - delivery.totalRuns;

    for (const milestone of PARTNERSHIP_MILESTONES) {
      if (priorPartnershipRuns < milestone && currentPartnershipRuns >= milestone) {
        const startDelivery = await prisma.delivery.findFirst({
          where: {
            inningsId: delivery.inningsId,
            deliverySequence: { gt: sinceSeq }
          },
          orderBy: { deliverySequence: 'asc' },
          select: { id: true }
        });
        const players = [delivery.batter, delivery.nonStriker].sort((left, right) =>
          left.displayName.localeCompare(right.displayName)
        );
      events.push(
        ...detectPartnershipMilestoneEvents({
          delivery,
          previousRuns: priorPartnershipRuns,
          updatedRuns: currentPartnershipRuns,
          partnershipStartDeliveryId: startDelivery?.id ?? delivery.id,
          partnershipPlayers: players,
          milestones: [milestone]
        })
      );
      }
    }
  }

  // 4. Over completion check
  if (delivery.isLegalDelivery) {
    const legalCount = await prisma.delivery.count({
      where: {
        inningsId: delivery.inningsId,
        displayOver: delivery.displayOver,
        isLegalDelivery: true,
        deliverySequence: { lte: delivery.deliverySequence }
      }
    });

    if (legalCount >= 6) {
      const overDeliveries = await prisma.delivery.findMany({
        where: {
          inningsId: delivery.inningsId,
          displayOver: delivery.displayOver,
          deliverySequence: { lte: delivery.deliverySequence }
        },
        include: deliveryInclude,
        orderBy: { deliverySequence: 'asc' }
      });

      const previousOverNumbers = [delivery.displayOver - 2, delivery.displayOver - 1].filter(
        (n) => n >= 0
      );
      const previousGroups = [];
      for (const overNum of previousOverNumbers) {
        const prevOver = await prisma.delivery.aggregate({
          _sum: { totalRuns: true },
          where: {
            inningsId: delivery.inningsId,
            displayOver: overNum
          }
        });
        previousGroups.push({ runs: prevOver._sum.totalRuns ?? 0 });
      }

      const overResult = eventForCompletedOver(
        { overNumber: delivery.displayOver, deliveries: overDeliveries },
        previousGroups
      );
      events.push(...overResult.events);
    }
  }

  if (events.length === 0) {
    return { created: [], updated: [], deleted: [] };
  }

  const innings = await prisma.innings.findUnique({
    where: { id: delivery.inningsId },
    select: { inningsNumber: true }
  });

  const created = [];
  for (const event of events) {
    const data = {
      matchId,
      inningsId: delivery.inningsId,
      deliveryId: delivery.id,
      deliverySequence: delivery.deliverySequence,
      displayOver: delivery.displayOver,
      displayBallLabel: delivery.displayBallLabel,
      occurredAt: delivery.occurredAt,
      ...event
    };

    const record = await prisma.timelineEvent.upsert({
      where: { matchId_eventKey: { matchId, eventKey: data.eventKey } },
      create: data,
      update: data
    });
    created.push(toTimelineEvent(record, innings?.inningsNumber));
  }

  return { created, updated: [], deleted: [] };
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
