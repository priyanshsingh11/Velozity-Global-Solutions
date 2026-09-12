import { Router } from 'express';
import {
  listClients,
  createClient,
  updateClient,
  deleteClient,
  createClientSchema,
  updateClientSchema,
} from '../controllers/clientController';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { validate } from '../middleware/validate';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(Role.ADMIN, Role.PM));

router.get('/', listClients);
router.post('/', requireRole(Role.ADMIN), validate({ body: createClientSchema }), createClient);
router.put('/:id', requireRole(Role.ADMIN), validate({ body: updateClientSchema }), updateClient);
router.delete('/:id', requireRole(Role.ADMIN), deleteClient);

export default router;
