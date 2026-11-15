import { prisma } from '../db/prisma.js';
import * as stateCache from '../modules/match-intelligence/state/matchStateCache.js';
import { buildMatchState } from '../modules/match-intelligence/state/matchStateService.js';
import { listMatchCards } from '../modules/matches/matchDirectoryService.js';
import { isLiveMatchId } from '../replay/liveReplayManager.js';

function parseLimit(value) {
  const limit = Number.parseInt(value ?? '50', 10);
  return Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 50;
}

export async function list(req, res, next) {
  try {
    res.json(await listMatchCards());
  } catch (error) {
    next(error);
  }
}

export async function listLive(req, res, next) {
  try {
    const matches = await prisma.match.findMany({
      where: { status: 'LIVE' },
      select: { id: true, name: true, status: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' }
    });
    res.json({ matches });
  } catch (error) {
    next(error);
  }
}

export async function state(req, res, next) {
  try {
    const matchState = await stateCache.getOrBuild(req.params.matchId, () =>
      buildMatchState(req.params.matchId)
    );
    if (!matchState) {
      res.status(404).json({ status: 'error', message: 'Match not found.' });
      return;
    }
    res.json({ state: { ...matchState, isLiveSimulation: isLiveMatchId(req.params.matchId) } });
  } catch (error) {
    next(error);
  }
}

export async function listDeliveries(req, res, next) {
  try {
    const deliveries = await prisma.delivery.findMany({
      where: {
        innings: { matchId: req.params.matchId },
        ...(req.query.innings ? { inningsId: String(req.query.innings) } : {})
      },
      select: {
        id: true,
        inningsId: true,
        deliverySequence: true,
        displayOver: true,
        displayBallLabel: true,
        batterRuns: true,
        totalRuns: true,
        totalExtras: true,
        isLegalDelivery: true,
        occurredAt: true
      },
      orderBy: [{ inningsId: 'asc' }, { deliverySequence: 'asc' }],
      take: parseLimit(req.query.limit)
    });
    res.json({ deliveries });
  } catch (error) {
    next(error);
  }
}
