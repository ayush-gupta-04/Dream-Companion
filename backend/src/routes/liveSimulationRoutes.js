import { Router } from 'express';
import { start } from '../controllers/liveSimulationController.js';

const router = Router();

router.post('/matches/:matchId/live-simulation', start);

export default router;
