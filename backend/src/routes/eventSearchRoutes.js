import { Router } from 'express';
import { search } from '../controllers/eventSearchController.js';

const router = Router();
router.get('/matches/:matchId/events/search', search);

export default router;
