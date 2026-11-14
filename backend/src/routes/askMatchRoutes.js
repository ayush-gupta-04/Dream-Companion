import { Router } from 'express';
import { createAskMatchController } from '../controllers/askMatchController.js';

export function createAskMatchRoutes(askMatchService) {
  const router = Router();
  router.post('/matches/:matchId/ask', createAskMatchController(askMatchService));
  return router;
}
