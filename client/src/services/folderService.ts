import { apiClient } from './api.js';
import { dbService } from '../db/index.js';
import { Folder } from '../types/index.js';
import { networkDetector } from '../sync/networkDetector.js';

export const folderService = {
  async getFolders(userId?: string, parentId: string | null = null): Promise<Folder[]> {
    const isOnline = networkDetector.getStatus() === 'ONLINE';

    if (isOnline) {
      try {
        const query = parentId !== undefined ? `?parent_id=${parentId || 'null'}` : '';
        const res = await apiClient.get(`/folders${query}`);
        if (res.data.folders) {
          await dbService.bulkSaveFolders(res.data.folders);
          return res.data.folders;
        }
      } catch (e) {
        console.warn('Network request failed, falling back to local DB:', e);
      }
    }

    // Offline / fallback query from Dexie
    return dbService.getFolders(userId, parentId);
  },

  async getAllFolders(userId?: string): Promise<Folder[]> {
    const isOnline = networkDetector.getStatus() === 'ONLINE';

    if (isOnline) {
      try {
        const res = await apiClient.get('/folders');
        if (res.data.folders) {
          await dbService.bulkSaveFolders(res.data.folders);
          return res.data.folders;
        }
      } catch (e) {
        // Fallback to local
      }
    }

    return dbService.getAllNonDeletedFolders(userId);
  },

  async createFolder(name: string, parentId: string | null = null, color: string = '#0c8ee9', userId: string = 'local'): Promise<Folder> {
    const isOnline = networkDetector.getStatus() === 'ONLINE';
    const folderId = crypto.randomUUID();

    const localFolder: Folder = {
      id: folderId,
      user_id: userId,
      parent_id: parentId,
      name,
      color,
      is_favorite: false,
      is_deleted: false,
      deleted_at: null,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: isOnline ? 'synced' : 'pending'
    };

    // Always save to IndexedDB immediately so UI renders instantly!
    await dbService.saveFolder(localFolder);

    if (isOnline) {
      try {
        const res = await apiClient.post('/folders', {
          name,
          parent_id: parentId,
          color
        });
        if (res.data.folder) {
          await dbService.saveFolder({ ...res.data.folder, sync_status: 'synced' });
          return res.data.folder;
        }
      } catch (e) {
        console.warn('Could not reach server to create folder, queued for sync:', e);
      }
    }

    // Enqueue offline sync operation
    await dbService.enqueueSyncOp({
      id: crypto.randomUUID(),
      operation_type: 'create_folder',
      entity_type: 'folder',
      entity_id: folderId,
      payload: { name, parent_id: parentId, color },
      version: 1,
      client_timestamp: new Date().toISOString()
    });

    return localFolder;
  },

  async updateFolder(id: string, updates: Partial<Folder>): Promise<void> {
    const isOnline = networkDetector.getStatus() === 'ONLINE';

    const existing = (await dbService.getAllNonDeletedFolders()).find(f => f.id === id);
    if (existing) {
      const updated: Folder = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
        version: (existing.version || 1) + 1,
        sync_status: isOnline ? 'synced' : 'pending'
      };
      await dbService.saveFolder(updated);
    }

    if (isOnline) {
      try {
        await apiClient.patch(`/folders/${id}`, updates);
        return;
      } catch (e) {
        console.warn('Failed to update folder on server, queued:', e);
      }
    }

    await dbService.enqueueSyncOp({
      id: crypto.randomUUID(),
      operation_type: 'update_folder',
      entity_type: 'folder',
      entity_id: id,
      payload: updates,
      version: (existing?.version || 1) + 1,
      client_timestamp: new Date().toISOString()
    });
  },

  async deleteFolder(id: string): Promise<void> {
    const isOnline = networkDetector.getStatus() === 'ONLINE';

    const existing = (await dbService.getAllNonDeletedFolders()).find(f => f.id === id);
    if (existing) {
      const updated: Folder = {
        ...existing,
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        sync_status: isOnline ? 'synced' : 'pending'
      };
      await dbService.saveFolder(updated);
    }

    if (isOnline) {
      try {
        await apiClient.delete(`/folders/${id}`);
        return;
      } catch (e) {
        console.warn('Failed to delete folder on server, queued:', e);
      }
    }

    await dbService.enqueueSyncOp({
      id: crypto.randomUUID(),
      operation_type: 'delete_folder',
      entity_type: 'folder',
      entity_id: id,
      payload: {},
      version: (existing?.version || 1) + 1,
      client_timestamp: new Date().toISOString()
    });
  },

  async getBreadcrumbs(folderId: string | null): Promise<{ id: string; name: string }[]> {
    if (!folderId) return [];

    const isOnline = networkDetector.getStatus() === 'ONLINE';
    if (isOnline) {
      try {
        const res = await apiClient.get(`/folders/${folderId}/breadcrumbs`);
        if (res.data.breadcrumbs) {
          return res.data.breadcrumbs;
        }
      } catch {
        // Fallback to local
      }
    }

    // Local recursive resolution
    const breadcrumbs: { id: string; name: string }[] = [];
    const allFolders = await dbService.getAllNonDeletedFolders();
    const folderMap = new Map(allFolders.map(f => [f.id, f]));

    let currId: string | null = folderId;
    let depth = 0;
    while (currId && depth < 20) {
      const f = folderMap.get(currId);
      if (!f) break;
      breadcrumbs.unshift({ id: f.id, name: f.name });
      currId = f.parent_id;
      depth++;
    }

    return breadcrumbs;
  }
};
