import { Response } from 'express';
import { db } from '../db/dbAdapter.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { FileItem, Folder } from '../types/index.js';

export const search = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const query = (req.query.q as string || '').toLowerCase().trim();
    const category = req.query.category as string | undefined;
    const ext = req.query.extension as string | undefined;
    const folderId = req.query.folder_id as string | undefined;

    const filesRes = await db.query<FileItem>(
      'SELECT * FROM files WHERE user_id = $1 AND is_deleted = false',
      [userId]
    );

    const foldersRes = await db.query<Folder>(
      'SELECT * FROM folders WHERE user_id = $1 AND is_deleted = false',
      [userId]
    );

    let files = filesRes.rows;
    let folders = foldersRes.rows;

    if (query) {
      files = files.filter(f =>
        f.name.toLowerCase().includes(query) ||
        f.extension.toLowerCase().includes(query) ||
        f.category.toLowerCase().includes(query)
      );
      folders = folders.filter(f =>
        f.name.toLowerCase().includes(query)
      );
    }

    if (category) {
      files = files.filter(f => f.category === category);
    }

    if (ext) {
      const cleanExt = ext.replace(/^\./, '').toLowerCase();
      files = files.filter(f => f.extension.toLowerCase() === cleanExt);
    }

    if (folderId) {
      files = files.filter(f => f.folder_id === folderId);
      folders = folders.filter(f => f.parent_id === folderId);
    }

    res.status(200).json({
      success: true,
      query,
      results: {
        files,
        folders,
        totalMatches: files.length + folders.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
