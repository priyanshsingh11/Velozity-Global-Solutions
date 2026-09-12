import { Router } from 'express';
import { listUsers, listDevelopers } from '../controllers/userController';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticateToken);

router.get('/', requireRole(Role.ADMIN), listUsers);
router.get('/developers', requireRole(Role.ADMIN, Role.PM), listDevelopers);

export default router;
