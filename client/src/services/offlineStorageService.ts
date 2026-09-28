import { apiClient } from './api.js';
import { dbService } from '../db/index.js';
import { FileItem, OfflineFile } from '../types/index.js';
import { calculateFileHash } from '../utils/hash.js';

export interface StorageEstimateResult {
  quota: number;
  usage: number;
  available: number;
  usagePercent: number;
  offlineCacheUsage: number;
}

export const offlineStorageService = {
  /**
   * Retrieves estimated browser/device storage via Storage API
   */
  async checkStorageQuota(): Promise<StorageEstimateResult> {
    let quota = 10 * 1024 * 1024 * 1024; // 10GB default fallback
    let usage = 0;

    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        quota = estimate.quota || quota;
        usage = estimate.usage || usage;
      } catch (e) {
        console.warn('Storage estimate API error:', e);
      }
    }

    const offlineCacheUsage = await dbService.getOfflineStorageUsage();
    const available = Math.max(0, quota - usage);
    const usagePercent = quota > 0 ? Math.min(100, Math.round((usage / quota) * 100)) : 0;

    return {
      quota,
      usage,
      available,
      usagePercent,
      offlineCacheUsage
    };
  },

  /**
   * Downloads and saves a file locally to IndexedDB for offline access
   */
  async makeAvailableOffline(file: FileItem, onProgress?: (pct: number) => void): Promise<void> {
    // Check available device storage before download
    const quotaInfo = await this.checkStorageQuota();
    if (quotaInfo.available < file.size) {
      throw new Error(
        'Not enough offline storage on your device. Free some offline storage and try again.'
      );
    }

    // Download file Blob from server
    const response = await apiClient.get(`/files/${file.id}/download`, {
      responseType: 'blob',
      onDownloadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(pct);
        }
      }
    });

    const blob = response.data as Blob;
    const checksum = await calculateFileHash(blob);

    const offlineRecord: OfflineFile = {
      fileId: file.id,
      name: file.name,
      mimeType: file.mime_type || blob.type || 'application/octet-stream',
      size: file.size || blob.size,
      blob,
      checksum,
      downloadedAt: new Date().toISOString(),
      category: file.category,
      extension: file.extension
    };

    // Save Blob in IndexedDB offlineFiles
    await dbService.saveOfflineBlob(offlineRecord);

    // Update file record in Dexie files table
    await dbService.saveFile({
      ...file,
      is_offline: true,
      updated_at: new Date().toISOString()
    });

    // Notify backend of offline availability flag
    try {
      await apiClient.patch(`/files/${file.id}`, { is_offline: true });
    } catch {
      // Ignored if offline
    }
  },

  /**
   * Removes offline copy from IndexedDB
   */
  async removeOffline(fileId: string): Promise<void> {
    await dbService.deleteOfflineBlob(fileId);

    const all = await dbService.getAllNonDeletedFiles();
    const file = all.find(f => f.id === fileId);
    if (file) {
      await dbService.saveFile({
        ...file,
        is_offline: false,
        updated_at: new Date().toISOString()
      });
    }

    try {
      await apiClient.patch(`/files/${fileId}`, { is_offline: false });
    } catch {
      // Ignored if offline
    }
  },

  /**
   * Retrieves offline file Blob
   */
  async getOfflineBlob(fileId: string): Promise<OfflineFile | undefined> {
    return dbService.getOfflineBlob(fileId);
  },

  /**
   * Clears entire offline file cache
   */
  async clearAllOfflineCache(): Promise<void> {
    await dbService.clearOfflineStorage();
    const all = await dbService.getAllNonDeletedFiles();
    for (const f of all) {
      if (f.is_offline) {
        await dbService.saveFile({ ...f, is_offline: false });
      }
    }
  }
};
