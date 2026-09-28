import React, { useRef } from 'react';
import { Upload } from 'lucide-react';
import { useUploadStore } from '../../stores/uploadStore.js';

interface UploadManagerProps {
  folderId?: string | null;
  onUploadsComplete?: () => void;
}

export const UploadManager: React.FC<UploadManagerProps> = ({ folderId }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addFiles } = useUploadStore();

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      addFiles(files, folderId);
    }
    e.target.value = '';
  };

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
    </>
  );
};
