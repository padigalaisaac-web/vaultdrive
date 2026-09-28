import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/dbAdapter.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { FileItem, Folder } from '../types/index.js';
import { sanitizeFilename } from '../utils/pathSanitizer.js';

export const ping = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    status: 'online',
    serverTime: new Date().toISOString()
  });
};

export const pull = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const since = req.query.since ? new Date(req.query.since as string) : new Date(0);

    const foldersRes = await db.query<Folder>(
      'SELECT * FROM folders WHERE user_id = $1',
      [userId]
    );

    const filesRes = await db.query<FileItem>(
      'SELECT * FROM files WHERE user_id = $1',
      [userId]
    );

    // Filter items updated since timestamp
    const updatedFolders = foldersRes.rows.filter(f => new Date(f.updated_at) > since);
    const updatedFiles = filesRes.rows.filter(f => new Date(f.updated_at) > since);

    res.status(200).json({
      success: true,
      serverTime: new Date().toISOString(),
      folders: updatedFolders,
      files: updatedFiles,
      fullSync: since.getTime() === 0
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const push = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { device_id, operations } = req.body;

    const results: any[] = [];
    const conflicts: any[] = [];

    for (const op of operations) {
      const { id: opId, operation_type, entity_type, entity_id, payload, version, client_timestamp } = op;

      if (entity_type === 'folder') {
        if (operation_type === 'create_folder') {
          // Check if folder exists
          const existing = await db.query<Folder>('SELECT * FROM folders WHERE id = $1', [entity_id]);
          if (existing.rows.length === 0) {
            await db.query(
              `INSERT INTO folders (id, user_id, parent_id, name, color, is_favorite)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                entity_id,
                userId,
                payload.parent_id || null,
                sanitizeFilename(payload.name || 'New Folder'),
                payload.color || '#0c8ee9',
                Boolean(payload.is_favorite)
              ]
            );
            results.push({ opId, entity_id, status: 'created', version: 1 });
          } else {
            results.push({ opId, entity_id, status: 'already_exists', version: existing.rows[0].version });
          }
        } else if (operation_type === 'update_folder') {
          const current = await db.query<Folder>('SELECT * FROM folders WHERE id = $1 AND user_id = $2', [
            entity_id,
            userId
          ]);
          if (current.rows.length > 0) {
            const curFolder = current.rows[0];
            // Conflict check
            if (curFolder.version > version) {
              conflicts.push({
                opId,
                entity_id,
                entity_type: 'folder',
                serverVersion: curFolder,
                clientPayload: payload
              });
            } else {
              const newName = payload.name ? sanitizeFilename(payload.name) : curFolder.name;
              await db.query(
                `UPDATE folders SET name = $1, color = $2, is_favorite = $3, parent_id = $4, version = version + 1, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $5 AND user_id = $6`,
                [
                  newName,
                  payload.color !== undefined ? payload.color : curFolder.color,
                  payload.is_favorite !== undefined ? payload.is_favorite : curFolder.is_favorite,
                  payload.parent_id !== undefined ? payload.parent_id : curFolder.parent_id,
                  entity_id,
                  userId
                ]
              );
              results.push({ opId, entity_id, status: 'updated', version: curFolder.version + 1 });
            }
          }
        } else if (operation_type === 'delete_folder') {
          await db.query(
            `UPDATE folders SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP, version = version + 1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND user_id = $2`,
            [entity_id, userId]
          );
          results.push({ opId, entity_id, status: 'deleted' });
        }
      } else if (entity_type === 'file') {
        if (operation_type === 'update_file') {
          const current = await db.query<FileItem>('SELECT * FROM files WHERE id = $1 AND user_id = $2', [
            entity_id,
            userId
          ]);
          if (current.rows.length > 0) {
            const curFile = current.rows[0];
            if (curFile.version > version) {
              conflicts.push({
                opId,
                entity_id,
                entity_type: 'file',
                serverVersion: curFile,
                clientPayload: payload
              });
            } else {
              const newName = payload.name ? sanitizeFilename(payload.name) : curFile.name;
              await db.query(
                `UPDATE files SET name = $1, folder_id = $2, is_favorite = $3, is_offline = $4, version = version + 1, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $5 AND user_id = $6`,
                [
                  newName,
                  payload.folder_id !== undefined ? payload.folder_id : curFile.folder_id,
                  payload.is_favorite !== undefined ? payload.is_favorite : curFile.is_favorite,
                  payload.is_offline !== undefined ? payload.is_offline : curFile.is_offline,
                  entity_id,
                  userId
                ]
              );
              results.push({ opId, entity_id, status: 'updated', version: curFile.version + 1 });
            }
          }
        } else if (operation_type === 'delete_file') {
          await db.query(
            `UPDATE files SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP, version = version + 1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND user_id = $2`,
            [entity_id, userId]
          );
          results.push({ opId, entity_id, status: 'deleted' });
        } else if (operation_type === 'restore_file') {
          await db.query(
            `UPDATE files SET is_deleted = false, deleted_at = NULL, version = version + 1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND user_id = $2`,
            [entity_id, userId]
          );
          results.push({ opId, entity_id, status: 'restored' });
        }
      }

      // Record sync log
      await db.query(
        `INSERT INTO sync_operations (id, user_id, device_id, operation_type, entity_type, entity_id, payload, version, client_timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          uuidv4(),
          userId,
          device_id,
          operation_type,
          entity_type,
          entity_id,
          JSON.stringify(payload),
          version || 1,
          client_timestamp || new Date().toISOString()
        ]
      );
    }

    res.status(200).json({
      success: true,
      message: 'Sync batch processed successfully.',
      serverTime: new Date().toISOString(),
      results,
      conflicts
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
