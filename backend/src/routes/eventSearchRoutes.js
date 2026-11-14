import { Router } from 'express';
import { createEventSearchController } from '../controllers/eventSearchController.js';

export function createEventSearchRoutes(eventSearchService) {
  const router = Router();
  const controller = createEventSearchController(eventSearchService);
  router.get('/matches/:matchId/events/search', controller.search);
  return router;
}
