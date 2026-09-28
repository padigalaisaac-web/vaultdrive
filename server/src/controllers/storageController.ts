import { Response } from 'express';
import { db } from '../db/dbAdapter.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { FileItem, Folder, StorageStats } from '../types/index.js';

export const getStorageStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const userQuota = Number(req.user!.storage_quota || 10737418240);

    const filesRes = await db.query<FileItem>(
      'SELECT size, category, is_deleted, is_offline FROM files WHERE user_id = $1',
      [userId]
    );

    const foldersRes = await db.query<Folder>(
      'SELECT id, is_deleted FROM folders WHERE user_id = $1',
      [userId]
    );

    const categories = {
      documents: 0,
      images: 0,
      videos: 0,
      audio: 0,
      archives: 0,
      other: 0
    };

    let usedBytes = 0;
    let trashSize = 0;
    let trashCount = 0;
    let totalFiles = 0;
    let offlineCount = 0;

    for (const f of filesRes.rows) {
      const size = Number(f.size || 0);
      if (f.is_deleted) {
        trashSize += size;
        trashCount++;
      } else {
        usedBytes += size;
        totalFiles++;
        if (f.is_offline) {
          offlineCount++;
        }

        switch (f.category) {
          case 'document':
            categories.documents += size;
            break;
          case 'image':
            categories.images += size;
            break;
          case 'video':
            categories.videos += size;
            break;
          case 'audio':
            categories.audio += size;
            break;
          case 'archive':
            categories.archives += size;
            break;
          default:
            categories.other += size;
            break;
        }
      }
    }

    const nonDeletedFolders = foldersRes.rows.filter(f => !f.is_deleted).length;
    const trashFolders = foldersRes.rows.filter(f => f.is_deleted).length;
    trashCount += trashFolders;

    const usagePercentage = userQuota > 0 ? Math.min(100, Math.round((usedBytes / userQuota) * 1000) / 10) : 0;

    const stats: StorageStats & { offline_files: number } = {
      used: usedBytes,
      total: userQuota,
      usage_percentage: usagePercentage,
      categories,
      total_files: totalFiles,
      total_folders: nonDeletedFolders,
      trash_size: trashSize,
      trash_count: trashCount,
      offline_files: offlineCount
    };

    res.status(200).json({
      success: true,
      stats
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
