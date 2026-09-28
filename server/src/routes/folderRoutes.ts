import { Router } from 'express';
import {
  createFolder,
  listFolders,
  getFolder,
  updateFolder,
  deleteFolder,
  getBreadcrumbs
} from '../controllers/folderController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createFolderSchema, updateFolderSchema } from '../validators/index.js';

const router = Router();

router.get('/', authenticateToken, listFolders);
router.post('/', authenticateToken, validateBody(createFolderSchema), createFolder);
router.get('/:id', authenticateToken, getFolder);
router.patch('/:id', authenticateToken, validateBody(updateFolderSchema), updateFolder);
router.delete('/:id', authenticateToken, deleteFolder);
router.get('/:id/breadcrumbs', authenticateToken, getBreadcrumbs);

export default router;
