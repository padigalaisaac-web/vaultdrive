import { apiClient } from './api.js';
import { dbService } from '../db/index.js';
import { FileItem, PendingUpload } from '../types/index.js';
import { networkDetector } from '../sync/networkDetector.js';
import { calculateFileHash } from '../utils/hash.js';
import { getCategoryFromFilename } from '../utils/mime.js';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks for resumable uploads

export const fileService = {
  async getFiles(userId?: string, folderId: string | null = null): Promise<FileItem[]> {
    const isOnline = networkDetector.getStatus() === 'ONLINE';

    if (isOnline) {
      try {
        const params = new URLSearchParams();
        if (folderId !== undefined) params.set('folder_id', folderId || 'null');
        const res = await apiClient.get(`/files?${params.toString()}`);
        if (res.data.files) {
          await dbService.bulkSaveFiles(res.data.files);
          return res.data.files;
        }
      } catch (e) {
        console.warn('Could not fetch files from server, using local cache:', e);
      }
    }

    return dbService.getFiles(userId, folderId);
  },

  async getAllFiles(userId?: string): Promise<FileItem[]> {
    const isOnline = networkDetector.getStatus() === 'ONLINE';
    if (isOnline) {
      try {
        const res = await apiClient.get('/files');
        if (res.data.files) {
          await dbService.bulkSaveFiles(res.data.files);
          return res.data.files;
        }
      } catch { /* offline fallback */ }
    }
    return dbService.getAllNonDeletedFiles(userId);
  },

  async getFavoriteFiles(userId?: string): Promise<FileItem[]> {
    const isOnline = networkDetector.getStatus() === 'ONLINE';
    if (isOnline) {
      try {
        const res = await apiClient.get('/files?favorite=true');
        if (res.data.files) {
          await dbService.bulkSaveFiles(res.data.files);
          return res.data.files;
        }
      } catch { /* fallback */ }
    }
    return dbService.getFavoriteFiles(userId);
  },

  async getOfflineFiles(userId?: string): Promise<FileItem[]> {
    return dbService.getOfflineFiles(userId);
  },

  async updateFile(id: string, updates: Partial<FileItem>): Promise<void> {
    const isOnline = networkDetector.getStatus() === 'ONLINE';

    const all = await dbService.getAllNonDeletedFiles();
    const file = all.find(f => f.id === id);
    if (file) {
      await dbService.saveFile({
        ...file,
        ...updates,
        updated_at: new Date().toISOString(),
        version: (file.version || 1) + 1
      });
    }

    if (isOnline) {
      try {
        await apiClient.patch(`/files/${id}`, updates);
        return;
      } catch { /* queue for sync */ }
    }

    await dbService.enqueueSyncOp({
      id: crypto.randomUUID(),
      operation_type: 'update_file',
      entity_type: 'file',
      entity_id: id,
      payload: updates,
      version: (file?.version || 1) + 1,
      client_timestamp: new Date().toISOString()
    });
  },

  async deleteFile(id: string): Promise<void> {
    const isOnline = networkDetector.getStatus() === 'ONLINE';

    const all = await dbService.getAllNonDeletedFiles();
    const file = all.find(f => f.id === id);
    if (file) {
      await dbService.saveFile({
        ...file,
        is_deleted: true,
        deleted_at: new Date().toISOString()
      });
    }

    if (isOnline) {
      try {
        await apiClient.delete(`/files/${id}`);
        return;
      } catch { /* queue */ }
    }

    await dbService.enqueueSyncOp({
      id: crypto.randomUUID(),
      operation_type: 'delete_file',
      entity_type: 'file',
      entity_id: id,
      payload: {},
      version: (file?.version || 1) + 1,
      client_timestamp: new Date().toISOString()
    });
  },

  async restoreFile(id: string): Promise<void> {
    const isOnline = networkDetector.getStatus() === 'ONLINE';
    const all = await dbService.getTrashItems();
    const file = all.files.find(f => f.id === id);
    if (file) {
      await dbService.saveFile({ ...file, is_deleted: false, deleted_at: null });
    }
    if (isOnline) {
      try {
        await apiClient.post(`/trash/${id}/restore?type=file`);
        return;
      } catch { /* queue */ }
    }
    await dbService.enqueueSyncOp({
      id: crypto.randomUUID(),
      operation_type: 'restore_file',
      entity_type: 'file',
      entity_id: id,
      payload: {},
      version: (file?.version || 1) + 1,
      client_timestamp: new Date().toISOString()
    });
  },

  async checkDuplicate(file: File): Promise<{ duplicate: boolean; existingFile?: Partial<FileItem> }> {
    const isOnline = networkDetector.getStatus() === 'ONLINE';
    if (!isOnline) return { duplicate: false };
    try {
      const checksum = await calculateFileHash(file);
      const res = await apiClient.post('/files/check-duplicate', {
        checksum,
        size: file.size,
        filename: file.name
      });
      return { duplicate: res.data.duplicate, existingFile: res.data.existingFile };
    } catch {
      return { duplicate: false };
    }
  },

  async uploadFile(
    file: File,
    options: {
      folderId?: string | null;
      isFavorite?: boolean;
      isOffline?: boolean;
      onProgress?: (pct: number) => void;
    } = {}
  ): Promise<FileItem> {
    const isOnline = networkDetector.getStatus() === 'ONLINE';

    if (!isOnline) {
      // Queue for later upload when online
      const pendingId = crypto.randomUUID();
      const pending: PendingUpload = {
        id: pendingId,
        filename: file.name,
        file,
        folder_id: options.folderId ?? null,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        progress: 0,
        status: 'queued',
        createdAt: new Date().toISOString()
      };
      await dbService.enqueueUpload(pending);
      throw new Error('OFFLINE_QUEUED');
    }

    if (file.size > CHUNK_SIZE) {
      return this.uploadFileChunked(file, options);
    }

    const formData = new FormData();
    formData.append('file', file);
    if (options.folderId) formData.append('folder_id', options.folderId);
    if (options.isFavorite) formData.append('is_favorite', 'true');
    if (options.isOffline) formData.append('is_offline', 'true');

    const res = await apiClient.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && options.onProgress) {
          const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          options.onProgress(pct);
        }
      }
    });

    const uploadedFile: FileItem = res.data.file;
    await dbService.saveFile({ ...uploadedFile, sync_status: 'synced' });
    return uploadedFile;
  },

  async uploadFileChunked(
    file: File,
    options: {
      folderId?: string | null;
      onProgress?: (pct: number) => void;
      sessionId?: string;
      uploadedChunks?: number[];
    } = {}
  ): Promise<FileItem> {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const checksum = await calculateFileHash(file);

    let sessionId = options.sessionId;
    let uploadedChunks = options.uploadedChunks || [];

    if (!sessionId) {
      const initRes = await apiClient.post('/files/upload/init', {
        filename: file.name,
        total_size: file.size,
        total_chunks: totalChunks,
        chunk_size: CHUNK_SIZE,
        checksum,
        folder_id: options.folderId || null
      });
      sessionId = initRes.data.sessionId;
      uploadedChunks = initRes.data.uploadedChunks || [];
    }

    for (let i = 0; i < totalChunks; i++) {
      if (uploadedChunks.includes(i)) continue;

      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const chunkForm = new FormData();
      chunkForm.append('chunk', chunk, `chunk_${i}`);
      chunkForm.append('chunkIndex', i.toString());

      await apiClient.post(`/files/upload/${sessionId}/chunk`, chunkForm, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      uploadedChunks = [...uploadedChunks, i];
      if (options.onProgress) {
        options.onProgress(Math.round((uploadedChunks.length / totalChunks) * 100));
      }
    }

    const completeRes = await apiClient.post(`/files/upload/${sessionId}/complete`);
    const uploadedFile: FileItem = completeRes.data.file;
    await dbService.saveFile({ ...uploadedFile, sync_status: 'synced' });
    return uploadedFile;
  },

  getDownloadUrl(fileId: string): string {
    const token = localStorage.getItem('vaultdrive_token');
    return `${import.meta.env.VITE_API_URL || '/api'}/files/${fileId}/download?token=${token}`;
  },

  getInlineUrl(fileId: string): string {
    const token = localStorage.getItem('vaultdrive_token');
    return `${import.meta.env.VITE_API_URL || '/api'}/files/${fileId}/download?inline=true&token=${token}`;
  },

  async search(query: string, filters: { category?: string; extension?: string; folderId?: string } = {}): Promise<{ files: FileItem[]; folders: any[] }> {
    const isOnline = networkDetector.getStatus() === 'ONLINE';
    if (isOnline) {
      try {
        const params = new URLSearchParams({ q: query });
        if (filters.category) params.set('category', filters.category);
        if (filters.extension) params.set('extension', filters.extension);
        if (filters.folderId) params.set('folder_id', filters.folderId);
        const res = await apiClient.get(`/search?${params.toString()}`);
        return res.data.results;
      } catch { /* fallback */ }
    }

    // Offline search from local cache
    const q = query.toLowerCase();
    const allFiles = await dbService.getAllNonDeletedFiles();
    const allFolders = await dbService.getAllNonDeletedFolders();
    return {
      files: allFiles.filter(f =>
        (!q || f.name.toLowerCase().includes(q) || f.extension.toLowerCase().includes(q)) &&
        (!filters.category || f.category === filters.category)
      ),
      folders: allFolders.filter(f => !q || f.name.toLowerCase().includes(q))
    };
  }
};
