import { Router } from 'express';
import { listTrash, restoreItem, permanentlyDelete, emptyTrash } from '../controllers/trashController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, listTrash);
router.post('/empty', authenticateToken, emptyTrash);
router.post('/:id/restore', authenticateToken, restoreItem);
router.delete('/:id', authenticateToken, permanentlyDelete);

export default router;
