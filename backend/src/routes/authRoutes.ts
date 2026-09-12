import { Router } from 'express';
import { login, refresh, logout, getMe, loginSchema } from '../controllers/authController';
import { validate } from '../middleware/validate';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/login', validate({ body: loginSchema }), login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authenticateToken, getMe);

export default router;
