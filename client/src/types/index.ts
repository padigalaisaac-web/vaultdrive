export type NetworkStatus = 'ONLINE' | 'OFFLINE' | 'SERVER_UNAVAILABLE' | 'SYNCING' | 'SYNC_ERROR';

export type FileCategory = 'document' | 'image' | 'video' | 'audio' | 'archive' | 'other';

export interface User {
  id: string;
  email: string;
  name: string;
  storage_quota: number;
  used_storage: number;
  created_at?: string;
}

export interface Folder {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  color: string;
  is_favorite: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  // Local flags
  sync_status?: 'synced' | 'pending' | 'error';
}

export interface FileItem {
  id: string;
  user_id: string;
  folder_id: string | null;
  name: string;
  original_name: string;
  mime_type: string;
  size: number;
  extension: string;
  storage_path: string;
  storage_provider: 'local' | 's3';
  checksum: string;
  category: FileCategory;
  is_favorite: boolean;
  is_offline: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  // Local flags
  sync_status?: 'synced' | 'pending' | 'error';
  is_offline_cached?: boolean;
}

export interface OfflineFile {
  fileId: string;
  name: string;
  mimeType: string;
  size: number;
  blob: Blob;
  checksum: string;
  downloadedAt: string;
  category: FileCategory;
  extension: string;
}

export interface PendingUpload {
  id: string;
  filename: string;
  file: File;
  folder_id: string | null;
  size: number;
  mimeType: string;
  progress: number;
  status: 'queued' | 'uploading' | 'paused' | 'completed' | 'error';
  error?: string;
  checksum?: string;
  is_resumable?: boolean;
  sessionId?: string;
  totalChunks?: number;
  uploadedChunks?: number[];
  createdAt: string;
}

export interface SyncQueueItem {
  id: string;
  operation_type:
    | 'create_folder'
    | 'update_folder'
    | 'delete_folder'
    | 'update_file'
    | 'delete_file'
    | 'restore_file'
    | 'restore_folder';
  entity_type: 'file' | 'folder';
  entity_id: string;
  payload: Record<string, any>;
  version: number;
  client_timestamp: string;
  status: 'pending' | 'syncing' | 'failed';
  retryCount: number;
}

export interface StorageCategoryStats {
  documents: number;
  images: number;
  videos: number;
  audio: number;
  archives: number;
  other: number;
}

export interface StorageStats {
  used: number;
  total: number;
  usage_percentage: number;
  categories: StorageCategoryStats;
  total_files: number;
  total_folders: number;
  trash_size: number;
  trash_count: number;
  offline_files?: number;
  offline_storage_used?: number;
  device_storage_available?: number;
}

export interface ShareItem {
  id: string;
  share_token: string;
  file?: {
    id: string;
    name: string;
    size: number;
    mime_type: string;
    category: FileCategory;
  } | null;
  folder?: {
    id: string;
    name: string;
    color: string;
  } | null;
  password_protected: boolean;
  expires_at: string | null;
  allow_download: boolean;
  access_count: number;
  created_at: string;
  share_url: string;
}

export interface ConflictItem {
  opId: string;
  entity_id: string;
  entity_type: 'file' | 'folder';
  serverVersion: any;
  clientPayload: any;
}
