import { Router } from 'express';
import authRoutes from './authRoutes.js';
import fileRoutes from './fileRoutes.js';
import folderRoutes from './folderRoutes.js';
import syncRoutes from './syncRoutes.js';
import shareRoutes from './shareRoutes.js';
import trashRoutes from './trashRoutes.js';
import storageRoutes from './storageRoutes.js';
import searchRoutes from './searchRoutes.js';
import healthRoutes from './healthRoutes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/files', fileRoutes);
router.use('/folders', folderRoutes);
router.use('/sync', syncRoutes);
router.use('/shares', shareRoutes);
router.use('/trash', trashRoutes);
router.use('/storage', storageRoutes);
router.use('/search', searchRoutes);

export default router;
