import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  name: z.string().min(2, 'Name must be at least 2 characters long')
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

export const createFolderSchema = z.object({
  name: z.string().min(1, 'Folder name is required').max(255),
  parent_id: z.string().uuid().nullable().optional(),
  color: z.string().optional()
});

export const updateFolderSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  parent_id: z.string().uuid().nullable().optional(),
  color: z.string().optional(),
  is_favorite: z.boolean().optional()
});

export const updateFileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  folder_id: z.string().uuid().nullable().optional(),
  is_favorite: z.boolean().optional(),
  is_offline: z.boolean().optional()
});

export const initUploadSessionSchema = z.object({
  filename: z.string().min(1).max(255),
  total_size: z.number().int().positive(),
  total_chunks: z.number().int().positive(),
  chunk_size: z.number().int().positive(),
  checksum: z.string().min(32),
  folder_id: z.string().uuid().nullable().optional()
});

export const createShareSchema = z.object({
  file_id: z.string().uuid().nullable().optional(),
  folder_id: z.string().uuid().nullable().optional(),
  password: z.string().optional(),
  expires_in_days: z.number().int().positive().nullable().optional(),
  allow_download: z.boolean().default(true)
});

export const syncPushSchema = z.object({
  device_id: z.string().min(1),
  operations: z.array(
    z.object({
      id: z.string(),
      operation_type: z.enum([
        'create_folder',
        'update_folder',
        'delete_folder',
        'update_file',
        'delete_file',
        'restore_file',
        'restore_folder'
      ]),
      entity_type: z.enum(['file', 'folder']),
      entity_id: z.string(),
      payload: z.record(z.any()),
      version: z.number().int(),
      client_timestamp: z.string()
    })
  )
});
