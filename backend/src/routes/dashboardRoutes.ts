import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboardController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticateToken);
router.get('/', getDashboardStats);

export default router;
