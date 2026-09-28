import { apiClient } from '../services/api.js';
import { dbService } from '../db/index.js';
import { networkDetector } from './networkDetector.js';
import { SyncQueueItem, ConflictItem } from '../types/index.js';

const DEVICE_ID_KEY = 'vaultdrive_device_id';
const LAST_SYNC_KEY = 'vaultdrive_last_sync';

type SyncStatusListener = (status: 'synced' | 'syncing' | 'error', conflicts?: ConflictItem[]) => void;

class SyncEngine {
  private listeners: Set<SyncStatusListener> = new Set();
  private isSyncing = false;
  private syncIntervalId: number | null = null;

  getDeviceId(): string {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  }

  getLastSyncTime(): string {
    return localStorage.getItem(LAST_SYNC_KEY) || '1970-01-01T00:00:00.000Z';
  }

  setLastSyncTime(time: string) {
    localStorage.setItem(LAST_SYNC_KEY, time);
  }

  subscribe(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(status: 'synced' | 'syncing' | 'error', conflicts?: ConflictItem[]) {
    this.listeners.forEach(fn => fn(status, conflicts));
  }

  start() {
    // Sync when coming back online
    networkDetector.subscribe(async (status) => {
      if (status === 'ONLINE') {
        await this.sync();
      }
    });

    // Periodic sync every 30 seconds
    if (this.syncIntervalId) clearInterval(this.syncIntervalId);
    this.syncIntervalId = window.setInterval(async () => {
      const status = networkDetector.getStatus();
      if (status === 'ONLINE') {
        await this.sync();
      }
    }, 30000);
  }

  stop() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  async sync(): Promise<{ conflicts: ConflictItem[] }> {
    if (this.isSyncing) return { conflicts: [] };
    const status = networkDetector.getStatus();
    if (status !== 'ONLINE') return { conflicts: [] };

    this.isSyncing = true;
    this.notify('syncing');

    const allConflicts: ConflictItem[] = [];

    try {
      // 1. PUSH queued offline mutations
      await this.pushSyncQueue(allConflicts);

      // 2. PUSH queued offline uploads
      await this.processPendingUploads();

      // 3. PULL incremental changes from server
      await this.pullChanges();

      this.setLastSyncTime(new Date().toISOString());
      this.notify(allConflicts.length > 0 ? 'synced' : 'synced', allConflicts);
    } catch (err) {
      console.error('[SyncEngine] Sync error:', err);
      this.notify('error');
    } finally {
      this.isSyncing = false;
    }

    return { conflicts: allConflicts };
  }

  private async pushSyncQueue(conflicts: ConflictItem[]) {
    const pendingOps = await dbService.getPendingSyncOps();
    if (pendingOps.length === 0) return;

    try {
      const res = await apiClient.post('/sync/push', {
        device_id: this.getDeviceId(),
        operations: pendingOps.map(op => ({
          id: op.id,
          operation_type: op.operation_type,
          entity_type: op.entity_type,
          entity_id: op.entity_id,
          payload: op.payload,
          version: op.version,
          client_timestamp: op.client_timestamp
        }))
      });

      // Remove successfully processed ops
      for (const result of res.data.results || []) {
        await dbService.removeSyncOp(
          pendingOps.find(op => op.entity_id === result.entity_id)?.id || ''
        );
      }

      // Collect conflicts
      for (const conflict of res.data.conflicts || []) {
        conflicts.push(conflict);
      }
    } catch (err) {
      console.warn('[SyncEngine] Failed to push sync queue:', err);
    }
  }

  private async processPendingUploads() {
    const uploads = await dbService.getPendingUploads();
    for (const upload of uploads) {
      if (upload.status === 'uploading') continue; // Already in progress
      try {
        await dbService.updateUpload({ ...upload, status: 'uploading', progress: 0 });

        const formData = new FormData();
        formData.append('file', upload.file, upload.filename);
        if (upload.folder_id) formData.append('folder_id', upload.folder_id);

        await apiClient.post('/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: async (e) => {
            if (e.total) {
              const pct = Math.round((e.loaded / e.total) * 100);
              await dbService.updateUpload({ ...upload, status: 'uploading', progress: pct });
            }
          }
        });

        await dbService.removeUpload(upload.id);
      } catch (err) {
        await dbService.updateUpload({ ...upload, status: 'error', error: 'Sync upload failed' });
      }
    }
  }

  private async pullChanges() {
    const since = this.getLastSyncTime();
    const res = await apiClient.get(`/sync/pull?since=${encodeURIComponent(since)}`);

    if (res.data.folders && res.data.folders.length > 0) {
      await dbService.bulkSaveFolders(res.data.folders);
    }
    if (res.data.files && res.data.files.length > 0) {
      await dbService.bulkSaveFiles(res.data.files);
    }
  }
}

export const syncEngine = new SyncEngine();
