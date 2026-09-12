import { Router } from 'express';
import {
  listProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  createProjectSchema,
  updateProjectSchema,
} from '../controllers/projectController';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { validate } from '../middleware/validate';
import { Role } from '@prisma/client';

const router = Router();

// All project routes require authentication
router.use(authenticateToken);

router.get('/', listProjects);
router.get('/:id', getProjectById);
router.post('/', requireRole(Role.ADMIN, Role.PM), validate({ body: createProjectSchema }), createProject);
router.put('/:id', requireRole(Role.ADMIN, Role.PM), validate({ body: updateProjectSchema }), updateProject);
router.delete('/:id', requireRole(Role.ADMIN, Role.PM), deleteProject);

export default router;
