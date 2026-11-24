import { Router } from 'express';
import {
  respondAsAiHost,
  startRapidFireRound,
  speakAsAi,
  summarizeEpisode,
} from '../controllers/aiShowController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/:meetingId/respond', protect, respondAsAiHost);
router.post('/:meetingId/rapid-fire', protect, startRapidFireRound);
router.post('/:meetingId/speak', protect, speakAsAi);
router.post('/:meetingId/summary', protect, summarizeEpisode);

export default router;
