import React from 'react';
import {
  File, FileText, FileImage, FileVideo, FileAudio, Archive,
  Folder, FolderOpen
} from 'lucide-react';
import { clsx } from 'clsx';
import { FileCategory } from '../types/index.js';

const categoryConfig: Record<FileCategory | 'folder', { Icon: any; color: string; bg: string }> = {
  image:    { Icon: FileImage,  color: 'text-purple-400', bg: 'bg-purple-900/30' },
  video:    { Icon: FileVideo,  color: 'text-red-400',    bg: 'bg-red-900/30' },
  audio:    { Icon: FileAudio,  color: 'text-pink-400',   bg: 'bg-pink-900/30' },
  document: { Icon: FileText,   color: 'text-blue-400',   bg: 'bg-blue-900/30' },
  archive:  { Icon: Archive,    color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
  other:    { Icon: File,       color: 'text-slate-400',  bg: 'bg-slate-700/50' },
  folder:   { Icon: Folder,     color: 'text-brand-400',  bg: 'bg-brand-900/30' },
};

interface FileIconProps {
  category?: FileCategory;
  isFolder?: boolean;
  isOpen?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showBackground?: boolean;
}

const sizeMap = {
  sm:  { icon: 'w-4 h-4', container: 'w-8 h-8' },
  md:  { icon: 'w-5 h-5', container: 'w-10 h-10' },
  lg:  { icon: 'w-7 h-7', container: 'w-14 h-14' },
  xl:  { icon: 'w-9 h-9', container: 'w-18 h-18' },
};

export const FileIcon: React.FC<FileIconProps> = ({
  category = 'other',
  isFolder = false,
  isOpen = false,
  size = 'md',
  className,
  showBackground = true
}) => {
  const key = isFolder ? 'folder' : category;
  const config = categoryConfig[key] || categoryConfig['other'];
  const { Icon } = config;
  const FolderIcon = isOpen ? FolderOpen : Folder;
  const ActualIcon = isFolder ? FolderIcon : Icon;
  const sizes = sizeMap[size];

  if (!showBackground) {
    return <ActualIcon className={clsx(config.color, sizes.icon, className)} />;
  }

  return (
    <div className={clsx('rounded-xl flex items-center justify-center flex-shrink-0', config.bg, sizes.container, className)}>
      <ActualIcon className={clsx(config.color, sizes.icon)} />
    </div>
  );
};
