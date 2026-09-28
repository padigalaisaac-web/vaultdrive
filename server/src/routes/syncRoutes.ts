import { Router } from 'express';
import { ping, pull, push } from '../controllers/syncController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { syncPushSchema } from '../validators/index.js';

const router = Router();

// Heartbeat ping endpoint
router.get('/ping', ping);

// Sync pull (incremental changes since timestamp)
router.get('/pull', authenticateToken, pull);

// Sync push (client mutation queue)
router.post('/push', authenticateToken, validateBody(syncPushSchema), push);

export default router;
