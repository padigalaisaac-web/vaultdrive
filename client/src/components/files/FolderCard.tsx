import React, { useState } from 'react';
import { Folder as FolderIcon, MoreVertical, Pencil, Trash2, Star } from 'lucide-react';
import { clsx } from 'clsx';
import { Folder } from '../../types/index.js';
import { truncateString, formatRelativeTime } from '../../utils/formatters.js';

interface FolderCardProps {
  folder: Folder;
  viewMode?: 'grid' | 'list';
  onOpen: (folder: Folder) => void;
  onRename?: (folder: Folder) => void;
  onDelete?: (folder: Folder) => void;
  onFavorite?: (folder: Folder) => void;
}

export const FolderCard: React.FC<FolderCardProps> = ({
  folder,
  viewMode = 'grid',
  onOpen,
  onRename,
  onDelete,
  onFavorite
}) => {
  const [showMenu, setShowMenu] = useState(false);

  if (viewMode === 'list') {
    return (
      <div
        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer group transition-colors rounded-lg hover:bg-slate-700/50"
        onClick={() => onOpen(folder)}
        role="row"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onOpen(folder)}
      >
        <div className="w-8 h-8 rounded-lg bg-brand-900/30 flex items-center justify-center flex-shrink-0">
          <FolderIcon className="w-5 h-5 text-brand-400" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-slate-200 truncate" title={folder.name}>
            {truncateString(folder.name, 40)}
          </span>
          <p className="text-xs text-slate-500">Folder</p>
        </div>
        <span className="text-xs text-slate-500 flex-shrink-0 w-24 text-right">
          {formatRelativeTime(folder.updated_at)}
        </span>
        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu((v) => !v);
            }}
            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-200 p-1 rounded transition-all"
            aria-label="Folder options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {showMenu && (
            <FolderContextMenu
              folder={folder}
              onClose={() => setShowMenu(false)}
              onOpen={() => { setShowMenu(false); onOpen(folder); }}
              onRename={() => { setShowMenu(false); onRename?.(folder); }}
              onDelete={() => { setShowMenu(false); onDelete?.(folder); }}
              onFavorite={() => { setShowMenu(false); onFavorite?.(folder); }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="card p-3.5 cursor-pointer hover:bg-slate-700 hover:border-slate-600 transition-all select-none group relative"
      onClick={() => onOpen(folder)}
      role="gridcell"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(folder)}
    >
      <div className="flex items-center justify-between mb-2">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${folder.color || '#0c8ee9'}20` }}
        >
          <FolderIcon className="w-6 h-6" style={{ color: folder.color || '#0c8ee9' }} />
        </div>
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu((v) => !v);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-600 text-slate-400 hover:text-slate-200 transition-all"
            aria-label="Folder options"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
          {showMenu && (
            <FolderContextMenu
              folder={folder}
              onClose={() => setShowMenu(false)}
              onOpen={() => { setShowMenu(false); onOpen(folder); }}
              onRename={() => { setShowMenu(false); onRename?.(folder); }}
              onDelete={() => { setShowMenu(false); onDelete?.(folder); }}
              onFavorite={() => { setShowMenu(false); onFavorite?.(folder); }}
            />
          )}
        </div>
      </div>

      <p className="text-sm font-medium text-slate-200 truncate" title={folder.name}>
        {truncateString(folder.name, 22)}
      </p>
      <p className="text-xs text-slate-500 mt-0.5">
        {formatRelativeTime(folder.updated_at)}
      </p>
    </div>
  );
};

interface FolderContextMenuProps {
  folder: Folder;
  onClose: () => void;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onFavorite: () => void;
}

const FolderContextMenu: React.FC<FolderContextMenuProps> = ({
  folder,
  onClose,
  onOpen,
  onRename,
  onDelete,
  onFavorite
}) => {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); onClose(); }} />
      <div className="absolute right-0 top-6 z-50 w-40 card shadow-xl border-slate-600 py-1 animate-fade-in">
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors text-left"
        >
          <FolderIcon className="w-3.5 h-3.5" />
          Open
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRename(); }}
          className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors text-left"
        >
          <Pencil className="w-3.5 h-3.5" />
          Rename
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onFavorite(); }}
          className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors text-left"
        >
          <Star className={clsx('w-3.5 h-3.5', folder.is_favorite && 'fill-yellow-400 text-yellow-400')} />
          {folder.is_favorite ? 'Unfavorite' : 'Favorite'}
        </button>
        <div className="my-1 border-t border-slate-700" />
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors text-left"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Move to Trash
        </button>
      </div>
    </>
  );
};
