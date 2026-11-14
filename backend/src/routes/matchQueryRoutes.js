import { Router } from 'express';
import { createMatchQueryController } from '../controllers/matchQueryController.js';

export function createMatchQueryRoutes(matchQueryService) {
  const router = Router();
  router.post('/matches/:matchId/query', createMatchQueryController(matchQueryService));
  return router;
}
