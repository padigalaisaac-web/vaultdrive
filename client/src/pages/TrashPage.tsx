import React, { useEffect, useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle, Folder as FolderIcon } from 'lucide-react';
import { trashService } from '../services/storageService.js';
import { FileItem, Folder } from '../types/index.js';
import { formatBytes, formatRelativeTime, truncateString } from '../utils/formatters.js';
import { FileIcon } from '../components/FileIcon.js';
import { Button, EmptyState } from '../components/ui/index.js';

export const TrashPage: React.FC = () => {
  const [trashFiles, setTrashFiles] = useState<FileItem[]>([]);
  const [trashFolders, setTrashFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await trashService.listTrash();
      if (data) {
        setTrashFiles(data.files || []);
        setTrashFolders(data.folders || []);
      }
    } catch {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRestore = async (id: string, type: 'file' | 'folder') => {
    await trashService.restoreItem(id, type);
    loadData();
    window.dispatchEvent(new CustomEvent('vaultdrive:refresh'));
  };

  const handlePermanentDelete = async (id: string, type: 'file' | 'folder', name: string) => {
    if (confirm(`Permanently delete "${name}"? This action cannot be undone.`)) {
      await trashService.permanentlyDelete(id, type);
      loadData();
      window.dispatchEvent(new CustomEvent('vaultdrive:refresh'));
    }
  };

  const handleEmptyTrash = async () => {
    if (confirm('Permanently delete all items in trash? This cannot be undone.')) {
      await trashService.emptyTrash();
      loadData();
      window.dispatchEvent(new CustomEvent('vaultdrive:refresh'));
    }
  };

  const totalItems = trashFiles.length + trashFolders.length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <Trash2 className="w-6 h-6 text-red-400" />
            Trash
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Items in trash can be restored or permanently removed to reclaim cloud storage space.
          </p>
        </div>

        {totalItems > 0 && (
          <Button
            variant="danger"
            size="sm"
            icon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={handleEmptyTrash}
          >
            Empty Trash
          </Button>
        )}
      </div>

      {totalItems === 0 ? (
        <EmptyState
          icon={<Trash2 className="w-12 h-12 text-slate-600" />}
          title="Trash is empty"
          description="Deleted items will appear here and can be restored anytime."
        />
      ) : (
        <div className="space-y-6">
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-3 text-xs text-slate-400">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>Items in trash still consume storage quota until permanently deleted.</span>
          </div>

          <div className="card divide-y divide-slate-800">
            {trashFolders.map(folder => (
              <div key={folder.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/40 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                  <FolderIcon className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{folder.name}</p>
                  <p className="text-xs text-slate-500">Deleted {formatRelativeTime(folder.deleted_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<RotateCcw className="w-3.5 h-3.5 text-brand-400" />}
                    onClick={() => handleRestore(folder.id, 'folder')}
                  >
                    Restore
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300"
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                    onClick={() => handlePermanentDelete(folder.id, 'folder', folder.name)}
                  >
                    Delete Forever
                  </Button>
                </div>
              </div>
            ))}

            {trashFiles.map(file => (
              <div key={file.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/40 transition-colors">
                <FileIcon category={file.category} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{file.name}</p>
                  <p className="text-xs text-slate-500">
                    {formatBytes(file.size)} • Deleted {formatRelativeTime(file.deleted_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<RotateCcw className="w-3.5 h-3.5 text-brand-400" />}
                    onClick={() => handleRestore(file.id, 'file')}
                  >
                    Restore
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300"
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                    onClick={() => handlePermanentDelete(file.id, 'file', file.name)}
                  >
                    Delete Forever
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
