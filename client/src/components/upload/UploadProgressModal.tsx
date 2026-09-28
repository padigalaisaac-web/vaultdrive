import React from 'react';
import { FileUp, X, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { useUploadStore } from '../../stores/uploadStore.js';
import { formatBytes } from '../../utils/formatters.js';
import { ProgressBar } from '../ui/index.js';

export const UploadProgressModal: React.FC = () => {
  const { items, isOpen, removeItem, clearAll, setIsOpen } = useUploadStore();

  if (!isOpen || items.length === 0) return null;

  const activeCount = items.filter((i) => i.status === 'uploading').length;
  const doneCount = items.filter((i) => i.status === 'done').length;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 w-80 sm:w-96 card bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl animate-fade-in overflow-hidden"
      role="region"
      aria-label="Upload progress"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/95 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <FileUp className="w-4 h-4 text-brand-400" />
          <span className="text-xs sm:text-sm font-semibold text-slate-200">
            {activeCount > 0
              ? `Uploading ${activeCount} file(s)…`
              : `${doneCount}/${items.length} completed`}
          </span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          title="Minimize / Close"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Item list */}
      <div className="max-h-64 overflow-y-auto divide-y divide-slate-800 p-1">
        {items.map((item) => (
          <div key={item.id} className="p-3 hover:bg-slate-800/50 rounded-xl transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate" title={item.name}>
                  {item.name}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">{formatBytes(item.size)}</p>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {item.status === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {item.status === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
                <button
                  onClick={() => removeItem(item.id)}
                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                  title="Remove item"
                  aria-label="Remove item"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {item.status === 'uploading' && (
              <div className="mt-2">
                <ProgressBar value={item.progress} />
                <p className="text-[10px] text-slate-400 mt-1 text-right">{item.progress}%</p>
              </div>
            )}

            {item.status === 'duplicate' && (
              <p className="text-[11px] text-amber-400 mt-1">⚠ Duplicate — file already exists</p>
            )}

            {item.status === 'error' && (
              <p className="text-[11px] text-red-400 mt-1">{item.error || 'Upload failed'}</p>
            )}

            {item.status === 'queued' && (
              <p className="text-[11px] text-slate-400 mt-1">{item.error || 'Queued'}</p>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 bg-slate-800/80 border-t border-slate-700 flex justify-between items-center text-xs">
        <span className="text-slate-400">{items.length} total items</span>
        <button
          onClick={clearAll}
          className="text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-slate-700 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear All
        </button>
      </div>
    </div>
  );
};
