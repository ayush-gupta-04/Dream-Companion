import { Router } from 'express';
import * as matchController from '../controllers/matchController.js';

const router = Router();

router.get('/matches', matchController.list);
router.get('/matches/live', matchController.listLive);
router.get('/matches/:matchId/state', matchController.state);
router.get('/matches/:matchId/deliveries', matchController.listDeliveries);

export default router;
