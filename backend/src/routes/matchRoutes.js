import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { buildMatchState } from '../modules/match-intelligence/state/matchStateService.js';

function parseLimit(value) {
  const limit = Number.parseInt(value ?? '50', 10);
  return Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 50;
}

export function createMatchRoutes({ stateCache, prismaClient = prisma } = {}) {
  const router = Router();

  router.get('/matches/live', async (req, res, next) => {
    try {
      const matches = await prismaClient.match.findMany({
        where: { status: 'LIVE' },
        select: { id: true, name: true, status: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' }
      });
      res.json({ matches });
    } catch (error) {
      next(error);
    }
  });

  router.get('/matches/:matchId/state', async (req, res, next) => {
    try {
      const build = () => buildMatchState(prismaClient, req.params.matchId);
      const state = stateCache
        ? await stateCache.getOrBuild(req.params.matchId, build)
        : await build();

      if (!state) {
        res.status(404).json({ status: 'error', message: 'Match not found.' });
        return;
      }
      res.json({ state });
    } catch (error) {
      next(error);
    }
  });

  router.get('/matches/:matchId/deliveries', async (req, res, next) => {
    try {
      const deliveries = await prismaClient.delivery.findMany({
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
  });

  return router;
}
