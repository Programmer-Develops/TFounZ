import { Router } from 'express';
import {
  getPresets,
  getMeetingHistory,
  getMeetingByCode,
  createMeeting,
  getMeetingById,
  updateMeetingStatus,
  removeParticipant,
  getMeetingMessages,
} from '../controllers/meetingController.js';
import { getAttendanceReport } from '../controllers/attendanceController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/rbacMiddleware.js';

const router = Router();

// Static routes MUST come before /:id
router.get('/presets', getPresets);
router.get('/history', protect, getMeetingHistory);
router.get('/code/:code', protect, getMeetingByCode);

router.post('/', protect, authorizeRoles('host', 'admin'), createMeeting);
router.get('/:id', protect, getMeetingById);
router.patch('/:id/status', protect, updateMeetingStatus);
router.post('/:id/remove-participant', protect, removeParticipant);
router.get('/:id/messages', protect, getMeetingMessages);
router.get('/:id/attendance-report', protect, getAttendanceReport);

export default router;
