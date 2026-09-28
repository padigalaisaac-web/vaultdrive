import { localDB } from './schema.js';
import { FileItem, Folder, OfflineFile, PendingUpload, SyncQueueItem } from '../types/index.js';

export const dbService = {
  // Folders
  async getFolders(userId?: string, parentId: string | null = null): Promise<Folder[]> {
    let query = localDB.folders.toCollection();
    if (userId) {
      query = localDB.folders.where('user_id').equals(userId);
    }
    const all = await query.toArray();
    return all.filter(f => !f.is_deleted && (parentId === null ? !f.parent_id : f.parent_id === parentId));
  },

  async getAllNonDeletedFolders(userId?: string): Promise<Folder[]> {
    const all = await localDB.folders.toArray();
    return all.filter(f => !f.is_deleted && (!userId || f.user_id === userId));
  },

  async saveFolder(folder: Folder): Promise<void> {
    await localDB.folders.put(folder);
  },

  async bulkSaveFolders(folders: Folder[]): Promise<void> {
    await localDB.folders.bulkPut(folders);
  },

  // Files
  async getFiles(userId?: string, folderId: string | null = null): Promise<FileItem[]> {
    const all = await localDB.files.toArray();
    return all.filter(
      f => !f.is_deleted && (!userId || f.user_id === userId) && (folderId === null ? !f.folder_id : f.folder_id === folderId)
    );
  },

  async getAllNonDeletedFiles(userId?: string): Promise<FileItem[]> {
    const all = await localDB.files.toArray();
    return all.filter(f => !f.is_deleted && (!userId || f.user_id === userId));
  },

  async getFavoriteFiles(userId?: string): Promise<FileItem[]> {
    const all = await localDB.files.toArray();
    return all.filter(f => !f.is_deleted && f.is_favorite && (!userId || f.user_id === userId));
  },

  async getOfflineFiles(userId?: string): Promise<FileItem[]> {
    const all = await localDB.files.toArray();
    return all.filter(f => !f.is_deleted && f.is_offline && (!userId || f.user_id === userId));
  },

  async getTrashItems(userId?: string): Promise<{ files: FileItem[]; folders: Folder[] }> {
    const allFiles = await localDB.files.toArray();
    const allFolders = await localDB.folders.toArray();
    return {
      files: allFiles.filter(f => f.is_deleted && (!userId || f.user_id === userId)),
      folders: allFolders.filter(f => f.is_deleted && (!userId || f.user_id === userId))
    };
  },

  async saveFile(file: FileItem): Promise<void> {
    await localDB.files.put(file);
  },

  async bulkSaveFiles(files: FileItem[]): Promise<void> {
    await localDB.files.bulkPut(files);
  },

  // Offline Blob Cache
  async saveOfflineBlob(offlineFile: OfflineFile): Promise<void> {
    await localDB.offlineFiles.put(offlineFile);
  },

  async getOfflineBlob(fileId: string): Promise<OfflineFile | undefined> {
    return localDB.offlineFiles.get(fileId);
  },

  async deleteOfflineBlob(fileId: string): Promise<void> {
    await localDB.offlineFiles.delete(fileId);
  },

  async getOfflineStorageUsage(): Promise<number> {
    const all = await localDB.offlineFiles.toArray();
    return all.reduce((acc, cur) => acc + (cur.size || 0), 0);
  },

  async clearOfflineStorage(): Promise<void> {
    await localDB.offlineFiles.clear();
  },

  // Sync Queue
  async enqueueSyncOp(op: Omit<SyncQueueItem, 'status' | 'retryCount'>): Promise<void> {
    await localDB.syncQueue.put({
      ...op,
      status: 'pending',
      retryCount: 0
    });
  },

  async getPendingSyncOps(): Promise<SyncQueueItem[]> {
    return localDB.syncQueue.where('status').equals('pending').toArray();
  },

  async removeSyncOp(id: string): Promise<void> {
    await localDB.syncQueue.delete(id);
  },

  // Upload Queue
  async enqueueUpload(upload: PendingUpload): Promise<void> {
    await localDB.uploadQueue.put(upload);
  },

  async getPendingUploads(): Promise<PendingUpload[]> {
    return localDB.uploadQueue.where('status').anyOf(['queued', 'uploading', 'error']).toArray();
  },

  async updateUpload(upload: PendingUpload): Promise<void> {
    await localDB.uploadQueue.put(upload);
  },

  async removeUpload(id: string): Promise<void> {
    await localDB.uploadQueue.delete(id);
  },

  // Settings
  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    const item = await localDB.settings.get(key);
    return item ? (item.value as T) : defaultValue;
  },

  async setSetting(key: string, value: any): Promise<void> {
    await localDB.settings.put({ key, value });
  }
};

export { localDB };
