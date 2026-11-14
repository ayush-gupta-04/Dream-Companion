import { Router } from 'express';
import { createAnalyticsController } from '../controllers/analyticsController.js';

export function createAnalyticsRoutes(prisma) {
  const router = Router();
  const controller = createAnalyticsController(prisma);
  router.get('/matches/:matchId/analytics/overs/compare', controller.comparison);
  router.get('/matches/:matchId/analytics/overs/:overNumber', controller.over);
  router.get('/matches/:matchId/analytics/players/:playerId', controller.player);
  return router;
}
