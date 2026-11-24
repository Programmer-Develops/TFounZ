import { Router } from 'express';
import {
  getPlatformStats,
  getAllUsers,
  updateUserRole,
  getAllMeetings,
  deleteMeeting,
} from '../controllers/adminController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/rbacMiddleware.js';

const router = Router();

router.use(protect, authorizeRoles('admin'));

router.get('/stats', getPlatformStats);
router.get('/users', getAllUsers);
router.patch('/users/:id/role', updateUserRole);
router.get('/meetings', getAllMeetings);
router.delete('/meetings/:id', deleteMeeting);

export default router;
