import { Router } from 'express';
import {
  createShare,
  listShares,
  deleteShare,
  getPublicShare,
  downloadPublicShare
} from '../controllers/shareController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createShareSchema } from '../validators/index.js';

const router = Router();

// Authenticated user share endpoints
router.get('/', authenticateToken, listShares);
router.post('/', authenticateToken, validateBody(createShareSchema), createShare);
router.delete('/:id', authenticateToken, deleteShare);

// Public unauthenticated share access
router.get('/public/:token', getPublicShare);
router.get('/public/:token/download', downloadPublicShare);

export default router;
