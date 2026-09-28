import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/dbAdapter.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { Folder } from '../types/index.js';
import { sanitizeFilename } from '../utils/pathSanitizer.js';

export const createFolder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { name, parent_id, color } = req.body;
    const cleanName = sanitizeFilename(name);

    if (parent_id) {
      const parentCheck = await db.query<Folder>(
        'SELECT * FROM folders WHERE id = $1 AND user_id = $2 AND is_deleted = false',
        [parent_id, userId]
      );
      if (parentCheck.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Parent folder not found.' });
        return;
      }
    }

    const folderId = uuidv4();
    const folderRes = await db.query<Folder>(
      `INSERT INTO folders (id, user_id, parent_id, name, color, is_favorite)
       VALUES ($1, $2, $3, $4, $5, false)`,
      [folderId, userId, parent_id || null, cleanName, color || '#0c8ee9']
    );

    const folder = folderRes.rows[0] || {
      id: folderId,
      user_id: userId,
      parent_id: parent_id || null,
      name: cleanName,
      color: color || '#0c8ee9',
      is_favorite: false,
      is_deleted: false,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    res.status(201).json({
      success: true,
      message: 'Folder created successfully.',
      folder
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const listFolders = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { parent_id } = req.query;

    let folders: Folder[];
    if (parent_id !== undefined) {
      const parentVal = parent_id === 'null' || parent_id === '' ? null : parent_id;
      const result = await db.query<Folder>(
        'SELECT * FROM folders WHERE user_id = $1 AND is_deleted = false',
        [userId]
      );
      folders = result.rows.filter(f => (parentVal === null ? !f.parent_id : f.parent_id === parentVal));
    } else {
      const result = await db.query<Folder>(
        'SELECT * FROM folders WHERE user_id = $1 AND is_deleted = false ORDER BY name ASC',
        [userId]
      );
      folders = result.rows;
    }

    res.status(200).json({
      success: true,
      folders
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getFolder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const folderRes = await db.query<Folder>(
      'SELECT * FROM folders WHERE id = $1 AND user_id = $2 AND is_deleted = false',
      [id, userId]
    );

    if (folderRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Folder not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      folder: folderRes.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateFolder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { name, color, is_favorite, parent_id } = req.body;

    const existing = await db.query<Folder>(
      'SELECT * FROM folders WHERE id = $1 AND user_id = $2 AND is_deleted = false',
      [id, userId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Folder not found.' });
      return;
    }

    const folder = existing.rows[0];
    const newName = name !== undefined ? sanitizeFilename(name) : folder.name;
    const newColor = color !== undefined ? color : folder.color;
    const newFavorite = is_favorite !== undefined ? is_favorite : folder.is_favorite;
    const newParentId = parent_id !== undefined ? parent_id : folder.parent_id;

    // Prevent folder from being its own parent
    if (newParentId === id) {
      res.status(400).json({ success: false, message: 'A folder cannot be its own parent.' });
      return;
    }

    const updateRes = await db.query<Folder>(
      `UPDATE folders SET name = $1, color = $2, is_favorite = $3, parent_id = $4, version = version + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND user_id = $6`,
      [newName, newColor, newFavorite, newParentId, id, userId]
    );

    res.status(200).json({
      success: true,
      message: 'Folder updated successfully.',
      folder: updateRes.rows[0] || { ...folder, name: newName, color: newColor, is_favorite: newFavorite, parent_id: newParentId }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteFolder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const folderRes = await db.query<Folder>(
      'SELECT * FROM folders WHERE id = $1 AND user_id = $2 AND is_deleted = false',
      [id, userId]
    );

    if (folderRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Folder not found.' });
      return;
    }

    // Soft delete folder and cascade to children
    await db.query(
      `UPDATE folders SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP, version = version + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    // Also soft delete all files directly inside this folder
    await db.query(
      `UPDATE files SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP, version = version + 1, updated_at = CURRENT_TIMESTAMP
       WHERE folder_id = $1 AND user_id = $2`,
      [id, userId]
    );

    res.status(200).json({
      success: true,
      message: 'Folder moved to trash.'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getBreadcrumbs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const breadcrumbs: { id: string; name: string }[] = [];
    let currentId: string | null = id;

    // Guard against infinite loop
    let depth = 0;
    while (currentId && depth < 20) {
      const folderRes: any = await db.query<Folder>(
        'SELECT id, name, parent_id FROM folders WHERE id = $1 AND user_id = $2',
        [currentId, userId]
      );
      if (folderRes.rows.length === 0) break;

      const f: any = folderRes.rows[0];
      breadcrumbs.unshift({ id: f.id, name: f.name });
      currentId = f.parent_id;
      depth++;
    }

    res.status(200).json({
      success: true,
      breadcrumbs
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
