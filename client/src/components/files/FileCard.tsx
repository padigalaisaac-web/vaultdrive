import React, { useState } from 'react';
import { Star, Download, Trash2, Share2, WifiOff, MoreVertical, FolderInput, Pencil, Eye } from 'lucide-react';
import { clsx } from 'clsx';
import { FileItem } from '../../types/index.js';
import { FileIcon } from '../FileIcon.js';
import { formatBytes, formatRelativeTime, truncateString } from '../../utils/formatters.js';
import { fileService } from '../../services/fileService.js';
import { offlineStorageService } from '../../services/offlineStorageService.js';

interface FileCardProps {
  file: FileItem;
  isSelected?: boolean;
  viewMode?: 'grid' | 'list';
  onSelect?: (id: string, multi?: boolean) => void;
  onOpen?: (file: FileItem) => void;
  onRename?: (file: FileItem) => void;
  onMove?: (file: FileItem) => void;
  onShare?: (file: FileItem) => void;
  onDelete?: (file: FileItem) => void;
  onRefresh?: () => void;
}

export const FileCard: React.FC<FileCardProps> = ({
  file,
  isSelected,
  viewMode = 'grid',
  onSelect,
  onOpen,
  onRename,
  onMove,
  onShare,
  onDelete,
  onRefresh
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsProcessing(true);
    try {
      await fileService.updateFile(file.id, { is_favorite: !file.is_favorite });
      onRefresh?.();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOffline = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsProcessing(true);
    try {
      if (file.is_offline) {
        await offlineStorageService.removeOffline(file.id);
      } else {
        await offlineStorageService.makeAvailableOffline(file);
      }
      onRefresh?.();
    } catch (err: any) {
      alert(err.message || 'Failed to manage offline status');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // If we have an offline copy, use it directly
    const offlineBlob = await offlineStorageService.getOfflineBlob(file.id);
    if (offlineBlob) {
      const url = URL.createObjectURL(offlineBlob.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    // Otherwise use server download URL
    window.open(fileService.getDownloadUrl(file.id), '_blank');
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (showMenu) {
      setShowMenu(false);
      return;
    }
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      onSelect?.(file.id, true);
    } else {
      onSelect?.(file.id);
    }
  };

  const handleDoubleClick = () => {
    onOpen?.(file);
  };

  if (viewMode === 'list') {
    return (
      <div
        className={clsx(
          'flex items-center gap-3 px-4 py-2.5 cursor-pointer group transition-colors rounded-lg',
          isSelected ? 'bg-brand-900/30 ring-1 ring-brand-600' : 'hover:bg-slate-700/50'
        )}
        onClick={handleCardClick}
        onDoubleClick={handleDoubleClick}
        role="row"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onOpen?.(file)}
      >
        <FileIcon category={file.category} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-slate-200 truncate" title={file.name}>
              {truncateString(file.name, 40)}
            </span>
            {file.is_offline && (
              <span title="Available offline">
                <WifiOff className="w-3 h-3 text-emerald-400 flex-shrink-0" />
              </span>
            )}
            {file.is_favorite && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 flex-shrink-0" />}
          </div>
          <p className="text-xs text-slate-500">{file.category}</p>
        </div>
        <span className="text-xs text-slate-500 flex-shrink-0 w-16 text-right">{formatBytes(file.size)}</span>
        <span className="text-xs text-slate-500 flex-shrink-0 w-24 text-right">{formatRelativeTime(file.updated_at)}</span>

        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(v => !v); }}
            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-200 p-1 rounded transition-all"
            aria-label="File options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {showMenu && (
            <FileContextMenu
              file={file}
              onClose={() => setShowMenu(false)}
              onOpen={() => { setShowMenu(false); onOpen?.(file); }}
              onRename={() => { setShowMenu(false); onRename?.(file); }}
              onMove={() => { setShowMenu(false); onMove?.(file); }}
              onShare={() => { setShowMenu(false); onShare?.(file); }}
              onDelete={() => { setShowMenu(false); onDelete?.(file); }}
              onDownload={(e) => { setShowMenu(false); handleDownload(e); }}
              onFavorite={(e) => { setShowMenu(false); handleFavorite(e); }}
              onOffline={(e) => { setShowMenu(false); handleOffline(e); }}
            />
          )}
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div
      className={clsx('file-card relative', isSelected && 'file-card-selected')}
      onClick={handleCardClick}
      onDoubleClick={handleDoubleClick}
      role="gridcell"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onOpen?.(file)}
    >
      {/* Top badges */}
      <div className="absolute top-2 left-2 flex gap-1">
        {file.is_offline && (
          <span className="badge bg-emerald-900/70 text-emerald-300 text-xs px-1.5 py-0.5" title="Available offline">✓</span>
        )}
      </div>

      {/* More menu */}
      <div className="absolute top-2 right-2">
        <button
          onClick={(e) => { e.stopPropagation(); setShowMenu(v => !v); }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-600 text-slate-400 hover:text-slate-200 transition-all"
          aria-label="File options"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
        {showMenu && (
          <FileContextMenu
            file={file}
            onClose={() => setShowMenu(false)}
            onOpen={() => { setShowMenu(false); onOpen?.(file); }}
            onRename={() => { setShowMenu(false); onRename?.(file); }}
            onMove={() => { setShowMenu(false); onMove?.(file); }}
            onShare={() => { setShowMenu(false); onShare?.(file); }}
            onDelete={() => { setShowMenu(false); onDelete?.(file); }}
            onDownload={(e) => { setShowMenu(false); handleDownload(e); }}
            onFavorite={(e) => { setShowMenu(false); handleFavorite(e); }}
            onOffline={(e) => { setShowMenu(false); handleOffline(e); }}
          />
        )}
      </div>

      <div className="flex flex-col items-center pt-3 pb-2 px-1">
        <FileIcon category={file.category} size="lg" className="mb-3" />
        <p className="text-xs text-slate-200 text-center font-medium w-full truncate leading-tight" title={file.name}>
          {truncateString(file.name, 22)}
        </p>
        <p className="text-xs text-slate-500 mt-1">{formatBytes(file.size)}</p>
      </div>

      {/* Bottom actions */}
      <div className="flex items-center justify-between pt-1.5 border-t border-slate-700 mt-1">
        <button onClick={handleFavorite} disabled={isProcessing} className="p-1 text-slate-500 hover:text-yellow-400 transition-colors" aria-label="Toggle favorite">
          <Star className={clsx('w-3.5 h-3.5', file.is_favorite && 'fill-yellow-400 text-yellow-400')} />
        </button>
        <button onClick={handleOffline} disabled={isProcessing} className="p-1 text-slate-500 hover:text-emerald-400 transition-colors" aria-label="Toggle offline availability">
          <WifiOff className={clsx('w-3.5 h-3.5', file.is_offline && 'text-emerald-400')} />
        </button>
        <button onClick={handleDownload} className="p-1 text-slate-500 hover:text-slate-200 transition-colors" aria-label="Download">
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

interface FileContextMenuProps {
  file: FileItem;
  onClose: () => void;
  onOpen: () => void;
  onRename: () => void;
  onMove: () => void;
  onShare: () => void;
  onDelete: () => void;
  onDownload: (e: React.MouseEvent) => void;
  onFavorite: (e: React.MouseEvent) => void;
  onOffline: (e: React.MouseEvent) => void;
}

const FileContextMenu: React.FC<FileContextMenuProps> = ({
  file, onClose, onOpen, onRename, onMove, onShare, onDelete, onDownload, onFavorite, onOffline
}) => {
  const menuItems = [
    { icon: Eye, label: 'Preview', action: onOpen },
    { icon: Pencil, label: 'Rename', action: onRename },
    { icon: FolderInput, label: 'Move', action: onMove },
    { icon: Share2, label: 'Share', action: onShare },
    { icon: Download, label: 'Download', action: onDownload as any },
    { icon: Star, label: file.is_favorite ? 'Unfavorite' : 'Favorite', action: onFavorite as any },
    { icon: WifiOff, label: file.is_offline ? 'Remove Offline' : 'Available Offline', action: onOffline as any },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); onClose(); }} />
      <div className="absolute right-0 top-6 z-50 w-44 card shadow-xl border-slate-600 py-1 animate-fade-in">
        {menuItems.map(({ icon: Icon, label, action }) => (
          <button
            key={label}
            onClick={(e) => { e.stopPropagation(); action(e as any); }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors text-left"
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
        <div className="my-1 border-t border-slate-700" />
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors text-left"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Move to Trash
        </button>
      </div>
    </>
  );
};
