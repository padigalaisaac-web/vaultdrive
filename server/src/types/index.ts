export interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  storage_quota: number; // in bytes (default 10GB = 10737418240)
  used_storage: number;  // in bytes
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  color?: string;
  is_favorite: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  version: number;
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
  checksum: string; // SHA-256
  category: 'document' | 'image' | 'video' | 'audio' | 'archive' | 'other';
  is_favorite: boolean;
  is_offline: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface FileVersion {
  id: string;
  file_id: string;
  version_number: number;
  size: number;
  storage_path: string;
  checksum: string;
  created_at: string;
  created_by: string;
}

export interface Share {
  id: string;
  user_id: string;
  file_id: string | null;
  folder_id: string | null;
  share_token: string;
  password_hash: string | null;
  expires_at: string | null;
  allow_download: boolean;
  access_count: number;
  created_at: string;
}

export interface UploadSession {
  id: string;
  user_id: string;
  folder_id: string | null;
  filename: string;
  total_size: number;
  total_chunks: number;
  uploaded_chunks: number[];
  chunk_size: number;
  checksum: string;
  temp_path: string;
  created_at: string;
  expires_at: string;
}

export interface SyncOperation {
  id: string;
  user_id: string;
  device_id: string;
  operation_type: 'create_folder' | 'update_folder' | 'delete_folder' | 'update_file' | 'delete_file' | 'restore_file' | 'restore_folder';
  entity_type: 'file' | 'folder';
  entity_id: string;
  payload: any;
  version: number;
  client_timestamp: string;
  server_timestamp: string;
}

export interface StorageStats {
  used: number;
  total: number;
  usage_percentage: number;
  categories: {
    documents: number;
    images: number;
    videos: number;
    audio: number;
    archives: number;
    other: number;
  };
  total_files: number;
  total_folders: number;
  trash_size: number;
  trash_count: number;
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
}
