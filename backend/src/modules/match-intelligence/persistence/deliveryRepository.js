import { validateNormalizedDelivery } from '../domain/validateNormalizedDelivery.js';

/**
 * Stores a validated delivery. Duplicate/revision reconciliation intentionally
 * remains a Phase 3 ingestion concern; the database rejects duplicate sequences.
 */
export async function createDelivery(prisma, { inningsId, delivery }) {
  const normalized = validateNormalizedDelivery(delivery);

  return prisma.delivery.create({
    data: {
      inningsId,
      deliverySequence: normalized.deliverySequence,
      sourceDeliveryId: normalized.source?.deliveryId,
      sourceRevision: normalized.source?.revision,
      displayOver: normalized.display.overNumber,
      displayBallLabel: normalized.display.ballLabel,
      batterId: normalized.players.batterId,
      nonStrikerId: normalized.players.nonStrikerId,
      bowlerId: normalized.players.bowlerId,
      batterRuns: normalized.runs.batter,
      totalExtras: Object.values(normalized.extras).reduce((total, value) => total + value, 0),
      totalRuns: normalized.runs.total,
      wides: normalized.extras.wides,
      noBalls: normalized.extras.noBalls,
      byes: normalized.extras.byes,
      legByes: normalized.extras.legByes,
      penaltyRuns: normalized.extras.penaltyRuns,
      isLegalDelivery: normalized.isLegalDelivery,
      occurredAt: normalized.occurredAt,
      rawPayload: normalized.rawPayload,
      wickets: {
        create: normalized.wickets.map((wicket, index) => ({
          wicketSequence: index + 1,
          playerOutId: wicket.playerOutId,
          kind: wicket.kind,
          countsAsWicket: wicket.countsAsWicket,
          fielders: wicket.fielders
        }))
      }
    },
    include: { wickets: true }
  });
}

export async function updateDelivery(prisma, deliveryId, delivery) {
  const normalized = validateNormalizedDelivery(delivery);

  return prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      sourceRevision: normalized.source?.revision,
      displayOver: normalized.display.overNumber,
      displayBallLabel: normalized.display.ballLabel,
      batterId: normalized.players.batterId,
      nonStrikerId: normalized.players.nonStrikerId,
      bowlerId: normalized.players.bowlerId,
      batterRuns: normalized.runs.batter,
      totalExtras: Object.values(normalized.extras).reduce((total, value) => total + value, 0),
      totalRuns: normalized.runs.total,
      wides: normalized.extras.wides,
      noBalls: normalized.extras.noBalls,
      byes: normalized.extras.byes,
      legByes: normalized.extras.legByes,
      penaltyRuns: normalized.extras.penaltyRuns,
      isLegalDelivery: normalized.isLegalDelivery,
      occurredAt: normalized.occurredAt,
      rawPayload: normalized.rawPayload,
      wickets: {
        deleteMany: {},
        create: normalized.wickets.map((wicket, index) => ({
          wicketSequence: index + 1,
          playerOutId: wicket.playerOutId,
          kind: wicket.kind,
          countsAsWicket: wicket.countsAsWicket,
          fielders: wicket.fielders
        }))
      }
    },
    include: { wickets: true }
  });
}

export async function listInningsDeliveries(prisma, inningsId) {
  return prisma.delivery.findMany({
    where: { inningsId },
    include: { wickets: true },
    orderBy: { deliverySequence: 'asc' }
  });
}

export function deliveryRecordToNormalizedDelivery(delivery) {
  return {
    deliverySequence: delivery.deliverySequence,
    display: {
      overNumber: delivery.displayOver,
      ballLabel: delivery.displayBallLabel
    },
    players: {
      batterId: delivery.batterId,
      nonStrikerId: delivery.nonStrikerId,
      bowlerId: delivery.bowlerId
    },
    runs: {
      batter: delivery.batterRuns,
      total: delivery.totalRuns
    },
    extras: {
      wides: delivery.wides,
      noBalls: delivery.noBalls,
      byes: delivery.byes,
      legByes: delivery.legByes,
      penaltyRuns: delivery.penaltyRuns
    },
    isLegalDelivery: delivery.isLegalDelivery ?? (delivery.wides === 0 && delivery.noBalls === 0),
    wickets: (delivery.wickets ?? []).map((wicket) => ({
      playerOutId: wicket.playerOutId ?? wicket.playerOut?.id,
      kind: wicket.kind,
      countsAsWicket: wicket.countsAsWicket,
      fielders: Array.isArray(wicket.fielders) ? wicket.fielders : []
    })),
    source:
      delivery.sourceDeliveryId === null
        ? undefined
        : {
            provider: 'stored-source',
            deliveryId: delivery.sourceDeliveryId,
            revision: delivery.sourceRevision ?? undefined
          },
    occurredAt: delivery.occurredAt,
    rawPayload: delivery.rawPayload
  };
}
