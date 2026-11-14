import { Router } from 'express';
import { createLiveSimulationController } from '../controllers/liveSimulationController.js';

export function createLiveSimulationRoutes(liveReplayManager) {
  const router = Router();
  const controller = createLiveSimulationController(liveReplayManager);

  router.post('/matches/:matchId/live-simulation', controller.start);
  return router;
}
