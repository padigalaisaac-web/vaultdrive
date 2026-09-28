import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderPlus,
  HardDrive,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  Archive,
  Folder as FolderIcon,
  WifiOff,
  ArrowRight
} from 'lucide-react';
import { useAppStore } from '../stores/appStore.js';
import { storageService } from '../services/storageService.js';
import { fileService } from '../services/fileService.js';
import { folderService } from '../services/folderService.js';
import { FileItem, Folder, StorageStats } from '../types/index.js';
import { formatBytes } from '../utils/formatters.js';
import { FileCard } from '../components/files/FileCard.js';
import { FolderCard } from '../components/files/FolderCard.js';
import { FilePreview } from '../components/files/FilePreview.js';
import { Modal, Input, Button } from '../components/ui/index.js';

export const DashboardPage: React.FC = () => {
  const { user } = useAppStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [recentFiles, setRecentFiles] = useState<FileItem[]>([]);
  const [offlineFiles, setOfflineFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  // New Folder Modal
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const loadData = async () => {
    try {
      const s = await storageService.getStats();
      if (s) setStats(s);
    } catch { /* fallback */ }

    const allFiles = await fileService.getAllFiles(user?.id);
    setRecentFiles(allFiles.slice(0, 6));

    const offFiles = await fileService.getOfflineFiles(user?.id);
    setOfflineFiles(offFiles.slice(0, 6));

    const allFolders = await folderService.getFolders(user?.id, null);
    setFolders(allFolders.slice(0, 4));
  };

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData();
    window.addEventListener('vaultdrive:refresh', handleRefresh);
    return () => window.removeEventListener('vaultdrive:refresh', handleRefresh);
  }, [user?.id]);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    await folderService.createFolder(newFolderName.trim(), null, '#0c8ee9', user?.id || 'local');
    setNewFolderName('');
    setIsFolderModalOpen(false);
    loadData();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const categories = [
    { name: 'Documents', icon: FileText, bytes: stats?.categories?.documents || 0, color: 'text-blue-400', bg: 'bg-blue-900/30' },
    { name: 'Images', icon: FileImage, bytes: stats?.categories?.images || 0, color: 'text-purple-400', bg: 'bg-purple-900/30' },
    { name: 'Videos', icon: FileVideo, bytes: stats?.categories?.videos || 0, color: 'text-red-400', bg: 'bg-red-900/30' },
    { name: 'Audio', icon: FileAudio, bytes: stats?.categories?.audio || 0, color: 'text-pink-400', bg: 'bg-pink-900/30' },
    { name: 'Archives', icon: Archive, bytes: stats?.categories?.archives || 0, color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-fade-in">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
            {getGreeting()}, {user?.name || 'Explorer'}!
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Welcome to your secure, offline-first personal storage vault.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            icon={<FolderPlus className="w-4 h-4" />}
            onClick={() => setIsFolderModalOpen(true)}
          >
            New Folder
          </Button>
        </div>
      </div>

      {/* Storage Breakdown Widget */}
      <div className="card p-6 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border-slate-800 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-400">
              Cloud Storage Quota
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold text-white">
                {formatBytes(stats?.used || user?.used_storage || 0)}
              </span>
              <span className="text-sm text-slate-400 font-medium">
                / {formatBytes(stats?.total || user?.storage_quota || 10737418240)}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {stats?.total_files || recentFiles.length} files across {stats?.total_folders || folders.length} folders
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-xs text-slate-400 block font-medium">Available Offline</span>
              <span className="text-lg font-bold text-emerald-400 flex items-center justify-end gap-1 mt-0.5">
                <WifiOff className="w-4 h-4" />
                {stats?.offline_files || offlineFiles.length} files
              </span>
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-6">
          {categories.map(({ name, icon: Icon, bytes, color, bg }) => (
            <div key={name} className="p-3 rounded-xl bg-slate-800/50 border border-slate-800 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-400 truncate">{name}</p>
                <p className="text-xs font-semibold text-slate-200 mt-0.5">{formatBytes(bytes)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Folders Overview */}
      {folders.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
              <FolderIcon className="w-4 h-4 text-brand-400" />
              Folders
            </h2>
            <button
              onClick={() => navigate('/files')}
              className="text-xs font-medium text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {folders.map(f => (
              <FolderCard
                key={f.id}
                folder={f}
                onOpen={(folder) => navigate(`/files?folder=${folder.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recent Files */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-brand-400" />
            Recent Files
          </h2>
          <button
            onClick={() => navigate('/recent')}
            className="text-xs font-medium text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentFiles.length === 0 ? (
          <div className="card p-10 text-center border-dashed border-slate-800">
            <p className="text-sm text-slate-400">No files uploaded yet.</p>
            <p className="text-xs text-slate-500 mt-1">Use the upload button or drag files directly to get started.</p>
          </div>
        ) : (
          <div className="files-grid">
            {recentFiles.map(file => (
              <FileCard
                key={file.id}
                file={file}
                onOpen={(f) => setPreviewFile(f)}
                onRefresh={loadData}
              />
            ))}
          </div>
        )}
      </section>

      {/* Available Offline Files */}
      {offlineFiles.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-emerald-400 flex items-center gap-2">
              <WifiOff className="w-4 h-4" />
              Available Offline
            </h2>
            <button
              onClick={() => navigate('/offline')}
              className="text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
            >
              Manage offline files <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
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
        </section>
      )}

      {/* Preview Modal */}
      {previewFile && (
        <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} />
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
            placeholder="e.g. Work, College, Projects"
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
    </div>
  );
};
