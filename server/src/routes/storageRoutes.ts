import { Router } from 'express';
import { getStorageStats } from '../controllers/storageController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/stats', authenticateToken, getStorageStats);

export default router;
