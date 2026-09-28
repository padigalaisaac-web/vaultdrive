import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  HardDrive,
  Clock,
  Star,
  WifiOff,
  Trash2,
  Share2,
  Settings,
  RefreshCw,
  X
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAppStore } from '../../stores/appStore.js';
import { storageService } from '../../services/storageService.js';
import { offlineStorageService } from '../../services/offlineStorageService.js';
import { formatBytes } from '../../utils/formatters.js';
import { ProgressBar } from '../ui/index.js';
import { NetworkStatusBadge } from '../NetworkStatus.js';

export const Sidebar: React.FC = () => {
  const { user, sidebarOpen, toggleSidebar, isMobile, triggerSync, syncStatus } = useAppStore();
  const [usedStorage, setUsedStorage] = useState(user?.used_storage || 0);
  const [quotaStorage, setQuotaStorage] = useState(user?.storage_quota || 10737418240);
  const [offlineUsage, setOfflineUsage] = useState(0);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const stats = await storageService.getStats();
        if (stats) {
          setUsedStorage(stats.used);
          setQuotaStorage(stats.total);
        }
      } catch {
        // Fallback
      }
      const offUsage = await offlineStorageService.checkStorageQuota();
      setOfflineUsage(offUsage.offlineCacheUsage);
    };

    loadStats();
    const interval = setInterval(loadStats, 20000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { to: '/files', icon: HardDrive, label: 'My Files' },
    { to: '/recent', icon: Clock, label: 'Recent' },
    { to: '/favorites', icon: Star, label: 'Favorites' },
    { to: '/offline', icon: WifiOff, label: 'Available Offline', highlight: true },
    { to: '/shared', icon: Share2, label: 'Shared' },
    { to: '/trash', icon: Trash2, label: 'Trash' },
    { to: '/settings', icon: Settings, label: 'Settings' }
  ];

  if (isMobile && !sidebarOpen) return null;

  return (
    <>
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={clsx(
          'w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen flex-shrink-0 z-50 transition-all select-none',
          isMobile ? 'fixed inset-y-0 left-0 shadow-2xl' : 'sticky top-0'
        )}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-sky-400 flex items-center justify-center shadow-md shadow-brand-500/20">
              <img src="/favicon.svg" alt="VaultDrive Logo" className="w-5 h-5 invert" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white block">
                VaultDrive
              </span>
              <span className="text-[10px] text-brand-400 font-semibold tracking-wider uppercase block">
                Offline-First
              </span>
            </div>
          </div>
          {isMobile && (
            <button onClick={toggleSidebar} className="p-1 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, highlight }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => isMobile && toggleSidebar()}
              className={({ isActive }) =>
                clsx(
                  'sidebar-item',
                  isActive && 'sidebar-item-active text-brand-400 bg-slate-800/80 border-r-2 border-brand-500',
                  highlight && 'text-emerald-400 hover:text-emerald-300'
                )
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 truncate">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Storage Usage Widget */}
        <div className="p-4 mx-3 mb-3 bg-slate-800/60 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-medium">
            <span>Storage</span>
            <span className="text-slate-200">
              {formatBytes(usedStorage)} / {formatBytes(quotaStorage)}
            </span>
          </div>
          <ProgressBar value={usedStorage} max={quotaStorage} color="bg-brand-500" />
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
            <span>Offline Cache</span>
            <span className="text-emerald-400">{formatBytes(offlineUsage)}</span>
          </div>
        </div>

        {/* Footer / Sync status */}
        <div className="p-3 px-4 border-t border-slate-800 flex items-center justify-between text-xs">
          <NetworkStatusBadge compact />
          <button
            onClick={() => triggerSync()}
            disabled={syncStatus === 'syncing'}
            className="p-1.5 text-slate-400 hover:text-brand-400 hover:bg-slate-800 rounded-lg transition-colors"
            title="Trigger Sync"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', syncStatus === 'syncing' && 'animate-spin text-brand-400')} />
          </button>
        </div>
      </aside>
    </>
  );
};
