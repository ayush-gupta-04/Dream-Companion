import { Router } from 'express';
import { join, leave } from '../controllers/recapController.js';

const router = Router();
router.post('/matches/:matchId/sessions/join', join);
router.post('/matches/:matchId/sessions/leave', leave);

export default router;
