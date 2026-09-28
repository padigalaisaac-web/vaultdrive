import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, Pause, Play, CheckCircle2, AlertCircle, FileUp } from 'lucide-react';
import { clsx } from 'clsx';
import { fileService } from '../../services/fileService.js';
import { formatBytes } from '../../utils/formatters.js';
import { ProgressBar } from '../ui/index.js';

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'queued' | 'uploading' | 'paused' | 'done' | 'error' | 'duplicate';
  error?: string;
  isDuplicate?: boolean;
  existingFileId?: string;
  abortController?: AbortController;
}

interface UploadManagerProps {
  folderId?: string | null;
  onUploadsComplete?: () => void;
}

export const UploadManager: React.FC<UploadManagerProps> = ({ folderId, onUploadsComplete }) => {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateItem = useCallback((id: string, updates: Partial<UploadItem>) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...updates } : it));
  }, []);

  const startUpload = useCallback(async (item: UploadItem) => {
    updateItem(item.id, { status: 'uploading', progress: 0 });
    try {
      // Duplicate check first
      const dupCheck = await fileService.checkDuplicate(item.file);
      if (dupCheck.duplicate) {
        updateItem(item.id, { status: 'duplicate', isDuplicate: true, existingFileId: dupCheck.existingFile?.id });
        return;
      }

      await fileService.uploadFile(item.file, {
        folderId: folderId || null,
        onProgress: (pct) => updateItem(item.id, { progress: pct })
      });

      updateItem(item.id, { status: 'done', progress: 100 });

      // If all done, fire callback
      setItems(prev => {
        const allDone = prev.every(it => it.status === 'done' || it.status === 'error' || it.status === 'duplicate');
        if (allDone) onUploadsComplete?.();
        return prev;
      });
    } catch (err: any) {
      if (err.message === 'OFFLINE_QUEUED') {
        updateItem(item.id, { status: 'queued', error: 'Queued for upload when online' });
      } else {
        updateItem(item.id, { status: 'error', error: err.message || 'Upload failed' });
      }
    }
  }, [folderId, onUploadsComplete, updateItem]);

  const addFiles = useCallback(async (files: File[]) => {
    const newItems: UploadItem[] = files.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      progress: 0,
      status: 'queued'
    }));
    setItems(prev => [...prev, ...newItems]);
    setIsVisible(true);

    for (const item of newItems) {
      await startUpload(item);
    }
  }, [startUpload]);

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(it => it.id !== id));
  };

  const retryItem = async (item: UploadItem) => {
    await startUpload({ ...item, status: 'queued', progress: 0, error: undefined });
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) addFiles(files);
    e.target.value = '';
  };

  const activeCount = items.filter(it => it.status === 'uploading').length;
  const doneCount = items.filter(it => it.status === 'done').length;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInput}
        aria-label="Upload files"
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        className="btn-primary"
        title="Upload files"
      >
        <Upload className="w-4 h-4" />
        <span>Upload</span>
      </button>

      {isVisible && items.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40 w-80 card shadow-xl animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <FileUp className="w-4 h-4 text-brand-400" />
              <span className="text-sm font-medium text-slate-200">
                {activeCount > 0 ? `Uploading ${activeCount} file(s)…` : `${doneCount}/${items.length} done`}
              </span>
            </div>
            <button
              onClick={() => { setIsVisible(false); setItems([]); }}
              className="text-slate-500 hover:text-slate-300 transition-colors"
              aria-label="Close upload panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-700">
            {items.map(item => (
              <div key={item.id} className="px-4 py-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate" title={item.file.name}>
                      {item.file.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{formatBytes(item.file.size)}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {item.status === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    {item.status === 'error' && (
                      <button onClick={() => retryItem(item)} title="Retry">
                        <AlertCircle className="w-4 h-4 text-red-400 hover:text-red-300" />
                      </button>
                    )}
                    {item.status !== 'done' && (
                      <button onClick={() => removeItem(item.id)} className="text-slate-500 hover:text-slate-300">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {(item.status === 'uploading') && (
                  <div className="mt-2">
                    <ProgressBar value={item.progress} />
                    <p className="text-xs text-slate-500 mt-1 text-right">{item.progress}%</p>
                  </div>
                )}

                {item.status === 'duplicate' && (
                  <p className="text-xs text-yellow-400 mt-1">⚠ Duplicate — file already exists</p>
                )}

                {item.status === 'error' && (
                  <p className="text-xs text-red-400 mt-1">{item.error || 'Upload failed'}</p>
                )}

                {item.status === 'queued' && item.error && (
                  <p className="text-xs text-slate-400 mt-1">{item.error}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

// Export addFiles function reference for external use
export const createUploadTrigger = (addFilesFn: (files: File[]) => void) => addFilesFn;
