import { formatDistanceToNow, format } from 'date-fns';

export const formatBytes = (bytes: number, decimals: number = 1): string => {
  if (bytes === 0 || !bytes || isNaN(bytes)) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export const formatRelativeTime = (dateString?: string | null): string => {
  if (!dateString) return 'Never';
  try {
    const date = new Date(dateString);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return dateString;
  }
};

export const formatDate = (dateString?: string | null, formatStr: string = 'MMM d, yyyy, h:mm a'): string => {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    return format(date, formatStr);
  } catch {
    return dateString;
  }
};

export const truncateString = (str: string, maxLength: number = 30): string => {
  if (!str || str.length <= maxLength) return str;
  const extIndex = str.lastIndexOf('.');
  if (extIndex > 0 && str.length - extIndex <= 7) {
    const ext = str.substring(extIndex);
    const name = str.substring(0, extIndex);
    return `${name.substring(0, maxLength - ext.length - 3)}...${ext}`;
  }
  return `${str.substring(0, maxLength - 3)}...`;
};
