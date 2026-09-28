import { Response } from 'express';
import { db } from '../db/dbAdapter.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { FileItem, Folder } from '../types/index.js';
import { getStorageProvider } from '../services/storage/storageFactory.js';

export const listTrash = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const filesRes = await db.query<FileItem>(
      'SELECT * FROM files WHERE user_id = $1 AND is_deleted = true ORDER BY deleted_at DESC',
      [userId]
    );

    const foldersRes = await db.query<Folder>(
      'SELECT * FROM folders WHERE user_id = $1 AND is_deleted = true ORDER BY deleted_at DESC',
      [userId]
    );

    res.status(200).json({
      success: true,
      trash: {
        files: filesRes.rows,
        folders: foldersRes.rows,
        totalItems: filesRes.rows.length + foldersRes.rows.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const restoreItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { type } = req.query; // 'file' or 'folder'

    if (type === 'folder') {
      const folderRes = await db.query<Folder>(
        'SELECT * FROM folders WHERE id = $1 AND user_id = $2 AND is_deleted = true',
        [id, userId]
      );
      if (folderRes.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Folder not found in trash.' });
        return;
      }

      await db.query(
        'UPDATE folders SET is_deleted = false, deleted_at = NULL, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );

      // Restore child files
      await db.query(
        'UPDATE files SET is_deleted = false, deleted_at = NULL, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE folder_id = $1',
        [id]
      );

      res.status(200).json({ success: true, message: 'Folder restored from trash.' });
      return;
    }

    // Default: file
    const fileRes = await db.query<FileItem>(
      'SELECT * FROM files WHERE id = $1 AND user_id = $2 AND is_deleted = true',
      [id, userId]
    );
    if (fileRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'File not found in trash.' });
      return;
    }

    await db.query(
      'UPDATE files SET is_deleted = false, deleted_at = NULL, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    res.status(200).json({ success: true, message: 'File restored from trash.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const permanentlyDelete = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { type } = req.query;

    const storageProvider = getStorageProvider();

    if (type === 'folder') {
      // Find all files inside folder to delete storage files
      const filesRes = await db.query<FileItem>('SELECT * FROM files WHERE folder_id = $1 AND user_id = $2', [id, userId]);
      let reclaimedSize = 0;
      for (const f of filesRes.rows) {
        reclaimedSize += Number(f.size);
        await storageProvider.deleteFile(f.storage_path);
        await db.query('DELETE FROM files WHERE id = $1', [f.id]);
      }

      await db.query('DELETE FROM folders WHERE id = $1 AND user_id = $2', [id, userId]);
      if (reclaimedSize > 0) {
        await db.query('UPDATE users SET used_storage = GREATEST(0, used_storage - $1) WHERE id = $2', [reclaimedSize, userId]);
      }

      res.status(200).json({ success: true, message: 'Folder permanently deleted.' });
      return;
    }

    const fileRes = await db.query<FileItem>(
      'SELECT * FROM files WHERE id = $1 AND user_id = $2 AND is_deleted = true',
      [id, userId]
    );
    if (fileRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'File not found in trash.' });
      return;
    }

    const file = fileRes.rows[0];
    await storageProvider.deleteFile(file.storage_path);
    await db.query('DELETE FROM files WHERE id = $1', [id]);
    await db.query('UPDATE users SET used_storage = GREATEST(0, used_storage - $1) WHERE id = $2', [Number(file.size), userId]);

    res.status(200).json({ success: true, message: 'File permanently deleted.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const emptyTrash = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const storageProvider = getStorageProvider();

    const filesRes = await db.query<FileItem>('SELECT * FROM files WHERE user_id = $1 AND is_deleted = true', [userId]);
    let reclaimedSize = 0;

    for (const f of filesRes.rows) {
      reclaimedSize += Number(f.size);
      await storageProvider.deleteFile(f.storage_path);
      await db.query('DELETE FROM files WHERE id = $1', [f.id]);
    }

    await db.query('DELETE FROM folders WHERE user_id = $1 AND is_deleted = true', [userId]);
    if (reclaimedSize > 0) {
      await db.query('UPDATE users SET used_storage = GREATEST(0, used_storage - $1) WHERE id = $2', [reclaimedSize, userId]);
    }

    res.status(200).json({
      success: true,
      message: `Trash emptied successfully. Reclaimed ${reclaimedSize} bytes.`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
