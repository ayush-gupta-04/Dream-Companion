import { Router } from 'express';
import { createTimelineController } from '../controllers/timelineController.js';

export function createTimelineRoutes(timelineService) {
  const router = Router();
  const controller = createTimelineController(timelineService);
  router.get('/matches/:matchId/timeline', controller.list);
  return router;
}
