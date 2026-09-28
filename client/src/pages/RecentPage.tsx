import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { useAppStore } from '../stores/appStore.js';
import { fileService } from '../services/fileService.js';
import { FileItem } from '../types/index.js';
import { FileCard } from '../components/files/FileCard.js';
import { FilePreview } from '../components/files/FilePreview.js';
import { EmptyState } from '../components/ui/index.js';

export const RecentPage: React.FC = () => {
  const { user } = useAppStore();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  const loadData = async () => {
    const all = await fileService.getAllFiles(user?.id);
    const sorted = [...all].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    setFiles(sorted);
  };

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData();
    window.addEventListener('vaultdrive:refresh', handleRefresh);
    return () => window.removeEventListener('vaultdrive:refresh', handleRefresh);
  }, [user?.id]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2.5">
          <Clock className="w-6 h-6 text-brand-400" />
          Recent Files
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Files you have uploaded or modified recently.
        </p>
      </div>

      {files.length === 0 ? (
        <EmptyState
          icon={<Clock className="w-12 h-12 text-slate-600" />}
          title="No recent files"
          description="Uploaded files will appear here ordered by modification date."
        />
      ) : (
        <div className="files-grid">
          {files.map(file => (
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
