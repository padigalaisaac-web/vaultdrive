import React from 'react';
import { useAppStore } from '../stores/appStore.js';
import { WifiOff } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const { networkStatus } = useAppStore();

  if (networkStatus === 'ONLINE' || networkStatus === 'SYNCING') return null;

  const isServerUnavailable = networkStatus === 'SERVER_UNAVAILABLE';

  return (
    <div className="bg-slate-700 border-b border-slate-600 px-4 py-2 flex items-center gap-2 text-sm animate-slide-in">
      <WifiOff className="w-4 h-4 text-slate-300 flex-shrink-0" />
      <p className="text-slate-200">
        {isServerUnavailable
          ? 'Server unavailable. Offline files are still accessible.'
          : "You're offline. Your offline files are still available. Changes will sync when you're back online."}
      </p>
    </div>
  );
};
