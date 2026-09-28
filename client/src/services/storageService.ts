import { apiClient } from './api.js';

export const storageService = {
  async getStats() {
    const res = await apiClient.get('/storage/stats');
    return res.data.stats;
  }
};

export const trashService = {
  async listTrash() {
    const res = await apiClient.get('/trash');
    return res.data.trash;
  },
  async restoreItem(id: string, type: 'file' | 'folder') {
    const res = await apiClient.post(`/trash/${id}/restore?type=${type}`);
    return res.data;
  },
  async permanentlyDelete(id: string, type: 'file' | 'folder') {
    const res = await apiClient.delete(`/trash/${id}?type=${type}`);
    return res.data;
  },
  async emptyTrash() {
    const res = await apiClient.post('/trash/empty');
    return res.data;
  }
};

export const shareService = {
  async listShares() {
    const res = await apiClient.get('/shares');
    return res.data.shares;
  },
  async createShare(data: {
    file_id?: string | null;
    folder_id?: string | null;
    password?: string;
    expires_in_days?: number | null;
    allow_download?: boolean;
  }) {
    const res = await apiClient.post('/shares', data);
    return res.data.share;
  },
  async deleteShare(id: string) {
    const res = await apiClient.delete(`/shares/${id}`);
    return res.data;
  },
  async getPublicShare(token: string, password?: string) {
    const headers: Record<string, string> = {};
    if (password) headers['x-share-password'] = password;
    const res = await apiClient.get(`/shares/public/${token}`, { headers });
    return res.data.share;
  },
  getPublicDownloadUrl(token: string): string {
    return `${import.meta.env.VITE_API_URL || '/api'}/shares/public/${token}/download`;
  }
};
