import { prisma } from '../../db/prisma.js';
import { formatOvers, isBowlerWicket } from '../match-intelligence/domain/scoring.js';

function createExtras() {
  return { wides: 0, noBalls: 0, byes: 0, legByes: 0, penaltyRuns: 0 };
}

function addExtras(totals, delivery) {
  totals.wides += delivery.wides;
  totals.noBalls += delivery.noBalls;
  totals.byes += delivery.byes;
  totals.legByes += delivery.legByes;
  totals.penaltyRuns += delivery.penaltyRuns;
}

function deliveryReference(delivery) {
  return {
    deliveryId: delivery.id,
    inningsId: delivery.inningsId,
    deliverySequence: delivery.deliverySequence,
    display: { overNumber: delivery.displayOver, ballLabel: delivery.displayBallLabel }
  };
}

function calculateRunRate(runs, legalDeliveries, ballsPerOver) {
  if (legalDeliveries === 0) return 0;
  return Number(((runs * ballsPerOver) / legalDeliveries).toFixed(2));
}

function overFacts(deliveries, ballsPerOver) {
  const extras = createExtras();
  const batterContributions = {};
  const bowlerContributions = {};
  let runs = 0;
  let wickets = 0;
  let fours = 0;
  let sixes = 0;
  let dots = 0;
  let legalDeliveries = 0;

  for (const delivery of deliveries) {
    runs += delivery.totalRuns;
    addExtras(extras, delivery);
    if (delivery.totalRuns === 0) dots += 1;
    if (delivery.batterRuns === 4) fours += 1;
    if (delivery.batterRuns === 6) sixes += 1;
    if (delivery.isLegalDelivery) legalDeliveries += 1;
    wickets += delivery.wickets.filter((wicket) => wicket.countsAsWicket).length;

    const batter = batterContributions[delivery.batter.id] ?? {
      playerId: delivery.batter.id,
      name: delivery.batter.displayName,
      runs: 0
    };
    batter.runs += delivery.batterRuns;
    batterContributions[delivery.batter.id] = batter;

    const bowler = bowlerContributions[delivery.bowler.id] ?? {
      playerId: delivery.bowler.id,
      name: delivery.bowler.displayName,
      runsConceded: 0,
      wickets: 0
    };
    bowler.runsConceded +=
      delivery.totalRuns - delivery.byes - delivery.legByes - delivery.penaltyRuns;
    bowler.wickets += delivery.wickets.filter(isBowlerWicket).length;
    bowlerContributions[delivery.bowler.id] = bowler;
  }

  return {
    runs,
    wickets,
    fours,
    sixes,
    dots,
    legalDeliveries,
    overs: formatOvers(legalDeliveries, ballsPerOver),
    runRate: calculateRunRate(runs, legalDeliveries, ballsPerOver),
    extras,
    batters: Object.values(batterContributions),
    bowlers: Object.values(bowlerContributions),
    references: deliveries.map(deliveryReference)
  };
}

const deliveryInclude = {
  batter: { select: { id: true, displayName: true } },
  bowler: { select: { id: true, displayName: true } },
  wickets: { include: { playerOut: { select: { id: true, displayName: true } } } }
};

export class AnalyticsNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AnalyticsNotFoundError';
    this.statusCode = 404;
  }
}

export class AnalyticsValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AnalyticsValidationError';
    this.statusCode = 400;
  }
}

export async function analyzeOver({ matchId, inningsNumber, overNumber }) {
  if (
    inningsNumber !== null &&
    inningsNumber !== undefined &&
    overNumber !== null &&
    overNumber !== undefined
  ) {
    const innings = await prisma.innings.findFirst({
      where: { matchId, inningsNumber },
      include: { match: { select: { ballsPerOver: true } } }
    });
    if (!innings) throw new AnalyticsNotFoundError('Innings not found.');

    const deliveries = await prisma.delivery.findMany({
      where: { inningsId: innings.id, displayOver: overNumber },
      include: deliveryInclude,
      orderBy: { deliverySequence: 'asc' }
    });
    if (deliveries.length === 0) throw new AnalyticsNotFoundError('Over not found.');

    return {
      type: 'OVER_ANALYSIS',
      matchId,
      inningsId: innings.id,
      inningsNumber,
      overNumber,
      ...overFacts(deliveries, innings.match.ballsPerOver)
    };
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { status: true, ballsPerOver: true }
  });
  if (!match) throw new AnalyticsNotFoundError('Match not found.');

  const deliveries = await prisma.delivery.findMany({
    where: { innings: { matchId } },
    include: {
      ...deliveryInclude,
      innings: { select: { id: true, inningsNumber: true } }
    },
    orderBy: [{ innings: { inningsNumber: 'asc' } }, { deliverySequence: 'asc' }]
  });
  if (deliveries.length === 0) {
    throw new AnalyticsNotFoundError('No deliveries found for this match.');
  }

  const currentInningsNumber = inningsNumber ?? deliveries.at(-1)?.innings.inningsNumber;
  const currentInningsDeliveries = deliveries.filter(
    (d) => d.innings.inningsNumber === currentInningsNumber
  );

  const groups = [];
  for (const d of currentInningsDeliveries) {
    const lastGroup = groups.at(-1);
    if (!lastGroup || lastGroup.overNumber !== d.displayOver) {
      groups.push({
        inningsId: d.innings.id,
        inningsNumber: d.innings.inningsNumber,
        overNumber: d.displayOver,
        deliveries: [d]
      });
    } else {
      lastGroup.deliveries.push(d);
    }
  }

  const completedGroups = match.status === 'COMPLETE' ? groups : groups.slice(0, -1);
  if (completedGroups.length === 0) {
    throw new AnalyticsNotFoundError('No completed over is available in the current innings yet.');
  }

  const lastCompletedGroup = completedGroups.at(-1);
  return {
    type: 'OVER_ANALYSIS',
    matchId,
    inningsId: lastCompletedGroup.inningsId,
    inningsNumber: lastCompletedGroup.inningsNumber,
    overNumber: lastCompletedGroup.overNumber,
    ...overFacts(lastCompletedGroup.deliveries, match.ballsPerOver)
  };
}

