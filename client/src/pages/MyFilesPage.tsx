import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FolderPlus,
  LayoutGrid,
  List,
  ArrowUpDown,
  ChevronRight,
  HardDrive
} from 'lucide-react';
import { useAppStore } from '../stores/appStore.js';
import { fileService } from '../services/fileService.js';
import { folderService } from '../services/folderService.js';
import { FileItem, Folder } from '../types/index.js';
import { FileCard } from '../components/files/FileCard.js';
import { FolderCard } from '../components/files/FolderCard.js';
import { FilePreview } from '../components/files/FilePreview.js';
import { ShareModal } from '../components/sharing/ShareModal.js';
import { DropZone } from '../components/DropZone.js';
import { Modal, Input, Button, EmptyState } from '../components/ui/index.js';

export const MyFilesPage: React.FC = () => {
  const { user } = useAppStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentFolderId = searchParams.get('folder') || null;

  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string }[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('name');

  // Modals state
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [shareItem, setShareItem] = useState<{ item: FileItem | Folder; type: 'file' | 'folder' } | null>(null);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameTarget, setRenameTarget] = useState<{ item: FileItem | Folder; type: 'file' | 'folder' } | null>(null);
  const [newName, setNewName] = useState('');

  const loadData = async () => {
    const fldrs = await folderService.getFolders(user?.id, currentFolderId);
    setFolders(fldrs);

    const fls = await fileService.getFiles(user?.id, currentFolderId);
    setFiles(fls);

    if (currentFolderId) {
      const crumbs = await folderService.getBreadcrumbs(currentFolderId);
      setBreadcrumbs(crumbs);
    } else {
      setBreadcrumbs([]);
    }
  };

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData();
    window.addEventListener('vaultdrive:refresh', handleRefresh);
    return () => window.removeEventListener('vaultdrive:refresh', handleRefresh);
  }, [currentFolderId, user?.id]);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    await folderService.createFolder(newFolderName.trim(), currentFolderId, '#0c8ee9', user?.id || 'local');
    setNewFolderName('');
    setIsFolderModalOpen(false);
    loadData();
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !newName.trim()) return;
    if (renameTarget.type === 'file') {
      await fileService.updateFile(renameTarget.item.id, { name: newName.trim() });
    } else {
      await folderService.updateFolder(renameTarget.item.id, { name: newName.trim() });
    }
    setRenameTarget(null);
    setNewName('');
    loadData();
  };

  const handleDeleteFolder = async (folder: Folder) => {
    if (confirm(`Move folder "${folder.name}" to trash?`)) {
      await folderService.deleteFolder(folder.id);
      loadData();
    }
  };

  const handleDeleteFile = async (file: FileItem) => {
    await fileService.deleteFile(file.id);
    loadData();
  };

  const handleDropFiles = async (droppedFiles: File[]) => {
    for (const f of droppedFiles) {
      try {
        await fileService.uploadFile(f, { folderId: currentFolderId });
      } catch {
        // Handled in service / queued
      }
    }
    loadData();
  };

  // Sorting
  const sortedFiles = [...files].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'date') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    if (sortBy === 'size') return b.size - a.size;
    return 0;
  });

  const sortedFolders = [...folders].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <DropZone onFiles={handleDropFiles} className="min-h-full">
      <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
        {/* Breadcrumb Navigation & Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
          <nav className="flex items-center gap-1.5 text-sm font-medium text-slate-400 overflow-x-auto py-1">
            <button
              onClick={() => setSearchParams({})}
              className={`hover:text-white flex items-center gap-1.5 transition-colors ${
                !currentFolderId ? 'text-white font-semibold' : ''
              }`}
            >
              <HardDrive className="w-4 h-4 text-brand-400" />
              <span>My Files</span>
            </button>

            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.id}>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                <button
                  onClick={() => setSearchParams({ folder: crumb.id })}
                  className={`hover:text-white transition-colors truncate max-w-[150px] ${
                    idx === breadcrumbs.length - 1 ? 'text-white font-semibold' : ''
                  }`}
                  title={crumb.name}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </nav>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Sort Toggle */}
            <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700">
              <button
                onClick={() => setSortBy('name')}
                className={`px-2.5 py-1 text-xs rounded-md transition-all ${
                  sortBy === 'name' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Name
              </button>
              <button
                onClick={() => setSortBy('date')}
                className={`px-2.5 py-1 text-xs rounded-md transition-all ${
                  sortBy === 'date' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Date
              </button>
              <button
                onClick={() => setSortBy('size')}
                className={`px-2.5 py-1 text-xs rounded-md transition-all ${
                  sortBy === 'size' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Size
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Grid view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="List view"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={<FolderPlus className="w-3.5 h-3.5" />}
              onClick={() => setIsFolderModalOpen(true)}
            >
              New Folder
            </Button>
          </div>
        </div>

        {/* Content Area */}
        {sortedFolders.length === 0 && sortedFiles.length === 0 ? (
          <EmptyState
            title="This folder is empty"
            description="Drag and drop files here or use the Upload button to store documents, images, and videos."
            action={
              <Button
                variant="primary"
                icon={<FolderPlus className="w-4 h-4" />}
                onClick={() => setIsFolderModalOpen(true)}
              >
                Create a Folder
              </Button>
            }
          />
        ) : (
          <div className="space-y-6">
            {/* Folders Section */}
            {sortedFolders.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Folders ({sortedFolders.length})
                </h3>
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {sortedFolders.map(folder => (
                      <FolderCard
                        key={folder.id}
                        folder={folder}
                        viewMode="grid"
                        onOpen={(f) => setSearchParams({ folder: f.id })}
                        onRename={(f) => {
                          setRenameTarget({ item: f, type: 'folder' });
                          setNewName(f.name);
                        }}
                        onDelete={handleDeleteFolder}
                        onFavorite={async (f) => {
                          await folderService.updateFolder(f.id, { is_favorite: !f.is_favorite });
                          loadData();
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="card divide-y divide-slate-800">
                    {sortedFolders.map(folder => (
                      <FolderCard
                        key={folder.id}
                        folder={folder}
                        viewMode="list"
                        onOpen={(f) => setSearchParams({ folder: f.id })}
                        onRename={(f) => {
                          setRenameTarget({ item: f, type: 'folder' });
                          setNewName(f.name);
                        }}
                        onDelete={handleDeleteFolder}
                        onFavorite={async (f) => {
                          await folderService.updateFolder(f.id, { is_favorite: !f.is_favorite });
                          loadData();
                        }}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Files Section */}
            {sortedFiles.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Files ({sortedFiles.length})
                </h3>
                {viewMode === 'grid' ? (
                  <div className="files-grid">
                    {sortedFiles.map(file => (
                      <FileCard
                        key={file.id}
                        file={file}
                        viewMode="grid"
                        onOpen={(f) => setPreviewFile(f)}
                        onRename={(f) => {
                          setRenameTarget({ item: f, type: 'file' });
                          setNewName(f.name);
                        }}
                        onShare={(f) => setShareItem({ item: f, type: 'file' })}
                        onDelete={handleDeleteFile}
                        onRefresh={loadData}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="card divide-y divide-slate-800">
                    {sortedFiles.map(file => (
                      <FileCard
                        key={file.id}
                        file={file}
                        viewMode="list"
                        onOpen={(f) => setPreviewFile(f)}
                        onRename={(f) => {
                          setRenameTarget({ item: f, type: 'file' });
                          setNewName(f.name);
                        }}
                        onShare={(f) => setShareItem({ item: f, type: 'file' })}
                        onDelete={handleDeleteFile}
                        onRefresh={loadData}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {/* File Preview Modal */}
        {previewFile && (
          <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} />
        )}

        {/* Share Modal */}
        {shareItem && (
          <ShareModal
            isOpen={true}
            item={shareItem.item}
            type={shareItem.type}
            onClose={() => setShareItem(null)}
          />
        )}

        {/* Create Folder Modal */}
        <Modal
          isOpen={isFolderModalOpen}
          onClose={() => setIsFolderModalOpen(false)}
          title="Create New Folder"
          size="sm"
        >
          <form onSubmit={handleCreateFolder} className="space-y-4">
            <Input
              label="Folder Name"
              placeholder="e.g. Documents, ML Project"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setIsFolderModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Create
              </Button>
            </div>
          </form>
        </Modal>

        {/* Rename Modal */}
        <Modal
          isOpen={Boolean(renameTarget)}
          onClose={() => setRenameTarget(null)}
          title={`Rename ${renameTarget?.type === 'file' ? 'File' : 'Folder'}`}
          size="sm"
        >
          <form onSubmit={handleRename} className="space-y-4">
            <Input
              label="New Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setRenameTarget(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Rename
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </DropZone>
  );
};
