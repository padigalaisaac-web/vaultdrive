import { apiClient } from './api.js';
import { User } from '../types/index.js';

export const authService = {
  async register(data: { email: string; password: string; name: string }): Promise<{ token: string; user: User }> {
    const res = await apiClient.post('/auth/register', data);
    if (res.data.token) {
      localStorage.setItem('vaultdrive_token', res.data.token);
      localStorage.setItem('vaultdrive_user', JSON.stringify(res.data.user));
    }
    return res.data;
  },

  async login(data: { email: string; password: string }): Promise<{ token: string; user: User }> {
    const res = await apiClient.post('/auth/login', data);
    if (res.data.token) {
      localStorage.setItem('vaultdrive_token', res.data.token);
      localStorage.setItem('vaultdrive_user', JSON.stringify(res.data.user));
    }
    return res.data;
  },

  async getMe(): Promise<User> {
    const res = await apiClient.get('/auth/me');
    if (res.data.user) {
      localStorage.setItem('vaultdrive_user', JSON.stringify(res.data.user));
    }
    return res.data.user;
  },

  async updateProfile(data: { name: string }): Promise<User> {
    const res = await apiClient.patch('/auth/profile', data);
    if (res.data.user) {
      const current = JSON.parse(localStorage.getItem('vaultdrive_user') || '{}');
      localStorage.setItem('vaultdrive_user', JSON.stringify({ ...current, ...res.data.user }));
    }
    return res.data.user;
  },

  async changePassword(data: { currentPassword: string; newPassword: string }): Promise<void> {
    await apiClient.post('/auth/change-password', data);
  },

  logout(): void {
    localStorage.removeItem('vaultdrive_token');
    localStorage.removeItem('vaultdrive_user');
  },

  getStoredUser(): User | null {
    try {
      const raw = localStorage.getItem('vaultdrive_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  isAuthenticated(): boolean {
    return Boolean(localStorage.getItem('vaultdrive_token'));
  }
};
