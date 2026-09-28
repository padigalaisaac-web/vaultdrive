import { FileCategory } from '../types/index.js';

export type PreviewType =
  | 'image'
  | 'pdf'
  | 'video'
  | 'audio'
  | 'text'
  | 'markdown'
  | 'code'
  | 'csv'
  | 'json'
  | 'unsupported';

export const getCategoryFromFilename = (filename: string): FileCategory => {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return 'image';
  if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'csv', 'json', 'md', 'xml', 'log'].includes(ext)) return 'document';
  if (['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'wma'].includes(ext)) return 'audio';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) return 'archive';

  return 'other';
};

export const getPreviewType = (mimeType: string, filename: string): PreviewType => {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  // Images
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext) || mime.startsWith('image/')) {
    return 'image';
  }

  // PDF
  if (ext === 'pdf' || mime === 'application/pdf') {
    return 'pdf';
  }

  // Video
  if (['mp4', 'webm', 'mov'].includes(ext) || mime.startsWith('video/')) {
    return 'video';
  }

  // Audio
  if (['mp3', 'wav', 'ogg', 'aac'].includes(ext) || mime.startsWith('audio/')) {
    return 'audio';
  }

  // Markdown
  if (['md', 'markdown'].includes(ext) || mime === 'text/markdown') {
    return 'markdown';
  }

  // JSON
  if (ext === 'json' || mime === 'application/json') {
    return 'json';
  }

  // CSV
  if (ext === 'csv' || mime === 'text/csv') {
    return 'csv';
  }

  // Code / scripts
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'html', 'css', 'scss', 'sh', 'sql', 'yaml', 'yml', 'xml', 'env'].includes(ext)) {
    return 'code';
  }

  // Plain Text
  if (['txt', 'log', 'ini', 'conf'].includes(ext) || mime.startsWith('text/')) {
    return 'text';
  }

  return 'unsupported';
};
