import { Router } from 'express';
import { comparison, over, player } from '../controllers/analyticsController.js';

const router = Router();
router.get('/matches/:matchId/analytics/overs/compare', comparison);
router.get('/matches/:matchId/analytics/overs/:overNumber', over);
router.get('/matches/:matchId/analytics/players/:playerId', player);

export default router;
