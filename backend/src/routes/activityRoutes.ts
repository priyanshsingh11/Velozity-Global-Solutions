import { Router } from 'express';
import {
  getActivityFeed,
  getMissedActivities,
  activityFeedQuerySchema,
} from '../controllers/activityController';
import { authenticateToken } from '../middleware/authMiddleware';
import { validate } from '../middleware/validate';

const router = Router();

router.use(authenticateToken);

router.get('/feed', validate({ query: activityFeedQuerySchema }), getActivityFeed);
router.get('/missed', getMissedActivities);

export default router;
