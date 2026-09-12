import { Router } from 'express';
import {
  listNotifications,
  markAsRead,
  markAllAsRead,
} from '../controllers/notificationController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticateToken);

router.get('/', listNotifications);
router.patch('/:id/read', markAsRead);
router.post('/read-all', markAllAsRead);

export default router;
