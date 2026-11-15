import { Router } from 'express';
import { queryMatch } from '../controllers/matchQueryController.js';

const router = Router();
router.post('/matches/:matchId/query', queryMatch);

export default router;
