import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/dbAdapter.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { Share, FileItem, Folder } from '../types/index.js';
import { generateShareToken, hashPassword, comparePassword } from '../utils/crypto.js';
import { getStorageProvider } from '../services/storage/storageFactory.js';

export const createShare = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { file_id, folder_id, password, expires_in_days, allow_download } = req.body;

    if (!file_id && !folder_id) {
      res.status(400).json({ success: false, message: 'Either file_id or folder_id is required.' });
      return;
    }

    if (file_id) {
      const fileRes = await db.query<FileItem>(
        'SELECT id FROM files WHERE id = $1 AND user_id = $2 AND is_deleted = false',
        [file_id, userId]
      );
      if (fileRes.rows.length === 0) {
        res.status(404).json({ success: false, message: 'File not found.' });
        return;
      }
    }

    if (folder_id) {
      const folderRes = await db.query<Folder>(
        'SELECT id FROM folders WHERE id = $1 AND user_id = $2 AND is_deleted = false',
        [folder_id, userId]
      );
      if (folderRes.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Folder not found.' });
        return;
      }
    }

    const shareId = uuidv4();
    const token = generateShareToken();
    const passwordHash = password ? await hashPassword(password) : null;
    let expiresAt: string | null = null;

    if (expires_in_days && typeof expires_in_days === 'number') {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + expires_in_days);
      expiresAt = expDate.toISOString();
    }

    const shareRes = await db.query<Share>(
      `INSERT INTO shares (id, user_id, file_id, folder_id, share_token, password_hash, expires_at, allow_download)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        shareId,
        userId,
        file_id || null,
        folder_id || null,
        token,
        passwordHash,
        expiresAt,
        allow_download !== undefined ? Boolean(allow_download) : true
      ]
    );

    const share = shareRes.rows[0] || {
      id: shareId,
      user_id: userId,
      file_id: file_id || null,
      folder_id: folder_id || null,
      share_token: token,
      password_protected: Boolean(password),
      expires_at: expiresAt,
      allow_download: allow_download !== undefined ? Boolean(allow_download) : true,
      access_count: 0,
      created_at: new Date().toISOString()
    };

    res.status(201).json({
      success: true,
      message: 'Share link generated successfully.',
      share: {
        ...share,
        password_protected: Boolean(password),
        password_hash: undefined,
        share_url: `/share/${token}`
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const listShares = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const sharesRes = await db.query<Share>(
      'SELECT * FROM shares WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    const filesRes = await db.query<FileItem>('SELECT id, name, size, mime_type FROM files WHERE user_id = $1', [userId]);
    const foldersRes = await db.query<Folder>('SELECT id, name, color FROM folders WHERE user_id = $1', [userId]);

    const fileMap = new Map(filesRes.rows.map(f => [f.id, f]));
    const folderMap = new Map(foldersRes.rows.map(f => [f.id, f]));

    const enriched = sharesRes.rows.map(s => ({
      id: s.id,
      share_token: s.share_token,
      file: s.file_id ? fileMap.get(s.file_id) : null,
      folder: s.folder_id ? folderMap.get(s.folder_id) : null,
      password_protected: Boolean(s.password_hash),
      expires_at: s.expires_at,
      allow_download: s.allow_download,
      access_count: s.access_count,
      created_at: s.created_at,
      share_url: `/share/${s.share_token}`
    }));

    res.status(200).json({
      success: true,
      shares: enriched
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteShare = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    await db.query('DELETE FROM shares WHERE id = $1 AND user_id = $2', [id, userId]);

    res.status(200).json({
      success: true,
      message: 'Share revoked successfully.'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPublicShare = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const passwordHeader = req.headers['x-share-password'] as string | undefined;

    const shareRes = await db.query<Share>('SELECT * FROM shares WHERE share_token = $1', [token]);
    if (shareRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Shared item not found or expired.' });
      return;
    }

    const share = shareRes.rows[0];

    // Expiry check
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      res.status(410).json({ success: false, message: 'This shared link has expired.' });
      return;
    }

    // Password verification check
    if (share.password_hash) {
      if (!passwordHeader) {
        res.status(403).json({
          success: false,
          requiresPassword: true,
          message: 'This shared item is password protected.'
        });
        return;
      }

      const isMatch = await comparePassword(passwordHeader, share.password_hash);
      if (!isMatch) {
        res.status(403).json({
          success: false,
          requiresPassword: true,
          message: 'Incorrect share password.'
        });
        return;
      }
    }

    // Fetch file / folder
    let fileInfo: FileItem | null = null;
    let folderInfo: Folder | null = null;

    if (share.file_id) {
      const fileRes = await db.query<FileItem>('SELECT * FROM files WHERE id = $1 AND is_deleted = false', [
        share.file_id
      ]);
      fileInfo = fileRes.rows[0] || null;
    }

    if (share.folder_id) {
      const folderRes = await db.query<Folder>('SELECT * FROM folders WHERE id = $1 AND is_deleted = false', [
        share.folder_id
      ]);
      folderInfo = folderRes.rows[0] || null;
    }

    // Increment access count
    await db.query('UPDATE shares SET access_count = access_count + 1 WHERE id = $1', [share.id]);

    res.status(200).json({
      success: true,
      share: {
        id: share.id,
        share_token: share.share_token,
        allow_download: share.allow_download,
        expires_at: share.expires_at,
        created_at: share.created_at,
        file: fileInfo ? {
          id: fileInfo.id,
          name: fileInfo.name,
          size: fileInfo.size,
          mime_type: fileInfo.mime_type,
          category: fileInfo.category,
          extension: fileInfo.extension
        } : null,
        folder: folderInfo ? {
          id: folderInfo.id,
          name: folderInfo.name,
          color: folderInfo.color
        } : null
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const downloadPublicShare = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const passwordHeader = (req.headers['x-share-password'] || req.query.password) as string | undefined;

    const shareRes = await db.query<Share>('SELECT * FROM shares WHERE share_token = $1', [token]);
    if (shareRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Shared item not found.' });
      return;
    }

    const share = shareRes.rows[0];

    if (!share.allow_download && req.query.inline !== 'true') {
      res.status(403).json({ success: false, message: 'Downloading this file is not permitted.' });
      return;
    }

    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      res.status(410).json({ success: false, message: 'This shared link has expired.' });
      return;
    }

    if (share.password_hash) {
      if (!passwordHeader || !(await comparePassword(passwordHeader, share.password_hash))) {
        res.status(403).json({ success: false, message: 'Password required or incorrect.' });
        return;
      }
    }

    if (!share.file_id) {
      res.status(400).json({ success: false, message: 'Not a downloadable file.' });
      return;
    }

    const fileRes = await db.query<FileItem>('SELECT * FROM files WHERE id = $1 AND is_deleted = false', [
      share.file_id
    ]);

    if (fileRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'File not found.' });
      return;
    }

    const file = fileRes.rows[0];
    const storageProvider = getStorageProvider();
    const fileSize = Number(file.size);

    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', fileSize);
    res.setHeader(
      'Content-Disposition',
      `${req.query.inline === 'true' ? 'inline' : 'attachment'}; filename="${encodeURIComponent(file.name)}"`
    );

    const stream = await storageProvider.getFileStream(file.storage_path);
    stream.pipe(res);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
