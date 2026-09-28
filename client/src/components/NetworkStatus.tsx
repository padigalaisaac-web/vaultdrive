import React from 'react';
import { clsx } from 'clsx';
import { useAppStore } from '../stores/appStore.js';

const statusConfig = {
  ONLINE:             { label: 'Online',            color: 'text-emerald-400', dot: 'bg-emerald-400', pulse: false },
  OFFLINE:            { label: 'Offline',            color: 'text-slate-400',   dot: 'bg-slate-500',   pulse: false },
  SERVER_UNAVAILABLE: { label: 'Server unavailable', color: 'text-yellow-400',  dot: 'bg-yellow-400',  pulse: true },
  SYNCING:            { label: 'Syncing…',            color: 'text-brand-400',   dot: 'bg-brand-400',   pulse: true },
  SYNC_ERROR:         { label: 'Sync error',          color: 'text-red-400',     dot: 'bg-red-400',     pulse: false },
};

const syncStatusConfig = {
  synced:  { label: '✓ Synced',   color: 'text-emerald-400' },
  syncing: { label: '↻ Syncing…', color: 'text-brand-400' },
  error:   { label: '⚠ Sync error', color: 'text-red-400' },
  idle:    { label: '',            color: 'text-slate-500' },
};

export const NetworkStatusBadge: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { networkStatus, syncStatus } = useAppStore();
  const netCfg = statusConfig[networkStatus as keyof typeof statusConfig] || statusConfig.ONLINE;
  const syncCfg = syncStatusConfig[syncStatus as keyof typeof syncStatusConfig] || syncStatusConfig.idle;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', netCfg.dot, netCfg.pulse && 'animate-pulse')} />
        {syncStatus !== 'idle' && (
          <span className={clsx('text-xs font-medium', syncCfg.color)}>{syncCfg.label}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', netCfg.dot, netCfg.pulse && 'animate-pulse')} />
        <span className={clsx('text-xs font-medium', netCfg.color)}>{netCfg.label}</span>
      </div>
      {syncStatus !== 'idle' && (
        <span className={clsx('text-xs', syncCfg.color)}>{syncCfg.label}</span>
      )}
    </div>
  );
};
