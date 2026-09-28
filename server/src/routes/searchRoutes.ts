import { Router } from 'express';
import { search } from '../controllers/searchController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, search);

export default router;
