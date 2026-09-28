import React, { useEffect, useState } from 'react';
import { WifiOff, Trash2, HardDrive, Download } from 'lucide-react';
import { useAppStore } from '../stores/appStore.js';
import { fileService } from '../services/fileService.js';
import { offlineStorageService } from '../services/offlineStorageService.js';
import { FileItem } from '../types/index.js';
import { formatBytes } from '../utils/formatters.js';
import { FileCard } from '../components/files/FileCard.js';
import { FilePreview } from '../components/files/FilePreview.js';
import { Button, EmptyState } from '../components/ui/index.js';

export const OfflineFilesPage: React.FC = () => {
  const { user } = useAppStore();
  const [offlineFiles, setOfflineFiles] = useState<FileItem[]>([]);
  const [offlineUsage, setOfflineUsage] = useState(0);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  const loadData = async () => {
    const files = await fileService.getOfflineFiles(user?.id);
    setOfflineFiles(files);
    const usage = await offlineStorageService.checkStorageQuota();
    setOfflineUsage(usage.offlineCacheUsage);
  };

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData();
    window.addEventListener('vaultdrive:refresh', handleRefresh);
    return () => window.removeEventListener('vaultdrive:refresh', handleRefresh);
  }, [user?.id]);

  const handleClearOfflineCache = async () => {
    if (confirm('Clear all offline cached copies from this device? (Server copies remain intact)')) {
      await offlineStorageService.clearAllOfflineCache();
      loadData();
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <WifiOff className="w-6 h-6 text-emerald-400" />
            Available Offline
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Files stored locally on this device. You can open, preview, and download these files without internet connection.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-slate-800/80 rounded-xl border border-slate-700/80 text-xs">
            <span className="text-slate-400">Offline Storage: </span>
            <span className="font-semibold text-emerald-400">{formatBytes(offlineUsage)}</span>
          </div>

          {offlineFiles.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Trash2 className="w-3.5 h-3.5 text-red-400" />}
              onClick={handleClearOfflineCache}
            >
              Clear Cache
            </Button>
          )}
        </div>
      </div>

      {offlineFiles.length === 0 ? (
        <EmptyState
          icon={<WifiOff className="w-12 h-12 text-slate-600" />}
          title="No offline files"
          description='Mark important files as "Available Offline" to download a local copy and access them even without internet.'
        />
      ) : (
        <div className="files-grid">
          {offlineFiles.map(file => (
            <FileCard
              key={file.id}
              file={file}
              onOpen={(f) => setPreviewFile(f)}
              onRefresh={loadData}
            />
          ))}
        </div>
      )}

      {previewFile && (
        <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </div>
  );
};
