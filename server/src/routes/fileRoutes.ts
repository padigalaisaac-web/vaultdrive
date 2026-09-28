import { Router } from 'express';
import multer from 'multer';
import {
  uploadFile,
  checkDuplicate,
  initUploadSession,
  uploadChunk,
  completeUploadSession,
  listFiles,
  getFile,
  downloadFile,
  updateFile,
  deleteFile
} from '../controllers/fileController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { initUploadSessionSchema, updateFileSchema } from '../validators/index.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB direct upload limit (larger files use chunked upload)
  }
});

const chunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB max chunk size
  }
});

const router = Router();

// File Listing & Duplicate Check
router.get('/', authenticateToken, listFiles);
router.post('/check-duplicate', authenticateToken, checkDuplicate);

// Direct Upload
router.post('/upload', authenticateToken, upload.single('file'), uploadFile);

// Chunked / Resumable Upload
router.post('/upload/init', authenticateToken, validateBody(initUploadSessionSchema), initUploadSession);
router.post('/upload/:sessionId/chunk', authenticateToken, chunkUpload.single('chunk'), uploadChunk);
router.post('/upload/:sessionId/complete', authenticateToken, completeUploadSession);

// Individual File Operations
router.get('/:id', authenticateToken, getFile);
router.get('/:id/download', authenticateToken, downloadFile);
router.patch('/:id', authenticateToken, validateBody(updateFileSchema), updateFile);
router.delete('/:id', authenticateToken, deleteFile);

export default router;