export async function analyzePlayer({ matchId, playerId }) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { ballsPerOver: true }
  });
  if (!match) throw new AnalyticsNotFoundError('Match not found.');

  const player = await prisma.player.findFirst({
    where: { id: playerId, matchAppearances: { some: { matchId } } },
    select: { id: true, displayName: true }
  });
  if (!player) throw new AnalyticsNotFoundError('Player not found in this match.');

  const deliveries = await prisma.delivery.findMany({
    where: { innings: { matchId }, OR: [{ batterId: playerId }, { bowlerId: playerId }] },
    include: { wickets: true },
    orderBy: { deliverySequence: 'asc' }
  });
  const batting = { runs: 0, ballsFaced: 0, fours: 0, sixes: 0 };
  const bowling = { legalDeliveries: 0, runsConceded: 0, wickets: 0 };
  const references = [];

  for (const delivery of deliveries) {
    if (delivery.batterId === playerId) {
      batting.runs += delivery.batterRuns;
      if (delivery.wides === 0) batting.ballsFaced += 1;
      if (delivery.batterRuns === 4) batting.fours += 1;
      if (delivery.batterRuns === 6) batting.sixes += 1;
    }
    if (delivery.bowlerId === playerId) {
      if (delivery.isLegalDelivery) bowling.legalDeliveries += 1;
      bowling.runsConceded +=
        delivery.totalRuns - delivery.byes - delivery.legByes - delivery.penaltyRuns;
      bowling.wickets += delivery.wickets.filter(isBowlerWicket).length;
    }
    references.push(deliveryReference(delivery));
  }

  return {
    type: 'PLAYER_ANALYSIS',
    matchId,
    player,
    batting: {
      ...batting,
      strikeRate:
        batting.ballsFaced === 0
          ? 0
          : Number(((batting.runs / batting.ballsFaced) * 100).toFixed(2))
    },
    bowling: {
      ...bowling,
      overs: formatOvers(bowling.legalDeliveries, match.ballsPerOver),
      economy:
        bowling.legalDeliveries === 0
          ? 0
          : Number(((bowling.runsConceded * 6) / bowling.legalDeliveries).toFixed(2))
    },
    references
  };
}

function numericDeltas(firstOver, secondOver) {
  const difference = (field) => secondOver[field] - firstOver[field];
  const extras = Object.fromEntries(
    Object.keys(firstOver.extras).map((field) => [
      field,
      secondOver.extras[field] - firstOver.extras[field]
    ])
  );

  return {
    runs: difference('runs'),
    wickets: difference('wickets'),
    fours: difference('fours'),
    sixes: difference('sixes'),
    dots: difference('dots'),
    legalDeliveries: difference('legalDeliveries'),
    runRate: Number((secondOver.runRate - firstOver.runRate).toFixed(2)),
    extras
  };
}

/**
 * Compares two overs in the same innings from persisted delivery facts.
 * Deltas are always calculated as secondOver minus firstOver.
 */
export async function compareOvers({ matchId, inningsNumber, over1, over2 }) {
  if (over1 === over2) {
    throw new AnalyticsValidationError('Choose two different overs to compare.');
  }

  const [firstOver, secondOver] = await Promise.all([
    analyzeOver({ matchId, inningsNumber, overNumber: over1 }),
    analyzeOver({ matchId, inningsNumber, overNumber: over2 })
  ]);

  return {
    type: 'OVER_COMPARISON',
    matchId,
    inningsNumber,
    firstOver,
    secondOver,
    deltas: numericDeltas(firstOver, secondOver),
    references: [...firstOver.references, ...secondOver.references]
  };
}
