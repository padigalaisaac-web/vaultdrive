import axios, { AxiosError, AxiosResponse } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to attach JWT
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('vaultdrive_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to gracefully handle offline/network errors
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (!error.response) {
      // Network error or offline
      return Promise.reject({
        offline: true,
        message: 'Network request failed. Operating in offline mode.',
        originalError: error
      });
    }

    if (error.response.status === 401) {
      // If unauthorized and token was set, clear token
      const token = localStorage.getItem('vaultdrive_token');
      if (token && !window.location.pathname.startsWith('/share/')) {
        localStorage.removeItem('vaultdrive_token');
        localStorage.removeItem('vaultdrive_user');
      }
    }

    return Promise.reject(error.response.data || { message: error.message });
  }
);
