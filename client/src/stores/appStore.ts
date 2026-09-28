import { create } from 'zustand';
import { User, NetworkStatus, ConflictItem } from '../types/index.js';
import { authService } from '../services/authService.js';
import { syncEngine } from '../sync/syncEngine.js';
import { networkDetector } from '../sync/networkDetector.js';

interface AppState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  authError: string | null;

  // Network & Sync
  networkStatus: NetworkStatus;
  syncStatus: 'synced' | 'syncing' | 'error' | 'idle';
  pendingConflicts: ConflictItem[];

  // UI state
  theme: 'dark' | 'light' | 'system';
  sidebarOpen: boolean;
  isMobile: boolean;
  hasCompletedOnboarding: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setNetworkStatus: (status: NetworkStatus) => void;
  setSyncStatus: (status: 'synced' | 'syncing' | 'error' | 'idle') => void;
  setConflicts: (conflicts: ConflictItem[]) => void;
  resolveConflict: (entityId: string) => void;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setIsMobile: (mobile: boolean) => void;
  completeOnboarding: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  initAuth: () => Promise<void>;
  triggerSync: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoadingAuth: true,
  authError: null,
  networkStatus: 'ONLINE',
  syncStatus: 'idle',
  pendingConflicts: [],
  theme: (localStorage.getItem('vaultdrive_theme') as any) || 'dark',
  sidebarOpen: true,
  isMobile: window.innerWidth < 768,
  hasCompletedOnboarding: localStorage.getItem('vaultdrive_onboarding') === 'true',

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setNetworkStatus: (networkStatus) => set({ networkStatus }),
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  setConflicts: (pendingConflicts) => set({ pendingConflicts }),
  resolveConflict: (entityId) =>
    set(state => ({
      pendingConflicts: state.pendingConflicts.filter(c => c.entity_id !== entityId)
    })),
  setTheme: (theme) => {
    localStorage.setItem('vaultdrive_theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches));
    set({ theme });
  },
  toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setIsMobile: (isMobile) => set({ isMobile }),
  completeOnboarding: () => {
    localStorage.setItem('vaultdrive_onboarding', 'true');
    set({ hasCompletedOnboarding: true });
  },

  login: async (email, password) => {
    set({ isLoadingAuth: true, authError: null });
    try {
      const { user } = await authService.login({ email, password });
      set({ user, isAuthenticated: true, isLoadingAuth: false });
      get().triggerSync();
    } catch (err: any) {
      set({ authError: err.message || 'Login failed', isLoadingAuth: false });
      throw err;
    }
  },

  register: async (name, email, password) => {
    set({ isLoadingAuth: true, authError: null });
    try {
      const { user } = await authService.register({ name, email, password });
      set({ user, isAuthenticated: true, isLoadingAuth: false });
    } catch (err: any) {
      set({ authError: err.message || 'Registration failed', isLoadingAuth: false });
      throw err;
    }
  },

  logout: () => {
    authService.logout();
    syncEngine.stop();
    set({ user: null, isAuthenticated: false, syncStatus: 'idle' });
  },

  initAuth: async () => {
    set({ isLoadingAuth: true });
    const storedUser = authService.getStoredUser();
    if (storedUser && authService.isAuthenticated()) {
      set({ user: storedUser, isAuthenticated: true });
      try {
        const freshUser = await authService.getMe();
        set({ user: freshUser });
      } catch {
        // Use stored user if server unreachable (offline)
      }

      // Boot sync engine
      syncEngine.start();
      syncEngine.subscribe((status, conflicts) => {
        set({ syncStatus: status });
        if (conflicts && conflicts.length > 0) {
          set({ pendingConflicts: conflicts });
        }
      });

      // Network status listener
      networkDetector.subscribe((status) => {
        set({ networkStatus: status });
      });
    }
    set({ isLoadingAuth: false });
  },

  triggerSync: async () => {
    const status = get().networkStatus;
    if (status !== 'ONLINE') return;
    set({ syncStatus: 'syncing' });
    try {
      const result = await syncEngine.sync();
      set({ syncStatus: 'synced', pendingConflicts: result.conflicts });
    } catch {
      set({ syncStatus: 'error' });
    }
  }
}));
