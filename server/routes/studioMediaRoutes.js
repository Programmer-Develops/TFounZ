import { Router } from 'express';
import {
  getStudioHealth,
  getSounzVoices,
  getProductionJobs,
  processWithSounzAi,
  downloadSounzAudio,
  processWithFilmyAi,
  downloadFilmyVideo,
} from '../controllers/studioMediaController.js';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = Router();

router.use(protect);

router.get('/health', getStudioHealth);
router.get('/voices', getSounzVoices);
router.get('/jobs', getProductionJobs);

router.post('/sounz/process', upload.single('file'), processWithSounzAi);
router.get('/sounz/download/:filename', downloadSounzAudio);

router.post('/filmy/process', upload.single('file'), processWithFilmyAi);
router.get('/filmy/download/:filename', downloadFilmyVideo);

export default router;
