import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/dbAdapter.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { FileItem, Folder, UploadSession } from '../types/index.js';
import { getStorageProvider } from '../services/storage/storageFactory.js';
import { getFileCategory, sanitizeExtension } from '../utils/mimeHelper.js';
import { sanitizeFilename } from '../utils/pathSanitizer.js';
import { calculateBufferChecksum } from '../utils/crypto.js';
import { config } from '../config/env.js';

export const uploadFile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const file = req.file;
    const { folder_id, is_favorite, is_offline } = req.body;

    if (!file) {
      res.status(400).json({ success: false, message: 'No file provided.' });
      return;
    }

    // Quota validation
    const userQuota = Number(req.user!.storage_quota);
    const usedStorage = Number(req.user!.used_storage);
    if (usedStorage + file.size > userQuota) {
      res.status(413).json({
        success: false,
        message: 'Storage quota exceeded. Please free up space to upload new files.'
      });
      return;
    }

    if (folder_id) {
      const folderCheck = await db.query<Folder>(
        'SELECT id FROM folders WHERE id = $1 AND user_id = $2 AND is_deleted = false',
        [folder_id, userId]
      );
      if (folderCheck.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Destination folder not found.' });
        return;
      }
    }

    const fileId = uuidv4();
    const originalName = sanitizeFilename(file.originalname);
    const mimeType = file.mimetype || 'application/octet-stream';
    const category = getFileCategory(mimeType, originalName);
    const extension = sanitizeExtension(originalName);

    const storageProvider = getStorageProvider();
    const storageResult = await storageProvider.saveFile(
      userId,
      fileId,
      category,
      originalName,
      file.buffer
    );

    const fileRecord = await db.query<FileItem>(
      `INSERT INTO files (
        id, user_id, folder_id, name, original_name, mime_type, size,
        extension, storage_path, storage_provider, checksum, category,
        is_favorite, is_offline
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        fileId,
        userId,
        folder_id || null,
        originalName,
        originalName,
        mimeType,
        storageResult.size,
        extension,
        storageResult.storagePath,
        config.storageProvider,
        storageResult.checksum,
        category,
        is_favorite === 'true' || is_favorite === true,
        is_offline === 'true' || is_offline === true
      ]
    );

    // Update user used storage
    await db.query('UPDATE users SET used_storage = used_storage + $1 WHERE id = $2', [
      storageResult.size,
      userId
    ]);

    const created = fileRecord.rows[0] || {
      id: fileId,
      user_id: userId,
      folder_id: folder_id || null,
      name: originalName,
      original_name: originalName,
      mime_type: mimeType,
      size: storageResult.size,
      extension,
      storage_path: storageResult.storagePath,
      storage_provider: config.storageProvider,
      checksum: storageResult.checksum,
      category,
      is_favorite: Boolean(is_favorite),
      is_offline: Boolean(is_offline),
      is_deleted: false,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully.',
      file: created
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const checkDuplicate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { checksum, size, filename } = req.body;

    if (!checksum) {
      res.status(400).json({ success: false, message: 'File checksum is required.' });
      return;
    }

    const dupRes = await db.query<FileItem>(
      'SELECT * FROM files WHERE user_id = $1 AND checksum = $2 AND is_deleted = false',
      [userId, checksum]
    );

    if (dupRes.rows.length > 0) {
      const existing = dupRes.rows[0];
      res.status(200).json({
        success: true,
        duplicate: true,
        existingFile: {
          id: existing.id,
          name: existing.name,
          size: Number(existing.size),
          created_at: existing.created_at,
          folder_id: existing.folder_id
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      duplicate: false
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const initUploadSession = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { filename, total_size, total_chunks, chunk_size, checksum, folder_id } = req.body;

    // Check user quota
    const userQuota = Number(req.user!.storage_quota);
    const usedStorage = Number(req.user!.used_storage);
    if (usedStorage + total_size > userQuota) {
      res.status(413).json({
        success: false,
        message: 'Storage quota exceeded for this file.'
      });
      return;
    }

    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await db.query(
      `INSERT INTO upload_sessions (
        id, user_id, folder_id, filename, total_size, total_chunks,
        uploaded_chunks, chunk_size, checksum, temp_path, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        sessionId,
        userId,
        folder_id || null,
        sanitizeFilename(filename),
        total_size,
        total_chunks,
        [],
        chunk_size,
        checksum,
        `temp_chunks/${sessionId}`,
        expiresAt
      ]
    );

    res.status(201).json({
      success: true,
      sessionId,
      uploadedChunks: [],
      chunkSize: chunk_size,
      totalChunks: total_chunks
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const uploadChunk = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { sessionId } = req.params;
    const chunkIndex = parseInt(req.body.chunkIndex || req.query.chunkIndex as string, 10);
    const chunkFile = req.file;

    if (!chunkFile) {
      res.status(400).json({ success: false, message: 'Chunk binary payload required.' });
      return;
    }

    const sessionRes = await db.query<UploadSession>(
      'SELECT * FROM upload_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (sessionRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Upload session not found or expired.' });
      return;
    }

    const session = sessionRes.rows[0];
    const storageProvider = getStorageProvider();
    await storageProvider.saveChunk(sessionId, chunkIndex, chunkFile.buffer);

    const updatedUploaded = Array.from(new Set([...(session.uploaded_chunks || []), chunkIndex]));
    await db.query('UPDATE upload_sessions SET uploaded_chunks = $1 WHERE id = $2', [
      updatedUploaded,
      sessionId
    ]);

    res.status(200).json({
      success: true,
      chunkIndex,
      uploadedChunks: updatedUploaded,
      progress: Math.round((updatedUploaded.length / session.total_chunks) * 100)
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const completeUploadSession = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { sessionId } = req.params;

    const sessionRes = await db.query<UploadSession>(
      'SELECT * FROM upload_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (sessionRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Upload session not found.' });
      return;
    }

    const session = sessionRes.rows[0];
    if (session.uploaded_chunks.length < session.total_chunks) {
      res.status(400).json({
        success: false,
        message: `Incomplete upload. ${session.uploaded_chunks.length}/${session.total_chunks} chunks received.`
      });
      return;
    }

    const fileId = uuidv4();
    const cleanName = sanitizeFilename(session.filename);
    const extension = sanitizeExtension(cleanName);
    const category = getFileCategory('', cleanName);

    const storageProvider = getStorageProvider();
    const storageResult = await storageProvider.assembleChunks(
      sessionId,
      session.total_chunks,
      userId,
      fileId,
      category,
      cleanName
    );

    const fileRecord = await db.query<FileItem>(
      `INSERT INTO files (
        id, user_id, folder_id, name, original_name, mime_type, size,
        extension, storage_path, storage_provider, checksum, category,
        is_favorite, is_offline
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false, false)`,
      [
        fileId,
        userId,
        session.folder_id || null,
        cleanName,
        cleanName,
        'application/octet-stream',
        storageResult.size,
        extension,
        storageResult.storagePath,
        config.storageProvider,
        storageResult.checksum,
        category
      ]
    );

    // Update user used storage
    await db.query('UPDATE users SET used_storage = used_storage + $1 WHERE id = $2', [
      storageResult.size,
      userId
    ]);

    // Remove upload session
    await db.query('DELETE FROM upload_sessions WHERE id = $1', [sessionId]);

    const created = fileRecord.rows[0] || {
      id: fileId,
      user_id: userId,
      folder_id: session.folder_id || null,
      name: cleanName,
      original_name: cleanName,
      mime_type: 'application/octet-stream',
      size: storageResult.size,
      extension,
      storage_path: storageResult.storagePath,
      storage_provider: config.storageProvider,
      checksum: storageResult.checksum,
      category,
      is_favorite: false,
      is_offline: false,
      is_deleted: false,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    res.status(201).json({
      success: true,
      message: 'Chunked upload finalized successfully.',
      file: created
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const listFiles = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { folder_id, category, favorite, offline } = req.query;

    let filesRes = await db.query<FileItem>(
      'SELECT * FROM files WHERE user_id = $1 AND is_deleted = false ORDER BY created_at DESC',
      [userId]
    );

    let files = filesRes.rows;

    if (folder_id !== undefined) {
      const folderVal = folder_id === 'null' || folder_id === '' ? null : folder_id;
      files = files.filter(f => (folderVal === null ? !f.folder_id : f.folder_id === folderVal));
    }

    if (category && typeof category === 'string') {
      files = files.filter(f => f.category === category);
    }

    if (favorite === 'true') {
      files = files.filter(f => f.is_favorite);
    }

    if (offline === 'true') {
      files = files.filter(f => f.is_offline);
    }

    res.status(200).json({
      success: true,
      files
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getFile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const fileRes = await db.query<FileItem>(
      'SELECT * FROM files WHERE id = $1 AND user_id = $2 AND is_deleted = false',
      [id, userId]
    );

    if (fileRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'File not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      file: fileRes.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const downloadFile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const isInline = req.query.inline === 'true';

    const fileRes = await db.query<FileItem>(
      'SELECT * FROM files WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (fileRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'File not found.' });
      return;
    }

    const file = fileRes.rows[0];
    const storageProvider = getStorageProvider();
    const fileSize = Number(file.size);

    // Range request handling for video/audio seek
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': file.mime_type || 'application/octet-stream',
      });

      const stream = await storageProvider.getFileStream(file.storage_path, { start, end });
      stream.pipe(res);
      return;
    }

    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', fileSize);
    res.setHeader(
      'Content-Disposition',
      `${isInline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(file.name)}"`
    );

    const stream = await storageProvider.getFileStream(file.storage_path);
    stream.pipe(res);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateFile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { name, folder_id, is_favorite, is_offline } = req.body;

    const fileRes = await db.query<FileItem>(
      'SELECT * FROM files WHERE id = $1 AND user_id = $2 AND is_deleted = false',
      [id, userId]
    );

    if (fileRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'File not found.' });
      return;
    }

    const file = fileRes.rows[0];
    const newName = name !== undefined ? sanitizeFilename(name) : file.name;
    const newFolderId = folder_id !== undefined ? folder_id : file.folder_id;
    const newFavorite = is_favorite !== undefined ? Boolean(is_favorite) : file.is_favorite;
    const newOffline = is_offline !== undefined ? Boolean(is_offline) : file.is_offline;

    const updateRes = await db.query<FileItem>(
      `UPDATE files SET name = $1, folder_id = $2, is_favorite = $3, is_offline = $4, version = version + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND user_id = $6`,
      [newName, newFolderId, newFavorite, newOffline, id, userId]
    );

    res.status(200).json({
      success: true,
      message: 'File updated successfully.',
      file: updateRes.rows[0] || { ...file, name: newName, folder_id: newFolderId, is_favorite: newFavorite, is_offline: newOffline }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteFile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const fileRes = await db.query<FileItem>(
      'SELECT * FROM files WHERE id = $1 AND user_id = $2 AND is_deleted = false',
      [id, userId]
    );

    if (fileRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'File not found.' });
      return;
    }

    await db.query(
      `UPDATE files SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP, version = version + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    res.status(200).json({
      success: true,
      message: 'File moved to trash.'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
