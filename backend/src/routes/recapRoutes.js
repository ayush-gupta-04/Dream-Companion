import { Router } from 'express';
import { createRecapController } from '../controllers/recapController.js';

export function createRecapRoutes(recapService) {
  const router = Router();
  const controller = createRecapController(recapService);
  router.post('/matches/:matchId/sessions/join', controller.join);
  router.post('/matches/:matchId/sessions/leave', controller.leave);
  return router;
}
