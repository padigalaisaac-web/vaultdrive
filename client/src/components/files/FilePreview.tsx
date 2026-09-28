import React, { useState, useEffect } from 'react';
import { X, Download, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { FileItem } from '../../types/index.js';
import { getPreviewType } from '../../utils/mime.js';
import { formatBytes } from '../../utils/formatters.js';
import { fileService } from '../../services/fileService.js';
import { offlineStorageService } from '../../services/offlineStorageService.js';
import { FileIcon } from '../FileIcon.js';

interface FilePreviewProps {
  file: FileItem;
  onClose: () => void;
}

export const FilePreview: React.FC<FilePreviewProps> = ({ file, onClose }) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const previewType = getPreviewType(file.mime_type, file.name);

  useEffect(() => {
    let url: string | null = null;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Try offline blob first
        const offline = await offlineStorageService.getOfflineBlob(file.id);
        if (offline) {
          url = URL.createObjectURL(offline.blob);
          setObjectUrl(url);
          if (['text', 'markdown', 'code', 'json', 'csv'].includes(previewType)) {
            const text = await offline.blob.text();
            setTextContent(text);
          }
          setIsLoading(false);
          return;
        }

        // Online preview
        if (['text', 'markdown', 'code', 'json', 'csv'].includes(previewType)) {
          const res = await fetch(fileService.getInlineUrl(file.id));
          const text = await res.text();
          setTextContent(text);
        } else {
          setObjectUrl(fileService.getInlineUrl(file.id));
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load preview');
      } finally {
        setIsLoading(false);
      }
    };

    load();
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [file.id]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleDownload = async () => {
    const offline = await offlineStorageService.getOfflineBlob(file.id);
    if (offline) {
      const url = URL.createObjectURL(offline.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      window.open(fileService.getDownloadUrl(file.id), '_blank');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${file.name}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <FileIcon category={file.category} size="sm" showBackground={false} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-100 truncate">{file.name}</p>
            <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleDownload}
            className="btn-secondary py-1.5"
            aria-label="Download file"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download</span>
          </button>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 flex items-center justify-center overflow-auto p-4 min-h-0">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
            <p className="text-slate-400 text-sm">Loading preview…</p>
          </div>
        ) : error ? (
          <div className="text-center">
            <p className="text-red-400 mb-2">{error}</p>
            <button onClick={handleDownload} className="btn-secondary text-sm">
              <Download className="w-4 h-4" />
              Download instead
            </button>
          </div>
        ) : (
          <>
            {previewType === 'image' && objectUrl && (
              <img
                src={objectUrl}
                alt={file.name}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            )}

            {previewType === 'pdf' && objectUrl && (
              <iframe
                src={objectUrl}
                title={file.name}
                className="w-full h-full rounded-lg border border-slate-700"
                style={{ minHeight: '70vh' }}
              />
            )}

            {previewType === 'video' && objectUrl && (
              <video
                src={objectUrl}
                controls
                autoPlay={false}
                className="max-w-full max-h-full rounded-lg shadow-2xl"
                style={{ maxHeight: '80vh' }}
              />
            )}

            {previewType === 'audio' && objectUrl && (
              <div className="card p-8 flex flex-col items-center gap-4 w-96">
                <FileIcon category="audio" size="xl" />
                <p className="text-slate-200 font-medium text-center">{file.name}</p>
                <audio src={objectUrl} controls className="w-full mt-2" />
              </div>
            )}

            {(['text', 'markdown', 'code', 'json', 'csv'] as const).includes(previewType as any) && textContent !== null && (
              <div className="w-full max-w-4xl h-full overflow-auto bg-slate-900 rounded-xl border border-slate-700 p-4">
                <pre className="text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap break-words">
                  {textContent}
                </pre>
              </div>
            )}

            {previewType === 'unsupported' && (
              <div className="text-center">
                <FileIcon category={file.category} size="xl" className="mx-auto mb-4" />
                <p className="text-slate-300 font-medium mb-1">Preview unavailable</p>
                <p className="text-slate-500 text-sm mb-4">This file type cannot be previewed in the browser.</p>
                <button onClick={handleDownload} className="btn-primary">
                  <Download className="w-4 h-4" />
                  Download File
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
