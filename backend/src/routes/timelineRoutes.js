import { Router } from 'express';
import { listTimeline } from '../controllers/timelineController.js';

const router = Router();
router.get('/matches/:matchId/timeline', listTimeline);

export default router;
