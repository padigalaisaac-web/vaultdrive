import React, { useEffect, useState } from 'react';
import {
  User as UserIcon,
  HardDrive,
  RefreshCw,
  Shield,
  Palette,
  Trash2,
  Check,
  AlertCircle
} from 'lucide-react';
import { useAppStore } from '../stores/appStore.js';
import { authService } from '../services/authService.js';
import { storageService } from '../services/storageService.js';
import { offlineStorageService } from '../services/offlineStorageService.js';
import { formatBytes } from '../utils/formatters.js';
import { Button, Input, ProgressBar } from '../components/ui/index.js';

export const SettingsPage: React.FC = () => {
  const { user, theme, setTheme, triggerSync, syncStatus } = useAppStore();

  // Profile Form
  const [name, setName] = useState(user?.name || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Password Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Storage state
  const [storageUsed, setStorageUsed] = useState(user?.used_storage || 0);
  const [storageQuota, setStorageQuota] = useState(user?.storage_quota || 10737418240);
  const [offlineCacheSize, setOfflineCacheSize] = useState(0);

  // Sync settings
  const [autoSync, setAutoSync] = useState(true);
  const [wifiOnly, setWifiOnly] = useState(false);
  const [syncInterval, setSyncInterval] = useState('30');

  useEffect(() => {
    const loadStats = async () => {
      try {
        const s = await storageService.getStats();
        if (s) {
          setStorageUsed(s.used);
          setStorageQuota(s.total);
        }
      } catch {
        // Fallback
      }
      const quota = await offlineStorageService.checkStorageQuota();
      setOfflineCacheSize(quota.offlineCacheUsage);
    };

    loadStats();
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsUpdatingProfile(true);
    setProfileSuccess(false);
    try {
      await authService.updateProfile({ name: name.trim() });
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch {
      // Ignored
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    setIsChangingPassword(true);
    setPasswordSuccess(false);
    setPasswordError(null);
    try {
      await authService.changePassword({ currentPassword, newPassword });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleClearCache = async () => {
    if (confirm('Clear all offline cached copies from this device?')) {
      await offlineStorageService.clearAllOfflineCache();
      setOfflineCacheSize(0);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-fade-in pb-12">
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Settings</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Manage your account, device offline storage, synchronization rules, and appearance.
        </p>
      </div>

      {/* 1. Account Settings */}
      <section className="card p-6 border-slate-800">
        <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2 mb-4">
          <UserIcon className="w-5 h-5 text-brand-400" />
          Account Profile
        </h2>

        <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-md">
          <Input
            label="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div>
            <label className="label">Email Address</label>
            <input
              type="email"
              disabled
              value={user?.email || ''}
              className="input bg-slate-800/50 text-slate-400 cursor-not-allowed border-slate-700"
            />
            <p className="text-[11px] text-slate-500 mt-1">Email address cannot be changed.</p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button variant="primary" type="submit" loading={isUpdatingProfile}>
              Save Profile
            </Button>
            {profileSuccess && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <Check className="w-4 h-4" /> Updated successfully
              </span>
            )}
          </div>
        </form>
      </section>

      {/* 2. Storage & Offline Device Storage */}
      <section className="card p-6 border-slate-800">
        <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2 mb-4">
          <HardDrive className="w-5 h-5 text-brand-400" />
          Storage & Offline Cache
        </h2>

        <div className="space-y-4">
          <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-slate-300 font-medium">Cloud Quota Usage</span>
              <span className="text-slate-100 font-bold">
                {formatBytes(storageUsed)} / {formatBytes(storageQuota)}
              </span>
            </div>
            <ProgressBar value={storageUsed} max={storageQuota} color="bg-brand-500" />
            <p className="text-xs text-slate-500 mt-2">
              Total files and folders stored on your server account.
            </p>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-900 rounded-xl border border-slate-800">
            <div>
              <p className="text-sm font-medium text-slate-200">Device Offline Cache</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Local storage used for files marked "Available Offline" ({formatBytes(offlineCacheSize)})
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={<Trash2 className="w-3.5 h-3.5 text-red-400" />}
              onClick={handleClearCache}
              disabled={offlineCacheSize === 0}
            >
              Clear Cache
            </Button>
          </div>
        </div>
      </section>

      {/* 3. Synchronization Rules */}
      <section className="card p-6 border-slate-800">
        <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2 mb-4">
          <RefreshCw className="w-5 h-5 text-brand-400" />
          Synchronization
        </h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-200">Automatic Sync</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically synchronize local changes when connected to the internet.
              </p>
            </div>
            <input
              type="checkbox"
              checked={autoSync}
              onChange={(e) => setAutoSync(e.target.checked)}
              className="rounded bg-slate-700 border-slate-600 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-200">Wi-Fi Only Sync</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Pause file synchronization on metered or cellular data connections.
              </p>
            </div>
            <input
              type="checkbox"
              checked={wifiOnly}
              onChange={(e) => setWifiOnly(e.target.checked)}
              className="rounded bg-slate-700 border-slate-600 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-200">Sync Interval</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Background synchronization frequency.
              </p>
            </div>
            <select
              value={syncInterval}
              onChange={(e) => setSyncInterval(e.target.value)}
              className="input w-40 text-xs"
            >
              <option value="15">Every 15 seconds</option>
              <option value="30">Every 30 seconds</option>
              <option value="60">Every 1 minute</option>
              <option value="300">Every 5 minutes</option>
            </select>
          </div>

          <div className="pt-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />}
              onClick={() => triggerSync()}
              disabled={syncStatus === 'syncing'}
            >
              {syncStatus === 'syncing' ? 'Syncing Now…' : 'Sync Now'}
            </Button>
          </div>
        </div>
      </section>

      {/* 4. Security & Password */}
      <section className="card p-6 border-slate-800">
        <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-brand-400" />
          Security
        </h2>

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          {passwordError && (
            <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />

          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <div className="flex items-center gap-3 pt-2">
            <Button variant="primary" type="submit" loading={isChangingPassword}>
              Update Password
            </Button>
            {passwordSuccess && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <Check className="w-4 h-4" /> Password changed
              </span>
            )}
          </div>
        </form>
      </section>

      {/* 5. Appearance */}
      <section className="card p-6 border-slate-800">
        <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2 mb-4">
          <Palette className="w-5 h-5 text-brand-400" />
          Appearance
        </h2>

        <div className="grid grid-cols-3 gap-3 max-w-md">
          {(['dark', 'light', 'system'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`p-3 rounded-xl border text-center capitalize text-xs font-medium transition-all ${
                theme === t
                  ? 'border-brand-500 bg-brand-950/30 text-brand-400 ring-1 ring-brand-500'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
              }`}
            >
              {t} Mode
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
