import React, { useCallback, useState } from 'react';
import { clsx } from 'clsx';
import { Upload, FolderUp } from 'lucide-react';

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({ onFiles, className, children, disabled = false }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only fire if leaving the root dropzone element
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;

    const droppedFiles: File[] = [];
    if (e.dataTransfer.items) {
      for (const item of Array.from(e.dataTransfer.items)) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) droppedFiles.push(file);
        }
      }
    } else {
      droppedFiles.push(...Array.from(e.dataTransfer.files));
    }

    if (droppedFiles.length > 0) {
      onFiles(droppedFiles);
    }
  }, [disabled, onFiles]);

  if (children) {
    return (
      <div
        className={clsx(className, isDragOver && 'drop-zone-active ring-2 ring-brand-500')}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {children}
        {isDragOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-brand-900/80 rounded-xl border-2 border-brand-500 border-dashed z-10 pointer-events-none">
            <div className="text-center">
              <FolderUp className="w-10 h-10 text-brand-400 mx-auto mb-2" />
              <p className="text-brand-300 font-semibold text-lg">Drop files here</p>
              <p className="text-brand-400/70 text-sm">Release to upload</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-150',
        isDragOver ? 'border-brand-500 bg-brand-900/20' : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Upload className={clsx('w-10 h-10', isDragOver ? 'text-brand-400' : 'text-slate-500')} />
      <div className="text-center">
        <p className="text-slate-200 font-medium">Drop files here</p>
        <p className="text-slate-500 text-sm mt-0.5">or use the Upload button</p>
      </div>
    </div>
  );
};
