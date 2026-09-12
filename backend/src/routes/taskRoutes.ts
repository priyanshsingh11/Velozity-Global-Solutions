import { Router } from 'express';
import {
  listTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  taskFilterQuerySchema,
} from '../controllers/taskController';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { validate } from '../middleware/validate';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticateToken);

router.get('/', validate({ query: taskFilterQuerySchema }), listTasks);
router.get('/:id', getTaskById);
router.post('/', requireRole(Role.ADMIN, Role.PM), validate({ body: createTaskSchema }), createTask);
router.put('/:id', requireRole(Role.ADMIN, Role.PM), validate({ body: updateTaskSchema }), updateTask);
router.patch('/:id/status', validate({ body: updateTaskStatusSchema }), updateTaskStatus);
router.delete('/:id', requireRole(Role.ADMIN, Role.PM), deleteTask);

export default router;
