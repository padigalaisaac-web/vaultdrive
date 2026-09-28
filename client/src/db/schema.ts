import Dexie, { type EntityTable } from 'dexie';
import { FileItem, Folder, OfflineFile, PendingUpload, SyncQueueItem } from '../types/index.js';

export interface AppSetting {
  key: string;
  value: any;
}

export class VaultDriveDexieDB extends Dexie {
  files!: EntityTable<FileItem, 'id'>;
  folders!: EntityTable<Folder, 'id'>;
  offlineFiles!: EntityTable<OfflineFile, 'fileId'>;
  uploadQueue!: EntityTable<PendingUpload, 'id'>;
  syncQueue!: EntityTable<SyncQueueItem, 'id'>;
  settings!: EntityTable<AppSetting, 'key'>;

  constructor() {
    super('VaultDriveDB');
    this.version(1).stores({
      files: 'id, user_id, folder_id, name, category, is_favorite, is_offline, is_deleted, checksum, updated_at, sync_status',
      folders: 'id, user_id, parent_id, name, is_favorite, is_deleted, updated_at, sync_status',
      offlineFiles: 'fileId, name, category, downloadedAt, size',
      uploadQueue: 'id, filename, folder_id, status, createdAt',
      syncQueue: 'id, operation_type, entity_type, entity_id, status, client_timestamp',
      settings: 'key'
    });
  }
}

export const localDB = new VaultDriveDexieDB();
